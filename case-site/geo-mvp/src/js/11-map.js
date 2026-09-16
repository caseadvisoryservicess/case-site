/* ===========================================================================
 * 11-map — the Leaflet map: divIcon markers, districts, radii, AI layers
 *
 * Brief §9, §10, §16; build contract T2, T7, T8, D5; visual-system §3.
 *
 * Four things here are not obvious and are the reason this file looks the way
 * it does.
 *
 * 1. T2 — THERE ARE NO IMAGE ASSETS. `vendor/leaflet.js` derives its marker
 *    image path from the `<script>` element's `src`, and the assembler INLINES
 *    that script, so it has no `src` and every default icon 404s. Therefore:
 *    `L.divIcon` exclusively, never `L.Icon.Default`, never `L.Control.Layers`
 *    (it loads `layers.png`). The layer control below is our own, mounted into
 *    `#maplayers-panel`, which the shell already ships. The only network
 *    requests this module may cause are OSM tiles.
 *
 * 2. THE LETTER INSIDE THE CIRCLE IS THE POINT (visual-system §3). Identity
 *    never depends on colour alone, so every mark carries its class letter
 *    (`A+ A B+ B C ?`), its confidence initial, or its recorded-field count.
 *    The label colour is derived MECHANICALLY at runtime from the resolved
 *    fill — white at >= 4.5:1 against white, otherwise ink — so re-tuning the
 *    ramp in `01-tokens.css` cannot silently leave an unreadable label behind.
 *
 * 3. CANVAS CANNOT WEAR A CSS CLASS. `preferCanvas: true` is required for the
 *    district polygons to stay smooth, but a canvas-rendered path ignores
 *    `className`, so its colours have to be passed to Leaflet as values. They
 *    are read from the CSS custom properties rather than retyped, keeping
 *    `01-tokens.css` the single source of truth. The radius rings go the other
 *    way — they use the SVG renderer precisely so the `.geo-radius--draw`
 *    sweep in `05-map.css` can run.
 *
 * 4. EVERYTHING WORKS WITH ZERO TILES (T7). A tile failure swaps the basemap
 *    for the neutral graticule and posts one notice; markers, polygons, radii,
 *    labels, clustering and every figure carry on untouched.
 *
 * State discipline: this module reads the state object it is handed and writes
 * only through `GEO.state.set`. It owns R3/R4 — `#map`, `.mapchrome`,
 * `#maplayers-panel`, `#maplegend`, `#map-notice` — and touches nothing else.
 * ========================================================================= */
