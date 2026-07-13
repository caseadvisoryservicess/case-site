/**
 * CRM «Лиды SFB Тахтапул 31» — приём заявок с лендинга в Google Таблицу.
 *
 * Как подключить (один раз, ~5 минут):
 * 1. Откройте таблицу «CRM — Лиды SFB Тахтапул 31» на Google Диске.
 * 2. Меню: Расширения → Apps Script. Удалите содержимое и вставьте весь этот файл. Сохраните (Ctrl+S).
 * 3. Слева выберите функцию setup и нажмите «Выполнить» — Google попросит разрешения,
 *    подтвердите (Дополнительные настройки → Перейти). Таблица оформится автоматически:
 *    заголовки, выпадающие статусы, цвета воронки.
 * 4. Кнопка «Развернуть» (справа сверху) → «Новое развёртывание» → тип «Веб-приложение»:
 *    – Выполнять от имени: «От моего имени»
 *    – У кого есть доступ: «Все»
 *    → «Начать развёртывание» → скопируйте URL вида https://script.google.com/macros/s/…/exec
 * 5. Пришлите этот URL Claude (или сами вставьте его в index.html в константу SHEETS_ENDPOINT).
 *    После этого каждая заявка с сайта появляется в таблице строкой со статусом «Новый».
 *
 * Звонки и Telegram-лиды добавляйте вручную строкой, источник — «Звонок» / «Telegram».
 */

var STATUSES = ['Новый', 'В работе', 'Встреча/показ', 'Переговоры', 'Договор', 'Отказ'];
var LOTS = ['2 этаж — 179 м²', '3 этаж — 430,4 м²', 'Оба лота', 'Ещё не выбрал(а)'];
var SOURCES = ['Форма сайта', 'Звонок', 'Telegram', 'Рекомендация', 'Другое'];

/** Принимает POST с лендинга и добавляет строку-лид. */
function doPost(e) {
  var lock = LockService.getScriptLock();
  lock.tryLock(10000);
  try {
    var sh = SpreadsheetApp.getActiveSpreadsheet().getSheets()[0];
    var p = (e && e.parameter) || {};
    var extras = [];
    if (p.interest) extras.push(p.interest);
    if (p.message) extras.push(p.message);
    if (p.email) extras.push('Email: ' + p.email);
    if (p.lang) extras.push('Язык: ' + String(p.lang).toUpperCase());
    sh.appendRow([
      Utilities.formatDate(new Date(), 'Asia/Tashkent', 'dd.MM.yyyy HH:mm'),
      p.name || '',
      "'" + (p.phone || ''),          // апостроф сохраняет +998… как текст
      p.lot || '',
      extras.join(' · '),
      'Форма сайта',
      'Новый',
      '',
      ''
    ]);
  } finally {
    lock.releaseLock();
  }
  return ContentService.createTextOutput('ok');
}

/** Запустить один раз вручную: оформляет таблицу под CRM. */
function setup() {
  var sh = SpreadsheetApp.getActiveSpreadsheet().getSheets()[0];
  var header = ['Дата', 'Имя', 'Телефон', 'Лот', 'Сообщение клиента', 'Источник', 'Статус', 'Следующий шаг', 'Заметки менеджера'];
  sh.getRange(1, 1, 1, header.length).setValues([header])
    .setFontWeight('bold').setBackground('#1b1d1f').setFontColor('#ffffff');
  sh.setFrozenRows(1);
  var widths = [125, 140, 135, 150, 300, 110, 120, 170, 220];
  widths.forEach(function (w, i) { sh.setColumnWidth(i + 1, w); });

  sh.getRange('G2:G2000').setDataValidation(
    SpreadsheetApp.newDataValidation().requireValueInList(STATUSES, true).setAllowInvalid(false).build());
  sh.getRange('D2:D2000').setDataValidation(
    SpreadsheetApp.newDataValidation().requireValueInList(LOTS, true).setAllowInvalid(true).build());
  sh.getRange('F2:F2000').setDataValidation(
    SpreadsheetApp.newDataValidation().requireValueInList(SOURCES, true).setAllowInvalid(true).build());

  var colors = {
    'Новый': '#e8f0fe',
    'В работе': '#fef7e0',
    'Встреча/показ': '#fce8e6',
    'Переговоры': '#fde9d9',
    'Договор': '#e6f4ea',
    'Отказ': '#f1f3f4'
  };
  var rules = Object.keys(colors).map(function (s) {
    return SpreadsheetApp.newConditionalFormatRule()
      .whenTextEqualTo(s).setBackground(colors[s])
      .setRanges([sh.getRange('G2:G2000')]).build();
  });
  sh.setConditionalFormatRules(rules);
}
