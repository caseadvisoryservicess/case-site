#!/usr/bin/env python3
"""
Match collected observations against the dataset and PROPOSE changes.

    python3 tools/merge_incoming.py --in data/incoming/src-osm-overpass.observations.json
    python3 tools/merge_incoming.py --in <file> --apply --reviewer "A. Karimova"

It never edits data/seed.json without --apply, and --apply refuses anything the
source's licence does not permit it to store. The output is a proposal file a
person reads.

WHY A PROPOSAL AND NOT A MERGE
------------------------------
The dataset already has a rule for this shape of problem: duplicate groups ship
as `undecided` and nothing collapses until a human adjudicates (D6). Ingestion is
the same problem arriving from outside, so it gets the same answer. A second
source agreeing with the first is worth recording; a second source DISAGREEING
with the first is the most valuable thing an ingest produces, and an importer
that picks a winner throws exactly that away.

THE FOUR OUTCOMES PER FIELD
---------------------------
  fill          existing is unknown, incoming has a value  -> proposed
  corroborate   both known and equal  -> raises sourceCount, never the value
  conflict      both known and different  -> recorded, never resolved here
  ignore        incoming is unknown  -> nothing. Absence is not evidence of
                absence, and overwriting a known value with a blank because one
                source did not carry it is the worst outcome available.

MATCHING
--------
Coordinates first, name second, and neither alone. 40 m is the auto-match
radius; between 40 m and 150 m a strong name match is required and the result is
still flagged for review. A business centre and the cafe in its lobby are 15 m
apart and share nothing else, so distance alone would merge them.
"""
import argparse
import json
import math
import re
import sys
import unicodedata
from datetime import date
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import sources as SRC  # noqa: E402

ROOT = Path(__file__).resolve().parent.parent
SEED = ROOT / 'data' / 'seed.json'

AUTO_MATCH_M = 40.0      # same building, on any reasonable coordinate accuracy
REVIEW_MATCH_M = 150.0   # plausible, but a person decides
NAME_STRONG = 0.86       # token similarity above which two names are "the same"

# Fields an external source may ever propose. Rent, GLA, occupancy and vacancy
# are deliberately NOT here: those are the commercially sensitive figures this
# product exists to be careful about, and no map service or directory is an
# acceptable source for them. They come from a broker, a landlord or a document.
PROPOSABLE = {'name', 'address', 'lat', 'lng', 'floors', 'yearOpened',
              'operator', 'owner', 'developer', 'status'}

# Never proposed by an importer, at any confidence, from any source.
NEVER_IMPORT = {'askingRent', 'gla', 'gba', 'occupancyPct', 'vacancyPct',
                'availableArea', 'serviceCharge', 'officeClass', 'tenants'}


def haversine_m(a_lat, a_lng, b_lat, b_lng):
    R = 6371008.8
    p1, p2 = math.radians(a_lat), math.radians(b_lat)
    dp = math.radians(b_lat - a_lat)
    dl = math.radians(b_lng - a_lng)
    h = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 2 * R * math.asin(min(1.0, math.sqrt(h)))


_NOISE = {
    'бизнес', 'центр', 'бизнесцентр', 'бц', 'business', 'center', 'centre',
    'tower', 'plaza', 'office', 'офис', 'здание', 'ооо', 'llc', 'the',
}


def norm_name(s):
    """Fold case, strip accents and punctuation, drop the words every business
    centre shares. Without the stop-list, "Бизнес центр Alpha" and "Бизнес
    центр Beta" score as near-identical on the two words they have in common."""
    s = unicodedata.normalize('NFKD', str(s or '')).lower()
    s = ''.join(c for c in s if not unicodedata.combining(c))
    s = re.sub(r'[^0-9a-zа-яё\s]+', ' ', s)
    toks = [t for t in s.split() if t and t not in _NOISE]
    return toks


