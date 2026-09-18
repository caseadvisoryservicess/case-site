# v0.2.4 — test report and fix pack

> Paste this whole file into the build chat together with the current
> `CASE_Leasing_Sales_Project_Control_v0.2.4.html`. Every fix below is a drop-in
> replacement for code that already exists in the file.

---

## 0. Verdict

**The build is good.** 71 automated checks were run in a real browser (Chromium, served over
HTTP and from `file://`). **65 passed, 4 real defects, 0 console errors, 0 page errors.**

What was verified working, so nobody breaks it while fixing the rest:

| Area | Result |
|---|---|
| Data integrity | GLA **17 561.0 m²**, 139 rows / 138 active / 1 zero-area, signed **29.03 %**, vacant **58.89 %** — exact |
| Edit → history | one history entry per changed field, with user and timestamp; no-op edits correctly skipped |
| Cross-section sync | dashboard, units table and pipeline board all re-render from one `store.edit()` |
| Undo | restores the previous value |
| Persistence | edits and history survive reload; corrupted save recovers; empty storage falls back to seed |
| Export | JSON valid, CSV has BOM + semicolons, `toCaseOsBlob()` emits `OBJECTS, U, PLANSVG, PLAN_CODES, PLAN_STRUCT, PLAN_LABELPOS, PLAN_IGNORED_CODES, REFUSALS, CHANGES` |
| i18n | `audit()` ok for uz/ru/en, 0 missing; Russian 3-form plurals correct; no English leaking into RU or UZ |
| Plans | images load, hotspots clickable, zoom/fit present, `sanitizeSvg` strips `<script>` and `onclick`, upload accepts `.svg,.pdf` |
| Accessibility | icon buttons labelled, `aria-live` present, `Esc` closes the drawer, focus enters the drawer and returns to the trigger, `Ctrl+K` palette works |
| Dark mode | toggles; `--muted` on `--surface-2` contrast **6.34:1** |
| Motion | 8 keyframes, `prefers-reduced-motion` honoured, **zero** layout-property transitions |
| Responsive | no horizontal overflow at 375 / 768 / 1280 / 1920 |
| Performance | edit + re-render **< 1 ms** on 139 rows; file **3.91 MB** |
| Integration | `window.CASE.leasing` exposes `version, store, i18n, recognizer, api, toCaseOsBlob, smoke` |
| Normalisations | `block` is a string (`"B1"`), `floorLabel` present, `prospects` are `{id,name}` objects |

Two things I flagged early turned out to be **my test reading too fast**, not bugs — the KPI
count-up animation and the board re-render both settle correctly. Noting it so the numbers
below are not re-litigated.

---

## 1. Defects — 4, with fixes

### F1 · Uzbek numbers use the wrong separator — HIGH

**Symptom.** In Uzbek, the default language, every number is formatted American:

```
UZ   17,561 m²      1,234,567.8      ← wrong
RU   17 561 м²      1 234 567,8      ← correct
```

**Cause.** `fmt()` trusts `toLocaleString('uz-UZ')`. Chromium *reports* `uz-UZ` as supported
(`supportedLocalesOf` returns it, `resolvedOptions().locale` is `uz-UZ`) but its CLDR data
groups with a comma. Verified directly:

```js
(17561).toLocaleString('uz-UZ')   // "17,561"   ← the bug
(17561).toLocaleString('ru-RU')   // "17 561"
```

So this cannot be fixed by changing the locale tag. Format uz and ru explicitly.

**Fix.** Replace `locale()` and `fmt()` inside the `CaseI18n` block:

```js
function locale() { return (LANGS.filter(function (l) { return l.key === lang; })[0] || LANGS[0]).locale; }

/* Uzbek and Russian both group with a space and use a comma decimal.
   Chromium's CLDR gets uz-UZ wrong (it groups with a comma), so those two
   languages are formatted explicitly rather than through toLocaleString. */
var SPACE = ' ';                       // non-breaking: "17 561" never wraps
function groupManual(n, digits) {
  var neg = n < 0; n = Math.abs(n);
  var f = digits > 0 ? n.toFixed(digits) : String(Math.round(n));
  var parts = f.split('.');
  var int = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, SPACE);
  var out = parts[1] ? int + ',' + parts[1].replace(/0+$/, '') : int;
  if (out.slice(-1) === ',') out = out.slice(0, -1);
  return (neg ? '-' : '') + out;
}

/* Unknown is never zero. Pass null/undefined/NaN and you get a dash. */
function fmt(n, digits) {
  if (n == null || n === '' || !isFinite(Number(n))) return '—';
  var d = digits == null ? 1 : digits;
  if (lang === 'uz' || lang === 'ru') return groupManual(Number(n), d);
  return Number(n).toLocaleString(locale(), { maximumFractionDigits: d, minimumFractionDigits: 0 });
}
```

