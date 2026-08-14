/* CASE OS v4.68.0 - справочники проекта: вид, тип работ, сегмент.
 *
 * Требование владельца: в Advisory при заведении проекта выбирать вид и тип. Например
 * «ТРЦ + новое строительство» или «Lifestyle-центр + реконструкция».
 *
 * Это ДВА независимых измерения, и путать их нельзя:
 *   вид проекта  - что строим (ТРЦ, Lifestyle, Mixed-use, БЦ, базар, парк);
 *   тип работ    - что делаем (новое строительство, реконструкция, реконцепция, расширение).
 * Один и тот же ТРЦ может быть и новым строительством, и реконцепцией существующего, и
 * это разные проекты по объёму работ, срокам и цене. Держать их одним полем значит
 * потерять половину смысла и не суметь ни отфильтровать портфель, ни посчитать цену.
 *
 * Третье измерение - сегмент - существовало в портфеле и раньше (поле type: mall, office,
 * hotel, street, mixed, warehouse). Это грубая группировка для карты и отчётов, она
 * выводится из вида автоматически и руками не заполняется.
 *
 * ── Почему список именно такой
 *
 * Виды взяты не из головы, а из портфеля CASE: 95 проектов дали 26 написаний. Из них
 * канонических значений заметно меньше - в данных «Mixed-Use» и «Mixed-use», «Street Retail»
 * и «Street retail» живут как разные категории, хотя это одно и то же. Поэтому у каждого
 * вида есть список прежних написаний, и normalizeKind приводит к ним старые записи. Без
 * этого фильтр по виду в интерфейсе показывал бы два пункта с одинаковым названием.
 *
 * Списки редактируются: функции принимают собственный справочник параметром, а хранятся
 * они в настройках, а не в коде.
 */
