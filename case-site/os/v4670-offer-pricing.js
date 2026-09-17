/* CASE OS v4.67.0 - расчёт стоимости коммерческого предложения.
 *
 * Правило заказчика: система показывает стандартную ставку, а дальше всё регулируется
 * руками. Ставку меняют, дают скидку, договариваются об итоговой сумме. Поэтому здесь
 * нет ни одного числа, которое нельзя переопределить, и одновременно нет ни одного
 * отклонения, которое прошло бы незаметно: каждое ручное вмешательство попадает в
 * deviations и оттуда в журнал изменений предложения.
 *
 * Гибкость и контроль тут не противоречат друг другу. Запрещать менять цену бессмысленно -
 * её всё равно поменяют, просто в Excel и мимо системы. Задача другая: чтобы через полгода
 * было видно, кто дал скидку 12%, когда и почему.
 *
 * ── Порядок вычислений, и почему он именно такой
 *
 *   1  listRate   ставка тарифа из таблицы (таблица редактируется, а не зашита в код)
 *   2  rate       фактическая ставка: listRate либо назначенная вручную
 *   3  raw        area × rate
 *   4  base       max(raw, minFee) - минимальная сумма как пол
 *   5  discount   процент или абсолютная сумма, применяется к base
 *   6  billable   base - discount, то есть то, что клиент реально платит за услугу
 *   7  supervision, extra - отдельные строки, в график 40/30/30 не входят
 *   8  total      billable + supervision + extra
 *
 * Минимальная сумма - пол для РАСЧЁТА, а не для сделки. Скидка применяется после неё и
 * может опустить итог ниже минимума: это уже коммерческое решение, а не арифметика.
 * Такой случай не запрещается, а помечается отклонением, требующим объяснения.
 *
 * ── Три места, где эталонный калькулятор считает иначе, и почему я отступил
 *
 * График платежей у эталона считается от base тремя независимыми округлениями, поэтому
 * сумма частей расходится с целым на доллар-другой. В презентации это незаметно, в
 * договоре - повод для вопроса. Здесь остаток отдаётся последнему платежу, и сумма
 * частей равна billable ровно.
 *
 * Строка про минимальную сумму у эталона содержит «$5 000» текстом, а не значением
 * константы: поменяв минимум, получили бы документ, который сам себе противоречит.
 * Здесь она собирается из фактического minFee.
 *
 * Разделитель тысяч у эталона - обычный пробел, хотя ТЗ обещает тонкий. Беру неразрывный:
 * выглядит так же, но «$46 000» не разорвётся между строками при печати.
 */
