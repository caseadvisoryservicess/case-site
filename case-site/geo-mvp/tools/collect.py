#!/usr/bin/env python3
"""
Collect observations from a registered source into data/incoming/.

    python3 tools/collect.py --list
    python3 tools/collect.py --source SRC-OSM-OVERPASS
    python3 tools/collect.py --source SRC-GOOGLE-PLACES --key "$GOOGLE_MAPS_API_KEY"
    YANDEX_MAPS_API_KEY=... python3 tools/collect.py --source SRC-YANDEX-SEARCH
    python3 tools/collect.py --source SRC-OSM-OVERPASS --from fixture.json

A key is read from --key, or from the environment variable the registry names
for that source (`auth` in tools/sources.py). It is used for the request and
nothing else: it is not written into the observations file, and it is redacted
from any error text recorded there.

WHAT THIS WRITES, AND WHAT IT DOES NOT
--------------------------------------
It writes ONE file: data/incoming/<source-id>.observations.json. It never edits
data/seed.json. Nothing a collector produces reaches the dataset without going
through merge_incoming.py, which emits a proposal a human applies.

That is not ceremony. The dataset's whole claim is that every value has a
traceable source and that nothing was invented; an importer that writes straight
into it is one bad adapter away from breaking that claim silently.

THE THREE REFUSALS
------------------
A collector stops before making a request when:

  · the source needs a key and none was given. It does NOT fall back to an
    unauthenticated endpoint, which for Google returns a plausible-looking empty
    result that could be mistaken for "nothing found there".
  · the source's licence is 'unverified' – robots.txt and terms unread. Passing
    --i-have-checked-terms records WHO checked and WHEN in the output file; it
    does not make the refusal go away quietly.
  · the host cannot be reached. The run writes a failure record rather than an
    empty observations file, because an empty file and a failed fetch look
    identical the next morning and mean opposite things.

--from replays a saved API response instead of calling out. It is how the
parsers are tested offline, and how a colleague with network access can hand
over a capture for someone without it to process.
"""
import argparse
import json
import os
import sys
import urllib.parse
import urllib.request
import urllib.error
from datetime import date, datetime, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import sources as SRC  # noqa: E402

ROOT = Path(__file__).resolve().parent.parent
OUT_DIR = ROOT / 'data' / 'incoming'

# The city envelope every query is bounded by. Same numbers the map opens on.
TASHKENT_BBOX = dict(south=41.16, west=69.12, north=41.40, east=69.42)

UA = 'CASE-Geo-MVP/0.1 (commercial real estate research; contact: caseadvisory.com)'


# ─────────────────────────────────────────────────────────── adapters ──────

def overpass_query():
    """Buildings that are plausibly office stock inside the city envelope.

    `building=office` alone misses a lot: in Tashkent many towers are tagged
    `building=commercial` or carry `office=*` on the building way. All three are
    asked for, and the merge step decides what is actually a business centre –
    a collector that pre-filters throws away the evidence for that decision.
    """
    b = '{south},{west},{north},{east}'.format(**TASHKENT_BBOX)
    return (
        '[out:json][timeout:90];('
        'way["building"="office"](%s);'
        'way["building"="commercial"]["office"](%s);'
        'way["office"]["name"](%s);'
        'relation["building"="office"](%s);'
        ');out center tags;' % (b, b, b, b)
    )


def parse_overpass(payload):
    """Overpass elements -> observations. Only tags that actually exist."""
    out = []
    for el in payload.get('elements', []):
        tags = el.get('tags') or {}
        name = tags.get('name') or tags.get('name:en') or tags.get('name:ru')
        if not name:
            # An unnamed building cannot be matched to a named record, and
            # inventing a name from the address is exactly what §2.2 forbids.
            continue
        centre = el.get('center') or {}
        lat = el.get('lat', centre.get('lat'))
        lng = el.get('lon', centre.get('lon'))
        if lat is None or lng is None:
            continue

        street = tags.get('addr:street')
        house = tags.get('addr:housenumber')
        address = ', '.join(x for x in (street, house) if x) or None

        fields = {'name': name, 'lat': float(lat), 'lng': float(lng)}
        if address:
            fields['address'] = address
        if tags.get('building:levels', '').isdigit():
            fields['floors'] = int(tags['building:levels'])
        if tags.get('operator'):
            fields['operator'] = tags['operator']
        if tags.get('start_date', '')[:4].isdigit():
            fields['yearOpened'] = int(tags['start_date'][:4])

        out.append(dict(
            externalId='%s/%s' % (el.get('type'), el.get('id')),
            externalUrl='https://www.openstreetmap.org/%s/%s' % (el.get('type'), el.get('id')),
            fields=fields,
            rawTags=tags,
        ))
    return out


