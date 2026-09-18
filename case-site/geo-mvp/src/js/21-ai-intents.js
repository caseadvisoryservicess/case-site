/* ===========================================================================
 * 21-ai-intents — the deterministic intent parser
 *
 * Brief §54: the MVP AI is a keyword/pattern engine, not a language model. The
 * point is to validate the INTERACTION MODEL — what the assistant is allowed to
 * do, how it reports coverage, how it refuses — not to validate a model's
 * language ability. A real LLM drops in later behind the same `interpret()`
 * signature and emits the same Plan shape (§55).
 *
 * Slots are extracted first, independently of intent, so "only those above
 * $30" and "show me class A offices above $30 in Mirabad" share one number
 * parser and one district parser. Intents are then matched in order; the first
 * match wins, so specific patterns are listed before general ones.
 *
 * Russian is handled alongside English: CASE works in both, and a Tashkent
 * user will type either.
 * ========================================================================= */
(function (w) {
  'use strict';

  var GEO = w.GEO, S = GEO.schema;
  var I = GEO.ai.intents = {};

  /* ------------------------------------------------------------ normalise */
  function norm(s) {
    return String(s || '')
      .toLowerCase()
      .replace(/[’‘`]/g, "'")
      .replace(/[“”]/g, '"')
      .replace(/[––]/g, '-')
      .replace(/м2|м²|m²|sq\.?\s?m|кв\.?\s?м/g, 'm2')
      .replace(/\s+/g, ' ')
      .trim();
  }
  I.norm = norm;

  /* ---------------------------------------------------------------- slots */

  var CLASS_PAT = /\b(a\s?\+|a\+|class\s*a\+|a-?class|класс\s*a\+?|a|b\s?\+|b\+|b|c)\b/g;

  /** Office classes named in the utterance. Handles "A and A+", "class A/B+",
   *  "класс A". Bare letters are only accepted when the word class/класс is
   *  present, otherwise "a" in "a building" would match. */
  function classes(u) {
    var out = [];
    var mentionsClass = /\bclass|класс|категор/.test(u);
    // NOT `\b` at the end: in "A+" the "+" is a non-word character followed by a
    // space, so there is no word boundary after it and "A+" would silently degrade
    // to "A" – turning "Class A and A+" into a filter for A alone.
    var re = /\b(a\s*\+|b\s*\+|a|b|c)(?!\w)/g, m;
    while ((m = re.exec(u))) {
      var raw = m[1].replace(/\s+/g, '');
      var tag = raw.toUpperCase();
      if (!mentionsClass) continue;
      if (S.enums.officeClass.indexOf(tag) >= 0 && out.indexOf(tag) < 0) out.push(tag);
    }
    // "A" should also pull in "A+" only when the user said "A and A+" explicitly;
    // we never silently widen a class filter, because that changes the count.
    return out;
  }

  function districts(u) {
    var out = [];
    // Pad and strip punctuation so "in Mirabad." matches the alias " mirabad "
    // without also matching "mirabadsky" inside a longer word.
    var spaced = ' ' + u.replace(/[^\wа-яё]+/gi, ' ').replace(/\s+/g, ' ').trim() + ' ';
    GEO.data.districts().forEach(function (d) {
      // One alias table, owned by the schema, so the search box and the assistant
      // can never disagree about what "Mirabad" means (S.districtAliases).
      var names = [d.key, d.name, d.nameRu, d.nameUz]
        .concat(S.districtAliases[d.key] || [])
        .filter(Boolean);
      var hit = names.some(function (n) {
        var needle = ' ' + norm(n).replace(/[^\wа-яё]+/gi, ' ').replace(/\s+/g, ' ').trim() + ' ';
        return spaced.indexOf(needle) >= 0;
      });
      if (hit && out.indexOf(d.key) < 0) out.push(d.key);
    });
    return out;
  }

  var MORE = /(above|over|more than|greater than|larger than|bigger than|at least|from|>=|>|больше|более|свыше|от|выше)/;
  var LESS = /(below|under|less than|smaller than|cheaper than|at most|up to|<=|<|меньше|менее|дешевле|до|ниже)/;

  function number(token) {
    return parseFloat(String(token).replace(/[\s,]/g, '').replace(/[^\d.]/g, ''));
  }

  /**
   * Numeric comparisons with their unit, e.g. "above 5,000 m2", "rent under $30",
   * "more than 2000 m2 available". Returns [{field, op, value}].
   * The unit decides the field, because "above 5,000" alone is ambiguous and
   * guessing which field the user meant is exactly the kind of invention §47 forbids.
   */
  function comparisons(u) {
    var out = [];
    var re = /(above|over|more than|greater than|larger than|bigger than|at least|from|below|under|less than|smaller than|cheaper than|at most|up to|больше|более|свыше|от|выше|меньше|менее|дешевле|до|ниже|>=|<=|>|<)\s*\$?\s*([\d][\d\s,.]*)\s*(m2|sqm|usd|\$|%|percent|процент|floors?|этаж\w*|spaces?|мест)?/g;
    var m;
    while ((m = re.exec(u))) {
      var op = MORE.test(m[1]) ? 'gte' : (LESS.test(m[1]) ? 'lte' : null);
      if (!op) continue;
      var v = number(m[2]);
      if (isNaN(v)) continue;
      var unit = (m[3] || '').trim();
      var before = u.slice(Math.max(0, m.index - 40), m.index);
      // English puts the qualifier either side of the number: "available space above
      // 2,000 m2" and "more than 2,000 m2 available" mean the same thing, and only the
      // second one has it AFTER the unit.
      var after = u.slice(m.index + m[0].length, m.index + m[0].length + 24);
      var near = before + ' ' + after;
      var field = null;

      if (unit === 'm2' || unit === 'sqm') {
        field = /availab|свобод|вакант/.test(near) ? 'availableArea' : 'gla';
      } else if (unit === 'usd' || unit === '$' || /\$/.test(m[0])) {
        field = 'askingRent';
      } else if (unit === '%' || /percent|процент/.test(unit)) {
        field = /occupan|заполн/.test(near) ? 'occupancyPct' : 'vacancyPct';
      } else if (/floor|этаж/.test(unit)) {
        field = 'floors';
      } else if (/space|мест/.test(unit)) {
        field = 'parkingSpaces';
      } else if (/rent|аренд|ставк|price|цен/.test(near)) {
        field = 'askingRent';
      } else if (/gla|size|area|площад|размер/.test(near)) {
        field = 'gla';
      } else if (/vacan|вакант/.test(near)) {
        field = 'vacancyPct';
      } else if (/occupan|заполн/.test(near)) {
        field = 'occupancyPct';
      } else if (/floor|этаж/.test(near)) {
        field = 'floors';
      }
      if (field) out.push({ field: field, op: op, value: v });
    }
    return out;
  }

  function radiusKm(u) {
    var m = /(?:within|in|inside|radius of|around|в радиусе|в пределах)\s*([\d.]+)\s*(km|км|m\b|м\b)/.exec(u) ||
            /([\d.]+)\s*(km|км)\b/.exec(u);
    if (!m) return null;
    var v = parseFloat(m[1]);
    if (isNaN(v)) return null;
    return /m\b|м\b/.test(m[2]) && !/km|км/.test(m[2]) ? v / 1000 : v;
  }

  function topN(u) {
    var words = { one: 1, two: 2, three: 3, four: 4, five: 5,
                  два: 2, две: 2, три: 3, четыре: 4, пять: 5 };
    var m = /\b(?:top|largest|biggest|highest|first|три|топ)\s*(\d+|one|two|three|four|five|два|две|три|четыре|пять)?\b/.exec(u);
    if (m && m[1]) return words[m[1]] || parseInt(m[1], 10) || null;
    var w = /\b(one|two|three|four|five|два|две|три|четыре|пять)\b/.exec(u);
    if (w && /largest|biggest|highest|compare|сравн|крупнейш|самых/.test(u)) return words[w[1]];
    return null;
  }

  function confidence(u) {
    var out = [];
    if (/\blow[- ]confidence|low confidence|низк\w* (?:уверенн|достоверн)/.test(u)) out.push('Low');
    if (/\bunverified|not verified|unknown confidence|непровер/.test(u)) out.push('Unknown');
    if (/\bhigh[- ]confidence|высок\w* (?:уверенн|достоверн)/.test(u)) out.push('High');
    return out;
  }

  function status(u) {
    var out = [];
    if (/under construction|being built|строящ|в стро/.test(u)) out.push('Under construction');
    if (/\bplanned|pipeline|планир|проект/.test(u)) {
      out.push('Planned');
      if (out.indexOf('Under construction') < 0 && /pipeline/.test(u)) out.push('Under construction');
    }
    if (/\boperating|existing|operational|действующ|существующ/.test(u)) out.push('Operating');
    if (/renovat|реконстру|ремонт/.test(u)) out.push('Renovation');
    return out;
  }

  function months(u) {
    var m = /(\d+)\s*(month|months|мес\w*)/.exec(u);
    return m ? parseInt(m[1], 10) : null;
  }

  I.slots = function (u) {
    return {
      classes: classes(u),
      districts: districts(u),
      comparisons: comparisons(u),
      radiusKm: radiusKm(u),
      topN: topN(u),
      confidence: confidence(u),
      status: status(u),
      months: months(u),
      mentionsGla: /\bgla\b|floor area|size|square met|m2|площад|размер/.test(u),
      mentionsRent: /\brent\b|rental|asking|price|аренд|ставк|цен/.test(u),
      mentionsVacancy: /vacan|вакант/.test(u),
      mentionsOccupancy: /occupan|заполн/.test(u),
      mentionsTenants: /tenant|аренда тор|арендатор/.test(u),
      byDistrict: /by district|per district|each district|which district|по район|districts/.test(u),
      byClass: /by class|per class|each class|which class|по класс/.test(u),
      demonstrative: /\b(its|it's|this|these|that|his|her|their|эт\w+|его|её|их)\b/.test(u)
    };
  };

  /* ----------------------------------------------- unsupported concepts */
  /* §62: the best answer is sometimes "the current dataset is insufficient".
     These match BEFORE the catalogue and override every other intent, because
     each names a concept the platform architecture anticipates (§31 phases 4-5)
     but this dataset cannot support. The danger is not silence – it is answering
     a NEARBY question and letting the user believe it was the one they asked.
     "Which cluster has the highest employee density?" would otherwise match the
     cluster intent and return a count of buildings, which is a different
     question wearing the same words. */
  I.unsupported = [
    { key: 'employeeDensity',
      re: /employee density|workforce|headcount|staff per|employees per|плотност\w* сотрудник|численност\w* персонал/,
      required: 'occupancy or workforce figures per building' },
    { key: 'footfall',
      re: /footfall|foot traffic|pedestrian|visitor count|проходимост|пешеходн|посетител/,
      required: 'pedestrian counts or mobile-location data' },
    { key: 'demographics',
      re: /population|demographic|catchment population|purchasing power|median income|населен|демограф|покупательн\w* способност|доход\w* населен/,
      required: 'a population and income grid for Tashkent' },
    { key: 'driveTime',
      re: /drive[- ]time|isochrone|travel time|\d+[- ]minute (?:drive|walk)|изохрон|время в пути|транспортн\w* доступност/,
      required: 'a routing engine and a road network' },
    { key: 'metro',
      re: /\bmetro\b|\bsubway\b|underground station|metro station|\bметро\b|станци\w* метро/,
      required: 'a verified metro-station dataset – none is loaded in this build, and station coordinates were not invented' },
    { key: 'transactions',
      re: /transaction|take[- ]up|absorption|signed rent|deal volume|сделк|поглощен|подписанн\w* ставк/,
      required: 'a transactions register; this dataset holds advertised asking rents only' },
    { key: 'forecast',
      re: /forecast|predict|projection|next year|will rents|прогноз|спрогнозир|что будет/,
      required: 'a historical time series; this dataset has a single collection date' },
    { key: 'valuation',
      re: /valuation|cap rate|yield|what is it worth|price per m2 sale|оценк\w* стоимост|доходност|капитализац/,
      required: 'sale evidence and yields; this dataset holds asking rents only' }
  ];

  /* -------------------------------------------------------------- intents */
  /* Order matters: specific before general. Each entry declares a matcher and a
     plan builder. The plan is data – the engine executes it – so the same plan
     shape works whether it came from this parser or from a language model. */

  I.catalogue = [
    {
      id: 'clear_analysis',
      examples: ['Remove this analysis and return to all business centres',
                 'Clear all layers', 'Start over', 'Сбросить всё'],
      match: function (u) {
        // `\b` is ASCII-only in JS, so the Cyrillic branch is written without it.
        return /(remove|clear|reset|delete|drop)\b[^.]*\b(analysis|layers?|filters?|everything|all)\b/.test(u) ||
               /(убр|сброс|очист|удали)[а-яё]*[^.]*(анализ|сло[а-яё]*|фильтр[а-яё]*|всё|все)/.test(u) ||
               /back to all|return to all|show all (business centres|business centers|properties)|все объект/.test(u);
      },
      plan: function () {
        return { intent: 'clear_analysis', steps: [
          { tool: 'removeLayer', args: {} },
          { tool: 'removeRadius', args: {} },
          { tool: 'clearFilters', args: {} }
        ], resetContext: true };
      }
    },

    {
      id: 'competitors',
      examples: ['Show its competitors within 3 km', 'Find competitors around this building',
                 'Create a 5 km competitor zone around this property', 'Кто конкуренты рядом?'],
      match: function (u) { return /competitor|competitive|конкурент|рядом с/.test(u); },
      needsSelection: true,
      plan: function (u, sl, ctx) {
        var km = sl.radiusKm || GEO.geo.COMPETITIVE_BAND_KM;
        return { intent: 'competitors', subjectId: ctx.selectedId, radiusKm: km,
                 steps: [{ tool: 'createRadius', args: { id: ctx.selectedId, bandsKm: [1, km, 5].filter(function (v, i, a) { return a.indexOf(v) === i; }).sort(function (a, b) { return a - b; }) } }] };
      }
    },

    {
      id: 'location_analysis',
      examples: ['Analyse this location', 'What is around this building?', 'Что рядом?'],
      match: function (u) { return /analys|analyz|around|nearby|location analysis|окружени|поблизост|анализ локац/.test(u); },
      needsSelection: true,
      plan: function (u, sl, ctx) {
        return { intent: 'location_analysis', subjectId: ctx.selectedId,
                 steps: [{ tool: 'createRadius', args: { id: ctx.selectedId } }] };
      }
    },

    {
      id: 'rank_districts',
      examples: ['Which district has the most Class A offices?', 'Show office supply by district',
                 'Show average known rent by district', 'В каком районе больше всего офисов класса А?'],
      match: function (u, sl) {
        return sl.byDistrict && /which|most|highest|rank|supply|average|median|top|как|больш|сколько|средн/.test(u);
      },
      plan: function (u, sl) {
        var measure = null, kind = 'count';
        if (sl.mentionsGla) { measure = 'gla'; kind = 'sum'; }
        else if (sl.mentionsRent) { measure = 'askingRent'; kind = /median|медиан/.test(u) ? 'median' : 'mean'; }
        else if (sl.mentionsVacancy) { measure = 'vacancyPct'; kind = 'mean'; }
        var filters = {};
        if (sl.classes.length) filters.classes = sl.classes;
        if (sl.status.length) filters.statuses = sl.status;
        return { intent: 'rank_districts', measure: measure, kind: kind, filters: filters,
                 steps: [{ tool: 'aggregateByDistrict', args: { measure: measure, kind: kind } }] };
      }
    },

    {
      id: 'rank_classes',
      examples: ['How many of each class?', 'Show the class mix', 'Распределение по классам'],
      match: function (u, sl) { return sl.byClass; },
      plan: function (u, sl) {
        var measure = sl.mentionsRent ? 'askingRent' : (sl.mentionsGla ? 'gla' : null);
        return { intent: 'rank_classes', measure: measure,
                 steps: [{ tool: 'aggregateByClass', args: { measure: measure, kind: measure ? 'mean' : 'count' } }] };
      }
    },

    {
      id: 'compare',
      examples: ['Compare the three largest properties currently on the map',
                 'Compare the three highest known asking rents', 'Compare these properties',
                 'Сравни три самых дорогих'],
      match: function (u) { return /\bcompare\b|comparison|сравн/.test(u); },
      plan: function (u, sl, ctx) {
        var n = sl.topN || 3;
        var by = null, dir = 'desc';
        if (/largest|biggest|крупнейш|больш/.test(u) && !sl.mentionsRent) by = 'gla';
        else if (/highest|most expensive|dearest|дорог|высок/.test(u) || sl.mentionsRent) by = 'askingRent';
        else if (/cheapest|lowest|дешев|низк/.test(u)) { by = 'askingRent'; dir = 'asc'; }
        return { intent: 'compare', rankBy: by, direction: dir, count: n,
                 useSelection: !by && (sl.demonstrative || /these|selected|эти/.test(u)),
                 steps: [] };
      }
    },

    {
      id: 'data_quality',
      examples: ['Show properties with poor data quality', 'Show low-confidence properties',
                 'Show business centres with low-confidence rent data', 'Где плохие данные?'],
      match: function (u) {
        return /poor data|data quality|low[- ]confidence|unreliable|incomplete|missing data|плох\w* данн|качеств\w* данн|неполн/.test(u);
      },
      plan: function (u, sl) {
        return { intent: 'data_quality', confidence: sl.confidence,
                 steps: [{ tool: 'showDataQuality', args: {} }] };
      }
    },

    {
      id: 'verification',
      examples: ['Which buildings need data verification?',
                 'Show office buildings that have not been verified for more than six months',
                 'Which business centres should we recheck this week?', 'Что нужно перепроверить?'],
      match: function (u) {
        return /verif|recheck|re-check|refresh|stale|out of date|провер|перепровер|устарел|обнов/.test(u);
      },
      plan: function (u, sl) {
        return { intent: 'verification', months: sl.months,
                 steps: [{ tool: 'getVerificationQueue', args: { limit: 20 } }] };
      }
    },

    {
      id: 'clusters',
      examples: ['Show the largest office clusters', 'Where are the office clusters?',
                 'Покажи кластеры офисов'],
      match: function (u) { return /cluster|concentration|densit|кластер|концентрац|плотност/.test(u); },
      plan: function () { return { intent: 'clusters', steps: [] }; }
    },

    {
      id: 'coverage',
      examples: ['What data do you actually have?', 'Show data coverage', 'Какие данные есть?'],
      match: function (u) { return /coverage|what data|how much data|data do you have|какие данн|полнот/.test(u); },
      plan: function () { return { intent: 'coverage', steps: [{ tool: 'getDataCoverage', args: {} }] }; }
    },

    {
      id: 'export',
      examples: ['Export these results', 'Download the list', 'Выгрузи результаты'],
      match: function (u) { return /export|download|csv|выгруз|скача|экспорт/.test(u); },
      plan: function (u) {
        return { intent: 'export',
                 steps: [{ tool: 'exportResults', args: { format: /json/.test(u) ? 'json' : 'csv' } }] };
      }
    },

    {
      id: 'find_property',
      examples: ['Find Trilliant', 'Where is Nest one?', 'Покажи Forum Business Center'],
      match: function (u, sl) {
        return /^(find|show me|where is|open|select|locate|найди|где|покажи)\s+[^\s]/.test(u) &&
               !sl.classes.length && !sl.districts.length && !sl.comparisons.length &&
               !/all|every|districts?|class|все|район|класс/.test(u);
      },
      plan: function (u) {
        var q = u.replace(/^(find|show me|show|where is|open|select|locate|найди|где|покажи)\s+/, '')
                 .replace(/\?$/, '').trim();
        return { intent: 'find_property', query: q,
                 steps: [{ tool: 'searchProperties', args: { q: q, limit: 5 } }] };
      }
    },

    {
      /* The general filter intent. Last, because almost anything mentioning a
         class, a district, a threshold or a status can be expressed as a filter. */
      id: 'filter',
      examples: ['Show Class A and A+ business centres', 'Show offices in Mirabad',
                 'Show buildings larger than 5,000 m2', 'Show business centres with rent above $30',
                 'Only those with known rent above $30', 'Show buildings currently under construction',
                 'Show only properties with more than 2,000 m2 available',
                 'Покажи офисы класса А в Мирабаде'],
      match: function (u, sl) {
        return sl.classes.length || sl.districts.length || sl.comparisons.length ||
               sl.status.length || sl.confidence.length ||
               /^(show|display|filter|only|покажи|показать|только|отфильтр)/.test(u);
      },
      plan: function (u, sl, ctx) {
        var f = {};
        if (sl.classes.length) f.classes = sl.classes;
        if (sl.districts.length) f.districts = sl.districts;
        if (sl.status.length) f.statuses = sl.status;
        if (sl.confidence.length) f.confidence = sl.confidence;
        var shape = GEO.state.defaults().filters;
        var unsupportedFilters = [];
        sl.comparisons.forEach(function (c) {
          var map = { gla: ['glaMin', 'glaMax'], askingRent: ['rentMin', 'rentMax'],
                      vacancyPct: ['vacancyMin', 'vacancyMax'],
                      occupancyPct: [null, null],
                      parkingSpaces: ['parkingMin', null], availableArea: [null, null],
                      floors: [null, null] };
          var pair = map[c.field];
          var key = pair && (c.op === 'gte' ? pair[0] : pair[1]);
          // A filter key the state shape does not carry would be written and then
          // silently ignored – a control that appears to work and does not (§29).
          if (!key || !(key in shape)) {
            unsupportedFilters.push({ field: c.field, op: c.op, value: c.value });
            return;
          }
          f[key] = c.value;
        });

        // "only …" continues the current selection rather than starting over (§58).
        var narrowing = /^(only|just|narrow|and only|также только|только)/.test(u) ||
                        (sl.demonstrative && !sl.districts.length);

        return { intent: 'filter', filters: f, narrowing: narrowing,
                 requiredFields: sl.comparisons.map(function (c) { return c.field; }),
                 unsupportedFilters: unsupportedFilters,
                 steps: [{ tool: 'applyFilters', args: { filters: f, replace: !narrowing } }] };
      }
    }
  ];

  /**
   * The provider seam (§55). A real LLM adapter implements exactly this signature
   * and returns the same Plan shape; nothing above this line knows which one ran.
   */
  I.interpret = function (utterance, ctx) {
    var u = norm(utterance);
    if (!u) return { intent: 'empty', steps: [] };

    var sl = I.slots(u);

    for (var k = 0; k < I.unsupported.length; k++) {
      if (I.unsupported[k].re.test(u)) {
        return { intent: 'unsupported', concept: I.unsupported[k].key,
                 required: I.unsupported[k].required, steps: [],
                 slots: sl, utterance: utterance, matched: 'unsupported:' + I.unsupported[k].key };
      }
    }

    for (var i = 0; i < I.catalogue.length; i++) {
      var c = I.catalogue[i];
      if (!c.match(u, sl, ctx)) continue;
      if (c.needsSelection && !ctx.selectedId) {
        return {
          intent: c.id, steps: [], needsSelection: true,
          error: 'That refers to a property ("its", "this building"), but nothing is selected. ' +
                 'Select a property on the map or in the list, then ask again.'
        };
      }
      var plan = c.plan(u, sl, ctx) || {};
      plan.matched = c.id;
      plan.slots = sl;
      plan.utterance = utterance;
      return plan;
    }

    return {
      intent: 'unknown', steps: [], slots: sl, utterance: utterance,
      unknown: true
    };
  };

  /** Everything the parser can do, for the suggested-prompt chips and the
   *  "what can I ask?" answer. Generated from the catalogue so it can never
   *  advertise an intent that is not implemented (§29). */
  I.examples = function () {
    return I.catalogue.map(function (c) {
      return { id: c.id, examples: c.examples };
    });
  };
}(window));
