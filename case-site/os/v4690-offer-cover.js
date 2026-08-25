/* CASE OS v4.69.0 - картинка титульного листа коммерческого предложения.
 *
 * Задача владельца: если фото самого проекта нет, брать одну из стандартных картинок и
 * чередовать их, чтобы предложения не выглядели под копирку.
 *
 * Цепочка выбора, сверху вниз:
 *   1. фото проекта, если оно приложено;
 *   2. одна из стандартных картинок - какая именно, решает номер предложения;
 *   3. блок из цифр опыта, если картинок нет вовсе.
 *
 * ── Почему выбор детерминированный, а не случайный
 *
 * Соблазн написать Math.random() здесь сильный, и он неверен. Предложение печатают
 * несколько раз: черновик, версия на согласование, финальный PDF, потом ещё раз через
 * месяц из архива. Случайная картинка означала бы, что один и тот же документ каждый раз
 * выглядит иначе, а «тот самый файл, который мы отправляли» перестал бы существовать.
 * Поэтому картинка выводится из номера предложения: у одного номера она всегда одна, а
 * соседние номера получают разные - ровно то чередование, которое и просили.
 *
 * ── Почему пустого места быть не может
 *
 * ТЗ прямо запрещает пустую рамку в клиентской версии. Если стандартных картинок нет
 * (файлы не залиты), титул не остаётся дырявым: вместо изображения собирается блок из
 * подтверждённых цифр опыта. Это не заглушка, а осмысленный слайд - его и без картинки
 * не стыдно показать.
 */
(function () {
  'use strict';
  if (window.CASE_OFFER_COVER) return;

  var VERSION = '4.69.0';

  /* Стандартные картинки. Файлы кладутся в os/assets/ и перечисляются здесь; список
     редактируется в настройках модуля и может быть любой длины, включая ноль. */
  var STOCK = [
    { file: 'assets/offer-cover-1.jpg', ru: 'Интерьер галереи торгового центра', en: 'Mall gallery interior' },
    { file: 'assets/offer-cover-2.jpg', ru: 'Авторский эскиз фасада', en: 'Hand-drawn facade sketch' }
  ];

  /* Цифры опыта для запасного блока. Пусто по умолчанию: подставляются из карточки
     компании, а не выдумываются здесь. Принцип тот же, что и в сборщике геоданных -
     лучше пустая строка, чем правдоподобное число. */
  var CREDENTIALS = [];

  /* Устойчивый разброс по строке. Обычная сумма кодов символов давала бы одинаковый
     результат для перестановок («0042» и «0024»), поэтому вес позиции учитывается. */
  function hash(s) {
    var str = String(s == null ? '' : s), h = 0;
    for (var i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) >>> 0;
    return h;
  }

  /* Выбор картинки. seed - номер предложения: одинаковый номер даёт одинаковую картинку
     при каждой печати, соседние номера - разные. */
  function pickStock(seed, list) {
    var arr = Array.isArray(list) ? list : STOCK;
    if (!arr.length) return null;
    return arr[hash(seed) % arr.length];
  }

  /* Главная функция: что показать на титуле.
     opts: { photo, offerNumber, stock, credentials, audience } */
  function cover(opts) {
    var o = opts || {};
    var photo = (o.photo == null || o.photo === '') ? null : String(o.photo);
    if (photo) return { kind: 'photo', src: photo, caption: o.photoCaption || '', fallbackUsed: false };

    var pick = pickStock(o.offerNumber, o.stock);
    if (pick) return { kind: 'stock', src: pick.file, caption: pick.ru, fallbackUsed: true, stockKey: pick.file };

    var creds = Array.isArray(o.credentials) ? o.credentials : CREDENTIALS;
    return { kind: 'credentials', src: null, items: creds, fallbackUsed: true };
  }

  function esc(v) {
    return String(v == null ? '' : v).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  /* Разметка титульного изображения. Стили встроенные: документ печатается и уходит в PDF,
     а внешняя таблица стилей туда не доезжает - так же сделано в остальных выгрузках. */
  function html(c, opts) {
    var o = opts || {}, w = o.width || '100%', h = o.height || '360px';
    if (!c) return '';
    if (c.kind === 'photo' || c.kind === 'stock') {
      return '<figure style="margin:0;width:' + w + '">'
        + '<img src="' + esc(c.src) + '" alt="' + esc(c.caption || '') + '" '
        + 'style="display:block;width:100%;height:' + h + ';object-fit:cover;border:1px solid #DAD6D0" />'
        + (o.showCaption && c.caption
          ? '<figcaption style="font-family:Archivo,sans-serif;font-size:10px;color:#6E6A66;padding-top:6px">'
            + esc(c.caption) + '</figcaption>'
          : '')
        + '</figure>';
    }
    /* Запасной блок: только подтверждённые цифры. Если и их нет, не рисуем ничего -
       пустая рамка в клиентском документе хуже отсутствия блока. */
    var items = (c.items || []).filter(function (x) { return x && x.value !== '' && x.value != null; });
    if (!items.length) return '';
    return '<div style="display:flex;gap:28px;width:' + w + ';border-top:3px solid #9A1D20;padding-top:18px">'
      + items.map(function (x) {
        return '<div style="display:flex;flex-direction:column;gap:4px">'
          + '<b style="font-family:Newsreader,Georgia,serif;font-size:34px;line-height:1;font-weight:400">' + esc(x.value) + '</b>'
          + '<span style="font-family:Archivo,sans-serif;font-size:10px;letter-spacing:0.14em;text-transform:uppercase;color:#6E6A66">'
          + esc(x.label) + '</span></div>';
      }).join('')
      + '</div>';
  }

  window.CASE_OFFER_COVER = {
    version: VERSION,
    STOCK: STOCK,
    cover: cover,
    pickStock: pickStock,
    html: html,
    hash: hash
  };
  window.CASE_MODULE_VERSIONS = window.CASE_MODULE_VERSIONS || {};
  window.CASE_MODULE_VERSIONS['v4690-offer-cover'] = VERSION;
})();
