/* CASE OS v4.71.0 - происхождение числа: откуда взято, кто проверил, когда и насколько надёжно.
 *
 * ── Зачем это вообще
 *
 * Разбор четырёх конкурирующих платформ (Aino, Placer, Geointellect, портал ДШК) дал один
 * общий вывод: данные у всех примерно одинаковые, и ни у кого нет ответа на вопрос «откуда
 * это число». У Aino в наборах данных нет даже поля автора. Отсюда следует, где у CASE
 * защитимая позиция: не в картах и не в количестве слоёв, а в трёх вещах - подтверждённая
 * ставка (сделка, а не запрос), подтверждённая вакансия (счёт по помещениям, а не по
 * объявлениям) и аудит с методикой. Все три держатся на одном: у каждого числа должно быть
 * происхождение, и оно должно быть видно, а не лежать в примечании.
 *
 * ── Главное правило: уверенности не смешиваются
 *
 * Средняя ставка по объекту, где три помещения подтверждены звонком, а семь взяты из
 * объявления, НЕ является подтверждённой. Соблазн показать её как подтверждённую велик:
 * так отчёт выглядит увереннее. Поэтому сводное число всегда получает САМУЮ СЛАБУЮ
 * уверенность из входящих и показывает состав. Это единственное правило в файле, которое
 * нельзя ослабить ради красоты отчёта: именно на нём держится защита от обвинения в
 * конфликте интересов, когда CASE и консультирует, и оценивает.
 *
 * ── Почему устаревание видно всегда
 *
 * Ставка, подтверждённая полтора года назад, формально подтверждена. Практически это
 * цифра из другого рынка. Поэтому: 90 дней - жёлтый, 180 - красный, и скрыть это нельзя.
 * Продукт, который прячет возраст данных, выглядит лучше ровно до первой встречи, где
 * клиент назовёт настоящую цифру.
 *
 * ── Почему различие не только цветом
 *
 * Три цепочки различаются значком, рамкой и словом, а не только цветом. Материалы CASE
 * уходят клиенту в PDF и печатаются, часто чёрно-белыми; различие, существующее только в
 * цвете, в печати исчезает. Плюс дальтонизм: жёлтый и зелёный - самая частая пара, которую
 * не различают.
 *
 * ── Где живут данные
 *
 * В общем состоянии, ключ PROV, а не в отдельной таблице. Причина фактическая: таблицы
 * objects и units в схеме есть, но НИ ОДИН запрос платформы к ним не обращается - вся
 * работа идёт с JSON-документом app_state. Новая таблица повторила бы ту же ошибку и
 * осталась бы пустой. Когда данных станет столько, что понадобятся запросы, проекция в
 * таблицу делается отдельно и с одним источником истины.
 */
