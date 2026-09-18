#!/usr/bin/env python3
"""
The QA oracle.

Computes, from the shipped seed, every number the acceptance tests assert. The app must
re-derive these at runtime — they are never hard-coded in the application. This script is
the independent second implementation that proves the app's arithmetic, and it generates
the assertion table used by the in-app `?selftest=1` mode.

Rules encoded here (the binding decisions — see docs/00-BUILD-CONTRACT.md):
  * District is decided by point-in-polygon, not by the source's label.
  * Unknown is null and is NEVER counted as zero, and never enters a denominator.
  * DEMO records are excluded from market statistics by default.
  * Median of an even-sized sample = mean of the two central values.
  * Radius bands are CUMULATIVE (the 3 km count includes the 1 km count) and the
    subject property is excluded from its own counts.
"""
import json, math, collections
from pathlib import Path

MVP = Path(__file__).resolve().parents[1]
SEED = json.loads((MVP / 'data' / 'seed.json').read_text(encoding='utf-8'))
ALL = SEED['records']
OBS = [r for r in ALL if r['recordType'] == 'VERIFIED_SOURCE']
DEMO = [r for r in ALL if r['recordType'] == 'DEMO']
TODAY = '2026-09-16'

R_EARTH_M = 6371008.8          # IUGG mean earth radius, metres


def haversine_m(a, b):
    p1, p2 = math.radians(a[0]), math.radians(b[0])
    dp, dl = p2 - p1, math.radians(b[1] - a[1])
    h = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 2 * R_EARTH_M * math.asin(math.sqrt(h))


def known(rows, field):
    """The ONLY way a metric may read values. Drops null/absent — never coerces to 0."""
    return [r[field] for r in rows if r.get(field) is not None]


