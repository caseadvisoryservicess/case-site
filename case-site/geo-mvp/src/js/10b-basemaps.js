/* ===========================================================================
 * 10b-basemaps — the basemap registry (§10)
 *
 * One table describing every map background the product can draw, and the
 * single place that decides which of them may actually be requested.
 *
 * WHY A PROVIDER NEEDS MORE THAN A URL
 *   A tile server is not a neutral resource. Each one carries an attribution
 *   that must be displayed, a zoom range it actually serves, and a licence that
 *   decides whether this firm may point a commercial product at it. Shipping a
 *   URL without the last two is how a prototype quietly becomes a licence
 *   breach in a client demo, so every entry here declares all four and the map
 *   module is not allowed to construct a layer from anything else.
 *
 * THE THREE STATES AN ENTRY CAN BE IN
 *   'open'      — a public tile service whose terms permit this use with
 *                 attribution. Shipped active.
 *   'licensed'  — a real service this firm may well be entitled to use, but
 *                 only under its own contract or API key. Shipped VISIBLE and
 *                 DISABLED, with the reason on screen (§29: a control that
 *                 cannot act says why) and a field to paste the licensed
 *                 endpoint into. The moment a key exists it works.
 *   'none'      — the graticule. Not a provider; the honest fallback when the
 *                 network is absent, and selectable on purpose so a printed
 *                 exhibit can leave the basemap out entirely.
 *
 * WHY GOOGLE, YANDEX AND 2GIS ARE 'licensed' AND NOT SHIPPED ACTIVE
 *   All three publish tile endpoints that a browser can reach, and all three
 *   forbid reaching them that way. Google Maps tiles may be used only through
 *   the Maps JavaScript API with a billing-enabled key; Yandex likewise through
 *   its own API; 2GIS requires a licence agreement for commercial use. The
 *   unofficial XYZ endpoints that circulate are not a grey area — they are the
 *   same terms, broken. A prototype that ships them would hand the firm a
 *   licence problem inside a deliverable whose entire argument is that its
 *   sources are documented.
 *
 *   So they are here, named, with the exact thing that unlocks each one. That
 *   is the difference between "we cannot" and "here is what it needs".
 *
 * YANDEX HAS A SECOND, TECHNICAL PROBLEM
 *   Yandex's own basemap is drawn in EPSG:3395 (elliptical Mercator), while
 *   Leaflet and every other provider here use EPSG:3857 (spherical). Dropping
 *   Yandex tiles into this map without reprojecting shifts them against the
 *   markers — by hundreds of metres at Tashkent's latitude, growing with it.
 *   The entry records that, because a basemap that is silently 300 m out is
 *   worse than no basemap: every marker looks like a data error.
 * ========================================================================= */
