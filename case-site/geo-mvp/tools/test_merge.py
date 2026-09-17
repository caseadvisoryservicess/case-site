#!/usr/bin/env python3
"""
Tests for the ingestion path: matching, the four per-field outcomes, and the
licence gate.

    python3 tools/test_merge.py

These run entirely offline against the real seed, because the matcher's whole
job is to behave correctly on THIS dataset's coordinates and naming conventions.
A synthetic record set would prove the arithmetic and nothing about whether
"Бизнес центр Renaissance" matches "Renaissance".
"""
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import merge_incoming as M  # noqa: E402
import sources as SRC       # noqa: E402

ROOT = Path(__file__).resolve().parent.parent
SEED = json.loads((ROOT / 'data' / 'seed.json').read_text(encoding='utf-8'))
RECORDS = [r for r in SEED['records'] if r.get('recordType') == 'VERIFIED_SOURCE']

passed, failed = 0, []


def ok(name, cond, detail=''):
    global passed
    if cond:
        passed += 1
        print('  \033[32m✓\033[0m %s' % name)
    else:
        failed.append(name)
        print('  \033[31m✕\033[0m %s  %s' % (name, detail))


def rec(name_part):
    hits = [r for r in RECORDS if name_part.lower() in (r.get('name') or '').lower()]
    if not hits:
        raise SystemExit('test fixture drift: no record matching %r' % name_part)
    return hits[0]


def obs(name, lat, lng, **fields):
    f = dict(name=name, lat=lat, lng=lng)
    f.update(fields)
    return dict(externalId='test/1', externalUrl=None, fields=f, rawTags={})


def envelope(source_id, observations):
    s = SRC.by_id(source_id)
    return dict(sourceId=source_id, sourceName=s['name'], licence=s['licence'],
                storage=s['storage'], ok=True, count=len(observations),
                observations=observations)


print('\n\033[1mgeometry and naming\033[0m')
t = rec('Trilliant')
ok('haversine: a point on itself is 0 m',
   round(M.haversine_m(t['lat'], t['lng'], t['lat'], t['lng']), 6) == 0)
d = M.haversine_m(41.31, 69.28, 41.32, 69.28)
ok('haversine: 0.01° of latitude is ~1112 m', 1105 < d < 1120, '%.1f' % d)

ok('names: exact match scores 1.0', M.name_similarity('Trilliant', 'Trilliant') == 1.0)
ok('names: "Trilliant" ~ "Trilliant Business Center"',
   M.name_similarity('Trilliant', 'Trilliant Business Center') >= M.NAME_STRONG,
   '%.3f' % M.name_similarity('Trilliant', 'Trilliant Business Center'))
# The stop-list is what makes this one fail, and it must: two unrelated towers
# share the words "бизнес центр" and nothing else.
ok('names: two different centres do NOT match on their shared words',
   M.name_similarity('Бизнес центр Alpha', 'Бизнес центр Beta') < M.NAME_STRONG,
   '%.3f' % M.name_similarity('Бизнес центр Alpha', 'Бизнес центр Beta'))
ok('names: cyrillic and latin forms of one name are not forced together',
   M.name_similarity('Renaissance', 'Ренессанс') < M.NAME_STRONG)

ok('addresses: same street, one carrying the city, is not a conflict',
   M.same_address('Шахрисабзская улица, 2, Tashkent', 'Шахрисабзская улица, 2'))
ok('addresses: different house numbers ARE a conflict',
   not M.same_address('Afrosiab, 41', 'Afrosiab, 14'))
ok('addresses: an empty side is never "the same"', not M.same_address('', 'Afrosiab, 41'))

print('\n\033[1mmatching\033[0m')
m = M.match_one(obs(t['name'], t['lat'] + 0.00002, t['lng'] + 0.00002), RECORDS)
ok('a point 3 m away with the same name auto-matches',
   m['kind'] == 'matched' and m['recordId'] == t['id'], str(m))

m = M.match_one(obs('Something Entirely Different', t['lat'], t['lng']), RECORDS)
ok('the same point with an unrelated name needs review, never auto-match',
   m['kind'] == 'review', str(m))

m = M.match_one(obs(t['name'], 41.9, 69.9), RECORDS)
ok('a point 60 km away is new, not a stretched match', m['kind'] == 'new', str(m))

m = M.match_one(dict(fields=dict(name='No coords')), RECORDS)
ok('an observation without coordinates is unmatchable, not new',
   m['kind'] == 'unmatchable', str(m))

