/* ===========================================================================
 * 00-core — namespace, DOM helpers, formatting, dates, storage
 *
 * Everything hangs off one global, `GEO`. No ES modules: this file runs from
 * file:// where `import` is blocked, so modules are classic scripts that
 * attach to the namespace in manifest order.
 * ========================================================================= */
(function (w) {
  'use strict';

  var GEO = w.GEO = w.GEO || {};

  /* The firm's identity and the product's name are two different things, and the
     header shows both: the CASE wordmark is the firm, `productWord` is what this
     particular tool is called. They are split so the lockup can be typeset as the
     brand sets it — the wordmark in the display serif over the descriptor in
     micro-caps — rather than as one undifferentiated string.

     `name` stays the full "CASE Geo" because it is what every export, CSV header,
     print footer and import validator writes; splitting it would have rewritten all
     of them. 24-selftest asserts name === firm + ' ' + productWord, so the two
     halves cannot drift apart into a header that disagrees with the files it
     produces. */
  GEO.PRODUCT = {
    name: 'CASE Geo',              // WORKING NAME ONLY (§8 — "ZAKY" is not approved).
    firm: 'CASE',                  // Wordmark. Matches the caseadvisory.com lockup.
    firmDescriptor: 'Real Estate Advisory',
    productWord: 'Geo',            // The product half, shown after the lockup rule.
    provisional: true,             // Drives the "WORKING TITLE" chip in the header.
    version: '0.1.0-prototype',
    build: 'dev',
    city: 'Tashkent',
    assetType: 'Business centres'
  };

  GEO.STORAGE_PREFIX = 'geo.mvp.v1.';

  /* ---------------------------------------------------------------- utils */
  var U = GEO.util = {};

  U.isNil = function (v) { return v === null || v === undefined; };

  /** The canonical "is this value known?" test. `0` and `false` are KNOWN values.
   *  Empty string and empty array are not values — they are absences that leaked
   *  in from somewhere, and treating them as known is how "unknown" silently
   *  becomes "zero" (§36). */
  U.isKnown = function (v) {
    if (v === null || v === undefined) return false;
    if (typeof v === 'string') return v.trim() !== '';
    if (Array.isArray(v)) return v.length > 0;
    if (typeof v === 'number') return !isNaN(v);
    return true;
  };

  U.clamp = function (n, lo, hi) { return n < lo ? lo : (n > hi ? hi : n); };

  U.uniq = function (a) { return a.filter(function (v, i) { return a.indexOf(v) === i; }); };

  U.groupBy = function (rows, fn) {
    var out = {};
    rows.forEach(function (r) {
      var k = fn(r);
      (out[k] = out[k] || []).push(r);
    });
    return out;
  };

  U.sortBy = function (rows, fn, dir) {
    var s = rows.slice();
    s.sort(function (a, b) {
      var x = fn(a), y = fn(b);
      if (x === y) return 0;
      if (U.isNil(x)) return 1;          // unknowns always sort last, both directions
      if (U.isNil(y)) return -1;
      return (x < y ? -1 : 1) * (dir === 'desc' ? -1 : 1);
    });
    return s;
  };

  U.debounce = function (fn, ms) {
    var t;
    return function () {
      var self = this, args = arguments;
      clearTimeout(t);
      t = setTimeout(function () { fn.apply(self, args); }, ms);
    };
  };

  U.deepFreeze = function (o) {
    if (o && typeof o === 'object' && !Object.isFrozen(o)) {
      Object.freeze(o);
      Object.keys(o).forEach(function (k) { U.deepFreeze(o[k]); });
    }
    return o;
  };

  U.clone = function (o) {
    return o === undefined ? o : JSON.parse(JSON.stringify(o));
  };

  /* ------------------------------------------------------------ formatting */
  var F = GEO.fmt = {};

  /** The single place a "we don't know" is rendered. Never "—", never "0",
   *  never blank: a dash reads as a typographic choice, this reads as a fact. */
  F.UNKNOWN = 'Not recorded';

  F.num = function (v, dp) {
    if (!U.isKnown(v)) return F.UNKNOWN;
    var n = Number(v);
    // +1e-12 before rounding: 29.799999999999997 must print as 29.80, not 29.79.
    var r = Math.round((n + (n >= 0 ? 1e-12 : -1e-12)) * Math.pow(10, dp || 0)) / Math.pow(10, dp || 0);
    return r.toFixed(dp || 0).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  };

  F.int = function (v) { return F.num(v, 0); };

  F.area = function (v) { return U.isKnown(v) ? F.num(v, 0) + ' m²' : F.UNKNOWN; };

  F.rent = function (v, unit) {
    return U.isKnown(v) ? '$' + F.num(v, 1) + ' /' + (unit || 'm²/month') : F.UNKNOWN;
  };

  F.pct = function (v, dp) {
    return U.isKnown(v) ? F.num(v, U.isNil(dp) ? 0 : dp) + '%' : F.UNKNOWN;
  };

  var MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
                'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  /** `DD MMM YYYY` — the §19 date format. ISO strings only; no Date parsing of
   *  free text, which is locale-dependent and silently wrong. */
  F.date = function (iso) {
    if (!U.isKnown(iso)) return F.UNKNOWN;
    var p = String(iso).slice(0, 10).split('-');
    if (p.length !== 3) return String(iso);
    return Number(p[2]) + ' ' + MONTHS[Number(p[1]) - 1] + ' ' + p[0];
  };

  /** Lowercase a label for mid-sentence use WITHOUT destroying acronyms:
   *  "GLA" must stay "GLA", but "Asking rent" becomes "asking rent". */
  F.lower = function (label) {
    return String(label).split(' ').map(function (word, i) {
      if (word.length > 1 && word === word.toUpperCase() && /[A-Z]/.test(word)) return word;
      return i === 0 ? word.charAt(0).toLowerCase() + word.slice(1) : word.toLowerCase();
    }).join(' ');
  };

  F.plural = function (n, one, many) {
    return n === 1 ? one : (many || one + 's');
  };

  /** The §14/§36 coverage line. This exact wording appears under every metric. */
  F.coverage = function (n, N, fieldLabel) {
    if (!N) return 'No properties in the current selection.';
    if (!n) return 'No properties in the current selection have verified ' + fieldLabel + '.';
    return 'Based on ' + F.int(n) + ' of ' + F.int(N) + ' ' +
           F.plural(N, 'property', 'properties') + ' with verified ' + fieldLabel + '.';
  };

  /* ----------------------------------------------------------------- dates */
  var D = GEO.date = {};

  D.DAY_MS = 86400000;

  D.today = function () {
    var d = new Date();
    return d.getFullYear() + '-' +
           String(d.getMonth() + 1).padStart(2, '0') + '-' +
           String(d.getDate()).padStart(2, '0');
  };

  D.parse = function (iso) {
    var p = String(iso || '').slice(0, 10).split('-');
    if (p.length !== 3) return null;
    var d = Date.UTC(Number(p[0]), Number(p[1]) - 1, Number(p[2]));
    return isNaN(d) ? null : d;
  };

  D.daysBetween = function (a, b) {
    var x = D.parse(a), y = D.parse(b);
    return (x === null || y === null) ? null : Math.round((y - x) / D.DAY_MS);
  };

  D.addDays = function (iso, days) {
    var t = D.parse(iso);
    if (t === null) return null;
    var d = new Date(t + days * D.DAY_MS);
    return d.getUTCFullYear() + '-' +
           String(d.getUTCMonth() + 1).padStart(2, '0') + '-' +
           String(d.getUTCDate()).padStart(2, '0');
  };

  /* ------------------------------------------------------------------- dom */
  var Q = GEO.dom = {};

  Q.$ = function (sel, root) { return (root || document).querySelector(sel); };
  Q.$$ = function (sel, root) {
    return Array.prototype.slice.call((root || document).querySelectorAll(sel));
  };

  /** el('div.card', {attrs}, [children]) — attribute `_html` is the only way to
   *  inject markup, so every other path is escaped by construction (textContent). */
  Q.el = function (spec, attrs, kids) {
    var m = /^([a-z0-9]+)?((?:[.#][\w-]+)*)$/i.exec(spec) || [];
    var node = document.createElement(m[1] || 'div');
    (m[2] || '').split(/(?=[.#])/).forEach(function (t) {
      if (t[0] === '.') node.classList.add(t.slice(1));
      else if (t[0] === '#') node.id = t.slice(1);
    });
    Object.keys(attrs || {}).forEach(function (k) {
      var v = attrs[k];
      if (v === null || v === undefined || v === false) return;
      if (k === '_html') node.innerHTML = v;
      else if (k === 'text') node.textContent = v;
      else if (k.slice(0, 2) === 'on' && typeof v === 'function') {
        node.addEventListener(k.slice(2).toLowerCase(), v);
      } else if (k === 'dataset') {
        Object.keys(v).forEach(function (d) { node.dataset[d] = v[d]; });
      } else if (v === true) node.setAttribute(k, '');
      else node.setAttribute(k, v);
    });
    (Array.isArray(kids) ? kids : (kids ? [kids] : [])).forEach(function (c) {
      if (c === null || c === undefined || c === false) return;
      node.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
    });
    return node;
  };

  Q.clear = function (node) {
    while (node && node.firstChild) node.removeChild(node.firstChild);
    return node;
  };

  Q.fill = function (node, kids) {
    Q.clear(node);
    (Array.isArray(kids) ? kids : [kids]).forEach(function (c) {
      if (c) node.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
    });
    return node;
  };

  Q.on = function (node, evt, sel, fn) {
    if (typeof sel === 'function') { node.addEventListener(evt, sel); return; }
    node.addEventListener(evt, function (e) {
      var t = e.target.closest(sel);
      if (t && node.contains(t)) fn.call(t, e, t);
    });
  };

  /* --------------------------------------------------------------- events */
  var bus = {};
  GEO.on = function (evt, fn) { (bus[evt] = bus[evt] || []).push(fn); return fn; };
  GEO.off = function (evt, fn) {
    bus[evt] = (bus[evt] || []).filter(function (f) { return f !== fn; });
  };
  GEO.emit = function (evt, payload) {
    (bus[evt] || []).slice().forEach(function (f) {
      try { f(payload); }
      catch (err) { GEO.log.error('handler for "' + evt + '" threw', err); }
    });
  };

  /* ------------------------------------------------------------------ log */
  GEO.log = {
    _lines: [],
    _push: function (level, args) {
      var line = { t: new Date().toISOString(), level: level,
                   msg: Array.prototype.slice.call(args).map(String).join(' ') };
      GEO.log._lines.push(line);
      if (GEO.log._lines.length > 500) GEO.log._lines.shift();
      return line;
    },
    info: function () { GEO.log._push('info', arguments); },
    warn: function () { GEO.log._push('warn', arguments); if (w.console) console.warn.apply(console, arguments); },
    error: function () { GEO.log._push('error', arguments); if (w.console) console.error.apply(console, arguments); },
    lines: function () { return GEO.log._lines.slice(); }
  };

  /* -------------------------------------------------------------- storage */
  /* localStorage on file:// is an opaque origin: some browsers throw on access,
     and where it works it is shared by every file:// page on the machine. Probe
     with a real round-trip, and degrade to memory rather than to a white screen. */
  var memory = {};
  var available = (function () {
    try {
      var k = GEO.STORAGE_PREFIX + 'probe';
      w.localStorage.setItem(k, '1');
      var ok = w.localStorage.getItem(k) === '1';
      w.localStorage.removeItem(k);
      return ok;
    } catch (e) { return false; }
  }());

  GEO.storage = {
    available: available,
    reason: available ? null : 'Browser storage is unavailable here (this is normal when opening the file directly in some browsers). Edits will work but will not survive a reload — use Export JSON to keep them.',

    get: function (key, fallback) {
      var raw;
      try {
        raw = available ? w.localStorage.getItem(GEO.STORAGE_PREFIX + key) : memory[key];
      } catch (e) { return fallback; }
      if (raw === null || raw === undefined) return fallback;
      try { return JSON.parse(raw); }
      catch (e) {
        GEO.log.warn('storage: corrupt JSON at', key, '— ignoring');
        return fallback;
      }
    },

    set: function (key, value) {
      var raw = JSON.stringify(value);
      try {
        if (available) w.localStorage.setItem(GEO.STORAGE_PREFIX + key, raw);
        else memory[key] = raw;
        return { ok: true };
      } catch (e) {
        var quota = e && (e.name === 'QuotaExceededError' || e.code === 22 || e.code === 1014);
        GEO.log.error('storage: write failed for', key, e && e.name);
        return { ok: false, quota: quota, error: e };
      }
    },

    remove: function (key) {
      try {
        if (available) w.localStorage.removeItem(GEO.STORAGE_PREFIX + key);
        else delete memory[key];
      } catch (e) { /* nothing useful to do */ }
    },

    keys: function () {
      try {
        if (!available) return Object.keys(memory);
        return Object.keys(w.localStorage)
          .filter(function (k) { return k.indexOf(GEO.STORAGE_PREFIX) === 0; })
          .map(function (k) { return k.slice(GEO.STORAGE_PREFIX.length); });
      } catch (e) { return []; }
    },

    clearAll: function () {
      GEO.storage.keys().forEach(GEO.storage.remove);
      memory = {};
    }
  };
}(window));
