/* Сборка Geo Platform MVP: подставляет в шаблон Leaflet, кластеризацию и данные.
   Шаблон: docs/standalone/src/geo_mvp.template.html (плейсхолдеры в комментариях).
   Данные: docs/standalone/data/geo_mvp_data.json (bc со схемой property/v1, districts GeoJSON).
   Выход: docs/standalone/CASE_Geo_Platform_MVP.html
   Запуск: node build_geo_mvp.js [data.json] [выход] [шаблон] */
'use strict';
const fs = require('fs');
const path = require('path');
function safe(s) { var LS = String.fromCharCode(0x2028), PS = String.fromCharCode(0x2029); return s.replace(/<\/script/gi, '<\\/script').split(LS).join('\\u2028').split(PS).join('\\u2029'); }
function build(dataPath, outPath, opts) {
  opts = opts || {};
  const root = path.join(__dirname, '..', '..', '..');
  const tpl = fs.readFileSync(opts.template || path.join(root, 'docs', 'standalone', 'src', 'geo_mvp.template.html'), 'utf8');
  const data = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
  const leafletJs = fs.readFileSync(path.join(root, 'os', 'leaflet.case.js'), 'utf8');
  const leafletCss = fs.readFileSync(path.join(root, 'os', 'leaflet.case.css'), 'utf8');
  const cluster = fs.readFileSync(path.join(root, 'os', 'leaflet.markercluster.js'), 'utf8');
  const clusterCss = '.leaflet-cluster-anim .leaflet-marker-icon{transition:transform .3s ease-out,opacity .3s ease-in}.marker-cluster{background-clip:padding-box}';
  let html = tpl;
  const put = (marker, value) => { if (html.indexOf(marker) < 0) throw new Error('нет плейсхолдера ' + marker); html = html.replace(marker, () => value); };
  put('/*__LEAFLET_CSS__*/', leafletCss.replace(/<\/style/gi, '') + clusterCss);
  put('/*__LEAFLET_JS__*/', safe(leafletJs));
  put('/*__CLUSTER_JS__*/', safe(cluster));
  put('/*__DATA__*/null', safe(JSON.stringify({ generated: data.generated, bc: data.bc, districts: data.districts, poi: data.poi || null })));
  fs.writeFileSync(outPath, html);
  const poi = data.poi && data.poi.categories ? Object.keys(data.poi.categories).reduce((s, c) => s + Object.keys(data.poi.categories[c].sub).reduce((t, k) => t + data.poi.categories[c].sub[k].length, 0), 0) : 0;
  return { bytes: Buffer.byteLength(html), records: data.bc.length, demo: data.bc.filter(r => r.meta && r.meta.demo).length, poi };
}
/* v4.74.0: тот же файл кладётся и в платформу (os/geo-platform.html, экран «Geo Platform:
   бизнес-центры»), и в docs/standalone как отдельный продукт; без аргументов собираются оба */
if (require.main === module) {
  const dataPath = process.argv[2] || path.join(__dirname, '..', '..', 'standalone', 'data', 'geo_mvp_data.json');
  const outs = process.argv[3] ? [process.argv[3]] : [path.join(__dirname, '..', '..', 'standalone', 'CASE_Geo_Platform_MVP.html'), path.join(__dirname, '..', '..', '..', 'os', 'geo-platform.html')];
  const tpl = process.argv[4] || path.join(__dirname, '..', '..', 'standalone', 'src', 'geo_mvp.template.html');
  outs.forEach(out => {
    if (path.resolve(out) === path.resolve(tpl)) { console.error('выход совпадает с шаблоном'); process.exit(2); }
    const r = build(dataPath, out, { template: process.argv[4] });
    console.log('собрано ' + out + ': ' + (r.bytes / 1024).toFixed(0) + ' КБ, записей ' + r.records + ', demo ' + r.demo + ', городских объектов ' + r.poi);
  });
}
module.exports = { build };
