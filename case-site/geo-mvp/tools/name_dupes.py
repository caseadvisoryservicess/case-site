#!/usr/bin/env python3
"""Name-similarity duplicate candidates — a different defect class from the source's
coordinate-collision flag. Cyrillic and Latin spellings of one building, or a building
listed twice under slightly different trade names, collide here but not on coordinates."""
import json, itertools, re, unicodedata
from pathlib import Path

RU2LAT = {'а':'a','б':'b','в':'v','г':'g','д':'d','е':'e','ё':'e','ж':'zh','з':'z','и':'i',
          'й':'y','к':'k','л':'l','м':'m','н':'n','о':'o','п':'p','р':'r','с':'s','т':'t',
          'у':'u','ф':'f','х':'h','ц':'ts','ч':'ch','ш':'sh','щ':'sch','ъ':'','ы':'y','ь':'',
          'э':'e','ю':'yu','я':'ya','ў':'o','қ':'q','ғ':'g','ҳ':'h'}
STOP = {'business','biznes','bussines','centre','center','centr','sentr','bc',
        'бизнес','центр','tower','plaza','office','офис','jsc','llc','group'}

def translit(s):
    s = unicodedata.normalize('NFKD', s.lower())
    return ''.join(RU2LAT.get(c, c) for c in s)

def norm(s):
    return re.sub(r'[^a-z0-9]+', ' ', translit(s)).strip()

def tokens(s):
    return {t for t in norm(s).split() if t and t not in STOP}

def lev(a, b):
    if a == b: return 0
    prev = list(range(len(b) + 1))
    for i, ca in enumerate(a, 1):
        cur = [i]
        for j, cb in enumerate(b, 1):
            cur.append(min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (ca != cb)))
        prev = cur
    return prev[-1]

recs = [r for r in json.loads(Path('data/seed.json').read_text(encoding='utf-8'))['records']
        if r['recordType'] == 'VERIFIED_SOURCE']

import math
def metres(a, b):
    la, lb = math.radians(a['lat']), math.radians(b['lat'])
    dl = math.radians(b['lng'] - a['lng'])
    h = math.sin((lb-la)/2)**2 + math.cos(la)*math.cos(lb)*math.sin(dl/2)**2
    return 2 * 6371008.8 * math.asin(math.sqrt(h))

# Name similarity ALONE is not evidence: "Neus"/"NEXUS" are 8 km apart and obviously
# different buildings. A name signal only becomes a duplicate signal when the two records
# are also close enough that they could plausibly be the same address.
GATE = {'identical': 4000, 'edit': 1500, 'contains': 1000}   # metres

hits = []
for a, b in itertools.combinations(recs, 2):
    dm = metres(a, b)
    na, nb = norm(a['name']).replace(' ', ''), norm(b['name']).replace(' ', '')
    if not na or not nb:
        continue
    ta, tb = tokens(a['name']), tokens(b['name'])
    d = lev(na, nb)
    shared = ta & tb
    # identical after normalisation, or a 1-2 char spelling drift, or one name contains the other
    if na == nb and dm <= GATE['identical']:
        why, score = 'identical name after normalisation', 1.0
    elif d <= 2 and max(len(na), len(nb)) >= 5 and dm <= GATE['edit']:
        why, score = f'near-identical name (edit distance {d})', 0.9
    elif shared and (ta <= tb or tb <= ta) and dm <= GATE['contains']:
        why, score = f'one name contains the other ({" ".join(sorted(shared))})', 0.7
    else:
        continue
    hits.append((score, why, a, b, dm))

hits.sort(key=lambda h: -h[0])
print(f'{len(hits)} name+proximity duplicate candidates (observed set, n={len(recs)}):')
print(f'gates: identical<={GATE["identical"]}m, edit-distance<={GATE["edit"]}m, containment<={GATE["contains"]}m\n')
for score, why, a, b, dm in hits:
    same_d = 'same district' if a['districtKey'] == b['districtKey'] else 'DIFFERENT districts'
    print(f'  [{score:.1f}] {why}')
    print(f'        {a["name"][:46]:48s} {a["districtKey"]}')
    print(f'        {b["name"][:46]:48s} {b["districtKey"]}')
    print(f'        -> {dm:,.0f} m apart, {same_d}\n')