(function () {
  'use strict';
  if (window.CASE_OFFER_PRICING) return;

  var VERSION = '4.67.0';
  var NBSP = ' ';

  /* Прайс. Хранится здесь только как значение по умолчанию: рабочая таблица приходит из
     базы (таблица tariffs по ТЗ) и правится директором без изменения кода. */
  var DEFAULT_TARIFFS = [
    { code: 't1', key: 'expert_review', name: 'Expert Review', rate: 2.0, weeksMin: 2, weeksMax: 3 },
    { code: 't2', key: 'concept_support', name: 'Concept Support', rate: 2.2, weeksMin: 4, weeksMax: 6, unconfirmed: true },
    { code: 't3', key: 'commercial_concept', name: 'Commercial Concept', rate: 2.5, weeksMin: 7, weeksMax: 10, recommended: true },
    { code: 't4', key: 'full_strategy', name: 'Full Strategy', rate: 4.5, weeksMin: 10, weeksMax: 14 }
  ];

  /* Коэффициент сложности. Требование заказчика: сложный проект дороже, простой дешевле.
     Значения ниже - предлагаемая отправная точка, а не политика фирмы: они правятся в
     настройках вместе с прайсом. Надбавки СКЛАДЫВАЮТСЯ, а не перемножаются: «+20% за
     многоуровневый стилобат и +15% за смешанное назначение» клиенту объяснимо, а
     1,2 × 1,15 = 1,38 объяснить уже труднее, и в переговорах это работает против нас. */
  var DEFAULT_COMPLEXITY = [
    { key: 'stilobat_multilevel', ru: 'Многоуровневый стилобат', uz: 'Ko‘p qavatli stilobat', delta: 0.20 },
    { key: 'mixed_use', ru: 'Смешанное назначение', uz: 'Aralash foydalanish', delta: 0.15 },
    { key: 'phased', ru: 'Несколько очередей строительства', uz: 'Bir necha bosqich', delta: 0.15 },
    { key: 'reconstruction', ru: 'Реконструкция существующего здания', uz: 'Rekonstruksiya', delta: 0.20 },
    { key: 'heritage', ru: 'Охранная зона или памятник', uz: 'Muhofaza zonasi', delta: 0.25 },
    { key: 'terrain', ru: 'Сложный рельеф участка', uz: 'Murakkab relyef', delta: 0.10 },
    { key: 'multi_owner', ru: 'Несколько собственников участка', uz: 'Bir necha mulkdor', delta: 0.15 },
    { key: 'simple_single', ru: 'Простой одноуровневый объект', uz: 'Oddiy bir qavatli obyekt', delta: -0.15 },
    { key: 'repeat_client', ru: 'Повторный проект того же заказчика', uz: 'Takroriy loyiha', delta: -0.10 },
    { key: 'ready_inputs', ru: 'Исходные данные готовы и проверены', uz: 'Ma’lumotlar tayyor', delta: -0.10 }
  ];
  var COMPLEXITY_FLOOR = 0.5;   /* ниже половины ставки коэффициент уже не расчёт, а решение */

  var DEFAULTS = {
    minFee: 5000,        /* нижняя граница базовой услуги */
    hourly: 80,          /* сверхнормативное время, USD/час */
    minMonths: 3,        /* авторский надзор: меньше трёх месяцев не продаётся */
    monthly: 2500,       /* месячная ставка надзора по умолчанию */
    currency: 'USD'
  };

  /* Ценностная разбивка и график платежей вынесены в данные: ТЗ требует, чтобы доли
     можно было настроить по тарифу, не трогая формулу. Порядок в splitPlan назван в ТЗ
     осознанным и менять его нельзя. */
  var SPLIT_PLAN = [
    { key: 'concept', percent: 50, uz: 'Konsepsiya va chizmalar', ru: 'Концепция и чертежи' },
    { key: 'finance', percent: 30, uz: 'Moliyaviy model', ru: 'Финансовая модель' },
    { key: 'brief', percent: 20, uz: 'Texnik topshiriq', ru: 'Техническое задание' }
  ];
  var SCHEDULE_PLAN = [
    { key: 'advance', percent: 40, trigger: 'start', uz: 'Boshlang‘ich to‘lov', ru: 'Первый платёж, при старте' },
    { key: 'interim', percent: 30, trigger: 'draft', uz: 'Oraliq to‘lov', ru: 'Промежуточный, Draft чертёж и Draft finance' },
    { key: 'final', percent: 30, trigger: 'final_report', uz: 'Yakuniy to‘lov', ru: 'Финальный, Final report' }
  ];

  function num(v, fallback) {
    if (v === null || v === undefined || v === '') return fallback;
    var n = parseFloat(String(v).replace(',', '.'));
    return isFinite(n) && n >= 0 ? n : fallback;
  }
  /* Денежный формат: «$46 000», группы по три, неразрывный пробел.
     Число берётся напрямую, а не через num(): та по замыслу отбрасывает отрицательные
     значения (поля ввода не бывают отрицательными), и строка скидки печаталась как $0. */
  /* Деньги точны до цента. «Хранить точно» из ТЗ означает именно это, а не двоичный шум:
     18 400 × 2,5 × 1,35 в double даёт 62100.00000000001, и это значение ушло бы и в базу,
     и в сравнения, и однажды - в документ. */
  function cents(v) { return Math.round((Number(v) || 0) * 100) / 100; }
  function money(v) { var n = parseFloat(String(v == null ? 0 : v).replace(',', '.')); return isFinite(n) ? n : 0; }
  function usd(n, sep) {
    var v = money(n);
    var s = String(Math.round(Math.abs(v))), out = '', c = 0;
    for (var i = s.length - 1; i >= 0; i--) {
      out = s[i] + out;
      if (++c % 3 === 0 && i > 0) out = (sep === undefined ? NBSP : sep) + out;
    }
    return (v < 0 ? '-$' : '$') + out;
  }
  /* Ставка в узбекском и русском написании: десятичная запятая. */
  function rateText(r) { return String(num(r, 0)).replace('.', ','); }
  function areaText(a, sep) {
    var s = String(Math.round(num(a, 0))), out = '', c = 0;
    for (var i = s.length - 1; i >= 0; i--) {
      out = s[i] + out;
      if (++c % 3 === 0 && i > 0) out = (sep === undefined ? NBSP : sep) + out;
    }
    return out;
  }

  function complexityOf(list, key) {
    var t = list || DEFAULT_COMPLEXITY;
    for (var i = 0; i < t.length; i++) if (t[i].key === key) return t[i];
    return null;
  }

  function tariffOf(list, code) {
    var t = list || DEFAULT_TARIFFS;
    for (var i = 0; i < t.length; i++) if (t[i].code === code || t[i].key === code) return t[i];
    return null;
  }

  /* Разложение суммы по долям без потери копеек: округляем каждую часть, а остаток
     отдаём последней. Иначе три раза по 30% от нечётной суммы не сложатся в целое, и в
     договоре появится строка, которая не сходится с итогом. */
  function allocate(amount, plan) {
    var total = Math.round(num(amount, 0)), acc = 0, out = [];
    plan.forEach(function (p, i) {
      var v = (i === plan.length - 1) ? (total - acc) : Math.round(total * p.percent / 100);
      acc += v;
      out.push({ key: p.key, percent: p.percent, amount: v, trigger: p.trigger || null, uz: p.uz, ru: p.ru });
    });
    return out;
  }

  function calc(input) {
    var o = input || {};
    var cfg = {
      minFee: num(o.minFee, DEFAULTS.minFee),
      hourly: num(o.hourly, DEFAULTS.hourly),
      minMonths: num(o.minMonths, DEFAULTS.minMonths)
    };
    var tariffs = o.tariffs || DEFAULT_TARIFFS;
    var tariff = tariffOf(tariffs, o.tariff) || null;

    var area = num(o.area, 0);
    var listRate = tariff ? num(tariff.rate, 0) : 0;
    /* Ставка: стандартная, пока её явно не назначили. Ноль - допустимое ручное значение,
       поэтому проверяем именно «задано ли поле», а не его истинность. */
    var manualRate = (o.rate === null || o.rate === undefined || o.rate === '') ? null : num(o.rate, null);
    var rate = manualRate === null ? listRate : manualRate;

    var raw = area * rate;

    /* Сложность: либо прямое число, либо набор надбавок. Прямое значение выигрывает -
       оно результат решения, а не арифметики. Применяется ДО минимальной суммы и ДО
       скидки: сложность формирует цену, скидка - уступка уже с неё. */
    var factors = [];
    (o.complexityFactors || []).forEach(function (f) {
      var found = (typeof f === 'string')
        ? complexityOf(o.complexityCatalog || DEFAULT_COMPLEXITY, f)
        : f;
      if (found && isFinite(parseFloat(found.delta))) factors.push(found);
    });
    var fromFactors = 1;
    factors.forEach(function (f) { fromFactors += parseFloat(f.delta); });
    var manualComplexity = (o.complexity === null || o.complexity === undefined || o.complexity === '')
      ? null : parseFloat(String(o.complexity).replace(',', '.'));
    if (manualComplexity !== null && !isFinite(manualComplexity)) manualComplexity = null;
    /* Округляем до сотых: 0.2 + 0.15 в двоичной арифметике даёт 1.3499999999999999, и это
       число попало бы и в формулу документа, и в объяснение клиенту. Коэффициент - величина,
       которую называют вслух, поэтому две значащие цифры после запятой и есть его точность. */
    fromFactors = Math.round(fromFactors * 100) / 100;
    var complexity = manualComplexity === null ? fromFactors : Math.round(manualComplexity * 100) / 100;
    var complexityClamped = false;
    if (complexity < COMPLEXITY_FLOOR) { complexity = COMPLEXITY_FLOOR; complexityClamped = true; }

    var adjusted = raw * complexity;
    var base = Math.max(adjusted, cfg.minFee);
    var minApplied = adjusted < cfg.minFee;

    /* Скидка: либо процент, либо абсолютная сумма. Если заданы обе, выигрывает абсолютная -
       она конкретнее и обычно является результатом переговоров, а не политики. */
    var discPercent = num(o.discountPercent, 0);
    var discAmount = num(o.discountAmount, 0);
    var discountKind = discAmount > 0 ? 'amount' : (discPercent > 0 ? 'percent' : null);
    var discountValue = discAmount > 0 ? discAmount : Math.round(base * discPercent / 100);
    if (discountValue > base) discountValue = base;   /* в минус не уходим */
    var billable = base - discountValue;
    /* ТЗ: «display to whole USD, store exact». Делим и печатаем округлённое - иначе при
       дробной сумме (2055 м² по 2,5 дают 5137,5) три части графика в сумме дают 5138 и
       расходятся с итогом. В договоре такая строка - повод для вопроса. */
    var billableUsd = Math.round(billable);

    var monthsAsked = num(o.months, 0);
    var months = monthsAsked > 0 ? Math.max(monthsAsked, cfg.minMonths) : 0;
    var monthly = num(o.monthly, DEFAULTS.monthly);
    var supervision = months * monthly;

    var hours = num(o.hours, 0);
    var extra = hours * cfg.hourly;

    var computedTotal = billable + supervision + extra;
    /* Итог тоже можно назначить руками: иногда сумма согласована целиком, и обратный
       пересчёт ставки был бы фикцией. Такое переопределение всегда отклонение. */
    var manualTotal = (o.totalOverride === null || o.totalOverride === undefined || o.totalOverride === '')
      ? null : num(o.totalOverride, null);
    var total = manualTotal === null ? computedTotal : manualTotal;

    /* Всё, что отличается от стандарта. Интерфейс по этому списку требует объяснение,
       журнал предложения - записывает. */
    var deviations = [];
    if (tariff && manualRate !== null && manualRate !== listRate) {
      deviations.push({
        key: 'rate', ru: 'Ставка изменена вручную',
        from: listRate, to: rate,
        detail: 'прайс ' + rateText(listRate) + ', назначено ' + rateText(rate) + ' USD/м²'
      });
    }
    if (complexity !== 1) {
      deviations.push({
        key: 'complexity', ru: complexity > 1 ? 'Применён коэффициент сложности' : 'Применён понижающий коэффициент',
        from: raw, to: adjusted,
        detail: 'коэффициент ' + rateText(complexity)
          + (factors.length ? ' (' + factors.map(function (f) {
              return f.ru + ' ' + (f.delta > 0 ? '+' : '') + Math.round(f.delta * 100) + '%';
            }).join(', ') + ')' : ' назначен вручную')
      });
    }
    if (complexityClamped) {
      deviations.push({
        key: 'complexity_floor', ru: 'Коэффициент сложности поднят до нижней границы',
        from: manualComplexity === null ? fromFactors : manualComplexity, to: COMPLEXITY_FLOOR,
        detail: 'ниже ' + rateText(COMPLEXITY_FLOOR) + ' коэффициент не применяется'
      });
    }
    if (discountValue > 0) {
      deviations.push({
        key: 'discount', ru: 'Предоставлена скидка',
        from: base, to: billable,
        detail: discountKind === 'percent'
          ? discPercent + '% от базовой суммы, ' + usd(discountValue)
          : 'фиксированная скидка ' + usd(discountValue)
      });
    }
    if (billable < cfg.minFee && billable !== base) {
      deviations.push({
        key: 'below_min', ru: 'Итог ниже минимальной суммы',
        from: cfg.minFee, to: billable,
        detail: 'минимум ' + usd(cfg.minFee) + ', к оплате ' + usd(billable)
      });
    }
    if (manualTotal !== null && manualTotal !== computedTotal) {
      deviations.push({
        key: 'total', ru: 'Итог назначен вручную',
        from: computedTotal, to: manualTotal,
        detail: 'расчёт ' + usd(computedTotal) + ', назначено ' + usd(manualTotal)
      });
    }
    if (monthsAsked > 0 && monthsAsked < cfg.minMonths) {
      deviations.push({
        key: 'months_raised', ru: 'Срок надзора поднят до минимального',
        from: monthsAsked, to: months,
        detail: 'запрошено ' + monthsAsked + ', минимум ' + cfg.minMonths + ' мес.'
      });
    }
    if (tariff && tariff.unconfirmed) {
      deviations.push({
        key: 'unconfirmed_rate', ru: 'Ставка тарифа не подтверждена прайсом',
        from: null, to: listRate,
        detail: 'тариф «' + tariff.name + '»: ставку нужно сверить с прайс-листом'
      });
    }

    return {
      version: VERSION,
      currency: o.currency || DEFAULTS.currency,
      tariff: tariff,
      area: area,
      listRate: listRate,
      rate: rate,
      rateIsManual: manualRate !== null && manualRate !== listRate,
      raw: cents(raw),
      complexity: complexity,
      complexityFactors: factors,
      complexityFromFactors: fromFactors,
      complexityIsManual: manualComplexity !== null,
      adjusted: cents(adjusted),
      base: cents(base),
      minFee: cfg.minFee,
      minApplied: minApplied,
      discountKind: discountKind,
      discountPercent: discPercent,
      discountValue: cents(discountValue),
      billable: cents(billable),
      months: months,
      monthsAsked: monthsAsked,
      monthly: monthly,
      supervision: cents(supervision),
      hours: hours,
      hourly: cfg.hourly,
      extra: cents(extra),
      computedTotal: cents(computedTotal),
      total: cents(total),
      totalIsManual: manualTotal !== null && manualTotal !== computedTotal,
      /* Ценностная разбивка и график - от billable, то есть от того, что платят на самом
         деле. Считать их от base значило бы показать в договоре суммы, которых нет. */
      billableUsd: billableUsd,
      totalUsd: Math.round(total),
      split: allocate(billableUsd, SPLIT_PLAN),
      schedule: allocate(billableUsd, SCHEDULE_PLAN),
      deviations: deviations,
      needsReason: deviations.some(function (d) {
        return d.key === 'rate' || d.key === 'discount' || d.key === 'total'
      || d.key === 'below_min' || d.key === 'complexity';
      }),
      formula: areaText(area) + ' м² × ' + rateText(rate) + ' USD/м²'
        + (complexity !== 1 ? ' × ' + rateText(complexity) : '') + ' = ' + usd(adjusted),
      minNote: minApplied
        ? 'Применена минимальная сумма ' + usd(cfg.minFee) + ' (расчёт ' + usd(adjusted) + ').'
        : ''
    };
  }

  /* Строки для документа: одна точка сборки, чтобы A4 и презентация не разошлись. */
  /* Строки документа обязаны складываться в итог. Раньше основная услуга показывалась уже
     со скидкой, а скидка шла ещё и отдельной строкой: клиент видел вычет дважды, а сумма
     столбца не сходилась с итогом - лучший способ получить вопрос на подписании. */
  function lines(r) {
    var out = [{ key: 'base', ru: 'Основная услуга', amount: r.base, note: r.formula }];
    if (r.discountValue > 0) out.push({ key: 'discount', ru: 'Скидка', amount: -r.discountValue, note: '' });
    if (r.supervision > 0) out.push({ key: 'supervision', ru: 'Авторский надзор', amount: r.supervision, note: r.months + ' мес. × ' + usd(r.monthly) });
    if (r.extra > 0) out.push({ key: 'extra', ru: 'Сверхнормативное время', amount: r.extra, note: r.hours + ' ч × ' + usd(r.hourly) });
    return out;
  }

  window.CASE_OFFER_PRICING = {
    version: VERSION,
    calc: calc,
    lines: lines,
    usd: usd,
    rateText: rateText,
    areaText: areaText,
    allocate: allocate,
    TARIFFS: DEFAULT_TARIFFS,
    COMPLEXITY: DEFAULT_COMPLEXITY,
    COMPLEXITY_FLOOR: COMPLEXITY_FLOOR,
    DEFAULTS: DEFAULTS,
    SPLIT_PLAN: SPLIT_PLAN,
    SCHEDULE_PLAN: SCHEDULE_PLAN,
    NBSP: NBSP
  };
  window.CASE_MODULE_VERSIONS = window.CASE_MODULE_VERSIONS || {};
  window.CASE_MODULE_VERSIONS['v4670-offer-pricing'] = VERSION;
})();
