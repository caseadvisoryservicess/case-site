/* ===========================================================================
 * 23-ai-panel — the assistant UI, the AI Layers panel and the session log
 *
 * Brief §40 (AI panel), §46 (the six-block response), §53/D13 (no progress
 * theatre), §57 (AI layers), §58 (session context), §61 (session log), §62
 * (refusal as a success).
 *
 * This module renders `GEO.ai.ask()`. It never computes a figure, never
 * formats a number the engine did not already format, and never decides what
 * the assistant is allowed to do — all of that is 20/21/22. What it owns is the
 * part of the transparency claim that is made of pixels:
 *
 *   1. ALL SIX BLOCKS, ALWAYS. Answer · Analysis · Map actions · Data coverage ·
 *      Confidence & limitations · Sources. A block is never omitted; an empty
 *      one says why. An omitted "Data coverage" block reads as "coverage is
 *      fine", which is exactly the impression §47 exists to prevent — so the
 *      renderer has no code path that can drop one.
 *
 *   2. UNAVAILABLE IS NOT AN ERROR (§62). A refusal gets the same card, the
 *      same six blocks and a neutral dashed badge. Nothing red, nothing that
 *      reads as a failure: declining to invent a number is the system working.
 *
 *   3. NO STAGED PROGRESS (D13). The engine finishes in under 5 ms. Instead of
 *      a fake "Understanding your request…" strip, every answer carries the
 *      "How this was answered" disclosure — matched intent, slots, every tool
 *      call with its arguments, record counts in and out, elapsed time.
 *      Simulating latency to imply intelligence is the presentational cousin
 *      of the fabrication §47 forbids.
 *
 * The conversation itself is the one thing this module does keep in memory: a
 * response object cannot be re-derived from state, because re-running the
 * engine would re-apply its map actions. The transcript is reconciled against
 * `state.aiSession.turns` on every render, so clearing the session clears it.
 * Records are never cached — every property is re-read through `GEO.data.get`.
 * ========================================================================= */
