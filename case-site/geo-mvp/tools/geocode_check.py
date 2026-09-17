#!/usr/bin/env python3
"""
Check the dataset's addresses against the Yandex Geocoder. Show-only.

    YANDEX_GEOCODER_API_KEY=… python3 tools/geocode_check.py             # every record
    YANDEX_GEOCODER_API_KEY=… python3 tools/geocode_check.py --limit 5   # prove the key first
    python3 tools/geocode_check.py --dry-run                             # count requests, no network
    python3 tools/geocode_check.py --report                              # re-read the last run

WHAT IT ASKS, PER RECORD
------------------------
  · a record WITH a street address is geocoded forward, and the point Yandex
    returns is compared with the coordinates on file. Agreement is evidence the
    address and the pin describe the same building; disagreement is a queue
    item for a person, and nothing more.
  · a record WITHOUT an address is reverse-geocoded from its coordinates, and
    the house Yandex names is SUGGESTED. A suggestion is not a fill: the free
    Geocoder terms forbid storing results, and this project's rule for every
    display-class source is that a person reads, decides and types.
  · a record whose "address" is only the city name is skipped without a
    request. There is nothing to check.

WHAT IT WRITES
--------------
One file, data/incoming/yandex-geocoder-check.json, git-ignored, for a person
to read. It never opens seed.json for writing. The key is read from --key or
YANDEX_GEOCODER_API_KEY, used for the requests, and redacted from any error
text recorded in the file.

Free tier: 1,000 requests a day. A full pass over 148 records is at most 148.
"""
import argparse
import json
import os
import re
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import merge_incoming as M  # noqa: E402  – haversine_m, the same one the matcher uses
import sources as SRC       # noqa: E402

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / 'data' / 'incoming' / 'yandex-geocoder-check.json'
SOURCE_ID = 'SRC-YANDEX-GEOCODER'
UA = 'CASE-Geo-MVP/0.1 (address consistency check)'

# Tashkent window, lon,lat ~ lon,lat as the Geocoder wants it. rspn=1 makes it a
# hard limit rather than a hint, so "улица Пушкина" cannot resolve to Moscow.
BBOX = '69.12,41.16~69.42,41.40'

AGREE_M = 75     # a geocoded house within this is the same building
NEAR_M = 300     # within this, probably the same block – a person looks
PAUSE_S = 0.25   # polite spacing between requests

CITY_WORDS = ('tashkent', 'toshkent', 'ташкент', 'тошкент')


def query_for(record):
    """(mode, query) – 'forward' with the address, 'reverse' with "lng,lat", or
    ('skip', reason) when there is nothing worth a request."""
    addr = (record.get('address') or '').strip()
    if addr:
        bare = re.sub(r'[^0-9a-zа-яё]+', ' ', addr.lower())
        bare = ' '.join(w for w in bare.split() if w not in CITY_WORDS).strip()
        if not bare:
            return 'skip', 'address is only the city name'
        return 'forward', addr
    if record.get('lat') is None or record.get('lng') is None:
        return 'skip', 'no address and no coordinates'
    # Yandex takes longitude FIRST. Reversing this would ask about a point in
    # the Indian Ocean and get a polite "nothing found".
    return 'reverse', '%s,%s' % (record['lng'], record['lat'])


def parse_response(payload):
    """The first GeoObject, or None. Point.pos is "lon lat" – asserted here,
    because a silent swap would mark every address as 5,000 km off."""
    coll = ((payload.get('response') or {}).get('GeoObjectCollection') or {})
    found = int(((coll.get('metaDataProperty') or {}).get('GeocoderResponseMetaData') or {}).get('found') or 0)
    members = coll.get('featureMember') or []
    if not members:
        return dict(found=found, hit=None)
    go = members[0].get('GeoObject') or {}
    pos = ((go.get('Point') or {}).get('pos') or '').split()
    meta = ((go.get('metaDataProperty') or {}).get('GeocoderMetaData') or {})
    if len(pos) != 2:
        return dict(found=found, hit=None)
    lng, lat = float(pos[0]), float(pos[1])
    if not (-90 <= lat <= 90 and -180 <= lng <= 180):
        raise ValueError('Point.pos is not "lon lat": %r' % pos)
    return dict(found=found, hit=dict(lat=lat, lng=lng,
                                       precision=meta.get('precision'),
                                       kind=meta.get('kind'),
                                       text=meta.get('text')))


def verdict_for(mode, record, parsed):
    """One word a person can sort by, and the distance behind it."""
    hit = parsed.get('hit')
    if not hit:
        return 'not_found', None
    d = M.haversine_m(record['lat'], record['lng'], hit['lat'], hit['lng'])
    if mode == 'reverse':
        return 'suggested', d
    p = hit.get('precision')
    if p in ('exact', 'number'):
        if d <= AGREE_M:
            return 'agree', d
        if d <= NEAR_M:
            return 'near', d
        return 'disagree', d
    if p in ('near', 'range'):
        return 'approximate', d
    return 'vague', d          # street / other / locality – the address cannot place a building


def fetch(key, mode, query):
    params = {'apikey': key, 'geocode': query, 'format': 'json', 'lang': 'ru_RU',
              'results': 1, 'bbox': BBOX, 'rspn': 1}
    if mode == 'reverse':
        params['kind'] = 'house'
    url = SRC.by_id(SOURCE_ID)['endpoint'] + '?' + urllib.parse.urlencode(params)
    req = urllib.request.Request(url, headers={'User-Agent': UA})
    with urllib.request.urlopen(req, timeout=30) as r:
        return json.loads(r.read().decode('utf-8'))