**Verify.**

```js
['uz','ru','en'].forEach(l => { L.setLang(l);
  console.log(l, L.area(17561), '|', L.fmt(1234567.8, 1), '|', L.fmt(0.5, 1), '|', L.area(null)); });
// uz  17 561 m²  | 1 234 567,8 | 0,5 | —
// ru  17 561 м²  | 1 234 567,8 | 0,5 | —
// en  17,561 m²  | 1,234,567.8 | 0.5 | —
```

`money()` stays `en-US` on purpose — the currency is USD and `$3,378` is how the term sheet
reads. Leave it.

`groupManual()` above was checked against `toLocaleString('ru-RU')` on 15 cases — whole
numbers, decimals, negatives, zero, rounding (`0.05 → 0,1`), trailing-zero stripping
(`1000.04 → 1 000`) and millions. **All 15 match exactly**, so Russian output is unchanged by
this fix and Uzbek simply starts behaving like Russian, which is correct for both.

---

### F2 · Clicking a table row does nothing — MEDIUM

**Symptom.** A broker clicks a unit row and nothing opens. Only the small unit-code button
in the first column works. In v0.1 the whole row was clickable, so this is a regression, and
the row already *looks* interactive — `unitRow()` sets `tabIndex:0` and `data-unit-row`, but
no handler was ever attached.

**Fix.** Add to the delegated click handler (the `addEventListener('click', …)` block), and a
keyboard equivalent since the row is already focusable:

```js
/* The whole row opens the unit. Clicks that land on an inline control must NOT
   open the drawer — the broker is editing in place, not navigating. */
document.addEventListener('click', function (ev) {
  if (ev.target.closest('[data-action]')) return;                  // real actions win
  if (ev.target.closest('input,select,textarea,button,a,label')) return;
  var row = ev.target.closest('[data-unit-row]');
  if (row) openUnit(row.getAttribute('data-unit-row'));
});

document.addEventListener('keydown', function (ev) {
  if (ev.key !== 'Enter') return;
  if (ev.target.matches('input,select,textarea')) return;
  var row = ev.target.closest && ev.target.closest('[data-unit-row]');
  if (row) { ev.preventDefault(); openUnit(row.getAttribute('data-unit-row')); }
});
```

Add the affordance so the row looks clickable:

```css
.ls-table tbody tr[data-unit-row]{cursor:pointer}
.ls-table tbody tr[data-unit-row]:hover{background:var(--brand-soft)}
.ls-table tbody tr[data-unit-row] input,
.ls-table tbody tr[data-unit-row] select{cursor:auto}
```

Use whatever `openUnit(id)` is called internally — the same function `data-action="open-unit"`
already calls.

**Verify.** Click the middle of a row → drawer opens. Click the status dropdown in the same
row → drawer does **not** open, the dropdown works. Tab to a row, press Enter → drawer opens.

---

### F3 · Data Quality has no navigation entry — MEDIUM

**Symptom.** `renderQuality()` exists and works, `render()` routes `quality` correctly, but the
sidebar has only six buttons — portfolio, overview, units, plan, board, rejections. The view is
reachable **only** from two buttons on the Dashboard. A P1 feature is effectively hidden, and
deep-linking or restoring the saved view lands the user nowhere.

**Fix.** One line in the static sidebar markup, after the `board` button:

```html
<button class="ls-nav-btn" data-action="nav" data-view="quality"><span class="ls-nav-icon">⚠</span><span data-i18n="dataQuality"></span></button>
```

The `dataQuality` key already exists in all three languages, and `viewLabel()` already maps
`quality`. Nothing else changes.

