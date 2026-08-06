/**
 * Геоданные Тахтапула из приложения CASE OS Geo Analytics.
 *
 * Владелец прислал сам файл приложения, а в нём зашиты те же слои, по которым
 * приложение считает баллы: MEDPTS (медицина, 1 530 объектов, OSM + clinics.uz),
 * BC (бизнес-центры, 151), PHARM (аптеки), KPOP (сетка населения Kontur).
 * Раньше мы считали окружение по своей геобазе, и цифры чуть расходились с
 * приложением (34 против 33 медобъекта, 3 против 4 БЦ). Теперь берём данные
 * оттуда же, откуда приложение берёт баллы, - документ становится согласованным.
 *
 * Сверка: на 1 км скрипт даёт 33 конкурента и 4 БЦ - ровно то, что показывает
 * приложение в карточке точки (балл офиса 78, балл клиники 55).
 *
 * Конкурентами клиники приложение считает типы из своей константы MEDCOMP:
 * hospital, clinic, private, doctors, lab. Стоматологии и узкие профили в этот
 * список не входят, поэтому в 1 км конкурентов 33, а всего медобъектов 34.
 *
 * Население НЕ пересчитываем: приложение калибрует сетку Kontur на официальное
 * население района по полигонам, которые тянет из сети, и без них коэффициент
 * не воспроизвести. Берём готовую цифру приложения по 1 км (32 375) - именно её
 * использует модель.
 *
 * Запуск: node scripts/geo-from-caseos.js <путь-к-CASE_OS_Geo_Analytics.html>
 */
'use strict';
const fs = require('fs');
const path = require('path');

const SRC = process.argv[2];
if (!SRC || !fs.existsSync(SRC)) {
  console.error('Укажите путь к файлу приложения: node scripts/geo-from-caseos.js <CASE_OS_Geo_Analytics.html>');
  process.exit(1);
}
const OUT = path.join(__dirname, '..', 'data', 'projects', 'takhtapul', 'geo-invest.json');

const LAT = 41.33894, LNG = 69.26336;   // точка Taxtapul BC в приложении
const MAX = 3000;
const COMP = ['hospital', 'clinic', 'private', 'doctors', 'lab'];

const html = fs.readFileSync(SRC, 'utf8');
// вытаскиваем литерал по имени переменной, считая вложенные скобки и строки
const grab = (name) => {
  const i = html.indexOf(name + '=');
  if (i < 0) throw new Error('в файле приложения нет ' + name);
  let j = html.indexOf(html[i + name.length + 1] === '[' ? '[' : '{', i);
  const open = html[j], close = open === '[' ? ']' : '}';
  let depth = 0, k = j, inStr = false, esc = false;
  for (; k < html.length; k++) {
    const c = html[k];
    if (inStr) { if (esc) esc = false; else if (c === '\\') esc = true; else if (c === '"') inStr = false; continue; }
    if (c === '"') { inStr = true; continue; }
    if (c === open) depth++;
    else if (c === close) { depth--; if (!depth) { k++; break; } }
  }
  return JSON.parse(html.slice(j, k));
};

const MED = grab('MEDPTS'), BC = grab('BC'), PHARM = grab('PHARM'), SPLBL = grab('SPLBL');

const hav = (a, b, c, d) => {
  const R = 6371000, r = Math.PI / 180, dLa = (c - a) * r, dLn = (d - b) * r;
  const x = Math.sin(dLa / 2) ** 2 + Math.cos(a * r) * Math.cos(c * r) * Math.sin(dLn / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(x));
};

const med = MED.map((m) => ({ ...m, d: Math.round(hav(LAT, LNG, m.la, m.ln)) })).filter((m) => m.d <= MAX);
// ВАЖНО: сам Тахтапул тоже лежит в списке BC приложения, и модель считает его
// среди конкурентов - поэтому в карточке точки стоит 4 БЦ в 1 км, хотя чужих
// бизнес-центров там три. Держим оба числа: bcModel как считает модель (от него
// посчитан балл 78) и bc как есть на самом деле.
const bcAll = BC.map((b) => ({ n: b.name, la: +b.lat, ln: +b.lng, d: Math.round(hav(LAT, LNG, +b.lat, +b.lng)) }))
  .filter((b) => b.d <= MAX).sort((a, b) => a.d - b.d);
const bc = bcAll.filter((b) => b.d > 0);
const ph = PHARM.map((p) => Math.round(hav(LAT, LNG, p[0], p[1]))).filter((d) => d <= MAX);

const RINGS = [500, 1000, 1500, MAX];
const counts = {};
for (const r of RINGS) {
  const inR = med.filter((m) => m.d <= r);
  counts[r] = {
    med: inR.length,
    comp: inR.filter((m) => COMP.includes(m.t)).length,
    bc: bc.filter((b) => b.d <= r).length,
    bcModel: bcAll.filter((b) => b.d <= r).length,
    ph: ph.filter((d) => d <= r).length
  };
}

// разбивка медицины в 1 км по направлениям приложения (поле sp, подписи SPLBL)
const mix = {};
for (const m of med.filter((x) => x.d <= 1000)) {
  const key = m.sp || 'other';
  mix[key] = (mix[key] || 0) + 1;
}
const medMix = Object.entries(mix).sort((a, b) => b[1] - a[1])
  .map(([k, n]) => ({ k, l: SPLBL[k] || k, n }));

const M_LAT = 110540, M_LNG = 111320 * Math.cos((LAT * Math.PI) / 180);
const pt = (la, ln, c, d) => ({ c, x: Math.round((ln - LNG) * M_LNG), y: Math.round((la - LAT) * M_LAT), d });

const data = {
  src: 'CASE OS Geo Analytics (встроенные слои приложения)',
  point: { lat: LAT, lng: LNG },
  rings: [500, 1000, 1500],
  maxRing: MAX,
  counts,
  medMix,
  nearestBc: bc.slice(0, 8).map((b) => ({ n: b.n, d: b.d })),
  points: [
    ...med.map((m) => pt(m.la, m.ln, COMP.includes(m.t) ? 'med' : 'medx', m.d)),
    ...bc.map((b) => pt(b.la, b.ln, 'bc', b.d))
  ],
  total: med.length + bc.length
};

fs.writeFileSync(OUT, JSON.stringify(data, null, 2));
console.log('Готово:', path.relative(process.cwd(), OUT));
for (const r of RINGS) {
  const c = counts[r];
  console.log(`  ${String(r).padStart(4)} м: медицина ${c.med} (конкурентов ${c.comp}), БЦ ${c.bc} (модель считает ${c.bcModel}), аптеки ${c.ph}`);
}
console.log('  сверка с приложением на 1 км: конкурентов 33, БЦ 4');
console.log('  ближайшие БЦ:', data.nearestBc.slice(0, 3).map((b) => `${b.n} ${b.d} м`).join(' · '));
