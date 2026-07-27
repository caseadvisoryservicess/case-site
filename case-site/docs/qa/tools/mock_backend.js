/* Мок-бэкенд CASE OS для E2E: эмулирует auth.php, state.php, unit_patch.php, units_batch.php,
   geo_state.php, user_prefs.php, workspace_access.php с управляемыми отказами.
   Управление: POST /__ctl {sessionValid:false} — «сессия истекла» (все api → 401);
               {failMode:'reject-units'} — unit_patch отвечает 403; {failMode:null} — норма.
   Экспортирует createMockServer(osDir) → {srv, base, ctl}. */
'use strict';
const fs = require('fs');
const path = require('path');
const http = require('http');

const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.geojson': 'application/json', '.csv': 'text/csv' };

function createMockServer(OS_DIR, opts) {
  opts = opts || {};
  const state = {
    sessionValid: true,
    failMode: null,
    appState: { data: opts.initialState || {}, revision: 1, updatedAt: '2026-07-24 12:00:00' },
    geo: { data: { datasets: {}, projects: [] }, geo_revision: 1 },
    unitPatches: [],          // все принятые патчи
    statePosts: [],           // все принятые POST state.php (ключи)
    user: { id: 'u-ho', name: 'Hilola Omonullayeva', role: 'HO', role_key: 'HO', role_label: 'Администратор аренды', admin: false, edit: true, leasing: true, finance: true, csrf: 't0k3n' },
    rights: { leasing: 1, finance: 1, edit: 1, approve: 0, plans: 1, admin: 0, own_only: 0, project_scope: 0 },
  };
  const json = (rsp, code, obj) => { rsp.writeHead(code, { 'Content-Type': 'application/json' }); rsp.end(JSON.stringify(obj)); };
  const readBody = req => new Promise(res => { let b = ''; req.on('data', c => b += c); req.on('end', () => { try { res(JSON.parse(b || '{}')); } catch (e) { res({}); } }); });

  const srv = http.createServer(async (req, rsp) => {
    let p = decodeURIComponent(req.url.split('?')[0]);
    if (p === '/__ctl') { const b = await readBody(req); Object.assign(state, b); json(rsp, 200, { ok: true, state: { sessionValid: state.sessionValid, failMode: state.failMode } }); return; }
    if (p === '/__inspect') { json(rsp, 200, { unitPatches: state.unitPatches, statePosts: state.statePosts, appState: state.appState, geo: { geo_revision: state.geo.geo_revision, datasets: Object.keys(state.geo.data.datasets || {}) } }); return; }

    if (p.startsWith('/api/')) {
      const ep = p.slice(5);
      // истёкшая сессия: auth.php отвечает «не авторизован», остальные — 401
      if (!state.sessionValid) {
        if (ep === 'auth.php' && req.method === 'GET') { json(rsp, 200, { auth: false }); return; }
        json(rsp, 401, { error: 'Не авторизован' }); return;
      }
      if (ep === 'auth.php') {
        if (req.method === 'GET') { json(rsp, 200, { auth: true, user: state.user, rights: state.rights, csrf: state.user.csrf, pass_login: true, code_login: false }); return; }
        const b = await readBody(req);
        if (b.action === 'logout') { json(rsp, 200, { ok: true }); return; }
        if (b.action === 'login') { state.sessionValid = true; json(rsp, 200, { ok: true, user: state.user, rights: state.rights, csrf: state.user.csrf }); return; }
        json(rsp, 200, { auth: true, user: state.user, rights: state.rights, csrf: state.user.csrf }); return;
      }
      if (ep === 'workspace_access.php') { json(rsp, 200, { allowed: true, can_edit: true }); return; }
      if (ep === 'user_prefs.php') {
        if (req.method === 'GET') { json(rsp, 200, { data: state.prefs || {} }); return; }
        const b = await readBody(req); state.prefs = b.data || {}; json(rsp, 200, { ok: true }); return;
      }
      if (ep === 'state.php') {
        if (req.method === 'GET') { json(rsp, 200, { data: state.appState.data, revision: state.appState.revision, updated_at: state.appState.updatedAt, updated_by: state.updatedBy || 'mock' }); return; }
        const b = await readBody(req);
        if (state.failMode === 'state-conflict') { json(rsp, 409, { error: 'Данные уже изменены другим пользователем. Обновите страницу и повторите действие.' }); return; }
        const incoming = b.data || {};
        state.statePosts.push(Object.keys(incoming));
        const rejected = [];
        if (state.failMode === 'reject-brands' && incoming.BRANDS) { rejected.push('BRANDS'); delete incoming.BRANDS; }
        Object.assign(state.appState.data, incoming);
        state.appState.revision++;
        json(rsp, 200, Object.assign({ ok: true, revision: state.appState.revision, updated_at: '2026-07-24 12:00:01' }, rejected.length ? { rejected_keys: rejected } : {})); return;
      }
      if (ep === 'unit_patch.php' || ep === 'units_batch.php') {
        const b = await readBody(req);
        if (state.failMode === 'reject-units') { json(rsp, 403, { error: 'Нет прав на изменение реестра' }); return; }
        if (state.failMode === 'units-500') { json(rsp, 500, { error: 'Внутренняя ошибка' }); return; }
        state.unitPatches.push(b);
        /* Настоящий unit_patch.php делает UPDATE app_state — мок обязан вести себя так же,
           иначе тест «данные не доехали до сервера» даёт ложное срабатывание. */
        const NUM = ['area','terr','rate','budget','budLand','factLand','capex','total','gap'];
        const ALLOWED = new Set(['code','block','floor','area','terr','cat','sub','rate','budget','budLand','factLand','capex','total','gap','status','broker','assignedTo','assigned_to','vars','shortlist','merged','offer','comment','comments','dates','hist','leaseModel','vat','utilities','terms','opening','reservationEnd','contractSign','contractEnd','rateReview','fitout','handover','specialTerms','brand','tenant','layoutVersionId','layoutVersionNo','layoutSource','manualOverride','updatedAt','updatedBy']);
        const applyOne = (id, changes) => {
          const arr = state.appState.data && state.appState.data.U;
          if (!Array.isArray(arr)) return;
          const u = arr.find(x => x && x.id === id);
          if (!u || !changes) return;
          Object.keys(changes).forEach(k => {
            if (!ALLOWED.has(k)) return;
            u[k] = NUM.indexOf(k) >= 0 ? (changes[k] === '' || changes[k] == null ? 0 : Number(changes[k])) : changes[k];
          });
        };
        if (ep === 'unit_patch.php') applyOne(b.id, b.changes || b.patch || b.fields);
        else (Array.isArray(b.units) ? b.units : []).forEach(x => applyOne(x.id, x.changes || x));
        state.appState.updatedAt = '2026-07-27 12:00:00';
        json(rsp, 200, { ok: true, applied: true, revision: ++state.appState.revision, updated: [] }); return;
      }
      if (ep === 'geo_state.php') {
        if (req.method === 'GET') { json(rsp, 200, { data: state.geo.data, geo_revision: state.geo.geo_revision, app_revision: state.appState.revision, updated_at: null }); return; }
        const b = await readBody(req);
        if (state.failMode === 'geo-403') { json(rsp, 403, { error: 'Нет доступа к геоаналитике' }); return; }
        if (state.failMode === 'geo-conflict') { json(rsp, 409, { error: 'Геоданные изменены другим пользователем' }); return; }
        state.geo.data = b.data || state.geo.data; state.geo.geo_revision++;
        json(rsp, 200, { ok: true, geo_revision: state.geo.geo_revision, updated_at: '2026-07-24 12:00:02', updated_by: state.user.name }); return;
      }
      if (ep === 'data.php') {
        if (req.method === 'GET') { json(rsp, 200, { rows: [] }); return; }
        json(rsp, 200, { ok: true }); return;
      }
      if (ep === 'geo_master.php') { json(rsp, 404, { error: 'no master' }); return; }
      json(rsp, 200, { ok: true }); return;
    }

    if (p === '/') p = '/index.html';
    const f = path.join(OS_DIR, p);
    if (!f.startsWith(OS_DIR) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { rsp.writeHead(404); rsp.end('404'); return; }
    rsp.writeHead(200, { 'Content-Type': MIME[path.extname(f)] || 'application/octet-stream' });
    fs.createReadStream(f).pipe(rsp);
  });
  return new Promise(res => srv.listen(0, '127.0.0.1', () => res({ srv, base: 'http://127.0.0.1:' + srv.address().port, state })));
}
module.exports = { createMockServer };
