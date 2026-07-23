/**
 * Рендерер лендинга v2 — 9 экранов, три полные языковые версии.
 *
 * renderLanding2(cfg, { uploadsDir }) ->
 *   { pages: { 'index.html': ru, 'uz/index.html': uz, 'en/index.html': en },
 *     images: [файлы uploads для копирования в assets/],
 *     sitemap }
 *
 * Каждая версия отрендерена целиком на своём языке (свой <html lang>,
 * title/description, hreflang-кластер, canonical). Внутренние ссылки на
 * ассеты относительные (работает и на /taxtapul/, и в предпросмотре /p/),
 * canonical/OG — абсолютные от cfg.seo.publicUrl.
 *
 * Правила брифа: без цен, без даты сдачи, один primary CTA на экран,
 * рендеры подписаны как визуализации, метро — одной справочной строкой.
 */
'use strict';

const fs = require('fs');
const path = require('path');

const LANGS = ['ru', 'uz', 'en'];
const OG_LOCALE = { ru: 'ru_RU', uz: 'uz_UZ', en: 'en_US' };

function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// значение мультиязычного поля с фолбэком на русский
function pick(v, lang) {
  if (v == null) return '';
  if (typeof v === 'string') return v;
  const t = v[lang];
  return (t && String(t).trim()) ? t : (v.ru || '');
}

function telHref(phone) { return 'tel:' + String(phone || '').replace(/[^\d+]/g, ''); }

// ── строки интерфейса ──
const STR = {
  'nav.units': { ru: 'Помещения', uz: 'Maydonlar', en: 'Premises' },
  'nav.about': { ru: 'О здании', uz: 'Bino haqida', en: 'Building' },
  'nav.location': { ru: 'Локация', uz: 'Manzil', en: 'Location' },
  'nav.faq': { ru: 'Вопросы', uz: 'Savollar', en: 'FAQ' },
  'nav.cta': { ru: 'Заявка', uz: 'Ariza', en: 'Enquire' },
  'intent.lease': { ru: 'Аренда', uz: 'Ijara', en: 'Lease' },
  'intent.buy': { ru: 'Покупка', uz: 'Sotib olish', en: 'Purchase' },
  'hero.cta': { ru: 'Подобрать помещение', uz: 'Maydon tanlash', en: 'Find your space' },
  'units.th.level': { ru: 'Уровень', uz: 'Daraja', en: 'Level' },
  'units.th.gla': { ru: 'GLA', uz: 'GLA', en: 'GLA' },
  'units.th.uses': { ru: 'Возможное использование', uz: 'Mumkin bo‘lgan foydalanish', en: 'Suggested use' },
  'units.th.status': { ru: 'Статус', uz: 'Holat', en: 'Status' },
  'units.cta': { ru: 'Запросить условия', uz: 'Shartlarni so‘rash', en: 'Request terms' },
  'units.ceil': { ru: 'потолки', uz: 'shift', en: 'ceiling' },
  'units.download': { ru: 'Скачать планировку', uz: 'Planirovkani yuklab olish', en: 'Download floor plan' },
  'cta.request': { ru: 'Оставить заявку', uz: 'Ariza qoldirish', en: 'Send an enquiry' },
  'cta.more': { ru: 'Получить больше информации', uz: 'Ko‘proq ma’lumot olish', en: 'Get more information' },
  'units.cta.buy': { ru: 'Запросить условия покупки', uz: 'Sotib olish shartlarini so‘rash', en: 'Request purchase terms' },
  'units.plan.caption': { ru: 'Схема этажа по рабочим чертежам. Не является точным обмером.', uz: 'Ish chizmalari asosidagi qavat sxemasi. Aniq o‘lchov emas.', en: 'Floor diagram based on working drawings. Not a survey.' },
  'st.available': { ru: 'Свободно', uz: 'Bo‘sh', en: 'Available' },
  'st.reserved': { ru: 'Резерв', uz: 'Band qilingan', en: 'Reserved' },
  'st.leased': { ru: 'Сдано', uz: 'Ijaraga berilgan', en: 'Leased' },
  'st.sold': { ru: 'Продано', uz: 'Sotilgan', en: 'Sold' },
  'about.viz': { ru: 'визуализация', uz: 'vizualizatsiya', en: 'visualisation' },
  'about.vizAll': { ru: 'Все изображения — визуализации проекта.', uz: 'Barcha tasvirlar — loyiha vizualizatsiyalari.', en: 'All images are project visualisations.' },
  'loc.h2': { ru: 'Локация', uz: 'Manzil', en: 'Location' },
  'loc.open': { ru: 'Открыть карту', uz: 'Xaritani ochish', en: 'Open the map' },
  'loc.route.ya': { ru: 'Маршрут в Яндекс Картах', uz: 'Yandex Xaritalarda yo‘nalish', en: 'Route in Yandex Maps' },
  'loc.route.g': { ru: 'Маршрут в Google Maps', uz: 'Google Maps’da yo‘nalish', en: 'Route in Google Maps' },
  'loc.drive': { ru: 'На автомобиле', uz: 'Avtomobilda', en: 'By car' },
  'faq.h2': { ru: 'Вопросы и ответы', uz: 'Savol-javoblar', en: 'Questions & answers' },
  'form.h2': { ru: 'Оставить заявку', uz: 'Ariza qoldirish', en: 'Send an enquiry' },
  'form.name': { ru: 'Имя', uz: 'Ismingiz', en: 'Name' },
  'form.phone': { ru: 'Телефон', uz: 'Telefon', en: 'Phone' },
  'form.intent': { ru: 'Что интересует', uz: 'Nima qiziqtiradi', en: 'I’m interested in' },
  'form.intent.both': { ru: 'Аренда с последующим выкупом', uz: 'Keyinchalik sotib olish bilan ijara', en: 'Lease with option to buy' },
  'form.unit': { ru: 'Помещение', uz: 'Maydon', en: 'Unit' },
  'form.unit.none': { ru: 'Ещё не выбрал(а)', uz: 'Hali tanlamadim', en: 'Not decided yet' },
  'form.msg': { ru: 'Комментарий (необязательно)', uz: 'Izoh (ixtiyoriy)', en: 'Comment (optional)' },
  'form.send': { ru: 'Отправить', uz: 'Yuborish', en: 'Send' },
  'form.sending': { ru: 'Отправляем…', uz: 'Yuborilmoqda…', en: 'Sending…' },
  'form.ok': { ru: 'Заявка отправлена. Свяжемся с вами в течение дня.', uz: 'Ariza yuborildi. Kun davomida bog‘lanamiz.', en: 'Request sent. We will contact you within the day.' },
  'form.err': { ru: 'Не удалось отправить. Позвоните или напишите в Telegram.', uz: 'Yuborib bo‘lmadi. Qo‘ng‘iroq qiling yoki Telegram’da yozing.', en: 'Could not send. Please call or message us on Telegram.' },
  'form.phoneErr': { ru: 'Укажите номер в формате +998 XX XXX XX XX', uz: '+998 XX XXX XX XX formatida raqam kiriting', en: 'Enter a phone number in the format +998 XX XXX XX XX' },
  'form.tg': { ru: 'Написать в Telegram', uz: 'Telegram’da yozish', en: 'Message us on Telegram' },
  'form.privacy': { ru: 'Отправляя заявку, вы соглашаетесь на обработку персональных данных.', uz: 'Arizani yuborish orqali shaxsiy ma’lumotlarni qayta ishlashga rozilik bildirasiz.', en: 'By sending the form you consent to the processing of your personal data.' },
  'sticky.call': { ru: 'Позвонить', uz: 'Qo‘ng‘iroq', en: 'Call' },
  'sticky.form': { ru: 'Заявка', uz: 'Ariza', en: 'Enquire' },
  'scen.note': { ru: 'Цены и условия — по запросу.', uz: 'Narxlar va shartlar — so‘rov bo‘yicha.', en: 'Prices and terms on request.' }
};

const ICONS = {
  clinic: '<path d="M12 3v18M3 12h18"/><circle cx="12" cy="12" r="9"/>',
  education: '<path d="M12 4L2 9l10 5 10-5-10-5zM6 11.5V16c0 1.5 2.7 3 6 3s6-1.5 6-3v-4.5"/>',
  office: '<rect x="3" y="4" width="18" height="14" rx="2"/><path d="M3 9h18M8 21h8M12 18v3"/>',
  service: '<path d="M4 20h16M6 20V9l6-5 6 5v11M10 20v-5h4v5"/>'
};

function icon(name) {
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" aria-hidden="true">${ICONS[name] || ICONS.office}</svg>`;
}