(function (w) {
  'use strict';

  var GEO = w.GEO, U = GEO.util;
  var B = GEO.basemaps = {};

  /* The key each 'licensed' provider is unlocked with, kept out of the table so
     the table stays readable. Stored per-browser only — see B.endpoint(). */
  var STORE_KEY = 'basemap.endpoints';

  /**
   * id           stable, stored in state and in an export header
   * labelKey     i18n key for the human name
   * access       'open' | 'licensed' | 'none'
   * url          XYZ template, or null for 'none' and for unlicensed entries
   * attribution  REQUIRED for every 'open' entry. Plain text; the map module
   *              wraps it. An entry without one does not ship.
   * attributionUrl  where the attribution points
   * maxZoom      the deepest zoom the service actually serves. Asking for more
   *              returns 404s, which this product reads as "offline".
   * dark         true if the tiles are dark, so marker rings can flip
   * needs        for 'licensed': the exact thing that unlocks it
   * caveatKey    an extra warning shown with the entry (Yandex's projection)
   */
  B.PROVIDERS = [
    {
      id: 'osm',
      labelKey: 'basemap.osm',
      access: 'open',
      url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
      attributionKey: 'basemap.osm.attribution',
      attributionUrl: 'https://www.openstreetmap.org/copyright',
      maxZoom: 19,
      dark: false
    },
    {
      id: 'osm-hot',
      labelKey: 'basemap.osmHot',
      access: 'open',
      url: 'https://tile-{s}.openstreetmap.fr/hot/{z}/{x}/{y}.png',
      subdomains: 'abc',
      attributionKey: 'basemap.osmHot.attribution',
      attributionUrl: 'https://www.openstreetmap.org/copyright',
      maxZoom: 19,
      dark: false
    },
    {
      /* The quietest basemap here, and the best one to read data on top of —
         which is why it is the default for the analytical views. */
      id: 'carto-light',
      labelKey: 'basemap.cartoLight',
      access: 'open',
      url: 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png',
      subdomains: 'abcd',
      attributionKey: 'basemap.carto.attribution',
      attributionUrl: 'https://carto.com/attributions',
      maxZoom: 20,
      dark: false
    },
    {
      id: 'carto-dark',
      labelKey: 'basemap.cartoDark',
      access: 'open',
      url: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
      subdomains: 'abcd',
      attributionKey: 'basemap.carto.attribution',
      attributionUrl: 'https://carto.com/attributions',
      maxZoom: 20,
      dark: true
    },
    {
      id: 'esri-imagery',
      labelKey: 'basemap.esriImagery',
      access: 'open',
      url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
      attributionKey: 'basemap.esri.attribution',
      attributionUrl: 'https://www.esri.com/en-us/legal/terms/full-master-agreement',
      maxZoom: 19,
      dark: true
    },
    {
      id: 'opentopo',
      labelKey: 'basemap.openTopo',
      access: 'open',
      url: 'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png',
      subdomains: 'abc',
      attributionKey: 'basemap.openTopo.attribution',
      attributionUrl: 'https://opentopomap.org/about',
      maxZoom: 17,
      dark: false
    },

    /* ---------------------------------------------------- licensed entries */
    {
      id: '2gis',
      labelKey: 'basemap.2gis',
      access: 'licensed',
      url: null,
      needsKey: 'basemap.2gis.needs',
      maxZoom: 18,
      dark: false
    },
    {
      id: 'google',
      labelKey: 'basemap.google',
      access: 'licensed',
      url: null,
      needsKey: 'basemap.google.needs',
      maxZoom: 20,
      dark: false
    },
    {
      id: 'yandex',
      labelKey: 'basemap.yandex',
      access: 'licensed',
      url: null,
      needsKey: 'basemap.yandex.needs',
      caveatKey: 'basemap.yandex.projection',
      maxZoom: 19,
      dark: false
    },

    /* ------------------------------------------------------------ no tiles */
    {
      id: 'none',
      labelKey: 'basemap.none',
      access: 'none',
      url: null,
      maxZoom: 19,
      dark: false
    }
  ];

  B.DEFAULT_ID = 'carto-light';

  B.get = function (id) {
    var hit = B.PROVIDERS.filter(function (p) { return p.id === id; })[0];
    return hit || B.get(B.DEFAULT_ID);
  };

  /* ------------------------------------------------------------ endpoints */

  /**
   * The licensed endpoint someone has pasted in, if any.
   *
   * Per-browser, never in the dataset and never in an export: it is the firm's
   * credential, not a property of the data. Stored through GEO.storage, which
   * already falls back to memory when localStorage is unavailable.
   */
  function endpoints() {
    try {
      var raw = GEO.storage.get(STORE_KEY);
      return raw ? JSON.parse(raw) : {};
    } catch (e) { return {}; }
  }

  B.endpoint = function (id) {
    var e = endpoints()[id];
    return (typeof e === 'string' && e) ? e : null;
  };

  /**
   * Accepts only something that looks like an XYZ template, because a URL
   * without {x}/{y}/{z} silently produces a map of one repeated tile rather
   * than an error anybody would notice.
   */
  B.setEndpoint = function (id, url) {
    var map = endpoints();
    var clean = String(url || '').trim();
    if (!clean) {
      delete map[id];
    } else {
      if (!/\{x\}/.test(clean) || !/\{y\}/.test(clean) || !/\{z\}/.test(clean)) {
        return { ok: false, reasonKey: 'basemap.endpoint.invalid' };
      }
      if (!/^https:\/\//i.test(clean)) {
        return { ok: false, reasonKey: 'basemap.endpoint.insecure' };
      }
      map[id] = clean;
    }
    try { GEO.storage.set(STORE_KEY, JSON.stringify(map)); }
    catch (e) { return { ok: false, reasonKey: 'basemap.endpoint.storeFailed' }; }
    return { ok: true };
  };

  /** Everything the map module needs to build the layer, or null if it may not. */
  B.resolve = function (id) {
    var p = B.get(id);
    if (p.access === 'none') return null;
    var url = p.url || B.endpoint(p.id);
    if (!url) return null;
    return {
      id: p.id, url: url, maxZoom: p.maxZoom, dark: !!p.dark,
      subdomains: p.subdomains || 'abc',
      attributionKey: p.attributionKey || null,
      attributionUrl: p.attributionUrl || null
    };
  };

  /** True when the entry can be selected right now. Drives the disabled state. */
  B.usable = function (id) {
    var p = B.get(id);
    return p.access === 'none' || !!(p.url || B.endpoint(p.id));
  };

  B.isDark = function (id) {
    var p = B.get(id);
    return !!p.dark && B.usable(id);
  };

  /** The list the switcher draws, resolved against what is actually available. */
  B.options = function () {
    return B.PROVIDERS.map(function (p) {
      return {
        id: p.id,
        labelKey: p.labelKey,
        access: p.access,
        usable: B.usable(p.id),
        unlocked: p.access === 'licensed' && !!B.endpoint(p.id),
        needsKey: p.needsKey || null,
        caveatKey: p.caveatKey || null
      };
    });
  };

  /* Every 'open' entry must carry an attribution. This is asserted rather than
     trusted: an attribution that goes missing in a refactor is a licence breach
     that nothing else in the build would catch. */
  B.audit = function () {
    var bad = [];
    B.PROVIDERS.forEach(function (p) {
      if (p.access === 'open') {
        if (!p.url) bad.push(p.id + ': open with no url');
        if (!p.attributionKey) bad.push(p.id + ': open with no attribution');
        if (!p.attributionUrl) bad.push(p.id + ': open with no attribution url');
      }
      if (p.access === 'licensed' && p.url) bad.push(p.id + ': licensed but ships a url');
      if (!U.isKnown(p.maxZoom)) bad.push(p.id + ': no maxZoom');
    });
    return bad;
  };

}(window));