(function (w) {
  'use strict';

  var GEO = w.GEO, U = GEO.util, Q = GEO.dom, el = Q.el, F = GEO.fmt, S = GEO.schema;
  var t = GEO.i18n.t;
  var M = GEO.map = {};

  /* ------------------------------------------------------------ constants */

  var TASHKENT = [41.3111, 69.2797];
  var MIN_ZOOM = 10;                 /* M-05: the city fits at z10; below it is noise */
  var MAX_ZOOM = 18;
  var FIT_PADDING = 48;              /* M-06 */
  var TILE_URL = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
  var OSM_COPYRIGHT = 'https://www.openstreetmap.org/copyright';

  /* X-E1: one failed tile is a hiccup, eight in five seconds is an outage. */
  var TILE_FAIL_LIMIT = 8;
  var TILE_FAIL_WINDOW_MS = 5000;

  /* T8, verbatim. */
  var CLUSTER = {
    disableClusteringAtZoom: 13,
    maxClusterRadius: 40,
    spiderfyOnMaxZoom: true
  };

  var ENCODINGS = ['officeClass', 'confidence', 'completeness'];

  var CLASS_KEY = { 'A+': 'aPlus', 'A': 'a', 'B+': 'bPlus', 'B': 'b', 'C': 'c' };
  var CONF_LETTER = { High: 'H', Medium: 'M', Low: 'L', Unknown: '?' };

  /* Token name per encoding value. The CSS already fills the pin from these;
     they are repeated here only for the legend swatches (which have no data
     attribute for confidence/completeness) and for the mechanical ink rule. */
  var CLASS_TOKEN = {
    'A+': '--class-aplus', 'A': '--class-a', 'B+': '--class-bplus',
    'B': '--class-b', 'C': '--class-c'
  };
  var CONF_TOKEN = {
    High: '--conf-high', Medium: '--conf-medium',
    Low: '--conf-low', Unknown: '--conf-unknown'
  };
  var CMPL_TOKEN = {
    good: '--class-aplus', partial: '--class-bplus',
    minimal: '--class-c', none: '--class-unknown'
  };

  /* ------------------------------------------------- view bookkeeping only */
  /* None of this is application data. Records live in `GEO.data`, application
     state lives in `GEO.state`; what is held here is a Leaflet handle, a render
     signature (a string) and a couple of DOM restoration hints. */

  var map = null;
  var tiles = null;
  var cluster = null;
  var canvasRenderer = null;
  var svgRenderer = null;

  var markers = {};            /* id -> { marker, sig } */
  var districtLayers = {};     /* key -> L.GeoJSON */
  var radiusGroup = null;
  var contextGroup = null;
  var layerGroups = {};        /* aiLayer id -> L.LayerGroup of its own artefacts */

  var districtSig = null;
  var legendSig = null;
  var layerPanelSig = null;
  var lastFitToken = null;
  var lastSelected = null;
  var legendCollapsed = null;  /* M-10: null until the first render knows the breakpoint */
  var tileFails = [];
  var chromeWired = false;
  var registered = false;
  var railsBeforeFullscreen = null;

  /* ========================================================================
   * Colour: resolve the visual system once, then do arithmetic on it
   * ===================================================================== */

  var palette = null;

  /** Read a CSS custom property, falling back to the visual-system hex so the
   *  map still draws if the stylesheet has not applied yet. */
  function token(name, fallback) {
    if (!palette) {
      palette = { _cs: w.getComputedStyle(document.documentElement), _v: {} };
    }
    if (palette._v[name] === undefined) {
      var raw = '';
      try { raw = palette._cs.getPropertyValue(name); } catch (e) { raw = ''; }
      raw = String(raw || '').trim();
      palette._v[name] = raw || fallback;
    }
    return palette._v[name];
  }

  var WHITE = '#FFFFFF';
  var INK = '#1A1714';

  function channel(c) {
    c = c / 255;
    return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  }

  function luminance(hex) {
    var h = String(hex).trim().replace('#', '');
    if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
    if (h.length !== 6) return 0;
    return 0.2126 * channel(parseInt(h.slice(0, 2), 16)) +
           0.7152 * channel(parseInt(h.slice(2, 4), 16)) +
           0.0722 * channel(parseInt(h.slice(4, 6), 16));
  }

  function contrast(a, b) {
    var la = luminance(a), lb = luminance(b);
    return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
  }

  /**
   * visual-system §3: "use white when contrast(fill, #FFFFFF) >= 4.5, otherwise
   * ink" — stated as mechanical, with no judgement, so it is computed rather
   * than transcribed. On the shipped ramp this yields white on A+/A/B+ and ink
   * on B/C, which is what the table says; the value of computing it is that a
   * future ramp edit cannot leave an unreadable label behind.
   */
  function labelInk(fill) {
    return contrast(fill, WHITE) >= 4.5 ? WHITE : INK;
  }

  /* ---------------------------------------------------------------- motion */

  /** §25 / IA §6.5: reduced motion disables map pan-zoom easing as well as
   *  transitions, so every view change has to ask before it animates. */
  function animates() {
    var mode = document.documentElement.getAttribute('data-motion');
    if (mode === 'full') return true;
    if (mode === 'reduce') return false;
    try { return !w.matchMedia('(prefers-reduced-motion: reduce)').matches; }
    catch (e) { return true; }
  }

  function viewOpts(extra) {
    var o = { animate: animates() };
    if (!o.animate) o.duration = 0;
    return extra ? Object.assign(o, extra) : o;
  }

  /** M-02: a tooltip that needs a hover is a trap on touch, where a tap selects. */
  function hasHover() {
    try { return !w.matchMedia('(hover: none)').matches; }
    catch (e) { return true; }
  }

  /* ========================================================================
   * Marks
   * ===================================================================== */

  function completenessOf(rec) {
    if (GEO.quality && GEO.quality.completeness) {
      try { return GEO.quality.completeness(rec); } catch (e) { /* fall through */ }
    }
    var n = 0;
    S.criticalFields.forEach(function (k) { if (U.isKnown(rec[k])) n++; });
    return { known: n, total: S.criticalFields.length,
             band: n === 0 ? 'none' : (n <= 2 ? 'minimal' : (n <= 5 ? 'partial' : 'good')) };
  }

  /**
   * What one record looks like under the active encoding.
   * `attr` is the data attribute the CSS fills from; `fill` and `ink` are the
   * resolved values, used for the legend swatch and the mechanical label rule.
   * Unknown is always the neutral and never a step of the ramp (§36).
   */
  function encode(rec, mode) {
    if (mode === 'confidence') {
      var c = GEO.data.recordConfidence(rec);
      var cf = token(CONF_TOKEN[c] || '--conf-unknown', '#8A8178');
      return { attr: 'data-conf', key: c, letter: CONF_LETTER[c] || '?',
               fill: cf, ink: labelInk(cf), unknown: c === 'Unknown' };
    }
    if (mode === 'completeness') {
      var b = completenessOf(rec);
      var bf = token(CMPL_TOKEN[b.band] || '--class-unknown', '#8A8178');
      // The digit is the count of recorded critical fields: more informative
      // than a letter and, unlike a band name, it cannot be confused with a grade.
      return { attr: 'data-cmpl', key: b.band, letter: String(b.known),
               fill: bf, ink: labelInk(bf), unknown: b.band === 'none' };
    }
    var known = U.isKnown(rec.officeClass);
    var k = known ? rec.officeClass : 'unknown';
    var f = token(known ? CLASS_TOKEN[rec.officeClass] : '--class-unknown', '#8A8178');
    return { attr: 'data-class', key: k, letter: known ? rec.officeClass : '?',
             fill: f, ink: labelInk(f), unknown: !known };
  }

  /** D6: an unresolved duplicate group is disclosed on the map, never merged away. */
  function isDuplicate(rec) {
    var m = rec._meta || {};
    return !!(m.possibleDuplicate ||
              (m.duplicateGroupId && m.duplicateVerdict !== 'different_buildings'));
  }

  function pinClasses(rec, flags) {
    var c = ['pin'];
    if (flags.selected) c.push('pin--selected');
    else if (flags.hover) c.push('pin--hover');
    if (rec.recordType === 'DEMO') c.push('pin--demo');
    if (isDuplicate(rec)) c.push('pin--dupe');
    if (flags.inLayer) c.push('pin--layer');
    if (flags.muted) c.push('pin--muted');
    return c.join(' ');
  }

  /** The icon. `html` is given as an Element — Leaflet 1.9 appends it rather
   *  than assigning innerHTML — so no data-derived string is ever parsed. */
  function pinIcon(rec, mode, flags) {
    var e = encode(rec, mode);
    var attrs = { 'class': pinClasses(rec, flags), 'aria-hidden': 'true' };
    attrs[e.attr] = e.key;
    attrs.style = 'color:' + e.ink;                 /* the mechanical label rule */
    var pin = el('span', attrs, [el('span.pin__label', { text: e.letter })]);
    return L.divIcon({
      className: 'geo-marker' + (flags.selected ? ' geo-marker--top' : ''),
      iconSize: [26, 26],
      iconAnchor: [13, 13],
      html: pin
    });
  }

  /** M-02: name · class · district · confidence, built as NODES because the
   *  name and the address are third-party scraped text and must never be parsed
   *  as markup. */
  function tooltipNode(rec) {
    var cls = U.isKnown(rec.officeClass) ? rec.officeClass : t('value.class.unknown');
    var conf = GEO.data.recordConfidence(rec);
    var kids = [
      el('span', { text: t('map.tooltip', {
        name: rec.name || F.UNKNOWN,
        'class': cls,
        district: GEO.data.districtName(rec.districtKey)
      }) }),
      el('span.coverage', { text: t('map.tooltip.confidence',
        { level: t('value.confidence.' + String(conf).toLowerCase()) }) })
    ];
    if (rec.recordType === 'DEMO') kids.push(el('span.coverage', { text: t('map.legend.demo') }));
    if (isDuplicate(rec)) kids.push(el('span.coverage', { text: t('map.legend.duplicate') }));
    return el('div', {}, kids);
  }

  /* ========================================================================
   * init
   * ===================================================================== */

  /**
   * @param containerId  the shell's map node id
   * @param opts         { centre, zoom } — optional initial view
   */
  M.init = function (containerId, opts) {
    if (map) return map;
    if (!w.L) throw new Error('Leaflet is not loaded');
    opts = opts || {};

    var node = document.getElementById(containerId || 'map');
    if (!node) throw new Error('No map container "' + (containerId || 'map') + '"');

    canvasRenderer = L.canvas({ padding: 0.5 });
    svgRenderer = L.svg({ padding: 0.5 });

    map = L.map(node, {
      center: opts.centre || TASHKENT,
      zoom: opts.zoom || 12,
      minZoom: MIN_ZOOM,
      maxZoom: MAX_ZOOM,
      preferCanvas: true,           /* districts and coverage hulls go to canvas */
      renderer: canvasRenderer,
      zoomControl: false,           /* M-05: .mapchrome is the only zoom UI */
      attributionControl: true,     /* T7: mandatory and never removed */
      fadeAnimation: animates(),
      zoomAnimation: animates(),
      markerZoomAnimation: animates()
    });

    // M-13: the map is ONE tab stop, not 148. The results list is the accessible
    // equivalent path to every record, so the container says so out loud rather
    // than leaving a keyboard user to discover that markers are unreachable.
    node.setAttribute('role', 'application');
    node.setAttribute('aria-label', t('map.aria') + ' ' + t('map.kbdNote'));

    tiles = L.tileLayer(TILE_URL, {
      minZoom: MIN_ZOOM,
      maxZoom: MAX_ZOOM,
      // Authored markup, not data: the one place an HTML string is legitimate.
      attribution: '<a href="' + OSM_COPYRIGHT + '" target="_blank" rel="noreferrer">' +
                   t('map.attribution') + '</a>'
    });
    tiles.on('tileerror', onTileError);
    tiles.on('tileload', onTileLoad);
    tiles.addTo(map);

    L.control.scale({ metric: true, imperial: false, position: 'bottomright' }).addTo(map);

    cluster = L.markerClusterGroup({
      disableClusteringAtZoom: CLUSTER.disableClusteringAtZoom,
      maxClusterRadius: CLUSTER.maxClusterRadius,
      spiderfyOnMaxZoom: CLUSTER.spiderfyOnMaxZoom,
      showCoverageOnHover: true,
      zoomToBoundsOnClick: true,
      animate: animates(),
      chunkedLoading: true,
      // T8: a cluster is CHROME. The hull it draws on hover is chrome too, so it
      // wears --line-strong and an ink wash, never the data colour.
      polygonOptions: {
        renderer: canvasRenderer,
        color: token('--line-strong', '#CFC9BF'), weight: 1,
        fillColor: token('--ink', '#1A1714'), fillOpacity: 0.04
      },
      iconCreateFunction: clusterIcon
    });
    map.addLayer(cluster);

    radiusGroup = L.layerGroup().addTo(map);
    contextGroup = L.layerGroup().addTo(map);

    // Offline at boot is known before a single tile is requested (X-E1).
    if (w.navigator && w.navigator.onLine === false) setTiles(false);

    wireMapEvents();
    wireChrome();

    // The rails animate `grid-template-columns` on `.app__body`, so the map's box
    // really does change size. One invalidateSize when the transition ENDS is
    // correct and cheap; doing it per frame would be sixty layouts per open.
    var body = Q.$('.app__body');
    if (body) {
      body.addEventListener('transitionend', function (e) {
        if (e.target === body && e.propertyName === 'grid-template-columns') M.invalidate();
      });
    }
    w.addEventListener('resize', U.debounce(function () { M.invalidate(); }, 150));
    document.addEventListener('fullscreenchange', onFullscreenChange);
    document.addEventListener('webkitfullscreenchange', onFullscreenChange);

    register();
    map.whenReady(function () { M.invalidate(); });
    return map;
  };

  M.instance = function () { return map; };
  M.isReady = function () { return !!map; };

  M.invalidate = function () {
    if (map) map.invalidateSize({ animate: false, pan: false });
  };

  /* ------------------------------------------------------------- clusters */

  /** T8 / visual-system §3: surface fill, --line-strong border, ink count. The
   *  size band is geometry only — it never becomes a colour scale. */
  function clusterIcon(c) {
    var n = c.getChildCount();
    var size = n < 10 ? 34 : (n < 100 ? 40 : 46);
    var box = el('span.geo-cluster', { 'aria-hidden': 'true' },
                 [el('span', { text: F.int(n) })]);
    return L.divIcon({
      className: 'marker-cluster',
      iconSize: [size, size],
      iconAnchor: [size / 2, size / 2],
      html: box
    });
  }

  /* ------------------------------------------------------------ map events */

  function wireMapEvents() {
    // The live viewport belongs in the one state object like everything else,
    // but a write per frame would append a session-log line per frame. It is
    // written once the movement has settled, and only when it actually changed.
    var push = U.debounce(function () {
      if (!map) return;
      var c = map.getCenter(), z = map.getZoom();
      var s = GEO.state.get();
      if (s.map && s.map.zoom === z &&
          Math.abs(s.map.centre[0] - c.lat) < 1e-6 &&
          Math.abs(s.map.centre[1] - c.lng) < 1e-6) return;
      GEO.state.set({ map: { centre: [c.lat, c.lng], zoom: z } },
                    { source: 'system', action: 'map:view', summary: 'Map view moved' });
    }, 500);

    map.on('moveend', push);
    map.on('zoomend', function () { push(); syncZoomButtons(); });
  }

  /* ------------------------------------------------------------ tile state */

  function onTileError() {
    var now = Date.now();
    tileFails.push(now);
    tileFails = tileFails.filter(function (ts) { return now - ts < TILE_FAIL_WINDOW_MS; });
    if (tileFails.length >= TILE_FAIL_LIMIT) setTiles(false);
  }

  function onTileLoad() {
    tileFails = [];
    if (!GEO.state.get().tilesOk) setTiles(true);
  }

  function setTiles(ok) {
    var wrap = Q.$('.mapwrap');
    if (wrap) wrap.dataset.tiles = ok ? 'on' : 'off';
    // M-11: the attribution link stays — it is mandatory — but it is greyed and
    // says why it cannot be followed rather than pretending to work.
    Q.$$('.leaflet-control-attribution a[href="' + OSM_COPYRIGHT + '"]').forEach(function (a) {
      if (ok) { a.removeAttribute('data-offline'); a.removeAttribute('title'); }
      else { a.setAttribute('data-offline', 'true'); a.setAttribute('title', t('map.attribution.offline')); }
    });
    if (GEO.state.get().tilesOk !== ok) {
      GEO.state.set({ tilesOk: ok }, { source: 'system', action: 'map:tiles',
        summary: ok ? 'Map tiles available' : 'Map tiles unavailable — data unaffected' });
    }
  }

  function retryTiles() {
    tileFails = [];
    setTiles(true);
    if (tiles) tiles.redraw();
  }

  /**
   * R10-adjacent but map-owned: `#map-notice` carries the two things that are
   * true of the MAP rather than of the app. Both can be true at once, so they
   * stack instead of overwriting each other.
   */
  function renderNotice(state, rows) {
    var box = Q.$('#map-notice');
    if (!box) return;
    var kids = [];

    if (!state.tilesOk) {
      kids.push(el('span', { text: t('map.tiles.offline') + ' ' + t('map.tiles.fallback') }));
      kids.push(el('button.btn.btn--quiet.btn--sm', {
        type: 'button', text: t('common.retry'), onclick: retryTiles
      }));
    }
    if (!rows.length) kids.push(el('span', { text: t('map.empty') }));

    Q.fill(box, kids);
    box.hidden = kids.length === 0;
  }

  /* ========================================================================
   * Records
   * ===================================================================== */

  /**
   * §57: a layer is a saved result set, so its members stay on the map even when
   * the live filters would hide them — otherwise "show me that layer" would
   * silently return fewer properties than the layer says it holds.
   */
  function layerMembership(state) {
    var member = {}, any = false;
    (state.aiLayers || []).forEach(function (l) {
      if (!l.visible) return;
      any = true;
      (l.recordIds || []).forEach(function (id) { member[id] = true; });
    });
    return { ids: member, any: any };
  }

  /**
   * Draw the current result set.
   * Markers are reconciled, never rebuilt wholesale: only the pins whose
   * appearance actually changed get a new icon, so selecting a property costs
   * two `setIcon` calls rather than 148.
   */
  M.renderRecords = function (rows, state) {
    if (!map || !cluster) return;
    if (!state.layerVisibility || state.layerVisibility.properties === false) {
      clearMarkers();
      return;
    }

    var mode = ENCODINGS.indexOf(state.markerEncoding) >= 0 ? state.markerEncoding : 'officeClass';
    var lm = layerMembership(state);

    var inResults = {};
    rows.forEach(function (r) { inResults[r.id] = true; });

    var wanted = rows.slice();
    Object.keys(lm.ids).forEach(function (id) {
      if (inResults[id]) return;
      var rec = GEO.data.get(id);
      if (rec) wanted.push(rec);
    });

    var keep = {}, add = [], drop = [];
    wanted.forEach(function (rec) {
      if (!U.isKnown(rec.lat) || !U.isKnown(rec.lng)) return;   // never plot a guess
      keep[rec.id] = true;

      var flags = {
        selected: state.selectedId === rec.id,
        hover: state.hoverId === rec.id,
        inLayer: !!lm.ids[rec.id],
        // "Muted" means context rather than focus: a record kept only because a
        // layer needs it, or a non-member while a layer is the thing being read.
        muted: !inResults[rec.id] || (lm.any && !lm.ids[rec.id])
      };
      var sig = [mode, flags.selected ? 1 : 0, flags.hover ? 1 : 0,
                 flags.inLayer ? 1 : 0, flags.muted ? 1 : 0].join('');

      var entry = markers[rec.id];
      if (!entry) {
        var marker = L.marker([rec.lat, rec.lng], {
          icon: pinIcon(rec, mode, flags),
          keyboard: false,                  /* M-13: the list is the keyboard path */
          riseOnHover: false,
          zIndexOffset: flags.selected ? 1000 : 0,
          title: ''                         /* no browser tooltip; ours is richer */
        });
        marker.on('click', function () { select(rec.id); });
        marker.on('mouseover', function () { setHover(rec.id); });
        marker.on('mouseout', function () { setHover(null); });
        if (hasHover()) {
          marker.bindTooltip(tooltipNode(rec), { direction: 'top', offset: [0, -14], opacity: 1 });
        }
        markers[rec.id] = { marker: marker, sig: sig };
        add.push(marker);
      } else if (entry.sig !== sig) {
        entry.sig = sig;
        entry.marker.setIcon(pinIcon(rec, mode, flags));
        entry.marker.setZIndexOffset(flags.selected ? 1000 : 0);
      }
    });

    Object.keys(markers).forEach(function (id) {
      if (keep[id]) return;
      drop.push(markers[id].marker);
      delete markers[id];
    });

    if (drop.length) cluster.removeLayers(drop);
    if (add.length) cluster.addLayers(add);

    if (state.selectedId !== lastSelected) {
      lastSelected = state.selectedId;
      expandSelectedCluster(state.selectedId);
    }
  };

  function clearMarkers() {
    if (cluster) cluster.clearLayers();
    markers = {};
    lastSelected = null;
  }

  /**
   * C6b / T8: a selected property that is swallowed by a cluster is invisible,
   * which makes "select from the list" look broken. Spiderfying the containing
   * cluster reveals it WITHOUT moving the viewport — `zoomToShowLayer` would
   * yank the map out from under the reader.
   */
  function expandSelectedCluster(id) {
    if (!id || !cluster || !markers[id]) return;
    var marker = markers[id].marker;
    setTimeout(function () {
      try {
        var parent = cluster.getVisibleParent(marker);
        if (parent && parent !== marker && typeof parent.spiderfy === 'function') parent.spiderfy();
      } catch (e) { GEO.log.warn('cluster expand failed', e); }
    }, 0);
  }

  function select(id) {
    GEO.state.set({ selectedId: id, rightRail: 'open', rightTab: 'property' },
                  { source: 'user', action: 'map:select',
                    summary: 'Selected ' + ((GEO.data.get(id) || {}).name || id) });
  }

  function setHover(id) {
    if (GEO.state.get().hoverId === id) return;
    GEO.state.set({ hoverId: id }, { source: 'user', action: 'map:hover' });
  }

  /* ------------------------------------------------------------- encoding */

  /** S-04. The only writer is `GEO.state.set`; the re-render follows from the
   *  subscription, exactly as it would if the assistant had set it. */
  M.setEncoding = function (mode) {
    if (ENCODINGS.indexOf(mode) < 0) {
      GEO.log.warn('map: unknown marker encoding', mode);
      return GEO.state.get();
    }
    return GEO.state.set({ markerEncoding: mode },
      { source: 'user', action: 'map:encoding',
        summary: 'Markers coloured by ' + t('map.legend.' + encodingKey(mode)) });
  };

  function encodingKey(mode) {
    return mode === 'confidence' ? 'confidence' : (mode === 'completeness' ? 'completeness' : 'class');
  }

  /* ========================================================================
   * Legend
   * ===================================================================== */

  function legendRow(swatchKey, fill, label, count) {
    var sw = el('span.maplegend__swatch', { 'aria-hidden': 'true' });
    // The unknown swatch is hatched by the stylesheet, so it must NOT be given
    // an inline background — the texture is what carries it in greyscale (§5).
    if (swatchKey === 'unknown') sw.setAttribute('data-class', 'unknown');
    else if (fill) sw.style.background = fill;
    return el('div.maplegend__row', {}, [
      sw,
      el('span', { text: label }),
      el('span.maplegend__count', { text: F.int(count) })
    ]);
  }

  /**
   * The legend carries its own denominator. A ramp with no counts under it is a
   * colour key; a ramp with counts is a statement about coverage, which is what
   * §36 asks every number on screen to be.
   */
  M.renderLegend = function (state, rows) {
    var box = Q.$('#maplegend');
    if (!box) return;

    var mode = ENCODINGS.indexOf(state.markerEncoding) >= 0 ? state.markerEncoding : 'officeClass';
    if (legendCollapsed === null) {
      legendCollapsed = (state.bp === 's' || state.bp === 'xs' || state.bp === 'xxs' || state.bp === 'm');
    }

    var counts = {}, unknownCount = 0, order, labelOf, tokenOf, coverageField;

    if (mode === 'confidence') {
      order = ['High', 'Medium', 'Low'];
      tokenOf = function (k) { return token(CONF_TOKEN[k], '#8A8178'); };
      labelOf = function (k) { return t('value.confidence.' + k.toLowerCase()); };
      coverageField = t('map.legend.confidence');
      rows.forEach(function (r) {
        var c = GEO.data.recordConfidence(r);
        if (c === 'Unknown') unknownCount++; else counts[c] = (counts[c] || 0) + 1;
      });
    } else if (mode === 'completeness') {
      order = ['good', 'partial', 'minimal'];
      tokenOf = function (k) { return token(CMPL_TOKEN[k], '#8A8178'); };
      labelOf = function (k) { return t('value.completeness.' + k); };
      coverageField = t('map.legend.completeness');
      rows.forEach(function (r) {
        var b = completenessOf(r).band;
        if (b === 'none') unknownCount++; else counts[b] = (counts[b] || 0) + 1;
      });
    } else {
      order = S.enums.officeClass;
      tokenOf = function (k) { return token(CLASS_TOKEN[k], '#8A8178'); };
      labelOf = function (k) { return t('value.class.' + CLASS_KEY[k]); };
      coverageField = F.lower(S.label('officeClass'));
      rows.forEach(function (r) {
        if (U.isKnown(r.officeClass)) counts[r.officeClass] = (counts[r.officeClass] || 0) + 1;
        else unknownCount++;
      });
    }

    var known = rows.length - unknownCount;
    var demoCount = rows.filter(function (r) { return r.recordType === 'DEMO'; }).length;
    var dupeCount = rows.filter(isDuplicate).length;

    var sig = [mode, rows.length, unknownCount, demoCount, dupeCount,
               legendCollapsed ? 1 : 0,
               order.map(function (k) { return counts[k] || 0; }).join(',')].join('|');
    if (sig === legendSig && box.firstChild) return;
    legendSig = sig;

    var body = el('div.maplegend__body', {}, order.map(function (k) {
      return legendRow(k, tokenOf(k), labelOf(k), counts[k] || 0);
    }));

    // Never dropped: hiding the unknown bucket would misrepresent coverage (§5).
    body.appendChild(legendRow('unknown', null,
      mode === 'completeness' ? t('value.completeness.none') : t('map.legend.unknown'),
      unknownCount));

    // The glyph rows explain the two marks that are NOT part of the ramp. Their
    // swatches are drawn inline rather than reusing `.pin--demo` / `.pin--dupe`,
    // whose pseudo-elements are positioned against a `.pin` that does not exist
    // here — a legend key that quietly renders nothing is worse than no key.
    if (demoCount) {
      body.appendChild(el('div.maplegend__row', {}, [
        el('span.maplegend__swatch', { 'aria-hidden': 'true',
          style: 'background:transparent;box-shadow:none;border:2px dashed ' +
                 token('--line-strong', '#CFC9BF') }),
        el('span', { text: t('map.legend.demo') }),
        el('span.maplegend__count', { text: F.int(demoCount) })
      ]));
    }
    if (dupeCount) {
      body.appendChild(el('div.maplegend__row', {}, [
        el('span.maplegend__swatch', { 'aria-hidden': 'true', text: '✱',
          style: 'display:flex;align-items:center;justify-content:center;' +
                 'background:' + token('--surface', '#FFFFFF') + ';color:' + INK +
                 ';font-size:9px;box-shadow:0 0 0 1px ' + token('--line-strong', '#CFC9BF') }),
        el('span', { text: t('map.legend.duplicate') }),
        el('span.maplegend__count', { text: F.int(dupeCount) })
      ]));
    }

    body.appendChild(el('p.coverage', { text: GEO.i18n.coverageLine(known, rows.length, coverageField) }));
    body.appendChild(el('p.coverage', {
      text: mode === 'confidence' ? t('map.legend.confidence.note')
          : mode === 'completeness' ? t('map.legend.completeness.note')
          : t('map.legend.unknown.note')
    }));

    var head = el('button.maplegend__hd', {
      type: 'button',
      'aria-expanded': legendCollapsed ? 'false' : 'true',
      title: legendCollapsed ? t('map.legend.expand') : t('map.legend.collapse'),
      onclick: function () {
        legendCollapsed = !legendCollapsed;
        legendSig = null;
        M.renderLegend(GEO.state.get(), rows);
      }
    }, [
      el('span', { text: t('map.legend.title') + ' — ' + t('map.legend.' + encodingKey(mode)) }),
      el('span', { 'aria-hidden': 'true', text: legendCollapsed ? '▸' : '▾' })
    ]);

    box.dataset.collapsed = legendCollapsed ? 'true' : 'false';
    Q.fill(box, [head, body]);
  };

  /* ========================================================================
   * Districts (D1 — geometry is authoritative, so the polygon is the truth)
   * ===================================================================== */

  function districtStyle(on, empty) {
    var red = token('--case-red', '#B01F22');
    return {
      renderer: canvasRenderer,
      // Canvas ignores className, but it is set anyway so an SVG fallback, a
      // print stylesheet and the DOM inspector all still read correctly.
      className: 'geo-district' + (on ? ' geo-district--on' : '') + (empty ? ' geo-district--empty' : ''),
      color: on ? red : token('--line-strong', '#CFC9BF'),
      weight: on ? 2 : 1,
      opacity: 1,
      fill: true,
      fillColor: on ? red : token('--ink', '#1A1714'),
      fillOpacity: on ? 0.07 : 0.04,
      // A dashed edge says "zero records here, and we know it" — a recorded
      // zero, not a gap in the data (Yangihayot and Bektemir, per the oracle).
      dashArray: empty ? '4 3' : null,
      interactive: true
    };
  }

  /**
   * @param districts  [{ key, name, geometry }] — `GEO.data.districts()`, which
   *                   is `window.GEO_DISTRICTS` matched onto the seed's district
   *                   list at load.
   * @param rows       optional; the result set the per-district counts describe.
   *                   Defaults to the current selection rather than to nothing,
   *                   because a zero count is drawn as a dashed "recorded zero"
   *                   and inventing twelve of those would be a lie.
   */
  M.renderDistricts = function (districts, state, rows) {
    if (!map) return;
    var visible = !state.layerVisibility || state.layerVisibility.districts !== false;
    var labels = !!(state.layerVisibility && state.layerVisibility.labels);
    var list = districts || GEO.data.districts();
    var selected = (state.filters && state.filters.districts) || [];
    if (!rows) rows = GEO.boot && GEO.boot.visible ? GEO.boot.visible(state) : [];

    var counts = {};
    rows.forEach(function (r) {
      if (U.isKnown(r.districtKey)) counts[r.districtKey] = (counts[r.districtKey] || 0) + 1;
    });

    var sig = [visible ? 1 : 0, labels ? 1 : 0, selected.slice().sort().join(','),
               list.map(function (d) { return d.key + ':' + (counts[d.key] || 0); }).join('|')].join('#');
    if (sig === districtSig) return;
    districtSig = sig;

    Object.keys(districtLayers).forEach(function (k) {
      map.removeLayer(districtLayers[k]);
      delete districtLayers[k];
    });
    if (!visible) return;

    list.forEach(function (d) {
      if (!d.geometry) return;                       // no invented boundaries (§2.2)
      var count = counts[d.key] || 0;
      var on = selected.indexOf(d.key) >= 0;
      var base = districtStyle(on, count === 0);

      var gj = L.geoJSON(d.geometry, { style: base, renderer: canvasRenderer });

      var label = el('span', {}, [
        el('strong', { text: d.name }),
        document.createTextNode(' · ' + F.int(count))
      ]);
      gj.bindTooltip(label, {
        permanent: labels, direction: 'center', className: 'geo-dlabel',
        opacity: 1, sticky: !labels
      });

      gj.on('mouseover', function () {
        gj.setStyle({ fillOpacity: on ? 0.10 : 0.09 });
      });
      gj.on('mouseout', function () {
        gj.setStyle({ fillOpacity: base.fillOpacity });
      });
      // M-04: a polygon click is the same filter as the L-05 checkbox, written
      // to the same place — which is what keeps the two from disagreeing.
      gj.on('click', function (e) {
        if (e && e.originalEvent) L.DomEvent.stop(e.originalEvent);
        toggleDistrict(d.key);
      });

      gj.addTo(map);
      if (gj.bringToBack) gj.bringToBack();
      districtLayers[d.key] = gj;
    });
  };

  function toggleDistrict(key) {
    var s = GEO.state.get();
    var next = (s.filters.districts || []).slice();
    var i = next.indexOf(key);
    if (i >= 0) next.splice(i, 1); else next.push(key);
    GEO.state.set({ filters: { districts: next } },
      { source: 'user', action: 'map:districtFilter',
        summary: (i >= 0 ? 'Removed ' : 'Added ') + GEO.data.districtName(key) + ' district filter' });
  }

  /* ========================================================================
   * Radius rings (§16)
   * ===================================================================== */

  /**
   * @param analysis  `GEO.geo.locationAnalysis(...)`, or null to clear.
   *
   * Rendered with the SVG renderer rather than the map's canvas default, so the
   * `.geo-radius` classes — including the 200 ms sweep, which reduced motion
   * collapses to a static circle — actually apply.
   */
  M.renderRadius = function (analysis) {
    if (!map || !radiusGroup) return;
    radiusGroup.clearLayers();
    if (!analysis || !analysis.subject) return;

    var subj = analysis.subject;
    if (!U.isKnown(subj.lat) || !U.isKnown(subj.lng)) return;
    var origin = [subj.lat, subj.lng];
    var emphasis = analysis.competitiveBandKm;

    // Largest first so the small rings stay clickable-through and on top.
    analysis.bands.slice().sort(function (a, b) { return b.km - a.km; }).forEach(function (band) {
      var on = band.km === emphasis;
      L.circle(origin, {
        renderer: svgRenderer,
        radius: band.km * 1000,
        className: 'geo-radius' + (on ? ' geo-radius--on' : '') + (animates() ? ' geo-radius--draw' : ''),
        color: token('--case-red', '#B01F22'),
        weight: on ? 2 : 1.5,
        opacity: on ? 1 : 0.45,
        fillColor: token('--case-red', '#B01F22'),
        fillOpacity: on ? 0.06 : 0.03,
        interactive: false
      }).addTo(radiusGroup);

      // Each ring is labelled with its band AND its count: a circle with no
      // number on it is decoration, and the three counts have to be readable
      // together because the bands are cumulative (§7 of the build contract).
      var dLat = (band.km * 1000) / 111320;
      var chip = el('span.geo-radius-label', {
        style: 'position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);display:inline-block',
        text: t('map.radius.label', { km: F.num(band.km, 0), n: F.int(band.count) })
      });
      L.marker([origin[0] + dLat, origin[1]], {
        interactive: false,
        keyboard: false,
        icon: L.divIcon({ className: 'geo-marker', iconSize: [96, 20], iconAnchor: [48, 10], html: chip })
      }).addTo(radiusGroup);
    });
  };

  /* ========================================================================
   * AI layers (§57) — a saved result set, not a live rule
   * ===================================================================== */

  /**
   * Member markers are handled in `renderRecords` (they wear `.pin--layer`, and
   * non-members are muted rather than deleted). This function owns everything
   * ELSE a layer may put on the map — today, the ring a layer built from a
   * radius search carries with it. Removing a layer removes its group whole,
   * which is the §9 "removing a layer removes its map artefacts, circles
   * included" guarantee expressed as structure rather than as a checklist.
   */
  M.renderAiLayers = function (layers) {
    if (!map) return;
    layers = layers || [];

    var live = {};
    layers.forEach(function (l) { if (l.visible) live[l.id] = l; });

    Object.keys(layerGroups).forEach(function (id) {
      if (live[id]) return;
      map.removeLayer(layerGroups[id]);
      delete layerGroups[id];
    });

    Object.keys(live).forEach(function (id) {
      if (layerGroups[id]) return;
      var layer = live[id];
      var group = L.layerGroup();
      var cm = layer.criteriaMachine || {};
      var origin = cm.originId ? GEO.data.get(cm.originId) : null;
      var km = Number(cm.radiusKm || cm.withinKm);

      if (origin && U.isKnown(origin.lat) && U.isKnown(origin.lng) && km > 0) {
        L.circle([origin.lat, origin.lng], {
          renderer: svgRenderer,
          radius: km * 1000,
          className: 'geo-radius' + (animates() ? ' geo-radius--draw' : ''),
          color: token('--case-red', '#B01F22'),
          weight: 1.5, opacity: 0.45,
          fillColor: token('--case-red', '#B01F22'), fillOpacity: 0.03,
          interactive: false
        }).addTo(group);
      }

      group.addTo(map);
      layerGroups[id] = group;
    });
  };

  /* ========================================================================
   * Context layers (D5) — present, empty, and honest about why
   * ===================================================================== */

  /* §10 allows context layers only if they can be done reliably, and §2.2
     forbids inventing coordinates. There is no metro dataset in this repo and
     the Overpass API is blocked by network policy, so the slot ships EMPTY and
     DISABLED with its reason on screen. Drop a GeoJSON into
     `GEO_SEED.contextLayers` and the control enables itself — no code change. */
  var CONTEXT_KINDS = [
    { id: 'metro', labelKey: 'map.layers.metro' },
    { id: 'roads', labelKey: 'map.layers.roads' },
    { id: 'landmarks', labelKey: 'map.layers.landmarks' }
  ];

  function contextSource(kind) {
    var seed = w.GEO_SEED;
    var bag = seed && seed.contextLayers;
    var gj = bag && bag[kind];
    return (gj && gj.features && gj.features.length) ? gj : null;
  }

  function contextAvailable() {
    return CONTEXT_KINDS.some(function (k) { return !!contextSource(k.id); });
  }

  function renderContext(state) {
    if (!contextGroup) return;
    contextGroup.clearLayers();
    if (!state.layerVisibility || !state.layerVisibility.context) return;

    CONTEXT_KINDS.forEach(function (kind) {
      var gj = contextSource(kind.id);
      if (!gj) return;
      L.geoJSON(gj, {
        renderer: canvasRenderer,
        style: { color: token('--text-3', '#6E665C'), weight: 1.5, opacity: 0.7, fill: false },
        // T2 again: a GeoJSON point would otherwise get L.Icon.Default and 404.
        pointToLayer: function (feature, latlng) {
          return L.marker(latlng, {
            interactive: false, keyboard: false,
            icon: L.divIcon({
              className: 'geo-marker', iconSize: [10, 10], iconAnchor: [5, 5],
              html: el('span', {
                'aria-hidden': 'true',
                style: 'display:block;width:10px;height:10px;border-radius:50%;background:' +
                       token('--text-3', '#6E665C') + ';box-shadow:0 0 0 2px ' +
                       token('--marker-ring', '#FFFFFF')
              })
            })
          });
        }
      }).addTo(contextGroup);
    });
  }

  /* ========================================================================
   * Layer control — ours, because L.Control.Layers loads layers.png (T2)
   * ===================================================================== */

  function checkbox(label, opts) {
    var input = el('input', { type: 'checkbox' });
    input.checked = !!opts.checked;
    input.disabled = !!opts.disabled;
    if (opts.onchange) {
      input.addEventListener('change', function () { opts.onchange(input.checked); });
    }
    var text = el('span.check__text', { text: label });
    if (opts.count !== undefined && opts.count !== null) {
      text.appendChild(el('span.check__count', { text: F.int(opts.count) }));
    }
    var row = el('label.check', {}, [input, text]);
    if (!opts.disabled || !opts.reason) return row;
    // §29: a disabled control states WHY, as real text in the flow — a tooltip
    // is not an accessible reason.
    return el('div', {}, [row, el('span.reason', { text: opts.reason })]);
  }

  /**
   * Returns a wired layer-control node. It is mounted into `#maplayers-panel`
   * here; any other panel that wants the same control calls this and mounts the
   * result into its own DOM, so there is one implementation, not two.
   */
  M.layerControl = function (state, rows) {
    var vis = state.layerVisibility || {};
    var hasRadius = !!state.radius;
    var ctxOn = contextAvailable();

    function setVis(key, on, label) {
      var patch = {};
      patch[key] = on;
      GEO.state.set({ layerVisibility: patch },
        { source: 'user', action: 'map:layer:' + key,
          summary: (on ? 'Shown: ' : 'Hidden: ') + label });
    }

    var base = el('div.fgroup', {}, [
      el('h3.fgroup__hd', { text: t('map.layers.base') }),
      el('div.fgroup__body', {}, [
        checkbox(t('map.layers.properties', { n: F.int(rows.length) }), {
          checked: vis.properties !== false,
          onchange: function (on) { setVis('properties', on, t('map.layers.properties', { n: F.int(rows.length) })); }
        }),
        checkbox(t('map.layers.districts'), {
          checked: vis.districts !== false,
          onchange: function (on) { setVis('districts', on, t('map.layers.districts')); }
        }),
        checkbox(t('map.layers.labels'), {
          checked: !!vis.labels,
          onchange: function (on) { setVis('labels', on, t('map.layers.labels')); }
        }),
        checkbox(t('map.layers.radius'), {
          checked: hasRadius && vis.radius !== false,
          disabled: !hasRadius,
          reason: hasRadius ? null : t('map.layers.radius.disabled'),
          onchange: function (on) { setVis('radius', on, t('map.layers.radius')); }
        })
      ])
    ]);

    var context = el('div.fgroup' + (ctxOn ? '' : '.fgroup--disabled'), {}, [
      el('h3.fgroup__hd', { text: t('map.layers.context') }),
      el('div.fgroup__body', {}, CONTEXT_KINDS.map(function (kind) {
        var have = !!contextSource(kind.id);
        return checkbox(t(kind.labelKey), {
          checked: have && !!vis.context,
          disabled: !have,
          reason: have ? null : t('map.layers.context.reason'),
          onchange: function (on) { setVis('context', on, t(kind.labelKey)); }
        });
      })),
      el('p.fgroup__note', { text: t('map.layers.context.note') })
    ]);

    var analysis = el('div.fgroup', {}, [
      el('h3.fgroup__hd', { text: t('map.layers.analysis') }),
      el('div.fgroup__body', {}, [
        el('p.fgroup__note', { text: t('map.layer.note') }),
        el('button.btn.btn--quiet.btn--sm', {
          type: 'button',
          text: t('map.layers.analysis.open'),
          onclick: function () {
            GEO.state.set({ rightRail: 'open', rightTab: 'layers' },
              { source: 'user', action: 'map:openLayersTab' });
          }
        })
      ])
    ]);

    return el('div', {}, [base, context, analysis]);
  };

  function renderLayerPanel(state, rows) {
    var box = Q.$('#maplayers-panel');
    if (!box || box.hidden) return;
    var sig = [rows.length, JSON.stringify(state.layerVisibility || {}),
               state.radius ? 1 : 0, contextAvailable() ? 1 : 0].join('|');
    if (sig === layerPanelSig && box.firstChild) return;
    layerPanelSig = sig;

    // Ticking a box re-renders the panel from the new state, which destroys the
    // node the keyboard was standing on. Position is restored by index so the
    // control can be walked with Tab and Space without being thrown out of it.
    var focusables = Q.$$('input, button', box);
    var at = focusables.indexOf(document.activeElement);

    Q.fill(box, [M.layerControl(state, rows)]);

    if (at >= 0) {
      var next = Q.$$('input, button', box);
      if (next[at]) next[at].focus();
    }
  }

  function toggleLayerPanel(force) {
    var box = Q.$('#maplayers-panel');
    var btn = Q.$('#map-layers');
    if (!box) return;
    var open = force === undefined ? box.hidden : force;
    box.hidden = !open;
    if (btn) btn.setAttribute('aria-expanded', open ? 'true' : 'false');
    if (open) {
      layerPanelSig = null;
      var s = GEO.state.get();
      renderLayerPanel(s, GEO.boot ? GEO.boot.visible(s) : []);
      var first = box.querySelector('input, button');
      if (first) first.focus();
    }
  }

  /* ========================================================================
   * Viewport commands
   * ===================================================================== */

  M.fit = function (rows) {
    if (!map) return;
    var b = GEO.geo.bounds(rows || []);
    if (!b) return;                            /* M-06 disables the button instead */
    map.fitBounds(b, viewOpts({ padding: [FIT_PADDING, FIT_PADDING], maxZoom: 16 }));
  };

  /** M-07: back to the whole city. Filters and selection are deliberately left
   *  alone — "reset view" is a camera command, not an analysis command. */
  M.reset = function () {
    if (!map) return;
    var s = GEO.state.get();
    var all = GEO.boot ? GEO.boot.scope(s)
                       : GEO.data.workingSet({ demoMode: s.demoMode });
    var b = GEO.geo.bounds(all);
    if (b) map.fitBounds(b, viewOpts({ padding: [FIT_PADDING, FIT_PADDING] }));
    else map.setView(TASHKENT, 12, viewOpts());
  };

  M.zoomTo = function (record, zoom) {
    if (!map || !record) return;
    if (!U.isKnown(record.lat) || !U.isKnown(record.lng)) {
      GEO.log.warn('map: cannot zoom to a record without coordinates', record.id);
      return;
    }
    map.setView([record.lat, record.lng],
                Math.min(MAX_ZOOM, zoom || 16), viewOpts());
  };

  /* ------------------------------------------------------------ fullscreen */

  function fullscreenElement() {
    return document.fullscreenElement || document.webkitFullscreenElement || null;
  }

  /**
   * M-08. The Fullscreen API is blocked in some browsers on `file://`, and a
   * button that does nothing is worse than no button (§29) — so the fallback is
   * a real full-viewport mode, not an apology.
   */
  M.toggleFullscreen = function () {
    var wrap = Q.$('.mapwrap');
    if (!wrap) return;

    if (fullscreenElement() || wrap.dataset.full === 'true') {
      if (fullscreenElement()) {
        (document.exitFullscreen || document.webkitExitFullscreen || function () {}).call(document);
      }
      exitCssFullscreen(wrap);
      return;
    }

    var req = wrap.requestFullscreen || wrap.webkitRequestFullscreen;
    var started = false;
    if (req) {
      try {
        var p = req.call(wrap);
        started = true;
        if (p && p.catch) p.catch(function () { enterCssFullscreen(wrap); });
      } catch (e) { started = false; }
    }
    if (!started) enterCssFullscreen(wrap);
    applyFullscreenRails(true);
  };

  /* `inset` is not understood by the old Safari this must open in, so the four
     sides are set individually. The z-index is a token, never a bare integer
     (01-tokens.css owns the ladder). */
  var FULL_SIDES = { position: 'fixed', top: '0px', right: '0px', bottom: '0px', left: '0px' };

  function enterCssFullscreen(wrap) {
    wrap.dataset.full = 'true';
    Object.keys(FULL_SIDES).forEach(function (k) { wrap.style.setProperty(k, FULL_SIDES[k]); });
    wrap.style.setProperty('z-index', 'var(--z-modal)');
    applyFullscreenRails(true);
    M.invalidate();
  }

  function exitCssFullscreen(wrap) {
    delete wrap.dataset.full;
    Object.keys(FULL_SIDES).forEach(function (k) { wrap.style.removeProperty(k); });
    wrap.style.removeProperty('z-index');
    applyFullscreenRails(false);
    M.invalidate();
  }

  /** P9: fullscreen closes the right rail and collapses the left one; leaving it
   *  restores exactly what was there before, which is why the previous pair is
   *  remembered rather than guessed. */
  function applyFullscreenRails(on) {
    var s = GEO.state.get();
    if (on) {
      if (railsBeforeFullscreen) return;
      railsBeforeFullscreen = { leftRail: s.leftRail, rightRail: s.rightRail };
      GEO.state.set({ leftRail: 'collapsed', rightRail: 'closed' },
        { source: 'user', action: 'map:fullscreen', summary: 'Full screen map' });
    } else {
      if (!railsBeforeFullscreen) return;
      var restore = railsBeforeFullscreen;
      railsBeforeFullscreen = null;
      GEO.state.set(restore, { source: 'user', action: 'map:fullscreen:exit',
                               summary: 'Left full screen' });
    }
  }

  function onFullscreenChange() {
    var wrap = Q.$('.mapwrap');
    if (!wrap) return;
    if (!fullscreenElement() && wrap.dataset.full !== 'true') applyFullscreenRails(false);
    syncFullscreenButton();
    M.invalidate();
  }

  function syncFullscreenButton() {
    var btn = Q.$('#map-full');
    var wrap = Q.$('.mapwrap');
    if (!btn || !wrap) return;
    var on = !!fullscreenElement() || wrap.dataset.full === 'true';
    btn.setAttribute('aria-pressed', on ? 'true' : 'false');
    btn.setAttribute('aria-label', on ? t('map.fullscreen.exit') : t('map.fullscreen'));
    btn.setAttribute('title', on ? t('map.fullscreen.exit') : t('map.fullscreen'));
  }

  /* ------------------------------------------------------------ map chrome */

  function syncZoomButtons() {
    if (!map) return;
    var z = map.getZoom();
    var zin = Q.$('#map-zoom-in'), zout = Q.$('#map-zoom-out');
    if (zin) {
      zin.disabled = z >= MAX_ZOOM;
      zin.setAttribute('title', z >= MAX_ZOOM ? t('map.zoomIn.disabled') : t('map.zoomIn'));
    }
    if (zout) {
      zout.disabled = z <= MIN_ZOOM;
      zout.setAttribute('title', z <= MIN_ZOOM ? t('map.zoomOut.disabled') : t('map.zoomOut'));
    }
  }

  function wireChrome() {
    if (chromeWired) return;
    chromeWired = true;

    var zin = Q.$('#map-zoom-in'), zout = Q.$('#map-zoom-out');
    if (zin) zin.addEventListener('click', function () { map.zoomIn(1, viewOpts()); });
    if (zout) zout.addEventListener('click', function () { map.zoomOut(1, viewOpts()); });

    var fit = Q.$('#map-fit');
    if (fit) {
      fit.addEventListener('click', function () {
        var s = GEO.state.get();
        M.fit(GEO.boot ? GEO.boot.visible(s) : []);
      });
    }

    var reset = Q.$('#map-reset');
    if (reset) reset.addEventListener('click', function () { M.reset(); });

    var full = Q.$('#map-full');
    if (full) full.addEventListener('click', function () { M.toggleFullscreen(); });

    var layers = Q.$('#map-layers');
    if (layers) layers.addEventListener('click', function () { toggleLayerPanel(); });

    // The layer popover closes like any popover: Escape, or a click outside it.
    document.addEventListener('keydown', function (e) {
      if (e.key !== 'Escape') return;
      var box = Q.$('#maplayers-panel');
      if (box && !box.hidden) { toggleLayerPanel(false); if (layers) layers.focus(); }
    });
    document.addEventListener('click', function (e) {
      var box = Q.$('#maplayers-panel');
      if (!box || box.hidden) return;
      if (box.contains(e.target) || (layers && layers.contains(e.target))) return;
      toggleLayerPanel(false);
    });

    syncZoomButtons();
    syncFullscreenButton();
  }

  function syncChrome(state, rows) {
    var fit = Q.$('#map-fit');
    if (fit) {
      fit.disabled = !rows.length;
      fit.setAttribute('title', rows.length ? t('map.fit') : t('map.fit.disabled'));
    }
    syncZoomButtons();
    syncFullscreenButton();
  }

  /* ========================================================================
   * The subscription — everything above is driven from here
   * ===================================================================== */

  /**
   * The map view is part of the one state object, so an external writer can move
   * the camera. It is applied only when the PATCH asked for it: the live view is
   * also written back on `moveend`, so reacting to any difference would let a
   * stale snapshot (a click landing inside the write-back's debounce window)
   * snap the map back under the reader's hand.
   */
  function applyStateView(state, patch, meta) {
    if (!patch || !patch.map) return;
    if (meta && meta.source === 'system') return;          // that is our own write-back
    if (!patch.map.centre && patch.map.zoom === undefined) return;
    var centre = patch.map.centre || state.map.centre;
    var zoom = patch.map.zoom === undefined ? map.getZoom() : patch.map.zoom;
    map.setView(centre, zoom, viewOpts());
  }

  function radiusAnalysis(state, scope) {
    if (!state.radius) return null;
    if (state.layerVisibility && state.layerVisibility.radius === false) return null;
    var subj = GEO.data.get(state.radius.id);
    if (!subj) return null;
    try {
      // Computed over the SCOPE, not the filtered rows: "74 within 3 km" is a
      // statement about the market, and a filter must not quietly shrink it.
      return GEO.geo.locationAnalysis(subj, scope, { bandsKm: state.radius.km });
    } catch (e) {
      GEO.log.error('map: location analysis failed', e);
      return null;
    }
  }

  function render(state, rows, scope, patch, meta) {
    if (!map) return;

    applyStateView(state, patch, meta);

    M.renderDistricts(GEO.data.districts(), state, rows);
    M.renderRecords(rows, state);
    M.renderRadius(radiusAnalysis(state, scope || rows));
    M.renderAiLayers(state.aiLayers);
    renderContext(state);
    M.renderLegend(state, rows);
    renderNotice(state, rows);
    renderLayerPanel(state, rows);
    syncChrome(state, rows);

    // `fitToken` is a request, not a value: bumping it asks for a fit exactly
    // once, so a fit cannot be re-applied on every unrelated state change.
    if (lastFitToken === null) { lastFitToken = state.map.fitToken; M.fit(rows); }
    else if (state.map.fitToken !== lastFitToken) {
      lastFitToken = state.map.fitToken;
      M.fit(rows);
    }
  }

  M.render = render;

  function register() {
    if (registered) return;
    if (GEO.boot && GEO.boot.registerPanel) {
      registered = true;
      GEO.boot.registerPanel(render);
      return;
    }
    // Standalone fallback so the map still follows state if it is initialised
    // outside the normal boot sequence (a test harness, a future embed).
    registered = true;
    GEO.state.subscribe(function (state, patch, meta) {
      var rows = GEO.data.workingSet({ demoMode: state.demoMode,
                                       excludeSuspectedNonBc: state.excludeSuspectedNonBc });
      var filtered = GEO.filters ? GEO.filters.apply(rows, state.filters) : rows;
      render(state, filtered, rows, patch, meta);
    });
  }
}(window));