// ── адаптивные изображения: <picture> строится только из реально существующих файлов ──
function pictureTag(uploadsDir, prefix, file, { cls = '', alt = '', eager = false, sizes = '100vw' } = {}) {
  if (!file) return '';
  const base = path.basename(file, path.extname(file));
  const ext = path.extname(file);
  const has = (n) => fs.existsSync(path.join(uploadsDir, n));
  const srcset = (e) => {
    const parts = [];
    if (has(`${base}${e}`)) parts.push(`${prefix}assets/${base}${e} 1920w`);
    for (const s of [1280, 640]) if (has(`${base}-${s}${e}`)) parts.push(`${prefix}assets/${base}-${s}${e} ${s}w`);
    return parts.join(', ');
  };
  const webp = srcset('.webp');
  const jpg = srcset(ext);
  const load = eager ? 'fetchpriority="high"' : 'loading="lazy" decoding="async"';
  return `<picture>${webp ? `<source type="image/webp" srcset="${webp}" sizes="${sizes}">` : ''}
<img src="${prefix}assets/${esc(file)}"${jpg ? ` srcset="${jpg}" sizes="${sizes}"` : ''} data-full="${prefix}assets/${esc(file)}" alt="${esc(alt)}" ${load}${cls ? ` class="${cls}"` : ''}>
</picture>`;
}