(function (w) {
  'use strict';

  var GEO = w.GEO, U = GEO.util, Q = GEO.dom, el = Q.el, F = GEO.fmt;
  var AI = GEO.ai;
  var t = GEO.i18n.t;

  /* ---------------------------------------------------------- string table */
  /* D14 — every user-visible string lives in the one table. The guard makes
     this block a no-op once the keys are folded into 01-i18n.js. */
  var ADDED = {
    /* --- the six-block renderer --- */
    'ai.block.confidence': 'Confidence & limitations',
    'ai.block.empty.answer': 'No answer text was produced for this question.',
    'ai.block.empty.coverage': 'No coverage statement was produced for this answer. Treat any figure in it as unverified until one is.',
    'ai.blocks.note': 'Every answer carries the same six blocks. A block is never dropped — when it is empty it says why.',
    'ai.unavailable.note': 'This is a complete answer, not a failure. The assistant states what the platform holds and declines to estimate the rest.',
    'ai.origin.label': 'Where this figure came from: {origin}',
    'ai.turn.at': '{time} UTC',
    'ai.error.title': 'That question could not be run.',
    'ai.error.body': 'The assistant failed while answering. Nothing in the dataset, the filters, the layers or the map was changed.',

    /* --- how this was answered (I-05) --- */
    'ai.how.hide': 'Hide how this was answered',
    'ai.how.noTools': 'No tools were called — the answer came from the intent catalogue alone.',
    'ai.how.noSlots': 'No values were read from your question.',
    'ai.how.argsTrimmed': 'Long id lists are shown as a count.',
    'ai.how.recordsLabel': 'Records',
    'ai.how.elapsedLabel': 'Elapsed',
    'ai.how.engineLabel': 'Engine',

    /* --- per-response actions --- */
    'ai.followUp': 'Ask next',
    'ai.undo.disabled': 'This turn has already been undone',
    'ai.undone': 'Undone — the map, filters and layers are back to how they were before this question.',
    'ai.copy.failed': 'This browser blocked the clipboard. The full text is below — select it and copy by hand.',
    'ai.copy.title': 'Copy this answer',
    'ai.createLayer.name': 'Result — {q}',
    'ai.result.count.one': '{n} property in this result',
    'ai.result.count.other': '{n} properties in this result',

    /* --- context chip (I-04) --- */
    'ai.context.title': 'What the assistant is working from',
    'ai.context.selected': 'Selected: {name}',
    'ai.context.filters': 'Filters: {text}',
    'ai.context.filters.none': 'Filters: none',
    'ai.context.lastResult': 'Last result: {n} properties',
    'ai.context.lastResult.none': 'Last result: none',
    'ai.context.clearResult': 'Forget the last result set',
    'ai.context.clearResult.disabled': 'There is no previous result to forget',
    'ai.context.note': 'Words like "it", "this building" and "only those…" are resolved from this, so they are predictable rather than magic.',

    /* --- session log (§61) --- */
    'ai.log.title': 'Session log',
    'ai.log.note': 'Every state change in this session and who made it. It is held in memory only — never written to this browser — so exporting it is how a test session is kept.',
    'ai.log.col.time': 'Time (UTC)',
    'ai.log.col.source': 'Source',
    'ai.log.col.action': 'Action',
    'ai.log.col.summary': 'What changed',
    'ai.log.source.user': 'You',
    'ai.log.source.ai': 'Assistant',
    'ai.log.source.boot': 'Start-up',
    'ai.log.source.system': 'System',
    'ai.log.source.url': 'Link',
    'ai.log.empty': 'Nothing has happened in this session yet.',
    'ai.log.trimmed': 'Showing the most recent {n} of {m} entries. The export holds all of them.',
    'ai.log.exported': 'Session log prepared — check your downloads',
    'ai.newSession.explain': 'The conversation, the analysis layers, the radius rings, the selection and the session log are all cleared. The dataset and any local edits are kept, and the filters are left exactly as they are. Export the session log first if you need it.',
    'ai.newSession.go': 'Start a new session',

    /* --- layers tab (§57) --- */
    'layers.title': 'Layers',
    'layers.rename.commit': 'Save the new name',
    'layers.rename.label': 'Layer name',
    'layers.shown': 'Shown: {name}',
    'layers.hidden': 'Hidden: {name}',
    'map.layer.clearAll.confirm': 'Remove every analysis layer?',
    'map.layer.clearAll.body': '{n} layers are removed, with their markers and any circles they own. The properties themselves, the filters and the dataset are untouched.',
    'map.layer.records': 'Record ids held',
    'map.layer.vsFilter': 'A layer keeps the properties that matched when it was made. A filter is re-evaluated every time anything changes — edit a record and a filter result moves, a layer does not.',
    /* 11-map.js asks for this key on the button that jumps here; without it the
       raw key would be printed as the button label. */
    'map.layers.analysis.open': 'Open the Layers tab'
  };
  Object.keys(ADDED).forEach(function (k) {
    if (!GEO.i18n.en[k]) GEO.i18n.en[k] = ADDED[k];
  });

  /* ------------------------------------------------------------ constants */

  var LOG_ROWS = 200;          /* session-log rows drawn; the export holds all  */
  var ARG_ITEMS = 6;           /* array length shown verbatim in the trace      */
  var COMPARE_MAX = 4;         /* §15 — the compare overlay takes 2 to 4        */

  /* ORIGIN -> the `data-prov` hook 07-panels.css styles, and its label key.
     Border treatment and wording carry the distinction, never hue alone. */
  var PROV = {};
  PROV[AI.ORIGIN.PLATFORM] = { slug: 'platform-data', key: 'ai.tag.platform' };
  PROV[AI.ORIGIN.CALCULATED] = { slug: 'calculated', key: 'ai.tag.calculated' };
  PROV[AI.ORIGIN.EXTERNAL] = { slug: 'external', key: 'ai.tag.external' };
  PROV[AI.ORIGIN.INFERENCE] = { slug: 'ai-inference', key: 'ai.tag.inference' };
  PROV[AI.ORIGIN.ASSUMPTION] = { slug: 'assumption', key: 'ai.tag.assumption' };
  PROV[AI.ORIGIN.UNAVAILABLE] = { slug: 'unavailable', key: 'ai.tag.unavailable' };

  /* The §46 blocks, in the order §46 lists them. This array is the contract:
     the renderer walks it, so a block cannot be forgotten at a call site. */
  var BLOCKS = [
    { key: 'answer', head: 'ai.block.answer', empty: 'ai.block.empty.answer' },
    { key: 'analysis', head: 'ai.block.analysis', empty: 'ai.block.empty.analysis' },
    { key: 'mapActions', head: 'ai.block.map', empty: 'ai.block.empty.map' },
    { key: 'dataCoverage', head: 'ai.block.coverage', empty: 'ai.block.empty.coverage' },
    { key: 'limitations', head: 'ai.block.confidence', empty: 'ai.block.empty.limitations' },
    { key: 'sources', head: 'ai.block.sources', empty: 'ai.block.empty.sources' }
  ];

  var SOURCE_KEYS = {
    user: 'ai.log.source.user', ai: 'ai.log.source.ai', boot: 'ai.log.source.boot',
    system: 'ai.log.source.system', url: 'ai.log.source.url'
  };

  /* ----------------------------------------------------------- view state */
  /* The transcript is conversation, not app data: it holds the response object
     the engine returned plus the state slice from just before the turn, which
     is what "Undo this" restores. Everything else here is view bookkeeping —
     which disclosure is open, which layer name is being edited — and none of it
     belongs in `GEO.state`, because none of it changes what any figure says. */
  var transcript = [];
  var rendered = 0;                 /* transcript entries that already have DOM */
  var view = { how: {}, inspect: {}, logOpen: false, rename: null, renameDraft: '' };
  var dataVersion = 0;
  var wired = false;
  var layerSeq = 0;

  /* =====================================================================
   * 1. SMALL SHARED PIECES
   * =================================================================== */

  function clockOf(iso) {
    /* ISO strings are UTC and the column says so. A local-time render would be
       wrong the moment a log is read on another machine, which is the whole
       point of exporting it. */
    var s = String(iso || '');
    return s.length >= 19 ? s.slice(11, 19) : s;
  }

  function nameOf(rec) {
    return rec && U.isKnown(rec.name) ? rec.name : F.UNKNOWN;
  }

  /** The §2.8/§47 provenance badge: dot-plus-words, never a colour on its own. */
  function provBadge(origin) {
    var p = PROV[origin] || PROV[AI.ORIGIN.PLATFORM];
    return el('span.prov-badge', {
      dataset: { prov: p.slug },
      title: t('ai.origin.label', { origin: t(p.key) })
    }, [el('span', { text: t(p.key) })]);
  }

  function recordsOf(ids) {
    return (ids || []).map(GEO.data.get).filter(Boolean);
  }

  /** A disabled control states WHY, as text in the flow (§29) — not a tooltip. */
  function disabledButton(label, reason, id) {
    var rid = id + '-why';
    return el('span', {}, [
      el('button.btn.btn--quiet.btn--sm', {
        type: 'button', disabled: true, 'aria-describedby': rid, text: label
      }),
      el('span.reason', { id: rid, text: reason })
    ]);
  }

  /**
   * Re-render `container` while keeping the keyboard where it was. These panels
   * rebuild wholesale on every toggle, which destroys the node the reader is
   * standing on; position is restored by index so a layer list can be walked
   * with Tab and Space without being thrown out of it.
   */
  function withFocus(container, fn) {
    var at = Q.$$('input, button, select, textarea, [href]', container)
               .indexOf(document.activeElement);
    fn();
    if (at < 0) return;
    var next = Q.$$('input, button, select, textarea, [href]', container);
    if (next[at] && next[at].focus) next[at].focus();
  }

  function disclosure(id, label, hideLabel, countText, open, onToggle, bodyKids) {
    return el('div.disc', { dataset: { open: open ? 'true' : 'false' } }, [
      el('button.disc__hd', {
        type: 'button', 'aria-expanded': open ? 'true' : 'false', 'aria-controls': id,
        onclick: onToggle
      }, [
        el('span', { text: open ? hideLabel : label }),
        countText ? el('span.disc__count', { text: countText }) : null
      ]),
      el('div.disc__wrap', {}, [
        el('div.disc__body', { id: id }, open ? bodyKids() : [])
      ])
    ]);
  }

  /* =====================================================================
   * 2. THE SIX §46 BLOCKS
   * =================================================================== */

  var NUMISH = /^[$]?-?[\d][\d,.\s]*\s*(%|km|m²)?$/;

  function tableNode(spec) {
    var cols = (spec && spec.columns) || [];
    var rows = (spec && spec.rows) || [];
    if (!cols.length || !rows.length) return null;

    /* A real table, not a rendered picture of one: the values have to be
       selectable, copyable and reachable by a screen reader (§14, visual
       system §10 — no figure is gated behind a chart). */
    return el('div', { style: 'overflow-x:auto;max-width:100%' }, [
      el('table.tbl.tbl--zebra', {}, [
        el('thead', {}, [el('tr', {}, cols.map(function (c) {
          return el('th', { scope: 'col', text: String(c) });
        }))]),
        el('tbody', {}, rows.map(function (r) {
          return el('tr', {}, (r || []).map(function (cell, i) {
            var text = (cell === null || cell === undefined) ? F.UNKNOWN : String(cell);
            var unknown = text === F.UNKNOWN;
            var cls = (i === 0 ? '.tbl__rowhd' : (NUMISH.test(text) ? '.tbl__num' : '')) +
                      (unknown ? '.unk' : '');
            return i === 0
              ? el('th' + cls, { scope: 'row', text: text })
              : el('td' + cls, { text: text });
          }));
        }))
      ])
    ]);
  }

  function chartNode(resp) {
    if (!resp.chart || !GEO.charts || !GEO.charts.render) return null;
    var box = el('div');
    var spec = Object.assign({}, resp.chart);
    /* The chart never publishes a bare number: it inherits the answer's own
       coverage sentence, which is the denominator the reader needs (§14). */
    if (!spec.coverageText) spec.coverageText = resp.dataCoverage || null;
    try { GEO.charts.render(box, spec); }
    catch (e) {
      GEO.log.error('23-ai-panel: chart render failed', e);
      return null;
    }
    return box;
  }

  function analysisNodes(resp) {
    var out = [];
    var kv = [];
    (resp.analysis || []).forEach(function (a) {
      if (typeof a === 'string') { out.push(el('p', { text: a })); return; }
      var value = U.isKnown(a.value) ? String(a.value) : F.UNKNOWN;
      kv.push(el('div.kv__row', {}, [
        el('span.kv__k', { text: a.label }),
        el('span.kv__v.kv__v--num', {}, [
          el('span' + (value === F.UNKNOWN ? '.unk' : ''), { text: value }),
          /* The denominator travels with the figure, never in a footnote the
             reader has to go looking for (§36, contract §7). */
          a.detail ? el('span.coverage', { text: a.detail }) : null
        ]),
        provBadge(resp.origin)
      ]));
    });
    if (kv.length) out.push(el('div.kv', {}, kv));
    return out;
  }

  /** One block. Called for all six, unconditionally. */
  function blockNode(spec, resp) {
    var kids = [];
    var badge = null;

    switch (spec.key) {
      case 'answer':
        badge = provBadge(resp.origin);
        if (resp.answer) kids.push(el('p', { text: resp.answer }));
        if (resp.unavailable) {
          /* §62: say plainly that this is the honest answer. Without the line,
             a refusal reads as a dead end rather than as a statement of what
             the platform actually holds. */
          kids.push(el('p.micro', { text: t('ai.unavailable.note') }));
        }
        break;

      case 'analysis':
        kids = analysisNodes(resp);
        if (kids.length) badge = provBadge(resp.origin);
        var tbl = tableNode(resp.table);
        if (tbl) { kids.push(tbl); if (!badge) badge = provBadge(resp.origin); }
        var chart = chartNode(resp);
        if (chart) kids.push(chart);
        break;

      case 'mapActions':
        if ((resp.mapActions || []).length) {
          kids.push(el('ul', {}, resp.mapActions.map(function (s) {
            return el('li', { text: s });
          })));
          /* I-06: the actions are already applied — the engine writes through
             `GEO.state.set` as it answers — so there is no "Apply to map"
             button to press. Saying so is honest; a permanently-disabled
             button labelled "Applied" would be furniture. */
          kids.push(el('p.micro', { text: t('ai.applied') }));
        }
        break;

      case 'dataCoverage':
        if (resp.dataCoverage) kids.push(el('p', { text: resp.dataCoverage }));
        break;

      case 'limitations':
        if ((resp.limitations || []).length) {
          kids.push(el('ul', {}, resp.limitations.map(function (s) {
            return el('li', { text: s });
          })));
        }
        break;

      case 'sources':
        if ((resp.sources || []).length) {
          kids.push(el('ul', {}, resp.sources.map(function (s) {
            return el('li', { text: s });
          })));
        }
        break;
    }

    if (!kids.length) kids = [el('p.block__empty', { text: t(spec.empty) })];

    return el('div.block', { dataset: { block: spec.key } }, [
      el('h4.block__hd', {}, [el('span', { text: t(spec.head) })].concat(badge ? [badge] : [])),
      el('div.block__body', {}, kids)
    ]);
  }

  /* =====================================================================
   * 3. "HOW THIS WAS ANSWERED" (I-05, D13)
   * =================================================================== */

  /** Trim a tool argument for display: a `rowIds` array of 148 strings is noise
   *  that hides the arguments that matter. The count is kept, so nothing about
   *  the size of the call is concealed. */
  function compactValue(v, depth) {
    if (v === null || v === undefined) return null;
    if (Array.isArray(v)) {
      /* Length, not depth, decides: a 148-id list is noise, but
         `classes: ["A","A+"]` three levels down is the argument the reader
         opened the disclosure to check. */
      if (v.length > ARG_ITEMS) return '[' + F.int(v.length) + ']';
      return v.map(function (x) { return compactValue(x, depth + 1); });
    }
    if (typeof v === 'object') {
      if (depth >= 3) return '{…}';
      var o = {};
      Object.keys(v).forEach(function (k) {
        var c = compactValue(v[k], depth + 1);
        /* Defaults are absences, not arguments: a filter object carries a
           dozen nulls and empty arrays that nobody passed. */
        if (c === null || c === undefined || c === '') return;
        if (Array.isArray(c) && !c.length) return;
        o[k] = c;
      });
      return o;
    }
    return v;
  }

  function argsText(args) {
    try { return JSON.stringify(compactValue(args || {}, 0)); }
    catch (e) { return String(args); }
  }

  /** Only the slots the parser actually read. An object of twenty empty arrays
   *  buries the two values that changed the answer. */
  function slotLines(slots) {
    if (!slots) return [];
    return Object.keys(slots).filter(function (k) {
      var v = slots[k];
      if (Array.isArray(v)) return v.length > 0;
      if (typeof v === 'boolean') return v;
      return U.isKnown(v);
    }).map(function (k) {
      return k + ': ' + argsText(slots[k]);
    });
  }

  function howRow(labelText, valueKids) {
    return el('div.how__row', {}, [
      el('span.how__k', { text: labelText }),
      el('span.how__v', {}, valueKids)
    ]);
  }

  function howBody(entry) {
    var resp = entry.response;
    var tr = resp.trace || {};
    var rows = [];

    rows.push(howRow(t('ai.how.intent'), [el('span', { text: String(tr.intent || resp.intent) })]));

    var slots = slotLines(tr.slots);
    rows.push(howRow(t('ai.how.slots'), slots.length
      ? slots.map(function (s) { return el('div', { text: s }); })
      : [el('span', { text: t('ai.how.noSlots') })]));

    var tools = tr.tools || [];
    rows.push(howRow(t('ai.how.tools'), tools.length
      ? tools.map(function (c) {
          return el('div', { text: t('ai.how.toolArgs', { tool: c.tool, args: argsText(c.args) }) });
        })
      : [el('span', { text: t('ai.how.noTools') })]));

    rows.push(howRow(t('ai.how.recordsLabel'), [el('span', {
      text: t('ai.how.records', {
        'in': F.int(entry.inCount),
        out: (resp.resultCount === null || resp.resultCount === undefined)
          ? F.UNKNOWN : F.int(resp.resultCount)
      })
    })]));

    /* The real elapsed time, to two decimals. It is usually under 2 ms, and
       that is the point: there is no latency to dramatise (D13). */
    rows.push(howRow(t('ai.how.elapsedLabel'), [el('span', {
      text: t('ai.how.elapsed', { ms: F.num(tr.durationMs || 0, 2) })
    })]));

    rows.push(howRow(t('ai.how.engineLabel'), [el('span', {
      text: t('ai.how.engine', { name: t('ai.provider.local') })
    })]));

    rows.push(el('p.micro', { text: t('ai.provider.note') }));
    if (tools.length) rows.push(el('p.micro', { text: t('ai.how.argsTrimmed') }));
    return rows;
  }

  function howNode(entry, index) {
    var id = 'ai-how-' + index;
    var open = !!view.how[index];
    return el('div.how', { dataset: { open: open ? 'true' : 'false' } }, [
      el('button.how__hd', {
        type: 'button', 'aria-expanded': open ? 'true' : 'false', 'aria-controls': id,
        text: open ? t('ai.how.hide') : t('ai.how'),
        onclick: function () { view.how[index] = !open; redrawTurn(index); }
      }),
      el('div.how__body', { id: id, hidden: !open }, open ? howBody(entry) : [])
    ]);
  }

  /* =====================================================================
   * 4. PER-RESPONSE ACTIONS (I-07 … I-10)
   * =================================================================== */

  function plainText(entry) {
    var resp = entry.response;
    var out = [t('ai.turn.you') + ': ' + entry.q, ''];
    out.push(t('ai.turn.assistant') + ' (' + (PROV[resp.origin] ? t(PROV[resp.origin].key) : resp.origin) + ')');
    BLOCKS.forEach(function (spec) {
      var v = resp[spec.key];
      var body;
      if (spec.key === 'analysis') {
        body = (v || []).map(function (a) {
          return typeof a === 'string' ? a
            : a.label + ': ' + (U.isKnown(a.value) ? a.value : F.UNKNOWN) +
              (a.detail ? ' (' + a.detail + ')' : '');
        }).join('\n');
      } else if (Array.isArray(v)) {
        body = v.join('\n');
      } else {
        body = v || '';
      }
      out.push('');
      out.push(t(spec.head).toUpperCase());
      out.push(body || t(spec.empty));
    });
    out.push('');
    out.push(t('ai.how') + ': ' + String((resp.trace && resp.trace.intent) || resp.intent) +
             ' · ' + t('ai.how.elapsed', { ms: F.num((resp.trace && resp.trace.durationMs) || 0, 2) }));
    return out.join('\n');
  }

  function copyAnswer(entry) {
    var text = plainText(entry);
    function fallback() {
      /* file:// blocks the async clipboard in several browsers. Rather than a
         button that silently does nothing (§29), hand the text over in a
         dialog the reader can select from. */
      GEO.boot.dialog({
        title: t('ai.copy.title'),
        body: el('div', {}, [
          el('p', { text: t('ai.copy.failed') }),
          el('textarea.textarea', { rows: 12, readonly: true, text: text })
        ]),
        actions: [{ label: t('common.close'), primary: true }]
      });
    }
    try {
      if (w.navigator && w.navigator.clipboard && w.navigator.clipboard.writeText) {
        w.navigator.clipboard.writeText(text).then(function () {
          GEO.boot.toast(t('toast.copied'));
        }, fallback);
        return;
      }
    } catch (e) { /* falls through to the dialog */ }
    fallback();
  }

  /** I-07. The state slice captured before the turn is restored wholesale.
   *  Later turns built on this one cannot survive that, and the toast says so
   *  rather than leaving the reader to discover it. */
  function undoTurn(index) {
    var entry = transcript[index];
    if (!entry || entry.undone) return;
    var s = GEO.state.get();
    var patch = Object.assign({}, entry.before);
    patch.map = { fitToken: s.map.fitToken + 1 };
    GEO.state.set(patch, {
      source: 'user', action: 'ai:undo',
      summary: t('ai.undo') + ' — ' + entry.q
    });
    var cascaded = index < transcript.length - 1;
    /* Rolling back to before this turn rolls back everything built on top of
       it. The later turns are marked undone too rather than keeping buttons
       that would now restore a state that no longer exists. */
    for (var i = index; i < transcript.length; i++) {
      transcript[i].undone = true;
      redrawTurn(i);
    }
    GEO.boot.toast(t('ai.undone') + (cascaded ? ' ' + t('ai.undo.cascade') : ''));
  }

  function createLayerFrom(entry) {
    var ids = (entry.response.resultIds || []).slice();
    if (!ids.length) return;
    var s = GEO.state.get();
    var name = t('ai.createLayer.name', { q: entry.q });
    /* `source: 'manual'` — the user pressed this button. The Layers panel says
       who made each layer, and that line has to be true (Y-09). */
    var layer = {
      /* The counter matters: two clicks inside one millisecond would otherwise
         share an id, and the Layers panel keys its rows on it. */
      id: 'layer-' + Date.now().toString(36) + '-' + (layerSeq++),
      name: name,
      criteriaHuman: entry.response.answer || name,
      criteriaMachine: { kind: 'aiResult', question: entry.q,
                         intent: entry.response.intent, recordCount: ids.length },
      recordIds: ids, count: ids.length,
      style: null, visible: true, source: 'manual',
      createdAt: new Date().toISOString()
    };
    GEO.state.set({ aiLayers: s.aiLayers.concat([layer]) },
                  { source: 'user', action: 'layer:create', summary: name });
    GEO.boot.toast(t('toast.layerCreated', { name: name }));
  }

  function compareFrom(entry) {
    var ids = (entry.response.resultIds || []).slice(0, COMPARE_MAX);
    if (ids.length < 2) return;
    GEO.state.set({ compare: ids, overlay: 'compare' },
                  { source: 'user', action: 'ai:compare',
                    summary: t('ai.compare') + ' — ' + F.int(ids.length) });
  }

  function actionsNode(entry, index) {
    var n = (entry.response.resultIds || []).length;
    var kids = [];

    kids.push(el('button.btn.btn--quiet.btn--sm', {
      type: 'button', text: t('ai.copy'),
      onclick: function () { copyAnswer(entry); }
    }));

    if (n) {
      kids.push(el('button.btn.btn--quiet.btn--sm', {
        type: 'button', text: t('ai.createLayer'),
        onclick: function () { createLayerFrom(entry); }
      }));
    } else {
      kids.push(disabledButton(t('ai.createLayer'), t('ai.createLayer.disabled'), 'ai-layer-' + index));
    }

    if (n >= 2) {
      kids.push(el('button.btn.btn--quiet.btn--sm', {
        type: 'button', text: t('ai.compare'),
        onclick: function () { compareFrom(entry); }
      }));
    } else {
      kids.push(disabledButton(t('ai.compare'), t('ai.compare.disabled'), 'ai-cmp-' + index));
    }

    if (entry.undone) {
      kids.push(disabledButton(t('ai.undo'), t('ai.undo.disabled'), 'ai-undo-' + index));
    } else {
      kids.push(el('button.btn.btn--quiet.btn--sm', {
        type: 'button', text: t('ai.undo'),
        onclick: function () { undoTurn(index); }
      }));
    }

    return el('div.msg__actions', {}, kids);
  }

  /* =====================================================================
   * 5. THE CONVERSATION
   * =================================================================== */

  function suggestionChips(list) {
    if (!list || !list.length) return null;
    return el('div', {}, [
      el('p.micro', { text: t('ai.followUp') }),
      el('div.fchips', {}, list.map(function (s) {
        return el('button.chip.chip--suggest', {
          type: 'button', text: s,
          onclick: function () { ask(s); }
        });
      }))
    ]);
  }

  function userNode(entry, index) {
    return el('div.msg.msg--user', { dataset: { turn: String(index), role: 'user' } }, [
      el('p.msg__body', { text: entry.q }),
      el('span.msg__time', { text: t('ai.turn.at', { time: clockOf(entry.at) }) })
    ]);
  }

  function assistantNode(entry, index) {
    var resp = entry.response;
    /* D4 — re-derived from the ids at render time, never stored, so a demo
       record that appears in an old answer is still badged after a reload. */
    var demo = recordsOf(resp.resultIds).filter(function (r) {
      return r.recordType === 'DEMO';
    }).length;

    var head = [el('span.msg__time', { text: t('ai.turn.assistant') })];
    if (demo) head.push(el('span.badge.badge--demo', { text: t('common.demo.badge') }));
    if (entry.undone) head.push(el('span.chip', {}, [el('span.chip__label', { text: t('ai.undone') })]));

    var body = [el('div.row.row--tight', {}, head)];

    body.push(el('div.blocks', {}, BLOCKS.map(function (spec) {
      return blockNode(spec, resp);
    })));

    if (U.isKnown(resp.resultCount)) {
      body.push(el('p.coverage', {
        text: GEO.i18n.plural('ai.result.count', resp.resultCount)
      }));
    }

    var follow = suggestionChips(resp.suggestions);
    if (follow) body.push(follow);

    body.push(actionsNode(entry, index));
    body.push(howNode(entry, index));
    /* Said once, on the first answer of the session. Repeating it under every
       turn would train the reader to stop seeing it. */
    if (index === 0) body.push(el('p.micro', { text: t('ai.blocks.note') }));

    /* No `aria-label` here: `#ai-log` is a polite live region, and a label on
       the container is read INSTEAD of the answer by several screen readers —
       which would announce "New assistant response" and then nothing. */
    return el('div.msg.msg--ai', {
      dataset: { turn: String(index), role: 'ai' }
    }, [el('div.msg__body', {}, body)]);
  }

  function emptyLogNode() {
    return el('div.empty.empty--center', { dataset: { role: 'empty' } }, [
      el('p.empty__title', { text: t('empty.ai.title') }),
      el('p.empty__body', { text: t('empty.ai.body') }),
      el('p.empty__body', { text: t('ai.blocks.note') })
    ]);
  }

  /** Charts hold a ResizeObserver per container, so a message node is released
   *  rather than merely detached. */
  function clearLog(log) {
    if (GEO.charts && GEO.charts.destroy) {
      Q.$$('.msg--ai', log).forEach(function (n) { GEO.charts.destroy(n); });
    }
    Q.clear(log);
    rendered = 0;
  }

  /** Append-only: an existing turn's DOM is never rebuilt by a later turn, so
   *  `aria-live` announces the new answer and not the whole conversation. */
  function renderLog() {
    var log = Q.$('#ai-log');
    if (!log) return;

    if (transcript.length < rendered) clearLog(log);

    if (!transcript.length) {
      if (!log.firstChild) Q.fill(log, [emptyLogNode()]);
      return;
    }

    if (rendered === 0) Q.clear(log);

    var added = false;
    for (var i = rendered; i < transcript.length; i++) {
      log.appendChild(userNode(transcript[i], i));
      log.appendChild(assistantNode(transcript[i], i));
      added = true;
    }
    rendered = transcript.length;
    if (added) log.scrollTop = log.scrollHeight;
  }

  /** Re-render one assistant message in place — a disclosure toggled, a turn
   *  undone. Charts own observers, so the old node is released first. */
  function redrawTurn(index) {
    var log = Q.$('#ai-log');
    if (!log || !transcript[index]) return;
    var old = Q.$('.msg--ai[data-turn="' + index + '"]', log);
    if (!old) { renderLog(); return; }
    withFocus(log, function () {
      if (GEO.charts && GEO.charts.destroy) GEO.charts.destroy(old);
      old.parentNode.replaceChild(assistantNode(transcript[index], index), old);
    });
  }

  function redrawAll() {
    var log = Q.$('#ai-log');
    if (log) clearLog(log);
    renderLog();
    var s = GEO.state.get();
    renderSuggestions(s);
    renderContext(s);
  }

  /* =====================================================================
   * 6. ASKING
   * =================================================================== */

  /** The slice of state a turn can change, captured before it runs. This is
   *  what I-07 restores; nothing else is touched, so undoing an answer cannot
   *  reset the viewport or the rail the reader is standing in. */
  function snapshot(state) {
    return U.clone({
      filters: state.filters,
      aiLayers: state.aiLayers,
      radius: state.radius,
      selectedId: state.selectedId,
      compare: state.compare,
      overlay: state.overlay,
      /* `aiSession` merges one level deep, so the conversation survives while
         the pointer the next "only those…" resolves against is rolled back
         with everything else (§58). */
      aiSession: { lastResultIds: state.aiSession.lastResultIds,
                   lastIntent: state.aiSession.lastIntent }
    });
  }

  /** A response object built here rather than by the engine, for the one case
   *  the engine cannot cover: it threw before it could produce one. All six
   *  blocks are still present — the contract does not have an exception. */
  function failureResponse(err) {
    return {
      intent: 'error',
      answer: t('ai.error.title') + ' ' + t('ai.error.body'),
      analysis: [], mapActions: [],
      dataCoverage: '',
      limitations: [String((err && err.message) || err)],
      sources: [],
      origin: AI.ORIGIN.UNAVAILABLE,
      unavailable: true,
      resultIds: null, resultCount: null, table: null, chart: null,
      suggestions: AI.suggestions ? AI.suggestions().slice(0, 3) : [],
      trace: { intent: 'error', slots: null, tools: [], durationMs: 0 }
    };
  }

  function ask(utterance) {
    var q = String(utterance || '').trim();
    if (!q) return;

    var before = GEO.state.get();
    var inCount = GEO.boot.visible(before).length;
    var snap = snapshot(before);
    var resp;

    try { resp = AI.ask(q); }
    catch (e) {
      GEO.log.error('23-ai-panel: the assistant threw', e);
      resp = failureResponse(e);
    }

    transcript.push({ q: q, at: new Date().toISOString(), response: resp,
                      before: snap, inCount: inCount, undone: false });

    var box = Q.$('#ai-input');
    if (box) { box.value = ''; autoGrow(box); }

    /* `AI.ask` writes state — and therefore renders — before it returns, so the
       new turn has to be drawn here rather than waiting for a render that has
       already happened. */
    var s = GEO.state.get();
    renderLog();
    renderSuggestions(s);
    renderContext(s);
    syncSend();
  }

  /* =====================================================================
   * 7. INPUT, SUGGESTIONS, CONTEXT
   * =================================================================== */

  function autoGrow(box) {
    box.style.height = 'auto';
    box.style.height = Math.min(box.scrollHeight, 140) + 'px';
  }

  function syncSend() {
    var box = Q.$('#ai-input'), btn = Q.$('#ai-send');
    if (!box || !btn) return;
    var empty = !String(box.value || '').trim();
    btn.disabled = empty;
    /* §29 — the reason is on the control itself, and the label never lies
       about whether pressing it will do anything. */
    btn.title = empty ? t('ai.send.disabled') : t('ai.send');
  }

  /**
   * I-03. Built from `GEO.ai.intents.examples()`, so a chip can never advertise
   * an intent the parser does not implement. The order is context-driven: the
   * two intents that need a selection are offered only when something is
   * selected, and the reset is offered only when there is something to reset.
   *
   * The GLA chip is deliberate. It is drawn from the same catalogue, it matches
   * the filter intent, and on this dataset it refuses — which is how a tester
   * sees §62 behaviour without having to know to ask for it.
   */
  function suggestionIds(state) {
    var ids = [];
    if (state.selectedId) ids.push('competitors', 'location_analysis');
    ids.push('filter', 'rank_districts');
    var last = state.aiSession.lastResultIds;
    if (last && last.length >= 2) ids.push('compare', 'export');
    ids.push('data_quality', 'verification', 'coverage');
    if (GEO.state.activeFilterCount(state.filters) || state.aiLayers.length || state.radius) {
      ids.push('clear_analysis');
    }
    ids.push('rank_classes', 'clusters');
    return U.uniq(ids);
  }

  function suggestionPrompts(state) {
    var cat = (AI.intents && AI.intents.examples) ? AI.intents.examples() : [];
    var byId = {};
    cat.forEach(function (c) { byId[c.id] = c.examples || []; });

    var out = [];
    suggestionIds(state).forEach(function (id) {
      var ex = byId[id];
      if (ex && ex.length && out.length < 7) out.push(ex[0]);
    });

    /* The refusal case, taken from the catalogue rather than written here. */
    var refusal = (byId.filter || []).filter(function (s) { return /m2|m²/i.test(s); })[0];
    if (refusal && out.indexOf(refusal) < 0) out.push(refusal);

    return U.uniq(out).slice(0, 8);
  }

  function renderSuggestions(state) {
    var box = Q.$('#ai-suggest');
    if (!box) return;
    var prompts = suggestionPrompts(state);
    var sig = prompts.join('|') + '|' + GEO.i18n.locale;
    if (box.dataset.sig === sig) return;
    box.dataset.sig = sig;

    Q.fill(box, [el('span.micro', { text: t('ai.suggest.title') })].concat(
      prompts.map(function (p) {
        return el('button.chip.chip--suggest', {
          type: 'button', text: p,
          onclick: function () { ask(p); }
        });
      })));
  }

  /**
   * I-04. §44/§58 are only credible if the reader can see the three things the
   * assistant resolves pronouns against. The selection and the filters are
   * owned elsewhere and shown here read-only; the last result set is the one
   * piece of context this panel can honestly clear, so it is the only one with
   * an × on it — a clear button for the selection would be a second, invisible
   * notion of "selected" that disagreed with the map.
   */
  function renderContext(state) {
    var box = Q.$('#ai-context');
    if (!box) return;

    var rec = state.selectedId ? GEO.data.get(state.selectedId) : null;
    var filterText = GEO.filters ? GEO.filters.describe(state.filters) : '';
    var last = state.aiSession.lastResultIds;
    var lastN = last ? last.length : 0;

    var sig = [state.selectedId || '', filterText, String(lastN), GEO.i18n.locale,
               String(dataVersion)].join(';');
    if (box.dataset.sig === sig) return;
    box.dataset.sig = sig;

    var chips = [];

    chips.push(el('span.chip.chip--ctx', {}, [
      el('span.chip__label', {
        text: rec ? t('ai.context.selected', { name: nameOf(rec) }) : t('ai.context.none')
      })
    ]));

    chips.push(el('span.chip', {}, [
      el('span.chip__label', {
        text: filterText ? t('ai.context.filters', { text: filterText })
                         : t('ai.context.filters.none')
      })
    ]));

    if (lastN) {
      chips.push(el('span.chip.chip--ai', { title: t('ai.context.clearResult') }, [
        el('span.chip__label', { text: t('ai.context.lastResult', { n: F.int(lastN) }) }),
        el('button.chip__x', {
          type: 'button', text: '×', 'aria-label': t('ai.context.clearResult'),
          onclick: function () {
            GEO.state.set({ aiSession: { lastResultIds: null, lastIntent: null } },
                          { source: 'user', action: 'ai:clearContext',
                            summary: t('ai.context.clearResult') });
          }
        })
      ]));
    } else {
      chips.push(el('span.chip', {}, [
        el('span.chip__label', { text: t('ai.context.lastResult.none') })
      ]));
    }

    Q.fill(box, [
      el('p.micro', { text: t('ai.context.title') }),
      el('div.fchips', {}, chips),
      el('p.micro', { text: t('ai.context.note') })
    ]);
  }

  /* =====================================================================
   * 8. SESSION LOG (§61)
   * =================================================================== */

  function sourceLabel(src) {
    var k = SOURCE_KEYS[src];
    return k ? t(k) : String(src || '');
  }

  function logTable(entries) {
    if (!entries.length) return [el('p.empty__body', { text: t('ai.log.empty') })];

    var shown = entries.slice(-LOG_ROWS).reverse();
    var kids = [];
    if (entries.length > shown.length) {
      kids.push(el('p.micro', {
        text: t('ai.log.trimmed', { n: F.int(shown.length), m: F.int(entries.length) })
      }));
    }
    kids.push(el('div', { style: 'max-height:40vh;overflow:auto;max-width:100%' }, [
      el('table.tbl.tbl--zebra', {}, [
        el('thead', {}, [el('tr', {}, [
          el('th', { scope: 'col', text: t('ai.log.col.time') }),
          el('th', { scope: 'col', text: t('ai.log.col.source') }),
          el('th', { scope: 'col', text: t('ai.log.col.action') }),
          el('th', { scope: 'col', text: t('ai.log.col.summary') })
        ])]),
        el('tbody', {}, shown.map(function (e) {
          return el('tr', {}, [
            el('th.tbl__rowhd', { scope: 'row', text: clockOf(e.t) }),
            el('td', { text: sourceLabel(e.source) }),
            el('td', { text: String(e.action || '') }),
            el('td' + (e.summary ? '' : '.unk'), {
              text: e.summary || F.UNKNOWN
            })
          ]);
        }))
      ])
    ]));
    kids.push(el('p.micro', { text: t('ai.log.note') }));
    return kids;
  }

  /**
   * I-12. The §61 field shape: when, what was asked, which intent matched,
   * which tools ran with which arguments, how many records went in and out —
   * plus the Tier-1 state log. In a prototype whose purpose is user testing,
   * this file is the research output, so it carries its own provenance header.
   */
  function exportLog() {
    var s = GEO.state.get();
    var payload = {
      product: GEO.PRODUCT.name,
      version: GEO.PRODUCT.version,
      exportedAt: new Date().toISOString(),
      engine: t('ai.provider.local'),
      note: t('ai.log.note'),
      role: s.role,
      demoMode: s.demoMode,
      turns: transcript.map(function (e, i) {
        var r = e.response;
        return {
          seq: i + 1,
          at: e.at,
          prompt: e.q,
          intent: r.intent,
          matched: r.trace ? r.trace.intent : null,
          slots: r.trace ? r.trace.slots : null,
          tools: r.trace ? r.trace.tools : [],
          origin: r.origin,
          unavailable: !!r.unavailable,
          recordsIn: e.inCount,
          recordsOut: r.resultCount,
          answer: r.answer,
          dataCoverage: r.dataCoverage,
          limitations: r.limitations,
          sources: r.sources,
          elapsedMs: r.trace ? r.trace.durationMs : null,
          undone: !!e.undone
        };
      }),
      stateLog: GEO.state.sessionLog()
    };
    GEO.boot.download(JSON.stringify(payload, null, 1),
                      'geo-mvp-session-' + GEO.date.today() + '.json',
                      'application/json');
    GEO.boot.toast(t('ai.log.exported'));
  }

  function newSession() {
    /* The confirm says what actually happens. `State.clearSession()` empties
       the §61 log as well as the conversation, so offering to keep it would be
       a promise the code does not keep — hence the "export first" sentence. */
    GEO.boot.confirm(t('ai.newSession.confirm'), t('ai.newSession.explain'),
      t('ai.newSession.go'),
      function () {
        transcript = [];
        view.how = {};
        GEO.state.clearSession();
        redrawAll();
      }, true);
  }

  function renderTools() {
    var box = Q.$('#ai-tools');
    if (!box) return;
    var entries = GEO.state.sessionLog();
    var sig = [String(entries.length), view.logOpen ? '1' : '0', String(transcript.length),
               GEO.i18n.locale].join(';');
    if (box.dataset.sig === sig) return;
    box.dataset.sig = sig;

    withFocus(box, function () { fillTools(box, entries); });
  }

  function fillTools(box, entries) {
    Q.fill(box, [
      el('div.row', {}, [
        el('span.micro', { text: t('ai.session.count', { n: F.int(transcript.length) }) }),
        el('button.btn.btn--quiet.btn--sm.push', {
          type: 'button', text: t('ai.exportLog'), onclick: exportLog
        }),
        el('button.btn.btn--quiet.btn--sm', {
          type: 'button', text: t('ai.newSession'), onclick: newSession
        })
      ]),
      disclosure('ai-log-body', t('ai.log.title'), t('ai.log.title'),
                 F.int(entries.length), view.logOpen,
                 function () { view.logOpen = !view.logOpen; renderTools(); },
                 function () { return logTable(entries); })
    ]);
  }

  /* =====================================================================
   * 9. THE LAYERS TAB (§57, Y-01 … Y-11)
   * =================================================================== */

  function layerCreator(layer) {
    return t('map.layer.createdBy', {
      who: layer.source === 'manual' ? t('map.layer.by.manual') : t('map.layer.by.assistant'),
      date: F.date(layer.createdAt)
    });
  }

  /** A layer's own radius, if it owns one. Removing the layer must remove the
   *  ring with it, or the map keeps drawing a circle nothing explains (Y-08). */
  function radiusSubjectOf(layer) {
    var cm = layer.criteriaMachine || {};
    return cm.subject || cm.subjectId || cm.originId || null;
  }

  function setLayers(state, layers, action, summary, extra) {
    var patch = Object.assign({ aiLayers: layers }, extra || {});
    GEO.state.set(patch, { source: 'user', action: action, summary: summary });
  }

  function removeLayer(state, layer) {
    var kept = state.aiLayers.filter(function (l) { return l.id !== layer.id; });
    var subject = radiusSubjectOf(layer);
    var dropRadius = !!(subject && state.radius && state.radius.id === subject);
    var beforeLayers = state.aiLayers, beforeRadius = state.radius;

    setLayers(state, kept, 'layer:remove', t('toast.layerRemoved', { name: layer.name }),
              dropRadius ? { radius: null } : null);

    GEO.boot.toast(t('toast.layerRemoved', { name: layer.name }), {
      label: t('toast.undo'),
      run: function () {
        GEO.state.set({ aiLayers: beforeLayers, radius: beforeRadius },
                      { source: 'user', action: 'layer:remove:undo', summary: layer.name });
      }
    });
  }

  function clearAllLayers(state) {
    var n = state.aiLayers.length;
    GEO.boot.confirm(t('map.layer.clearAll.confirm'),
      t('map.layer.clearAll.body', { n: F.int(n) }),
      t('map.layer.clearAll'),
      function () {
        /* Every ring belongs to some layer or to the Property tab's own
           analysis; clearing all layers clears the rings they own, which in
           practice is the radius currently on the map. */
        GEO.state.set({ aiLayers: [], radius: null },
                      { source: 'user', action: 'layer:clearAll',
                        summary: t('toast.layersCleared', { n: F.int(n) }) });
        GEO.boot.toast(t('toast.layersCleared', { n: F.int(n) }));
      }, true);
  }

  function commitRename(state, layer) {
    var next = String(view.renameDraft || '').trim();
    view.rename = null;
    if (!next || next === layer.name) { view.renameDraft = ''; redrawLayers(); return; }
    view.renameDraft = '';
    setLayers(state, state.aiLayers.map(function (l) {
      return l.id === layer.id ? Object.assign({}, l, { name: next }) : l;
    }), 'layer:rename', layer.name + ' → ' + next);
  }

  function nameCell(state, layer) {
    if (view.rename !== layer.id) {
      return el('span.layer__name', { text: layer.name });
    }
    /* Y-07 — Enter commits, Escape cancels. Blur commits too: leaving a field
       and losing what you typed is the more surprising of the two. */
    return el('input.input.layer__name', {
      type: 'text', value: view.renameDraft, 'aria-label': t('layers.rename.label'),
      oninput: function (e) { view.renameDraft = e.target.value; },
      onkeydown: function (e) {
        if (e.key === 'Enter') { e.preventDefault(); commitRename(state, layer); }
        else if (e.key === 'Escape') {
          e.preventDefault(); e.stopPropagation();
          view.rename = null; view.renameDraft = ''; redrawLayers();
        }
      },
      onblur: function () { if (view.rename === layer.id) commitRename(state, layer); }
    });
  }

  function layerCard(state, layer, index) {
    var discId = 'ai-layer-' + layer.id;
    var records = recordsOf(layer.recordIds);
    var demo = records.filter(function (r) { return r.recordType === 'DEMO'; }).length;

    var head = [
      el('span.layer__swatch', { 'aria-hidden': 'true' }),
      nameCell(state, layer),
      el('span.layer__count', { text: GEO.i18n.plural('map.layer.count', layer.count) })
    ];

    var kids = [el('div.layer__hd', {}, head)];

    if (demo) {
      kids.push(el('span.badge.badge--demo', { text: t('common.demo.badge') }));
    }

    /* Y-06 — visibility. The map reads `layer.visible` directly, so this is the
       whole implementation of show/hide. */
    kids.push(el('label.check', {}, [
      el('input', {
        type: 'checkbox', checked: layer.visible !== false,
        onchange: function (e) {
          var on = e.target.checked;
          setLayers(state, state.aiLayers.map(function (l) {
            return l.id === layer.id ? Object.assign({}, l, { visible: on }) : l;
          }), 'layer:visible',
          t(on ? 'layers.shown' : 'layers.hidden', { name: layer.name }));
        }
      }),
      el('span.check__text', { text: t('map.layer.visible') })
    ]));

    kids.push(el('p.layer__criteria', { text: layer.criteriaHuman || layer.name }));
    kids.push(el('p.layer__by', { text: layerCreator(layer) }));

    if (!layer.count) {
      /* E-08 — a layer that matched nothing says so, with the rule that
         matched nothing, rather than rendering as an empty box. */
      kids.push(el('div.empty', {}, [
        el('p.empty__title', { text: t('empty.layer.title') }),
        el('p.empty__body', { text: t('empty.layer.body', { criteria: layer.criteriaHuman || layer.name }) })
      ]));
    }

    /* Y-09 — the rule and the machine criteria side by side. Showing both is
       the point: the reader can check that the sentence and the stored
       criteria say the same thing instead of trusting that they do. */
    kids.push(disclosure(discId, t('map.layer.criteria'), t('map.layer.criteria'), null,
      !!view.inspect[layer.id],
      function () { view.inspect[layer.id] = !view.inspect[layer.id]; redrawLayers(); },
      function () {
        return [
          el('p.micro', { text: t('map.layer.criteria.human') }),
          el('p.layer__criteria', { text: layer.criteriaHuman || layer.name }),
          el('p.micro', { text: t('map.layer.criteria.machine') }),
          el('pre.layer__json', {
            text: JSON.stringify(layer.criteriaMachine || {}, null, 1)
          }),
          el('p.micro', {
            text: t('map.layer.records') + ': ' + GEO.i18n.plural('map.layer.count', layer.count)
          }),
          el('p.layer__by', { text: layerCreator(layer) }),
          el('p.micro', { text: t('map.layer.vsFilter') })
        ];
      }));

    var acts = [];
    if (view.rename === layer.id) {
      acts.push(el('button.btn.btn--quiet.btn--sm', {
        type: 'button', text: t('layers.rename.commit'),
        onclick: function () { commitRename(state, layer); }
      }));
      acts.push(el('span.micro', { text: t('map.layer.rename.hint') }));
    } else {
      acts.push(el('button.btn.btn--quiet.btn--sm', {
        type: 'button', text: t('map.layer.rename'),
        onclick: function () {
          view.rename = layer.id;
          view.renameDraft = layer.name;
          redrawLayers();
          // The redraw replaced the row, so focus has to be put back on the
          // field the reader just asked for.
          var input = Q.$('#pane-layers input.layer__name');
          if (input && input.focus) { input.focus(); input.select(); }
        }
      }));
    }

    if (layer.count && GEO.map && GEO.map.fit) {
      acts.push(el('button.btn.btn--quiet.btn--sm', {
        type: 'button', text: t('map.layer.zoom'),
        onclick: function () { GEO.map.fit(recordsOf(layer.recordIds)); }
      }));
    } else {
      acts.push(disabledButton(t('map.layer.zoom'), t('map.layer.zoom.disabled'),
                               'ai-zoom-' + index));
    }

    acts.push(el('button.btn.btn--quiet.btn--sm', {
      type: 'button', text: t('map.layer.remove'),
      onclick: function () { removeLayer(state, layer); }
    }));

    kids.push(el('div.layer__acts', {}, acts));
    return el('div.layer', { dataset: { layer: layer.id } }, kids);
  }

  function baseLayerGroup(state, rows) {
    if (!GEO.map || typeof GEO.map.layerControl !== 'function') return null;
    var node;
    try { node = GEO.map.layerControl(state, rows); }
    catch (e) {
      GEO.log.error('23-ai-panel: the map layer control failed', e);
      return null;
    }
    /* One implementation of the base-layer checkboxes, mounted twice (the map
       popover and here) — 11-map.js publishes `layerControl` for exactly this.
       Its last group is a pointer BACK to this tab, which is furniture once you
       are standing in it, so it is dropped by matching its heading rather than
       by position. */
    Q.$$('.fgroup', node).forEach(function (g) {
      var hd = Q.$('.fgroup__hd', g);
      if (hd && hd.textContent === t('map.layers.analysis') && g.parentNode) {
        g.parentNode.removeChild(g);
      }
    });
    return node;
  }

  function renderLayers(state, rows) {
    var pane = Q.$('#pane-layers');
    if (!pane) return;
    if (state.rightRail !== 'open' || state.rightTab !== 'layers') return;

    var sig = [state.aiLayers.map(function (l) {
      return l.id + ':' + l.name + ':' + l.count + ':' + (l.visible !== false ? 1 : 0);
    }).join('|'),
      String(rows.length), JSON.stringify(state.layerVisibility || {}),
      state.radius ? state.radius.id : '', view.rename || '',
      Object.keys(view.inspect).filter(function (k) { return view.inspect[k]; }).join(','),
      GEO.i18n.locale, String(dataVersion)].join(';');
    if (pane.dataset.sig === sig) return;
    pane.dataset.sig = sig;

    var kids = [];
    var base = baseLayerGroup(state, rows);
    if (base) kids.push(base);

    var layers = state.aiLayers || [];
    var section = [
      el('h3.fgroup__hd', { text: t('map.layers.analysis') }),
      /* §57, stated where it matters: a layer is a saved result set, a filter
         is a live predicate. Testers conflate the two constantly. */
      el('p.fgroup__note', { text: t('map.layer.note') })
    ];

    if (!layers.length) {
      section.push(el('div.empty', {}, [
        el('p.empty__title', { text: t('empty.layers.title') }),
        el('p.empty__body', { text: t('empty.layers.body') }),
        el('p.empty__body', { text: t('map.layer.vsFilter') })
      ]));
    } else {
      section.push(el('div.layers', {}, layers.map(function (l, i) {
        return layerCard(state, l, i);
      })));
      section.push(el('button.btn.btn--quiet.btn--sm', {
        type: 'button', text: t('map.layer.clearAll'),
        onclick: function () { clearAllLayers(state); }
      }));
    }

    kids.push(el('div.fgroup', {}, section));
    kids.push(el('p.layers__footnote', { text: t('map.layers.context.note') }));

    withFocus(pane, function () {
      Q.fill(pane, [el('section.stack', { 'aria-label': t('layers.title') }, kids)]);
    });
  }

  function redrawLayers() {
    var pane = Q.$('#pane-layers');
    if (pane) delete pane.dataset.sig;
    var s = GEO.state.get();
    renderLayers(s, GEO.boot.visible(s));
  }

  /* =====================================================================
   * 10. MOUNTS AND WIRING
   * =================================================================== */

  /* Two nodes the shell does not ship, both inside `#pane-ai`, which is this
     module's region: the session bar above the conversation and the context
     chip above the composer. Nothing is added outside the pane. */
  function ensureMounts() {
    var pane = Q.$('#pane-ai');
    if (!pane) return;
    var log = Q.$('#ai-log'), form = Q.$('#ai-form');
    if (log && !Q.$('#ai-tools')) {
      /* `flex:none` inline because `.ai__tools` is a class this module adds and
         the pane is a flex column: without it an open session log could squeeze
         the conversation it sits above. */
      pane.insertBefore(el('div.ai__tools#ai-tools', {
        role: 'group', 'aria-label': t('ai.log.title'), style: 'flex:none'
      }), log);
    }
    if (form && !Q.$('#ai-context')) {
      /* A group, not a live region: the context changes on every filter click,
         and announcing all three chips each time would drown the answers. */
      pane.insertBefore(el('div.ai__ctx#ai-context', {
        role: 'group', 'aria-label': t('ai.context.title'), style: 'flex:none'
      }), form);
    }
  }

  function wire() {
    if (wired) return;
    var form = Q.$('#ai-form'), box = Q.$('#ai-input');
    if (!form || !box) return;
    wired = true;

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      ask(box.value);
    });

    box.addEventListener('input', function () { autoGrow(box); syncSend(); });

    box.addEventListener('keydown', function (e) {
      /* I-01 — Enter sends, Shift+Enter is a newline, Cmd/Ctrl+Enter also
         sends. The global shortcut handler in 99-boot already steps aside for
         a textarea, so nothing else is listening. */
      if (e.key !== 'Enter') return;
      if (e.shiftKey && !(e.metaKey || e.ctrlKey)) return;
      e.preventDefault();
      ask(box.value);
    });

    box.setAttribute('placeholder', t('ai.input.placeholder'));
    syncSend();
    autoGrow(box);
  }

  /* =====================================================================
   * 11. RENDER
   * =================================================================== */

  function syncTranscript(state) {
    /* The conversation lives here, but the SESSION lives in state. When the
       session is cleared — by the New session button, by a reset, by anything
       at all — the turns go with it. State is the authority; this is the
       reconciliation, not a second source of truth. */
    var turns = (state.aiSession && state.aiSession.turns) || [];
    if (turns.length < transcript.length) {
      transcript = transcript.slice(0, turns.length);
      view.how = {};
      return true;
    }
    return false;
  }

  function render(state, rows) {
    ensureMounts();
    wire();

    if (syncTranscript(state)) redrawAll();

    renderTools();
    renderLog();
    renderSuggestions(state);
    renderContext(state);
    renderLayers(state, rows);
    syncSend();
  }

  /* A dataset edit changes what a layer's records say and what a demo badge
     means, without changing any id — so the signatures have to move with it. */
  GEO.on('data:changed', function () { dataVersion += 1; });
  GEO.on('i18n:locale', function () {
    dataVersion += 1;
    var box = Q.$('#ai-suggest');
    if (box) delete box.dataset.sig;
    var tools = Q.$('#ai-tools');
    if (tools) delete tools.dataset.sig;
  });

  /* `99-boot.js` is LAST in the manifest and opens with `GEO.boot = {}`, so at
     panel-load time `GEO.boot.registerPanel` does not exist yet. DOMContentLoaded
     is the seam: every inline script has run by then, and because this listener
     is added while 23 loads — before 99-boot adds its own — registration lands
     before `B.start()` subscribes the renderer. */
  function registerWithBoot() {
    if (!GEO.boot || !GEO.boot.registerPanel) return false;
    GEO.boot.registerPanel(render);
    return true;
  }

  if (!registerWithBoot()) {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', function () {
        if (!registerWithBoot()) {
          GEO.log.error('23-ai-panel: GEO.boot.registerPanel is unavailable — ' +
                        'the Assistant and Layers tabs will not render');
        }
      });
    } else {
      setTimeout(function () {
        if (!registerWithBoot()) {
          GEO.log.error('23-ai-panel: GEO.boot.registerPanel is unavailable — ' +
                        'the Assistant and Layers tabs will not render');
        }
      }, 0);
    }
  }
}(window));