def fetch_overpass(_key):
    data = urllib.parse.urlencode({'data': overpass_query()}).encode()
    req = urllib.request.Request(SRC.by_id('SRC-OSM-OVERPASS')['endpoint'],
                                 data=data, headers={'User-Agent': UA})
    with urllib.request.urlopen(req, timeout=120) as r:
        return json.loads(r.read().decode('utf-8'))


def parse_google_places(payload):
    out = []
    for p in payload.get('places', []):
        loc = p.get('location') or {}
        name = (p.get('displayName') or {}).get('text')
        if not name or loc.get('latitude') is None:
            continue
        out.append(dict(
            externalId=p.get('id'),
            externalUrl=p.get('googleMapsUri'),
            fields={'name': name,
                    'lat': float(loc['latitude']), 'lng': float(loc['longitude']),
                    'address': p.get('formattedAddress')},
            rawTags={'types': p.get('types', [])},
        ))
    return out


def fetch_google_places(key):
    body = json.dumps({
        'textQuery': 'business centre office building Tashkent',
        'locationBias': {'rectangle': {
            'low': {'latitude': TASHKENT_BBOX['south'], 'longitude': TASHKENT_BBOX['west']},
            'high': {'latitude': TASHKENT_BBOX['north'], 'longitude': TASHKENT_BBOX['east']}}},
    }).encode()
    req = urllib.request.Request(
        SRC.by_id('SRC-GOOGLE-PLACES')['endpoint'], data=body,
        headers={'User-Agent': UA, 'Content-Type': 'application/json',
                 'X-Goog-Api-Key': key,
                 'X-Goog-FieldMask': 'places.id,places.displayName,places.location,'
                                     'places.formattedAddress,places.googleMapsUri,places.types'})
    with urllib.request.urlopen(req, timeout=60) as r:
        return json.loads(r.read().decode('utf-8'))


def parse_yandex(payload):
    out = []
    for f in payload.get('features', []):
        props = f.get('properties') or {}
        meta = props.get('CompanyMetaData') or {}
        coords = (f.get('geometry') or {}).get('coordinates') or []
        if not meta.get('name') or len(coords) != 2:
            continue
        out.append(dict(
            externalId=meta.get('id'),
            externalUrl=meta.get('url'),
            # Yandex returns [lon, lat]; reversing these silently would move every
            # Tashkent record into the Indian Ocean, so it is asserted, not assumed.
            fields={'name': meta['name'], 'lat': float(coords[1]), 'lng': float(coords[0]),
                    'address': meta.get('address')},
            rawTags={'categories': [c.get('name') for c in meta.get('Categories', [])]},
        ))
    return out


def fetch_yandex(key):
    q = urllib.parse.urlencode({
        'apikey': key, 'text': 'бизнес центр Ташкент', 'lang': 'ru_RU',
        'type': 'biz', 'results': 500,
        'bbox': '%s,%s~%s,%s' % (TASHKENT_BBOX['west'], TASHKENT_BBOX['south'],
                                 TASHKENT_BBOX['east'], TASHKENT_BBOX['north']),
    })
    req = urllib.request.Request(SRC.by_id('SRC-YANDEX-SEARCH')['endpoint'] + '?' + q,
                                 headers={'User-Agent': UA})
    with urllib.request.urlopen(req, timeout=60) as r:
        return json.loads(r.read().decode('utf-8'))


def parse_2gis(payload):
    out = []
    for item in ((payload.get('result') or {}).get('items') or []):
        point = item.get('point') or {}
        if not item.get('name') or point.get('lat') is None:
            continue
        out.append(dict(
            externalId=item.get('id'),
            externalUrl=None,
            fields={'name': item['name'],
                    'lat': float(point['lat']), 'lng': float(point['lon']),
                    'address': item.get('address_name')},
            rawTags={'rubrics': [r.get('name') for r in item.get('rubrics', [])]},
        ))
    return out


def fetch_2gis(key):
    q = urllib.parse.urlencode({
        'key': key, 'q': 'бизнес центр', 'region_id': 208, 'page_size': 50,
        'fields': 'items.point,items.address,items.rubrics',
    })
    req = urllib.request.Request(SRC.by_id('SRC-2GIS-CATALOG')['endpoint'] + '?' + q,
                                 headers={'User-Agent': UA})
    with urllib.request.urlopen(req, timeout=60) as r:
        return json.loads(r.read().decode('utf-8'))