// ── CSS (инлайн, system-ui — ноль внешних запросов за шрифтами) ──
const CSS = `
:root{--bg:#f6f5f2;--ink:#212326;--muted:#63666b;--bronze:#a8804c;--bronze-d:#8c6a3d;--dark:#1b1d1f;--line:rgba(27,29,31,.12);--r:16px;--ok:#2e7c39;--warn:#9a6a12;--off:#75787c}
*{box-sizing:border-box}html{scroll-behavior:smooth}
[hidden]{display:none!important}
body{margin:0;background:var(--bg);color:var(--ink);font:16px/1.55 system-ui,-apple-system,"Segoe UI",Roboto,Arial,sans-serif;-webkit-font-smoothing:antialiased}
img{max-width:100%;display:block}
h1,h2,h3{margin:0;font-weight:750;letter-spacing:-.015em;line-height:1.15}
a{color:var(--bronze-d)}
.wrap{max-width:1120px;margin:0 auto;padding:0 20px}
.btn{display:inline-flex;align-items:center;justify-content:center;gap:8px;padding:14px 26px;border:1px solid transparent;border-radius:12px;font:650 15px/1.2 system-ui,-apple-system,"Segoe UI",Roboto,Arial,sans-serif;text-decoration:none;cursor:pointer;transition:background .15s,border-color .15s,color .15s}
.btn.primary{background:var(--bronze);color:#fff}.btn.primary:hover{background:var(--bronze-d)}
.btn.dark{background:var(--dark);color:#fff}.btn.dark:hover{background:#33363a}
.btn.ghost{background:#fff;border-color:var(--line);color:var(--ink)}.btn.ghost:hover{border-color:var(--bronze)}
.btn.tg{background:#2aabee;color:#fff}.btn.tg:hover{background:#1e96d6}
section{padding:64px 0}
.lbl{display:inline-block;font:700 11px/1 system-ui;letter-spacing:.1em;text-transform:uppercase;color:var(--bronze-d);background:rgba(168,128,76,.12);padding:7px 12px;border-radius:999px;margin-bottom:16px}
.h2{font-size:clamp(26px,4vw,36px);margin-bottom:14px}
.sub{color:var(--muted);max-width:640px;margin:0 0 34px}
/* header */
header.top{position:fixed;inset:0 0 auto;z-index:50;transition:background .25s,box-shadow .25s}
header.top.scrolled{background:rgba(15,16,18,.93);-webkit-backdrop-filter:blur(10px);backdrop-filter:blur(10px);box-shadow:0 2px 26px rgba(0,0,0,.3)}
header.top.scrolled .top-in{padding-top:13px;padding-bottom:13px}
.top-in{transition:padding .25s}
.case-link{display:flex;align-items:center}
.case-link img{height:30px;width:auto;display:block}
@media(max-width:560px){.case-link{display:none}}
.top-in{display:flex;align-items:center;gap:26px;padding:22px 24px;max-width:1320px;margin:0 auto}
.brand{color:#fff;font:800 27px/1 system-ui;letter-spacing:.06em;text-decoration:none}
.brand small{display:block;font:600 12.5px/1.6 system-ui;letter-spacing:.16em;opacity:.8;text-transform:uppercase;white-space:nowrap}
.top nav{display:flex;gap:8px;margin-left:auto}
.top nav a{color:rgba(255,255,255,.9);text-decoration:none;font:650 18px/1 system-ui;padding:13px 18px;border-radius:11px;white-space:nowrap}
.top nav a:hover{background:rgba(255,255,255,.12);color:#fff}
.langs{display:flex;gap:2px;background:rgba(255,255,255,.14);border-radius:10px;padding:3px}
.langs a{color:rgba(255,255,255,.8);text-decoration:none;font:700 15px/1 system-ui;padding:10px 13px;border-radius:8px}
.langs a.on{background:#fff;color:var(--ink)}
.top-phone{color:#fff;text-decoration:none;font:750 18px/1 system-ui;white-space:nowrap}
/* hero */
.hero{position:relative;min-height:92svh;display:flex;align-items:flex-end;color:#fff;overflow:hidden}
.hero picture,.hero picture img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}
.hero::after{content:"";position:absolute;inset:0;background:linear-gradient(180deg,rgba(15,16,18,.5) 0%,rgba(15,16,18,.18) 40%,rgba(15,16,18,.78) 100%)}
.hero-in{position:relative;z-index:2;width:100%;max-width:1120px;margin:0 auto;padding:120px 20px 56px}
.hero h1{font-size:clamp(30px,5.4vw,54px);max-width:820px;text-wrap:balance}
.hero .tagline{margin:14px 0 22px;font:500 17px/1.5 system-ui;opacity:.92}
.intent{display:inline-flex;background:rgba(255,255,255,.16);backdrop-filter:blur(8px);border-radius:12px;padding:4px;margin-bottom:26px}
.intent button{border:0;background:none;color:rgba(255,255,255,.85);font:700 14px/1 system-ui;padding:11px 22px;border-radius:9px;cursor:pointer}
body[data-intent="lease"] .intent button[data-i="lease"],body[data-intent="buy"] .intent button[data-i="buy"]{background:#fff;color:var(--ink)}
.facts{display:flex;gap:34px;flex-wrap:wrap;margin:0 0 30px}
.facts div{border-left:2px solid rgba(255,255,255,.4);padding-left:14px}
.facts b{display:block;font:750 24px/1.15 system-ui}
.facts span{font:500 13.5px/1.35 system-ui;opacity:.85}
/* params strip */
.params{background:var(--dark);color:#fff;padding:34px 0}
.params .wrap{display:grid;grid-template-columns:repeat(5,1fr);gap:14px}
.params b{display:block;font:750 25px/1.1 system-ui;letter-spacing:-.01em}
.params span{font:500 12.5px/1.4 system-ui;opacity:.72}
/* units */
.units-note{color:var(--muted);font-size:14.5px;max-width:720px;margin:26px 0 0}
.lvl-picker{display:flex;gap:8px;flex-wrap:wrap;margin:0 0 22px}
.lvl-picker button{min-width:52px;padding:12px 16px;border:1.5px solid var(--line);background:#fff;border-radius:12px;font:750 16px/1 system-ui;color:var(--ink);cursor:pointer}
.lvl-picker button.on{border-color:var(--bronze);background:var(--bronze);color:#fff}
.lvl-picker button .st-dot{display:inline-block;width:8px;height:8px;border-radius:50%;margin-left:7px}
.units-grid{display:grid;grid-template-columns:360px 1fr;gap:26px;align-items:start}
.plan-card{background:#fff;border:1px solid var(--line);border-radius:var(--r);padding:18px}
.plan-card img{width:100%;height:auto}
.plan-meta{margin:12px 0 0;font:650 14.5px/1.4 system-ui,-apple-system,"Segoe UI",Roboto,Arial,sans-serif}
.plan-dl{margin-top:12px;padding:10px 16px;font-size:13.5px;width:100%}
.plan-cap{margin:8px 0 0;font-size:12px;color:var(--muted)}
.units-table-wrap{overflow-x:auto}
table.units{width:100%;border-collapse:collapse;background:#fff;border:1px solid var(--line);border-radius:var(--r);overflow:hidden}
table.units th{font:700 10.5px/1.3 system-ui;letter-spacing:.06em;text-transform:uppercase;color:var(--muted);text-align:left;padding:13px 10px 9px}
table.units td{padding:14px 10px;border-top:1px solid var(--line);font-size:14.5px;vertical-align:middle}
table.units td:first-child,table.units th:first-child{padding-left:16px}
table.units td:last-child,table.units th:last-child{padding-right:16px}
table.units tr{cursor:pointer}
table.units tr.on td{background:rgba(168,128,76,.07)}
table.units b.gla{font:750 16px/1 system-ui;white-space:nowrap}
.gla-note{display:block;font:500 12px/1.4 system-ui;color:var(--muted)}
.uses-cell{color:var(--muted);font-size:13px;max-width:210px}
.st{display:inline-flex;align-items:center;gap:7px;font:650 12.5px/1 system-ui;padding:7px 12px;border-radius:999px;white-space:nowrap}
.st::before{content:"";width:7px;height:7px;border-radius:50%;background:currentColor}
.st.available{background:#e6f4e7;color:var(--ok)}
.st.reserved{background:#fdf3da;color:var(--warn)}
.st.leased,.st.sold{background:#ececeb;color:var(--off)}
.unit-cta{white-space:nowrap;padding:9px 13px;font-size:12.5px}
tr.row-whole td{background:rgba(27,29,31,.035)}
body[data-intent="buy"] tr.row-whole td{background:rgba(168,128,76,.12)}
.cta-b{display:none}body[data-intent="buy"] .cta-b{display:inline}body[data-intent="buy"] .cta-l{display:none}
/* use cases */
.cases{display:grid;grid-template-columns:repeat(4,1fr);gap:14px}
.case{background:#fff;border:1px solid var(--line);border-radius:var(--r);padding:24px 22px}
.case svg{width:30px;height:30px;color:var(--bronze);margin-bottom:14px}
.case h3{font-size:18px;margin-bottom:4px}
.case .lvls{font:650 12.5px/1.4 system-ui;color:var(--bronze-d);margin-bottom:10px}
.case p{margin:0;font-size:13.5px;color:var(--muted)}
/* scenarios */
.scen{background:var(--dark);color:#fff}
.scen .h2{color:#fff}
.scen-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:14px;margin-top:36px}
.scen-col{background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.12);border-radius:var(--r);padding:26px 24px}
.scen-col h3{font-size:19px;margin-bottom:12px;color:#fff}
.scen-col p{margin:0;font-size:14px;line-height:1.65;color:rgba(255,255,255,.75)}
.scen-note{margin-top:22px;font:600 14px/1.4 system-ui;color:rgba(255,255,255,.6)}
/* about */
.about-grid{display:grid;grid-template-columns:5fr 7fr;gap:34px;align-items:start}
table.specs{width:100%;border-collapse:collapse;background:#fff;border:1px solid var(--line);border-radius:var(--r);overflow:hidden}
table.specs td{padding:13px 16px;border-top:1px solid var(--line);font-size:14.5px}
table.specs tr:first-child td{border-top:0}
table.specs td:first-child{font-weight:650;white-space:nowrap;width:1%;padding-right:26px}
table.specs td:last-child{color:var(--muted)}
.about-status{margin-top:16px;padding:14px 16px;background:rgba(168,128,76,.08);border-left:3px solid var(--bronze);border-radius:0 10px 10px 0;font-size:14px}
.sfb-note{margin-top:10px;font-size:12.5px;color:var(--muted)}
.gallery{display:grid;grid-template-columns:1fr 1fr;gap:12px}
.gallery figure{margin:0;position:relative;border-radius:var(--r);overflow:hidden}
.gallery figure:first-child{grid-column:1/-1}
.gallery img{width:100%;height:100%;object-fit:cover;aspect-ratio:16/9}
.gallery figcaption{position:absolute;right:10px;bottom:10px;background:rgba(15,16,18,.55);color:#fff;font:600 10.5px/1 system-ui;letter-spacing:.08em;text-transform:uppercase;padding:6px 10px;border-radius:7px}
.viz-all{margin-top:12px;font-size:12px;color:var(--muted)}
/* location */
.loc-grid{display:grid;grid-template-columns:7fr 5fr;gap:34px;align-items:start}
.mapbox{position:relative;border-radius:var(--r);overflow:hidden;background:#e8e4dd;min-height:380px;cursor:pointer}
.mapbox .pin{position:absolute;left:50%;top:44%;transform:translate(-50%,-100%);width:44px;height:56px}
.map-hint{position:absolute;left:50%;bottom:22px;transform:translateX(-50%);background:#fff;border-radius:10px;padding:11px 20px;font:650 13.5px/1 system-ui;box-shadow:0 6px 24px rgba(0,0,0,.14)}
.mapbox iframe,.mapbox .ymap{position:absolute;inset:0;width:100%;height:100%}
.map-grid-bg{position:absolute;inset:0;background-image:linear-gradient(rgba(27,29,31,.05) 1px,transparent 1px),linear-gradient(90deg,rgba(27,29,31,.05) 1px,transparent 1px);background-size:34px 34px}
.loc-addr{font:650 16px/1.5 system-ui;margin:0 0 6px}
.routes{display:flex;gap:10px;flex-wrap:wrap;margin:16px 0 26px}
table.drive{width:100%;border-collapse:collapse;font-size:14.5px}
table.drive td{padding:10px 0;border-bottom:1px solid var(--line)}
table.drive td:last-child{text-align:right;white-space:nowrap;font-weight:650}
.around{font-size:14px;color:var(--muted);margin:20px 0 0}
.metro-note{font-size:12.5px;color:var(--muted);margin:14px 0 0;opacity:.85}
/* faq */
.faq details{background:#fff;border:1px solid var(--line);border-radius:14px;margin-bottom:10px;overflow:hidden}
.faq summary{padding:18px 20px;font:650 15.5px/1.4 system-ui;cursor:pointer;list-style:none;position:relative;padding-right:48px}
.faq summary::after{content:"+";position:absolute;right:20px;top:50%;transform:translateY(-50%);font:400 22px/1 system-ui;color:var(--bronze)}
.faq details[open] summary::after{content:"–"}
.faq summary::-webkit-details-marker{display:none}
.faq .a{padding:0 20px 18px;font-size:14.5px;color:var(--muted)}
/* enquiry */
.enq{background:#fff;border-top:1px solid var(--line)}
.enq-grid{display:grid;grid-template-columns:6fr 5fr;gap:44px;align-items:start}
.enq form{display:grid;gap:14px}
.fg label{display:block;font:650 13px/1 system-ui;margin-bottom:7px}
.fg input,.fg select,.fg textarea{width:100%;padding:13px 14px;border:1.5px solid var(--line);border-radius:11px;font:500 15px/1.4 system-ui;background:var(--bg);color:var(--ink)}
.fg input:focus,.fg select:focus,.fg textarea:focus{outline:none;border-color:var(--bronze);background:#fff}
.f-row{display:grid;grid-template-columns:1fr 1fr;gap:14px}
.hp{position:absolute;left:-9999px;opacity:0;height:0;overflow:hidden}
.f-actions{display:flex;align-items:center;gap:16px;flex-wrap:wrap}
.resp-note{font:600 13.5px/1.4 system-ui;color:var(--muted)}
.f-msg{display:none;padding:13px 16px;border-radius:11px;font-size:14px}
.f-msg.ok{display:block;background:#e6f4e7;color:var(--ok)}
.f-msg.err{display:block;background:#fdeceb;color:#b23c2b}
.privacy{font-size:11.5px;color:var(--muted)}
.enq-side{background:var(--bg);border-radius:var(--r);padding:28px}
.enq-side .btn.tg{width:100%;margin:16px 0 10px}
.enq-side .call{display:block;text-align:center;font:750 21px/1.3 system-ui;color:var(--ink);text-decoration:none;margin-top:14px}
/* акцентные CTA: мягкая пульсация + пробегающий блик */
@keyframes ctaPulse{0%,100%{box-shadow:0 0 0 0 rgba(168,128,76,.45)}55%{box-shadow:0 0 0 11px rgba(168,128,76,0)}}
@keyframes ctaSheen{0%,55%{transform:translateX(-160%) skewX(-20deg)}90%,100%{transform:translateX(320%) skewX(-20deg)}}
a.btn.primary[href="#enquiry"]{position:relative;overflow:hidden;animation:ctaPulse 2.8s ease-out infinite}
a.btn.primary[href="#enquiry"]::after{content:"";position:absolute;left:0;top:0;bottom:0;width:34%;background:linear-gradient(105deg,transparent,rgba(255,255,255,.38),transparent);animation:ctaSheen 4.2s ease-in-out infinite;pointer-events:none}
@media(prefers-reduced-motion:reduce){a.btn.primary[href="#enquiry"]{animation:none}a.btn.primary[href="#enquiry"]::after{display:none}}
/* лайтбокс планировок и рендеров */
.plan-card img,.gallery img{cursor:zoom-in}
#lightbox{position:fixed;inset:0;z-index:90;background:rgba(15,16,18,.88);display:flex;align-items:center;justify-content:center;padding:26px;cursor:zoom-out}
#lightbox img{max-width:96%;max-height:92%;width:auto;height:auto;border-radius:10px;background:#fff}
#lightbox .lb-close{position:absolute;top:16px;right:20px;border:0;background:rgba(255,255,255,.14);color:#fff;font:400 26px/1 system-ui;width:44px;height:44px;border-radius:50%;cursor:pointer}
/* CTA по ходу страницы */
.sec-cta{margin-top:34px;text-align:center}
.scen .sec-cta{text-align:left}
/* sticky CTA */
.sticky-bar{position:fixed;left:0;right:0;bottom:0;z-index:40;background:#fff;border-top:1px solid var(--line);display:none;grid-template-columns:1fr 1fr 1.4fr;gap:8px;padding:10px 12px calc(10px + env(safe-area-inset-bottom))}
.sticky-bar.show{display:grid}
.sticky-bar .btn{padding:12px 8px;font-size:13.5px}
.sticky-desk{position:fixed;right:26px;bottom:26px;z-index:40;display:none;gap:10px}
.sticky-desk.show{display:flex}
footer{background:var(--dark);color:rgba(255,255,255,.7);padding:44px 0;font-size:13.5px}
footer .wrap{display:grid;gap:8px}
footer a{color:#fff}
@media(max-width:1140px){.top-phone{display:none}}
@media(max-width:920px){
  .top nav{display:none}
  .params .wrap{grid-template-columns:repeat(2,1fr);gap:20px 14px}
  .params .wrap div:nth-child(odd):last-child{grid-column:1/-1}
  .units-grid,.about-grid,.loc-grid,.enq-grid{grid-template-columns:1fr}
  .cases{grid-template-columns:1fr 1fr}
  .scen-grid{grid-template-columns:1fr}
  .hero{min-height:86svh}
  .facts{gap:20px}
  .sticky-desk{display:none!important}
}
@media(max-width:560px){
  .cases{grid-template-columns:1fr}
  .f-row{grid-template-columns:1fr}
  section{padding:48px 0}
  .top-phone{display:none}
}
/* мобильная таблица юнитов -> карточки, CTA всегда на виду */
.st-m{display:none}
@media(max-width:700px){
  table.units,table.units tbody,table.units tr,table.units td{display:block;width:100%}
  table.units thead{display:none}
  table.units{border:0;background:none}
  table.units tr{background:#fff;border:1px solid var(--line);border-radius:14px;margin-bottom:10px;padding:16px;cursor:default}
  table.units td{border:0;padding:0 0 8px}
  table.units td:first-child,table.units td:last-child{padding-left:0;padding-right:0}
  .td-lvl{display:flex!important;align-items:center;justify-content:space-between;gap:10px}
  .td-lvl b{font-size:17px}
  .st-m{display:inline-flex}
  .td-st{display:none!important}
  .td-gla{padding-bottom:4px}
  .gla-note{display:inline;margin-left:8px}
  .uses-cell{max-width:none;padding-bottom:12px}
  .unit-cta{width:100%;padding:12px;font-size:14px}
  tr.row-whole td{background:none}
  body[data-intent="buy"] tr.row-whole td{background:none}
  body[data-intent="buy"] tr.row-whole{border-color:var(--bronze)}
}
@media(min-width:921px){.sticky-bar{display:none!important}}
`;