**Worth adding while you are there** — a count badge, because the number is the point:

```js
/* In renderTop(), after the nav is in the DOM. dataIssues() already exists. */
function refreshQualityBadge(){
  var btn = document.querySelector('[data-action="nav"][data-view="quality"]');
  if (!btn) return;
  var n = dataIssues().length;
  var b = btn.querySelector('.ls-nav-badge');
  if (!n) { if (b) b.remove(); return; }
  if (!b) { b = E('span', { class: 'ls-nav-badge' }); btn.append(b); }
  b.textContent = String(n);
}
```

```css
.ls-nav-badge{margin-left:auto;background:var(--warn);color:#17191d;border-radius:var(--r-full);
  padding:1px 7px;font-size:10px;font-weight:700;font-variant-numeric:tabular-nums}
```

---

### F4 · Offer / LOI slots are missing — MEDIUM (structural)

**Symptom.** Units have no `offers`, `offer` or `dates`; projects have no `kpSeq`.

This is not a visible bug today. It matters because the offer/LOI generator in the live CASE OS
(`CASE_OS_MIGRATION.md` §4b) is the next feature, and it hangs off exactly these four
structures. Adding them now is four keys; adding them after brokers have real data in the tool
is a migration.

**Fix.** Two lines in `normalizeUnit()`, which already runs over every unit on load and migration:

```js
function normalizeUnit(u){
  const x=Object.assign({},u);
  if(!x.code){x.code=String(x.id||'').split('::').pop();}
  if(!x.projectId){x.projectId='creative-avenue';}
  if(String(x.id||'').indexOf('::')<0)x.id=x.projectId+'::'+x.code;
  x.block=String(x.block||''); if(/^\d+$/.test(x.block))x.block='B'+x.block;
  x.floor=(x.floor==null?null:Number(x.floor)); if(x.floor!=null&&!isFinite(x.floor))x.floor=null;
  x.floorLabel=x.floorLabel||(x.floor==null?'':x.floor+' этаж');
  x.prospects=(x.prospects||[]).map(normalizeProspect).filter(p=>p.name);
  x.history=x.history||[]; x.sourceIssues=x.sourceIssues||[];

  /* Offer / LOI slots — reserved for v0.3, deliberately unused and unrendered.
     CASE OS keys these as u.offers[] (one live offer per brand), u.offer (the
     latest, for banners) and u.dates[] (control dates, incl. booking expiry). */
  x.offers = Array.isArray(x.offers) ? x.offers : [];
  x.offer  = x.offer || null;
  x.dates  = Array.isArray(x.dates) ? x.dates : [];
  return x;
}
```

and the project counter, in `migrate()` where projects are built:

```js
const ps=(d.projects||[]).map(p=>{
  const q=Object.assign({},p);
  delete q.units;
  delete q.projectId;                 // a project is not its own child — see F5
  delete q.active;
  q.kpSeq = q.kpSeq || {};            // per-project offer numbering -> CASE OS KPSEQ
  return q;
});
```

Extend `toCaseOsBlob()` so the seam stays honest:

```js
KPSEQ: Object.assign({}, (store.collection('projects')[0]||{}).kpSeq || {}),
```

**Do not render any of this, and do not build an offer form.** The slots exist so v0.3 can
port the generator instead of rebuilding the register around it.

---

### F5 · Project objects carry unit-only keys — LOW

`store.collection('projects')[0]` has `projectId:'creative-avenue'` and `active:true`. A project
is not its own child and has no `active` flag; these leak in from the unit normaliser. Harmless
today, confusing the first time someone filters projects by `active`. The `delete` lines in F4
clear it.

---

## 2. Improvements worth making (not defects)

### I1 · Hotspot coverage is 9 of 139 units

Only `B1 / 1 этаж` has hotspots — 9 of its 12 units. Every other floor has none.

This is **expected**: outlines are drawn by a person, and the coverage banner already says so
honestly. It is an operational task, not a code fix. But it is the difference between a demo
and a tool, so it should be scheduled: one person, the calibration mode already built, ~19
block/floor combinations. Budget half a day and it is done once, forever.

Suggested addition — surface the total, not just the current floor, so the gap stays visible:

