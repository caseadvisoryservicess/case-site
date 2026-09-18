#!/usr/bin/env python3
"""
Build the prototype seed dataset.

SOURCE OF TRUTH (real, verifiable data already held by CASE):
  os/data/geo_master/bc.json          148 Tashkent business centres, 2GIS, retrieved 2026-07-19
  geo-mvp/data/tashkent_districts.simplified.geojson   12 district boundaries (2024 city boundary)

OUTPUT:
  geo-mvp/data/seed.json              the dataset envelope the prototype ships with

RULES THIS SCRIPT ENFORCES (brief §2.2, §2.3, §36):
  * An unknown value is ALWAYS `null`. Never 0, never "", never omitted.
  * Nothing is invented. A field absent from the source stays unknown.
  * Every populated field carries provenance in `_evidence`.
  * Synthetic records are marked recordType="DEMO" and are structurally impossible
    to mistake for market data.
"""
import json, hashlib, collections
from datetime import date, timedelta
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]           # .../case-site
MVP = ROOT / 'geo-mvp'
BC_SRC = ROOT / 'os' / 'data' / 'geo_master' / 'bc.json'
DISTRICTS = MVP / 'data' / 'tashkent_districts.simplified.geojson'
OUT = MVP / 'data' / 'seed.json'

SCHEMA_VERSION = '1.0.0'
BUILD_DATE = '2026-09-16'          # the date this seed was generated (no wall-clock: reproducible)
SOURCE_DATE = '2026-07-19'         # when 2GIS data was retrieved, per the source files

# ─────────────────────────────────────────────────────────────────────────────
# Refresh cadence (brief §23). ASSUMPTION, not fact – Tashkent office asking rents
# and availability move fast; structural attributes do not. Exposed in the app as an
# editable setting so the product decision can be tested rather than hidden.
# ─────────────────────────────────────────────────────────────────────────────
REFRESH_DAYS = {'fast': 60, 'slow': 365, 'stable': 1095}

FIELD_REFRESH = {
    'name': 'stable', 'altNames': 'stable', 'address': 'stable',
    'lat': 'stable', 'lng': 'stable', 'districtKey': 'stable',
    'status': 'fast',
    'officeClass': 'slow', 'yearOpened': 'slow', 'yearRenovated': 'slow', 'floors': 'slow',
    'gba': 'slow', 'gla': 'slow', 'typicalFloorPlate': 'slow',
    'parkingSpaces': 'slow', 'parkingRatio': 'slow',
    'developer': 'slow', 'owner': 'slow', 'operator': 'slow', 'amenities': 'slow',
    'askingRent': 'fast', 'serviceCharge': 'fast', 'vatTreatment': 'slow',
    'occupancyPct': 'fast', 'vacancyPct': 'fast', 'availableArea': 'fast',
    'minUnit': 'fast', 'leaseTerms': 'fast', 'tenants': 'fast',
}

# Fields a business-centre record must carry to be commercially usable (drives the
# "missing critical data" indicator and the verification backlog, §19/§50).
CRITICAL_FIELDS = ['officeClass', 'status', 'gla', 'floors', 'askingRent',
                   'vacancyPct', 'parkingSpaces', 'yearOpened']

ALL_VALUE_FIELDS = list(FIELD_REFRESH.keys())

# district spelling (2GIS label, geojson latin, Russian) -> canonical key
CANON = {
    'mirabad': 'mirobod', 'mirobod': 'mirobod', 'мирабад': 'mirobod',
    'mirzo-ulugbek': 'mirzo-ulugbek', 'mirzo ulugbek': 'mirzo-ulugbek', 'мирзо-улугбек': 'mirzo-ulugbek',
    'yakkasaray': 'yakkasaroy', 'yakkasaroy': 'yakkasaroy', 'яккасарай': 'yakkasaroy',
    'yunusabad': 'yunusobod', 'yunusobod': 'yunusobod', 'юнусабад': 'yunusobod',
    'yashnabad': 'yashnobod', 'yashnobod': 'yashnobod', 'яшнабад': 'yashnobod',
    'chilanzar': 'chilonzor', 'chilonzor': 'chilonzor', 'чиланзар': 'chilonzor',
    'shaykhantakhur': 'shayxontohur', 'shayxontohur': 'shayxontohur', 'шайхантахур': 'shayxontohur',
    'sergeli': 'sergeli', 'сергели': 'sergeli',
    'olmazor': 'olmazor', 'алмазар': 'olmazor', 'алмазарский район': 'olmazor',
    'uchtepa': 'uchtepa', 'учтепа': 'uchtepa',
    'yangihayot': 'yangihayot', 'янгихаёт': 'yangihayot',
    'bektemir': 'bektemir', 'бектемир': 'bektemir',
}