// ── клиентский JS ──
function pageJs(cfg, lang) {
  const leadEndpoint = cfg.leadEndpoint || '';
  const analyticsEndpoint = leadEndpoint.replace('/api/lead/', '/api/e/');
  const mapsKey = (cfg.settings && cfg.settings.mapsApiKey || '').trim();
  const lat = Number(cfg.location.lat), lng = Number(cfg.location.lng);
  const ga4 = (cfg.settings && cfg.settings.ga4Id || '').trim();
  return `
(function(){
'use strict';
var LANG=${JSON.stringify(lang)};
var LEAD=${JSON.stringify(leadEndpoint)};
var EV_URL=${JSON.stringify(analyticsEndpoint)};
var MAPS_KEY=${JSON.stringify(mapsKey)};
var LAT=${lat},LNG=${lng};
var DNT=(navigator.doNotTrack=='1'||window.doNotTrack=='1');

/* ── intent (lease|buy): URL ?intent → localStorage → default lease ── */
function getIntent(){
  var q=new URLSearchParams(location.search).get('intent');
  if(q==='lease'||q==='buy')return q;
  try{var s=localStorage.getItem('tx_intent');if(s==='lease'||s==='buy')return s}catch(e){}
  return 'lease';
}
function setIntent(v,fire){
  document.body.setAttribute('data-intent',v);
  try{localStorage.setItem('tx_intent',v)}catch(e){}
  var u=new URL(location.href);u.searchParams.set('intent',v);history.replaceState(null,'',u);
  var sel=document.getElementById('f-intent');
  if(sel&&(sel.value==='lease'||sel.value==='buy'))sel.value=v;
  if(fire)ev('intent_switch',{intent:v});
}
setIntent(getIntent(),false);
document.querySelectorAll('.intent button').forEach(function(b){
  b.addEventListener('click',function(){setIntent(b.dataset.i,true)});
});

/* ── UTM: первое касание, живёт в localStorage ── */
var UTM=null;
try{
  UTM=JSON.parse(localStorage.getItem('tx_utm')||'null');
  if(!UTM){
    var p=new URLSearchParams(location.search),u={};
    ['utm_source','utm_medium','utm_campaign','utm_content','utm_term'].forEach(function(k){if(p.get(k))u[k]=p.get(k)});
    if(Object.keys(u).length){UTM=u;localStorage.setItem('tx_utm',JSON.stringify(u))}
  }
}catch(e){}

/* ── аналитика: батчи через sendBeacon; уважение DNT ── */
var Q=[],SID=null;
try{SID=localStorage.getItem('tx_sid');if(!SID){SID=Math.random().toString(36).slice(2)+Date.now().toString(36);localStorage.setItem('tx_sid',SID)}}catch(e){}
function flush(){
  if(DNT||!Q.length||!EV_URL)return;
  var body=JSON.stringify({sid:SID,lang:LANG,events:Q.splice(0,Q.length)});
  try{
    if(navigator.sendBeacon)navigator.sendBeacon(EV_URL,new Blob([body],{type:'application/json'}));
    else fetch(EV_URL,{method:'POST',headers:{'Content-Type':'application/json'},body:body,keepalive:true});
  }catch(e){}
}
function ev(name,data){
  if(DNT)return;
  Q.push(Object.assign({t:name,ts:Date.now(),intent:document.body.getAttribute('data-intent')},data||{}));
  if(Q.length>=10)flush();
  if(window.gtag)try{gtag('event',name,data||{})}catch(e){}
}
document.addEventListener('visibilitychange',function(){if(document.visibilityState==='hidden')flush()});
window.addEventListener('pagehide',flush);
ev('page_view',{url:location.pathname+location.search,ref:document.referrer||'',utm:UTM||undefined,
  dev:matchMedia('(max-width:920px)').matches?'mobile':'desktop',sw:screen.width});

/* ── шапка: подложка после начала прокрутки ── */
var topBar=document.querySelector('header.top');
function updTop(){if(topBar)topBar.classList.toggle('scrolled',(window.scrollY||0)>24)}
addEventListener('scroll',updTop,{passive:true});updTop();

/* ── глубина скролла 25/50/75/100 ── */
var marks=[25,50,75,100],seen={};
addEventListener('scroll',function(){
  var h=document.documentElement,d=(h.scrollTop+innerHeight)/h.scrollHeight*100;
  marks.forEach(function(m){if(d>=m&&!seen[m]){seen[m]=1;ev('scroll_depth',{depth:m})}});
},{passive:true});

/* ── клики по data-ev ── */
document.addEventListener('click',function(e){
  var el=e.target.closest('[data-ev]');
  if(el)ev(el.dataset.ev,el.dataset.evx?JSON.parse(el.dataset.evx):{});
});

/* ── юниты: выбор уровня, план, CTA ── */
var UNITS=window.__UNITS||[];
var CEIL_LBL=window.__CEIL_LBL||'';
function selectUnit(id,fire){
  UNITS.forEach(function(u){
    var row=document.getElementById('row-'+u.id),btn=document.getElementById('lvl-'+u.id),img=document.getElementById('plan-'+u.id);
    var on=u.id===id;
    if(row)row.classList.toggle('on',on);
    if(btn)btn.classList.toggle('on',on);
    if(img)img.hidden=!on;
    if(on){
      var meta=document.getElementById('plan-meta');
      if(meta)meta.textContent=u.label+' · GLA '+u.gla+' м²'+(u.ceil?' · '+CEIL_LBL+' '+u.ceil+' м':'');
      var dl=document.getElementById('plan-dl');
      if(dl){
        if(u.planUrl){dl.hidden=false;dl.href=u.planUrl;dl.setAttribute('download',u.planName||'');dl.dataset.unit=u.id}
        else dl.hidden=true;
      }
    }
  });
  if(fire){ev('unit_click',{unit:id});ev('plan_view',{unit:id})}
}
UNITS.forEach(function(u){
  var row=document.getElementById('row-'+u.id),btn=document.getElementById('lvl-'+u.id);
  if(btn)btn.addEventListener('click',function(){selectUnit(u.id,true)});
  if(row)row.addEventListener('click',function(e){if(!e.target.closest('a,button'))selectUnit(u.id,true)});
});
if(UNITS.length)selectUnit(UNITS[0].id,false);
document.querySelectorAll('.unit-cta').forEach(function(b){
  b.addEventListener('click',function(){
    var id=b.dataset.unit;
    var sel=document.getElementById('f-unit');if(sel)sel.value=id;
    ev('unit_request',{unit:id});
  });
});

/* ── лайтбокс: увеличение планировок и рендеров ── */
var lb=document.getElementById('lightbox');
if(lb){
  var lbImg=lb.querySelector('img');
  function lbOpen(src){lbImg.src=src;lb.hidden=false;document.body.style.overflow='hidden'}
  function lbClose(){lb.hidden=true;lbImg.src='';document.body.style.overflow=''}
  lb.addEventListener('click',lbClose);
  document.addEventListener('keydown',function(e){if(e.key==='Escape')lbClose()});
  document.querySelectorAll('.plan-card img,.gallery img').forEach(function(im){
    im.addEventListener('click',function(){lbOpen(im.dataset.full||im.currentSrc||im.src)});
  });
}

var dlBtn=document.getElementById('plan-dl');
if(dlBtn)dlBtn.addEventListener('click',function(){ev('plan_download',{unit:dlBtn.dataset.unit||''})});

/* ── карта: подгружается сама при приближении к блоку (LCP не страдает) ── */
var mapbox=document.getElementById('mapbox'),mapLoaded=false;
function loadMap(){
  if(mapLoaded||!mapbox)return;
  ev('map_open',{});
  if(!MAPS_KEY){
    /* без API-ключа: официальный встраиваемый виджет (Яндекс для RU/UZ, Google для EN) */
    mapLoaded=true;mapbox.style.cursor='default';
    var f=document.createElement('iframe');
    f.className='ymap';f.setAttribute('allowfullscreen','');f.setAttribute('frameborder','0');
    f.src=(LANG==='en')
      ? 'https://maps.google.com/maps?q='+LAT+','+LNG+'&z=16&hl=en&output=embed'
      : 'https://yandex.com/map-widget/v1/?ll='+LNG+'%2C'+LAT+'&z=16&pt='+LNG+'%2C'+LAT+'%2Cpm2rdm';
    mapbox.innerHTML='';mapbox.appendChild(f);
    return;
  }
  mapLoaded=true;mapbox.style.cursor='default';
  var s=document.createElement('script');
  s.src='https://api-maps.yandex.ru/2.1/?apikey='+encodeURIComponent(MAPS_KEY)+'&lang='+(LANG==='en'?'en_US':'ru_RU');
  s.onload=function(){
    ymaps.ready(function(){
      mapbox.innerHTML='<div class="ymap" id="ymap"></div>';
      var m=new ymaps.Map('ymap',{center:[LAT,LNG],zoom:16,controls:['zoomControl']});
      m.geoObjects.add(new ymaps.Placemark([LAT,LNG],
        {balloonContentHeader:document.title.split(' — ')[0],
         balloonContentBody:mapbox.dataset.addr+'<br><a href="https://yandex.com/maps/?rtext=~'+LAT+'%2C'+LNG+'" target="_blank">'+mapbox.dataset.route+'</a>'},
        {preset:'islands#brownDotIcon'}));
    });
  };
  document.head.appendChild(s);
}
if(mapbox){
  if('IntersectionObserver' in window){
    new IntersectionObserver(function(en,obs){
      if(en[0].isIntersecting){obs.disconnect();loadMap()}
    },{rootMargin:'600px'}).observe(mapbox);
  }
  mapbox.addEventListener('click',loadMap);
}

/* ── форма ── */
var form=document.getElementById('enq-form');
if(form){
  var started=false;
  form.addEventListener('focusin',function(){if(!started){started=true;ev('form_start',{})}});
  form.addEventListener('submit',function(e){
    e.preventDefault();
    var msgEl=document.getElementById('f-msgbox'),btn=document.getElementById('f-send');
    var phone=form.phone.value.replace(/[\\s()-]/g,'');
    if(!/^\\+?998\\d{9}$/.test(phone)){msgEl.className='f-msg err';msgEl.textContent=form.dataset.phoneErr;return}
    if(form.company&&form.company.value){msgEl.className='f-msg ok';msgEl.textContent=form.dataset.ok;form.reset();return}
    var unitSel=document.getElementById('f-unit'),intentSel=document.getElementById('f-intent');
    var unitId=unitSel?unitSel.value:'';
    var u=UNITS.filter(function(x){return x.id===unitId})[0];
    ev('form_submit',{unit:unitId||undefined});flush();
    btn.disabled=true;btn.textContent=form.dataset.sending;msgEl.className='f-msg';
    fetch(LEAD,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({
      name:form.name.value.trim(),phone:form.phone.value.trim(),email:'',
      interest:intentSel.options[intentSel.selectedIndex].dataset.ru||intentSel.value,
      lot:u?u.ru:'',message:form.message.value.trim(),lang:LANG,
      intent:intentSel.value,unit:unitId,utm:UTM||undefined,page:location.pathname
    })}).then(function(r){
      if(!r.ok)throw 0;
      msgEl.className='f-msg ok';msgEl.textContent=form.dataset.ok;
      form.reset();ev('form_success',{});flush();
    }).catch(function(){
      msgEl.className='f-msg err';msgEl.textContent=form.dataset.err;ev('form_error',{});
    }).finally(function(){btn.disabled=false;btn.textContent=form.dataset.send});
  });
}

/* ── sticky CTA после героя ── */
var hero=document.querySelector('.hero'),bar=document.getElementById('sticky-bar'),desk=document.getElementById('sticky-desk');
if(hero&&'IntersectionObserver' in window){
  new IntersectionObserver(function(en){
    var out=!en[0].isIntersecting;
    if(bar)bar.classList.toggle('show',out);
    if(desk)desk.classList.toggle('show',out);
  },{threshold:0}).observe(hero);
}

/* ── FAQ ── */
document.querySelectorAll('.faq details').forEach(function(d,i){
  d.addEventListener('toggle',function(){if(d.open)ev('faq_open',{q:i})});
});
})();`;
}