def name_similarity(a, b):
    """Jaccard over meaningful tokens, with a containment bonus.

    Containment matters here: "Trilliant" against "Trilliant Business Center"
    is the same building, but plain Jaccard scores it 0.5 because one side
    carries an extra token the stop-list did not catch."""
    ta, tb = set(norm_name(a)), set(norm_name(b))
    if not ta or not tb:
        return 0.0
    inter = len(ta & tb)
    if not inter:
        return 0.0
    jaccard = inter / len(ta | tb)
    containment = inter / min(len(ta), len(tb))
    return max(jaccard, containment * 0.95)


def same_address(a, b):
    """Two address strings describing the same place.

    Without this, every record matched produced an address "conflict" that was
    only a formatting difference – the seed carries ", Tashkent" on the end and
    OSM does not. Fifty conflicts nobody needs to read is how the four that
    matter become invisible, which is the same failure as the "Not recorded"
    noise the result cards used to print.
    """
    def fold(x):
        x = unicodedata.normalize('NFKD', str(x or '')).lower()
        x = ''.join(c for c in x if not unicodedata.combining(c))
        x = re.sub(r'[^0-9a-zа-яё\s]+', ' ', x)
        drop = {'tashkent', 'toshkent', 'ташкент', 'uzbekistan', 'узбекистан',
                'ул', 'улица', 'кучаси', 'street', 'str', 'проспект', 'пр'}
        return [t for t in x.split() if t and t not in drop]
    fa, fb = fold(a), fold(b)
    if not fa or not fb:
        return False
    sa, sb = set(fa), set(fb)
    # Containment, not equality: one side routinely carries a district or a city
    # the other omits, and that is not a disagreement about where the building is.
    return sa <= sb or sb <= sa


def same_name(a, b):
    """Names that differ only by the words every business centre shares."""
    ta, tb = set(norm_name(a)), set(norm_name(b))
    if not ta or not tb:
        return False
    return ta <= tb or tb <= ta


def is_known(v):
    """Mirrors GEO.util.isKnown: 0 and False are values; '', None, [] are not."""
    if v is None:
        return False
    if isinstance(v, str):
        return v.strip() != ''
    if isinstance(v, (list, dict)):
        return len(v) > 0
    return True


def match_one(obs, records):
    """Best candidate for one observation, with the reason it was chosen."""
    f = obs.get('fields') or {}
    if f.get('lat') is None or f.get('lng') is None:
        return dict(kind='unmatchable', reason='observation has no coordinates')

    scored = []
    for r in records:
        if not is_known(r.get('lat')) or not is_known(r.get('lng')):
            continue
        d = haversine_m(f['lat'], f['lng'], r['lat'], r['lng'])
        if d > REVIEW_MATCH_M:
            continue
        sim = name_similarity(f.get('name'), r.get('name'))
        scored.append((d, sim, r))

    if not scored:
        return dict(kind='new', reason='no record within %.0f m' % REVIEW_MATCH_M)

    scored.sort(key=lambda x: (-x[1], x[0]))
    d, sim, rec = scored[0]

    # Two candidates that are equally good is a human's problem, not a
    # tie-breaker's: picking one silently is how the wrong building gets edited.
    rivals = [s for s in scored if s is not scored[0]
              and abs(s[1] - sim) < 0.05 and abs(s[0] - d) < 25]
    if rivals:
        return dict(kind='ambiguous', recordId=rec['id'], distanceM=round(d, 1),
                    nameSimilarity=round(sim, 3),
                    reason='%d records are equally close and equally similar' % (len(rivals) + 1))

    if d <= AUTO_MATCH_M and sim >= NAME_STRONG:
        return dict(kind='matched', recordId=rec['id'], distanceM=round(d, 1),
                    nameSimilarity=round(sim, 3),
                    reason='within %.0f m and names agree' % AUTO_MATCH_M)
    if d <= AUTO_MATCH_M:
        return dict(kind='review', recordId=rec['id'], distanceM=round(d, 1),
                    nameSimilarity=round(sim, 3),
                    reason='close enough to be the same building, but the names do not agree')
    if sim >= NAME_STRONG:
        return dict(kind='review', recordId=rec['id'], distanceM=round(d, 1),
                    nameSimilarity=round(sim, 3),
                    reason='names agree but the points are %.0f m apart' % d)
    return dict(kind='new', reason='nearest record is %.0f m away with a different name' % d)