def median(xs):
    s = sorted(xs)
    n = len(s)
    if not n:
        return None
    return s[n // 2] if n % 2 else (s[n // 2 - 1] + s[n // 2]) / 2


def r2(x):
    return None if x is None else round(x + 1e-12, 2)


def coverage(rows, field):
    return len(known(rows, field)), len(rows)


def days_between(a, b):
    from datetime import date
    ya, ma, da = map(int, a.split('-'))
    yb, mb, db = map(int, b.split('-'))
    return (date(yb, mb, db) - date(ya, ma, da)).days


out = {}
say = lambda *a: print(*a)

# ── 1. headline coverage ────────────────────────────────────────────────────
say('=' * 78)
say('QA ORACLE  —  seed', SEED['schemaVersion'], 'generated', SEED['generatedAt'], '| today', TODAY)
say('=' * 78)
say(f'\nrecords: {len(ALL)} total = {len(OBS)} observed (VERIFIED_SOURCE) + {len(DEMO)} DEMO')
say('market statistics below use the OBSERVED set only (demo off by default)\n')

FIELDS = ['name', 'address', 'districtKey', 'officeClass', 'askingRent', 'status', 'gla',
          'gba', 'floors', 'parkingSpaces', 'yearOpened', 'occupancyPct', 'vacancyPct',
          'availableArea', 'serviceCharge', 'owner', 'operator', 'developer']
say('field coverage (observed set):')
cov = {}
for f in FIELDS:
    n, N = coverage(OBS, f)
    cov[f] = n
    say(f'  {f:16s} {n:4d} / {N}   {100 * n / N:5.1f}%')
out['coverage_observed'] = cov

# ── 2. districts, by geometry ───────────────────────────────────────────────
say('\nbusiness centres by district (GEOMETRY-authoritative, observed set):')
dist_counts = collections.Counter(r['districtKey'] for r in OBS)
rows = []
for d in SEED['districts']:
    c = dist_counts.get(d['key'], 0)
    rows.append((d['key'], d['name'], c))
for k, name, c in sorted(rows, key=lambda x: (-x[2], x[0])):
    say(f'  {name:16s} ({k:14s}) {c:4d}')
say(f'  SUM = {sum(c for _, _, c in rows)}  (must equal {len(OBS)})')
assert sum(c for _, _, c in rows) == len(OBS)
out['by_district'] = {k: c for k, _, c in rows}

conflicts = [r for r in OBS if r['_meta']['districtConflict']]
say(f'\n  district label conflicts (source label != polygon): {len(conflicts)}')
say(f'  districts with ZERO business centres: ' +
    ', '.join(n for _, n, c in rows if c == 0))

# ── 3. class ────────────────────────────────────────────────────────────────
say('\nbusiness centres by office class (observed set):')
CLASS_ORDER = ['A+', 'A', 'B+', 'B', 'C']
cls = collections.Counter(r['officeClass'] for r in OBS if r['officeClass'])
for c in CLASS_ORDER:
    say(f'  {c:4s} {cls.get(c, 0):4d}')
unknown_cls = len(OBS) - sum(cls.values())
say(f'  Not recorded {unknown_cls}   (coverage {sum(cls.values())} of {len(OBS)})')
out['by_class'] = {c: cls.get(c, 0) for c in CLASS_ORDER}
out['class_unknown'] = unknown_cls

a_aplus = [r for r in OBS if r['officeClass'] in ('A', 'A+')]
say(f'\n  UX-1  class filter A + A+  ->  {len(a_aplus)} properties '
    f'({len(OBS) - len(a_aplus)} excluded, class not recorded)')
out['ux1_a_aplus'] = len(a_aplus)

# ── 4. rent ─────────────────────────────────────────────────────────────────
rents = known(OBS, 'askingRent')
say(f'\nasking rent (observed set): n = {len(rents)} of {len(OBS)}')
say(f'  values : {sorted(rents)}')
say(f'  mean   : {r2(sum(rents) / len(rents))}  USD/m2/month')
say(f'  median : {r2(median(rents))}   (even n -> mean of the two central values)')
say(f'  min/max: {min(rents)} / {max(rents)}')
out['rent'] = {'n': len(rents), 'N': len(OBS), 'mean': r2(sum(rents) / len(rents)),
               'median': r2(median(rents)), 'min': min(rents), 'max': max(rents)}

below30 = [r for r in OBS if r['askingRent'] is not None and r['askingRent'] < 30]
say(f'\n  UX-3  asking rent < 30  ->  {len(below30)} properties')
out['ux3_rent_below_30'] = len(below30)

say('\n  rent by district (observed; suppressed below n=3 — one building is not a market):')
byd = collections.defaultdict(list)
for r in OBS:
    if r['askingRent'] is not None:
        byd[r['districtKey']].append(r['askingRent'])
for k in sorted(byd, key=lambda k: -len(byd[k])):
    v = byd[k]
    shown = f'mean {r2(sum(v) / len(v))} median {r2(median(v))}' if len(v) >= 3 \
        else 'SUPPRESSED — insufficient verified data'
    say(f'    {k:16s} n={len(v)}  {shown}')
out['rent_by_district'] = {k: {'n': len(v), 'mean': r2(sum(v) / len(v))} for k, v in byd.items()}

# ── 5. class A/A+ by district (AI-3b) ───────────────────────────────────────
say('\n  AI-3b  districts ranked by class A / A+ count (observed):')
aa = collections.Counter(r['districtKey'] for r in a_aplus)
rank = sorted(aa.items(), key=lambda kv: (-kv[1], kv[0]))
for k, c in rank:
    say(f'    {k:16s} {c}')
top = [k for k, c in rank if c == rank[0][1]]
say(f'    top = {top} (tie -> report as a tie, break alphabetically)')
out['ai3b_rank'] = rank
out['ai3b_top'] = top

# ── 6. radius analysis around Trilliant (UX-4 / AI-4) ───────────────────────
subj = next(r for r in OBS if r['name'] == 'Trilliant')
say(f"\nUX-4 / AI-4  location analysis around '{subj['name']}' "
    f"({subj['id']}, class {subj['officeClass']}, rent {subj['askingRent']}, "
    f"district {subj['districtKey']} [source label: {subj['_meta']['districtSourceLabel']}])")
origin = (subj['lat'], subj['lng'])
others = [r for r in OBS if r['id'] != subj['id']]          # subject excluded from its own counts
dists = {r['id']: haversine_m(origin, (r['lat'], r['lng'])) for r in others}
bands = {}
for km in (1, 3, 5):
    inside = [r for r in others if dists[r['id']] <= km * 1000]   # CUMULATIVE
    bands[km] = inside
    rr = known(inside, 'askingRent')
    mean_txt = (f'{r2(sum(rr) / len(rr))} (n={len(rr)} of {len(inside)})'
                if len(rr) >= 3 else f'INSUFFICIENT (n={len(rr)})')
    gl = known(inside, 'gla')
    say(f'  within {km} km: {len(inside):4d} properties | avg known rent {mean_txt} | '
        f'known GLA {sum(gl) if gl else "INSUFFICIENT (0 records)"}')
out['radius_trilliant'] = {km: len(v) for km, v in bands.items()}
r3 = known(bands[3], 'askingRent')
out['radius_trilliant_rent3km'] = {'n': len(r3), 'N': len(bands[3]),
                                   'mean': r2(sum(r3) / len(r3)) if r3 else None}
say(f"  3 km class mix: " + ', '.join(
    f'{c}={sum(1 for r in bands[3] if r["officeClass"] == c)}' for c in CLASS_ORDER) +
    f', Not recorded={sum(1 for r in bands[3] if not r["officeClass"])}')

# competitive set: proximity + class band (+/-1 step); unknown class is NOT silently dropped
idx = {c: i for i, c in enumerate(CLASS_ORDER)}
qual = [r for r in bands[3] if r['officeClass'] and abs(idx[r['officeClass']] - idx[subj['officeClass']]) <= 1]
unq = [r for r in bands[3] if not r['officeClass']]
say(f'  suggested competitive set within 3 km: {len(qual)} qualified by class band '
    f'(+/-1 of {subj["officeClass"]}), {len(unq)} proximity-only (class not recorded), '
    f'{len(bands[3]) - len(qual) - len(unq)} excluded by class')
say('    qualified: ' + ', '.join(sorted(r['name'] for r in qual)))
out['compset_trilliant'] = {'qualified': len(qual), 'proximity_only': len(unq)}

# ── 7. highest known rents (AI-7b) ──────────────────────────────────────────
top3 = sorted([r for r in OBS if r['askingRent'] is not None],
              key=lambda r: -r['askingRent'])[:3]
say('\nAI-7b  three highest known asking rents: ' +
    ', '.join(f'{r["name"]} ({r["askingRent"]})' for r in top3))
out['ai7b_top3'] = [r['name'] for r in top3]

# ── 8. data quality ─────────────────────────────────────────────────────────
say('\ndata quality:')
dup = collections.Counter(r['_meta']['duplicateGroupId'] for r in OBS if r['_meta']['duplicateGroupId'])
say(f'  coordinate-duplicate suspects: {sum(dup.values())} records in {len(dup)} groups')

# exact-coordinate and near-coordinate collisions beyond the source flag
near = []
obs_sorted = sorted(OBS, key=lambda r: (r['lat'], r['lng']))
for i, a in enumerate(obs_sorted):
    for b in obs_sorted[i + 1:]:
        if b['lat'] - a['lat'] > 0.0006:
            break
        d = haversine_m((a['lat'], a['lng']), (b['lat'], b['lng']))
        if d < 30:
            near.append((round(d, 1), a['name'], b['name'],
                         bool(a['_meta']['duplicateGroupId'] and
                              a['_meta']['duplicateGroupId'] == b['_meta']['duplicateGroupId'])))
near.sort()
say(f'  pairs under 30 m apart: {len(near)} '
    f'({sum(1 for n in near if n[3])} already flagged by the source, '
    f'{sum(1 for n in near if not n[3])} NOT flagged)')
for d, a, b, flagged in near:
    say(f'    {d:6.1f} m  {"[flagged]" if flagged else "[UNFLAGGED]"}  {a[:32]:34s} <-> {b[:32]}')
out['near_pairs'] = len(near)

names = collections.Counter(r['name'].strip().lower() for r in OBS)
say('  duplicate names: ' + str([n for n, c in names.items() if c > 1]))

age = days_between(SEED['sources'][0]['retrievedAt'], TODAY)
fast = SEED['refreshDays']['fast']
say(f'  all observed records collected {SEED["sources"][0]["retrievedAt"]} = {age} days ago; '
    f'fast-field refresh interval {fast} d -> '
    f'{"PAST DUE" if age > fast else "due in " + str(fast - age) + " d"}')
out['observed_age_days'] = age

# Completeness over the critical fields.
# Percentage bands (<40 / 40-79 / >=80) do not discriminate on this dataset — every
# observed record holds 0 or 2 of the 8 critical fields, so all 148 collapse into one
# bucket and the indicator teaches a tester nothing. COUNT bands do discriminate, and
# they also read better commercially ("no commercial data" is a statement a CRE analyst
# can act on; "23% complete" is not).
crit = SEED['criticalFields']
def band(n):
    if n == 0: return 'none (0 critical fields)'
    if n <= 2: return 'minimal (1-2)'
    if n <= 5: return 'partial (3-5)'
    return 'good (6-8)'
counts = [sum(1 for f in crit if r.get(f) is not None) for r in OBS]
buckets = collections.Counter(band(c) for c in counts)
say(f'  completeness over the {len(crit)} critical fields {crit}:')
for k in ('good (6-8)', 'partial (3-5)', 'minimal (1-2)', 'none (0 critical fields)'):
    say(f'    {k:26s} {buckets.get(k, 0)}')
say(f'  records missing at least one critical field: '
    f'{sum(1 for c in counts if c < len(crit))} of {len(OBS)}')
say('  same bands over ALL 156 records incl. demo: ' + str(dict(collections.Counter(
    band(sum(1 for f in crit if r.get(f) is not None)) for r in ALL))))
out['completeness_buckets'] = dict(buckets)

# ── 9. demo-set contribution (demo mode ON) ─────────────────────────────────
say('\nwith DEMO records enabled (8 synthetic records), these become non-empty:')
for f in ('gla', 'gba', 'floors', 'occupancyPct', 'vacancyPct', 'parkingSpaces',
          'status', 'yearOpened', 'serviceCharge', 'availableArea'):
    n_all, n_obs = len(known(ALL, f)), len(known(OBS, f))
    say(f'  {f:16s} observed {n_obs:3d}  ->  with demo {n_all:3d}')
gla_demo = known(DEMO, 'gla')
say(f'  total known GLA (demo only) = {sum(gla_demo):,} m2 over {len(gla_demo)} of {len(DEMO)} demo records')
say(f'  demo above 5,000 m2 GLA     = {sum(1 for g in gla_demo if g > 5000)}  '
    f'(makes the ">5,000 m2" AI intent answerable instead of only refusable)')

(MVP / 'data' / 'oracle.json').write_text(
    json.dumps(out, ensure_ascii=False, indent=1), encoding='utf-8')
say(f'\nwrote data/oracle.json')