// ── JSON-LD ──
function jsonLd(cfg, lang, canonical, base) {
  const s = (k) => STR[k][lang];
  const statusMap = {
    available: 'https://schema.org/InStock',
    reserved: 'https://schema.org/LimitedAvailability',
    leased: 'https://schema.org/OutOfStock',
    sold: 'https://schema.org/SoldOut'
  };
  const addr = {
    '@type': 'PostalAddress',
    streetAddress: "Taxtapul ko'chasi 31",
    addressLocality: 'Toshkent',
    addressRegion: 'Shayxontohur',
    addressCountry: 'UZ'
  };
  const geo = { '@type': 'GeoCoordinates', latitude: Number(cfg.location.lat) || 41.338889, longitude: Number(cfg.location.lng) || 69.263403 };
  const org = {
    '@context': 'https://schema.org', '@type': 'Organization',
    name: 'CASE Advisory',
    url: 'https://caseadvisory.uz',
    telephone: String(cfg.contacts.phone || '').replace(/\s/g, ''),
    sameAs: cfg.contacts.telegram ? ['https://t.me/' + cfg.contacts.telegram] : undefined
  };
  const listing = {
    '@context': 'https://schema.org', '@type': 'RealEstateListing',
    name: pick(cfg.intro.h1, lang),
    url: canonical,
    description: pick(cfg.seo.description, lang),
    address: addr, geo,
    offers: (cfg.units || []).map((u) => ({
      '@type': 'Offer',
      name: pick(u.level, lang),
      availability: statusMap[u.status] || statusMap.available,
      businessFunction: ['http://purl.org/goodrelations/v1#LeaseOut', 'http://purl.org/goodrelations/v1#Sell'],
      itemOffered: {
        '@type': 'Accommodation',
        name: pick(u.level, lang),
        floorSize: { '@type': 'QuantitativeValue', value: String(u.gla).replace(/\s/g, '').replace(',', '.'), unitCode: 'MTK' }
      }
    }))
  };
  const crumbs = {
    '@context': 'https://schema.org', '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'CASE Advisory', item: 'https://caseadvisory.uz' },
      { '@type': 'ListItem', position: 2, name: 'Taxtapul 31', item: base + '/' }
    ]
  };
  const faq = (cfg.faq || []).length ? {
    '@context': 'https://schema.org', '@type': 'FAQPage',
    mainEntity: cfg.faq.map((f) => ({
      '@type': 'Question', name: pick(f.q, lang),
      acceptedAnswer: { '@type': 'Answer', text: pick(f.a, lang).replace(/<[^>]+>/g, '') }
    }))
  } : null;
  return [org, listing, crumbs, faq].filter(Boolean)
    .map((o) => `<script type="application/ld+json">${JSON.stringify(o)}</script>`).join('\n');
}

