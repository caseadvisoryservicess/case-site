/**
 * Генерация веб-планировок (SVG) из геометрии CAD-чертежей Taxtapul.
 *
 * Источник: рабочие планы CASE (оси 1-4: 5950/7150/5950 мм; оси А-Д:
 * 2100/5100/7200/6000 мм; подвал глубже — до оси Е, +3400 мм).
 * По спецификации A.5: без осей, размерных цепочек и штампов; остаются
 * контур, колонны, лестнично-лифтовое ядро, входы; добавлены номер уровня
 * и GLA. Подписи внутри SVG языконейтральны (цифры и «GLA … m²») — весь
 * локализованный текст живёт в HTML рядом с планом.
 *
 * Запуск: node scripts/gen-plans.js  (кладёт plan-*.svg в uploads проекта)
 */
'use strict';
const fs = require('fs');
const path = require('path');

const OUT_DIR = path.join(__dirname, '..', 'data', 'projects', 'takhtapul', 'uploads');

// координаты в мм, масштаб в SVG-единицы
const S = 0.1;
const X = [0, 5950, 13100, 19050];              // оси 1-4
const YA = { A: 0, B: 2100, V: 7200, G: 14400, D: 20400, E: 23800 }; // оси А-Е (от юга)

const INK = '#2b2d30';
const WALL = 4;
const BRONZE = '#a8804c';
const FILL_MAIN = 'rgba(168,128,76,.16)';
const FILL_ALT = 'rgba(168,128,76,.34)';
const CORE_FILL = '#eceae6';

// ядро: лестница + лифт между осями 2-3, от Б-1700 до В (по чертежам)
const CORE = { x1: 7350, y1: 1700, x2: 12250, y2: 7200 };

function pt(xmm, ymm, H) { return `${(xmm * S).toFixed(1)},${((H - ymm) * S).toFixed(1)}`; }

function core(H) {
  const { x1, y1, x2, y2 } = CORE;
  const w = [];
  w.push(`<rect x="${x1 * S}" y="${(H - y2) * S}" width="${(x2 - x1) * S}" height="${(y2 - y1) * S}" fill="${CORE_FILL}" stroke="${INK}" stroke-width="2"/>`);
  // шахта лифта
  const lw = 2000, lh = 2200, lx = x1 + 1500, ly = y2 - 3400;
  w.push(`<rect x="${lx * S}" y="${(H - ly - lh) * S}" width="${lw * S}" height="${lh * S}" fill="#fff" stroke="${INK}" stroke-width="2"/>`);
  w.push(`<line x1="${lx * S}" y1="${(H - ly - lh) * S}" x2="${(lx + lw) * S}" y2="${(H - ly) * S}" stroke="${INK}" stroke-width="1"/>`);
  w.push(`<line x1="${(lx + lw) * S}" y1="${(H - ly - lh) * S}" x2="${lx * S}" y2="${(H - ly) * S}" stroke="${INK}" stroke-width="1"/>`);
  // лестничные ступени (схематично)
  const sx = x1 + 4000, sw = 800, steps = 7;
  for (let i = 0; i < steps; i++) {
    const yy = y2 - 600 - i * 500;
    w.push(`<line x1="${sx * S}" y1="${(H - yy) * S}" x2="${(sx + sw) * S}" y2="${(H - yy) * S}" stroke="${INK}" stroke-width="1.2"/>`);
  }
  w.push(`<line x1="${sx * S}" y1="${(H - y2 + 600 * S) * S}" x2="${sx * S}" y2="${(H - (y2 - 600 - (steps - 1) * 500)) * S}" stroke="${INK}" stroke-width="1"/>`);
  return w.join('\n  ');
}

function columns(H, pts) {
  const c = 200; // половина стороны колонны 400мм
  return pts.map(([x, y]) =>
    `<rect x="${(x - c) * S}" y="${(H - y - c) * S}" width="${2 * c * S}" height="${2 * c * S}" fill="${INK}"/>`
  ).join('\n  ');
}

function entranceArrow(xmm, ymm, H, dir) {
  // стрелка входа: dir 'up' = вход с юга (снизу плана)
  const x = xmm * S, y = (H - ymm) * S;
  const len = 60;
  const y2 = dir === 'up' ? y - len : y + len;
  const tip = dir === 'up' ? y2 + 14 : y2 - 14;
  return `<line x1="${x}" y1="${y}" x2="${x}" y2="${y2}" stroke="${BRONZE}" stroke-width="3"/>` +
    `<path d="M${x - 8},${tip} L${x},${y2} L${x + 8},${tip} Z" fill="${BRONZE}"/>`;
}

function label(levelTag, gla, W, glaNote) {
  return `<text x="14" y="44" font-family="system-ui,-apple-system,Segoe UI,Roboto,Arial,sans-serif" font-size="34" font-weight="700" fill="${INK}">${levelTag}</text>` +
    `<text x="${W - 14}" y="34" text-anchor="end" font-family="system-ui,-apple-system,Segoe UI,Roboto,Arial,sans-serif" font-size="19" font-weight="650" fill="${BRONZE}">GLA ${gla} m²</text>` +
    (glaNote ? `<text x="${W - 14}" y="56" text-anchor="end" font-family="system-ui,-apple-system,Segoe UI,Roboto,Arial,sans-serif" font-size="13" fill="#66696e">${glaNote}</text>` : '');
}