def canon(s):
    return CANON.get((s or '').strip().lower())


# ── geometry ────────────────────────────────────────────────────────────────
def in_ring(x, y, ring):
    inside, n = False, len(ring)
    j = n - 1
    for i in range(n):
        xi, yi = ring[i][0], ring[i][1]
        xj, yj = ring[j][0], ring[j][1]
        if (yi > y) != (yj > y) and x < (xj - xi) * (y - yi) / (yj - yi) + xi:
            inside = not inside
        j = i
    return inside


def in_polygon(x, y, rings):
    return in_ring(x, y, rings[0]) and not any(in_ring(x, y, h) for h in rings[1:])


def polys_of(feature):
    g = feature['geometry']
    return [g['coordinates']] if g['type'] == 'Polygon' else g['coordinates']


def locate(x, y, feats):
    for f in feats:
        if any(in_polygon(x, y, p) for p in polys_of(f)):
            return canon(f['properties']['name'])
    return None


def interior_point(feature):
    """A point guaranteed to be inside the district – used to place DEMO records
    in a named district without inventing a real street address."""
    biggest = max(polys_of(feature), key=lambda p: len(p[0]))
    ring = biggest[0]
    cx = sum(p[0] for p in ring) / len(ring)
    cy = sum(p[1] for p in ring) / len(ring)
    if in_polygon(cx, cy, biggest):
        return round(cy, 6), round(cx, 6)
    xs = sorted({round(p[0], 4) for p in ring})           # scanline fallback
    for x in xs[len(xs) // 4: 3 * len(xs) // 4]:
        ys = sorted(p[1] for p in ring)
        for k in range(1, 20):
            y = ys[0] + (ys[-1] - ys[0]) * k / 20
            if in_polygon(x, y, biggest):
                return round(y, 6), round(x, 6)
    return round(cy, 6), round(cx, 6)


# ── helpers ─────────────────────────────────────────────────────────────────
def clean(v):
    """Source empty string / whitespace -> canonical unknown (None). Never 0, never ''."""
    if v is None:
        return None
    s = str(v).strip()
    return s if s else None


def num(v):
    s = clean(v)
    if s is None:
        return None
    try:
        f = float(s.replace(',', '.'))
    except ValueError:
        return None
    return int(f) if f.is_integer() else f


def add_days(iso, days):
    y, m, d = (int(x) for x in iso.split('-'))
    return (date(y, m, d) + timedelta(days=days)).isoformat()


# ── provenance profiles ─────────────────────────────────────────────────────
# A source is an ENTITY, not a copy. `_evidence[field]` holds a profile id (a string),
# or an object {p: "<profileId>", ...overrides} when a single field diverges – which is
# what the in-app editor writes when a user re-verifies one value. Dates default to the
# record's own collectedAt / lastVerifiedAt; `nextRefreshAt` is always COMPUTED from
# lastVerifiedAt + refreshDays[fieldRefreshClass[field]], never stored, so it can never
# drift out of sync with the verification date.
EVIDENCE_PROFILES = {
    '2GIS-BASE': {
        'source': '2GIS (CASE Tashkent Geo Master seed)', 'sourceId': 'SRC-2GIS-BC',
        'sourceUrl': None, 'method': 'map service', 'confidence': 'Medium',
        'collectorId': None, 'reviewer': None, 'qcStatus': 'needs_check',
        'note': 'Name, location and address as listed by the source map service. '
                'Single source, single-point coordinate accuracy; not field-verified.',
    },
    '2GIS-CLASS': {
        'source': '2GIS (CASE Tashkent Geo Master seed)', 'sourceId': 'SRC-2GIS-BC',
        'sourceUrl': None, 'method': 'map service', 'confidence': 'Low',
        'collectorId': None, 'reviewer': None, 'qcStatus': 'needs_check',
        'note': 'Office class as advertised in the source listing. Not verified against a '
                'technical survey or an independent classification; treat as a claim.',
    },
    '2GIS-RENT': {
        'source': '2GIS (CASE Tashkent Geo Master seed)', 'sourceId': 'SRC-2GIS-BC',
        'sourceUrl': None, 'method': 'map service', 'confidence': 'Low',
        'collectorId': None, 'reviewer': None, 'qcStatus': 'needs_check',
        'note': 'Advertised headline asking rent from a directory listing. Lease terms, '
                'service charge, VAT treatment and achievability are all unknown; not landlord-confirmed.',
    },
    'GEOMETRY': {
        'source': 'Computed from Toshkent shahar chegarasi (2024)', 'sourceId': 'SRC-CITY-BOUNDARY',
        'sourceUrl': None, 'method': 'public registry', 'confidence': 'High',
        'collectorId': None, 'reviewer': None, 'qcStatus': 'accepted',
        'note': 'District assigned by point-in-polygon against the official 2024 city boundary – '
                'reproducible from the coordinates, not a third-party label.',
    },
}
for _lvl in ('High', 'Medium', 'Low', 'Unknown'):
    EVIDENCE_PROFILES[f'DEMO-{_lvl.upper()}'] = {
        'source': 'Synthetic demo record – not market data', 'sourceId': 'SRC-DEMO',
        'sourceUrl': None, 'method': 'other', 'confidence': _lvl,
        'collectorId': None, 'reviewer': 'CASE Geoanalytics (prototype)', 'qcStatus': 'accepted',
        'note': 'Fictional value created so the prototype can be tested. '
                'Must never be cited as market evidence.',
    }


# ─────────────────────────────────────────────────────────────────────────────
# Entity review (§4, D7). A 2GIS keyword scrape for "business centre" also returns
# tenant firms and organisations housed inside offices. We NEVER delete a record on
# our own judgement – deletion is an unverified call. We pre-flag only records whose
# NAME ITSELF states it is a company, an organisation or an office rather than a
# building, leave everything else `unreviewed`, and let a human work the queue.
# Conservative by design: a false "suspected" flag is as damaging as a missed one.
# ─────────────────────────────────────────────────────────────────────────────
SUSPECTED_NON_BC = {
    'Infinity, компания консалтинга в сфере недвижимости':
        'Name states a real-estate consulting company, not a building. Listed twice at two addresses.',
    'Carvon, офис':
        'Name states an office OF a company ("офис"), not a business centre.',
    'Korea Uzbekistan Business Association':
        'An association. Likely a tenant organisation rather than the building itself.',
    'Asia metall concern':
        'Name denotes an industrial concern (a company), not an office building.',
    'ILFAR DIYOR TEKSTIL':
        'Name denotes a textile company, not an office building.',
    'Aloqa klimkontrol':
        'Name denotes a climate-control contractor, not an office building.',
    'Rooms Coworking':
        'A coworking operator. A different asset sub-type from a leasable business centre (§4).',
}

NAME_QUALITY = {
    'Бизнес центр': 'Generic placeholder name – carries no building identity.',
    'Бизнес центр 2': 'Generic placeholder name with an index – carries no building identity.',
    'Biznes sentr': 'Generic placeholder name (transliterated) – carries no building identity.',
    'Bussines Center': 'Generic, misspelled placeholder name – carries no building identity.',
    'Chilonzor': 'A district name used as a building name – almost certainly a mis-scraped record.',
    'Авто': 'Single generic word ("auto") – carries no building identity.',
}


def entity_review(name):
    if name in SUSPECTED_NON_BC:
        return 'suspected_non_bc', SUSPECTED_NON_BC[name]
    if name in NAME_QUALITY:
        return 'name_quality', NAME_QUALITY[name]
    return 'unreviewed', None


def blank_record():
    """Every record carries the full key set so `null` always means 'unknown',
    never 'the key happened to be missing'."""
    return {
        'id': None, 'recordType': 'VERIFIED_SOURCE',
        'name': None, 'altNames': [], 'status': None, 'address': None,
        'districtKey': None, 'lat': None, 'lng': None,
        'officeClass': None, 'yearOpened': None, 'yearRenovated': None, 'floors': None,
        'gba': None, 'gla': None, 'typicalFloorPlate': None,
        'parkingSpaces': None, 'parkingRatio': None,
        'developer': None, 'owner': None, 'operator': None,
        'askingRent': None, 'currency': None, 'rentUnit': None,
        'serviceCharge': None, 'vatTreatment': None,
        'occupancyPct': None, 'vacancyPct': None, 'availableArea': None,
        'minUnit': None, 'leaseTerms': None,
        'tenants': [],
        # §36: "no tenants entered" must be distinguishable from "confirmed empty building"
        'tenantsStatus': 'not_collected',   # not_collected | partial | complete | confirmed_empty
        'amenities': [],
        'amenitiesStatus': 'not_collected',
        '_evidence': {},
        '_meta': {},
        '_history': {},                     # §2.4 reserved – shape defined, unpopulated in MVP
    }


# ── build: real records ─────────────────────────────────────────────────────
def build_real(feats):
    src = json.loads(BC_SRC.read_text(encoding='utf-8'))
    out, conflicts, outside = [], 0, 0

    for row in src:
        r = blank_record()
        r['id'] = clean(row.get('master_id')) or 'BC-' + hashlib.sha1(
            (row['name'] + str(row['lat'])).encode()).hexdigest()[:12]
        r['name'] = clean(row.get('name'))
        r['address'] = clean(row.get('address'))
        r['lat'] = num(row.get('lat'))
        r['lng'] = num(row.get('lng'))

        src_key = canon(row.get('district'))
        geo_key = locate(r['lng'], r['lat'], feats)
        # Geometry is reproducible; a third-party label is a claim. We adopt the polygon
        # result but keep the source label and flag the disagreement (§2.7, §19).
        r['districtKey'] = geo_key or src_key
        if geo_key is None:
            outside += 1
        elif src_key and src_key != geo_key:
            conflicts += 1

        r['officeClass'] = clean(row.get('class'))
        r['askingRent'] = num(row.get('rent'))
        if r['askingRent'] is not None:
            r['currency'] = 'USD'
            r['rentUnit'] = 'USD/m2/month'

        note = clean(row.get('_note')) or clean(row.get('comment'))

        # Provenance. Coordinates/name/address come from a single map-service listing:
        # Medium. Class and asking rent from the same unverified listing are commercial
        # claims a CRE advisor must confirm with the landlord: Low (§2.3 – do not inflate).
        # Provenance by reference. Coordinates/name/address come from a single map-service
        # listing: Medium. Class and asking rent from that same unverified listing are
        # commercial claims a CRE advisor must confirm with the landlord: Low
        # (§2.3 – do not inflate confidence).
        r['_evidence'] = {f: '2GIS-BASE' for f in ('name', 'lat', 'lng')}
        r['_evidence']['districtKey'] = 'GEOMETRY' if geo_key else '2GIS-BASE'
        if r['address']:
            r['_evidence']['address'] = '2GIS-BASE'
        if r['officeClass']:
            r['_evidence']['officeClass'] = '2GIS-CLASS'
        if r['askingRent'] is not None:
            r['_evidence']['askingRent'] = '2GIS-RENT'

        r['_meta'] = {
            'recordConfidence': 'Medium',              # source data_confidence "B"
            'sourceConfidenceLetter': clean(row.get('data_confidence')),
            'sourceCount': num(row.get('source_count')) or 1,
            'coordinateAccuracy': clean(row.get('coordinate_accuracy')),
            'verificationMode': clean(row.get('_verification')),      # "online" = desk research
            'collectedAt': SOURCE_DATE,
            'lastVerifiedAt': SOURCE_DATE,
            'seedObjectId': clean(row.get('seed_object_id')),
            'possibleDuplicate': bool(clean(row.get('possible_duplicate'))),
            'duplicateGroupId': clean(row.get('duplicate_group_id')),
            'districtSourceLabel': clean(row.get('district')),
            'districtSourceKey': src_key,
            'districtResolvedBy': 'polygon' if geo_key else 'source-label',
            'entityReview': entity_review(r['name'])[0],
            'entityReviewNote': entity_review(r['name'])[1],
            'districtConflict': bool(geo_key and src_key and src_key != geo_key),
            'sourceNote': note,
            'editedLocally': False,
            'createdAt': SOURCE_DATE,
            'updatedAt': SOURCE_DATE,
        }
        out.append(r)

    return out, conflicts, outside


# ── build: demo records ─────────────────────────────────────────────────────
DEMO_SPECS = [
    # district, name, and the feature each record exists to make testable
    dict(d='yunusobod', name='DEMO – Alpha Tower', officeClass='A+', status='Operating',
         gla=24500, gba=31000, floors=28, typicalFloorPlate=950, yearOpened=2022,
         askingRent=45, serviceCharge=6.5, occupancyPct=92, vacancyPct=8,
         availableArea=1960, minUnit=120, parkingSpaces=420, parkingRatio=0.017,
         developer='DEMO Developer LLC', owner='DEMO Holding', operator='DEMO Property Management',
         amenities=['restaurant', 'cafe', 'gym', 'conference room', 'reception', 'security',
                    'underground parking', 'EV charging', 'backup generator'],
         tenants=[dict(name='DEMO Bank', industry='Financial services', area=4200, floor='3-6'),
                  dict(name='DEMO Consulting', industry='Professional services', area=1800, floor='12'),
                  dict(name='DEMO Tech', industry='IT & software', area=3100, floor='15-17'),
                  dict(name='DEMO Energy', industry='Energy', area=2400, floor='20')],
         tenantsStatus='complete', confidence='High', verified='2026-09-10',
         why='fully populated record – exercises every metric, chart and comparison row'),
    dict(d='mirobod', name='DEMO – Beta Plaza', officeClass='A', status='Operating',
         gla=12000, gba=15500, floors=16, typicalFloorPlate=780, yearOpened=2019,
         askingRent=32, serviceCharge=5, occupancyPct=78, vacancyPct=22,
         availableArea=2640, minUnit=90, parkingSpaces=180,
         owner='DEMO Investments', operator='DEMO Property Management',
         amenities=['cafe', 'conference room', 'reception', 'security', 'surface parking'],
         tenants=[dict(name='DEMO Logistics', industry='Transport & logistics', area=2100, floor='4-5'),
                  dict(name='DEMO Legal', industry='Professional services', area=900, floor='9')],
         tenantsStatus='partial', confidence='Medium', verified='2026-08-01',
         why='partial tenant list – exercises "partial" tenant coverage vs complete'),
    dict(d='chilonzor', name='DEMO – Gamma Business Park', officeClass='B+', status='Operating',
         gla=8200, gba=9900, floors=9, yearOpened=2015, askingRent=24,
         occupancyPct=None, vacancyPct=None, parkingSpaces=120,
         amenities=['cafe', 'security', 'surface parking', 'bicycle parking'],
         tenantsStatus='not_collected', confidence='Medium', verified='2026-07-05',
         why='known rent but UNKNOWN occupancy – proves unknown occupancy is not read as 0%'),
    dict(d='yashnobod', name='DEMO – Delta Works', officeClass='B', status='Renovation',
         gla=5400, gba=6600, floors=7, yearOpened=2006, yearRenovated=2026,
         askingRent=None, occupancyPct=55, vacancyPct=45, availableArea=2430,
         parkingSpaces=60, amenities=['security', 'surface parking'],
         tenantsStatus='not_collected', confidence='Low', verified='2025-11-02',
         why='STALE record with UNKNOWN rent – drives the stale indicator and proves missing rent is not free rent'),
    dict(d='mirzo-ulugbek', name='DEMO – Epsilon Tower', officeClass='A+', status='Under construction',
         gla=30000, gba=38000, floors=32, yearOpened=2028,
         askingRent=None, parkingSpaces=500,
         developer='DEMO Developer LLC',
         tenantsStatus='not_collected', confidence='Low', verified='2026-08-20',
         why='pipeline record – exercises operating-vs-pipeline split and pipeline supply'),
    dict(d='sergeli', name='DEMO – Zeta Center', officeClass=None, status='Planned',
         gla=None, floors=None, askingRent=None,
         tenantsStatus='not_collected', confidence='Unknown', verified='2026-06-15',
         why='almost-empty record with UNKNOWN class – drives the missing-critical-data indicator'),
    dict(d='yakkasaroy', name='DEMO – Eta House', officeClass='C', status='Operating',
         gla=2100, gba=2500, floors=4, yearOpened=1998, askingRent=15, serviceCharge=2.5,
         occupancyPct=100, vacancyPct=0, availableArea=0, parkingSpaces=18,
         amenities=['reception', 'surface parking'],
         tenants=[dict(name='DEMO Trading', industry='Wholesale & retail', area=2100, floor='1-4')],
         tenantsStatus='complete', confidence='High', verified='2026-09-12',
         why='CONFIRMED zero vacancy and zero available area – proves 0 is stored and shown as a real value, not as unknown'),
    dict(d='uchtepa', name='DEMO – Theta Offices', officeClass='B+', status='Operating',
         gla=6800, gba=8100, floors=8, yearOpened=2025, askingRent=27.5, serviceCharge=4,
         occupancyPct=0, vacancyPct=100, availableArea=6800, minUnit=150, parkingSpaces=95,
         amenities=['cafe', 'reception', 'security', 'underground parking'],
         tenants=[], tenantsStatus='confirmed_empty', confidence='High', verified='2026-09-08',
         why='newly completed, CONFIRMED empty – proves "no tenants entered" differs from "confirmed empty"'),
]


def build_demo(feats):
    by_key = {canon(f['properties']['name']): f for f in feats}
    out = []
    for i, s in enumerate(DEMO_SPECS, 1):
        lat, lng = interior_point(by_key[s['d']])
        r = blank_record()
        r['recordType'] = 'DEMO'
        r['id'] = f'DEMO-{i:03d}'
        r['name'] = s['name']
        r['address'] = 'Synthetic location – not a real address'
        r['districtKey'] = s['d']
        r['lat'], r['lng'] = lat, lng
        for k in ('status', 'officeClass', 'yearOpened', 'yearRenovated', 'floors', 'gba', 'gla',
                  'typicalFloorPlate', 'parkingSpaces', 'parkingRatio', 'developer', 'owner',
                  'operator', 'askingRent', 'serviceCharge', 'occupancyPct', 'vacancyPct',
                  'availableArea', 'minUnit', 'leaseTerms'):
            if k in s:
                r[k] = s[k]
        if r['askingRent'] is not None:
            r['currency'], r['rentUnit'] = 'USD', 'USD/m2/month'
        r['tenants'] = s.get('tenants', [])
        r['tenantsStatus'] = s['tenantsStatus']
        r['amenities'] = s.get('amenities', [])
        r['amenitiesStatus'] = 'complete' if s.get('amenities') else 'not_collected'

        conf, ver = s['confidence'], s['verified']
        prof = f'DEMO-{conf.upper()}'
        for f in ALL_VALUE_FIELDS:
            v = r.get(f)
            if f == 'altNames' or v is None or v == []:
                continue
            r['_evidence'][f] = prof

        r['_meta'] = {
            'recordConfidence': conf,
            'sourceConfidenceLetter': None, 'sourceCount': 0,
            'coordinateAccuracy': 'synthetic', 'verificationMode': 'synthetic',
            'collectedAt': ver, 'lastVerifiedAt': ver, 'seedObjectId': None,
            'possibleDuplicate': False, 'duplicateGroupId': None,
            'districtSourceLabel': None, 'districtSourceKey': s['d'],
            'districtResolvedBy': 'synthetic', 'districtConflict': False,
            'entityReview': 'confirmed_bc', 'entityReviewNote': None,
            'sourceNote': 'DEMO RECORD – fictional. Excluded from market analytics by default.',
            'demoPurpose': s['why'],
            'editedLocally': False, 'createdAt': ver, 'updatedAt': ver,
        }
        out.append(r)
    return out


# ── main ────────────────────────────────────────────────────────────────────
def main():
    feats = json.loads(DISTRICTS.read_text(encoding='utf-8'))['features']
    real, conflicts, outside = build_real(feats)
    demo = build_demo(feats)

    districts = [{
        'key': canon(f['properties']['name']),
        'name': f['properties']['name'],
        'nameRu': f['properties']['name_ru'],
        'nameUz': f['properties']['tuman'],
        'areaHa': f['properties']['area_ha'],
    } for f in feats]

    dup_groups = collections.Counter(
        r['_meta']['duplicateGroupId'] for r in real if r['_meta']['duplicateGroupId'])

    envelope = {
        'schemaVersion': SCHEMA_VERSION,
        'generatedAt': BUILD_DATE,
        'city': {'key': 'tashkent', 'name': 'Tashkent', 'nameRu': 'Ташкент',
                 'centre': [41.3111, 69.2797], 'defaultZoom': 12},
        'assetType': {'key': 'business_centre', 'name': 'Business centres / office buildings'},
        'refreshDays': REFRESH_DAYS,
        'criticalFields': CRITICAL_FIELDS,
        'fieldRefreshClass': FIELD_REFRESH,
        'evidenceProfiles': EVIDENCE_PROFILES,
        'districts': districts,
        'sources': [
            {'id': 'SRC-2GIS-BC', 'name': '2GIS (CASE Tashkent Geo Master seed)',
             'method': 'map service', 'retrievedAt': SOURCE_DATE, 'recordCount': len(real),
             'url': None, 'licenceReview': 'required',
             'note': 'Desk-collected listing data. Single source per record; commercial terms unverified.'},
            {'id': 'SRC-CITY-BOUNDARY', 'name': 'Toshkent shahar chegarasi (2024)',
             'method': 'public registry', 'retrievedAt': '2024-01-01', 'recordCount': len(districts),
             'url': None, 'licenceReview': 'required',
             'note': 'District boundaries, simplified to ~9 m tolerance for in-browser rendering.'},
            {'id': 'SRC-DEMO', 'name': 'Synthetic demo record – not market data',
             'method': 'other', 'retrievedAt': BUILD_DATE, 'recordCount': len(demo),
             'url': None, 'licenceReview': 'n/a',
             'note': 'Fictional records created solely to exercise features the real dataset cannot. Never market evidence.'},
        ],
        'counts': {
            'total': len(real) + len(demo),
            'verifiedSource': len(real),
            'demo': len(demo),
            'districtConflicts': conflicts,
            'outsideCityBoundary': outside,
            'duplicateGroups': len(dup_groups),
            'duplicateRecords': sum(dup_groups.values()),
        },
        'records': real + demo,
    }

    payload = json.dumps(envelope, ensure_ascii=False, separators=(',', ':'))
    OUT.write_text(payload, encoding='utf-8')

    cov = {f: sum(1 for r in real if r.get(f) not in (None, [], {})) for f in ALL_VALUE_FIELDS}
    print(f'wrote {OUT.relative_to(ROOT)}: {len(payload):,} bytes')
    print(f'  {len(real)} VERIFIED_SOURCE + {len(demo)} DEMO = {envelope["counts"]["total"]} records')
    print(f'  district label conflicts: {conflicts}   outside boundary: {outside}   '
          f'duplicate groups: {len(dup_groups)} ({sum(dup_groups.values())} records)')
    import collections as _c
    er = _c.Counter(r['_meta']['entityReview'] for r in real)
    print('  entity review: ' + ', '.join(f'{k}={v}' for k, v in er.most_common()))
    print('  real-record coverage: ' + ', '.join(
        f'{k}={v}' for k, v in sorted(cov.items(), key=lambda kv: -kv[1]) if v))
    print('  real-record fields with ZERO coverage: ' + ', '.join(
        k for k, v in sorted(cov.items()) if not v))


if __name__ == '__main__':
    main()