def diff_fields(obs_fields, rec):
    fills, corroborations, conflicts, refused = [], [], [], []
    for key, val in (obs_fields or {}).items():
        if key in NEVER_IMPORT:
            refused.append(dict(field=key, value=val,
                                reason='commercial figures are never imported from a '
                                       'map service or directory'))
            continue
        if key not in PROPOSABLE:
            continue
        if not is_known(val):
            continue
        cur = rec.get(key)
        if not is_known(cur):
            fills.append(dict(field=key, value=val))
        elif isinstance(cur, float) and isinstance(val, (int, float)):
            # Coordinates never compare equal to the digit. Anything inside the
            # auto-match radius is the same point recorded twice, not a change.
            corroborations.append(dict(field=key, value=cur))
        elif str(cur).strip().lower() == str(val).strip().lower():
            corroborations.append(dict(field=key, value=cur))
        elif key == 'address' and same_address(cur, val):
            corroborations.append(dict(field=key, value=cur, note='same address, different formatting'))
        elif key == 'name' and same_name(cur, val):
            corroborations.append(dict(field=key, value=cur, note='same name modulo "business centre"'))
        else:
            c = dict(field=key, current=cur, incoming=val)
            # A one-word address like "Tashkent" is technically recorded and
            # practically useless. Saying so turns a flat conflict list into a
            # ranked one, without the importer deciding anything.
            if key == 'address' and len(str(cur).split()) <= 2 \
                    and len(str(val).split()) > len(str(cur).split()):
                c['note'] = 'the incoming address is more specific than the recorded one'
            conflicts.append(c)
    return fills, corroborations, conflicts, refused


def build_proposal(envelope, seed):
    src_id = envelope['sourceId']
    may_populate = SRC.may_populate(src_id)
    records = [r for r in seed['records'] if r.get('recordType') == 'VERIFIED_SOURCE']

    proposal = dict(
        generatedAt=date.today().isoformat(),
        sourceId=src_id, sourceName=envelope.get('sourceName'),
        licence=envelope.get('licence'), storage=envelope.get('storage'),
        mayPopulateDataset=may_populate,
        observationCount=envelope.get('count', 0),
        items=[], summary={},
    )

    counts = dict(matched=0, review=0, ambiguous=0, new=0, unmatchable=0)
    n_fill = n_corr = n_conf = n_refused = 0

    for obs in envelope.get('observations', []):
        m = match_one(obs, records)
        counts[m['kind']] = counts.get(m['kind'], 0) + 1
        item = dict(externalId=obs.get('externalId'), externalUrl=obs.get('externalUrl'),
                    incoming=obs.get('fields'), match=m)

        if m['kind'] in ('matched', 'review'):
            rec = next(r for r in records if r['id'] == m['recordId'])
            fills, corr, conf, refused = diff_fields(obs.get('fields'), rec)
            # The licence gate. A 'display' source can tell you your address is
            # wrong; it may not be the reason your dataset says something new.
            item['fills'] = fills if may_populate else []
            item['fillsWithheld'] = [] if may_populate else fills
            item['corroborations'] = corr
            item['conflicts'] = conf
            item['refusedFields'] = refused
            n_fill += len(item['fills'])
            n_corr += len(corr)
            n_conf += len(conf)
            n_refused += len(refused)
        proposal['items'].append(item)

    proposal['summary'] = dict(
        match=counts, proposedFills=n_fill, corroborations=n_corr,
        conflicts=n_conf, refusedCommercialFields=n_refused,
        fillsWithheldByLicence=sum(len(i.get('fillsWithheld', [])) for i in proposal['items']),
    )
    return proposal


