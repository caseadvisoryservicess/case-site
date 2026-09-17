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
# One building in the 148 is called "THE TOWER" – every token is a stop-word, so
# before the fallback it scored 0.0 against its own name and went to review.
ok('names: a name made entirely of stop-words still matches itself',
   M.name_similarity('THE TOWER', 'THE TOWER') == 1.0,
   '%.3f' % M.name_similarity('THE TOWER', 'THE TOWER'))
ok('…and the fallback does not make it match an unrelated all-stop-word name',
   M.name_similarity('THE TOWER', 'Business Center') < M.NAME_STRONG,
   '%.3f' % M.name_similarity('THE TOWER', 'Business Center'))
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

print('\n\033[1mevidence-class sources (listings, owner rates)\033[0m')
lst = dict(externalId='x', externalUrl=None, fields=dict(name=t['name'], askingRent=41.0, availableArea=500, gla=9000),
           evidence=dict(method='listing platform', confidence='Low', note='OLX'), rawTags={})
p_ev = M.build_proposal(envelope('SRC-CASE-OS-PRICES', [lst]), SEED)
it = p_ev['items'][0]
ok('a name-only source matches by name', it['match']['kind'] == 'matched', str(it['match']))
ok('an evidence-class source may propose availableArea',
   any(f['field'] == 'availableArea' for f in it['fills']), str(it['fills']))
ok('…and a known rent that differs is a CONFLICT, still never overwritten',
   any(c['field'] == 'askingRent' for c in it['conflicts']), str(it['conflicts']))
ok('…but GLA is refused even from an evidence-class source',
   any(r['field'] == 'gla' for r in it['refusedFields']), str(it['refusedFields']))
osm_rent = dict(externalId='y', externalUrl=None, fields=dict(name=t['name'], lat=t['lat'], lng=t['lng'], askingRent=41.0), rawTags={})
p_osm = M.build_proposal(envelope('SRC-OSM-OVERPASS', [osm_rent]), SEED)
ok('a map source still cannot propose a rent',
   any(r['field'] == 'askingRent' for r in p_osm['items'][0]['refusedFields']), str(p_osm['items'][0]['refusedFields']))
near = dict(externalId='z', externalUrl=None, fields=dict(name='Business Park', askingRent=19.9), evidence={}, rawTags={})
m_near = M.match_by_name(near, RECORDS)
ok('"Business Park" vs "Park view" is a REVIEW item, not a match (0.95)',
   m_near['kind'] == 'review', str(m_near))

import collect as C  # noqa: E402
geo2 = C.parse_bc_records(json.loads((ROOT / 'data/external/case-os-geo-analytics-2/bc_additions.json').read_text(encoding='utf-8')))
ok('the Geo Analytics 2 adapter yields the two CASE-owned buildings', len(geo2) == 2, str(len(geo2)))
p_geo2 = M.build_proposal(envelope('SRC-CASE-OS-GEO2-BC', geo2), SEED)
ok('…and both are NEW against the 148, not stretched matches',
   all(i['match']['kind'] == 'new' for i in p_geo2['items']), str([i['match'] for i in p_geo2['items']]))
addr_payload = json.loads((ROOT / 'data/external/case-os-geo-analytics-2/address_fills.json').read_text(encoding='utf-8'))
addrs = C.parse_bc_addresses(addr_payload)
ok('the address adapter yields the twenty addresses the dataset lacks', len(addrs) == 20, str(len(addrs)))
p_addr = M.build_proposal(envelope('SRC-CASE-OS-GEO2-ADDR', addrs), SEED)
ok('…every one matches an existing building by coordinates, none is NEW',
   all(i['match']['kind'] == 'matched' for i in p_addr['items']),
   str([i['match']['kind'] for i in p_addr['items'] if i['match']['kind'] != 'matched']))
ok('…and the directory licence withholds all twenty rather than filling them',
   not p_addr['mayPopulateDataset'] and p_addr['summary']['proposedFills'] == 0
   and p_addr['summary']['fillsWithheldByLicence'] == 20, str(p_addr['summary']))
