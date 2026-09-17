#!/usr/bin/env python3
"""
The source registry – what may be collected, from where, and under what licence.

Every other tool in the ingestion path reads this file and nothing else decides.
It exists for one reason: on this dataset the licence question is not a footnote
to the collection question, it IS the collection question.

    python3 tools/sources.py             # the table, with what each one needs
    python3 tools/sources.py --check     # probe reachability, write a report

THE FIELD THAT MATTERS IS `storage`
-----------------------------------
Reachability decides whether a fetch works. `storage` decides whether the result
may be kept, which is a different question and the one that bites later.

  'open'      the licence permits storing and redistributing the values, with
              attribution. Only ODbL/CC sources qualify. These can populate the
              dataset outright.
  'display'   the terms permit querying and SHOWING results, but not building a
              persistent copy. Google Maps Platform is the important case: its
              terms prohibit pre-fetching, caching or storing Places content
              other than place_id (with limited, short-lived performance
              caching). A pipeline that ingests Places data into seed.json is a
              licence breach even though every request was authorised.
  'contract'  storage depends on the terms of a commercial agreement this firm
              may or may not hold. The collector refuses until someone records
              the contract reference, because "we probably have a licence" is
              not a licence.
  'unverified' robots.txt and the terms of use have not been read. The collector
              refuses. This is the default for any directory site, and it is
              deliberately noisy rather than permissive.

A source marked 'display' or 'unverified' can still be collected into a
SEPARATE observations file for a human to look at. What it may not do is flow
into the dataset, and `merge_incoming.py` enforces that rather than trusting the
operator to remember.
"""
import json
import sys
import urllib.request
import urllib.error
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent

# `probe` is a cheap GET that proves the host answers. It is never the real
# query: several of these cost money or quota per call.
SOURCES = [
    dict(
        id='SRC-OSM-OVERPASS',
        name='OpenStreetMap (Overpass API)',
        method='open data extract',
        endpoint='https://overpass-api.de/api/interpreter',
        probe='https://overpass-api.de/api/status',
        auth=None,
        storage='open',
        licence='ODbL 1.0',
        attribution='© OpenStreetMap contributors',
        fields=['name', 'lat', 'lng', 'address', 'floors', 'operator', 'yearOpened'],
        note='The only source here that can populate the dataset outright. ODbL '
             'requires attribution and share-alike on derived data. Query by '
             'bbox for building=office / office=* in the Tashkent boundary.',
    ),
    dict(
        id='SRC-CASE-OS-PRICES',
        name='CASE OS bundle – listing and owner-rate evidence (July 2026)',
        method='listing evidence',
        endpoint=None,
        probe=None,
        auth=None,
        storage='open',
        licence='CASE internal collection; each record cites its listing platform or owner source',
        attribution='CASE Advisory research; OLX.uz, uybor.uz, soffice.uz as cited per record',
        fields=['askingRent', 'availableArea', 'officeClass'],
        # THE TWO FLAGS. `commercialEvidence` lifts the commercial-field refusal for
        # THIS source only: listing platforms and a management company's owner rate
        # are the broker/landlord/document class those figures are allowed to come
        # from. A map service or directory never gets this flag. `matchBy: 'name'`
        # because the bundle carries no coordinates – it is keyed by the canonical
        # names this dataset was built from, and 28 of 32 match exactly.
        commercialEvidence=True,
        matchBy='name',
        localOnly=True,
        note='Twelve rents and fifteen available-area values the dataset did not hold, '
             'from CASE\'s own July-2026 collection. Listing rents are unit-level asking '
             'prices, not building rates: Low confidence, unit size in the note.',
    ),
    dict(
        id='SRC-CASE-OS-GEO2-BC',
        name='CASE OS Geo Analytics 2 – CASE-owned business centres',
        method='internal record',
        endpoint=None, probe=None, auth=None,
        storage='open',
        licence='CASE internal record',
        attribution='CASE Advisory',
        fields=['name', 'lat', 'lng', 'address', 'districtKey'],
        localOnly=True,
        note='Two buildings CASE is itself involved in, absent from the 148. Coordinates and '
             'district only. They enter as NEW records through the proposal path, never by '
             'editing the seed.',
    ),
    dict(
        id='SRC-CASE-OS-GEO2-ADDR',
        name='CASE OS Geo Analytics 2 – street addresses for GoldenPages-sourced buildings',
        method='directory listing via CASE collection',
        endpoint=None, probe=None, auth=None,
        # NOT 'open', although it arrives inside a CASE file. The address text is
        # GoldenPages directory content that CASE geocoded; CASE's own register marks
        # every GoldenPages row "Проверить" and clears none. Filing it as internal
        # would launder that open question instead of answering it, so the proposal
        # is built and every fill is withheld until someone records the check.
        storage='unverified',
        licence=None,
        attribution='goldenpages.uz, collected and geocoded by CASE Advisory',
        fields=['address'],
        localOnly=True,
        note='Twenty addresses this dataset does not hold, for buildings it already has. '
             'The archive\'s bc.json carries the same rows with address blank, so this is a '
             'later collection state rather than a re-export. Clearing GoldenPages in the '
             'source register releases all twenty at once.',
    ),
    dict(
        id='SRC-GOOGLE-PLACES',
        name='Google Places API',
        method='map service',
        endpoint='https://places.googleapis.com/v1/places:searchText',
        probe='https://maps.googleapis.com/maps/api/place/findplacefromtext/json',
        auth='GOOGLE_MAPS_API_KEY',
        storage='display',
        licence='Google Maps Platform Terms of Service',
        attribution='Powered by Google',
        fields=['name', 'lat', 'lng', 'address'],
        note='Reachable without a key only to be refused. The binding limit is '
             'NOT the key: the Maps Platform terms prohibit storing Places '
             'content beyond place_id, so results may be shown next to a record '
             'for a human to act on, and may not be written into seed.json.',
    ),
    dict(
        id='SRC-YANDEX-SEARCH',
        name='Yandex Places / Geosearch API',
        method='map service',
        endpoint='https://search-maps.yandex.ru/v1/',
        probe='https://search-maps.yandex.ru/v1/',
        auth='YANDEX_MAPS_API_KEY',
        storage='display',
        licence='Yandex Maps API terms',
        attribution='© Яндекс',
        fields=['name', 'lat', 'lng', 'address'],
        note='Key required. Terms restrict storage and redistribution outside '
             'Yandex surfaces. Coordinates arrive in WGS84 here, unlike the '
             'tile basemap, which is EPSG:3395 – see 10b-basemaps.js.',
    ),
    dict(
        id='SRC-2GIS-CATALOG',
        name='2GIS Catalog API',
        method='map service',
        endpoint='https://catalog.api.2gis.com/3.0/items',
        probe='https://catalog.api.2gis.com',
        auth='TWOGIS_API_KEY',
        storage='contract',
        licence='2GIS licence agreement',
        attribution='© 2GIS',
        fields=['name', 'lat', 'lng', 'address', 'floors', 'tenants'],
        note='The existing 148 records were desk-collected from 2GIS listings '
             '(SRC-2GIS-BC, licenceReview: required). Going back to the same '
             'source through its API is the cheapest enrichment available AND '
             'the one that finally settles that open licence question.',
    ),
    dict(
        id='SRC-GOLDENPAGES-UZ',
        name='Golden Pages Uzbekistan',
        method='directory',
        endpoint='https://goldenpages.uz',
        probe='https://goldenpages.uz',
        auth=None,
        storage='unverified',
        licence=None,
        attribution='goldenpages.uz',
        fields=['name', 'address', 'owner', 'operator'],
        note='Business directory. robots.txt and terms of use have NOT been '
             'read – they are unreachable from this environment. Until someone '
             'records that check the collector refuses, because a directory '
             'being publicly readable is not the same as it being reusable.',
    ),
    dict(
        id='SRC-YELLOWPAGES-UZ',
        name='Yellow Pages Uzbekistan',
        method='directory',
        endpoint='https://www.yellowpages.uz',
        probe='https://www.yellowpages.uz',
        auth=None,
        storage='unverified',
        licence=None,
        attribution='yellowpages.uz',
        fields=['name', 'address', 'owner', 'operator'],
        note='As above. Directory listings are also the weakest evidence class '
             'here: they describe COMPANIES, and this dataset is about '
             'BUILDINGS. Eight records are already flagged as probably a '
             'company rather than a building; this source would add more of '
             'exactly that failure mode unless matched carefully.',
    ),
    dict(
        id='SRC-ORGINFO-UZ',
        name='Orginfo.uz company registry',
        method='public registry',
        endpoint='https://orginfo.uz',
        probe='https://orginfo.uz',
        auth=None,
        storage='unverified',
        licence=None,
        attribution='orginfo.uz',
        fields=['owner', 'operator', 'developer'],
        note='Company registry rather than a map. Its value is the one thing no '
             'map service carries: who OWNS the building. Ownership is 0/148 '
             'today. Matching is by company name, which is the hardest match '
             'here and the one most likely to be wrong.',
    ),
    dict(
        id='SRC-EGOV-UZ',
        name='data.egov.uz open data portal',
        method='public registry',
        endpoint='https://data.egov.uz',
        probe='https://data.egov.uz',
        auth='EGOV_API_KEY',
        storage='unverified',
        licence=None,
        attribution='data.egov.uz',
        fields=['address', 'yearOpened', 'status'],
        note='Government open data. Licence terms per dataset, so "open portal" '
             'does not by itself mean storable – each dataset needs its own '
             'check recorded here.',
    ),
]