print('\n\033[1mper-field outcomes\033[0m')
fills, corr, conf, refused = M.diff_fields(
    dict(name=t['name'], floors=12, address=t['address']), t)
ok('an unknown field becomes a FILL',
   any(f['field'] == 'floors' and f['value'] == 12 for f in fills), str(fills))
ok('an identical value becomes a CORROBORATION, never a rewrite',
   any(c['field'] == 'address' for c in corr), str(corr))

fills2, _, conf2, _ = M.diff_fields(dict(address='Somewhere Else, 99'), t)
ok('a different known value becomes a CONFLICT, not an overwrite',
   any(c['field'] == 'address' for c in conf2) and not fills2, str(conf2))

_, _, _, refused3 = M.diff_fields(dict(askingRent=40.0, gla=12000), t)
ok('rent and GLA are REFUSED outright, whatever the source',
   {r['field'] for r in refused3} == {'askingRent', 'gla'}, str(refused3))

fills4, corr4, conf4, _ = M.diff_fields(dict(floors=None, address=''), t)
ok('an incoming BLANK never clears a recorded value',
   not fills4 and not conf4, 'fills=%s conflicts=%s' % (fills4, conf4))

# A measured zero is a value, not an absence – the rule the whole product turns on.
probe = dict(t)
probe['floors'] = 0
f5, c5, x5, _ = M.diff_fields(dict(floors=7), probe)
ok('a recorded ZERO is treated as known, so 7 is a conflict and not a fill',
   not f5 and any(c['field'] == 'floors' for c in x5), 'fills=%s conflicts=%s' % (f5, x5))

print('\n\033[1mthe licence gate\033[0m')
o = [obs(t['name'], t['lat'], t['lng'], floors=14)]

p_open = M.build_proposal(envelope('SRC-OSM-OVERPASS', o), SEED)
ok('an ODbL source may propose fills',
   p_open['mayPopulateDataset'] and p_open['summary']['proposedFills'] >= 1,
   str(p_open['summary']))

p_display = M.build_proposal(envelope('SRC-GOOGLE-PLACES', o), SEED)
ok('a display-only source proposes NO fills',
   not p_display['mayPopulateDataset'] and p_display['summary']['proposedFills'] == 0,
   str(p_display['summary']))
ok('…and what it would have filled is recorded, not silently dropped',
   p_display['summary']['fillsWithheldByLicence'] >= 1, str(p_display['summary']))
ok('…but it still reports conflicts, which is its actual value',
   'conflicts' in p_display['items'][0])

p_contract = M.build_proposal(envelope('SRC-2GIS-CATALOG', o), SEED)
ok('a contract source is withheld until the contract is recorded',
   not p_contract['mayPopulateDataset'], str(p_contract['summary']))

print('\n\033[1mapply\033[0m')
before = json.loads(json.dumps(SEED))
try:
    M.apply_proposal(p_display, before, 'Tester')
    ok('--apply refuses a display-only source', False, 'it did not refuse')
except SystemExit as e:
    ok('--apply refuses a display-only source', 'may not be written' in str(e))

try:
    M.apply_proposal(p_open, before, None)
    ok('--apply refuses without a named reviewer', False, 'it did not refuse')
except SystemExit as e:
    ok('--apply refuses without a named reviewer', 'reviewer' in str(e).lower())

n = M.apply_proposal(p_open, before, 'Tester')
applied = next(r for r in before['records'] if r['id'] == t['id'])
ok('an applied fill lands on the record', n >= 1 and applied.get('floors') == 14,
   'n=%s floors=%s' % (n, applied.get('floors')))
ok('…and carries an evidence profile naming its source and reviewer',
   applied['_evidence'].get('floors', '').startswith('IMPORT-'),
   str(applied['_evidence'].get('floors')))
prof = before['evidenceProfiles'].get('IMPORT-OSM-OVERPASS', {})
ok('…and that profile records the reviewer and stays unverified',
   prof.get('reviewer') == 'Tester' and prof.get('qcStatus') == 'needs_check', str(prof))
ok('applying did not touch the real seed on disk',
   next(r for r in SEED['records'] if r['id'] == t['id']).get('floors') is None)

print('\n%s' % ('─' * 62))
print('  %d passed, %d failed' % (passed, len(failed)))
if failed:
    for f in failed:
        print('    ✕ %s' % f)
    sys.exit(1)
