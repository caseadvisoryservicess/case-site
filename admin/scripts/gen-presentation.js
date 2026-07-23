/**
 * Генерация PDF-презентации проекта Taxtapul (12 страниц, A4 альбомная).
 *
 * Данные берутся из project.json (верифицированные цифры), плюс GBA по уровням
 * из рабочей документации — GBA публикуется только в брошюре, на сайте — GLA.
 * Рендерится HTML в фирменном стиле лендинга и печатается через Chromium.
 *
 * Запуск (локально, нужен Playwright+Chromium):
 *   node scripts/gen-presentation.js
 * Результат: data/projects/takhtapul/uploads/presentation.pdf
 */
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const UP = path.join(ROOT, 'data', 'projects', 'takhtapul', 'uploads');
const OUT = path.join(UP, 'presentation.pdf');
const SITE_URL = 'https://caseadvisory.uz/taxtapul/';

const cfg = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/projects/takhtapul/project.json'), 'utf8'));
const ru = (v) => String(typeof v === 'string' ? v : (v && v.ru) || '').replace(/\u2014/g, '-');

// GBA по уровням — из рабочей документации (в конфиге лендинга не хранится)
const GBA = { b: '375,9', f1: '412,9', f2: '453,0', f3: '453,0', f4: '457,6' };
// цветные CAD-листы для страниц планировок (fallback - units[].plan)
const PLAN_CAD = { b: 'plan-cad-b.jpg', f1: 'plan-cad-f1.jpg', f2: 'plan-cad-f23.jpg', f3: 'plan-cad-f23.jpg', f4: 'plan-cad-f4.jpg' };
const planImg = (u) => {
  const cad = PLAN_CAD[u.id];
  return (cad && fs.existsSync(path.join(UP, cad))) ? cad : u.plan;
};
const ELEV = { b: '—', f1: '±0.000', f2: '+4.300', f3: '+8.200', f4: '+12.100' };

const img64 = (name) => {
  const p = path.join(UP, name);
  const ext = path.extname(name).slice(1);
  const mime = ext === 'svg' ? 'svg+xml' : ext === 'png' ? 'png' : 'jpeg';
  return `data:image/${mime};base64,${fs.readFileSync(p).toString('base64')}`;
};

const BRONZE = '#a8804c', INK = '#212326', MUTED = '#63666b', BG = '#f6f5f2', DARK = '#1b1d1f';

function pageCss() {
  return `
  @page { size: A4 landscape; margin: 0; }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: system-ui, "Segoe UI", Roboto, "DejaVu Sans", Arial, sans-serif; color: ${INK}; }
  .pg { width: 297mm; height: 210mm; page-break-after: always; position: relative; overflow: hidden; background: ${BG}; padding: 16mm 18mm 14mm; display: flex; flex-direction: column; }
  .pg:last-child { page-break-after: auto; }
  .lbl { display: inline-block; font-size: 8.5pt; font-weight: 700; letter-spacing: .12em; text-transform: uppercase; color: ${BRONZE}; margin-bottom: 5mm; }
  h2 { font-size: 24pt; font-weight: 800; letter-spacing: -.01em; margin-bottom: 7mm; }
  .foot { position: absolute; left: 18mm; right: 18mm; bottom: 8mm; display: flex; justify-content: space-between; font-size: 8pt; color: ${MUTED}; }
  .foot b { color: ${INK}; font-weight: 700; letter-spacing: .08em; }
  table { border-collapse: collapse; width: 100%; background: #fff; border-radius: 4mm; overflow: hidden; }
  th { text-align: left; font-size: 8pt; letter-spacing: .08em; text-transform: uppercase; color: ${MUTED}; padding: 4mm 5mm 3mm; border-bottom: .5pt solid #ddd; }
  td { padding: 4.2mm 5mm; font-size: 10.5pt; border-bottom: .4pt solid #eee; vertical-align: middle; }
  tr:last-child td { border-bottom: none; }
  .st { display: inline-block; font-size: 8.5pt; font-weight: 700; padding: 1.6mm 4mm; border-radius: 99px; background: #e6f4e7; color: #2e7c39; }
  .st.off { background: #ececeb; color: #75787c; }
  `;
}

