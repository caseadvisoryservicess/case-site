#!/usr/bin/env python3
"""Cross-check every business centre's SOURCE district label against the real
district polygons (point-in-polygon). Disagreements are data-quality findings:
we report them, we never silently overwrite the source."""
import json, collections

BC = '/home/user/case-site/case-site/os/data/geo_master/bc.json'
GJ = '/home/user/case-site/case-site/geo-mvp/data/tashkent_districts.simplified.geojson'

# bc.json spelling / geojson spelling / Russian -> canonical key
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

def in_ring(x, y, ring):
    """Ray casting. ring is [[lng,lat], ...]"""
    inside = False
    n = len(ring)
    j = n - 1
    for i in range(n):
        xi, yi = ring[i][0], ring[i][1]
        xj, yj = ring[j][0], ring[j][1]
        if (yi > y) != (yj > y):
            xint = (xj - xi) * (y - yi) / (yj - yi) + xi
            if x < xint:
                inside = not inside
        j = i
    return inside

def in_polygon(x, y, rings):
    if not in_ring(x, y, rings[0]):
        return False
    return not any(in_ring(x, y, h) for h in rings[1:])   # holes

def locate(x, y, feats):
    for f in feats:
        g = f['geometry']
        polys = [g['coordinates']] if g['type'] == 'Polygon' else g['coordinates']
        if any(in_polygon(x, y, p) for p in polys):
            return canon(f['properties']['name'])
    return None

feats = json.load(open(GJ, encoding='utf-8'))['features']
print('geojson districts ->', sorted({canon(f['properties']['name']) for f in feats}))
assert all(canon(f['properties']['name']) for f in feats), 'unmapped geojson district name'

recs = json.load(open(BC, encoding='utf-8'))
agree = disagree = outside = 0
mismatches, unmapped = [], []
geo_counts = collections.Counter()

for r in recs:
    src = canon(r.get('district'))
    if src is None:
        unmapped.append(r.get('district'))
    geo = locate(r['lng'], r['lat'], feats)
    geo_counts[geo or '<outside city boundary>'] += 1
    if geo is None:
        outside += 1
        mismatches.append((r['name'], r.get('district'), src, 'OUTSIDE'))
    elif src == geo:
        agree += 1
    else:
        disagree += 1
        mismatches.append((r['name'], r.get('district'), src, geo))

print(f'\nsource label vs polygon: agree {agree}, disagree {disagree}, outside boundary {outside} (of {len(recs)})')
print('unmapped source spellings:', set(unmapped) or 'none')
print('\nrecords per district BY GEOMETRY:')
for k, v in geo_counts.most_common():
    print(f'  {k:28s} {v}')
if mismatches:
    print(f'\n{len(mismatches)} disagreements (name | source label -> canon | polygon says):')
    for n, raw, s, g in mismatches:
        print(f'  {n[:38]:40s} {str(raw)[:16]:18s} {str(s):16s} -> {g}')
