#!/usr/bin/env python3
"""
Build the browser version of the Yandex address check: one HTML file a person
opens by double-clicking, pastes the Geocoder key into, and runs. No Python on
their machine, no server, nothing installed.

    python3 tools/geocode_check_page.py                 # -> qa-out/geocode-check.html
    python3 tools/geocode_check_page.py --out path.html

It is the same check as tools/geocode_check.py – same queries, same thresholds,
same verdicts, same output file shape – and the thresholds and city words are
imported from that module rather than retyped, so the two cannot drift apart.
The page embeds the 148 records; the key is typed in, used for the requests
and kept nowhere, not even in the browser's storage.

Why a page and not the script: the person who has the key does not have
Python, and the sandbox that has Python cannot reach Yandex. A browser on a
laptop has both. The Geocoder MAY answer cross-origin requests (unverified
from here) and documents JSONP through `callback`, so the page tries fetch
first, falls back to a script tag only on a network-level failure – never on
an HTTP status, which is an answer and is recorded as such – and writes which
transport worked into the result.
"""
import argparse
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import geocode_check as G  # noqa: E402

ROOT = Path(__file__).resolve().parent.parent
DEFAULT_OUT = ROOT / 'qa-out' / 'geocode-check.html'

TEMPLATE = r'''<!DOCTYPE html>
<html lang="ru">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Проверка адресов – CASE Geo</title>
<style>
  :root { --ink:#1A1714; --cream:#F5F3EF; --red:#B01F22; --line:#E3DFD8; --muted:#6B655D; --ok:#2F7D4F; --warn:#B26A00; }
  * { box-sizing:border-box; }
  body { margin:0; background:var(--cream); color:var(--ink); font:15px/1.45 Inter, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif; }
  .wrap { max-width:1100px; margin:0 auto; padding:24px 16px 48px; }
  h1 { font:400 28px/1.15 "DM Serif Display", Georgia, serif; margin:0 0 4px; }
  .sub { color:var(--muted); margin:0 0 20px; }
  .card { background:#fff; border:1px solid var(--line); border-radius:10px; padding:16px; margin-bottom:16px; }
  label { display:block; font-weight:600; margin-bottom:6px; }
  input[type=text] { width:100%; font:inherit; padding:10px 12px; border:1px solid var(--line); border-radius:8px; }
  .row { display:flex; gap:10px; flex-wrap:wrap; align-items:center; margin-top:12px; }
  button { font:inherit; font-weight:600; padding:10px 16px; border-radius:8px; border:1px solid var(--ink); background:var(--ink); color:#fff; cursor:pointer; }
  button.secondary { background:#fff; color:var(--ink); }
  button.danger { background:var(--red); border-color:var(--red); }
  button:disabled { opacity:.45; cursor:default; }
  .note { color:var(--muted); font-size:13px; margin-top:8px; }
  .bar { height:8px; background:var(--line); border-radius:4px; overflow:hidden; margin-top:12px; }
  .bar > div { height:100%; width:0; background:var(--red); transition:width .15s; }
  #status { margin-top:8px; min-height:1.4em; }
  #status a { color:var(--red); }
  .err { color:var(--red); font-weight:600; }
  .sum { display:flex; gap:8px; flex-wrap:wrap; }
  .chip { border:1px solid var(--line); border-radius:999px; padding:4px 10px; font-size:13px; background:#fff; }
  .chip b { font-variant-numeric:tabular-nums; }
  table { width:100%; border-collapse:collapse; font-size:13px; }
  th, td { text-align:left; padding:6px 8px; border-bottom:1px solid var(--line); vertical-align:top; }
  th { font-weight:600; color:var(--muted); position:sticky; top:0; background:#fff; }
  td.num { text-align:right; font-variant-numeric:tabular-nums; white-space:nowrap; }
  .v { display:inline-block; padding:1px 8px; border-radius:999px; font-size:12px; font-weight:600; border:1px solid var(--line); }
  .v-agree { color:var(--ok); border-color:var(--ok); }
  .v-near, .v-approximate { color:var(--warn); border-color:var(--warn); }
  .v-disagree, .v-error { color:var(--red); border-color:var(--red); }
  .v-suggested { color:#3B5B9A; border-color:#3B5B9A; }
  .v-vague, .v-not_found { color:var(--muted); }
  .hidden { display:none; }
  code { font-family:ui-monospace, Consolas, monospace; font-size:12px; }
</style>
</head>
<body>
<div class="wrap">
  <h1>Проверка адресов бизнес-центров</h1>
  <p class="sub">CASE Geo · Геокодер Яндекса · только просмотр – в базу ничего не записывается</p>

  <div class="card">
    <label for="key">Ключ API Геокодера</label>
    <input id="key" type="text" autocomplete="off" spellcheck="false" placeholder="например 73e320de-…">
    <div class="row">
      <button id="btnTest">1. Проверить ключ – 5 запросов</button>
      <button id="btnRun" class="secondary">2. Полная проверка – <span id="planCount">…</span> запросов</button>
      <button id="btnStop" class="danger hidden">Остановить</button>
    </div>
    <p class="note">Сначала кнопка 1, потом кнопка 2. Ключ используется только для запросов из этого окна и нигде не сохраняется. Лимит бесплатного тарифа – 1&nbsp;000 запросов в сутки.</p>
    <div class="bar"><div id="prog"></div></div>
    <div id="status"></div>
  </div>

  <div class="card hidden" id="resultCard">
    <div class="row" style="margin-top:0">
      <button id="btnJson">Скачать JSON для отправки</button>
      <button id="btnCsv" class="secondary">Скачать CSV</button>
      <span class="note" id="sendNote" style="margin:0">Файл <code>yandex-geocoder-check.json</code> попадёт в папку «Загрузки» – пришлите его в чат.</span>
    </div>
    <div class="sum" id="summary" style="margin-top:12px"></div>
  </div>

  <div class="card hidden" id="tableCard">
    <table>
      <thead><tr><th>Вердикт</th><th>Бизнес-центр</th><th>Адрес в базе</th><th class="num">Расстояние</th><th>Точность</th><th>Что вернул Яндекс</th></tr></thead>
      <tbody id="rows"></tbody>
    </table>
  </div>

  <div class="card">
    <b>Что означают вердикты.</b>
    <span class="v v-agree">agree</span> дом найден в пределах __AGREE__ м от точки в базе – адрес и точка описывают одно здание ·
    <span class="v v-near">near</span> дом в пределах __NEAR__ м – скорее всего тот же квартал, нужен взгляд человека ·
    <span class="v v-disagree">disagree</span> дом дальше – ошибка в адресе или в точке ·
    <span class="v v-approximate">approximate</span> / <span class="v v-vague">vague</span> Яндекс определил адрес лишь приблизительно или до улицы ·
    <span class="v v-not_found">not_found</span> такого адреса в Ташкенте Яндекс не знает ·
    <span class="v v-suggested">suggested</span> у записи нет адреса – Яндекс назвал дом по координатам, это предложение, а не факт ·
    <span class="v v-error">error</span> запрос не удался – текст ошибки в последней колонке.
  </div>
</div>

<script>
var RECORDS = __RECORDS__;
var CFG = __CONFIG__;

var CITY = CFG.cityWords;
function queryFor(r) {
  var addr = (r.address || '').trim();
  if (addr) {
    var bare = addr.toLowerCase().replace(/[^0-9a-zа-яё]+/g, ' ').split(' ')
      .filter(function (w) { return w && CITY.indexOf(w) < 0; }).join(' ').trim();
    if (!bare) return ['skip', 'address is only the city name'];
    return ['forward', addr];
  }
  if (r.lat == null || r.lng == null) return ['skip', 'no address and no coordinates'];
  return ['reverse', r.lng + ',' + r.lat];          /* Yandex takes longitude FIRST */
}

function haversine(aLat, aLng, bLat, bLng) {
  var R = 6371008.8, toR = Math.PI / 180;
  var p1 = aLat * toR, p2 = bLat * toR, dp = (bLat - aLat) * toR, dl = (bLng - aLng) * toR;
  var h = Math.sin(dp / 2) * Math.sin(dp / 2) + Math.cos(p1) * Math.cos(p2) * Math.sin(dl / 2) * Math.sin(dl / 2);
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

function parseResponse(payload) {
  var coll = ((payload || {}).response || {}).GeoObjectCollection || {};
  var found = parseInt(((coll.metaDataProperty || {}).GeocoderResponseMetaData || {}).found || '0', 10) || 0;
  var members = coll.featureMember || [];
  if (!members.length) return { found: found, hit: null };
  var go = members[0].GeoObject || {};
  var pos = ((go.Point || {}).pos || '').split(/\s+/).filter(Boolean);
  var meta = (go.metaDataProperty || {}).GeocoderMetaData || {};
  if (pos.length !== 2) return { found: found, hit: null };
  var lng = parseFloat(pos[0]), lat = parseFloat(pos[1]);
  if (!(lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180)) throw new Error('Point.pos is not "lon lat": ' + pos.join(' '));
  return { found: found, hit: { lat: lat, lng: lng, precision: meta.precision || null, kind: meta.kind || null, text: meta.text || null } };
}

function verdictFor(mode, r, parsed) {
  var hit = parsed.hit;
  if (!hit) return ['not_found', null];
  if (r.lat == null || r.lng == null) throw new Error('record has no coordinates');
  var d = haversine(r.lat, r.lng, hit.lat, hit.lng);
  if (mode === 'reverse') return ['suggested', d];
  var p = hit.precision;
  if (p === 'exact' || p === 'number') {
    if (d <= CFG.agreeM) return ['agree', d];
    if (d <= CFG.nearM) return ['near', d];
    return ['disagree', d];
  }
  if (p === 'near' || p === 'range') return ['approximate', d];
  return ['vague', d];
}

function buildUrl(key, mode, q, callbackName) {
  var p = { apikey: key, geocode: q, format: 'json', lang: 'ru_RU', results: '1', bbox: CFG.bbox, rspn: '1' };
  if (mode === 'reverse') p.kind = 'house';
  if (callbackName) p.callback = callbackName;
  return CFG.endpoint + '?' + Object.keys(p).map(function (k) { return encodeURIComponent(k) + '=' + encodeURIComponent(p[k]); }).join('&');
}

/* Transport. fetch first. An HTTP status is an ANSWER and is recorded as such:
   401/403 stops the run (the key), anything else non-OK becomes an `error`
   item, exactly as the Python tool does. Only a network-level failure – which
   from a file:// page also covers a missing CORS header – falls back to JSONP,
   once, and stays there. */
var transport = 'fetch';
var jsonpN = 0;
function requestJsonp(key, mode, q) {
  return new Promise(function (resolve, reject) {
    var name = '__ygc' + (++jsonpN);
    var s = document.createElement('script');
    var timer = setTimeout(function () { cleanup(); reject(new Error('JSONP timeout')); }, 20000);
    function cleanup() { clearTimeout(timer); delete window[name]; if (s.parentNode) s.parentNode.removeChild(s); }
    window[name] = function (data) { cleanup(); resolve(data); };
    s.onerror = function () { cleanup(); reject(new Error('JSONP script failed to load')); };
    s.src = buildUrl(key, mode, q, name);
    document.head.appendChild(s);
  });
}
function request(key, mode, q) {
  if (transport === 'jsonp') return requestJsonp(key, mode, q);
  return fetch(buildUrl(key, mode, q), { mode: 'cors' }).then(function (res) {
    return res.text().then(function (body) {
      var msg = 'HTTP ' + res.status + ': ' + body.slice(0, 200);
      if (res.status === 401 || res.status === 403) { var e = new Error(msg); e.refused = true; throw e; }
      if (!res.ok) { var e2 = new Error(msg); e2.http = true; throw e2; }
      try { return JSON.parse(body); }
      catch (pe) { var e3 = new Error('HTTP ' + res.status + ': not JSON: ' + body.slice(0, 120)); e3.http = true; throw e3; }
    });
  }).catch(function (e) {
    if (e.refused || e.http) throw e;
    transport = 'jsonp';
    return requestJsonp(key, mode, q);
  });
}

var $ = function (id) { return document.getElementById(id); };
var plan = RECORDS.map(function (r) { var qq = queryFor(r); return { r: r, mode: qq[0], q: qq[1] }; });
var todoAll = plan.filter(function (p) { return p.mode !== 'skip'; });
$('planCount').textContent = todoAll.length;

var stop = false, running = false, lastResult = null;
function setStatus(t, isErr) { $('status').textContent = t; $('status').className = isErr ? 'err' : ''; }
function setStatusHtml(html, isErr) { $('status').innerHTML = html; $('status').className = isErr ? 'err' : ''; }
function redact(s, key) { return key ? String(s).split(key).join('<key>') : String(s); }
function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
function isoSeconds() { return new Date().toISOString().replace(/\.\d{3}Z$/, '+00:00'); }
var FULL_LABEL = '«2. Полная проверка – ' + todoAll.length + ' запросов»';

function run(limit) {
  var key = $('key').value.trim();
  if (!key) { setStatus('Вставьте ключ API Геокодера.', true); return; }
  if (running) return;
  running = true; stop = false; transport = 'fetch';
  var todo = limit ? todoAll.slice(0, limit) : todoAll;
  $('btnTest').disabled = $('btnRun').disabled = true; $('btnStop').classList.remove('hidden');
  $('resultCard').classList.add('hidden'); $('tableCard').classList.add('hidden'); $('rows').innerHTML = ''; $('prog').style.width = '0';
  var out = { sourceId: 'SRC-YANDEX-GEOCODER', storage: 'display', mayPopulateDataset: false,
              startedAt: isoSeconds(), thresholds: { agreeM: CFG.agreeM, nearM: CFG.nearM },
              seedGeneratedAt: CFG.seedGeneratedAt, recordCount: RECORDS.length, keyTest: !!limit,
              requests: 0, items: [],
              skipped: plan.filter(function (p) { return p.mode === 'skip'; }).map(function (p) { return { id: p.r.id, name: p.r.name, reason: p.q }; }),
              producedBy: 'geocode-check.html' };
  var i = 0, firstUrl = null;
  function step() {
    if (stop || i >= todo.length) return finish();
    var p = todo[i]; i++;
    var item = { id: p.r.id, name: p.r.name, mode: p.mode, query: p.q, recordLat: p.r.lat, recordLng: p.r.lng, districtKey: p.r.districtKey || null };
    if (!firstUrl) firstUrl = buildUrl(key, p.mode, p.q);
    setStatus('Запрос ' + i + ' из ' + todo.length + ' – ' + p.r.name);
    $('prog').style.width = Math.round(100 * i / todo.length) + '%';
    return request(key, p.mode, p.q).then(function (payload) {
      out.requests++;
      var parsed = parseResponse(payload);
      var vd = verdictFor(p.mode, p.r, parsed);
      item.found = parsed.found; item.verdict = vd[0]; item.distanceM = vd[1] == null ? null : Math.round(vd[1] * 10) / 10;
      if (parsed.hit) { item.yandexLat = parsed.hit.lat; item.yandexLng = parsed.hit.lng; item.precision = parsed.hit.precision; item.kind = parsed.hit.kind; item.yandexText = parsed.hit.text; }
    }).catch(function (e) {
      item.verdict = 'error'; item.error = redact(e.message, key);
      if (e.refused) {
        stop = true;
        setStatus('Яндекс отклонил ключ (' + redact(e.message, key) + '). Ключ должен быть привязан к продукту «API Геокодера».', true);
      } else if (e.http) {
        /* an answer, not a transport problem: recorded on the item, the run continues */
      } else if (out.requests === 0) {
        /* the very first request never produced an answer. From a file:// page a
           refused key WITHOUT a CORS header looks identical to no network, so
           name both and hand the person a way to see Yandex's real reply. */
        stop = true;
        setStatusHtml('Первый запрос не выполнен – либо Яндекс отклонил ключ (проверьте, что он привязан к продукту «API Геокодера»), либо запрос не дошёл до Яндекса (интернет, прокси). '
          + 'Чтобы увидеть ответ Яндекса, <a id="firstLink" target="_blank" rel="noopener">откройте первый запрос в новой вкладке</a>: ошибка «Invalid api key» означает ключ.', true);
        $('firstLink').href = firstUrl;
      }
    }).then(function () {
      out.items.push(item); addRow(item);
      return sleep(CFG.pauseMs).then(step);
    });
  }
  function finish() {
    if (!(stop && i < todo.length)) $('prog').style.width = '100%';
    out.finishedAt = isoSeconds(); out.transport = transport;
    out.summary = {}; out.items.forEach(function (it) { out.summary[it.verdict] = (out.summary[it.verdict] || 0) + 1; });
    lastResult = out; window.__lastResult = out;
    running = false; $('btnTest').disabled = $('btnRun').disabled = false; $('btnStop').classList.add('hidden');
    if (!stop) {
      setStatus(limit
        ? 'Ключ работает: ' + out.requests + ' запросов прошли. Теперь нажмите ' + FULL_LABEL + '.'
        : 'Готово: ' + out.requests + ' запросов – скачайте JSON и пришлите его в чат.');
    } else if (!/отклонил|не выполнен/.test($('status').textContent)) {
      setStatus('Остановлено после ' + out.requests + ' запросов. Файл неполный; повторный запуск начнёт сначала и снова потратит запросы.');
    }
    renderSummary(out);
    if (out.requests > 0) { $('resultCard').classList.remove('hidden'); $('sendNote').classList.toggle('hidden', !!limit); }
    if (out.items.length) $('tableCard').classList.remove('hidden');
  }
  step();
}

var ORDER = ['disagree', 'near', 'error', 'not_found', 'approximate', 'vague', 'suggested', 'agree'];
function addRow(it) {
  var tr = document.createElement('tr');
  var cells = ['<span class="v v-' + it.verdict + '">' + it.verdict + '</span>', esc(it.name), esc(rec(it.id).address || '–'),
               it.distanceM == null ? '–' : Math.round(it.distanceM) + ' м', esc(it.precision || it.kind || '–'), esc(it.yandexText || it.error || '–')];
  tr.innerHTML = cells.map(function (c, k) { return '<td' + (k === 3 ? ' class="num"' : '') + '>' + c + '</td>'; }).join('');
  $('rows').appendChild(tr);
}
function renderSummary(out) {
  var s = out.summary, html = '';
  ORDER.forEach(function (k) { if (s[k]) html += '<span class="chip"><span class="v v-' + k + '">' + k + '</span> <b>' + s[k] + '</b></span>'; });
  html += '<span class="chip">пропущено (нет улицы в адресе) <b>' + out.skipped.length + '</b></span>';
  html += '<span class="chip">запросов <b>' + out.requests + '</b></span>';
  $('summary').innerHTML = html;
  /* re-render the rows with what needs a person first */
  $('rows').innerHTML = '';
  out.items.slice().sort(function (a, b) {
    var d = ORDER.indexOf(a.verdict) - ORDER.indexOf(b.verdict);
    return d !== 0 ? d : ((b.distanceM || 0) - (a.distanceM || 0));
  }).forEach(addRow);
}
var _byId = {}; RECORDS.forEach(function (r) { _byId[r.id] = r; });
function rec(id) { return _byId[id] || {}; }
function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }

/* A BOM only on the CSV, which Excel on Windows needs for Cyrillic. Never on
   JSON: a JSON writer must not add one, and the Python reader would refuse it. */
function download(name, text, type, bom) {
  var blob = new Blob([(bom ? '\ufeff' : '') + text], { type: type });
  var a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name;
  document.body.appendChild(a); a.click(); setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 500);
}
$('btnJson').onclick = function () {
  if (lastResult) download(lastResult.keyTest ? 'yandex-geocoder-key-test.json' : 'yandex-geocoder-check.json', JSON.stringify(lastResult, null, 2), 'application/json');
};
$('btnCsv').onclick = function () {
  if (!lastResult) return;
  var head = ['id', 'name', 'verdict', 'distanceM', 'precision', 'addressOnFile', 'yandexText'];
  var lines = [head.join(';')].concat(lastResult.items.map(function (it) {
    return [it.id, it.name, it.verdict, it.distanceM == null ? '' : it.distanceM, it.precision || '', rec(it.id).address || '', it.yandexText || it.error || '']
      .map(function (v) { return '"' + String(v).replace(/"/g, '""') + '"'; }).join(';');
  }));
  download(lastResult.keyTest ? 'yandex-geocoder-key-test.csv' : 'yandex-geocoder-check.csv', lines.join('\r\n'), 'text/csv;charset=utf-8', true);
};
$('btnTest').onclick = function () { run(5); };
$('btnRun').onclick = function () { run(0); };
$('btnStop').onclick = function () { stop = true; };
</script>
</body>
</html>
'''


