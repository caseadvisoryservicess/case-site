/* CASE Geo - instant extraction from open.ngis.uz via the browser console.
   Use when you want files NOW without setting up Python.
   1. Open https://open.ngis.uz/  2. F12 -> Console  3. paste this whole file  4. run the calls at the bottom.
   Files land in your Downloads folder. Requests go to db.ngis.uz (same backend the portal itself uses). */

const NGIS = (() => {
  const BASE = 'https://db.ngis.uz/db/rest/services';
  const L = {
    MAHALLA:    ['UZKAD/MAHALLA_UZKAD_DB16', 0, 'FeatureServer'], // 4672 - MapServer is locked, FeatureServer is not
    TUMAN:      ['Hosted/tuman_border_map', 2, 'MapServer'],       // 206
    REGION:     ['Hosted/cadastral_regions_map', 0, 'MapServer'],  // 14
    NOTURAR:    ['UZKAD/NOTURAR_UZKAD_DB16', 0, 'MapServer'],      // 1,037,235
    TURAR:      ['UZKAD/TURAR_UZKAD_DB16', 0, 'MapServer'],        // 1,891,147
    AGR:        ['UZKAD/AGR_ONLY_UZKAD_DB16', 0, 'MapServer'],
    GENPLAN:    ['Hosted/TOSHKENT_GENPLAN_3857_MAP', 2, 'MapServer'],
    NALOG_ZONE: ['Hosted/TOSHKENT_NALOG_ZONE_MAP', 0, 'MapServer'],
    MKD_BUILD:  ['mkd_buildings', 2, 'MapServer'],
    KONTUR:     ['Hosted/KONTUR_QAYDNOMA_MAP', 0, 'MapServer'],
    WATER:      ['UZKAD/WATER_UZKAD_DB16', 0, 'MapServer'],
    AVTOYUL:    ['UZKAD/AVTOYUL_UZKAD_DB16', 0, 'MapServer'],
  };
  const url = k => `${BASE}/${L[k][0]}/${L[k][2]}/${L[k][1]}`;

  async function count(k, where = '1=1') {
    const r = await fetch(`${url(k)}/query?where=${encodeURIComponent(where)}&returnCountOnly=true&f=json`);
    return (await r.json()).count;
  }

  /** Paginated pull. geom=true -> GeoJSON features; geom=false -> attribute rows. */
  /* simplify = maxAllowableOffset in degrees (server-side generalisation).
     Measured on MAHALLA: none 98MB | 0.0001 (~11m) 7.9MB | 0.0002 6.1MB | 0.0005 (~55m) 3.3MB.
     Use ~0.0002 for web maps; omit for analysis / area calculations. */
  async function pull(k, { where = '1=1', fields = '*', geom = true, max = Infinity, simplify, precision, onProgress } = {}) {
    const out = []; let off = 0; const PAGE = 2000;
    for (;;) {
      const q = `${url(k)}/query?where=${encodeURIComponent(where)}&outFields=${encodeURIComponent(fields)}`
        + `&returnGeometry=${geom}&f=${geom ? 'geojson' : 'json'}&outSR=4326`
        + `&resultOffset=${off}&resultRecordCount=${PAGE}`
        + (simplify ? `&maxAllowableOffset=${simplify}` : '')
        + (precision ? `&geometryPrecision=${precision}` : '');
      const j = await (await fetch(q)).json();
      if (j.error) throw new Error(JSON.stringify(j.error));
      const f = j.features || [];
      out.push(...f);
      if (onProgress) onProgress(out.length);
      else console.log(`${k}: ${out.length}`);
      if (f.length < PAGE || out.length >= max) break;
      off += PAGE;
      await new Promise(r => setTimeout(r, 200)); // be polite
    }
    return out;
  }

  function save(name, text) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([text], { type: 'application/octet-stream' }));
    a.download = name; a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 5000);
  }

  async function geojson(k, opts = {}) {
    const f = await pull(k, { ...opts, geom: true });
    save(`${k.toLowerCase()}.geojson`,
      JSON.stringify({ type: 'FeatureCollection', crs: { type: 'name', properties: { name: 'EPSG:4326' } }, features: f }));
    return f.length;
  }

  async function csv(k, opts = {}) {
    const f = await pull(k, { ...opts, geom: false });
    const rows = f.map(x => x.attributes || x.properties);
    if (!rows.length) return 0;
    const cols = Object.keys(rows[0]);
    const esc = v => v == null ? '' : /[",\n]/.test(String(v)) ? '"' + String(v).replace(/"/g, '""') + '"' : String(v);
    save(`${k.toLowerCase()}.csv`, [cols.join(','), ...rows.map(r => cols.map(c => esc(r[c])).join(','))].join('\n'));
    return rows.length;
  }

  return { BASE, L, url, count, pull, geojson, csv, save };
})();

/* ---- run these one at a time (each finishes before you start the next) ----

await NGIS.geojson('MAHALLA', { simplify: 0.0002 });            // 4,672 mahalla boundaries, whole republic - ~6 MB, web-ready
await NGIS.geojson('MAHALLA');                                  // same at full precision - ~98 MB, for analysis only
await NGIS.csv('MAHALLA');                                      // same, attributes only - codes register
await NGIS.geojson('TUMAN');                                    // 206 districts
await NGIS.geojson('REGION');                                   // 14 regions
await NGIS.geojson('GENPLAN');                                  // Tashkent general plan, 7,569 zones
await NGIS.geojson('NALOG_ZONE');                               // Tashkent land-tax zones

// Commercial parcels - filter, do NOT pull 1M rows in the browser:
await NGIS.geojson('NOTURAR', { where: "soato_region='1726'" });                  // all Tashkent city
await NGIS.geojson('NOTURAR', { where: "soato_district='1726269'" });             // Mirzo Ulug'bek district
await NGIS.csv('NOTURAR', { where: "land_fund_type='006003001005'" });            // entrepreneurship industrial zones

// Check size before pulling:
await NGIS.count('NOTURAR', "soato_region='1726'");
*/