(function () {
  'use strict';
  if (window.CASE_PROJECT_DIR) return;

  var VERSION = '4.68.0';

  /* Вид проекта. aliases - написания, встречавшиеся в портфеле и в прежних выгрузках.
     complexity - подсказка для коэффициента сложности, не жёсткое правило. */
  var KINDS = [
    { key: 'regional_mall', ru: 'Региональный ТРЦ', uz: 'Regional savdo markazi', en: 'Regional Mall',
      segment: 'mall', aliases: ['Regional Mall', 'Integrated / Super-Regional Mall', 'Super-Regional Mall'] },
    { key: 'community_mall', ru: 'Районный ТРЦ', uz: 'Tuman savdo markazi', en: 'Community / Neighborhood Mall',
      segment: 'mall', aliases: ['Community / Neighborhood Mall', 'Integrated / Neighbourhood Mall + Hotel', 'Neighborhood Mall'] },
    { key: 'lifestyle_centre', ru: 'Lifestyle-центр', uz: 'Lifestyle markaz', en: 'Lifestyle Centre',
      segment: 'mall', aliases: ['Lifestyle Centre', 'Lifestyle Center', 'Park / lifestyle'] },
    { key: 'outlet', ru: 'Аутлет', uz: 'Autlet', en: 'Outlet village',
      segment: 'mall', aliases: ['Outlet village', 'Outlet'] },
    { key: 'retail_hub', ru: 'Торговый хаб', uz: 'Savdo markazi hub', en: 'Retail Hub',
      segment: 'mall', aliases: ['Retail Hub'] },
    { key: 'hypermarket', ru: 'Гипермаркет или супермаркет', uz: 'Gipermarket', en: 'Hyper / Supermarket',
      segment: 'mall', aliases: ['Hyper / Supermarket', 'Hypermarket'] },
    { key: 'bazaar', ru: 'Базар', uz: 'Bozor', en: 'Regional Bazaar',
      segment: 'mall', aliases: ['Regional Bazaar', 'Bazaar'] },
    { key: 'street_retail', ru: 'Стрит-ритейл', uz: 'Ko‘cha savdosi', en: 'Street Retail',
      segment: 'street', aliases: ['Street Retail', 'Street retail'] },
    { key: 'mixed_use', ru: 'Многофункциональный комплекс', uz: 'Ko‘p funksiyali majmua', en: 'Mixed-Use',
      segment: 'mixed', aliases: ['Mixed-Use', 'Mixed-use', 'Mixed use'] },
    { key: 'masterplan', ru: 'Мастер-план территории', uz: 'Hudud bosh rejasi', en: 'Masterplan Development',
      segment: 'mixed', aliases: ['Masterplan Development', 'Masterplan'] },
    { key: 'business_centre', ru: 'Бизнес-центр', uz: 'Biznes markaz', en: 'Business Centre',
      segment: 'office', aliases: ['Business Centre', 'Business Center', 'Office / commercial building'] },
    { key: 'hotel', ru: 'Гостиница', uz: 'Mehmonxona', en: 'Hotel',
      segment: 'hotel', aliases: ['Hotel'] },
    { key: 'resort', ru: 'Курорт', uz: 'Kurort', en: 'Resort Hotel',
      segment: 'hotel', aliases: ['Resort Hotel', 'Resort'] },
    { key: 'fec', ru: 'Семейный развлекательный центр', uz: 'Oilaviy ko‘ngilochar markaz', en: 'Family entertainment centre',
      segment: 'other', aliases: ['Family entertainment centre', 'FEC', 'Amusement park', 'Thematic Park'] },
    { key: 'park', ru: 'Парк или общественное пространство', uz: 'Park va jamoat maydoni', en: 'Park / public space',
      segment: 'other', aliases: ['Park / event ground', 'Park'] },
    { key: 'fnb', ru: 'Объект питания', uz: 'Ovqatlanish obyekti', en: 'Restaurant',
      segment: 'other', aliases: ['Restaurant', 'F&B'] },
    { key: 'creative_cluster', ru: 'Креативный кластер', uz: 'Kreativ klaster', en: 'Creative Cluster',
      segment: 'other', aliases: ['Creative Cluster'] },
    { key: 'logistics', ru: 'Логистический центр', uz: 'Logistika markazi', en: 'Logistics Centre',
      segment: 'warehouse', aliases: ['Logistics Centre', 'Warehouse'] },
    { key: 'transport_hub', ru: 'Транспортный узел', uz: 'Transport tuguni', en: 'Airport / transport hub',
      segment: 'other', aliases: ['Airport', 'Transport hub'] },
    { key: 'other', ru: 'Другой вид', uz: 'Boshqa turi', en: 'Other', segment: 'other', aliases: [] }
  ];

  /* Тип работ. complexityKey указывает на фактор из каталога сложности расчёта цены:
     реконструкция объективно дороже нового строительства при той же площади. */
  var WORK_TYPES = [
    { key: 'new_build', ru: 'Новое строительство', uz: 'Yangi qurilish', en: 'New build', complexityKey: null },
    { key: 'reconstruction', ru: 'Реконструкция', uz: 'Rekonstruksiya', en: 'Reconstruction', complexityKey: 'reconstruction' },
    { key: 'reconcept', ru: 'Реконцепция действующего объекта', uz: 'Amaldagi obyektni qayta konseptsiyalash', en: 'Reconcepting', complexityKey: 'reconstruction' },
    { key: 'extension', ru: 'Расширение или достройка', uz: 'Kengaytirish', en: 'Extension', complexityKey: 'phased' },
    { key: 'repositioning', ru: 'Изменение позиционирования', uz: 'Qayta pozitsiyalash', en: 'Repositioning', complexityKey: null },
    { key: 'phased_development', ru: 'Поэтапное развитие территории', uz: 'Bosqichma-bosqich rivojlantirish', en: 'Phased development', complexityKey: 'phased' },
    { key: 'audit_only', ru: 'Аудит действующего объекта', uz: 'Amaldagi obyekt auditi', en: 'Audit of operating asset', complexityKey: null }
  ];

  var SEGMENTS = [
    { key: 'mall', ru: 'Торговая недвижимость' },
    { key: 'street', ru: 'Стрит-ритейл' },
    { key: 'mixed', ru: 'Многофункциональная' },
    { key: 'office', ru: 'Офисная' },
    { key: 'hotel', ru: 'Гостиничная' },
    { key: 'warehouse', ru: 'Складская и логистика' },
    { key: 'other', ru: 'Прочее' }
  ];

  function list(name, custom) {
    if (Array.isArray(custom)) return custom;
    return name === 'kinds' ? KINDS : name === 'workTypes' ? WORK_TYPES : SEGMENTS;
  }
  function byKey(arr, key) {
    for (var i = 0; i < arr.length; i++) if (arr[i].key === key) return arr[i];
    return null;
  }
  function kind(key, custom) { return byKey(list('kinds', custom), key); }
  function workType(key, custom) { return byKey(list('workTypes', custom), key); }
  function segmentOf(kindKey, custom) {
    var k = kind(kindKey, custom);
    return k ? k.segment : 'other';
  }

  /* Приведение прежних написаний к канону. Сравнение без учёта регистра и лишних пробелов:
     в портфеле встречаются и «Mixed-Use», и «Mixed-use», и это одно и то же. */
  function norm(s) { return String(s == null ? '' : s).toLowerCase().replace(/\s+/g, ' ').trim(); }
  function normalizeKind(value, custom) {
    var v = norm(value);
    if (!v) return null;
    var arr = list('kinds', custom);
    for (var i = 0; i < arr.length; i++) {
      if (norm(arr[i].key) === v || norm(arr[i].ru) === v || norm(arr[i].en) === v) return arr[i].key;
      var al = arr[i].aliases || [];
      for (var j = 0; j < al.length; j++) if (norm(al[j]) === v) return arr[i].key;
    }
    return null;
  }
  function normalizeWorkType(value, custom) {
    var v = norm(value);
    if (!v) return null;
    var arr = list('workTypes', custom);
    for (var i = 0; i < arr.length; i++) {
      if (norm(arr[i].key) === v || norm(arr[i].ru) === v || norm(arr[i].en) === v) return arr[i].key;
    }
    return null;
  }

  /* Подпись «вид + тип» одной строкой: то, что видно в карточке проекта и в шапке
     коммерческого предложения. */
  function label(kindKey, workTypeKey, lang, custom) {
    var l = lang || 'ru';
    var k = kind(kindKey, custom && custom.kinds), w = workType(workTypeKey, custom && custom.workTypes);
    var a = k ? (k[l] || k.ru) : '', b = w ? (w[l] || w.ru) : '';
    if (a && b) return a + ', ' + b.charAt(0).toLowerCase() + b.slice(1);
    return a || b || '';
  }

  /* Какие факторы сложности подсказать по типу работ. Не проставляем их молча: цена -
     решение человека, а подсказка лишь экономит ему клики. */
  function complexityHints(workTypeKey, custom) {
    var w = workType(workTypeKey, custom);
    return w && w.complexityKey ? [w.complexityKey] : [];
  }

  /* Варианты для выпадающего списка в форме. */
  function options(name, lang, custom) {
    var l = lang || 'ru';
    return list(name, custom).map(function (x) { return { value: x.key, label: x[l] || x.ru }; });
  }

  window.CASE_PROJECT_DIR = {
    version: VERSION,
    KINDS: KINDS,
    WORK_TYPES: WORK_TYPES,
    SEGMENTS: SEGMENTS,
    kind: kind,
    workType: workType,
    segmentOf: segmentOf,
    normalizeKind: normalizeKind,
    normalizeWorkType: normalizeWorkType,
    label: label,
    complexityHints: complexityHints,
    options: options
  };
  window.CASE_MODULE_VERSIONS = window.CASE_MODULE_VERSIONS || {};
  window.CASE_MODULE_VERSIONS['v4680-project-directories'] = VERSION;
})();
