/*! CASE State Store v1.0 — editable state, autosave, undo, and cross-section sync
    for a single-file HTML tool. No dependencies. No network.

    Solves three things a prototype normally gets wrong:
      1. Edits are lost on reload.              -> debounced autosave + a backup slot
      2. One screen updates, the others stale.  -> one store, one event bus, all views subscribe
      3. A corrupt save bricks the tool.        -> validated load, backup restore, never silent wipe

    Usage:
      var store = CaseStore.create({ key:'case_ls', version:2, initial: SEED, migrate: fn });
      store.on('unit:changed', renderEverything);
      store.edit('unit', 'B1_001', { status:'Переговоры' }, { by:'Нодир' });
      store.undo();
*/
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.CaseStore = factory();
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var SAVE_DEBOUNCE = 400;      // ms after the last keystroke
  var UNDO_DEPTH = 50;

  function clone(o) { return JSON.parse(JSON.stringify(o)); }
  function nowISO() { return new Date().toISOString(); }
  function safeParse(s) { try { return JSON.parse(s); } catch (e) { return null; } }

  function create(cfg) {
    var KEY = cfg.key || 'case_store';
    var K_MAIN = KEY + '_v' + (cfg.version || 1);
    var K_BACKUP = KEY + '_backup_v' + (cfg.version || 1);
    var K_UI = KEY + '_ui';

    var listeners = {};          // event -> [fn]
    var undoStack = [], redoStack = [];
    var saveTimer = null, saveState = 'idle';
    var state = null, ui = null;

    /* ---------------- persistence ---------------- */
    function ls(fn, fallback) { try { return fn(); } catch (e) { return fallback; } }

    function load() {
      var raw = ls(function () { return localStorage.getItem(K_MAIN); }, null);
      var parsed = raw ? safeParse(raw) : null;

      if (raw && !parsed) {                       // corrupt, not empty
        emit('store:corrupt', { raw: raw.length });
        var bk = safeParse(ls(function () { return localStorage.getItem(K_BACKUP); }, null));
        if (bk && bk.data) { state = bk.data; emit('store:restored', { from: 'backup' }); return; }
        state = clone(cfg.initial);               // never delete the bad copy — the user decides
        emit('store:seeded', { reason: 'corrupt and no backup' });
        return;
      }
      if (!parsed) {
        /* Nothing here yet — look for an older version to migrate. */
        var legacy = null, v;
        for (v = (cfg.version || 1) - 1; v >= 1; v--) {
          legacy = safeParse(ls(function () { return localStorage.getItem(KEY + '_v' + v); }, null));
          if (legacy) break;
        }
        if (legacy && typeof cfg.migrate === 'function') {
          state = cfg.migrate(legacy.data || legacy, v);
          emit('store:migrated', { from: v, to: cfg.version });
          save(true);
          return;
        }
        state = clone(cfg.initial);
        emit('store:seeded', { reason: 'first run' });
        return;
      }
      state = parsed.data || parsed;
    }

    function save(immediate) {
      clearTimeout(saveTimer);
      setSaveState('pending');
      var run = function () {
        var payload = JSON.stringify({ version: cfg.version || 1, savedAt: nowISO(), data: state });
        var ok = ls(function () {
          var prev = localStorage.getItem(K_MAIN);
          if (prev) localStorage.setItem(K_BACKUP, prev);      // previous good copy
          localStorage.setItem(K_MAIN, payload);
          return true;
        }, false);
        if (!ok) { setSaveState('error'); emit('store:saveFailed', { bytes: payload.length }); return; }
        setSaveState('saved');
        emit('store:saved', { bytes: payload.length, at: nowISO() });
      };
      if (immediate) run(); else saveTimer = setTimeout(run, SAVE_DEBOUNCE);
    }

    function setSaveState(s) { saveState = s; emit('store:saveState', s); }

    /* ---------------- events ---------------- */
    function on(ev, fn) { (listeners[ev] = listeners[ev] || []).push(fn); return function () { off(ev, fn); }; }
    function off(ev, fn) { listeners[ev] = (listeners[ev] || []).filter(function (f) { return f !== fn; }); }
    function emit(ev, payload) {
      (listeners[ev] || []).forEach(function (f) { try { f(payload, ev); } catch (e) { console.error('[store] listener', ev, e); } });
      if (ev !== '*') (listeners['*'] || []).forEach(function (f) { try { f(payload, ev); } catch (e) {} });
    }

    /* ---------------- reading ---------------- */
    function get(path) {                       // get('units') / get('units.B1_001')
      if (!path) return state;
      return path.split('.').reduce(function (o, k) { return o == null ? o : o[k]; }, state);
    }
    function collection(name) { return (state[name] || []); }
    function find(name, id, idKey) {
      var k = idKey || 'id';
      return collection(name).filter(function (r) { return String(r[k]) === String(id); })[0] || null;
    }

    /* ---------------- writing ---------------- */
    /* One entry point for every change, so history, autosave and sync can
       never be forgotten by a caller. */
    function edit(collectionName, id, changes, meta) {
      var row = find(collectionName, id);
      if (!row) return { ok: false, reason: 'not found: ' + collectionName + '/' + id };

      var before = {}, after = {}, touched = [];
      Object.keys(changes).forEach(function (k) {
        var oldV = row[k], newV = changes[k];
        if (JSON.stringify(oldV) === JSON.stringify(newV)) return;   // no-op, no history noise
        before[k] = oldV; after[k] = newV; touched.push(k);
      });
      if (!touched.length) return { ok: true, noop: true };

      pushUndo({ collection: collectionName, id: id, before: before });

      touched.forEach(function (k) { row[k] = changes[k]; });
      row.updatedAt = nowISO();
      row.updatedBy = (meta && meta.by) || row.updatedBy || 'unknown';

      row.history = row.history || [];
      touched.forEach(function (k) {
        row.history.push({ at: row.updatedAt, by: row.updatedBy, field: k, from: before[k], to: after[k] });
      });

      save();
      /* One change, three notifications — anything listening stays in step. */
      emit(collectionName + ':changed', { id: id, fields: touched, before: before, after: after, row: row });
      emit('data:changed', { collection: collectionName, id: id, fields: touched });
      touched.forEach(function (k) { emit(collectionName + ':' + k, { id: id, from: before[k], to: after[k], row: row }); });
      return { ok: true, fields: touched };
    }

    function add(collectionName, row) {
      state[collectionName] = state[collectionName] || [];
      row.createdAt = nowISO();
      state[collectionName].push(row);
      pushUndo({ collection: collectionName, id: row.id, created: true });
      save();
      emit(collectionName + ':added', { row: row });
      emit('data:changed', { collection: collectionName, id: row.id, fields: ['*'] });
      return row;
    }

    function setMeta(path, value) {              // non-collection settings, e.g. 'ui.theme'
      var parts = path.split('.'), last = parts.pop();
      var t = parts.reduce(function (o, k) { return (o[k] = o[k] || {}); }, state);
      var old = t[last]; if (JSON.stringify(old) === JSON.stringify(value)) return;
      t[last] = value; save();
      emit('meta:changed', { path: path, from: old, to: value });
      emit('data:changed', { collection: 'meta', id: path, fields: [last] });
    }

    /* ---------------- undo / redo ---------------- */
    function pushUndo(entry) {
      undoStack.push(entry); if (undoStack.length > UNDO_DEPTH) undoStack.shift();
      redoStack.length = 0; emit('undo:depth', { undo: undoStack.length, redo: 0 });
    }
    function undo() {
      var e = undoStack.pop(); if (!e) return false;
      var row = find(e.collection, e.id);
      if (e.created) {
        state[e.collection] = collection(e.collection).filter(function (r) { return String(r.id) !== String(e.id); });
      } else if (row) {
        var redoBefore = {};
        Object.keys(e.before).forEach(function (k) { redoBefore[k] = row[k]; row[k] = e.before[k]; });
        redoStack.push({ collection: e.collection, id: e.id, before: redoBefore });
        if (row.history) row.history.push({ at: nowISO(), by: 'undo', field: Object.keys(e.before).join(','), from: '(undo)', to: '(restored)' });
      }
      save();
      emit(e.collection + ':changed', { id: e.id, fields: Object.keys(e.before || {}), undo: true });
      emit('data:changed', { collection: e.collection, id: e.id, fields: ['*'] });
      emit('undo:depth', { undo: undoStack.length, redo: redoStack.length });
      return true;
    }

    /* ---------------- export / import ---------------- */
    function exportJson() {
      return JSON.stringify({ app: KEY, version: cfg.version || 1, exportedAt: nowISO(), data: state }, null, 2);
    }
    function importJson(text, opts) {
      var p = safeParse(text);
      if (!p || !p.data) return { ok: false, reason: 'not a valid export file' };
      if (p.app && p.app !== KEY) return { ok: false, reason: 'this file belongs to another tool: ' + p.app };
      if (!opts || !opts.confirmed) {
        return { ok: false, needsConfirm: true, preview: summarize(p.data) };   // never replace without a look
      }
      ls(function () { localStorage.setItem(K_BACKUP, localStorage.getItem(K_MAIN) || ''); }, null);
      state = p.data; save(true);
      emit('store:imported', summarize(state));
      emit('data:changed', { collection: '*', id: null, fields: ['*'] });
      return { ok: true };
    }
    function summarize(d) {
      var out = {};
      Object.keys(d || {}).forEach(function (k) { if (Array.isArray(d[k])) out[k] = d[k].length; });
      return out;
    }

    /* CSV for Excel in a RU/UZ locale: UTF-8 BOM + semicolons, or Excel merges the columns. */
    function toCsv(rows, columns) {
      var head = columns.map(function (c) { return c.label; }).join(';');
      var body = rows.map(function (r) {
        return columns.map(function (c) {
          var v = typeof c.get === 'function' ? c.get(r) : r[c.key];
          if (v == null || v === '') return '';
          v = String(v);
          return /[";\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v;
        }).join(';');
      }).join('\r\n');
      return '﻿' + head + '\r\n' + body;
    }
    function download(filename, text, mime) {
      var b = new Blob([text], { type: mime || 'text/plain;charset=utf-8' });
      var a = document.createElement('a');
      a.href = URL.createObjectURL(b); a.download = filename;
      document.body.appendChild(a); a.click();
      setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 0);
    }

    /* ---------------- UI prefs, kept apart from the data ---------------- */
    function uiGet(k, dflt) { ui = ui || safeParse(ls(function () { return localStorage.getItem(K_UI); }, null)) || {}; return k in ui ? ui[k] : dflt; }
    function uiSet(k, v) { ui = ui || {}; ui[k] = v; ls(function () { localStorage.setItem(K_UI, JSON.stringify(ui)); }, null); emit('ui:changed', { key: k, value: v }); }

    /* ---------------- boot ---------------- */
    load();
    /* A second tab editing the same tool stays in step. */
    if (typeof window !== 'undefined') {
      window.addEventListener('storage', function (e) {
        if (e.key !== K_MAIN || !e.newValue) return;
        var p = safeParse(e.newValue); if (!p) return;
        state = p.data || p;
        emit('store:externalChange', { at: p.savedAt });
        emit('data:changed', { collection: '*', id: null, fields: ['*'] });
      });
      /* Never lose the last keystroke to a closing tab. */
      window.addEventListener('beforeunload', function () { if (saveState === 'pending') save(true); });
    }

    return {
      on: on, off: off, emit: emit,
      get: get, collection: collection, find: find,
      edit: edit, add: add, setMeta: setMeta,
      undo: undo, canUndo: function () { return undoStack.length > 0; },
      save: function () { save(true); }, saveState: function () { return saveState; },
      exportJson: exportJson, importJson: importJson, toCsv: toCsv, download: download,
      uiGet: uiGet, uiSet: uiSet,
      reset: function () { state = clone(cfg.initial); save(true); emit('data:changed', { collection: '*', id: null, fields: ['*'] }); },
      _keys: { main: K_MAIN, backup: K_BACKUP, ui: K_UI }
    };
  }

  return { create: create, SAVE_DEBOUNCE: SAVE_DEBOUNCE };
}));