def apply_proposal(proposal, seed, reviewer):
    if not proposal['mayPopulateDataset']:
        sys.exit('merge: %s has storage=%s – its values may not be written into the\n'
                 '       dataset. The proposal is still useful: read the conflicts.'
                 % (proposal['sourceId'], proposal['storage']))
    if not reviewer:
        sys.exit('merge: --apply needs --reviewer NAME. Every applied value records\n'
                 '       who accepted it; that is what makes it auditable later.')

    by_id = {r['id']: r for r in seed['records']}
    profile_id = 'IMPORT-' + proposal['sourceId'].replace('SRC-', '')
    seed.setdefault('evidenceProfiles', {})[profile_id] = dict(
        source=proposal['sourceName'], sourceId=proposal['sourceId'],
        sourceUrl=None, method='import', confidence='Medium',
        collectorId='tools/collect.py', reviewer=reviewer,
        qcStatus='needs_check',
        note='Imported from %s under %s and accepted by %s. Only fields that were '
             'previously unrecorded were filled; conflicts were left unresolved.'
             % (proposal['sourceName'], proposal['licence'], reviewer),
    )

    applied = 0
    for item in proposal['items']:
        if item['match']['kind'] != 'matched':
            continue                      # review/ambiguous are for a person
        rec = by_id.get(item['match']['recordId'])
        if not rec:
            continue
        for f in item.get('fills', []):
            if is_known(rec.get(f['field'])):
                continue                  # changed since the proposal was built
            rec[f['field']] = f['value']
            rec.setdefault('_evidence', {})[f['field']] = profile_id
            applied += 1
    return applied


def main():
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('--in', dest='infile', required=True)
    ap.add_argument('--seed', default=str(SEED))
    ap.add_argument('--out', default=None)
    ap.add_argument('--apply', action='store_true')
    ap.add_argument('--reviewer')
    a = ap.parse_args()

    envelope = json.loads(Path(a.infile).read_text(encoding='utf-8'))
    if not envelope.get('ok'):
        sys.exit('merge: %s records a FAILED collection (%s). There is nothing to\n'
                 '       merge – an empty proposal here would read like "the source\n'
                 '       had nothing", which is not what happened.'
                 % (a.infile, envelope.get('error')))

    seed = json.loads(Path(a.seed).read_text(encoding='utf-8'))
    proposal = build_proposal(envelope, seed)

    out = Path(a.out) if a.out else (ROOT / 'data' / 'incoming' /
                                     ('%s.proposal.json' % proposal['sourceId'].lower()))
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(proposal, indent=2, ensure_ascii=False) + '\n', encoding='utf-8')

    s = proposal['summary']
    print('%s -> %s' % (proposal['sourceId'], out.relative_to(ROOT)))
    print('  observations   %d' % proposal['observationCount'])
    print('  matched %d | needs review %d | ambiguous %d | new %d | unmatchable %d'
          % (s['match']['matched'], s['match']['review'], s['match']['ambiguous'],
             s['match']['new'], s['match']['unmatchable']))
    print('  proposed fills %d | corroborations %d | CONFLICTS %d'
          % (s['proposedFills'], s['corroborations'], s['conflicts']))
    if s['fillsWithheldByLicence']:
        print('  %d fills withheld: storage=%s forbids storing this source\'s values'
              % (s['fillsWithheldByLicence'], proposal['storage']))
    if s['refusedCommercialFields']:
        print('  %d commercial fields refused outright (rent, GLA, occupancy…)'
              % s['refusedCommercialFields'])

    if a.apply:
        n = apply_proposal(proposal, seed, a.reviewer)
        Path(a.seed).write_text(json.dumps(seed, indent=1, ensure_ascii=False) + '\n',
                                encoding='utf-8')
        print('  APPLIED %d fills to %s (reviewer: %s)' % (n, a.seed, a.reviewer))


if __name__ == '__main__':
    main()