function svgDoc(W, H, body) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" role="img">\n  ${body}\n</svg>\n`;
}

const PAD = 70; // отступ под подписи

function typicalFloor({ tag, gla, glaNote, zones, entrance }) {
  const Hmm = YA.D, Wsvg = X[3] * S + 24, Hsvg = Hmm * S + PAD + 16;
  const off = PAD; // сдвиг плана вниз под подписи
  const g = [];
  // зоны аренды (под контуром)
  for (const z of zones) {
    g.push(`<rect x="${z.x1 * S + 12}" y="${(Hmm - z.y2) * S + off}" width="${(z.x2 - z.x1) * S}" height="${(z.y2 - z.y1) * S}" fill="${z.alt ? FILL_ALT : FILL_MAIN}"/>`);
    if (z.label) {
      const cx = ((z.x1 + z.x2) / 2) * S + 12, cy = ((Hmm - (z.y1 + z.y2) / 2) * S) + off + 6;
      g.push(`<text x="${cx}" y="${cy}" text-anchor="middle" font-family="system-ui,-apple-system,Segoe UI,Roboto,Arial,sans-serif" font-size="17" font-weight="650" fill="${BRONZE}">${z.label} m²</text>`);
    }
  }
  // контур
  g.push(`<rect x="12" y="${off}" width="${X[3] * S}" height="${Hmm * S}" fill="none" stroke="${INK}" stroke-width="${WALL}"/>`);
  // ядро и колонны — в системе с офсетом
  g.push(`<g transform="translate(12,${off})">`);
  g.push(core(Hmm));
  g.push(columns(Hmm, [
    [X[1], YA.B], [X[2], YA.B],
    [X[1], YA.V], [X[2], YA.V],
    [X[1], YA.G], [X[2], YA.G]
  ]));
  if (entrance) g.push(entranceArrow((X[1] + X[2]) / 2, 40, Hmm, 'up'));
  g.push('</g>');
  g.push(label(tag, gla, Wsvg, glaNote));
  return svgDoc(Wsvg, Hsvg, g.join('\n  '));
}

function basement() {
  const Hmm = YA.E, Wsvg = X[3] * S + 24, Hsvg = Hmm * S + PAD + 16;
  const off = PAD;
  const g = [];
  // контур: основное тело А-Д на всю ширину + выступ Д-Е справа (ширина 5550)
  const nx = X[3] - 5550; // левая грань выступа
  const p = [
    pt(0, 0, Hmm), pt(0, YA.D, Hmm), pt(nx, YA.D, Hmm), pt(nx, YA.E, Hmm),
    pt(X[3], YA.E, Hmm), pt(X[3], 0, Hmm)
  ].map((s) => s.split(',').map((n, i) => (i === 0 ? +n + 12 : +n + off).toFixed(1)).join(','));
  g.push(`<polygon points="${p.join(' ')}" fill="${FILL_MAIN}" stroke="${INK}" stroke-width="${WALL}"/>`);
  g.push(`<g transform="translate(12,${off})">`);
  g.push(core(Hmm));
  g.push(columns(Hmm, [[X[1], YA.B], [X[2], YA.B], [X[1], YA.V], [X[2], YA.V], [X[1], YA.G], [X[2], YA.G], [X[1], YA.D], [X[2], YA.D]]));
  // пандус-въезд снизу слева (полоса 0..5550 у южной грани)
  g.push(`<rect x="${300 * S}" y="${(Hmm - 1700) * S}" width="${5250 * S}" height="${1400 * S}" fill="none" stroke="${BRONZE}" stroke-width="2" stroke-dasharray="6 4"/>`);
  g.push(entranceArrow(2900, 250, Hmm, 'up'));
  g.push('</g>');
  g.push(label('−1', '337.4', Wsvg));
  return svgDoc(Wsvg, Hsvg, g.join('\n  '));
}

const plans = {
  'plan-b.svg': basement(),
  'plan-f1.svg': typicalFloor({
    tag: '1', gla: '358.7',
    zones: [{ x1: 0, y1: 0, x2: X[3], y2: YA.D }],
    entrance: true
  }),
  'plan-f2.svg': typicalFloor({ tag: '2', gla: '395.6', zones: [{ x1: 0, y1: 0, x2: X[3], y2: YA.D }] }),
  'plan-f3.svg': typicalFloor({ tag: '3', gla: '395.6', zones: [{ x1: 0, y1: 0, x2: X[3], y2: YA.D }] }),
  'plan-f4.svg': typicalFloor({
    tag: '4', gla: '395.6', glaNote: '314.2 + 101.8',
    zones: [
      // основная зона: север целиком + восточная часть до юга
      { x1: 0, y1: YA.V, x2: X[3], y2: YA.D, label: '314.2' },
      { x1: X[1], y1: YA.B, x2: X[3], y2: YA.V },
      // вторая зона (Г-образная: запад + юг)
      { x1: 0, y1: 0, x2: X[1], y2: YA.V, alt: true, label: '101.8' },
      { x1: X[1], y1: 0, x2: X[3], y2: YA.B, alt: true }
    ]
  })
};

fs.mkdirSync(OUT_DIR, { recursive: true });
for (const [name, svg] of Object.entries(plans)) {
  fs.writeFileSync(path.join(OUT_DIR, name), svg);
  console.log('создан', name, (svg.length / 1024).toFixed(1) + ' КБ');
}
