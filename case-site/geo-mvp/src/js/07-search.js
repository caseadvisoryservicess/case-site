/* ===========================================================================
 * 07-search — normalisation, transliteration, the folded index
 *
 * Constraint T9. This dataset is mixed-script: 100 of 109 addresses and 12 of
 * 148 names are Cyrillic, district keys are Latin, and one record is spelled
 * `Infinity Business Сenter` with U+0421 CYRILLIC CAPITAL ES where a Latin C
 * belongs. `indexOf` over the raw strings answers "no match" to every question
 * a Tashkent broker actually asks, so every string — query and target alike —
 * is folded to a Latin skeleton before it is compared.
 *
 * TWO foldings, not one, and this is the decision worth explaining.
 * Cyrillic has letters that LOOK like a Latin letter and letters that SOUND
 * like a different one, and they are frequently the same letter:
 *
 *     р  looks like p,  sounds like r        н  looks like h,  sounds like n
 *     с  looks like c,  sounds like s        в  looks like b,  sounds like v
 *     у  looks like y,  sounds like u        х  looks like x,  sounds like h
 *
 * A visual folding is what makes `Infinity Business Center` find the record
 * with the Cyrillic С — the source of that bug is a lookalike glyph. A phonetic
 * folding is what makes `Chilanzar` find the address `Чиланзар 1-й квартал` and
 * `Mirabad` find `Мирабад` — those users are typing a transliteration, not a
 * lookalike. Neither folding alone answers both, so `fold()` is the visual one
 * (the contract's canonical form, homoglyphs first, then the translit table)
 * and `foldPhonetic()` is its phonetic sibling. Every indexed string is stored
 * in both forms, every query is folded both ways, and a hit in either is a hit.
 * The cost is a doubled index over 156 records; the benefit is that the two
 * genuinely different user intents both work.
 *
 * District spelling variants (Mirabad/Mirobod, Chilanzar/Chilonzor …) are NOT
 * fuzzy-matched. They are an explicit alias table, because "Yunusabad" and
 * "Yunusobod" are two names for one administrative district — a fact about
 * Tashkent, not a typo to be guessed at. Edit distance would also happily
 * equate Mirobod with Mirzo, which is a different district.
 *
 * Public API:
 *   fold(s) / foldPhonetic(s)   -> the folded skeletons
 *   buildIndex(rows)            -> precompute `_search` per record (boot + data:changed)
 *   query(rows, q, opts)        -> { items, districts, total, … } for the typeahead
 *   matchesRecord(rec, q)       -> the boolean behind the `q` filter, so the search
 *                                  box and the filter panel cannot disagree
 * ========================================================================= */