def build(out_path):
    seed = json.loads((ROOT / 'data' / 'seed.json').read_text(encoding='utf-8'))
    records = [dict(id=r['id'], name=r['name'], address=r.get('address'), lat=r['lat'], lng=r['lng'],
                    districtKey=r.get('districtKey'))
               for r in seed['records'] if r.get('recordType') == 'VERIFIED_SOURCE']
    cfg = dict(agreeM=G.AGREE_M, nearM=G.NEAR_M, bbox=G.BBOX, cityWords=list(G.CITY_WORDS),
               endpoint=G.SRC.by_id(G.SOURCE_ID)['endpoint'], pauseMs=int(G.PAUSE_S * 1000),
               seedGeneratedAt=seed.get('generatedAt'))

    def js(obj):
        # `</` inside a <script> would end the element early; JSON never needs it unescaped.
        return json.dumps(obj, ensure_ascii=False).replace('</', '<\\/')

    html = (TEMPLATE.replace('__RECORDS__', js(records)).replace('__CONFIG__', js(cfg))
            .replace('__AGREE__', str(G.AGREE_M)).replace('__NEAR__', str(G.NEAR_M)))
    assert '—' not in html, 'em dash in the page'
    assert chr(0xFEFF) not in html, 'a literal BOM character in the page; write it as an escape'
    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text(html, encoding='utf-8')
    return len(records), out_path


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('--out', default=str(DEFAULT_OUT))
    a = ap.parse_args()
    n, p = build(Path(a.out))
    print('wrote %s (%d records embedded, %d bytes)' % (p, n, p.stat().st_size))


if __name__ == '__main__':
    main()