function foot(n) {
  return `<div class="foot"><span><b>TAXTAPUL</b> · Тахтапул, 31 · Ташкент</span><span>CASE Real Estate Advisory · ${esc(cfg.contacts.phone)} · caseadvisory.uz</span><span>${n} / 12</span></div>`;
}
function esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;'); }

async function main() {
  const QR = require('qrcode');
  const qr = await QR.toDataURL(SITE_URL, { width: 380, margin: 1, color: { dark: DARK, light: '#f6f5f2' } });

  const units = cfg.units.filter((u) => !u.whole);
  const whole = cfg.units.find((u) => u.whole);

  const unitRow = (u) => `<tr>
    <td><b>${esc(ru(u.level))}</b></td>
    <td>${ELEV[u.id] || ''}</td>
    <td>${GBA[u.id] || ''} м²</td>
    <td><b>${esc(u.gla)} м²</b>${u.glaNote ? ` <span style="color:${MUTED};font-size:8.5pt">(${esc(u.glaNote)})</span>` : ''}</td>
    <td>${esc(u.ceil)} м</td>
    <td style="font-size:9.5pt;color:${MUTED}">${esc(ru(u.uses))}</td>
    <td><span class="st${u.status === 'available' ? '' : ' off'}">${u.status === 'available' ? 'Свободно' : u.status === 'reserved' ? 'Резерв' : u.status === 'leased' ? 'Сдано' : 'Продано'}</span></td>
  </tr>`;

  const planPage = (n, u, extraTitle) => `
  <div class="pg">
    <span class="lbl">Планировка</span>
    <h2>${esc(extraTitle || ru(u.level))}</h2>
    <div style="display:flex;gap:12mm;flex:1;min-height:0">
      <div style="flex:1.15;background:#fff;border-radius:5mm;padding:8mm;display:flex;align-items:center;justify-content:center">
        <img src="${img64(planImg(u))}" style="max-width:100%;max-height:138mm">
      </div>
      <div style="flex:.85;display:flex;flex-direction:column;gap:4mm;justify-content:center">
        ${[['GBA', (GBA[u.id] || '') + ' м²'], ['GLA', u.gla + ' м²' + (u.glaNote ? ' (' + u.glaNote + ')' : '')], ['Потолки (в свету)', u.ceil + ' м'], ['Отметка', ELEV[u.id] || '—'], ['Использование', ru(u.uses)]]
          .map(([k, v]) => `<div style="background:#fff;border-radius:3.5mm;padding:5mm 6mm">
            <div style="font-size:8pt;letter-spacing:.09em;text-transform:uppercase;color:${MUTED};margin-bottom:1.5mm">${k}</div>
            <div style="font-size:${k === 'Использование' ? '11' : '15'}pt;font-weight:700">${esc(v)}</div>
          </div>`).join('')}
        <div style="font-size:8pt;color:${MUTED};margin-top:1mm">Схема по рабочим чертежам, не является точным обмером. Свободная планировка: колонны 5 950 / 7 150 / 5 950 мм и лифтовое ядро.</div>
      </div>
    </div>
    ${foot(n)}
  </div>`;

  const caseCard = (c) => `<div style="background:#fff;border-radius:4mm;padding:7mm;flex:1">
    <div style="font-size:13.5pt;font-weight:800;margin-bottom:1.5mm">${esc(ru(c.h))}</div>
    <div style="font-size:9pt;font-weight:700;color:${BRONZE};margin-bottom:3mm">${esc(ru(c.levels))}</div>
    <div style="font-size:9.5pt;line-height:1.55;color:${MUTED}">${esc(ru(c.p))}</div>
  </div>`;

  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><style>${pageCss()}</style></head><body>

  <!-- 1. Обложка -->
  <div class="pg" style="padding:0;background:${DARK}">
    <img src="${img64('hero-dusk.jpg')}" style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover">
    <div style="position:absolute;inset:0;background:linear-gradient(180deg,rgba(15,16,18,.35),rgba(15,16,18,.82))"></div>
    <div style="position:relative;margin-top:auto;padding:0 18mm 20mm;color:#fff">
      <div style="font-size:11pt;font-weight:800;letter-spacing:.2em;margin-bottom:6mm">TAXTAPUL</div>
      <div style="font-size:34pt;font-weight:800;letter-spacing:-.01em;line-height:1.1;max-width:200mm">Коммерческое здание<br>Тахтапул, 31 — Ташкент</div>
      <div style="font-size:13pt;margin-top:6mm;opacity:.9">Аренда · Покупка · Аренда с последующим выкупом</div>
      <div style="display:flex;gap:14mm;margin-top:10mm;font-size:10pt">
        <span><b style="font-size:16pt">1 882,9 м²</b><br><span style="opacity:.75">GLA всего</span></span>
        <span><b style="font-size:16pt">5</b><br><span style="opacity:.75">уровней</span></span>
        <span><b style="font-size:16pt">12</b><br><span style="opacity:.75">машиномест</span></span>
        <span><b style="font-size:16pt">3,0–4,0 м</b><br><span style="opacity:.75">потолки</span></span>
      </div>
    </div>
    <div style="position:absolute;right:18mm;bottom:20mm;color:#fff;font-size:9pt;opacity:.8">CASE Real Estate Advisory</div>
  </div>

  <!-- 2. О проекте -->
  <div class="pg">
    <span class="lbl">О проекте</span>
    <h2>Отдельно стоящее здание со свободной планировкой</h2>
    <div style="display:flex;gap:12mm;flex:1;min-height:0">
      <div style="flex:1;display:flex;flex-direction:column;gap:5mm">
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:5mm">
          ${[['1 882,9 м²', 'арендопригодная площадь (GLA)'], ['2 152,4 м²', 'общая площадь (GBA)'], ['5 уровней', 'подвал + 4 этажа, лифт'], ['12 мест', 'паркинг: 6 подземных + 6 наземных']]
            .map(([n, l]) => `<div style="background:#fff;border-radius:4mm;padding:6mm">
              <div style="font-size:17pt;font-weight:800">${n}</div>
              <div style="font-size:9pt;color:${MUTED};margin-top:1mm">${l}</div></div>`).join('')}
        </div>
        <div style="background:rgba(168,128,76,.1);border-left:1.2mm solid ${BRONZE};border-radius:0 3mm 3mm 0;padding:5mm 6mm;font-size:10.5pt;line-height:1.5">${esc(ru(cfg.about.status))}</div>
        <div style="font-size:9.5pt;color:${MUTED};line-height:1.55">${esc(ru(cfg.unitsSection.note))} ${esc(ru(cfg.about.sfbNote))}</div>
      </div>
      <div style="flex:1;border-radius:5mm;overflow:hidden;position:relative">
        <img src="${img64('facade-vertical-dusk.jpg')}" style="width:100%;height:100%;object-fit:cover">
        <span style="position:absolute;right:4mm;bottom:4mm;background:rgba(15,16,18,.6);color:#fff;font-size:7pt;letter-spacing:.1em;text-transform:uppercase;padding:2mm 3.5mm;border-radius:2mm">визуализация</span>
      </div>
    </div>
    ${foot(2)}
  </div>

  <!-- 3. Сводная таблица уровней -->
  <div class="pg">
    <span class="lbl">Помещения</span>
    <h2>Пять уровней — от этажа до здания целиком</h2>
    <table>
      <tr><th>Уровень</th><th>Отметка</th><th>GBA</th><th>GLA</th><th>Потолки</th><th>Возможное использование</th><th>Статус</th></tr>
      ${units.map(unitRow).join('')}
      <tr style="background:${BG}">
        <td><b>Здание целиком</b></td><td></td><td><b>2 152,4 м²</b></td><td><b>1 882,9 м²</b></td><td></td>
        <td style="font-size:9.5pt;color:${MUTED}">${esc(ru(whole.uses))}</td>
        <td><span class="st${whole.status === 'available' ? '' : ' off'}">${whole.status === 'available' ? 'Свободно' : 'Занято'}</span></td>
      </tr>
    </table>
    <div style="margin-top:5mm;font-size:9pt;color:${MUTED}">Цены и условия — по запросу. Возможна аренда, покупка отдельного этажа или здания целиком, аренда с последующим выкупом.</div>
    ${foot(3)}
  </div>

  <!-- 4-7. Планировки -->
  ${planPage(4, units.find((u) => u.id === 'b'))}
  ${planPage(5, units.find((u) => u.id === 'f1'))}
  ${planPage(6, units.find((u) => u.id === 'f2'), '2 и 3 этажи (идентичные)')}
  ${planPage(7, units.find((u) => u.id === 'f4'))}

  <!-- 8. Кому подходит -->
  <div class="pg">
    <span class="lbl">Сценарии использования</span>
    <h2>${esc(ru(cfg.useCases.h2))}</h2>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:6mm;flex:1;align-content:start">
      ${cfg.useCases.cards.map(caseCard).join('')}
    </div>
    ${foot(8)}
  </div>

  <!-- 9. Форматы сделки -->
  <div class="pg" style="background:${DARK};color:#fff">
    <span class="lbl">Форматы сделки</span>
    <h2 style="color:#fff">${esc(ru(cfg.scenarios.h2))}</h2>
    <div style="display:flex;gap:6mm;flex:1;align-items:stretch">
      ${cfg.scenarios.cols.map((c) => `<div style="flex:1;background:rgba(255,255,255,.06);border:.4pt solid rgba(255,255,255,.18);border-radius:4mm;padding:8mm">
        <div style="font-size:14pt;font-weight:800;margin-bottom:4mm">${esc(ru(c.h))}</div>
        <div style="font-size:10pt;line-height:1.6;color:rgba(255,255,255,.78)">${esc(ru(c.p))}</div>
      </div>`).join('')}
    </div>
    <div style="margin-top:6mm;font-size:10pt;color:rgba(255,255,255,.65)">Цены и условия — по запросу: ${esc(cfg.contacts.phone)} · t.me/${esc(cfg.contacts.telegram)}</div>
    <div class="foot" style="color:rgba(255,255,255,.5)"><span><b style="color:#fff">TAXTAPUL</b> · Тахтапул, 31 · Ташкент</span><span>CASE Real Estate Advisory</span><span>9 / 12</span></div>
  </div>

  <!-- 10. Локация -->
  <div class="pg">
    <span class="lbl">Локация</span>
    <h2>${esc(ru(cfg.location.h2))}</h2>
    <div style="display:flex;gap:12mm;flex:1">
      <div style="flex:1">
        <div style="font-size:13pt;font-weight:700;margin-bottom:6mm">${esc(ru(cfg.location.address))}</div>
        <table style="background:none">
          <tr><th colspan="2" style="padding-left:0">На автомобиле</th></tr>
          ${cfg.location.drive.map((d) => `<tr><td style="padding-left:0;background:none">${esc(ru(d.to))}</td><td style="text-align:right;font-weight:700;background:none">${esc(ru(d.time))}</td></tr>`).join('')}
        </table>
        <div style="margin-top:5mm;font-size:8.5pt;color:${MUTED}">${esc(ru(cfg.location.metroNote))} · Координаты: 41.338889, 69.263403</div>
      </div>
      <div style="flex:1;display:flex;flex-direction:column;gap:5mm">
        <div style="background:#fff;border-radius:4mm;padding:7mm;font-size:10.5pt;line-height:1.6;color:${MUTED}">${esc(ru(cfg.location.around))}</div>
        <div style="background:rgba(168,128,76,.1);border-radius:4mm;padding:6mm;font-size:10.5pt;line-height:1.5">Первая линия улицы Тахтапул, выезд на Малую кольцевую — рядом. Объект для клиентов, приезжающих на автомобиле: паркинг у входа и подземный уровень.</div>
      </div>
    </div>
    ${foot(10)}
  </div>

  <!-- 11. Визуализации -->
  <div class="pg">
    <span class="lbl">Визуализации</span>
    <h2>Внешний облик</h2>
    <div style="display:flex;gap:6mm;flex:1;min-height:0">
      ${['aerial-night.jpg', 'facade-night.jpg'].map((f) => `<div style="flex:1;border-radius:5mm;overflow:hidden;position:relative">
        <img src="${img64(f)}" style="width:100%;height:100%;object-fit:cover">
        <span style="position:absolute;right:4mm;bottom:4mm;background:rgba(15,16,18,.6);color:#fff;font-size:7pt;letter-spacing:.1em;text-transform:uppercase;padding:2mm 3.5mm;border-radius:2mm">визуализация</span>
      </div>`).join('')}
    </div>
    <div style="margin-top:4mm;font-size:8.5pt;color:${MUTED}">Все изображения — визуализации проекта, не являются публичной офертой.</div>
    ${foot(11)}
  </div>

  <!-- 12. Контакты -->
  <div class="pg" style="background:${DARK};color:#fff;align-items:center;justify-content:center;text-align:center">
    <div style="font-size:10pt;font-weight:800;letter-spacing:.2em;margin-bottom:8mm">TAXTAPUL</div>
    <div style="font-size:26pt;font-weight:800;margin-bottom:3mm">Обсудим ваш формат?</div>
    <div style="font-size:11pt;color:rgba(255,255,255,.7);margin-bottom:10mm">Ответим в течение дня — площадь, срок, порядок входа.</div>
    <div style="font-size:17pt;font-weight:800;margin-bottom:2.5mm">${esc(cfg.contacts.phone)}</div>
    <div style="font-size:12pt;color:rgba(255,255,255,.85);margin-bottom:10mm">t.me/${esc(cfg.contacts.telegram)} · ${esc(SITE_URL.replace('https://', ''))}</div>
    <img src="${qr}" style="width:34mm;height:34mm;border-radius:3mm">
    <div style="font-size:8.5pt;color:rgba(255,255,255,.55);margin-top:3mm">Наведите камеру — откроется сайт проекта</div>
    <div style="position:absolute;left:18mm;right:18mm;bottom:8mm;display:flex;justify-content:space-between;font-size:8pt;color:rgba(255,255,255,.45)">
      <span>CASE Real Estate Advisory · caseadvisory.uz</span><span>Информация справочная, не является публичной офертой</span><span>12 / 12</span>
    </div>
  </div>

  </body></html>`;

  const htmlPath = path.join(__dirname, '..', 'tmp-presentation.html');
  // типографика: никаких длинных/средних тире нигде
  fs.writeFileSync(htmlPath, html.replace(/[\u2014\u2013]/g, '-'));

  let chromium;
  try { ({ chromium } = require('playwright')); }
  catch { ({ chromium } = require('/opt/node22/lib/node_modules/playwright')); }
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const page = await browser.newPage();
  await page.goto('file://' + htmlPath, { waitUntil: 'networkidle' });
  await page.pdf({ path: OUT, format: 'A4', landscape: true, printBackground: true });
  await browser.close();
  fs.unlinkSync(htmlPath);
  console.log('PDF готов:', OUT, (fs.statSync(OUT).size / 1024 / 1024).toFixed(1) + ' МБ');
}

main().catch((e) => { console.error(e); process.exit(1); });
