/* ===========================================================================
 * 22-ai-engine — plan execution and response construction
 *
 * Brief §46 (mandatory response structure), §47 (must not hallucinate),
 * §58 (session context), §61 (audit log), §62 (knowing when it cannot answer).
 *
 * The engine is deliberately boring: it takes a Plan from the interpreter,
 * calls tools from the registry, and assembles a response object with all six
 * §46 blocks always present. It never formats a number itself — every figure
 * comes from a metric object that already carries its own denominator, so an
 * answer physically cannot state a number without stating its coverage.
 *
 * "I cannot answer that from this data" is a first-class SUCCESS path here, not
 * an error path. With GLA recorded for 0 of 148 observed records, it is also
 * the correct answer to several of the brief's own example questions.
 * ========================================================================= */
(function (w) {
  'use strict';

  var GEO = w.GEO, U = GEO.util, S = GEO.schema, A = GEO.analytics, F = GEO.fmt;
  var AI = GEO.ai;

  /* Provenance labelling required by §2.8 / §47 / §48. Every figure the assistant
     states is tagged with where it came from, so a reader never has to guess
     whether a number was measured, derived or assumed. */
  AI.ORIGIN = {
    PLATFORM: 'PLATFORM DATA',
    CALCULATED: 'CALCULATED',
    EXTERNAL: 'EXTERNAL RESEARCH',
    INFERENCE: 'AI INFERENCE',
    ASSUMPTION: 'ASSUMPTION',
    UNAVAILABLE: 'UNAVAILABLE'
  };

  function blank(intent) {
    return {
      intent: intent || 'unknown',
      // The six §46 blocks. Always present. When a block is empty it says why,
      // because an omitted "Data coverage" block reads as "coverage is fine".
      answer: '',
      analysis: [],
      mapActions: [],
      dataCoverage: '',
      limitations: [],
      sources: [],
      // supporting
      origin: AI.ORIGIN.PLATFORM,
      unavailable: false,
      resultIds: null,
      resultCount: null,
      table: null,
      chart: null,
      suggestions: [],
      trace: { intent: null, slots: null, tools: [], durationMs: 0 }
    };
  }

  function sourcesFor(rows) {
    var res = AI.call('getSources', { rowIds: rows.map(function (r) { return r.id; }) }, ctx());
    if (!res.ok || !res.sources) return [];
    return res.sources.map(function (s) {
      return s.source + ' — ' + s.fields.length + ' ' + F.plural(s.fields.length, 'field') +
             ' across ' + F.int(s.recordCount) + ' ' + F.plural(s.recordCount, 'record') +
             ', collected ' + F.date(s.collectedAt) + ', confidence ' + s.confidence;
    });
  }

  function ctx(extra) {
    var s = GEO.state.get();
    return Object.assign({ state: s, role: s.role, selectedId: s.selectedId, confirmed: false }, extra || {});
  }

  function demoWarning(rows) {
    var n = rows.filter(function (r) { return r.recordType === 'DEMO'; }).length;
    if (!n) return null;
    return n + ' of the ' + F.int(rows.length) + ' ' + F.plural(rows.length, 'property', 'properties') +
           ' in this answer ' + F.plural(n, 'is a DEMO record', 'are DEMO records') +
           ' — fictional values included so the prototype can be tested. They are not market evidence.';
  }

  /* --------------------------------------------------------------- refusal */
  /**
   * §62. The most important behaviour in the whole assistant: say plainly that
   * the data cannot support the question, name what is missing with real
   * numbers, leave the user's existing selection alone, and offer something
   * that CAN be answered.
   */
  function refuse(out, gate, alternatives) {
    out.unavailable = true;
    out.origin = AI.ORIGIN.UNAVAILABLE;
    out.answer = gate.answer;
    out.dataCoverage = S.label(gate.field) + ': ' + gate.coverage.n + ' of ' +
                       gate.coverage.N + ' properties in the current selection.';
    out.limitations.push('No figure has been produced, and the previous selection is unchanged.');
    if (gate.required) out.limitations.push('To answer this we would need: ' + gate.required);
    out.suggestions = alternatives || [];
    return out;
  }

  /* ------------------------------------------------------------- execution */
  AI.ask = function (utterance) {
    var t0 = (w.performance && w.performance.now) ? w.performance.now() : 0;
    var c = ctx();
    var plan = AI.intents.interpret(utterance, c);
    var out = blank(plan.intent);
    out.trace.intent = plan.matched || plan.intent;
    out.trace.slots = plan.slots || null;

    var scope = AI._scope(c);
    var current = AI._currentRows(c);

    try {
      out = dispatch(plan, out, c, scope, current);
    } catch (e) {
      GEO.log.error('assistant failed', e);
      out.answer = 'Something went wrong while answering that. The dataset has not been changed.';
      out.limitations.push(String(e && e.message || e));
    }

    out.trace.durationMs = ((w.performance && w.performance.now) ? w.performance.now() : 0) - t0;

    // §58: remember what "those" refers to next turn.
    var s = GEO.state.get();
    GEO.state.set({
      aiSession: {
        turns: s.aiSession.turns.concat([{ q: utterance, a: out.answer, intent: out.intent,
                                           at: new Date().toISOString() }]),
        lastResultIds: out.resultIds,
        lastIntent: out.intent
      },
      aiUnread: s.rightTab !== 'ai' || s.rightRail !== 'open'
    }, { source: 'ai', action: 'ai:answer', tools: out.trace.tools,
         summary: utterance + ' → ' + out.intent });

    return out;
  };

  function record(out, res) {
    out.trace.tools.push({ tool: res.tool, args: res.args, ok: res.ok });
    if (res.mapAction) out.mapActions.push(res.mapAction);
    return res;
  }

  function finish(out, rows, coverageFields) {
    out.resultIds = rows.map(function (r) { return r.id; });
    out.resultCount = rows.length;
    if (!out.dataCoverage) {
      var parts = (coverageFields || []).map(function (f) {
        var cv = A.coverage(rows, f);
        return S.label(f) + ' is recorded for ' + cv.n + ' of ' + cv.N + ' matching ' +
               F.plural(cv.N, 'property', 'properties') +
               (cv.N - cv.n ? '. ' + (cv.N - cv.n) + ' have no recorded ' + F.lower(S.label(f)) +
                              ' and are excluded from any figure that uses it.' : '.');
      });
      out.dataCoverage = parts.join(' ') || A.coverageStatement(rows);
    }
    var dw = demoWarning(rows);
    if (dw) out.limitations.push(dw);
    if (!out.sources.length) out.sources = sourcesFor(rows.slice(0, 200));
    return out;
  }

  /* ---------------------------------------------------------- the dispatch */
  function dispatch(plan, out, c, scope, current) {
    switch (plan.intent) {

      case 'empty':
        out.answer = 'Ask a question about the dataset — for example "Show Class A business centres" ' +
                     'or "Which district has the most Class A offices?".';
        out.dataCoverage = A.coverageStatement(scope);
        out.suggestions = suggestions();
        return out;

      /* §62 — the best answer is sometimes that the data cannot support the
         question. Critically, this fires BEFORE any nearby intent could match:
         answering "highest employee density" with a count of buildings would be
         a different question wearing the same words, which is worse than a refusal. */
      case 'unsupported': {
        var nearest = {
          employeeDensity: 'occupancyPct', footfall: null, demographics: null,
          driveTime: null, metro: null, transactions: 'askingRent',
          forecast: 'askingRent', valuation: 'askingRent'
        }[plan.concept];

        out.unavailable = true;
        out.origin = AI.ORIGIN.UNAVAILABLE;
        out.answer = 'The current dataset is insufficient to answer this reliably. ' +
                     'That information is not held in this platform, and estimating it from ' +
                     'something else would not be evidence.';
        if (nearest) {
          var cv = A.coverage(scope, nearest);
          out.dataCoverage = 'The nearest field held is ' + F.lower(S.label(nearest)) +
                             ', recorded for ' + cv.n + ' of ' + cv.N + ' properties — ' +
                             'which answers a different question.';
        } else {
          out.dataCoverage = 'This platform holds ' + F.int(scope.length) +
                             ' Tashkent business centres with location, district and partial ' +
                             'class and asking-rent data. It holds nothing about ' + plan.concept + '.';
        }
        out.limitations.push('To answer this we would need: ' + plan.required + '.');
        out.limitations.push('Nothing on the map, in the filters or in the selection has changed.');
        out.suggestions = suggestions().slice(0, 3);
        return out;
      }

      case 'unknown':
        out.answer = 'I could not turn that into something I can run against the data. ' +
                     'This prototype uses a fixed set of commands rather than a language model, ' +
                     'so it understands a narrow range of questions precisely rather than a wide range vaguely.';
        out.origin = AI.ORIGIN.UNAVAILABLE;
        out.dataCoverage = A.coverageStatement(scope);
        out.limitations.push('No filter, layer or selection has been changed.');
        out.suggestions = suggestions();
        return out;

      /* ---------------------------------------------------------- filter */
      case 'filter': {
        var base = plan.narrowing ? current : scope;

        // Refuse before acting when the filter needs a field nobody has recorded.
        for (var i = 0; i < plan.requiredFields.length; i++) {
          var gate = AI._requireCoverage(base, plan.requiredFields[i], c);
          if (gate) {
            var alt = [];
            if (A.coverage(base, 'askingRent').n) alt.push('Only those with known rent above $30');
            alt.push('Which district has the most Class A and A+ offices?');
            alt.push('Show properties with poor data quality');
            refuse(out, gate, alt);
            out.answer = gate.answer + (plan.narrowing
              ? ' The previous selection (' + F.int(base.length) + ' ' +
                F.plural(base.length, 'property', 'properties') + ') is unchanged.'
              : '');
            out.resultIds = base.map(function (r) { return r.id; });
            out.resultCount = base.length;
            return out;
          }
        }

        if (plan.unsupportedFilters && plan.unsupportedFilters.length) {
          // A threshold we parsed but cannot express as a filter in this build. Say so
          // rather than applying the rest and letting the count look like it worked.
          var uf = plan.unsupportedFilters[0];
          out.unavailable = true;
          out.origin = AI.ORIGIN.UNAVAILABLE;
          out.answer = 'This build has no filter for ' + F.lower(S.label(uf.field)) +
                       ', so that threshold cannot be applied. Nothing has been changed.';
          out.dataCoverage = S.label(uf.field) + ' is recorded for ' +
                             A.coverage(base, uf.field).n + ' of ' + base.length + ' properties in view.';
          out.limitations.push('The filter panel exposes district, class, status, GLA, rent, vacancy, ' +
                               'parking, amenities, confidence, completeness and freshness. ' +
                               'Other fields are visible on a property but are not filterable in this prototype.');
          out.resultIds = base.map(function (r) { return r.id; });
          out.resultCount = base.length;
          return out;
        }

        var res = record(out, AI.call('applyFilters',
          { filters: plan.filters, replace: !plan.narrowing }, c));
        var rows = plan.narrowing
          ? GEO.filters.apply(base, Object.assign({}, GEO.state.defaults().filters, plan.filters))
          : (res.rows || []);

        if (plan.narrowing) {
          // Keep the panel in step with the narrowed set (§59).
          record(out, AI.call('applyFilters',
            { filters: Object.assign({}, c.state.filters, plan.filters), replace: false }, ctx()));
        }

        var name = GEO.filters.describe(plan.filters) || 'Filtered properties';
        record(out, AI.call('createLayer', {
          name: name, rowIds: rows.map(function (r) { return r.id; }),
          criteriaHuman: name, criteriaMachine: plan.filters
        }, ctx()));

        out.answer = F.int(rows.length) + ' ' + F.plural(rows.length, 'property', 'properties') +
                     ' match ' + name.toLowerCase() + '.';
        out.origin = AI.ORIGIN.PLATFORM;
        out.analysis = describeSet(rows);

        var covFields = [];
        if (plan.filters.classes) covFields.push('officeClass');
        if (plan.filters.rentMin !== undefined || plan.filters.rentMax !== undefined || plan.narrowing) covFields.push('askingRent');
        if (!covFields.length) covFields = ['officeClass', 'askingRent'];

        if (plan.filters.classes) {
          var noClass = base.length - A.withKnown(base, 'officeClass').length;
          if (noClass) {
            out.limitations.push(F.int(noClass) + ' ' + F.plural(noClass, 'property', 'properties') +
              ' in the dataset have no recorded office class. They are excluded from this result — ' +
              'that is an absence of data, not evidence that they are a different class.');
          }
        }
        return finish(out, rows, covFields);
      }

      /* ------------------------------------------------- rank_districts */
      case 'rank_districts': {
        var rows = plan.filters && Object.keys(plan.filters).length
          ? GEO.filters.apply(scope, Object.assign({}, GEO.state.defaults().filters, plan.filters))
          : current;

        if (plan.measure) {
          var g = AI._requireCoverage(rows, plan.measure, c);
          if (g) {
            return refuse(out, g, [
              'Which district has the most Class A and A+ offices?',
              'Show average known rent by district',
              'Show data coverage'
            ]);
          }
        }

        var res = record(out, AI.call('aggregateByDistrict',
          { measure: plan.measure, kind: plan.kind,
            rowIds: rows.map(function (r) { return r.id; }) }, c));
        if (res.refusal) return refuse(out, res.refusal, []);

        var groups = (res.groups || []).filter(function (gr) { return !gr.unknown; });
        var ranked = groups.slice().sort(function (a2, b2) {
          var av = plan.measure ? (a2.metric.sufficient ? a2.metric.value : -1) : a2.count;
          var bv = plan.measure ? (b2.metric.sufficient ? b2.metric.value : -1) : b2.count;
          return bv - av || (a2.label < b2.label ? -1 : 1);
        });
        var topVal = plan.measure
          ? (ranked[0].metric.sufficient ? ranked[0].metric.value : null)
          : ranked[0].count;
        var tied = ranked.filter(function (gr) {
          var v = plan.measure ? (gr.metric.sufficient ? gr.metric.value : null) : gr.count;
          return v === topVal;
        });

        out.origin = AI.ORIGIN.CALCULATED;
        // A tie is reported as a tie. Silently picking one would invent a ranking.
        out.answer = tied.length > 1
          ? tied.map(function (t) { return t.label; }).join(' and ') +
            ' are tied at the top with ' + fmtGroup(tied[0], plan) +
            ' (ties are listed alphabetically, not broken).'
          : ranked[0].label + ' has the most, with ' + fmtGroup(ranked[0], plan) + '.';

        out.table = {
          columns: ['District', plan.measure ? S.label(plan.measure) : 'Business centres', 'Coverage'],
          rows: ranked.map(function (gr) {
            return [gr.label,
                    plan.measure ? gr.metric.display : F.int(gr.count),
                    plan.measure ? (gr.metric.n + ' of ' + gr.metric.N) : '—'];
          })
        };
        out.chart = { kind: 'bar', rows: ranked.map(function (gr) {
          return { key: gr.key, label: gr.label,
                   value: plan.measure ? (gr.metric.sufficient ? gr.metric.value : 0) : gr.count,
                   unknown: false };
        }) };

        var unknownGroup = (res.groups || []).filter(function (gr) { return gr.unknown; })[0];
        if (unknownGroup && unknownGroup.count) {
          out.limitations.push(F.int(unknownGroup.count) + ' ' +
            F.plural(unknownGroup.count, 'property', 'properties') + ' have no recorded district.');
        }
        var empties = groups.filter(function (gr) { return gr.count === 0; });
        if (empties.length) {
          out.limitations.push(empties.map(function (gr) { return gr.label; }).join(' and ') +
            ' contain no recorded business centres. That is a true zero in this dataset, ' +
            'not missing data — though it may simply mean nothing has been collected there yet.');
        }
        if (plan.measure) {
          var suppressed = groups.filter(function (gr) { return !gr.metric.sufficient && gr.metric.n > 0; });
          if (suppressed.length) {
            out.limitations.push(suppressed.map(function (gr) {
              return gr.label + ' (n=' + gr.metric.n + ')';
            }).join(', ') + ' had too few recorded values to publish an average, so they are shown as ' +
            'insufficient rather than as a one-building figure.');
          }
        }

        var district = tied.map(function (t) { return t.key; });
        GEO.state.set({ filters: Object.assign({}, GEO.state.get().filters, { districts: district }) },
                      { source: 'ai', action: 'highlightDistricts',
                        summary: 'Highlighted ' + district.join(', ') });
        out.mapActions.push('Highlighted ' + tied.map(function (t) { return t.label; }).join(' and '));

        return finish(out, rows, plan.measure ? [plan.measure, 'officeClass'] : ['districtKey', 'officeClass']);
      }

      /* ---------------------------------------------------- rank_classes */
      case 'rank_classes': {
        var res2 = record(out, AI.call('aggregateByClass',
          { measure: plan.measure, kind: plan.measure ? 'mean' : 'count' }, c));
        if (res2.refusal) return refuse(out, res2.refusal, []);
        var gs = res2.groups || [];
        out.origin = AI.ORIGIN.CALCULATED;
        out.answer = 'Class mix of the current selection.';
        out.table = { columns: ['Class', plan.measure ? S.label(plan.measure) : 'Properties'],
                      rows: gs.map(function (gr) {
                        return [gr.label, plan.measure ? gr.metric.display : F.int(gr.count)];
                      }) };
        out.chart = { kind: 'bar', ordinal: true, rows: gs.map(function (gr) {
          return { key: gr.key, label: gr.label, value: gr.count, unknown: gr.unknown };
        }) };
        return finish(out, current, ['officeClass']);
      }

      /* ------------------------------------------ competitors / location */
      case 'competitors':
      case 'location_analysis': {
        var res3 = record(out, AI.call('createRadius',
          { id: plan.subjectId, bandsKm: plan.steps[0].args.bandsKm }, c));
        if (!res3.ok || !res3.analysis) {
          out.answer = res3.error || 'That analysis could not be run.';
          return out;
        }
        var an = res3.analysis;
        var subj = an.subject;
        var cs = an.competitiveSet;
        var band = an.bands.filter(function (b) { return b.km === an.competitiveBandKm; })[0] || an.widest;

        record(out, AI.call('createLayer', {
          name: (plan.intent === 'competitors' ? 'Competitors within ' : 'Within ') +
                an.competitiveBandKm + ' km of ' + subj.name,
          rowIds: band.rows.map(function (r) { return r.id; }),
          criteriaHuman: 'Within ' + an.competitiveBandKm + ' km of ' + subj.name +
                         (plan.intent === 'competitors' ? ', class within one band of ' + (subj.officeClass || 'unrecorded') : ''),
          criteriaMachine: { subject: subj.id, radiusKm: an.competitiveBandKm }
        }, ctx()));

        out.origin = AI.ORIGIN.CALCULATED;
        out.answer = 'Around ' + subj.name + ' there ' +
          F.plural(band.count, 'is', 'are') + ' ' + F.int(band.count) + ' ' +
          F.plural(band.count, 'other business centre', 'other business centres') +
          ' within ' + an.competitiveBandKm + ' km. Of those, ' + F.int(cs.qualified.length) +
          ' qualify as a suggested competitive set on class, and ' + F.int(cs.proximityOnly.length) +
          ' could not be qualified because their office class is not recorded.';

        out.analysis = an.bands.map(function (b) {
          return { label: 'Within ' + b.km + ' km',
                   value: F.int(b.count) + ' ' + F.plural(b.count, 'property', 'properties'),
                   detail: b.rent.sufficient
                     ? 'average known rent ' + b.rent.display + ' (' + b.rent.n + ' of ' + b.count + ')'
                     : 'average rent: ' + b.rent.display.toLowerCase() + ' (' + b.rent.n + ' of ' + b.count + ' priced)' };
        });
        out.analysis.push({ label: 'Total known GLA within ' + band.km + ' km',
                            value: band.gla.display, detail: band.gla.coverageText });

        out.table = {
          columns: ['Property', 'Class', 'Distance', 'Asking rent', 'Why included'],
          rows: cs.qualified.map(function (q) {
            return [q.record.name, q.record.officeClass || F.UNKNOWN,
                    (q.distanceM / 1000).toFixed(1) + ' km',
                    F.rent(q.record.askingRent), q.reasons.join('; ')];
          })
        };
        out.limitations.push(cs.caveat);
        out.limitations.push(an.method);
        out.dataCoverage = band.rent.coverageText + ' ' + band.gla.coverageText;
        return finish(out, band.rows, ['askingRent', 'officeClass']);
      }

      /* --------------------------------------------------------- compare */
      case 'compare': {
        var pool = current;
        var pick;
        if (plan.useSelection && c.state.compare.length >= 2) {
          pick = c.state.compare.map(GEO.data.get).filter(Boolean);
        } else if (plan.rankBy) {
          var g2 = AI._requireCoverage(pool, plan.rankBy, c);
          if (g2) {
            return refuse(out, g2, [
              'Compare the three highest known asking rents',
              'Select properties on the map and say "compare these"'
            ]);
          }
          pick = U.sortBy(A.withKnown(pool, plan.rankBy),
                          function (r) { return r[plan.rankBy]; },
                          plan.direction).slice(0, plan.count);
        } else {
          out.answer = 'Tell me which properties to compare — for example ' +
                       '"compare the three highest known asking rents", or select them on the map and say "compare these".';
          out.dataCoverage = A.coverageStatement(pool);
          out.suggestions = ['Compare the three highest known asking rents'];
          return out;
        }

        var res4 = record(out, AI.call('compareProperties',
          { rowIds: pick.map(function (r) { return r.id; }) }, c));
        if (res4.error) { out.answer = res4.error; return out; }

        out.origin = AI.ORIGIN.PLATFORM;
        out.answer = 'Comparing ' + pick.map(function (r) { return r.name; }).join(', ') + '.' +
                     (plan.rankBy ? ' Ranked by recorded ' + S.label(plan.rankBy).toLowerCase() + '.' : '');
        out.limitations.push('The comparison states what is recorded and what is not. It does not declare a winner — ' +
                             'with this much missing data, any ranking would say more about collection coverage than about the buildings.');
        return finish(out, pick, plan.rankBy ? [plan.rankBy] : ['officeClass', 'askingRent']);
      }

      /* ---------------------------------------------------- data quality */
      case 'data_quality': {
        var res5 = record(out, AI.call('showDataQuality', {}, c));
        if (!res5.ok) { out.answer = res5.error || 'The quality module is unavailable.'; return out; }

        var conf = res5.confidence || {};
        var comp = res5.completeness || {};
        var rows5 = res5.rows;
        var lowIds = rows5.filter(function (r) {
          var cc = GEO.data.recordConfidence(r);
          return cc === 'Low' || cc === 'Unknown';
        }).map(function (r) { return r.id; });
        var sparse = rows5.filter(function (r) {
          return GEO.quality.completeness(r).band === 'none';
        });

        out.origin = AI.ORIGIN.CALCULATED;
        out.answer = 'Record confidence across the current selection: ' +
          ['High', 'Medium', 'Low', 'Unknown'].map(function (k) {
            return (conf[k] || 0) + ' ' + k;
          }).join(' · ') + '. ' +
          'Confidence alone does not separate these records well, because they came from one source on one date — ' +
          'completeness does: ' + F.int(sparse.length) + ' of ' + F.int(rows5.length) +
          ' have no recorded commercial data at all.';

        record(out, AI.call('createLayer', {
          name: 'No recorded commercial data',
          rowIds: sparse.map(function (r) { return r.id; }),
          criteriaHuman: 'Records holding none of the ' + S.criticalFields.length +
                         ' critical fields (' + S.criticalFields.join(', ') + ')',
          criteriaMachine: { completeness: ['none'] }
        }, ctx()));

        GEO.state.set({ filters: Object.assign({}, GEO.state.get().filters, { completeness: ['none'] }) },
                      { source: 'ai', action: 'applyFilters', summary: 'Completeness: none' });

        out.analysis = Object.keys(comp).map(function (k) {
          return { label: 'Completeness: ' + k, value: F.int(comp[k]) + ' properties', detail: null };
        });
        out.table = {
          columns: ['Issue', 'Records', 'What it means'],
          rows: (res5.issues || []).map(function (is) {
            return [is.title, F.int(is.recordIds.length), is.detail];
          })
        };
        out.limitations.push('Low confidence means the value came from a single unverified listing, not that it is wrong. ' +
                             'It marks what a field visit should confirm first.');
        if (lowIds.length === 0) {
          out.limitations.push('No record is graded Low or Unknown overall, so a confidence filter alone would return nothing useful here.');
        }
        out.dataCoverage = A.coverageStatement(rows5);
        return finish(out, sparse.length ? sparse : rows5, ['officeClass', 'askingRent']);
      }

      /* ---------------------------------------------------- verification */
      case 'verification': {
        var res6 = record(out, AI.call('getVerificationQueue', { limit: 20 }, c));
        if (!res6.ok) {
          out.answer = res6.error || 'That needs the internal data-quality tools, which are not available in the client view.';
          out.origin = AI.ORIGIN.UNAVAILABLE;
          return out;
        }
        var q = res6.queue || [];
        var sum = res6.summary || {};
        out.origin = AI.ORIGIN.CALCULATED;
        out.answer = F.int(res6.total) + ' ' + F.plural(res6.total, 'property', 'properties') +
          ' need attention, ranked by how much is missing and how stale it is. ' +
          'The top ' + Math.min(20, q.length) + ' are listed below.';
        out.table = {
          columns: ['Property', 'District', 'Priority', 'What to verify', 'Why'],
          rows: q.map(function (item) {
            return [item.record.name, GEO.data.districtName(item.record.districtKey),
                    String(Math.round(item.score)),
                    item.fieldsToVerify.map(function (f) { return S.label(f); }).join(', '),
                    item.reasons.join('; ')];
          })
        };
        if (sum.stalenessDiscriminates === false) {
          out.limitations.push('Every record in the source dataset was collected on the same day (' +
            F.date(sum.latestCollection || '2026-07-19') + '), so age cannot currently separate them. ' +
            'The ranking is driven by missing fields and flagged issues instead. ' +
            'Once a second collection date exists, staleness will start to discriminate.');
        }
        out.limitations.push('Creating field tasks needs a backend and a named collector; neither exists in this prototype. ' +
                             'This list is exportable as CSV in the meantime.');
        out.suggestions = ['Export these results'];
        return finish(out, q.map(function (item) { return item.record; }), S.criticalFields.slice(0, 3));
      }

      /* -------------------------------------------------------- clusters */
      case 'clusters': {
        var cl = GEO.geo.clusters(current, 1);
        var top = cl.slice(0, 8);
        out.origin = AI.ORIGIN.CALCULATED;
        out.answer = 'The densest 1 km cells in the current selection hold ' +
          top.map(function (x) { return x.count; }).slice(0, 3).join(', ') +
          ' business centres respectively.';
        out.table = { columns: ['Rank', 'Business centres', 'Centre (lat, lng)'],
                      rows: top.map(function (x, i) {
                        return [String(i + 1), F.int(x.count),
                                x.centre[0].toFixed(4) + ', ' + x.centre[1].toFixed(4)];
                      }) };
        out.limitations.push('This counts recorded buildings in a 1 km grid. It is not a floorspace, employment or ' +
          'footfall density — GLA is recorded for ' + A.coverage(current, 'gla').n + ' of ' +
          current.length + ' properties, so a floorspace density cannot be computed.');
        return finish(out, current, ['gla']);
      }

      /* -------------------------------------------------------- coverage */
      case 'coverage': {
        var res7 = record(out, AI.call('getDataCoverage', {}, c));
        out.origin = AI.ORIGIN.PLATFORM;
        out.answer = 'What is actually recorded for the ' + F.int(res7.rows.length) +
                     ' ' + F.plural(res7.rows.length, 'property', 'properties') + ' in view:';
        out.table = { columns: ['Field', 'Recorded', 'Coverage'],
                      rows: res7.coverage.map(function (cv) {
                        return [cv.label, cv.n + ' of ' + cv.N,
                                cv.N ? Math.round(100 * cv.n / cv.N) + '%' : '—'];
                      }) };
        out.chart = { kind: 'coverage', rows: res7.coverage };
        out.limitations.push('Coverage is the honest ceiling on every other answer: a field recorded for zero ' +
                             'properties cannot be filtered, charted, averaged or compared.');
        return finish(out, res7.rows, []);
      }

      /* ---------------------------------------------------------- export */
      case 'export': {
        var res8 = record(out, AI.call('exportResults', plan.steps[0].args, c));
        out.answer = res8.ok
          ? 'Exported ' + F.int(res8.count) + ' records as ' + res8.filename + '.'
          : (res8.error || 'The export failed.');
        return finish(out, current, []);
      }

      /* --------------------------------------------------- find_property */
      case 'find_property': {
        var res9 = record(out, AI.call('searchProperties', { q: plan.query, limit: 5 }, c));
        var hits = res9.rows || [];
        if (!hits.length) {
          out.answer = 'Nothing in the dataset matches "' + plan.query + '".';
          out.origin = AI.ORIGIN.UNAVAILABLE;
          out.dataCoverage = A.coverageStatement(scope);
          out.limitations.push('The dataset holds ' + F.int(scope.length) +
            ' business centres in Tashkent only. It is not a complete market inventory.');
          return out;
        }
        record(out, AI.call('selectProperty', { id: hits[0].id }, ctx()));
        record(out, AI.call('zoomToProperty', { id: hits[0].id, zoom: 16 }, ctx()));
        out.answer = 'Selected ' + hits[0].name + ' (' +
          GEO.data.districtName(hits[0].districtKey) + ').' +
          (hits.length > 1 ? ' ' + (hits.length - 1) + ' other ' +
            F.plural(hits.length - 1, 'property', 'properties') + ' also matched.' : '');
        return finish(out, hits, ['officeClass', 'askingRent']);
      }

      /* -------------------------------------------------- clear_analysis */
      case 'clear_analysis': {
        record(out, AI.call('removeLayer', {}, c));
        record(out, AI.call('removeRadius', {}, ctx()));
        GEO.state.clearAnalysis({ source: 'ai', action: 'clearAnalysis',
                                  summary: 'Cleared filters, layers, radius and selection' });
        out.answer = 'Cleared every filter, layer and distance ring, and deselected the property. ' +
                     'Showing all ' + F.int(scope.length) + ' business centres again.';
        out.mapActions.push('Reset the map to all business centres');
        out.origin = AI.ORIGIN.PLATFORM;
        out.resultIds = null;       // context reset (§63 test 8f)
        out.resultCount = scope.length;
        out.dataCoverage = A.coverageStatement(scope);
        out.sources = sourcesFor(scope.slice(0, 200));
        out.limitations.push('The session log is kept — resetting clears state, not history.');
        return out;
      }

      default:
        out.answer = 'That intent is recognised but not implemented in this prototype.';
        out.origin = AI.ORIGIN.UNAVAILABLE;
        return out;
    }
  }

  /* --------------------------------------------------------------- helpers */
  function fmtGroup(gr, plan) {
    return plan.measure ? gr.metric.display
                        : F.int(gr.count) + ' ' + F.plural(gr.count, 'property', 'properties');
  }

  function describeSet(rows) {
    return ['officeClass', 'askingRent', 'gla'].map(function (f) {
      var m = A.metric(rows, f, f === 'officeClass' ? 'count' : 'mean');
      if (f === 'officeClass') {
        var cv = A.coverage(rows, f);
        return { label: 'Office class recorded', value: cv.n + ' of ' + cv.N, detail: null };
      }
      return { label: (f === 'askingRent' ? 'Average asking rent' : 'Total known GLA'),
               value: m.display, detail: m.coverageText };
    });
  }

  function suggestions() {
    return [
      'Show Class A and A+ business centres',
      'Which district has the most Class A and A+ offices?',
      'Show properties with poor data quality',
      'Which buildings need data verification?',
      'Show data coverage'
    ];
  }
  AI.suggestions = suggestions;
}(window));