def parse_case_os_prices(payload):
    """bundle.prices -> observations. One per named building; no coordinates.

    The evidence class travels WITH each observation, because it differs per row:
    an owner rate from a management company is not the same evidence as one OLX
    listing for a 175 m² unit, and the proposal must say which it is."""
    out = []
    for name, p in (payload.get('prices') or {}).items():
        src = str(p.get('psrc') or '')
        if 'собственник' in src or 'soffice' in src:
            method, conf = 'owner rate (management company)', 'Medium'
        elif 'Instagram' in src or 'реклам' in src:
            method, conf = 'advert', 'Low'
        else:
            method, conf = 'listing platform', 'Low'
        fields = {'name': name}
        if p.get('rent') is not None:
            fields['askingRent'] = float(p['rent'])
        if p.get('avail') is not None:
            fields['availableArea'] = float(p['avail'])
        if p.get('cls'):
            fields['officeClass'] = p['cls']
        note = src
        if method == 'listing platform':
            # The page that published these states the method: listings filtered on
            # "office"; a board price quoted per object rather than per m² was
            # disambiguated by plausibility of the rate ($2–60/m²). A reader of the
            # evidence must know a heuristic sat between the listing and this figure.
            note += ' – per-m² vs per-object disambiguated by rate plausibility ($2–60/m²)'
        if p.get('avail') is not None and method == 'listing platform':
            note += '; listed unit of %s m², not a building rate' % p['avail']
        out.append(dict(
            externalId='case-os-bundle/' + name,
            externalUrl=None,
            fields=fields,
            evidence={'method': method, 'confidence': conf, 'note': note,
                      'collectedAt': '2026-07'},
            rawTags={'psrc': src, 'sale': p.get('sale'), 'addr': p.get('addr')},
        ))
    return out


def fetch_case_os_prices(_key):
    raise RuntimeError('SRC-CASE-OS-PRICES is a local file: pass --from data/external/case-os-4.73.1/bundle_prices.json')


def parse_bc_records(payload):
    """A plain list of building records with coordinates. `status` in this file is
    the page's QC state ("Reviewed"), not a building status, and is not carried."""
    out = []
    for r in payload.get('records') or []:
        if not r.get('name') or r.get('lat') is None or r.get('lng') is None:
            continue
        fields = {'name': r['name'], 'lat': float(r['lat']), 'lng': float(r['lng'])}
        if r.get('address'):
            fields['address'] = r['address']
        out.append(dict(
            externalId='case-os-geo2/' + r['name'],
            externalUrl=None,
            fields=fields,
            evidence={'method': 'internal record', 'confidence': 'Medium',
                      'note': 'provider: %s; district as stated: %s' % (r.get('provider'), r.get('district')),
                      'collectedAt': '2026-09'},
            rawTags={'provider': r.get('provider'), 'districtLabel': r.get('district')},
        ))
    return out


def parse_bc_addresses(payload):
    """Street addresses for buildings the dataset already holds. Same shape as
    parse_bc_records, different evidence: the address text is directory content
    (GoldenPages) that CASE geocoded, so it enters at Low confidence with the
    directory named. Matching is by coordinates – these rows ARE the dataset's
    own buildings, at the same coordinates, with one more field."""
    out = []
    for r in payload.get('records') or []:
        if not r.get('address') or r.get('lat') is None or r.get('lng') is None:
            continue
        out.append(dict(
            externalId='case-os-geo2-addr/' + (r.get('name') or ''),
            externalUrl=None,
            fields={'name': r.get('name'), 'lat': float(r['lat']), 'lng': float(r['lng']),
                    'address': r['address']},
            evidence={'method': 'directory listing via CASE collection', 'confidence': 'Low',
                      'note': 'directory: %s; geocoded by CASE through 2GIS by address. '
                              'Licence for the directory text is unresolved.' % (r.get('provider') or 'unknown'),
                      'collectedAt': '2026-09'},
            rawTags={'provider': r.get('provider'), 'districtLabel': r.get('district')},
        ))
    return out


def fetch_bc_addresses(_key):
    raise RuntimeError('SRC-CASE-OS-GEO2-ADDR is a local file: pass --from data/external/case-os-geo-analytics-2/address_fills.json')


def fetch_bc_records(_key):
    raise RuntimeError('SRC-CASE-OS-GEO2-BC is a local file: pass --from data/external/case-os-geo-analytics-2/bc_additions.json')