def run(key, limit=None, dry_run=False):
    seed = json.loads((ROOT / 'data' / 'seed.json').read_text(encoding='utf-8'))
    records = [r for r in seed['records'] if r.get('recordType') == 'VERIFIED_SOURCE']
    plan = [(r, ) + query_for(r) for r in records]
    todo = [p for p in plan if p[1] != 'skip']
    if limit:
        todo = todo[:limit]

    modes = Counter(p[1] for p in plan)
    print('records %d | forward %d | reverse %d | skipped %d | requests this run: %d'
          % (len(records), modes['forward'], modes['reverse'], modes['skip'], len(todo)))
    if dry_run:
        for r, mode, q in plan:
            if mode == 'skip':
                print('  skip  %-40s %s' % (r['name'][:40], q))
        return None

    if not key:
        sys.exit('geocode_check: no key. Pass --key or set YANDEX_GEOCODER_API_KEY.')

    out = dict(sourceId=SOURCE_ID, storage='display', mayPopulateDataset=False,
               startedAt=datetime.now(timezone.utc).isoformat(timespec='seconds'),
               thresholds=dict(agreeM=AGREE_M, nearM=NEAR_M),
               seedGeneratedAt=seed.get('generatedAt'), recordCount=len(records),
               keyTest=bool(limit), requests=0,
               items=[], skipped=[dict(id=r['id'], name=r['name'], reason=q)
                                  for r, mode, q in plan if mode == 'skip'])

    for r, mode, q in todo:
        item = dict(id=r['id'], name=r['name'], mode=mode, query=q,
                    recordLat=r['lat'], recordLng=r['lng'], districtKey=r.get('districtKey'))
        try:
            payload = fetch(key, mode, q)
            out['requests'] += 1
            parsed = parse_response(payload)
            v, d = verdict_for(mode, r, parsed)
            item.update(found=parsed['found'], verdict=v,
                        distanceM=None if d is None else round(d, 1))
            if parsed['hit']:
                h = parsed['hit']
                item.update(yandexLat=h['lat'], yandexLng=h['lng'], precision=h['precision'],
                            kind=h['kind'], yandexText=h['text'])
        except urllib.error.HTTPError as e:
            body = e.read().decode('utf-8', 'replace')[:200].replace(key, '<key>')
            if e.code in (401, 403):
                sys.exit('geocode_check: Yandex refused the key (HTTP %d): %s\n'
                         '  The key must be bound to the product "API Геокодера" in the console.' % (e.code, body))
            item.update(verdict='error', error='HTTP %d: %s' % (e.code, body))
        except Exception as e:
            msg = str(e).replace(key, '<key>')[:200]
            if out['requests'] == 0:
                sys.exit('geocode_check: the first request failed before reaching Yandex: %s' % msg)
            item.update(verdict='error', error='%s: %s' % (type(e).__name__, msg))
        out['items'].append(item)
        print('  %-11s %-40s %s' % (item.get('verdict'), r['name'][:40],
                                    '' if item.get('distanceM') is None else '%.0f m' % item['distanceM']))
        time.sleep(PAUSE_S)

    out['finishedAt'] = datetime.now(timezone.utc).isoformat(timespec='seconds')
    out['summary'] = dict(Counter(i['verdict'] for i in out['items']))
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(out, indent=2, ensure_ascii=False) + '\n', encoding='utf-8')
    print('\nwrote %s' % OUT.relative_to(ROOT))
    report(out)
    return out


def report(out=None):
    if out is None:
        if not OUT.exists():
            sys.exit('geocode_check: no run recorded yet (%s)' % OUT.relative_to(ROOT))
        out = json.loads(OUT.read_text(encoding='utf-8-sig'))   # a Windows editor may add a BOM
    s = out.get('summary') or {}
    if out.get('keyTest'):
        print('\nNOTE: this file is a KEY TEST (%d requests), not a full pass.' % out.get('requests', 0))
    if out.get('seedGeneratedAt'):
        print('dataset: %s records, seed generated %s' % (out.get('recordCount', '?'), out['seedGeneratedAt']))
    order = ['agree', 'near', 'disagree', 'approximate', 'vague', 'not_found', 'suggested', 'error']
    print('\n%-12s %s' % ('verdict', 'count'))
    for k in order:
        if s.get(k):
            print('%-12s %d' % (k, s[k]))
    print('%-12s %d' % ('skipped', len(out.get('skipped') or [])))
    print('requests: %d | nothing above is written into the dataset.' % out.get('requests', 0))
    worst = [i for i in out['items'] if i.get('verdict') in ('disagree', 'near')]
    if worst:
        print('\nfor a person to look at:')
        for i in sorted(worst, key=lambda x: -(x.get('distanceM') or 0)):
            print('  %-9s %5.0f m  %-36s  %s' % (i['verdict'], i['distanceM'], i['name'][:36], i.get('yandexText') or ''))


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('--key')
    ap.add_argument('--limit', type=int)
    ap.add_argument('--dry-run', action='store_true')
    ap.add_argument('--report', action='store_true')
    a = ap.parse_args()
    if a.report:
        report()
        return
    key = a.key or os.environ.get(SRC.by_id(SOURCE_ID)['auth']) or None
    run(key, limit=a.limit, dry_run=a.dry_run)


if __name__ == '__main__':
    main()