(function (w) {
  'use strict';

  var GEO = w.GEO, U = GEO.util;

  function t(key, vars) { return GEO.i18n ? GEO.i18n.t(key, vars) : key; }

  var S = GEO.search = {};

  /* ======================================================== transliteration */

  /* Cyrillic letters whose lowercase glyph is a Latin letter's twin. This is
     the mapping that repairs homoglyph contamination in scraped text. */
  var HOMOGLYPH = {
    'а': 'a', 'е': 'e', 'о': 'o', 'р': 'p', 'с': 'c', 'у': 'y', 'х': 'x',
    'к': 'k', 'м': 'm', 'н': 'h', 'в': 'b', 'т': 't',
    'і': 'i', 'ј': 'j', 'ѕ': 's'            // Ukrainian/Macedonian lookalikes
  };

  /* Everything else, transliterated explicitly. No rule engine: an explicit
     table is auditable, and the letters that matter here (ў қ ғ ҳ) are Uzbek
     Cyrillic, which no generic RU table covers. */
  var TRANSLIT = {
    'б': 'b', 'г': 'g', 'д': 'd', 'ж': 'zh', 'з': 'z', 'и': 'i', 'й': 'y',
    'л': 'l', 'п': 'p', 'ф': 'f', 'ц': 'ts', 'ч': 'ch', 'ш': 'sh', 'щ': 'sch',
    'ъ': '', 'ы': 'y', 'ь': '', 'э': 'e', 'ю': 'yu', 'я': 'ya', 'ё': 'e',
    'ў': 'o', 'қ': 'q', 'ғ': 'g', 'ҳ': 'h', 'ҷ': 'j', 'ҩ': 'h',
    'є': 'e', 'ї': 'i', 'ґ': 'g', 'ң': 'n', 'ә': 'a', 'ө': 'o', 'ү': 'u'
  };

  /* The six letters where the eye and the ear disagree. Applied on top of the
     canonical table to produce the phonetic skeleton. */
  var PHONETIC = { 'р': 'r', 'с': 's', 'у': 'u', 'х': 'h', 'н': 'n', 'в': 'v' };

  function merge() {
    var out = {}, i, k;
    for (i = 0; i < arguments.length; i++) {
      for (k in arguments[i]) {
        if (Object.prototype.hasOwnProperty.call(arguments[i], k)) out[k] = arguments[i][k];
      }
    }
    return out;
  }

  var CANONICAL = merge(TRANSLIT, HOMOGLYPH);          // homoglyphs win
  var SOUNDED   = merge(TRANSLIT, HOMOGLYPH, PHONETIC);

  /* Precomposed Latin letters that NFD does not decompose (ø, ß, æ) plus the
     common accented forms, so the fold still works where String.normalize is
     missing — it is ES6, and this build must parse and run in an old tablet
     browser. */
  var LATIN_FOLD = {
    'à': 'a', 'á': 'a', 'â': 'a', 'ã': 'a', 'ä': 'a', 'å': 'a', 'ā': 'a', 'ă': 'a',
    'æ': 'ae', 'ç': 'c', 'ć': 'c', 'č': 'c',
    'è': 'e', 'é': 'e', 'ê': 'e', 'ë': 'e', 'ē': 'e', 'ę': 'e', 'ě': 'e',
    'ì': 'i', 'í': 'i', 'î': 'i', 'ï': 'i', 'ī': 'i', 'ı': 'i',
    'ñ': 'n', 'ń': 'n', 'ò': 'o', 'ó': 'o', 'ô': 'o', 'õ': 'o', 'ö': 'o',
    'ø': 'o', 'ō': 'o', 'ő': 'o',
    'ù': 'u', 'ú': 'u', 'û': 'u', 'ü': 'u', 'ū': 'u', 'ů': 'u',
    'ý': 'y', 'ÿ': 'y', 'ß': 'ss', 'œ': 'oe', 'š': 's', 'ś': 's', 'ş': 's',
    'ž': 'z', 'ź': 'z', 'ż': 'z', 'ř': 'r', 'ł': 'l', 'đ': 'd', 'ğ': 'g', 'ț': 't'
  };

  var CAN_NORMALIZE = (typeof String.prototype.normalize === 'function');

  var RE_CYRILLIC  = /[Ѐ-ԯ]/g;
  var RE_COMBINING = /[̀-ͯ]/g;
  var RE_LATIN_EXT = /[À-ɏ]/g;
  var RE_NOISE     = /[^a-z0-9]+/g;

  /* Cyrillic characters this build has no mapping for, reported once each. A
     silent drop would show up later as "search cannot find that building" with
     no way to trace it; the log line names the character. */
  var unmapped = {};

  function skeleton(s, table) {
    if (s === null || s === undefined) return '';
    var x = String(s).toLowerCase();

    // Cyrillic BEFORE decomposition: ё, й and ў decompose to е, и, у plus a
    // combining mark, and stripping the mark first would silently turn ў ("o")
    // into у ("y"/"u") — the Uzbek spellings would stop matching.
    x = x.replace(RE_CYRILLIC, function (c) {
      if (typeof table[c] === 'string') return table[c];
      if (!unmapped[c]) {
        unmapped[c] = true;
        GEO.log.warn('search: no transliteration for "' + c + '" (U+' +
                     c.charCodeAt(0).toString(16).toUpperCase() + ') – folded to a separator');
      }
      return ' ';
    });

    if (CAN_NORMALIZE) x = x.normalize('NFD').replace(RE_COMBINING, '');
    x = x.replace(RE_LATIN_EXT, function (c) { return LATIN_FOLD[c] || c; });

    // Punctuation, quotes and anything still unmapped become separators, so
    // "Mirzo-Ulugbek", "Mirzo Ulugbek" and "mirzo  ulugbek" are one string.
    return x.replace(RE_NOISE, ' ').trim();
  }

  /** The canonical fold: lowercase, homoglyphs to their Latin twins, the rest
   *  transliterated, diacritics stripped, punctuation collapsed. */
  S.fold = function (s) { return skeleton(s, CANONICAL); };

  /** The phonetic fold — identical for Latin input, and the reason a typed
   *  transliteration finds Cyrillic source text. */
  S.foldPhonetic = function (s) { return skeleton(s, SOUNDED); };

  /** Both skeletons of one string. `p === f` for anything already Latin. */
  S.variants = function (s) { return { f: S.fold(s), p: S.foldPhonetic(s) }; };

  var variants = S.variants;

  /* ============================================================== districts */

  /* Latin spellings of the same district that both appear in this market's
     documents. The Russian and Uzbek spellings are NOT listed here — they are
     folded out of `districts[]` in the seed, so the alias set stays in step
     with the data instead of drifting from a hand-written copy. */
  var LATIN_ALIASES = {
    'mirobod':       ['Mirabad'],
    'yunusobod':     ['Yunusabad'],
    'chilonzor':     ['Chilanzar'],
    'shayxontohur':  ['Shaykhantakhur', 'Shayhantahur'],
    'yashnobod':     ['Yashnabad'],
    'yakkasaroy':    ['Yakkasaray'],
    'olmazor':       ['Almazar'],                  // the seed's RU name is Алмазар
    'mirzo-ulugbek': ['Mirzo Ulughbek', 'Mirzo Ulugbeg']
  };

  var districtIndex = null;

  function buildDistrictIndex() {
    var idx = {};
    var list = (GEO.data && GEO.data.districts) ? GEO.data.districts() : [];
    list.forEach(function (d) {
      var seen = {}, aliases = [];
      var words = [d.key, d.name, d.nameRu, d.nameUz].concat(LATIN_ALIASES[d.key] || []);
      words.forEach(function (word) {
        if (!U.isKnown(word)) return;
        var v = variants(word);
        if (!v.f || seen[v.f + '|' + v.p]) return;
        seen[v.f + '|' + v.p] = true;
        aliases.push(v);
      });
      idx[d.key] = { key: d.key, label: d.name, aliases: aliases };
    });
    return idx;
  }

  function districts() {
    if (!districtIndex) districtIndex = buildDistrictIndex();
    return districtIndex;
  }

  /* ================================================================= index */

  /* Bumped by buildIndex(). A record carries the version its blob was built
     at, so an edited or re-imported record re-folds lazily instead of serving
     a stale skeleton — the failure mode where a renamed building is still
     findable only under its old name. */
  var version = 0;

  function joinVariants(parts, key) {
    var out = [];
    parts.forEach(function (p) { if (p && p[key]) out.push(p[key]); });
    return out.join(' ');
  }

  function tenantName(entry) {
    if (!entry) return null;
    if (typeof entry === 'string') return entry;          // imported files use plain strings
    return U.isKnown(entry.name) ? entry.name : null;
  }

  function build(rec) {
    var name = variants(rec.name);

    var alt = [];
    (rec.altNames || []).forEach(function (a) {
      if (U.isKnown(a)) alt.push({ text: a, v: variants(a) });
    });

    var address = variants(rec.address);

    var tenants = [];
    (rec.tenants || []).forEach(function (entry) {
      var nm = tenantName(entry);
      if (nm) tenants.push({ text: nm, v: variants(nm) });
    });

    // The district goes in under every spelling it has, which is what makes
    // "Mirabad" return the 28 Mirobod buildings whose own addresses are Cyrillic.
    var d = districts()[rec.districtKey] || null;

    var all = [name, address, variants(rec.id)]
      .concat(alt.map(function (a) { return a.v; }))
      .concat(tenants.map(function (x) { return x.v; }))
      .concat(d ? d.aliases : []);

    return {
      v: version,
      idRaw: String(rec.id || '').toLowerCase(),
      name: name,
      alt: alt,
      address: address,
      tenants: tenants,
      district: d,
      blob: { f: joinVariants(all, 'f'), p: joinVariants(all, 'p') }
    };
  }

  /* Non-enumerable on purpose: `_search` is a derived cache, and JSON.stringify
     skips it. An enumerable copy would ride along into every export file and
     come back in the next import as data that looks authoritative and is not. */
  function attach(rec, blob) {
    try {
      Object.defineProperty(rec, '_search', {
        value: blob, writable: true, enumerable: false, configurable: true
      });
    } catch (e) {
      try { rec._search = blob; }
      catch (e2) { /* frozen record — blobFor() just recomputes each time */ }
    }
  }

  function blobFor(rec) {
    var ix = rec._search;
    if (ix && ix.v === version) return ix;
    ix = build(rec);
    attach(rec, ix);
    return ix;
  }

  /** Fold one record now and cache it. Returns the blob. */
  S.indexRecord = function (rec) { return blobFor(rec); };

  /**
   * Precompute the folded blob for every record. Called at boot and on every
   * `data:changed`; cheap enough (≈1 ms for 156 records) that rebuilding twice
   * costs nothing, while missing a rebuild is a correctness bug.
   */
  S.buildIndex = function (rows) {
    version++;
    districtIndex = null;                 // an import can replace districts too
    var list = rows || (GEO.data ? GEO.data.observed().concat(GEO.data.demoRecords()) : []);
    list.forEach(blobFor);
    return { records: list.length, version: version };
  };

  GEO.on('data:changed', function () { S.buildIndex(); });

  /* ================================================================ query */

  /* Both skeletons of the query plus its tokens. Tokens are folded from the
     RAW words, not by splitting a folded string, so the visual and phonetic
     token lists always line up index for index. */
  function compile(q) {
    var raw = (q === null || q === undefined) ? '' : String(q);
    var out = { raw: raw.toLowerCase().replace(/\s+/g, ' ').trim(),
                f: S.fold(raw), p: S.foldPhonetic(raw), tokens: [] };
    raw.split(/\s+/).forEach(function (word) {
      var v = variants(word);
      if (v.f) out.tokens.push(v);
    });
    return out;
  }

  /* The filter engine calls matchesRecord() once per record per keystroke;
     one-entry memoisation keeps that to one fold of the query, not 156. */
  var lastQ = null;
  function compileCached(q) {
    var raw = (q === null || q === undefined) ? '' : String(q);
    if (lastQ && lastQ.src === raw) return lastQ.v;
    var v = compile(raw);
    lastQ = { src: raw, v: v };
    return v;
  }

  S.compile = compileCached;

  var SCORE = S.SCORE = {
    nameExact: 100, altExact: 92, id: 90,
    namePrefix: 80, altPrefix: 72,
    nameContains: 60, altContains: 54,
    address: 40, tenant: 30, district: 20, tokens: 10,
    wordBoundary: 4        // a hit that starts a word beats one buried mid-word
  };

  var DISTRICT_SCORE = { exact: 100, prefix: 80, contains: 60 };

  /** 'exact' | 'prefix' | 'contains' | null, over whichever skeleton hits. */
  function tier(v, q) {
    if (!q.f || !v || !v.f) return null;
    if (v.f === q.f || v.p === q.p) return 'exact';
    if (v.f.indexOf(q.f) === 0 || v.p.indexOf(q.p) === 0) return 'prefix';
    if (v.f.indexOf(q.f) >= 0 || v.p.indexOf(q.p) >= 0) return 'contains';
    return null;
  }

  function wordHit(hay, needle) {
    if (!hay || !needle) return false;
    var i = hay.indexOf(needle);
    while (i >= 0) {
      if (i === 0 || hay.charAt(i - 1) === ' ') return true;
      i = hay.indexOf(needle, i + 1);
    }
    return false;
  }

  function boundaryBonus(v, q) {
    return (wordHit(v.f, q.f) || wordHit(v.p, q.p)) ? SCORE.wordBoundary : 0;
  }

  function everyToken(blob, q) {
    if (!q.tokens.length) return false;
    return q.tokens.every(function (tok) {
      return blob.f.indexOf(tok.f) >= 0 || blob.p.indexOf(tok.p) >= 0;
    });
  }

  var TIER_KEY = { exact: 'Exact', prefix: 'Prefix', contains: 'Contains' };

  var MATCH_LABEL = {
    name:     'search.matched.name',
    altName:  'search.matched.altName',
    address:  'search.matched.address',
    tenant:   'search.matched.tenant',
    district: 'search.matched.district',
    id:       'search.matched.id',
    tokens:   'search.matched.tokens'
  };

  /**
   * Rank one record against a compiled query.
   * Order (T9 / §18): exact name > name prefix > name substring > address >
   * tenant > district. `null` when nothing matched.
   */
  function scoreRecord(rec, q) {
    var ix = blobFor(rec);
    var best = null;

    function offer(score, matchedOn, snippet) {
      if (!best || score > best.score) {
        best = { score: score, matchedOn: matchedOn, snippet: snippet };
      }
    }

    if (q.raw && ix.idRaw === q.raw) offer(SCORE.id, 'id', rec.id);

    var ti = tier(ix.name, q);
    if (ti) {
      offer(SCORE['name' + TIER_KEY[ti]] + (ti === 'contains' ? boundaryBonus(ix.name, q) : 0),
            'name', rec.name);
    }

    ix.alt.forEach(function (a) {
      var at = tier(a.v, q);
      if (at) {
        offer(SCORE['alt' + TIER_KEY[at]] + (at === 'contains' ? boundaryBonus(a.v, q) : 0),
              'altName', a.text);
      }
    });

    if (tier(ix.address, q)) {
      offer(SCORE.address + boundaryBonus(ix.address, q), 'address', rec.address);
    }

    ix.tenants.forEach(function (x) {
      if (tier(x.v, q)) offer(SCORE.tenant, 'tenant', x.text);
    });

    if (ix.district && ix.district.aliases.some(function (a) { return !!tier(a, q); })) {
      offer(SCORE.district, 'district', ix.district.label);
    }

    // Last resort: every word of the query appears somewhere in the record,
    // just not contiguously ("Renaissance Yunusobod"). Ranked below every
    // field-specific hit so it can never outrank a real name match.
    if (!best && q.tokens.length > 1 && everyToken(ix.blob, q)) {
      offer(SCORE.tokens, 'tokens', rec.address || rec.name || GEO.fmt.UNKNOWN);
    }

    return best;
  }

  /** sort() is not stable in every engine this must run in, so the comparator
   *  is a total order: score, then the shorter (more specific) name, then id. */
  function byRank(a, b) {
    if (b.score !== a.score) return b.score - a.score;
    var an = String(a.record.name || ''), bn = String(b.record.name || '');
    if (an.length !== bn.length) return an.length - bn.length;
    if (an !== bn) return an < bn ? -1 : 1;
    return String(a.record.id) < String(b.record.id) ? -1 : 1;
  }

  function districtResults(q, rows) {
    var idx = districts(), counts = {}, out = [];

    (rows || []).forEach(function (r) {
      if (U.isKnown(r.districtKey)) counts[r.districtKey] = (counts[r.districtKey] || 0) + 1;
    });

    Object.keys(idx).forEach(function (key) {
      var d = idx[key], best = 0;
      d.aliases.forEach(function (a) {
        var ti = tier(a, q);
        // A one- or two-character substring matches half the districts; a
        // prefix of the same length is a real intent, so only `contains` is held back.
        if (!ti || (ti === 'contains' && q.f.length < 3)) return;
        if (DISTRICT_SCORE[ti] > best) best = DISTRICT_SCORE[ti];
      });
      if (best) out.push({ key: key, name: d.label, count: counts[key] || 0, score: best });
    });

    out.sort(function (a, b) {
      if (b.score !== a.score) return b.score - a.score;
      if (b.count !== a.count) return b.count - a.count;
      return a.name < b.name ? -1 : 1;
    });
    return out;
  }

  /**
   * Ranked search over `rows`.
   *
   * @param rows  the records in scope — always passed in, never read from the
   *              repository here, so a search inside a filtered view or a demo-
   *              free working set searches exactly what the user is looking at.
   * @param opts  { limit: 8, districts: true }
   * @returns { items:[{record,score,matchedOn,matchedLabel,snippet}], districts:[{key,name,count}],
   *            total, truncated, noQuery, q, folded }
   *
   * `total` is the TRUE number of matches, not the capped one — "See all N
   * results" has to be honest about N or the row is a lie (§29).
   */
  S.query = function (rows, q, opts) {
    opts = opts || {};
    var limit = (opts.limit === undefined || opts.limit === null) ? 8 : opts.limit;
    var qv = compileCached(q);

    var out = {
      q: (q === null || q === undefined) ? '' : String(q),
      folded: qv.f, phonetic: qv.p,
      items: [], districts: [], total: 0, truncated: false,
      // An empty query is not "no results": the caller must be able to tell
      // "nothing typed" from "typed, found nothing" or it renders the E-04
      // empty state over an empty search box.
      noQuery: !qv.f
    };
    if (out.noQuery) return out;

    var hits = [];
    (rows || []).forEach(function (rec) {
      if (!rec) return;
      var h = scoreRecord(rec, qv);
      if (h) { h.record = rec; hits.push(h); }
    });
    hits.sort(byRank);

    out.total = hits.length;
    var capped = (limit < 0) ? hits : hits.slice(0, limit);
    out.items = capped.map(function (h) {
      return {
        record: h.record,
        score: h.score,
        matchedOn: h.matchedOn,
        matchedLabel: t(MATCH_LABEL[h.matchedOn] || MATCH_LABEL.name),
        snippet: h.snippet
      };
    });
    out.truncated = out.total > out.items.length;
    out.districts = opts.districts === false ? [] : districtResults(qv, rows || []);
    return out;
  };

  /**
   * The predicate behind the `q` filter. The search box and the filter panel
   * call the same function, so they cannot disagree about what "matches".
   *
   * An empty (or punctuation-only) term is NOT a filter that excludes
   * everything — it is the absence of a filter, and returns true.
   */
  S.matchesRecord = function (rec, q) {
    if (!rec) return false;
    var qv = compileCached(q);
    if (!qv.f) return true;
    return scoreRecord(rec, qv) !== null;
  };

  /** What the folding actually did to a query — feeds the assistant's
   *  "How this was answered" disclosure (D13) and makes T9 debuggable. */
  S.explain = function (q) {
    var qv = compileCached(q);
    return {
      raw: qv.raw,
      folded: qv.f,
      phonetic: qv.p,
      tokens: qv.tokens.map(function (v) { return v.f; }),
      districts: districtResults(qv, GEO.data ? GEO.data.observed() : [])
                   .map(function (d) { return d.key; }),
      unmappedCharacters: Object.keys(unmapped)
    };
  };

  /** Index version + the characters this build could not transliterate.
   *  Surfaced by the self-test rather than hidden in a console line. */
  S.stats = function () {
    return { version: version, unmappedCharacters: Object.keys(unmapped) };
  };
}(window));
