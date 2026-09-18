/*! CASE i18n v1.0 — UZ / RU / EN for a single-file tool.
    Handles the three things naive i18n gets wrong in this language set:
      1. Russian has THREE plural forms, not two.
      2. Uzbek Latin needs U+02BB (oʻ, gʻ), not an ASCII apostrophe.
      3. Source data is Russian; labels must translate while KEYS stay Russian.
*/
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.CaseI18n = factory();
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var LANGS = [
    { key: 'uz', label: 'UZ', name: 'Oʻzbekcha', locale: 'uz-UZ' },
    { key: 'ru', label: 'RU', name: 'Русский',   locale: 'ru-RU' },
    { key: 'en', label: 'EN', name: 'English',   locale: 'en-US' }
  ];

  /* Status keys are the Russian strings from the source spreadsheet. They are the
     join key with the LCR and must never be translated in the DATA — only on screen. */
  var STATUS_KEYS = {
    'Вакант': 'st.vacant',
    'Предложено': 'st.proposed',
    'Переговоры': 'st.negotiation',
    'Предложение подписано': 'st.offerSigned',
    'Контракт на подписании': 'st.signing',
    'Контракт подписан': 'st.signed',
    'Резерв': 'st.reserved'
  };

  /* Category names as they appear in the source data. */
  var CATEGORY_KEYS = {
    'Торговля':      { en: 'Retail',           ru: 'Торговля',      uz: 'Savdo' },
    'Офис':          { en: 'Office',           ru: 'Офис',          uz: 'Ofis' },
    'Склад':         { en: 'Storage',          ru: 'Склад',         uz: 'Ombor' },
    'Услуги':        { en: 'Services',         ru: 'Услуги',        uz: 'Xizmatlar' },
    'Киоск':         { en: 'Kiosk',            ru: 'Киоск',         uz: 'Kiosk' },
    'Еда и Напитки': { en: 'Food & Beverage',  ru: 'Еда и напитки', uz: 'Taom va ichimliklar' },
    'Еда и напитки': { en: 'Food & Beverage',  ru: 'Еда и напитки', uz: 'Taom va ichimliklar' }
  };

  /* Russian: [one, few, many]. Uzbek has no plural agreement after a numeral. */
  var PLURALS = {
    unit:    { ru: ['помещение', 'помещения', 'помещений'], uz: ['joy', 'joy', 'joy'],             en: ['unit', 'units', 'units'] },
    day:     { ru: ['день', 'дня', 'дней'],                 uz: ['kun', 'kun', 'kun'],             en: ['day', 'days', 'days'] },
    deal:    { ru: ['сделка', 'сделки', 'сделок'],          uz: ['bitim', 'bitim', 'bitim'],       en: ['deal', 'deals', 'deals'] },
    record:  { ru: ['запись', 'записи', 'записей'],          uz: ['yozuv', 'yozuv', 'yozuv'],       en: ['record', 'records', 'records'] },
    project: { ru: ['проект', 'проекта', 'проектов'],        uz: ['loyiha', 'loyiha', 'loyiha'],    en: ['project', 'projects', 'projects'] },
    change:  { ru: ['изменение', 'изменения', 'изменений'],  uz: ['oʻzgarish', 'oʻzgarish', 'oʻzgarish'], en: ['change', 'changes', 'changes'] }
  };

  function create(dict, initialLang) {
    var lang = initialLang || 'uz';

    function t(key, vars) {
      var e = dict[key];
      var s = e ? (e[lang] || e.en || key) : key;      // honest fallback: English, never a raw key
      if (vars) s = s.replace(/\{(\w+)\}/g, function (_, k) { return vars[k] != null ? vars[k] : '{' + k + '}'; });
      return s;
    }

    /* 1 помещение / 2 помещения / 5 помещений */
    function plural(n, kind) {
      var forms = (PLURALS[kind] || {})[lang] || (PLURALS[kind] || {}).en || [kind, kind, kind];
      n = Math.abs(Math.round(Number(n) || 0));
      if (lang !== 'ru') return n === 1 ? forms[0] : forms[1];
      var d10 = n % 10, d100 = n % 100;
      if (d10 === 1 && d100 !== 11) return forms[0];
      if (d10 >= 2 && d10 <= 4 && (d100 < 12 || d100 > 14)) return forms[1];
      return forms[2];
    }
    function count(n, kind) { return fmt(n, 0) + ' ' + plural(n, kind); }

    function statusLabel(russianKey) {
      var k = STATUS_KEYS[russianKey];
      return k ? t(k) : russianKey;                     // unknown status: show the source value
    }
    function categoryLabel(russianKey) {
      var e = CATEGORY_KEYS[russianKey];
      return e ? (e[lang] || e.en) : (russianKey || '—');
    }

    function locale() { return (LANGS.filter(function (l) { return l.key === lang; })[0] || LANGS[0]).locale; }

    /* Unknown is never zero. Pass null/undefined/NaN and you get a dash. */
    function fmt(n, digits) {
      if (n == null || n === '' || !isFinite(Number(n))) return '—';
      return Number(n).toLocaleString(locale(), {
        maximumFractionDigits: digits == null ? 1 : digits, minimumFractionDigits: 0
      });
    }
    function money(n) {
      if (n == null || n === '' || !isFinite(Number(n))) return '—';
      return '$' + Number(n).toLocaleString('en-US', { maximumFractionDigits: 0 });
    }
    function area(n) { return n == null || !isFinite(Number(n)) ? '—' : fmt(n, 1) + ' ' + sqm(); }
    function sqm() { return lang === 'ru' ? 'м²' : 'm²'; }
    function percent(n, digits) { return n == null || !isFinite(Number(n)) ? '—' : fmt(n, digits == null ? 1 : digits) + '%'; }

    function date(v) {
      if (!v) return '—';
      var d = v instanceof Date ? v : new Date(v);
      if (isNaN(d)) return String(v);
      var p = function (x) { return String(x).padStart(2, '0'); };
      if (lang === 'en') return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
      return p(d.getDate()) + '.' + p(d.getMonth() + 1) + '.' + d.getFullYear();   // RU + UZ
    }
    function dateTime(v) {
      if (!v) return '—';
      var d = new Date(v); if (isNaN(d)) return String(v);
      var p = function (x) { return String(x).padStart(2, '0'); };
      return date(d) + ' ' + p(d.getHours()) + ':' + p(d.getMinutes());
    }

    /* Apply to static markup: data-i18n, data-i18n-title, data-i18n-placeholder,
       data-i18n-aria. textContent only — never innerHTML. */
    function applyStatic(scope) {
      var r = scope || document;
      r.querySelectorAll('[data-i18n]').forEach(function (el) { el.textContent = t(el.getAttribute('data-i18n')); });
      r.querySelectorAll('[data-i18n-title]').forEach(function (el) { el.title = t(el.getAttribute('data-i18n-title')); });
      r.querySelectorAll('[data-i18n-placeholder]').forEach(function (el) { el.placeholder = t(el.getAttribute('data-i18n-placeholder')); });
      r.querySelectorAll('[data-i18n-aria]').forEach(function (el) { el.setAttribute('aria-label', t(el.getAttribute('data-i18n-aria'))); });
      document.documentElement.setAttribute('lang', lang);
    }

    function setLang(l) { if (dictHas(l)) lang = l; return lang; }
    function dictHas(l) { return LANGS.some(function (x) { return x.key === l; }); }
    function getLang() { return lang; }
    function next() {
      var order = LANGS.map(function (l) { return l.key; });
      return order[(order.indexOf(lang) + 1) % order.length];
    }

    /* Words that are genuinely the same in more than one language. Listing them
       keeps the audit honest instead of chasing false positives forever. */
    var SAME_ON_PURPOSE = ['gla', 'broker', 'status', 'nodir', 'kiosk'];

    /* Coverage check — run before shipping. Returns keys that fall back to English. */
    function audit(target) {
      var miss = [], same = [];
      Object.keys(dict).forEach(function (k) {
        var e = dict[k];
        if (!e[target]) { miss.push(k); return; }
        if (target !== 'en' && e[target] === e.en) {
          (SAME_ON_PURPOSE.indexOf(k) >= 0 ? same : miss).push(k);
        }
      });
      return { lang: target, missing: miss, identicalOnPurpose: same, total: Object.keys(dict).length, ok: miss.length === 0 };
    }

    return {
      t: t, plural: plural, count: count,
      statusLabel: statusLabel, categoryLabel: categoryLabel,
      fmt: fmt, money: money, area: area, sqm: sqm, percent: percent,
      date: date, dateTime: dateTime,
      applyStatic: applyStatic, setLang: setLang, getLang: getLang, next: next,
      audit: audit, LANGS: LANGS, STATUS_KEYS: STATUS_KEYS
    };
  }

  return { create: create, LANGS: LANGS, PLURALS: PLURALS, STATUS_KEYS: STATUS_KEYS, CATEGORY_KEYS: CATEGORY_KEYS };
}));