ADAPTERS = {
    'SRC-CASE-OS-GEO2-BC': dict(fetch=fetch_bc_records, parse=parse_bc_records),
    'SRC-CASE-OS-GEO2-ADDR': dict(fetch=fetch_bc_addresses, parse=parse_bc_addresses),

    'SRC-CASE-OS-PRICES': dict(fetch=fetch_case_os_prices, parse=parse_case_os_prices),

    'SRC-OSM-OVERPASS':  dict(fetch=fetch_overpass, parse=parse_overpass),
    'SRC-GOOGLE-PLACES': dict(fetch=fetch_google_places, parse=parse_google_places),
    'SRC-YANDEX-SEARCH': dict(fetch=fetch_yandex, parse=parse_yandex),
    'SRC-2GIS-CATALOG':  dict(fetch=fetch_2gis, parse=parse_2gis),
}


# ──────────────────────────────────────────────────────────── driver ───────

def collect(source_id, key=None, replay=None, terms_checked_by=None):
    src = SRC.by_id(source_id)
    if not src:
        sys.exit('collect: unknown source %s (see tools/sources.py)' % source_id)

    if src.get('tool'):
        sys.exit('collect: %s is not a collector – run %s instead.' % (source_id, src['tool']))

    adapter = ADAPTERS.get(source_id)
    if not adapter:
        sys.exit('collect: %s has no adapter yet. Directory sites need an HTML\n'
                 '         parser written against their actual markup, and that\n'
                 '         cannot be written against a site nobody can open.' % source_id)

    if src['storage'] == 'unverified' and not terms_checked_by:
        sys.exit('collect: %s has storage=unverified – robots.txt and terms of use\n'
                 '         have not been read. Re-run with --i-have-checked-terms NAME\n'
                 '         once someone has, and their name is recorded in the output.'
                 % source_id)

    if src['auth'] and not key and not replay:
        key = os.environ.get(src['auth']) or None
    if src['auth'] and not key and not replay:
        sys.exit('collect: %s needs %s. Pass --key, set that variable, or --from a saved response.\n'
                 '         There is no unauthenticated fallback on purpose: the one\n'
                 '         Google offers returns an empty candidate list that reads\n'
                 '         exactly like "no business centres found".'
                 % (source_id, src['auth']))

    started = datetime.now(timezone.utc).isoformat(timespec='seconds')
    envelope = dict(
        sourceId=source_id, sourceName=src['name'], method=src['method'],
        licence=src['licence'], storage=src['storage'],
        attribution=src['attribution'],
        mayPopulateDataset=SRC.may_populate(source_id),
        retrievedAt=date.today().isoformat(), startedAt=started,
        termsCheckedBy=terms_checked_by,
        replayedFrom=str(replay) if replay else None,
        ok=False, error=None, observations=[],
    )

    try:
        if replay:
            payload = json.loads(Path(replay).read_text(encoding='utf-8'))
        else:
            payload = adapter['fetch'](key)
        envelope['observations'] = adapter['parse'](payload)
        envelope['ok'] = True
    except Exception as e:
        # A failure is RECORDED, not swallowed. An empty observations list and a
        # failed fetch are indistinguishable a week later and mean the opposite.
        msg = str(e)
        if key:
            msg = msg.replace(key, '<key>')   # a URL in an error message can carry the query string
        envelope['error'] = '%s: %s' % (type(e).__name__, msg[:200])

    envelope['count'] = len(envelope['observations'])
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    dest = OUT_DIR / ('%s.observations.json' % source_id.lower())
    dest.write_text(json.dumps(envelope, indent=2, ensure_ascii=False) + '\n', encoding='utf-8')

    print('%s: %s' % (source_id, 'ok' if envelope['ok'] else 'FAILED'))
    if envelope['error']:
        print('  %s' % envelope['error'])
    print('  observations: %d' % envelope['count'])
    print('  may populate the dataset: %s'
          % ('yes' if envelope['mayPopulateDataset']
             else 'NO – storage=%s' % src['storage']))
    print('  wrote %s' % dest.relative_to(ROOT))
    return envelope


def main():
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('--source')
    ap.add_argument('--key')
    ap.add_argument('--from', dest='replay')
    ap.add_argument('--i-have-checked-terms', dest='terms')
    ap.add_argument('--list', action='store_true')
    a = ap.parse_args()

    if a.list or not a.source:
        SRC.table()
        print('\nadapters written: %s' % ', '.join(sorted(ADAPTERS)))
        return
    collect(a.source, key=a.key, replay=a.replay, terms_checked_by=a.terms)


if __name__ == '__main__':
    main()