STORAGE_MAY_POPULATE = {'open'}


def by_id(sid):
    for s in SOURCES:
        if s['id'] == sid:
            return s
    return None


def may_populate(sid):
    """True only when the licence permits writing values into the dataset."""
    s = by_id(sid)
    return bool(s) and s['storage'] in STORAGE_MAY_POPULATE


def probe(source, timeout=12):
    """Cheap reachability check. Never the real query."""
    if source.get('localOnly'):
        return {'ok': True, 'status': None, 'detail': 'local file – nothing to reach'}
    req = urllib.request.Request(
        source['probe'],
        headers={'User-Agent': 'CASE-Geo-MVP/0.1 (source reachability probe)'},
    )
    try:
        with urllib.request.urlopen(req, timeout=timeout) as r:
            return {'ok': True, 'status': r.status, 'detail': 'answered'}
    except urllib.error.HTTPError as e:
        # An HTTP error still proves the host is REACHABLE, which is the thing
        # being measured. 403 "you need a key" is a very different fact from
        # "the network refused to carry the request at all".
        return {'ok': True, 'status': e.code, 'detail': 'answered %s' % e.code}
    except Exception as e:
        return {'ok': False, 'status': None, 'detail': type(e).__name__ + ': ' + str(e)[:80]}


def table():
    w = max(len(s['name']) for s in SOURCES)
    print('%-22s %-*s %-11s %-22s %s' % ('id', w, 'name', 'storage', 'needs', 'may populate'))
    print('-' * (22 + w + 60))
    for s in SOURCES:
        needs = s['auth'] or ('robots + terms check' if s['storage'] == 'unverified' else '-')
        print('%-22s %-*s %-11s %-22s %s'
              % (s['id'], w, s['name'], s['storage'], needs,
                 'yes' if may_populate(s['id']) else 'NO'))
    print()
    print('Only sources whose licence is "open" may write into the dataset.')
    print('"display"    = query and show, never store   (Google, Yandex)')
    print('"contract"   = depends on an agreement this firm may hold   (2GIS)')
    print('"unverified" = robots.txt and terms not read yet   (directories)')


def check():
    out = {'checkedAt': None, 'results': []}
    print('Probing %d sources. A failure here is the network, not the licence.\n' % len(SOURCES))
    for s in SOURCES:
        r = probe(s)
        out['results'].append(dict(id=s['id'], name=s['name'], storage=s['storage'],
                                   reachable=r['ok'], status=r['status'], detail=r['detail']))
        print('  %-22s %-9s %s' % (s['id'], 'REACHABLE' if r['ok'] else 'blocked', r['detail']))
    dest = ROOT / 'data' / 'incoming' / 'source-reachability.json'
    dest.parent.mkdir(parents=True, exist_ok=True)
    dest.write_text(json.dumps(out, indent=2, ensure_ascii=False) + '\n', encoding='utf-8')
    print('\nwrote %s' % dest.relative_to(ROOT))
    reach = [r for r in out['results'] if r['reachable']]
    usable = [r for r in reach if r['storage'] in STORAGE_MAY_POPULATE]
    print('reachable: %d of %d | reachable AND storable: %d'
          % (len(reach), len(SOURCES), len(usable)))
    if not usable:
        print('\nNo source can populate the dataset from here. That is a fact about this\n'
              'environment, not about the sources: see the report above for which.')


if __name__ == '__main__':
    if '--check' in sys.argv:
        check()
    elif '--json' in sys.argv:
        print(json.dumps(SOURCES, indent=2, ensure_ascii=False))
    else:
        table()