(function () {
  'use strict';
  if (window.CASE_PROV) return;

  var VERSION = '4.71.0';

  /* Значения уверенности. Порядок в массиве и есть порядок силы: слева слабее. Сводное
     число берёт минимум по этому порядку, поэтому список нельзя переставлять произвольно. */
  var ORDER = ['modelled', 'asking', 'verified'];

  var KIND = {
    verified: {
      key: 'verified', ru: 'Подтверждено', short: 'подтв.', mark: '✓',
      hint: 'Проверено сотрудником: звонок, выезд, документ или реестр. Указано кем и когда.'
    },
    asking: {
      key: 'asking', ru: 'Запрашиваемое', short: 'запрос', mark: '≈',
      hint: 'Заявленная величина: объявление, слова собственника или брокера. Сделкой не подтверждена.'
    },
    modelled: {
      key: 'modelled', ru: 'Расчёт', short: 'расчёт', mark: 'ƒ',
      hint: 'Получено вычислением из других величин. Это оценка, а не наблюдение.'
    }
  };

  /* Откуда пришло значение. Список закрытый: свободный текст здесь означал бы, что через
     полгода «собственник», «Собственник» и «от собственника» станут тремя разными
     источниками, и посчитать долю подтверждённых данных будет невозможно. */
  var SOURCE = {
    landlord:  'Собственник',
    broker:    'Брокер',
    tenant:    'Арендатор',
    deal:      'Закрытая сделка',
    listing:   'Объявление',
    field:     'Выезд на объект',
    registry:  'Государственный реестр',
    document:  'Документ',
    osm:       'OpenStreetMap',
    calculated:'Расчёт платформы',
    other:     'Иное'
  };

  /* Способ проверки. Нужен не для отчётности, а для веса: «звонок брокеру» и «договор на
     руках» - разные основания, и через год разницу не вспомнит никто. */
  var METHOD = {
    call:     'Звонок',
    visit:    'Выезд',
    document: 'Документ',
    registry: 'Реестр',
    deal:     'Сделка'
  };

  var AMBER_DAYS = 90;
  var RED_DAYS = 180;

  /* ── Хранилище ───────────────────────────────────────────────────────────── */

  /* PROV объявлен в ядре и попадает в общее состояние. Обращаемся через window, потому что
     модуль подключается с defer и на момент разбора файла переменной может ещё не быть. */
  function store() {
    if (!window.PROV || typeof window.PROV !== 'object' || Array.isArray(window.PROV)) window.PROV = {};
    return window.PROV;
  }

  function key(entity, id, field) {
    return String(entity || '') + ':' + String(id || '') + ':' + String(field || '');
  }

  function get(entity, id, field) {
    var r = store()[key(entity, id, field)];
    return (r && typeof r === 'object') ? r : null;
  }

  function today() { return new Date().toISOString().slice(0, 10); }

  /* Запись намеренно короткая по именам полей. Она едет в общем JSON-документе, который
     сохраняется целиком при каждой правке; на реестре в тысячу помещений разница между
     'confidence' и 'conf' - это десятки килобайт в каждом сохранении. */
  function make(o) {
    o = o || {};
    var conf = KIND[o.conf] ? o.conf : 'asking';
    return {
      conf: conf,
      src: SOURCE[o.src] ? o.src : 'other',
      name: String(o.name || '').slice(0, 160),   // конкретный источник: кто именно сказал
      at: String(o.at || today()).slice(0, 10),   // дата наблюдения или проверки
      by: String(o.by || '').slice(0, 80),        // кто зафиксировал
      how: METHOD[o.how] ? o.how : '',            // способ проверки, только для verified
      basis: String(o.basis || '').slice(0, 120), // ключ родительской записи для расчётных величин
      note: String(o.note || '').slice(0, 400)
    };
  }

  function set(entity, id, field, rec) {
    var k = key(entity, id, field);
    store()[k] = make(rec);
    push(k, store()[k]);
    return store()[k];
  }

  function drop(entity, id, field) {
    var k = key(entity, id, field);
    try { delete store()[k]; } catch (e) {}
    push(k, null);
  }

  /* Подтверждение - отдельное действие, а не правка полей записи. Сотрудник не должен
     иметь возможности поставить «подтверждено» задним числом или от чужого имени: дату и
     имя ставит платформа. */
  function confirm(entity, id, field, how, sourceName, src) {
    var cur = get(entity, id, field) || {};
    var who = '';
    try { who = (typeof S !== 'undefined' && S && S.user && (S.user.name || S.user.role)) || ''; } catch (e) {}
    return set(entity, id, field, {
      conf: 'verified',
      src: SOURCE[src] ? src : (cur.src || 'landlord'),
      name: sourceName != null ? sourceName : (cur.name || ''),
      at: today(),
      by: who,
      how: METHOD[how] ? how : 'call',
      basis: cur.basis || '',
      note: cur.note || ''
    });
  }

  /* На сервер уходит ОДИН изменённый ключ, а не вся карта. Причина та же, по которой в
     платформе появились unit_patch.php и units_batch.php: общее состояние сохраняется
     целиком, поэтому два сотрудника, подтвердившие разные ставки в одну минуту, затирали
     бы правки друг друга - и заметил бы это не тот, кто затёр. */
  /* Глобалы ядра (BACKEND, apiPOST, persist, S, U) объявлены через let/const и свойствами
     window не являются; обращаемся к ним голыми именами под typeof, как и другие модули. */
  function push(k, rec) {
    try { if (typeof persist === 'function') persist(); } catch (e) {}
    try {
      if (typeof BACKEND !== 'undefined' && BACKEND && typeof apiPOST === 'function') {
        apiPOST('provenance.php', { key: k, rec: rec }).catch(function () {});
      }
    } catch (e) {}
  }

  /* ── Возраст и состояние ─────────────────────────────────────────────────── */

  function daysSince(iso) {
    if (!iso) return null;
    var t = Date.parse(String(iso).slice(0, 10) + 'T00:00:00Z');
    if (isNaN(t)) return null;
    var now = Date.parse(new Date().toISOString().slice(0, 10) + 'T00:00:00Z');
    return Math.floor((now - t) / 86400000);
  }

  /* Граница включающая: ровно 90 дней - уже жёлтый. Иначе «90 дней» в правиле и «90 дней»
     на экране означали бы разное, и спор о том, устарела ли цифра, был бы про off-by-one. */
  function staleOf(days) {
    if (days == null) return 'unknown';
    if (days >= RED_DAYS) return 'red';
    if (days >= AMBER_DAYS) return 'amber';
    return 'fresh';
  }

  function state(rec) {
    if (!rec) return { conf: null, stale: 'none', days: null, kind: null };
    var d = daysSince(rec.at);
    return { conf: rec.conf, kind: KIND[rec.conf] || KIND.asking, stale: staleOf(d), days: d };
  }

  /* ── Сводные величины ────────────────────────────────────────────────────── */

  /* Самая слабая уверенность из набора. Отсутствие записи слабее любой записи: число без
     происхождения - это не «расчёт», это неизвестно что. */
  function weakest(recs) {
    var w = null, seenMissing = false;
    (recs || []).forEach(function (r) {
      if (!r || !r.conf) { seenMissing = true; return; }
      if (w === null || ORDER.indexOf(r.conf) < ORDER.indexOf(w)) w = r.conf;
    });
    return seenMissing ? null : w;
  }

  /* Состав набора и его итоговая уверенность. Возвращает и сам состав: показать «частично
     подтверждено» без цифр означало бы заменить одну непрозрачность другой. */
  function aggregate(recs) {
    recs = recs || [];
    var mix = { verified: 0, asking: 0, modelled: 0, none: 0 };
    var oldest = null;
    recs.forEach(function (r) {
      if (!r || !r.conf) { mix.none++; return; }
      if (mix[r.conf] == null) mix[r.conf] = 0;
      mix[r.conf]++;
      var d = daysSince(r.at);
      if (d != null && (oldest === null || d > oldest)) oldest = d;
    });
    return {
      conf: weakest(recs),
      mix: mix,
      total: recs.length,
      /* Возраст сводной величины определяет САМАЯ СТАРАЯ запись, а не средний возраст:
         среднее замаскировало бы одну полуторагодовалую цифру девятью свежими. */
      days: oldest,
      stale: staleOf(oldest),
      blended: (mix.verified > 0 ? 1 : 0) + (mix.asking > 0 ? 1 : 0) + (mix.modelled > 0 ? 1 : 0) + (mix.none > 0 ? 1 : 0) > 1
    };
  }

  /* ── Отрисовка ───────────────────────────────────────────────────────────── */

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function dateRU(iso) {
    if (!iso) return '';
    var p = String(iso).slice(0, 10).split('-');
    return p.length === 3 ? p[2] + '.' + p[1] + '.' + p[0] : String(iso);
  }

  function ageWord(days) {
    if (days == null) return '';
    if (days === 0) return 'сегодня';
    if (days === 1) return 'вчера';
    if (days < 30) return days + ' дн. назад';
    var m = Math.floor(days / 30);
    if (m < 12) return m + ' мес. назад';
    return Math.floor(days / 365) + ' г. назад';
  }

  /* Подсказка при наведении: полная цепочка. Она нужна не «для красоты» - именно её
     сотрудник читает вслух, когда клиент спрашивает, откуда цифра. */
  function title(rec) {
    if (!rec) return 'Происхождение не указано. Число ни на что не опирается.';
    var k = KIND[rec.conf] || KIND.asking;
    var out = [k.ru + ': ' + k.hint];
    if (rec.name) out.push('Источник: ' + (SOURCE[rec.src] || rec.src) + ', ' + rec.name);
    else out.push('Источник: ' + (SOURCE[rec.src] || rec.src));
    if (rec.conf === 'verified' && rec.how) out.push('Способ проверки: ' + (METHOD[rec.how] || rec.how));
    if (rec.by) out.push('Зафиксировал: ' + rec.by);
    if (rec.at) {
      var d = daysSince(rec.at);
      out.push('Дата: ' + dateRU(rec.at) + (d != null ? ' (' + ageWord(d) + ')' : ''));
      if (staleOf(d) === 'amber') out.push('Старше ' + AMBER_DAYS + ' дней: требует обновления.');
      if (staleOf(d) === 'red') out.push('Старше ' + RED_DAYS + ' дней: считать неактуальным.');
    }
    if (rec.basis) out.push('Рассчитано из: ' + rec.basis);
    if (rec.note) out.push(rec.note);
    return out.join('\n');
  }

  function chipFor(rec, opts) {
    opts = opts || {};
    var st = state(rec);
    if (!rec) {
      return '<span class="prov prov-none" title="' + esc(title(null)) + '">'
           + '<i>?</i>' + (opts.compact ? '' : '<span>нет источника</span>') + '</span>';
    }
    var k = st.kind;
    var cls = 'prov prov-' + k.key + (st.stale === 'amber' ? ' prov-old' : (st.stale === 'red' ? ' prov-dead' : ''));
    var word = opts.compact ? '' : '<span>' + esc(k.short)
      + (st.stale !== 'fresh' && st.days != null ? ' · ' + esc(ageWord(st.days)) : '') + '</span>';
    return '<span class="' + cls + '" title="' + esc(title(rec)) + '"><i>' + k.mark + '</i>' + word + '</span>';
  }

  function chip(entity, id, field, opts) {
    return chipFor(get(entity, id, field), opts);
  }

  /* Плашка для сводного числа. Отдельная от обычной, потому что говорит другое: не «откуда
     это число», а «из чего оно собрано и что в нём самое слабое». */
  function aggChip(recs, opts) {
    opts = opts || {};
    var a = aggregate(recs);
    if (!a.total) return '';
    var k = a.conf ? KIND[a.conf] : null;
    var cls = 'prov prov-' + (a.conf || 'none') + (a.stale === 'amber' ? ' prov-old' : (a.stale === 'red' ? ' prov-dead' : ''));
    var parts = [];
    if (a.mix.verified) parts.push('подтверждено ' + a.mix.verified);
    if (a.mix.asking) parts.push('запрос ' + a.mix.asking);
    if (a.mix.modelled) parts.push('расчёт ' + a.mix.modelled);
    if (a.mix.none) parts.push('без источника ' + a.mix.none);
    var tip = (k ? k.ru : 'Без источника')
      + ': итог берёт самую слабую уверенность из входящих, а не лучшую.\n'
      + 'Состав: ' + parts.join(', ') + ' из ' + a.total + '.'
      + (a.days != null ? '\nСамая старая запись: ' + ageWord(a.days) + '.' : '');
    var word = opts.compact ? '' : '<span>' + esc(k ? k.short : 'нет источника')
      + (a.blended ? ' · смешано' : '') + '</span>';
    return '<span class="' + cls + '" title="' + esc(tip) + '"><i>' + (k ? k.mark : '?') + '</i>' + word + '</span>';
  }

  /* Собрать записи по списку сущностей одного поля - обычный вход для aggChip. */
  function collect(entity, ids, field) {
    return (ids || []).map(function (id) { return get(entity, id, field); });
  }

  /* ── Стили ───────────────────────────────────────────────────────────────── */

  /* Три вида различаются ЗНАЧКОМ, РАМКОЙ и ЗАЛИВКОЙ, а не только цветом: материалы уходят
     клиенту в PDF и печатаются, в том числе чёрно-белыми. */
  var CSS = ''
    + '.prov{display:inline-flex;align-items:center;gap:4px;font-size:10px;line-height:1;'
    + 'padding:2px 6px;border-radius:9px;white-space:nowrap;vertical-align:middle;margin-left:6px;'
    + 'font-weight:700;letter-spacing:.2px;cursor:help}'
    + '.prov i{font-style:normal;font-size:10.5px}'
    + '.prov-verified{background:#e8f5ea;border:1px solid #2e7d32;color:#1b5e20}'
    + '.prov-asking{background:#fff;border:1px solid #8d6e00;color:#6b5300}'
    + '.prov-modelled{background:#f4f4f4;border:1px dashed #757575;color:#4a4a4a}'
    + '.prov-none{background:#fdecea;border:1px dotted #b71c1c;color:#8e1414}'
    + '.prov-dlg{background:#fff;border-radius:12px;padding:16px;max-width:760px;width:100%;max-height:90vh;overflow:auto}'
    + '.prov-row{border:1px solid #e6e2dc;border-radius:10px;padding:10px 12px;margin-top:10px}'
    + '.prov-row-h{display:flex;align-items:center;gap:6px;margin-bottom:8px;font-size:13px}'
    + '.prov-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:8px}'
    + '.prov-grid label{display:flex;flex-direction:column;gap:3px;font-size:11px;color:var(--muted,#6d6d6d)}'
    + '.prov-grid input,.prov-grid select{font:inherit;font-size:12.5px;padding:5px 7px;border:1px solid #d9d4cc;border-radius:7px}'
    + '.prov-wide{grid-column:1/-1}'
    + '.prov-actions{display:flex;gap:6px;flex-wrap:wrap;align-items:center;margin-top:10px}'
    + '.prov-sep{font-size:11px;color:var(--muted,#6d6d6d);margin-left:4px}'
    + '.prov-legend{display:flex;gap:18px;flex-wrap:wrap;font-size:12px}'
    /* Устаревание не заменяет вид цепочки, а накладывается на него: иначе подтверждённая
       полтора года назад ставка выглядела бы как никогда не проверявшаяся. */
    + '.prov-old{box-shadow:inset 0 -2px 0 #e6a700}'
    + '.prov-dead{box-shadow:inset 0 -2px 0 #c62828;opacity:.85}'
    + '.prov-dead i{text-decoration:line-through}'
    + '@media print{.prov{border-width:1px!important;background:#fff!important;color:#000!important;'
    + 'box-shadow:none!important}.prov-modelled{border-style:dashed!important}'
    + '.prov-none{border-style:dotted!important}}';

  function injectCSS() {
    try {
      if (document.getElementById('provCSS')) return;
      var s = document.createElement('style');
      s.id = 'provCSS';
      s.textContent = CSS;
      document.head.appendChild(s);
    } catch (e) {}
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', injectCSS);
  else injectCSS();

  /* ── Отчёт об устаревании ────────────────────────────────────────────────── */

  /* Список того, что пора перепроверить. Без него правило про 90/180 дней остаётся
     украшением: никто не обходит тысячу помещений глазами в поисках жёлтых плашек. */
  function stale(entityFilter) {
    var out = [];
    var s = store();
    Object.keys(s).forEach(function (k) {
      var p = k.split(':');
      if (entityFilter && p[0] !== entityFilter) return;
      var r = s[k];
      if (!r || !r.at) return;
      var d = daysSince(r.at);
      var lvl = staleOf(d);
      if (lvl !== 'amber' && lvl !== 'red') return;
      out.push({ entity: p[0], id: p[1], field: p[2], rec: r, days: d, level: lvl });
    });
    out.sort(function (a, b) { return b.days - a.days; });
    return out;
  }

  /* Доля подтверждённых данных по полю - число, которое CASE может назвать клиенту и
     которое конкурент назвать не может, потому что у него нет поля автора вовсе. */
  function coverage(entity, ids, field) {
    var recs = collect(entity, ids, field);
    var a = aggregate(recs);
    var fresh = 0;
    recs.forEach(function (r) {
      if (r && r.conf === 'verified' && staleOf(daysSince(r.at)) === 'fresh') fresh++;
    });
    return {
      total: a.total,
      verified: a.mix.verified,
      verifiedFresh: fresh,
      asking: a.mix.asking,
      modelled: a.mix.modelled,
      none: a.mix.none,
      pct: a.total ? Math.round(fresh * 1000 / a.total) / 10 : 0
    };
  }

  /* ── Диалог источника ────────────────────────────────────────────────────── */

  var FIELD_LABELS = {
    unit:   { area: 'Площадь', rate: 'Ставка', status: 'Статус (вакансия)' },
    object: { gba: 'GBA', gla: 'GLA', vacancy: 'Вакансия' }
  };

  function units() { try { return Array.isArray(U) ? U : []; } catch (e) { return []; } }
  function unitById(id) { return units().find(function (u) { return String(u.id) === String(id); }) || null; }
  function role() { try { return typeof R === 'function' ? (R() || {}) : {}; } catch (e) { return {}; } }
  function canEdit() { var r = role(); return !!(r.edit || r.admin); }
  function canFinance() { var r = role(); return !!(r.finance || r.admin); }
  function say(msg) { try { if (typeof toast === 'function') toast(msg); } catch (e) {} }

  function options(map, sel) {
    return Object.keys(map).map(function (k) {
      return '<option value="' + k + '"' + (k === sel ? ' selected' : '') + '>' + esc(map[k]) + '</option>';
    }).join('');
  }

  /* В выпадающем списке уверенности НЕТ значения «подтверждено». Подтверждение ставится
     отдельными кнопками, каждая называет способ проверки, и дату с автором ставит платформа.
     Так «подтверждено» остаётся действием, за которое кто-то отвечает, а не пунктом меню. */
  function fieldRow(entity, id, field, label) {
    var rec = get(entity, id, field);
    var r = rec || {};
    var a = "'" + entity + "','" + id + "','" + field + "'";
    return '<div class="prov-row" data-f="' + esc(field) + '">'
      + '<div class="prov-row-h"><b>' + esc(label) + '</b> ' + chipFor(rec) + '</div>'
      + '<div class="prov-grid">'
      + '<label>Уверенность<select data-k="conf">' + options({ asking: KIND.asking.ru, modelled: KIND.modelled.ru }, r.conf === 'modelled' ? 'modelled' : 'asking') + '</select></label>'
      + '<label>Источник<select data-k="src">' + options(SOURCE, r.src || 'landlord') + '</select></label>'
      + '<label>Кто именно<input data-k="name" value="' + esc(r.name || '') + '" placeholder="имя, компания, ссылка" maxlength="160"></label>'
      + '<label>Дата наблюдения<input data-k="at" type="date" value="' + esc(r.at || today()) + '" max="' + today() + '"></label>'
      + '<label class="prov-wide">Примечание<input data-k="note" value="' + esc(r.note || '') + '" maxlength="400"></label>'
      + '</div>'
      + '<div class="prov-actions">'
      + '<button class="btn sm" onclick="CASE_PROV._save(' + a + ')">Сохранить как есть</button>'
      + '<span class="prov-sep">подтвердить:</span>'
      + '<button class="btn ghost sm" onclick="CASE_PROV._confirm(' + a + ",'call')\">✓ звонком</button>"
      + '<button class="btn ghost sm" onclick="CASE_PROV._confirm(' + a + ",'document')\">✓ документом</button>"
      + '<button class="btn ghost sm" onclick="CASE_PROV._confirm(' + a + ",'visit')\">✓ выездом</button>"
      + '<button class="btn ghost sm" onclick="CASE_PROV._confirm(' + a + ",'deal')\">✓ сделкой</button>"
      + (rec ? '<button class="btn ghost sm" style="margin-left:auto" onclick="CASE_PROV._drop(' + a + ')">Снять</button>' : '')
      + '</div></div>';
  }

  function dialog(entity, id) {
    if (!canEdit()) { say('Нет прав на изменение данных'); return; }
    var fields = Object.keys(FIELD_LABELS[entity] || {});
    /* Ставка - финансовое поле: роль без finance не видит цифру и не утверждает, откуда она. */
    if (entity === 'unit' && !canFinance()) fields = fields.filter(function (f) { return f !== 'rate'; });
    var u = entity === 'unit' ? unitById(id) : null;
    var head = u ? esc(u.code) : esc(id);
    var html = '<div class="prov-dlg"><h3 style="margin:0 0 4px">Источник данных · ' + head + '</h3>'
      + '<p class="sub" style="margin:0 0 10px">Откуда взято число, кто и когда проверил. Подтверждение ставится '
      + 'только сегодняшним днём и вашим именем: дату и автора выбрать нельзя.</p>'
      + fields.map(function (f) { return fieldRow(entity, id, f, FIELD_LABELS[entity][f]); }).join('')
      + '<div style="margin-top:10px;display:flex;justify-content:flex-end"><button class="btn ghost sm" onclick="CASE_PROV._close()">Закрыть</button></div></div>';
    if (typeof openModal === 'function') openModal(html);
  }

  function readRow(field) {
    var row = document.querySelector('.prov-row[data-f="' + field + '"]');
    if (!row) return null;
    var o = {};
    row.querySelectorAll('[data-k]').forEach(function (el) { o[el.getAttribute('data-k')] = el.value; });
    return o;
  }
  function _save(entity, id, field) {
    var o = readRow(field); if (!o) return;
    if (o.at && o.at > today()) { say('Дата наблюдения не может быть в будущем'); return; }
    set(entity, id, field, { conf: o.conf, src: o.src, name: o.name, at: o.at, note: o.note });
    after(entity, id, 'Источник сохранён');
  }
  function _confirm(entity, id, field, how) {
    var o = readRow(field) || {};
    var cur = get(entity, id, field) || {};
    if (o.note != null) cur.note = o.note;
    confirm(entity, id, field, how, o.name, o.src);
    after(entity, id, 'Подтверждено: ' + (METHOD[how] || how).toLowerCase());
  }
  function _drop(entity, id, field) { drop(entity, id, field); after(entity, id, 'Источник снят'); }
  function _close() { var m = document.getElementById('rmodal'); if (m) m.remove(); }
  function after(entity, id, msg) {
    _close();
    try { if (entity === 'unit' && typeof openUnit === 'function') openUnit(id); } catch (e) {}
    say(msg);
  }

  /* ── Раздел «Качество и источники данных» ─────────────────────────────────── */

  /* До v4.71.0 это была заглушка с обещанием: «Статус проверки», «Confidence и точность»,
     «Очередь ручного контроля». Теперь это те самые вещи. */
  function scopeIds() {
    var all = units();
    try {
      if (typeof S !== 'undefined' && S && S.obj && S.obj !== 'ALL') all = all.filter(function (u) { return u.obj === S.obj; });
    } catch (e) {}
    return all.map(function (u) { return u.id; });
  }
  function objName(objId) {
    try { return (typeof objById === 'function' ? (objById(objId) || {}).name : '') || objId || ''; } catch (e) { return objId || ''; }
  }

  function renderDataQuality() {
    var ids = scopeIds();
    var fin = canFinance();
    var fields = [['area', 'Площади'], ['status', 'Статусы (вакансия)'], ['rate', 'Ставки']]
      .filter(function (f) { return fin || f[0] !== 'rate'; });
    var kpis = fields.map(function (f) {
      var c = coverage('unit', ids, f[0]);
      return '<div class="kpi"><div class="lab">' + esc(f[1]) + ': подтверждено и свежо</div>'
        + '<div class="val">' + c.pct + '%</div>'
        + '<div class="sub2">' + c.verifiedFresh + ' из ' + c.total + ' · запрос ' + c.asking
        + ' · расчёт ' + c.modelled + ' · без источника ' + c.none + '</div></div>';
    }).join('');
    var st = stale('unit').filter(function (x) { return ids.indexOf(x.id) >= 0 && (fin || x.field !== 'rate'); });
    var rows = st.slice(0, 300).map(function (x) {
      var u = unitById(x.id) || {};
      return '<tr onclick="openUnit(\'' + esc(x.id) + '\')" style="cursor:pointer">'
        + '<td><b>' + esc(u.code || x.id) + '</b><div style="font-size:10px;color:var(--muted)">' + esc(objName(u.obj)) + '</div></td>'
        + '<td>' + esc((FIELD_LABELS.unit || {})[x.field] || x.field) + '</td>'
        + '<td>' + chipFor(x.rec) + '</td>'
        + '<td>' + esc(dateRU(x.rec.at)) + '</td>'
        + '<td class="num">' + x.days + '</td>'
        + '<td>' + esc(x.rec.by || '') + '</td></tr>';
    }).join('');
    return '<div class="ph"><h1>Качество и источники данных</h1></div>'
      + '<p class="sub">Каждое коммерческое число несёт происхождение: откуда взято, кто проверил, когда. '
      + 'Сводные величины берут самую слабую уверенность из входящих и не смешивают подтверждённое с запрошенным.</p>'
      + '<div class="kpis">' + kpis + '</div>'
      + '<div class="card"><h3>Три цепочки</h3><div class="prov-legend">'
      + '<div>' + chipFor({ conf: 'verified', at: today() }) + ' сделка, документ, звонок или выезд; указано кем и когда</div>'
      + '<div>' + chipFor({ conf: 'asking', at: today() }) + ' объявление или слова стороны; сделкой не подтверждено</div>'
      + '<div>' + chipFor({ conf: 'modelled', at: today() }) + ' вычислено из других величин</div>'
      + '<div>' + chipFor(null) + ' происхождение не указано</div>'
      + '</div><p class="sub" style="margin:8px 0 0">Возраст: старше ' + AMBER_DAYS + ' дней - жёлтая полоса, старше '
      + RED_DAYS + ' - красная. Скрыть возраст нельзя.</p></div>'
      + '<div class="card" id="provStale"><h3>Требует перепроверки <span class="mut">' + st.length + '</span></h3>'
      + (st.length
        ? '<div class="tbl-scroll"><table><thead><tr><th>Помещение</th><th>Поле</th><th>Уверенность</th><th>Дата</th><th class="num">Дней</th><th>Кто</th></tr></thead><tbody>' + rows + '</tbody></table></div>'
        : '<div class="sub" style="margin:0">Устаревших записей нет.</div>')
      + '</div>';
  }

  /* Маршрут. v490 перехватывает go() для будущих разделов и рисует заглушку; наша обёртка
     должна стоять СНАРУЖИ его обёртки. v490 ставит свою на DOMContentLoaded + setTimeout(0),
     поэтому наша встаёт на load + setTimeout: позже любого отложенного скрипта. */
  function installRoute() {
    var oldGo = window.go;
    if (typeof oldGo !== 'function' || oldGo._prov4710) return;
    /* Только если ядро уже подхватило go как маршрутизатор: до этого оборачивать нечего. */
    window.go = function (v) {
      if (v === 'data_quality') {
        if (typeof window.caseWorkspaceCanOpen === 'function' && !window.caseWorkspaceCanOpen(v)) return oldGo.call(this, v);
        try { S.view = v; S._focus = null; } catch (e) {}
        document.querySelectorAll('#nav a').forEach(function (a) { a.classList.toggle('active', a.dataset.v === v); });
        var side = document.getElementById('side'), scrim = document.getElementById('scrim');
        if (side) side.classList.remove('open'); if (scrim) scrim.classList.remove('open');
        var main = document.getElementById('main');
        if (main) main.innerHTML = renderDataQuality();
        try { if (typeof localize === 'function') localize(); } catch (e) {}
        try { if (typeof syncTblScroll === 'function') syncTblScroll(); } catch (e) {}
        try { if (typeof saveUiPrefs === 'function') saveUiPrefs(); } catch (e) {}
        return;
      }
      return oldGo.call(this, v);
    };
    window.go._prov4710 = true;
    try { if (typeof S !== 'undefined' && S && S.view === 'data_quality') window.go('data_quality'); } catch (e) {}
  }
  /* Ставим обёртку трижды: сразу, после DOMContentLoaded и после load. Если кто-то обернул
     go() поверх нас позже (флаг на window.go пропал), installRoute обернёт снова: внешняя
     обёртка перехватывает раздел первой, внутренняя просто пробрасывает дальше. */
  installRoute();
  document.addEventListener('DOMContentLoaded', function () { setTimeout(installRoute, 50); }, { once: true });
  if (document.readyState === 'complete') setTimeout(installRoute, 30);
  else window.addEventListener('load', function () { setTimeout(installRoute, 30); }, { once: true });

  window.CASE_PROV = {
    version: VERSION,
    ORDER: ORDER, KIND: KIND, SOURCE: SOURCE, METHOD: METHOD,
    AMBER_DAYS: AMBER_DAYS, RED_DAYS: RED_DAYS,
    key: key, get: get, set: set, drop: drop, make: make, confirm: confirm,
    daysSince: daysSince, staleOf: staleOf, state: state,
    weakest: weakest, aggregate: aggregate, collect: collect,
    chip: chip, chipFor: chipFor, aggChip: aggChip, title: title,
    ageWord: ageWord, dateRU: dateRU,
    stale: stale, coverage: coverage, css: CSS,
    dialog: dialog, renderDataQuality: renderDataQuality, installRoute: installRoute,
    _save: _save, _confirm: _confirm, _drop: _drop, _close: _close
  };
  window.CASE_MODULE_VERSIONS = window.CASE_MODULE_VERSIONS || {};
  window.CASE_MODULE_VERSIONS['v4710-provenance'] = VERSION;
})();