// ── страница одного языка ──
function renderPage(cfg, lang, uploadsDir) {
  const s = (k) => STR[k][lang];
  const t = (v) => esc(pick(v, lang));
  const base = String(cfg.seo.publicUrl || '').replace(/\/+$/, '');
  const prefix = lang === 'ru' ? '' : '../';
  const langPath = { ru: '', uz: 'uz/', en: 'en/' };
  const canonical = `${base}/${langPath[lang]}`;
  const phone = cfg.contacts.phone || '';
  const tg = String(cfg.contacts.telegram || '').replace(/^@/, '');
  const tgHref = tg ? `https://t.me/${tg}` : '';
  const mapsKey = (cfg.settings && cfg.settings.mapsApiKey || '').trim();
  const lat = Number(cfg.location.lat) || 41.338889;
  const lng = Number(cfg.location.lng) || 69.263403;

  const caseLogo = ['case-logo.svg', 'case-logo.png', 'case-logo.webp']
    .find((f) => fs.existsSync(path.join(uploadsDir, f)));
  const ogFile = fs.existsSync(path.join(uploadsDir, 'og-cover.jpg')) ? 'og-cover.jpg' : cfg.intro.image;
  const ogImg = ogFile ? `${base}/assets/${ogFile}` : '';

  // preload hero (webp приоритетно)
  const heroBase = path.basename(cfg.intro.image || '', path.extname(cfg.intro.image || ''));
  const heroWebp = fs.existsSync(path.join(uploadsDir, heroBase + '.webp'));
  const heroPreload = cfg.intro.image
    ? `<link rel="preload" as="image" ${heroWebp
      ? `href="${prefix}assets/${heroBase}.webp" imagesrcset="${prefix}assets/${heroBase}.webp 1920w${fs.existsSync(path.join(uploadsDir, heroBase + '-1280.webp')) ? `, ${prefix}assets/${heroBase}-1280.webp 1280w` : ''}${fs.existsSync(path.join(uploadsDir, heroBase + '-640.webp')) ? `, ${prefix}assets/${heroBase}-640.webp 640w` : ''}" imagesizes="100vw" type="image/webp"`
      : `href="${prefix}assets/${esc(cfg.intro.image)}"`} fetchpriority="high">`
    : '';

  // счётчики: Метрика (webvisor+clickmap), GA4, GTM — только если ID заданы
  const metrica = (cfg.settings.metricaId || '').trim();
  const ga4 = (cfg.settings.ga4Id || '').trim();
  const gtm = (cfg.settings.gtmId || '').trim();
  const counters = [
    gtm ? `<script>(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src='https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);})(window,document,'script','dataLayer','${esc(gtm)}');</script>` : '',
    ga4 && !gtm ? `<script async src="https://www.googletagmanager.com/gtag/js?id=${esc(ga4)}"></script><script>window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments)}gtag('js',new Date());gtag('config','${esc(ga4)}');</script>` : '',
    metrica ? `<script>(function(m,e,t,r,i,k,a){m[i]=m[i]||function(){(m[i].a=m[i].a||[]).push(arguments)};m[i].l=1*new Date();k=e.createElement(t),a=e.getElementsByTagName(t)[0],k.async=1,k.src=r,a.parentNode.insertBefore(k,a)})(window,document,"script","https://mc.yandex.ru/metrika/tag.js","ym");ym(${esc(metrica)},"init",{clickmap:true,trackLinks:true,accurateTrackBounce:true,webvisor:true});</script><noscript><img src="https://mc.yandex.ru/watch/${esc(metrica)}" style="position:absolute;left:-9999px" alt=""></noscript>` : ''
  ].filter(Boolean).join('\n');

  // статусные лейблы для юнитов
  const stLabel = (st) => s('st.' + (st || 'available')) || s('st.available');

  // ── экран 3: таблица юнитов ──
  const unitsRows = (cfg.units || []).map((u) => {
    const canRequest = u.status === 'available' || u.status === 'reserved';
    const cta = canRequest
      ? `<a href="#enquiry" class="btn primary unit-cta" data-unit="${esc(u.id)}"><span class="cta-l">${s('units.cta')}</span><span class="cta-b">${s('units.cta.buy')}</span></a>`
      : '<span class="muted">—</span>';
    return `<tr id="row-${esc(u.id)}"${u.whole ? ' class="row-whole"' : ''}>
      <td class="td-lvl"><b>${t(u.level)}</b><span class="st-m st ${esc(u.status || 'available')}">${stLabel(u.status)}</span></td>
      <td class="td-gla"><b class="gla">${esc(u.gla)} м²</b>${u.glaNote ? `<span class="gla-note">${esc(u.glaNote)}</span>` : ''}${u.ceil ? `<span class="gla-note">${s('units.ceil')} ${esc(u.ceil)} м</span>` : ''}</td>
      <td class="uses-cell">${t(u.uses)}</td>
      <td class="td-st"><span class="st ${esc(u.status || 'available')}">${stLabel(u.status)}</span></td>
      <td class="td-cta">${cta}</td>
    </tr>`;
  }).join('\n');

  const lvlButtons = (cfg.units || []).filter((u) => !u.whole).map((u) =>
    `<button type="button" id="lvl-${esc(u.id)}" aria-label="${t(u.level)}">${esc(u.lvlShort)}</button>`
  ).join('');

  const planImgs = (cfg.units || []).filter((u) => u.plan).map((u) =>
    `<img id="plan-${esc(u.id)}" src="${prefix}assets/${esc(u.plan)}" alt="${t(u.level)} — ${esc(u.gla)} м²" loading="lazy" decoding="async" hidden>`
  ).join('\n');

  const unitsJson = JSON.stringify((cfg.units || []).map((u) => ({
    id: u.id, ru: pick(u.level, 'ru'),
    label: pick(u.level, lang), gla: u.gla || '', ceil: u.ceil || '',
    planUrl: u.plan ? prefix + 'assets/' + u.plan : '',
    planName: u.plan ? 'Taxtapul-' + u.id + u.plan.slice(u.plan.lastIndexOf('.')) : ''
  })));
  const ceilLabel = s('units.ceil');

  // ── экран 4 ──
  const cases = (cfg.useCases.cards || []).map((c) => `
    <div class="case">${icon(c.icon)}
      <h3>${t(c.h)}</h3>
      <div class="lvls">${t(c.levels)}</div>
      <p>${t(c.p)}</p>
    </div>`).join('');

  // ── экран 5 ──
  const scenCols = (cfg.scenarios.cols || []).map((c) => `
    <div class="scen-col"><h3>${t(c.h)}</h3><p>${t(c.p)}</p></div>`).join('');

  // ── экран 6 ──
  const specRows = (cfg.about.specs || []).filter((r) => pick(r.s, lang).trim()).map((r) =>
    `<tr><td>${t(r.b)}</td><td>${t(r.s)}</td></tr>`).join('\n');
  const gallery = (cfg.about.images || []).filter((g) => g.file).map((g) => `
    <figure>${pictureTag(uploadsDir, prefix, g.file, { alt: t(cfg.intro.h1), sizes: '(max-width:920px) 100vw, 640px' })}
      <figcaption>${s('about.viz')}</figcaption>
    </figure>`).join('');

  // ── экран 7 ──
  const driveRows = (cfg.location.drive || []).map((d) =>
    `<tr><td>${t(d.to)}</td><td>${t(d.time)}</td></tr>`).join('\n');
  const yaRoute = `https://yandex.com/maps/?rtext=~${lat}%2C${lng}`;
  const gRoute = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;

  // ── экран 8 ──
  const faqItems = (cfg.faq || []).map((f) => `
    <details><summary>${t(f.q)}</summary><div class="a">${pick(f.a, lang)}</div></details>`).join('');

  // ── экран 9: селекты формы ──
  const intentOpts = [
    `<option value="lease" data-ru="${esc(STR['intent.lease'].ru)}">${s('intent.lease')}</option>`,
    `<option value="buy" data-ru="${esc(STR['intent.buy'].ru)}">${s('intent.buy')}</option>`,
    `<option value="lease_to_own" data-ru="${esc(STR['form.intent.both'].ru)}">${s('form.intent.both')}</option>`
  ].join('');
  const unitOpts = [`<option value="">${s('form.unit.none')}</option>`]
    .concat((cfg.units || []).map((u) => `<option value="${esc(u.id)}">${t(u.level)} · ${esc(u.gla)} м²</option>`)).join('');

  const hreflangs = LANGS.map((l) =>
    `<link rel="alternate" hreflang="${l === 'uz' ? 'uz-Latn' : l}" href="${base}/${langPath[l]}">`).join('\n') +
    `\n<link rel="alternate" hreflang="x-default" href="${base}/">`;

  const langSwitch = LANGS.map((l) =>
    `<a href="${base}/${langPath[l]}"${l === lang ? ' class="on"' : ''} data-ev="language_switch" data-evx='{"to":"${l}"}'>${l.toUpperCase()}</a>`).join('');

  const html = `<!DOCTYPE html>
<html lang="${lang === 'uz' ? 'uz-Latn' : lang}">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${t(cfg.seo.title)}</title>
<meta name="description" content="${t(cfg.seo.description)}">
<meta name="robots" content="index, follow">
${(cfg.seo.googleVerification || '').trim() ? `<meta name="google-site-verification" content="${esc(cfg.seo.googleVerification.trim())}">` : ''}
${(cfg.seo.yandexVerification || '').trim() ? `<meta name="yandex-verification" content="${esc(cfg.seo.yandexVerification.trim())}">` : ''}
<link rel="canonical" href="${canonical}">
${hreflangs}
<meta name="geo.position" content="${lat};${lng}">
<meta name="ICBM" content="${lat}, ${lng}">
<meta name="geo.region" content="UZ-TK">
<meta name="geo.placename" content="Tashkent">
<meta property="og:url" content="${canonical}">
<meta property="og:title" content="${t(cfg.seo.title)}">
<meta property="og:description" content="${t(cfg.seo.description)}">
${ogImg ? `<meta property="og:image" content="${esc(ogImg)}">` : ''}
<meta property="og:type" content="website">
<meta property="og:locale" content="${OG_LOCALE[lang]}">
${LANGS.filter((l) => l !== lang).map((l) => `<meta property="og:locale:alternate" content="${OG_LOCALE[l]}">`).join('\n')}
<meta property="og:site_name" content="Taxtapul 31">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${t(cfg.seo.title)}">
${ogImg ? `<meta name="twitter:image" content="${esc(ogImg)}">` : ''}
<link rel="icon" href="data:image/svg+xml,${encodeURIComponent(`<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'><rect width='32' height='32' rx='7' fill='%23a8804c'/><text x='16' y='21.5' text-anchor='middle' font-family='system-ui' font-weight='800' font-size='14' fill='white'>T</text></svg>`).replace(/%23/g, '%23')}">
${heroPreload}
${jsonLd(cfg, lang, canonical, base)}
${counters}
<style>${CSS}</style>
</head>
<body data-intent="lease">

<header class="top">
  <div class="top-in">
    <a class="brand" href="${canonical}">TAXTAPUL<small>${lang === 'en' ? '31 Taxtapul St · Tashkent' : lang === 'uz' ? "Taxtapul ko'chasi 31 · Toshkent" : 'Тахтапул, 31 · Ташкент'}</small></a>
    <nav>
      <a href="#units">${s('nav.units')}</a>
      <a href="#about">${s('nav.about')}</a>
      <a href="#location">${s('nav.location')}</a>
      <a href="#faq">${s('nav.faq')}</a>
    </nav>
    <div class="langs">${langSwitch}</div>
    <a class="top-phone" href="${telHref(phone)}" data-ev="phone_click" data-evx='{"where":"header"}'>${esc(phone)}</a>
    ${caseLogo ? `<a class="case-link" href="https://caseadvisory.uz" target="_blank" rel="noopener" title="CASE Real Estate Advisory" data-ev="cta_click" data-evx='{"cta":"case_logo"}'><img src="${prefix}assets/${caseLogo}" alt="CASE Real Estate Advisory"></a>` : ''}
  </div>
</header>

<!-- экран 1: hero -->
<div class="hero">
  ${pictureTag(uploadsDir, prefix, cfg.intro.image, { alt: t(cfg.intro.h1), eager: true })}
  <div class="hero-in">
    <h1>${t(cfg.intro.h1)}</h1>
    <p class="tagline">${t(cfg.intro.sub)}</p>
    <div class="intent" role="tablist">
      <button type="button" data-i="lease">${s('intent.lease')}</button>
      <button type="button" data-i="buy">${s('intent.buy')}</button>
    </div>
    <div class="facts">
      ${(cfg.intro.facts || []).map((f) => `<div>${f.n ? `<b>${esc(f.n)}</b>` : ''}<span>${t(f.l)}</span></div>`).join('\n')}
    </div>
    <a class="btn primary" href="#units" data-ev="cta_click" data-evx='{"cta":"hero"}'>${s('hero.cta')}</a>
  </div>
</div>

<!-- экран 2: ключевые параметры -->
<div class="params">
  <div class="wrap">
    ${(cfg.params || []).map((p) => `<div>${p.n ? `<b>${esc(pick(p.n, lang))}</b>` : `<b>${t(p.l)}</b>`}<span>${p.n ? t(p.l) : ''}</span></div>`).join('\n')}
  </div>
</div>

<!-- экран 3: юниты -->
<section id="units">
  <div class="wrap">
    <span class="lbl">${s('nav.units')}</span>
    <h2 class="h2">${t(cfg.unitsSection.h2)}</h2>
    <div class="lvl-picker">${lvlButtons}</div>
    <div class="units-grid">
      <div class="plan-card">
        ${planImgs}
        <p class="plan-meta" id="plan-meta"></p>
        <a id="plan-dl" class="btn ghost plan-dl" download hidden>${s('units.download')}</a>
        <p class="plan-cap">${s('units.plan.caption')}</p>
      </div>
      <div class="units-table-wrap">
        <table class="units">
          <thead><tr>
            <th>${s('units.th.level')}</th><th>${s('units.th.gla')}</th>
            <th>${s('units.th.uses')}</th><th>${s('units.th.status')}</th><th></th>
          </tr></thead>
          <tbody>${unitsRows}</tbody>
        </table>
      </div>
    </div>
    <p class="units-note">${t(cfg.unitsSection.note)}</p>
  </div>
</section>

<!-- экран 4: сценарии использования -->
<section style="padding-top:0">
  <div class="wrap">
    <h2 class="h2">${t(cfg.useCases.h2)}</h2>
    <div class="cases">${cases}</div>
    <div class="sec-cta"><a class="btn ghost" href="#enquiry" data-ev="cta_click" data-evx='{"cta":"usecases"}'>${s('cta.more')}</a></div>
  </div>
</section>

<!-- экран 5: форматы сделки -->
<section class="scen">
  <div class="wrap">
    <h2 class="h2">${t(cfg.scenarios.h2)}</h2>
    <div class="scen-grid">${scenCols}</div>
    <p class="scen-note">${s('scen.note')}</p>
    <div class="sec-cta"><a class="btn primary" href="#enquiry" data-ev="cta_click" data-evx='{"cta":"scenarios"}'>${s('cta.request')}</a></div>
  </div>
</section>

<!-- экран 6: о здании -->
<section id="about">
  <div class="wrap">
    <span class="lbl">${s('nav.about')}</span>
    <h2 class="h2">${t(cfg.about.h2)}</h2>
    <div class="about-grid">
      <div>
        <table class="specs">${specRows}</table>
        <div class="about-status">${t(cfg.about.status)}</div>
        <p class="sfb-note">${t(cfg.about.sfbNote)}</p>
      </div>
      <div>
        <div class="gallery">${gallery}</div>
        <p class="viz-all">${s('about.vizAll')}</p>
      </div>
    </div>
    <div class="sec-cta"><a class="btn ghost" href="#enquiry" data-ev="cta_click" data-evx='{"cta":"about"}'>${s('cta.more')}</a></div>
  </div>
</section>

<!-- экран 7: локация -->
<section id="location" style="padding-top:0">
  <div class="wrap">
    <span class="lbl">${s('loc.h2')}</span>
    <h2 class="h2">${t(cfg.location.h2)}</h2>
    <div class="loc-grid">
      <div id="mapbox" class="mapbox" data-addr="${t(cfg.location.address)}" data-route="${s('loc.route.ya')}">
        <div class="map-grid-bg"></div>
        <svg class="pin" viewBox="0 0 44 56" fill="none"><path d="M22 0C9.85 0 0 9.85 0 22c0 15.4 22 34 22 34s22-18.6 22-34C44 9.85 34.15 0 22 0z" fill="#a8804c"/><circle cx="22" cy="21" r="8.5" fill="#fff"/></svg>
      </div>
      <div>
        <p class="loc-addr">${t(cfg.location.address)}</p>
        <div class="routes">
          <a class="btn ghost" target="_blank" rel="noopener" href="${yaRoute}" data-ev="route_click" data-evx='{"svc":"yandex"}'>${s('loc.route.ya')}</a>
          <a class="btn ghost" target="_blank" rel="noopener" href="${gRoute}" data-ev="route_click" data-evx='{"svc":"google"}'>${s('loc.route.g')}</a>
        </div>
        <table class="drive"><caption style="text-align:left;font:700 11px/1 system-ui;letter-spacing:.07em;text-transform:uppercase;color:var(--muted);padding-bottom:10px">${s('loc.drive')}</caption>${driveRows}</table>
        <p class="around">${t(cfg.location.around)}</p>
        <p class="metro-note">${t(cfg.location.metroNote)}</p>
        <div class="sec-cta" style="text-align:left"><a class="btn primary" href="#enquiry" data-ev="cta_click" data-evx='{"cta":"location"}'>${s('cta.request')}</a></div>
      </div>
    </div>
  </div>
</section>

<!-- экран 8: FAQ -->
<section id="faq" style="padding-top:0">
  <div class="wrap">
    <h2 class="h2">${s('faq.h2')}</h2>
    <div class="faq">${faqItems}</div>
    <div class="sec-cta"><a class="btn primary" href="#enquiry" data-ev="cta_click" data-evx='{"cta":"faq"}'>${s('cta.request')}</a></div>
  </div>
</section>

<!-- экран 9: заявка -->
<section class="enq" id="enquiry">
  <div class="wrap">
    <div class="enq-grid">
      <div>
        <h2 class="h2">${s('form.h2')}</h2>
        <p class="sub">${t(cfg.lead && cfg.lead.sub)}</p>
        <form id="enq-form" novalidate
          data-ok="${s('form.ok')}" data-err="${s('form.err')}" data-sending="${s('form.sending')}"
          data-send="${s('form.send')}" data-phone-err="${s('form.phoneErr')}">
          <div class="f-row">
            <div class="fg"><label for="f-name">${s('form.name')} *</label><input id="f-name" name="name" type="text" required autocomplete="name"></div>
            <div class="fg"><label for="f-phone">${s('form.phone')} *</label><input id="f-phone" name="phone" type="tel" required autocomplete="tel" placeholder="+998"></div>
          </div>
          <div class="f-row">
            <div class="fg"><label for="f-intent">${s('form.intent')}</label><select id="f-intent" name="intent">${intentOpts}</select></div>
            <div class="fg"><label for="f-unit">${s('form.unit')}</label><select id="f-unit" name="unit">${unitOpts}</select></div>
          </div>
          <div class="fg"><label for="f-message">${s('form.msg')}</label><textarea id="f-message" name="message" rows="3"></textarea></div>
          <div class="hp" aria-hidden="true"><label>Company<input name="company" type="text" tabindex="-1" autocomplete="off"></label></div>
          <div id="f-msgbox" class="f-msg"></div>
          <div class="f-actions">
            <button id="f-send" type="submit" class="btn dark">${s('form.send')}</button>
            <span class="resp-note">${t(cfg.enquiry.note)}</span>
          </div>
          <p class="privacy">${s('form.privacy')}</p>
        </form>
      </div>
      <div class="enq-side">
        <h3>${lang === 'en' ? 'Faster by phone or Telegram' : lang === 'uz' ? 'Telefon yoki Telegram orqali tezroq' : 'Быстрее — по телефону или в Telegram'}</h3>
        ${tgHref ? `<a class="btn tg" href="${tgHref}" target="_blank" rel="noopener" data-ev="telegram_click" data-evx='{"where":"form"}'>${s('form.tg')}</a>` : ''}
        <a class="call" href="${telHref(phone)}" data-ev="phone_click" data-evx='{"where":"form"}'>${esc(phone)}</a>
      </div>
    </div>
  </div>
</section>

<!-- sticky CTA -->
<div class="sticky-bar" id="sticky-bar">
  <a class="btn ghost" href="${telHref(phone)}" data-ev="phone_click" data-evx='{"where":"sticky"}'>${s('sticky.call')}</a>
  ${tgHref ? `<a class="btn tg" href="${tgHref}" target="_blank" rel="noopener" data-ev="telegram_click" data-evx='{"where":"sticky"}'>Telegram</a>` : ''}
  <a class="btn primary" href="#enquiry" data-ev="cta_click" data-evx='{"cta":"sticky"}'>${s('sticky.form')}</a>
</div>
<div class="sticky-desk" id="sticky-desk">
  <a class="btn ghost" href="${telHref(phone)}" data-ev="phone_click" data-evx='{"where":"sticky"}'>${esc(phone)}</a>
  <a class="btn primary" href="#enquiry" data-ev="cta_click" data-evx='{"cta":"sticky"}'>${s('sticky.form')}</a>
</div>

<footer>
  <div class="wrap" itemscope itemtype="https://schema.org/LocalBusiness">
    <b itemprop="name" style="color:#fff">Taxtapul 31 · CASE Advisory</b>
    <span itemprop="address" itemscope itemtype="https://schema.org/PostalAddress">
      <span itemprop="streetAddress">${lang === 'ru' ? 'ул. Тахтапул, 31' : "Taxtapul ko'chasi 31"}</span>,
      <span itemprop="addressLocality">${lang === 'ru' ? 'Ташкент' : 'Toshkent'}</span>
      (<span itemprop="addressRegion">${lang === 'ru' ? 'Шайхантахурский район' : 'Shayxontohur'}</span>)
    </span>
    <a href="${telHref(phone)}" itemprop="telephone" data-ev="phone_click" data-evx='{"where":"footer"}'>${esc(phone)}</a>
    <span>${t(cfg.footer.legal)}</span>
    <span>${s('about.vizAll')}</span>
  </div>
</footer>

<div id="lightbox" hidden><button type="button" class="lb-close" aria-label="close">×</button><img alt=""></div>

<script>window.__UNITS=${unitsJson};window.__CEIL_LBL=${JSON.stringify(ceilLabel)};</script>
<script>${pageJs(cfg, lang)}</script>
</body>
</html>`;

  // типографика проекта: длинные тире заменяются на короткие
  return html.replace(/\u2014/g, '-');
}

function renderLanding2(cfg, { uploadsDir }) {
  const base = String(cfg.seo.publicUrl || '').replace(/\/+$/, '');
  const pages = {
    'index.html': renderPage(cfg, 'ru', uploadsDir),
    'uz/index.html': renderPage(cfg, 'uz', uploadsDir),
    'en/index.html': renderPage(cfg, 'en', uploadsDir)
  };

  // sitemap: 3 языковых URL с xhtml-альтернативами
  const langPath = { ru: '', uz: 'uz/', en: 'en/' };
  const alt = LANGS.map((l) =>
    `    <xhtml:link rel="alternate" hreflang="${l === 'uz' ? 'uz-Latn' : l}" href="${base}/${langPath[l]}"/>`
  ).join('\n') + `\n    <xhtml:link rel="alternate" hreflang="x-default" href="${base}/"/>`;
  const sitemap = base
    ? `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">
${LANGS.map((l) => `  <url>
    <loc>${base}/${langPath[l]}</loc>
${alt}
    <changefreq>weekly</changefreq><priority>${l === 'ru' ? '1.0' : '0.8'}</priority>
  </url>`).join('\n')}
</urlset>
`
    : null;

  // список файлов для assets/: hero, галерея, планы, og + все варианты
  const { listVariantFiles } = require('./images');
  const images = new Set();
  const add = (f) => {
    if (!f) return;
    images.add(f);
    for (const v of listVariantFiles(path.join(uploadsDir, f))) images.add(v);
  };
  add(cfg.intro.image);
  add('og-cover.jpg');
  for (const f of ['case-logo.svg', 'case-logo.png', 'case-logo.webp']) {
    if (fs.existsSync(path.join(uploadsDir, f))) images.add(f);
  }
  for (const g of cfg.about.images || []) add(g.file);
  for (const u of cfg.units || []) if (u.plan) images.add(u.plan);

  return { pages, images: [...images].filter((f) => fs.existsSync(path.join(uploadsDir, f))), sitemap };
}

module.exports = { renderLanding2 };