```js
/* On the plan view header. Counts every floor, not just the one on screen. */
function planCoverage(){
  const hs = store.get().hotspots || {};
  const mapped = new Set();
  Object.keys(hs).forEach(k => (hs[k]||[]).forEach(h => mapped.add(h.unitId)));
  const total = projectUnits().filter(u => u.active !== false).length;
  return { mapped: mapped.size, total, pct: total ? Math.round(100*mapped.size/total) : 0 };
}
```

### I2 · The 52 rejections are still a single number

`rejectionsCount: 52` is displayed, but the Rejections view cannot yet answer *why* 52 brands
said no — which is the commercially useful question. In CASE OS these are rows in `REFUSALS`.
v0.3 work, not now; just do not model it as a counter when the time comes.

### I3 · Add a persistent smoke assertion

`CASE.leasing.smoke` already exists. Wire the invariant that matters into it so a future edit
cannot silently break the headline number:

```js
/* The status buckets must partition measured GLA. If they stop adding up,
   a status was renamed or a filter dropped rows — say so, do not show a wrong total. */
function assertBalanced(pid){
  const sm = summary(pid);
  const parts = sm.signedGla + sm.vacantGla + sm.signingGla + sm.negotiationGla + sm.proposedGla;
  const other = activeUnits(pid)
    .filter(u => !['Контракт подписан','Вакант','Контракт на подписании','Переговоры','Предложено'].includes(u.status))
    .reduce((a,u) => a + (Number(u.area)||0), 0);
  const diff = Math.abs(parts + other - sm.totalGla);
  return { balanced: diff < 0.5, diff: +diff.toFixed(2), totalGla: +sm.totalGla.toFixed(1) };
}
```

Show a banner when `balanced` is false. Never silently print a total that its own parts
contradict.

---

## 3. Regression checklist after applying F1–F5

Run these in the console and paste the output back:

```js
// F1 — number formatting
['uz','ru','en'].forEach(l=>{L.setLang(l);console.log(l,L.area(17561),'|',L.fmt(1234567.8,1),'|',L.area(null));});
L.setLang('uz');
// expect: uz 17 561 m² | 1 234 567,8 | —      ru 17 561 м² | 1 234 567,8 | —      en 17,561 m² | 1,234,567.8 | —

// F3 — quality reachable from the sidebar
!!document.querySelector('[data-action="nav"][data-view="quality"]');   // true

// F4 — offer slots present and empty
(u=>({offers:Array.isArray(u.offers)&&!u.offers.length,offer:u.offer===null,dates:Array.isArray(u.dates)}))
  (CASE.leasing.store.collection('units')[0]);                          // all true
!!CASE.leasing.store.collection('projects')[0].kpSeq;                   // true

// F5 — project hygiene
Object.keys(CASE.leasing.store.collection('projects')[0]);              // no projectId, no active

// unchanged invariants — these MUST still hold
CASE.leasing.api.getProjectSummary('creative-avenue');                  // totalGla 17561, signedPct ~29.03
CASE.leasing.store.collection('units').length;                          // 139
['uz','ru','en'].map(l=>CASE.leasing.i18n.audit(l).ok);                 // [true,true,true]
```

Manual, two minutes:

1. Click the middle of a units-table row → drawer opens. Click a dropdown in a row → it does
   not. Tab to a row, Enter → opens.
2. Sidebar shows **Maʼlumot sifati / Качество данных / Data quality** with a badge.
3. Switch UZ → RU → EN: every number groups with a space in UZ and RU.
4. Edit a status, reload → it is still there.
5. Dark mode, 375 px width, and `prefers-reduced-motion` — all still clean.

---

## 4. What not to touch

These were verified correct and are easy to break while fixing the above:

- `summary()` / `activeUnits()` / `areaSum()` — the 17 561 figure depends on them.
- `store.edit()` as the single write path — every history entry, autosave and re-render hangs
  off it. No view may write to a unit directly.
- Status keys as Russian strings in the data. They join to `LCR.xlsx`. Translate only on screen.
- `sanitizeSvg()` on every uploaded plan.
- `money()` staying `en-US`.
- The `data-action` delegation pattern — do not reintroduce inline `onclick`.