ok('…with no address conflicting with one already recorded',
   sum(len(i['conflicts']) for i in p_addr['items']) == 0,
   str([i['conflicts'] for i in p_addr['items'] if i['conflicts']]))
lst_note = C.parse_case_os_prices({'prices': {'X': {'rent': 20, 'avail': 175, 'psrc': 'OLX 07.2026'}}})[0]['evidence']['note']
ok('a listing rent\'s note carries the per-m²/per-object disambiguation caveat',
   'disambiguated' in lst_note and '175' in lst_note, lst_note)

print('\n\033[1mgeocoder check (show-only)\033[0m')
import geocode_check as G  # noqa: E402

def yx(lat, lng, precision='exact', kind='house', text='Ташкент, улица Тестовая, 1'):
    return {'response': {'GeoObjectCollection': {
        'metaDataProperty': {'GeocoderResponseMetaData': {'found': '1'}},
        'featureMember': [{'GeoObject': {'Point': {'pos': '%s %s' % (lng, lat)},
                                         'metaDataProperty': {'GeocoderMetaData': {
                                             'precision': precision, 'kind': kind, 'text': text}}}}]}}}

mode, q = G.query_for(t)
ok('a record with a street address is geocoded FORWARD with that address', mode == 'forward' and q == t['address'], str((mode, q)))
mode, q = G.query_for(dict(t, address='Tashkent'))
ok('an address that is only the city name is SKIPPED without a request', mode == 'skip', str((mode, q)))
mode, q = G.query_for(dict(t, address=None))
ok('a record without an address is REVERSE-geocoded, longitude first',
   mode == 'reverse' and q == '%s,%s' % (t['lng'], t['lat']), str((mode, q)))

parsed = G.parse_response(yx(t['lat'], t['lng']))
ok('Point.pos "lon lat" is parsed into lat/lng the right way round',
   abs(parsed['hit']['lat'] - t['lat']) < 1e-9 and abs(parsed['hit']['lng'] - t['lng']) < 1e-9, str(parsed['hit']))
ok('a house on the pin is AGREE', G.verdict_for('forward', t, parsed)[0] == 'agree')
ok('a house 1 km away is DISAGREE, and the distance is reported',
   G.verdict_for('forward', t, G.parse_response(yx(t['lat'] + 0.009, t['lng'])))[0] == 'disagree'
   and 900 < G.verdict_for('forward', t, G.parse_response(yx(t['lat'] + 0.009, t['lng'])))[1] < 1100)
ok('a street-level match is VAGUE whatever the distance, never a disagreement',
   G.verdict_for('forward', t, G.parse_response(yx(t['lat'], t['lng'], precision='street', kind='street')))[0] == 'vague')
ok('an empty result is NOT_FOUND',
   G.verdict_for('forward', t, G.parse_response({'response': {'GeoObjectCollection': {'featureMember': []}}}))[0] == 'not_found')
ok('a reverse lookup yields a SUGGESTION, which is not a fill',
   G.verdict_for('reverse', t, parsed)[0] == 'suggested')
ok('the geocoder is registered as display-only and routed to its tool, not the collector',
   SRC.by_id('SRC-YANDEX-GEOCODER')['storage'] == 'display' and not SRC.may_populate('SRC-YANDEX-GEOCODER')
   and SRC.by_id('SRC-YANDEX-GEOCODER').get('tool'))

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
before2 = json.loads(json.dumps(SEED))
p_ev2 = M.build_proposal(envelope('SRC-CASE-OS-PRICES', [lst]), before2)
M.apply_proposal(p_ev2, before2, 'Tester')
prof2 = before2['evidenceProfiles'].get('IMPORT-CASE-OS-PRICES-LISTING-PLATFORM', {})
ok('an applied listing fill gets its OWN profile at Low confidence',
   prof2.get('confidence') == 'Low' and prof2.get('method') == 'listing platform', str(prof2))
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
