/**
 * Генератор лендинга из конфига проекта (см. lib/blank.js — схема).
 *
 * Принцип многоязычности: русский текст — базовый, зашит в разметку.
 * Узбекский/английский собираются в словарь I18N на странице:
 *   - служебные строки интерфейса (кнопки, форма, подписи) — дефолты в UI_DEFAULTS,
 *     каждую можно переопределить в панели (cfg.texts);
 *   - контентные строки — из конфига, ключи с префиксом "c."; если перевода нет,
 *     на странице остаётся русский (фолбэк на клиенте).
 *
 * renderLanding(config) -> { html, images: [имена файлов из uploads, которые нужно скопировать в assets/] }
 */
'use strict';

const LANGS = ['uz', 'en'];

function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
function escAttr(s) { return esc(s); }
// поля, где разрешён простой HTML (<b>, <strong>, <a>, <br>)
function rich(s) { return String(s == null ? '' : s); }

function L(v) { // русское значение мультиязычного поля
  if (v == null) return '';
  if (typeof v === 'string') return v;
  return v.ru || '';
}
function Lx(v, lang) { // перевод или null
  if (v == null || typeof v === 'string') return null;
  const t = v[lang];
  return (t && t.trim() && t.trim() !== (v.ru || '').trim()) ? t : null;
}

// ─── строки интерфейса: дефолты на 3 языках; каждую можно переопределить
//     в панели (вкладка «Кнопки и тексты» → cfg.texts.<ключ>) ───
const UI_DEFAULTS = {
  'nav.uses': { ru: 'Назначение', uz: "Yo'nalishlar", en: 'Use cases' },
  'nav.lots': { ru: 'Помещения', uz: 'Maydonlar', en: 'Premises' },
  'nav.building': { ru: 'О здании', uz: 'Bino haqida', en: 'The building' },
  'nav.location': { ru: 'Локация', uz: 'Manzil', en: 'Location' },
  'nav.faq': { ru: 'Вопросы', uz: 'Savollar', en: 'FAQ' },
  'nav.cta': { ru: 'Оставить заявку', uz: 'Ariza qoldirish', en: 'Request info' },
  'nav.login': { ru: 'Войти', uz: 'Kirish', en: 'Log in' },
  'hero.btn1': { ru: 'Получить планировки и цены', uz: 'Rejalar va narxlarni olish', en: 'Get floor plans & pricing' },
  'hero.btn2': { ru: 'Смотреть помещения', uz: "Maydonlarni ko'rish", en: 'View the premises' },
  'uses.lbl': { ru: 'Свободное назначение', uz: 'Erkin maqsad', en: 'Flexible use' },
  'lots.lbl': { ru: 'Свободные лоты', uz: "Bo'sh lotlar", en: 'Available units' },
  'bld.lbl': { ru: 'О здании', uz: 'Bino haqida', en: 'The building' },
  'inv.lbl': { ru: 'Инвесторам', uz: 'Investorlarga', en: 'For investors' },
  'prog.lbl': { ru: 'Ход строительства', uz: 'Qurilish jarayoni', en: 'Construction progress' },
  'loc.lbl': { ru: 'Локация', uz: 'Manzil', en: 'Location' },
  'lead.lbl': { ru: 'Заявка', uz: 'Ariza', en: 'Request' },
  'faq.lbl': { ru: 'Частые вопросы', uz: "Ko'p beriladigan savollar", en: 'FAQ' },
  'faq.h2': { ru: 'Коротко о главном', uz: 'Asosiysi haqida qisqacha', en: 'The essentials, briefly' },
  'lots.cta': { ru: 'Запросить актуальные условия', uz: "Dolzarb shartlarni so'rash", en: 'Request current terms' },
  'lots.tag': { ru: 'В продаже · Возможна аренда', uz: 'Sotuvda · Ijara mumkin', en: 'For sale · Lease available' },
  'lots.hint': { ru: 'Нажмите, чтобы увеличить', uz: 'Kattalashtirish uchun bosing', en: 'Click to enlarge' },
  'lots.priceL': { ru: 'Продажа · Аренда', uz: 'Sotuv · Ijara', en: 'Sale · Lease' },
  'lots.priceV': { ru: 'цена и условия — по запросу', uz: "narx va shartlar — so'rov bo'yicha", en: 'price and terms on request' },
  'lots.btn1': { ru: 'Узнать цену и условия', uz: 'Narx va shartlarni bilish', en: 'Get price & terms' },
  'lots.btn2': { ru: 'Позвонить', uz: "Qo'ng'iroq qilish", en: 'Call' },
  'inv.cta': { ru: 'Обсудить условия', uz: 'Shartlarni muhokama qilish', en: 'Discuss terms' },
  'lead.c1': { ru: 'отдел продаж', uz: "sotuv bo'limi", en: 'sales team' },
  'lead.c2': { ru: 'Telegram — ответим быстрее всего', uz: 'Telegram — eng tez javob beramiz', en: 'Telegram — fastest reply' },
  'form.h3': { ru: 'Оставить заявку', uz: 'Ariza qoldirish', en: 'Send a request' },
  'form.p': { ru: 'Ответим в течение рабочего дня. Никакого спама — только по вашему запросу.', uz: "Ish kuni davomida javob beramiz. Hech qanday spam — faqat so'rovingiz bo'yicha.", en: 'We reply within one business day. No spam — only what you asked for.' },
  'form.lName': { ru: 'Имя *', uz: 'Ismingiz *', en: 'Name *' },
  'form.lPhone': { ru: 'Телефон *', uz: 'Telefon *', en: 'Phone *' },
  'form.lEmail': { ru: 'Email', uz: 'Email', en: 'Email' },
  'form.lInt': { ru: 'Интересует', uz: 'Nima qiziqtiradi', en: 'Interested in' },
  'form.lLot': { ru: 'Помещение', uz: 'Maydon', en: 'Unit' },
  'form.lMsg': { ru: 'Комментарий', uz: 'Izoh', en: 'Comment' },
  'form.o1': { ru: 'Покупка', uz: 'Sotib olish', en: 'Purchase' },
  'form.o2': { ru: 'Аренда', uz: 'Ijara', en: 'Lease' },
  'form.o3': { ru: 'Покупка как инвестиция', uz: 'Investitsiya sifatida xarid', en: 'Purchase as investment' },
  'form.o4': { ru: 'Консультация', uz: 'Konsultatsiya', en: 'Consultation' },
  'form.oLall': { ru: 'Оба лота', uz: 'Ikkala lot', en: 'Both units' },
  'form.oLnone': { ru: 'Ещё не выбрал(а)', uz: 'Hali tanlamadim', en: 'Not decided yet' },
  'form.send': { ru: 'Отправить заявку', uz: 'Arizani yuborish', en: 'Send request' },
  'form.sending': { ru: 'Отправляем…', uz: 'Yuborilmoqda…', en: 'Sending…' },
  'form.note': { ru: 'Нажимая «Отправить заявку», вы соглашаетесь на обработку персональных данных.', uz: "«Arizani yuborish» tugmasini bosish orqali shaxsiy ma'lumotlarni qayta ishlashga rozilik bildirasiz.", en: 'By clicking “Send request” you consent to the processing of your personal data.' },
  'form.okH': { ru: 'Заявка отправлена!', uz: 'Ariza yuborildi!', en: 'Request sent!' },
  'ph.name': { ru: 'Как к вам обращаться', uz: 'Sizga qanday murojaat qilaylik', en: 'How should we address you' },
  'ph.phone': { ru: '+998 __ ___ __ __', uz: '+998 __ ___ __ __', en: '+998 __ ___ __ __' },
  'ph.email': { ru: 'для отправки планировок', uz: 'rejalarni yuborish uchun', en: 'to receive the floor plans' },
  'ph.msg': { ru: 'Ваш комментарий', uz: 'Izohingiz', en: 'Your comment' }
};

// ─── иконки для карточек/характеристик ───
const ICONS = {
  office: '<rect x="3" y="4" width="18" height="14" rx="2"/><path d="M3 9h18M8 21h8M12 18v3"/>',
  clinic: '<path d="M12 3v18M3 12h18"/><circle cx="12" cy="12" r="9"/>',
  service: '<path d="M4 20h16M6 20V9l6-5 6 5v11M10 20v-5h4v5"/>',
  education: '<path d="M12 4L2 9l10 5 10-5-10-5zM6 11.5V16c0 1.5 2.7 3 6 3s6-1.5 6-3v-4.5"/>',
  building: '<path d="M3 21h18M5 21V5a2 2 0 012-2h10a2 2 0 012 2v16"/><path d="M9 7h2m2 0h2M9 11h2m2 0h2M9 15h2m2 0h2"/>',
  ceiling: '<path d="M4 4h16M4 20h16M8 4v3m8-3v3M8 17v3m8-3v3M4 12h16"/>',
  parking: '<path d="M5 17h14M6 17l1.5-6h9L18 17M8 11V8a4 4 0 018 0v3"/><circle cx="7.5" cy="19" r="1.5"/><circle cx="16.5" cy="19" r="1.5"/>',
  grid: '<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M9 21V9"/>',
  power: '<path d="M13 2L4 14h6l-1 8 9-12h-6l1-8z"/>',
  shield: '<path d="M12 3l8 4v5c0 5-3.5 8-8 9-4.5-1-8-4-8-9V7l8-4z"/>',
  star: '<path d="M12 3l2.7 5.8 6.3.8-4.7 4.3 1.2 6.1L12 17l-5.5 3 1.2-6.1L3 9.6l6.3-.8L12 3z"/>',
  key: '<circle cx="8" cy="14" r="4"/><path d="M11 11l8-8M15 7l3 3"/>'
};
function icon(name, cls) {
  const body = ICONS[name] || ICONS.grid;
  return `<svg viewBox="0 0 24 24" fill="none" stroke-width="1.8" stroke-linecap="round"${cls ? ` class="${cls}"` : ''}>${body}</svg>`;
}

function telHref(phone) { return 'tel:' + String(phone || '').replace(/[^\d+]/g, ''); }

// собрать контентные переводы: el с data-i18n="c.<key>" + записи в I18N
function makeT(dict) {
  return function t(key, value, richHtml) {
    for (const lang of LANGS) {
      const tr = Lx(value, lang);
      if (tr != null) dict[lang]['c.' + key] = richHtml ? tr : esc(tr);
    }
    const ru = L(value);
    return { attr: ` data-i18n="c.${key}"`, ru: richHtml ? rich(ru) : esc(ru) };
  };
}

function shade(hex, f) {
  const n = parseInt(hex.slice(1), 16);
  const r = Math.round(((n >> 16) & 255) * f), g = Math.round(((n >> 8) & 255) * f), b = Math.round((n & 255) * f);
  return '#' + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
}

function renderLanding(cfg) {
  const images = new Set();
  const img = (name) => { if (name) images.add(name); return 'assets/' + name; };

  const dict = { uz: {}, en: {} };
  const t = makeT(dict);

  // строка интерфейса: дефолт из UI_DEFAULTS, переопределение из cfg.texts.<ключ>
  const tget = (obj, keyPath) => keyPath.split('.').reduce((o, k) => (o && typeof o === 'object' ? o[k] : undefined), obj);
  const uiVal = (key) => {
    const def = UI_DEFAULTS[key] || { ru: '', uz: '', en: '' };
    const ov = tget(cfg.texts || {}, key);
    const pick = (lang) => (ov && typeof ov === 'object' && typeof ov[lang] === 'string' && ov[lang].trim())
      ? ov[lang].trim() : def[lang];
    return { ru: pick('ru'), uz: pick('uz'), en: pick('en') };
  };
  const U = (key) => {
    const v = uiVal(key);
    for (const lang of LANGS) if (v[lang]) dict[lang][key] = esc(v[lang]);
    return { attr: ` data-i18n="${key}"`, ru: esc(v.ru) };
  };
  const UP = (key) => { // плейсхолдеры: на элементе data-i18n-ph="<имя>", ключ ph.<имя>
    const v = uiVal(key);
    for (const lang of LANGS) if (v[lang]) dict[lang][key] = v[lang];
    return escAttr(v.ru);
  };

  const siteBase = String(cfg.seo.domain || '').trim().replace(/\/+$/, '');
  const adminUrl = String(cfg.adminUrl || '').trim();
  const phone = cfg.contacts.phone || '';
  const tel = telHref(phone);
  const tg = (cfg.contacts.telegram || '').replace(/^@/, '');
  const email = cfg.contacts.email || '';
  const lots = (cfg.lots.items || []);
  const manyLots = lots.length > 1;

  // интерфейсные строки (редактируются в панели: «Кнопки и тексты»)
  const uNavUses = U('nav.uses'), uNavLots = U('nav.lots'), uNavBld = U('nav.building'),
    uNavLoc = U('nav.location'), uNavFaq = U('nav.faq'), uNavCta = U('nav.cta'),
    uNavLogin = U('nav.login'), uHeroB1 = U('hero.btn1'), uHeroB2 = U('hero.btn2'),
    uUsesLbl = U('uses.lbl'), uLotsLbl = U('lots.lbl'), uBldLbl = U('bld.lbl'),
    uInvLbl = U('inv.lbl'), uProgLbl = U('prog.lbl'), uLocLbl = U('loc.lbl'),
    uLeadLbl = U('lead.lbl'), uFaqLbl = U('faq.lbl'), uFaqH2 = U('faq.h2'),
    uLotsCta = U('lots.cta'), uLotTag = U('lots.tag'), uLotHint = U('lots.hint'),
    uPriceL = U('lots.priceL'), uPriceV = U('lots.priceV'), uLotBtn1 = U('lots.btn1'),
    uLotBtn2 = U('lots.btn2'), uInvCta = U('inv.cta'), uLeadC1 = U('lead.c1'),
    uLeadC2 = U('lead.c2'), uFormH3 = U('form.h3'), uFormP = U('form.p'),
    uLName = U('form.lName'), uLPhone = U('form.lPhone'), uLEmail = U('form.lEmail'),
    uLInt = U('form.lInt'), uLLot = U('form.lLot'), uLMsg = U('form.lMsg'),
    uO1 = U('form.o1'), uO2 = U('form.o2'), uO3 = U('form.o3'), uO4 = U('form.o4'),
    uOLall = U('form.oLall'), uOLnone = U('form.oLnone'), uSend = U('form.send'),
    uNote = U('form.note'), uOkH = U('form.okH');
  const phName = UP('ph.name'), phPhone = UP('ph.phone'), phEmail = UP('ph.email'), phMsg = UP('ph.msg');
  const sendingV = uiVal('form.sending');
  for (const lang of LANGS) if (sendingV[lang]) dict[lang]['form.sending'] = sendingV[lang];
  const ctaArrowV = uiVal('nav.cta');
  for (const lang of LANGS) dict[lang]['nav.ctaArrow'] = esc(ctaArrowV[lang]) + ' →';

  // приём заявок: своя панель (CRM + пересылка на почту); относительный путь
  // работает и на /p/<slug>/, и за прокси /admin/p/<slug>/
  const leadEndpoint = String(cfg.leadEndpoint || '').trim() || ('../../api/lead/' + (cfg.slug || ''));

  const accent = /^#[0-9a-fA-F]{6}$/.test(String(cfg.brand.accent || '').trim()) ? String(cfg.brand.accent).trim() : '';
  const accentCss = accent ? `\n:root{--bronze:${accent};--bronze-d:${shade(accent, 0.82)}}` : '';

  // логотип: загруженная картинка или буквенная метка
  const logoFile = String(cfg.brand.logo || '').trim();
  const brandMark = logoFile
    ? `<span class="brand-mark brand-imgmark"><img src="${escAttr(img(logoFile))}" alt="${escAttr(L(cfg.brand.name))}"></span>`
    : `<span class="brand-mark">${esc(cfg.brand.mark || 'BC')}</span>`;
  const favicon = logoFile
    ? `assets/${escAttr(logoFile)}`
    : `data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'%3E%3Crect width='64' height='64' rx='14' fill='%231d1f21'/%3E%3Ctext x='32' y='42' font-family='Arial' font-size='26' font-weight='700' fill='%23fff' text-anchor='middle'%3E${encodeURIComponent(esc(cfg.brand.mark || 'BC').slice(0, 3))}%3C/text%3E%3C/svg%3E`;

  // мета: title/description по языкам
  for (const lang of LANGS) {
    const mt = Lx(cfg.seo.title, lang), md = Lx(cfg.seo.description, lang);
    if (mt) dict[lang]['meta.title'] = mt;
    if (md) dict[lang]['meta.desc'] = md;
  }

  // ── hero ──
  const badges = (cfg.hero.badges || []).map((b, i) => {
    const k = t('hb' + i, b);
    return `<span class="hbadge${i === 0 ? ' gold' : ''}"${k.attr}>${k.ru}</span>`;
  }).join('\n      ');
  const stats = (cfg.hero.stats || []).map((s, i) => {
    const n = t('hs' + i + 'n', s.n, true), l = t('hs' + i + 'l', s.l);
    return `<div class="hstat"><div class="hstat-n"${n.attr}>${n.ru}</div><div class="hstat-l"${l.attr}>${l.ru}</div></div>`;
  }).join('\n      ');

  const heroT = t('hero.h1', cfg.hero.title, true);
  const heroS = t('hero.sub', cfg.hero.subtitle, true);
  const brandN = t('brand.n', cfg.brand.name);
  const brandS = t('brand.s', cfg.brand.tag);

  // ── uses ──
  let usesHtml = '';
  if (cfg.uses && cfg.uses.enabled !== false && (cfg.uses.cards || []).length) {
    const cards = cfg.uses.cards.map((c, i) => {
      const h = t('u' + i + 'h', c.h), p = t('u' + i + 'p', c.p);
      return `      <div class="ucard r${i ? ' d' + Math.min(i, 3) : ''}">
        <div class="ucard-ic">${icon(c.icon)}</div>
        <h3${h.attr}>${h.ru}</h3>
        <p${p.attr}>${p.ru}</p>
      </div>`;
    }).join('\n');
    const h2 = t('uses.h2', cfg.uses.h2), sub = t('uses.sub', cfg.uses.sub), note = t('uses.note', cfg.uses.note);
    usesHtml = `
<section class="uses" id="uses">
  <div class="wrap">
    <div class="lbl r"${uUsesLbl.attr}>${uUsesLbl.ru}</div>
    <h2 class="r"${h2.attr}>${h2.ru}</h2>
    <p class="sub r"${sub.attr}>${sub.ru}</p>
    <div class="uses-grid">
${cards}
    </div>
    ${L(cfg.uses.note) ? `<p class="uses-note r"${note.attr}>${note.ru}</p>` : ''}
  </div>
</section>`;
  }

  // ── lots ──
  const lotCards = lots.map((lot, i) => {
    const h = t('l' + i + 'h', lot.title), a = t('l' + i + 'a', lot.area);
    const feats = (lot.features || []).map((f, j) => {
      const k = t('l' + i + 'f' + j, f);
      return `          <li${k.attr}>${k.ru}</li>`;
    }).join('\n');
    const plan = lot.plan ? img(lot.plan) : '';
    const planBlock = plan ? `      <div class="lot-plan" data-zoom="${escAttr(plan)}">
        <img src="${escAttr(plan)}" alt="${escAttr(L(lot.title))} — план" loading="lazy">
        <span class="lot-plan-hint"${uLotHint.attr}>${uLotHint.ru}</span>
      </div>` : '';
    return `    <article class="lot r${plan ? '' : ' lot-noplan'}">
${planBlock}
      <div class="lot-info">
        <span class="lot-tag"${uLotTag.attr}>${uLotTag.ru}</span>
        <h3${h.attr}>${h.ru}</h3>
        <p class="lot-area"${a.attr}>${a.ru}</p>
        <ul class="lot-feats">
${feats}
        </ul>
        <div class="lot-price">
          <div><div class="lp-l"${uPriceL.attr}>${uPriceL.ru}</div><div class="lp-v" style="font-size:18px;padding-top:4px"${uPriceV.attr}>${uPriceV.ru}</div></div>
        </div>
        <div class="lot-btns">
          <a href="#lead" class="btn btn-bronze" data-lot="${escAttr(L(lot.title))}"${uLotBtn1.attr}>${uLotBtn1.ru}</a>
          <a href="${tel}" class="btn btn-line"${uLotBtn2.attr}>${uLotBtn2.ru}</a>
        </div>
      </div>
    </article>`;
  }).join('\n\n');
  const lotsH2 = t('lots.h2', cfg.lots.h2), lotsSub = t('lots.sub', cfg.lots.sub);

  // ── building ──
  let bldHtml = '';
  if (cfg.building && cfg.building.enabled !== false) {
    const b = cfg.building;
    const specs = (b.specs || []).map((s, i) => {
      const bb = t('sp' + i + 'b', s.b), ss = t('sp' + i + 's', s.s);
      return `          <div class="spec"><div class="spec-ic">${icon(s.icon)}</div><div><b${bb.attr}>${bb.ru}</b><span${ss.attr}>${ss.ru}</span></div></div>`;
    }).join('\n');
    const bImgs = (b.images || []).filter(Boolean).map((f) =>
      `        <img src="${escAttr(img(f))}" alt="${escAttr(L(cfg.brand.name))}" loading="lazy">`).join('\n');
    const h2 = t('bld.h2', b.h2), sub = t('bld.sub', b.sub), note = t('bld.note', b.note, true);
    bldHtml = `
<section class="bld" id="building">
  <div class="wrap">
    <div class="bld-grid">
      <div class="r">
        <div class="lbl"${uBldLbl.attr}>${uBldLbl.ru}</div>
        <h2${h2.attr}>${h2.ru}</h2>
        <p class="sub"${sub.attr}>${sub.ru}</p>
        <div class="specs">
${specs}
        </div>
        ${L(b.note) ? `<div class="facade-note"${note.attr}>${note.ru}</div>` : ''}
      </div>
      ${bImgs ? `<div class="bld-imgs r d1">\n${bImgs}\n      </div>` : ''}
    </div>
  </div>
</section>`;
  }

  // ── invest ──
  let invHtml = '';
  if (cfg.invest && cfg.invest.enabled !== false && (cfg.invest.cards || []).length) {
    const cards = cfg.invest.cards.map((c, i) => {
      const h = t('i' + i + 'h', c.h), p = t('i' + i + 'p', c.p);
      return `      <div class="inv r${i ? ' d' + Math.min(i, 3) : ''}"><div class="inv-n">0${i + 1}</div><h3${h.attr}>${h.ru}</h3><p${p.attr}>${p.ru}</p></div>`;
    }).join('\n');
    const h2 = t('inv.h2', cfg.invest.h2), strip = t('inv.strip', cfg.invest.strip, true);
    invHtml = `
<section class="invest" id="invest">
  <div class="wrap">
    <div class="lbl r"${uInvLbl.attr}>${uInvLbl.ru}</div>
    <h2 class="r"${h2.attr}>${h2.ru}</h2>
    <div class="inv-grid">
${cards}
    </div>
    ${L(cfg.invest.strip) ? `<div class="inv-strip r">
      <p${strip.attr}>${strip.ru}</p>
      <a href="#lead" class="btn btn-bronze"${uInvCta.attr}>${uInvCta.ru}</a>
    </div>` : ''}
  </div>
</section>`;
  }

  // ── progress ──
  let progHtml = '';
  if (cfg.progress && cfg.progress.enabled !== false && (cfg.progress.steps || []).length) {
    const p = cfg.progress;
    const steps = p.steps.map((s, i) => {
      const b = t('t' + i + 'b', s.b), ss = t('t' + i + 's', s.s);
      const cls = s.state === 'done' ? ' class="done"' : s.state === 'now' ? ' class="now"' : '';
      return `          <li${cls}><span class="tl-dot">${s.state === 'done' ? '✓' : ''}</span><div><b${b.attr}>${b.ru}</b><span${ss.attr}>${ss.ru}</span></div></li>`;
    }).join('\n');
    const h2 = t('prog.h2', p.h2), sub = t('prog.sub', p.sub);
    progHtml = `
<section class="prog" id="progress">
  <div class="wrap">
    <div class="prog-grid">
      ${p.image ? `<div class="prog-img r"><img src="${escAttr(img(p.image))}" alt="Ход строительства" loading="lazy"></div>` : ''}
      <div class="r d1">
        <div class="lbl"${uProgLbl.attr}>${uProgLbl.ru}</div>
        <h2${h2.attr}>${h2.ru}</h2>
        <p class="sub"${sub.attr}>${sub.ru}</p>
        <ul class="tl">
${steps}
        </ul>
      </div>
    </div>
  </div>
</section>`;
  }

  // ── location ──
  const loc = cfg.location;
  const pois = (loc.pois || []).map((p, i) => {
    const n = t('lp' + i, p.name), d = t('ld' + i, p.dist);
    return `          <li><span${n.attr}>${n.ru}</span><b${d.attr}>${d.ru}</b></li>`;
  }).join('\n');
  const locH2 = t('loc.h2', loc.h2), locSub = t('loc.sub', loc.sub);
  const locAddr = t('loc.addr', loc.address), locAddrS = t('loc.addrS', loc.addressNote);
  const mapSrc = `https://www.google.com/maps?q=${Number(loc.lat) || 0},${Number(loc.lng) || 0}&z=16&hl=ru&output=embed`;

  // ── lead / form ──
  const leadH2 = t('lead.h2', cfg.lead.h2), leadSub = t('lead.sub', cfg.lead.sub);
  const okP = t('form.okP', {
    ru: `Мы свяжемся с вами в течение рабочего дня.${tg ? `<br>Хотите быстрее — напишите в <a href="https://t.me/${escAttr(tg)}" target="_blank" rel="noopener"><b>Telegram @${escAttr(tg)}</b></a>.` : ''}`,
    uz: `Ish kuni davomida siz bilan bog'lanamiz.${tg ? `<br>Tezroq kerak bo'lsa — <a href='https://t.me/${escAttr(tg)}' target='_blank' rel='noopener'><b>Telegram @${escAttr(tg)}</b></a> ga yozing.` : ''}`,
    en: `We will contact you within one business day.${tg ? `<br>Need it faster? Message <a href='https://t.me/${escAttr(tg)}' target='_blank' rel='noopener'><b>@${escAttr(tg)} on Telegram</b></a>.` : ''}`
  }, true);
  const errT = t('form.err', {
    ru: `Не удалось отправить онлайн. Позвоните <a href="${tel}">${esc(phone)}</a>${tg ? `, напишите в <a href="https://t.me/${escAttr(tg)}" target="_blank" rel="noopener">Telegram</a>` : ''} или на <a href="mailto:${escAttr(email)}">почту</a>.`,
    uz: `Onlayn yuborib bo'lmadi. <a href='${tel}'>${esc(phone)}</a> raqamiga qo'ng'iroq qiling${tg ? `, <a href='https://t.me/${escAttr(tg)}' target='_blank' rel='noopener'>Telegram</a> orqali` : ''} yoki <a href='mailto:${escAttr(email)}'>pochta</a>ga yozing.`,
    en: `Couldn't send online. Call <a href='${tel}'>${esc(phone)}</a>${tg ? `, message us on <a href='https://t.me/${escAttr(tg)}' target='_blank' rel='noopener'>Telegram</a>` : ''} or by <a href='mailto:${escAttr(email)}'>email</a>.`
  }, true);

  const lotOptions = lots.map((lot, i) => {
    const k = t('oL' + i, lot.title);
    return `                <option value="${escAttr(L(lot.title))}"${k.attr}>${k.ru}</option>`;
  }).join('\n') + (manyLots ? `
                <option value="${uOLall.ru}"${uOLall.attr}>${uOLall.ru}</option>` : '') + `
                <option value="${uOLnone.ru}"${uOLnone.attr}>${uOLnone.ru}</option>`;

  // ── faq ──
  const faqItems = (cfg.faq || []).map((f, i) => {
    const q = t('q' + i, f.q), a = t('a' + i, f.a, true);
    return `      <details${i === 0 ? ' open' : ''}>
        <summary${q.attr}>${q.ru}</summary>
        <p${a.attr}>${a.ru}</p>
      </details>`;
  }).join('\n');

  const footAddr = t('foot.addr', cfg.footer.addr);
  const footLegal = t('foot.legal', cfg.footer.legal);

  // ── JSON-LD ──
  const ld = {
    '@context': 'https://schema.org', '@type': 'LocalBusiness',
    name: L(cfg.brand.name),
    description: L(cfg.seo.description),
    telephone: phone.replace(/\s/g, ''),
    image: cfg.hero.image ? 'assets/' + cfg.hero.image : undefined,
    sameAs: tg ? ['https://t.me/' + tg] : undefined,
    address: {
      '@type': 'PostalAddress', streetAddress: L(loc.address),
      addressLocality: loc.city || 'Ташкент', addressCountry: 'UZ'
    },
    geo: { '@type': 'GeoCoordinates', latitude: Number(loc.lat) || 0, longitude: Number(loc.lng) || 0 }
  };
  const ldFaq = (cfg.faq || []).length ? {
    '@context': 'https://schema.org', '@type': 'FAQPage',
    mainEntity: cfg.faq.map((f) => ({
      '@type': 'Question', name: L(f.q),
      acceptedAnswer: { '@type': 'Answer', text: L(f.a).replace(/<[^>]+>/g, '') }
    }))
  } : null;

  const heroImg = cfg.hero.image ? img(cfg.hero.image) : '';
  const ogImg = cfg.hero.image ? 'assets/' + cfg.hero.image : '';

  const html = `<!DOCTYPE html>
<html lang="ru">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${esc(L(cfg.seo.title))}</title>
<meta name="description" content="${escAttr(L(cfg.seo.description))}">
${cfg.seo.keywords ? `<meta name="keywords" content="${escAttr(cfg.seo.keywords)}">` : ''}
<meta name="robots" content="index, follow">
${(cfg.seo.googleVerification || '').trim() ? `<meta name="google-site-verification" content="${escAttr(cfg.seo.googleVerification.trim())}">` : ''}
${(cfg.seo.yandexVerification || '').trim() ? `<meta name="yandex-verification" content="${escAttr(cfg.seo.yandexVerification.trim())}">` : ''}
${siteBase ? `<link rel="canonical" href="${escAttr(siteBase)}/">` : ''}
${siteBase ? `<meta property="og:url" content="${escAttr(siteBase)}/">` : ''}
<meta name="geo.region" content="UZ">
<meta name="geo.placename" content="${escAttr(loc.city || 'Ташкент')}">
<meta name="geo.position" content="${Number(loc.lat) || 0};${Number(loc.lng) || 0}">
<meta name="ICBM" content="${Number(loc.lat) || 0}, ${Number(loc.lng) || 0}">
<meta property="og:title" content="${escAttr(L(cfg.seo.title))}">
<meta property="og:description" content="${escAttr(L(cfg.seo.description))}">
${ogImg ? `<meta property="og:image" content="${escAttr(ogImg)}">` : ''}
<meta property="og:type" content="website">
<meta property="og:locale" content="ru_RU">
<meta property="og:locale:alternate" content="uz_UZ">
<meta property="og:locale:alternate" content="en_US">
<meta property="og:site_name" content="${escAttr(L(cfg.brand.name))}">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${escAttr(L(cfg.seo.title))}">
<meta name="twitter:description" content="${escAttr(L(cfg.seo.description))}">
${ogImg ? `<meta name="twitter:image" content="${escAttr(ogImg)}">` : ''}
<link rel="icon" href="${favicon}">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700;800&family=Inter:wght@400;500;600&display=swap" rel="stylesheet">
<script type="application/ld+json">${JSON.stringify(ld)}</script>
${ldFaq ? `<script type="application/ld+json">${JSON.stringify(ldFaq)}</script>` : ''}
<style>${CSS}${accentCss}</style>
</head>
<body>

<nav id="nav">
  <div class="nav-in">
    <a href="#" class="brand">
      ${brandMark}
      <span class="brand-t"><span class="brand-n"${brandN.attr}>${brandN.ru}</span><span class="brand-s"${brandS.attr}>${brandS.ru}</span></span>
    </a>
    <ul class="nl">
      ${usesHtml ? `<li><a href="#uses"${uNavUses.attr}>${uNavUses.ru}</a></li>` : ''}
      <li><a href="#lots"${uNavLots.attr}>${uNavLots.ru}</a></li>
      ${bldHtml ? `<li><a href="#building"${uNavBld.attr}>${uNavBld.ru}</a></li>` : ''}
      <li><a href="#location"${uNavLoc.attr}>${uNavLoc.ru}</a></li>
      ${faqItems ? `<li><a href="#faq"${uNavFaq.attr}>${uNavFaq.ru}</a></li>` : ''}
    </ul>
    <div class="nav-r">
      <div class="lang" id="langSw" role="group" aria-label="Язык / Til / Language">
        <button type="button" data-lang="ru" class="on">RU</button><button type="button" data-lang="uz">UZ</button><button type="button" data-lang="en">EN</button>
      </div>
      <a class="nav-tel" href="${tel}">${esc(phone)}</a>
      <a href="#lead" class="btn btn-bronze btn-sm"${uNavCta.attr}>${uNavCta.ru}</a>
      ${adminUrl ? `<a class="nav-login" href="${escAttr(adminUrl)}"${uNavLogin.attr} title="Вход для сотрудников">${uNavLogin.ru}</a>` : ''}
      <button class="burger" id="burger" aria-label="Меню"><span></span><span></span><span></span></button>
    </div>
  </div>
</nav>
<div class="mmenu" id="mmenu">
  ${usesHtml ? `<a href="#uses"${uNavUses.attr}>${uNavUses.ru}</a>` : ''}
  <a href="#lots"${uNavLots.attr}>${uNavLots.ru}</a>
  ${bldHtml ? `<a href="#building"${uNavBld.attr}>${uNavBld.ru}</a>` : ''}
  <a href="#location"${uNavLoc.attr}>${uNavLoc.ru}</a>
  ${faqItems ? `<a href="#faq"${uNavFaq.attr}>${uNavFaq.ru}</a>` : ''}
  <a href="#lead" style="color:var(--bronze-d)" data-i18n="nav.ctaArrow">${esc(ctaArrowV.ru)} →</a>
  ${adminUrl ? `<a href="${escAttr(adminUrl)}" style="color:var(--muted);font-size:13px"${uNavLogin.attr}>${uNavLogin.ru}</a>` : ''}
</div>

<header class="hero">
  ${heroImg ? `<div class="hero-bg"><img src="${escAttr(heroImg)}" alt="${escAttr(L(cfg.brand.name))}" fetchpriority="high"></div>` : ''}
  <div class="hero-ov"></div>
  <div class="hero-c">
    <div class="hero-badges">
      ${badges}
    </div>
    <h1${heroT.attr}>${heroT.ru}</h1>
    <p class="hero-sub"${heroS.attr}>${heroS.ru}</p>
    <div class="hero-btns">
      <a href="#lead" class="btn btn-bronze"${uHeroB1.attr}>${uHeroB1.ru}</a>
      <a href="#lots" class="btn btn-ghost"${uHeroB2.attr}>${uHeroB2.ru}</a>
    </div>
  </div>
  ${stats ? `<div class="hero-stats">
    <div class="hero-stats-in">
      ${stats}
    </div>
  </div>` : ''}
</header>
${usesHtml}

<section class="lots" id="lots">
  <div class="wrap">
    <div class="lots-head r">
      <div>
        <div class="lbl"${uLotsLbl.attr}>${uLotsLbl.ru}</div>
        <h2${lotsH2.attr}>${lotsH2.ru}</h2>
        <p class="sub"${lotsSub.attr}>${lotsSub.ru}</p>
      </div>
      <a href="#lead" class="btn btn-dark"${uLotsCta.attr}>${uLotsCta.ru}</a>
    </div>

${lotCards}
  </div>
</section>
${bldHtml}
${invHtml}
${progHtml}

<section class="loc" id="location">
  <div class="wrap">
    <div class="loc-grid">
      <div class="r">
        <div class="lbl"${uLocLbl.attr}>${uLocLbl.ru}</div>
        <h2${locH2.attr}>${locH2.ru}</h2>
        <p class="sub"${locSub.attr}>${locSub.ru}</p>
        <div class="loc-addr">
          <svg viewBox="0 0 24 24" fill="none" stroke-width="1.8" stroke-linecap="round"><path d="M12 21s-7-5.5-7-11a7 7 0 0114 0c0 5.5-7 11-7 11z"/><circle cx="12" cy="10" r="2.6"/></svg>
          <div><b${locAddr.attr}>${locAddr.ru}</b><span${locAddrS.attr}>${locAddrS.ru}</span></div>
        </div>
        ${pois ? `<ul class="loc-list">
${pois}
        </ul>` : ''}
      </div>
      <div class="map r d1">
        <iframe src="${escAttr(mapSrc)}" loading="lazy" title="${escAttr(L(loc.address))}" referrerpolicy="no-referrer-when-downgrade" allowfullscreen></iframe>
      </div>
    </div>
  </div>
</section>

<section class="lead" id="lead">
  <div class="wrap">
    <div class="lead-grid">
      <div class="r">
        <div class="lbl"${uLeadLbl.attr}>${uLeadLbl.ru}</div>
        <h2${leadH2.attr}>${leadH2.ru}</h2>
        <p class="sub"${leadSub.attr}>${leadSub.ru}</p>
        <div class="lead-contacts">
          <a class="lc" href="${tel}">
            <span class="lc-ic"><svg viewBox="0 0 24 24" fill="none" stroke-width="1.8" stroke-linecap="round"><path d="M5 4h4l2 5-2.5 1.5a12 12 0 005 5L15 13l5 2v4a2 2 0 01-2 2A16 16 0 013 6a2 2 0 012-2z"/></svg></span>
            <span><b>${esc(phone)}</b><span${uLeadC1.attr}>${uLeadC1.ru}</span></span>
          </a>
          ${tg ? `<a class="lc" href="https://t.me/${escAttr(tg)}" target="_blank" rel="noopener">
            <span class="lc-ic"><svg viewBox="0 0 24 24" fill="none" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M21 4L3 11l5.5 2L10 19l3-3.5L18 19l3-15z"/></svg></span>
            <span><b>@${esc(tg)}</b><span${uLeadC2.attr}>${uLeadC2.ru}</span></span>
          </a>` : ''}
        </div>
      </div>
      <div class="form-card r d1">
        <form id="leadForm" novalidate>
          <h3${uFormH3.attr}>${uFormH3.ru}</h3>
          <p${uFormP.attr}>${uFormP.ru}</p>
          <div class="frow">
            <div class="fg"><label for="f-name"${uLName.attr}>${uLName.ru}</label><input id="f-name" name="Имя" type="text" required autocomplete="name" placeholder="${phName}" data-i18n-ph="name"></div>
            <div class="fg"><label for="f-phone"${uLPhone.attr}>${uLPhone.ru}</label><input id="f-phone" name="Телефон" type="tel" required autocomplete="tel" placeholder="${phPhone}" data-i18n-ph="phone"></div>
          </div>
          <div class="fg"><label for="f-email"${uLEmail.attr}>${uLEmail.ru}</label><input id="f-email" name="Email" type="email" autocomplete="email" placeholder="${phEmail}" data-i18n-ph="email"></div>
          <div class="frow">
            <div class="fg"><label for="f-int"${uLInt.attr}>${uLInt.ru}</label>
              <select id="f-int" name="Интересует">
                <option value="${uO1.ru}"${uO1.attr}>${uO1.ru}</option>
                <option value="${uO2.ru}"${uO2.attr}>${uO2.ru}</option>
                <option value="${uO3.ru}"${uO3.attr}>${uO3.ru}</option>
                <option value="${uO4.ru}"${uO4.attr}>${uO4.ru}</option>
              </select>
            </div>
            <div class="fg"><label for="f-lot"${uLLot.attr}>${uLLot.ru}</label>
              <select id="f-lot" name="Помещение">
${lotOptions}
              </select>
            </div>
          </div>
          <div class="fg"><label for="f-msg"${uLMsg.attr}>${uLMsg.ru}</label><textarea id="f-msg" name="Комментарий" placeholder="${phMsg}" data-i18n-ph="msg"></textarea></div>
          <input type="text" name="_honey" class="hp" tabindex="-1" autocomplete="off">
          <button type="submit" class="btn btn-bronze form-btn" id="formBtn"${uSend.attr}>${uSend.ru}</button>
          <div class="form-err" id="formErr"${errT.attr}>${errT.ru}</div>
          <p class="form-note"${uNote.attr}>${uNote.ru}</p>
        </form>
        <div class="form-ok" id="formOk">
          <div class="form-ok-ic"><svg viewBox="0 0 24 24" fill="none" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M4 12.5l5 5L20 6.5"/></svg></div>
          <h4${uOkH.attr}>${uOkH.ru}</h4>
          <p${okP.attr}>${okP.ru}</p>
        </div>
      </div>
    </div>
  </div>
</section>

${faqItems ? `<section class="faq" id="faq">
  <div class="wrap">
    <div class="lbl c r"${uFaqLbl.attr}>${uFaqLbl.ru}</div>
    <h2 class="r" style="text-align:center"${uFaqH2.attr}>${uFaqH2.ru}</h2>
    <div class="faq-list r">
${faqItems}
    </div>
  </div>
</section>` : ''}

<footer>
  <div class="wrap foot">
    <div class="foot-l brand" style="text-decoration:none">
      ${brandMark}
      <span class="brand-t"><span class="brand-n"${brandN.attr}>${brandN.ru}</span><span class="brand-s"${footAddr.attr}>${footAddr.ru}</span></span>
    </div>
    <div class="foot-r">
      <a href="${tel}">${esc(phone)}</a>${tg ? ` · <a href="https://t.me/${escAttr(tg)}" target="_blank" rel="noopener">@${esc(tg)}</a>` : ''}<br>
      <span${footLegal.attr}>${footLegal.ru}</span>
    </div>
  </div>
</footer>

<div class="mcta">
  <a href="${tel}" class="btn btn-line"${uLotBtn2.attr}>${uLotBtn2.ru}</a>
  <a href="#lead" class="btn btn-bronze"${uNavCta.attr}>${uNavCta.ru}</a>
</div>

<div class="lb" id="lb"><img alt="Планировка крупно" id="lbImg"></div>

<script>
var I18N = ${JSON.stringify({ uz: dict.uz, en: dict.en })};
var SENDING_RU = ${JSON.stringify(sendingV.ru)};
${RUNTIME_JS}
var LEAD_ENDPOINT = ${JSON.stringify(leadEndpoint)};
var LEAD_EMAIL = ${JSON.stringify(email)};
var SHEETS_ENDPOINT = ${JSON.stringify(cfg.contacts.sheetsEndpoint || '')};
var LEAD_SUBJECT = ${JSON.stringify('Заявка с лендинга: ' + L(cfg.brand.name))};
${FORM_JS}
</script>
</body>
</html>`;

  // robots.txt и sitemap.xml для Google и Яндекса
  const robots = `User-agent: *\nAllow: /\n${siteBase ? `\nSitemap: ${siteBase}/sitemap.xml\n` : ''}`;
  const sitemap = siteBase
    ? `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n  <url><loc>${esc(siteBase)}/</loc><changefreq>weekly</changefreq><priority>1.0</priority></url>\n</urlset>\n`
    : null;

  return { html, images: [...images], robots, sitemap };
}

// ─── CSS (общий для всех лендингов; фирменная палитра) ───
const CSS = `
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
:root{--granite:#1b1d1f;--graphite:#2b2e31;--stone-50:#f6f5f2;--stone-100:#efede8;--stone-200:#e2dfd8;--line:rgba(27,29,31,.12);--ink:#212326;--muted:#66696e;--bronze:#a8804c;--bronze-d:#8c6a3d;--ok:#2e7d4f;--h:'Manrope',system-ui,sans-serif;--b:'Inter',system-ui,sans-serif;--g:56px;--max:1280px}
html{scroll-behavior:smooth}
body{font-family:var(--b);background:var(--stone-50);color:var(--ink);overflow-x:hidden;line-height:1.6}
img{display:block;max-width:100%}
a{color:inherit}
h1,h2,h3{font-family:var(--h);line-height:1.12}
.wrap{max-width:var(--max);margin:0 auto;padding:0 var(--g)}
.lbl{font-size:11px;font-weight:700;letter-spacing:2.4px;text-transform:uppercase;color:var(--bronze);display:flex;align-items:center;gap:10px;margin-bottom:18px}
.lbl::before{content:'';width:22px;height:1px;background:var(--bronze);flex-shrink:0}
.lbl.c{justify-content:center}
h2{font-size:clamp(30px,3.6vw,46px);font-weight:800;letter-spacing:-.5px}
.sub{font-size:16.5px;color:var(--muted);max-width:640px;margin-top:16px}
nav{position:fixed;top:0;left:0;right:0;z-index:400;height:66px;display:flex;align-items:center;transition:background .3s,box-shadow .3s}
nav.s{background:rgba(246,245,242,.96);backdrop-filter:blur(12px);box-shadow:0 1px 0 var(--line)}
.nav-in{width:100%;max-width:var(--max);margin:0 auto;padding:0 var(--g);display:flex;align-items:center;justify-content:space-between;gap:24px}
.brand{display:flex;align-items:center;gap:12px;text-decoration:none}
.brand-mark{width:38px;height:38px;background:var(--granite);color:#fff;display:flex;align-items:center;justify-content:center;font-family:var(--h);font-weight:800;font-size:13px;letter-spacing:.5px;border-radius:8px;flex-shrink:0}
.brand-imgmark{background:transparent;overflow:hidden}
.brand-imgmark img{width:100%;height:100%;object-fit:contain;border-radius:8px}
.brand-t{display:flex;flex-direction:column;line-height:1.15}
.brand-n{font-family:var(--h);font-weight:800;font-size:16px;letter-spacing:.4px;color:#fff;transition:color .3s;white-space:nowrap}
.brand-s{font-size:10px;letter-spacing:1.6px;text-transform:uppercase;color:rgba(255,255,255,.55);transition:color .3s;white-space:nowrap}
nav.s .brand-n{color:var(--ink)}
nav.s .brand-s{color:var(--muted)}
.nl{display:flex;gap:26px;list-style:none}
.nl a{font-size:13px;font-weight:500;color:rgba(255,255,255,.75);text-decoration:none;transition:color .2s}
.nl a:hover{color:#fff}
nav.s .nl a{color:var(--muted)}
nav.s .nl a:hover{color:var(--ink)}
.nav-r{display:flex;align-items:center;gap:14px}
.nav-tel{font-size:13.5px;font-weight:600;color:#fff;text-decoration:none;white-space:nowrap;transition:color .3s}
nav.s .nav-tel{color:var(--ink)}
.nav-login{font-size:12px;font-weight:600;color:rgba(255,255,255,.5);text-decoration:none;white-space:nowrap;transition:color .3s}
.nav-login:hover{color:#fff}
nav.s .nav-login{color:var(--muted)}
nav.s .nav-login:hover{color:var(--ink)}
@media(max-width:1060px){.nav-login{display:none}}
.lang{display:flex;gap:2px;background:rgba(255,255,255,.12);border:1px solid rgba(255,255,255,.28);border-radius:100px;padding:3px;backdrop-filter:blur(6px)}
.lang button{border:none;background:transparent;color:rgba(255,255,255,.72);font-family:var(--h);font-size:11px;font-weight:700;letter-spacing:.8px;padding:5px 9px;border-radius:100px;cursor:pointer;transition:background .2s,color .2s}
.lang button.on{background:#fff;color:var(--ink)}
nav.s .lang{background:var(--stone-100);border-color:var(--line)}
nav.s .lang button{color:var(--muted)}
nav.s .lang button.on{background:var(--granite);color:#fff}
.btn{display:inline-flex;align-items:center;justify-content:center;gap:8px;font-family:var(--h);font-size:13px;font-weight:700;letter-spacing:.3px;padding:13px 26px;border-radius:10px;text-decoration:none;border:none;cursor:pointer;transition:background .2s,color .2s,border-color .2s,transform .15s;white-space:nowrap}
.btn:active{transform:translateY(1px)}
.btn-dark{background:var(--granite);color:#fff}
.btn-dark:hover{background:var(--graphite)}
.btn-bronze{background:var(--bronze);color:#fff}
.btn-bronze:hover{background:var(--bronze-d)}
.btn-ghost{background:rgba(255,255,255,.12);color:#fff;border:1px solid rgba(255,255,255,.32);backdrop-filter:blur(6px)}
.btn-ghost:hover{background:rgba(255,255,255,.22)}
.btn-line{background:transparent;color:var(--ink);border:1.5px solid rgba(27,29,31,.28)}
.btn-line:hover{border-color:var(--ink)}
.btn-sm{padding:10px 18px;font-size:12.5px}
.burger{display:none;width:42px;height:42px;background:none;border:none;cursor:pointer;flex-direction:column;align-items:center;justify-content:center;gap:5px}
.burger span{display:block;width:22px;height:2px;background:#fff;transition:background .3s}
nav.s .burger span{background:var(--ink)}
.mmenu{display:none;position:fixed;inset:66px 0 auto 0;z-index:390;background:var(--stone-50);border-bottom:1px solid var(--line);padding:10px var(--g) 24px;flex-direction:column;gap:2px}
.mmenu.open{display:flex}
.mmenu a{padding:13px 0;font-size:15px;font-weight:600;text-decoration:none;border-bottom:1px solid var(--line)}
.hero{position:relative;min-height:100svh;display:flex;flex-direction:column;justify-content:flex-end;background:var(--granite)}
.hero-bg{position:absolute;inset:0;overflow:hidden}
.hero-bg img{width:100%;height:100%;object-fit:cover;object-position:center 30%}
.hero-ov{position:absolute;inset:0;background:linear-gradient(to top,rgba(18,19,21,.92) 0%,rgba(18,19,21,.45) 45%,rgba(18,19,21,.28) 100%)}
.hero-c{position:relative;z-index:2;width:100%;max-width:var(--max);margin:0 auto;padding:130px var(--g) 56px}
.hero-badges{display:flex;gap:10px;flex-wrap:wrap;margin-bottom:22px;opacity:0;animation:up .7s .1s forwards}
.hbadge{font-size:11.5px;font-weight:700;letter-spacing:1.4px;text-transform:uppercase;color:#fff;background:rgba(255,255,255,.14);border:1px solid rgba(255,255,255,.25);backdrop-filter:blur(6px);padding:8px 16px;border-radius:100px}
.hbadge.gold{background:var(--bronze);border-color:var(--bronze)}
.hero h1{font-size:clamp(34px,5vw,66px);font-weight:800;letter-spacing:-1px;color:#fff;max-width:900px;opacity:0;animation:up .8s .22s forwards}
.hero h1 span{color:#d8c19a}
.hero-sub{font-size:clamp(15.5px,1.4vw,18.5px);line-height:1.65;color:rgba(255,255,255,.78);max-width:660px;margin-top:20px;opacity:0;animation:up .8s .38s forwards}
.hero-sub strong{color:#fff;font-weight:600}
.hero-btns{display:flex;gap:12px;flex-wrap:wrap;margin-top:32px;opacity:0;animation:up .8s .52s forwards}
.hero-stats{position:relative;z-index:2;border-top:1px solid rgba(255,255,255,.16);opacity:0;animation:fade .9s .9s forwards}
.hero-stats-in{max-width:var(--max);margin:0 auto;padding:0 var(--g);display:grid;grid-template-columns:repeat(4,1fr)}
.hstat{padding:24px 26px 26px 0;border-right:1px solid rgba(255,255,255,.12)}
.hstat:last-child{border-right:none}
.hstat+.hstat{padding-left:26px}
.hstat-n{font-family:var(--h);font-weight:800;font-size:clamp(26px,2.6vw,36px);color:#fff;line-height:1.1}
.hstat-n small{font-size:.55em;font-weight:600;color:#d8c19a}
.hstat-l{font-size:12.5px;color:rgba(255,255,255,.55);margin-top:4px}
.uses{background:var(--granite);padding:84px 0}
.uses .lbl{color:#d8c19a}
.uses .lbl::before{background:#d8c19a}
.uses h2{color:#fff}
.uses .sub{color:rgba(255,255,255,.55)}
.uses-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:14px;margin-top:44px}
.ucard{background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.1);border-radius:16px;padding:30px 26px;transition:background .25s,border-color .25s}
.ucard:hover{background:rgba(255,255,255,.09);border-color:rgba(216,193,154,.45)}
.ucard-ic{width:46px;height:46px;border-radius:12px;background:rgba(216,193,154,.14);display:flex;align-items:center;justify-content:center;margin-bottom:20px}
.ucard-ic svg{width:22px;height:22px;stroke:#d8c19a}
.ucard h3{font-size:18px;font-weight:700;color:#fff;margin-bottom:10px}
.ucard p{font-size:13.5px;line-height:1.65;color:rgba(255,255,255,.52)}
.uses-note{margin-top:26px;font-size:13px;color:rgba(255,255,255,.4)}
.lots{padding:104px 0;background:var(--stone-50)}
.lots-head{display:flex;align-items:flex-end;justify-content:space-between;gap:24px;flex-wrap:wrap;margin-bottom:46px}
.lot{display:grid;grid-template-columns:1.05fr 1fr;gap:0;background:#fff;border:1px solid var(--line);border-radius:22px;overflow:hidden;margin-bottom:32px}
.lot.lot-noplan{grid-template-columns:1fr}
.lot-plan{position:relative;background:#fbfaf8;border-right:1px solid var(--line);display:flex;align-items:center;justify-content:center;padding:34px;min-height:420px;cursor:zoom-in}
.lot-plan img{max-height:460px;width:auto;max-width:100%;object-fit:contain}
.lot-plan-hint{position:absolute;right:16px;bottom:14px;font-size:11px;font-weight:600;letter-spacing:1px;text-transform:uppercase;color:var(--muted);background:#fff;border:1px solid var(--line);border-radius:100px;padding:6px 13px}
.lot-info{padding:42px 44px;display:flex;flex-direction:column}
.lot-tag{display:inline-flex;align-self:flex-start;font-size:11px;font-weight:700;letter-spacing:1.6px;text-transform:uppercase;color:var(--ok);background:rgba(46,125,79,.1);padding:7px 14px;border-radius:100px;margin-bottom:18px}
.lot h3{font-size:clamp(24px,2.4vw,32px);font-weight:800;letter-spacing:-.4px}
.lot-area{font-size:15px;color:var(--muted);margin-top:6px}
.lot-feats{list-style:none;margin:24px 0;display:grid;grid-template-columns:1fr 1fr;gap:11px 20px}
.lot-feats li{font-size:14px;color:var(--ink);display:flex;gap:9px;align-items:flex-start;line-height:1.45}
.lot-feats li::before{content:'';width:6px;height:6px;border-radius:50%;background:var(--bronze);flex-shrink:0;margin-top:7px}
.lot-price{display:flex;gap:36px;flex-wrap:wrap;border-top:1px solid var(--line);padding-top:22px;margin-top:auto}
.lp-l{font-size:11px;font-weight:700;letter-spacing:1.6px;text-transform:uppercase;color:var(--muted);margin-bottom:5px}
.lp-v{font-family:var(--h);font-size:24px;font-weight:800}
.lot-btns{display:flex;gap:10px;flex-wrap:wrap;margin-top:26px}
.bld{background:#fff;padding:104px 0;border-top:1px solid var(--line)}
.bld-grid{display:grid;grid-template-columns:1fr 1fr;gap:64px;align-items:center}
.bld-imgs{display:grid;grid-template-columns:1fr 1fr;gap:14px}
.bld-imgs img{width:100%;aspect-ratio:4/5;height:auto;object-fit:cover;border-radius:16px;box-shadow:0 24px 60px -30px rgba(27,29,31,.45)}
.specs{margin-top:36px;display:grid;grid-template-columns:1fr 1fr;gap:0}
.spec{display:flex;gap:14px;align-items:flex-start;padding:16px 18px 16px 0;border-top:1px solid var(--line)}
.spec-ic{width:38px;height:38px;border-radius:10px;background:var(--stone-100);display:flex;align-items:center;justify-content:center;flex-shrink:0}
.spec-ic svg{width:19px;height:19px;stroke:var(--bronze-d)}
.spec b{display:block;font-size:14.5px;font-weight:700}
.spec span{font-size:12.5px;color:var(--muted)}
.facade-note{margin-top:30px;background:var(--stone-100);border-left:3px solid var(--bronze);border-radius:0 12px 12px 0;padding:18px 22px;font-size:14px;line-height:1.7;color:var(--ink)}
.facade-note b{font-weight:700}
.invest{background:var(--stone-100);padding:104px 0}
.inv-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:14px;margin-top:44px}
.inv{background:#fff;border:1px solid var(--line);border-radius:18px;padding:32px 30px}
.inv-n{font-family:var(--h);font-size:14px;font-weight:800;color:var(--bronze);margin-bottom:14px}
.inv h3{font-size:19px;font-weight:800;margin-bottom:10px;letter-spacing:-.2px}
.inv p{font-size:14px;line-height:1.7;color:var(--muted)}
.inv-strip{margin-top:38px;background:var(--granite);border-radius:18px;padding:30px 36px;display:flex;align-items:center;justify-content:space-between;gap:26px;flex-wrap:wrap}
.inv-strip p{color:rgba(255,255,255,.82);font-size:15.5px;max-width:640px;line-height:1.65}
.inv-strip p b{color:#fff}
.prog{background:#fff;padding:104px 0;border-top:1px solid var(--line)}
.prog-grid{display:grid;grid-template-columns:1fr 1fr;gap:64px;align-items:center}
.prog-img img{border-radius:18px;box-shadow:0 24px 60px -30px rgba(27,29,31,.4)}
.tl{margin-top:36px;list-style:none}
.tl li{display:flex;gap:18px;padding:0 0 26px;position:relative}
.tl li::before{content:'';position:absolute;left:11px;top:26px;bottom:0;width:2px;background:var(--line)}
.tl li:last-child::before{display:none}
.tl-dot{width:24px;height:24px;border-radius:50%;border:2px solid var(--line);background:#fff;flex-shrink:0;display:flex;align-items:center;justify-content:center;font-size:11px;color:#fff;z-index:1}
.tl li.done .tl-dot{background:var(--ok);border-color:var(--ok)}
.tl li.now .tl-dot{background:var(--bronze);border-color:var(--bronze);box-shadow:0 0 0 5px rgba(168,128,76,.18)}
.tl b{display:block;font-size:15px;font-weight:700}
.tl span{font-size:13px;color:var(--muted)}
.tl li.now b{color:var(--bronze-d)}
.loc{background:var(--stone-50);padding:104px 0}
.loc-grid{display:grid;grid-template-columns:1fr 1.15fr;gap:56px;align-items:start}
.loc-list{list-style:none;margin-top:32px}
.loc-list li{display:flex;justify-content:space-between;gap:20px;padding:15px 0;border-top:1px solid var(--line);font-size:14.5px}
.loc-list li:last-child{border-bottom:1px solid var(--line)}
.loc-list span{color:var(--muted)}
.loc-list b{font-weight:700;white-space:nowrap}
.loc-addr{margin-top:28px;display:flex;gap:14px;align-items:flex-start}
.loc-addr svg{width:22px;height:22px;stroke:var(--bronze);flex-shrink:0;margin-top:2px}
.loc-addr b{display:block;font-size:16px;font-weight:700}
.loc-addr span{font-size:13.5px;color:var(--muted)}
.map{border-radius:20px;overflow:hidden;border:1px solid var(--line);box-shadow:0 24px 60px -34px rgba(27,29,31,.4);aspect-ratio:4/3;background:var(--stone-200)}
.map iframe{width:100%;height:100%;border:0;display:block}
.lead{background:var(--granite);padding:110px 0}
.lead-grid{display:grid;grid-template-columns:1fr 1fr;gap:70px;align-items:start}
.lead .lbl{color:#d8c19a}
.lead .lbl::before{background:#d8c19a}
.lead h2{color:#fff}
.lead .sub{color:rgba(255,255,255,.55)}
.lead-contacts{margin-top:38px;display:flex;flex-direction:column;gap:6px}
.lc{display:flex;align-items:center;gap:16px;padding:15px 0;border-top:1px solid rgba(255,255,255,.1);text-decoration:none;transition:opacity .2s}
.lc:hover{opacity:.75}
.lc-ic{width:42px;height:42px;border-radius:12px;background:rgba(255,255,255,.08);display:flex;align-items:center;justify-content:center;flex-shrink:0}
.lc-ic svg{width:20px;height:20px;stroke:#d8c19a}
.lc b{display:block;font-size:15px;font-weight:700;color:#fff}
.lc span{font-size:12.5px;color:rgba(255,255,255,.45)}
.form-card{background:#fff;border-radius:22px;padding:42px 40px;box-shadow:0 40px 90px -40px rgba(0,0,0,.55)}
.form-card h3{font-size:22px;font-weight:800;margin-bottom:6px}
.form-card>p,.form-card form>p{font-size:13.5px;color:var(--muted);margin-bottom:26px}
.frow{display:grid;grid-template-columns:1fr 1fr;gap:14px}
.fg{margin-bottom:14px}
.fg label{display:block;font-size:12px;font-weight:700;letter-spacing:.6px;text-transform:uppercase;color:var(--muted);margin-bottom:7px}
.fg input,.fg select,.fg textarea{width:100%;font-family:var(--b);font-size:15px;color:var(--ink);background:var(--stone-50);border:1.5px solid var(--line);border-radius:11px;padding:13px 15px;outline:none;transition:border-color .2s,background .2s;-webkit-appearance:none;appearance:none}
.fg select{background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='8'%3E%3Cpath d='M1 1l5 5 5-5' stroke='%2366696e' stroke-width='2' fill='none'/%3E%3C/svg%3E");background-repeat:no-repeat;background-position:right 15px center;padding-right:38px}
.fg input:focus,.fg select:focus,.fg textarea:focus{border-color:var(--bronze);background:#fff}
.fg textarea{resize:vertical;min-height:84px}
.form-btn{width:100%;padding:16px;font-size:15px;border-radius:12px;margin-top:6px}
.form-note{font-size:11.5px;color:var(--muted);text-align:center;margin-top:14px;line-height:1.55}
.form-ok{display:none;text-align:center;padding:34px 10px}
.form-ok.show{display:block}
.form-ok-ic{width:64px;height:64px;border-radius:50%;background:rgba(46,125,79,.12);display:flex;align-items:center;justify-content:center;margin:0 auto 18px}
.form-ok-ic svg{width:30px;height:30px;stroke:var(--ok)}
.form-ok h4{font-family:var(--h);font-size:20px;font-weight:800;margin-bottom:8px}
.form-ok p{font-size:14px;color:var(--muted)}
.form-err{display:none;margin-top:14px;font-size:13.5px;line-height:1.6;color:#9b3535;background:rgba(176,53,53,.08);border-radius:10px;padding:12px 16px}
.form-err.show{display:block}
.form-err a{font-weight:600}
.hp{position:absolute;left:-9999px;opacity:0;height:0;overflow:hidden}
.faq{background:var(--stone-50);padding:104px 0}
.faq-list{max-width:820px;margin:40px auto 0}
details{border-top:1px solid var(--line)}
details:last-child{border-bottom:1px solid var(--line)}
summary{list-style:none;cursor:pointer;display:flex;justify-content:space-between;align-items:center;gap:20px;padding:22px 4px;font-family:var(--h);font-size:16.5px;font-weight:700}
summary::-webkit-details-marker{display:none}
summary::after{content:'+';font-size:24px;font-weight:400;color:var(--bronze);transition:transform .25s;flex-shrink:0;line-height:1}
details[open] summary::after{transform:rotate(45deg)}
details p{padding:0 4px 22px;font-size:14.5px;line-height:1.75;color:var(--muted);max-width:720px}
footer{background:var(--granite);padding:46px 0 40px;border-top:1px solid rgba(255,255,255,.08)}
.foot{display:flex;align-items:flex-start;justify-content:space-between;gap:30px;flex-wrap:wrap}
.foot-l .brand-n{color:#fff}
.foot-l .brand-s{color:rgba(255,255,255,.4)}
.foot-r{font-size:12px;color:rgba(255,255,255,.35);max-width:460px;line-height:1.7;text-align:right}
.foot-r a{color:rgba(255,255,255,.6);text-decoration:none}
.mcta{display:none;position:fixed;left:0;right:0;bottom:0;z-index:380;background:rgba(246,245,242,.97);backdrop-filter:blur(10px);border-top:1px solid var(--line);padding:10px 14px calc(10px + env(safe-area-inset-bottom));grid-template-columns:1fr 1fr;gap:10px}
.mcta .btn{width:100%}
.lb{position:fixed;inset:0;z-index:500;background:rgba(18,19,21,.92);display:none;align-items:center;justify-content:center;padding:30px;cursor:zoom-out}
.lb.open{display:flex}
.lb img{max-width:100%;max-height:92vh;border-radius:12px;background:#fff}
@keyframes up{from{opacity:0;transform:translateY(26px)}to{opacity:1;transform:none}}
@keyframes fade{from{opacity:0}to{opacity:1}}
.r{opacity:0;transform:translateY(28px);transition:opacity .7s ease,transform .7s ease}
.r.in{opacity:1;transform:none}
.d1{transition-delay:.08s}.d2{transition-delay:.16s}.d3{transition-delay:.24s}
@media (prefers-reduced-motion: reduce){.r,.hero-badges,.hero h1,.hero-sub,.hero-btns,.hero-stats{opacity:1!important;transform:none!important;animation:none!important;transition:none!important}}
@media(max-width:1060px){:root{--g:22px}
.nl{display:none}
.nav-r .btn{display:none}
.burger{display:flex}
.hero-stats-in{grid-template-columns:1fr 1fr}
.hstat{padding:18px 16px 18px 0}
.hstat+.hstat{padding-left:16px}
.hstat:nth-child(2){border-right:none}
.uses-grid{grid-template-columns:1fr 1fr}
.lot{grid-template-columns:1fr}
.lot-plan{border-right:none;border-bottom:1px solid var(--line);min-height:300px;padding:22px}
.lot-plan img{max-height:360px}
.lot-info{padding:30px 24px}
.bld-grid,.prog-grid,.loc-grid,.lead-grid{grid-template-columns:1fr;gap:40px}
.inv-grid{grid-template-columns:1fr}
.form-card{padding:30px 22px}
.foot-r{text-align:left}
.mcta{display:grid}
body{padding-bottom:74px}}
@media(max-width:640px){.nav-tel{display:none}
.brand-n{font-size:14px}
.brand-s{font-size:8.5px;letter-spacing:1.1px}}
@media(max-width:560px){.frow{grid-template-columns:1fr}
.lot-feats{grid-template-columns:1fr}
.specs{grid-template-columns:1fr}
.hero-btns .btn{width:100%}
.uses-grid{grid-template-columns:1fr}
.bld-imgs{grid-template-columns:1fr}}
`;

// ─── клиентский JS: i18n + навигация + лайтбокс ───
const RUNTIME_JS = `
var CUR = 'ru';
var RU = {};
var i18nEls = document.querySelectorAll('[data-i18n]');
i18nEls.forEach(function(el){ if (!(el.dataset.i18n in RU)) RU[el.dataset.i18n] = el.innerHTML; });
var phEls = document.querySelectorAll('[data-i18n-ph]');
phEls.forEach(function(el){ RU['ph.' + el.dataset.i18nPh] = el.placeholder; });
RU['meta.title'] = document.title;
var metaDesc = document.querySelector('meta[name="description"]');
RU['meta.desc'] = metaDesc ? metaDesc.content : '';
RU['form.sending'] = (typeof SENDING_RU !== 'undefined' && SENDING_RU) ? SENDING_RU : 'Отправляем…';

function tr(key){ return CUR === 'ru' ? RU[key] : (I18N[CUR][key] || RU[key]); }

function setLang(l){
  if (l !== 'ru' && !I18N[l]) l = 'ru';
  CUR = l;
  document.documentElement.lang = l;
  i18nEls.forEach(function(el){ el.innerHTML = tr(el.dataset.i18n); });
  phEls.forEach(function(el){ el.placeholder = tr('ph.' + el.dataset.i18nPh); });
  document.title = tr('meta.title');
  if (metaDesc) metaDesc.content = tr('meta.desc');
  document.querySelectorAll('#langSw button').forEach(function(b){ b.classList.toggle('on', b.dataset.lang === l); });
  try { localStorage.setItem('site-lang', l); } catch(e){}
}
document.querySelectorAll('#langSw button').forEach(function(b){
  b.addEventListener('click', function(){ setLang(b.dataset.lang); });
});
try {
  var saved = localStorage.getItem('site-lang');
  if (saved && saved !== 'ru') setLang(saved);
} catch(e){}

var nav = document.getElementById('nav');
addEventListener('scroll', function(){ nav.classList.toggle('s', scrollY > 40); }, {passive:true});
var burger = document.getElementById('burger'), mmenu = document.getElementById('mmenu');
burger.addEventListener('click', function(){ mmenu.classList.toggle('open'); nav.classList.add('s'); });
mmenu.querySelectorAll('a').forEach(function(a){ a.addEventListener('click', function(){ mmenu.classList.remove('open'); }); });
var obs = new IntersectionObserver(function(es){
  es.forEach(function(e){ if(e.isIntersecting){ e.target.classList.add('in'); obs.unobserve(e.target);} });
},{threshold:.12});
document.querySelectorAll('.r').forEach(function(el){ obs.observe(el); });
document.querySelectorAll('[data-lot]').forEach(function(a){
  a.addEventListener('click', function(){
    var sel = document.getElementById('f-lot');
    for (var i=0;i<sel.options.length;i++){
      if (sel.options[i].value === a.dataset.lot){ sel.selectedIndex = i; break; }
    }
  });
});
var lb = document.getElementById('lb'), lbImg = document.getElementById('lbImg');
document.querySelectorAll('[data-zoom]').forEach(function(el){
  el.addEventListener('click', function(){ lbImg.src = el.dataset.zoom; lb.classList.add('open'); });
});
lb.addEventListener('click', function(){ lb.classList.remove('open'); lbImg.removeAttribute('src'); });
addEventListener('keydown', function(e){ if(e.key==='Escape') lb.classList.remove('open'); });
`;

const FORM_JS = `
var form = document.getElementById('leadForm'), btn = document.getElementById('formBtn'),
    ok = document.getElementById('formOk'), err = document.getElementById('formErr');
form.addEventListener('submit', function(e){
  e.preventDefault();
  err.classList.remove('show');
  var name = document.getElementById('f-name'), phone = document.getElementById('f-phone');
  if (!name.value.trim()){ name.focus(); name.style.borderColor='#b04545'; return; }
  if (!phone.value.trim()){ phone.focus(); phone.style.borderColor='#b04545'; return; }
  var email = document.getElementById('f-email');
  if (email.value && email.value.indexOf('@') === -1){ email.focus(); email.style.borderColor='#b04545'; return; }
  if (form.querySelector('.hp input, input.hp').value) return;

  btn.disabled = true; btn.textContent = tr('form.sending');
  var vals = {
    name: name.value.trim(),
    phone: phone.value.trim(),
    email: email.value.trim(),
    interest: document.getElementById('f-int').value,
    lot: document.getElementById('f-lot').value,
    message: document.getElementById('f-msg').value.trim(),
    lang: CUR
  };
  function done(){ form.style.display = 'none'; ok.classList.add('show'); }
  function fail(){ btn.disabled = false; btn.textContent = tr('form.send'); err.classList.add('show'); }
  // запасной канал: письмо напрямую + Google Таблица (если панель недоступна)
  function sendDirect(){
    if (SHEETS_ENDPOINT){
      try {
        var fd = new FormData();
        Object.keys(vals).forEach(function(k){ fd.append(k, vals[k]); });
        fetch(SHEETS_ENDPOINT, {method:'POST', mode:'no-cors', body: fd});
      } catch(ignored){}
    }
    if (!LEAD_EMAIL) return fail();
    var data = {
      'Имя': vals.name, 'Телефон': vals.phone, 'Email': vals.email || '—',
      'Интересует': vals.interest, 'Помещение': vals.lot, 'Комментарий': vals.message || '—',
      'Язык сайта': CUR.toUpperCase(),
      '_subject': LEAD_SUBJECT + ': ' + vals.interest + ', ' + vals.lot,
      '_template': 'table', '_captcha': 'false'
    };
    fetch('https://formsubmit.co/ajax/' + LEAD_EMAIL, {
      method: 'POST',
      headers: {'Content-Type':'application/json','Accept':'application/json'},
      body: JSON.stringify(data)
    }).then(function(r){
      if (!r.ok) throw new Error('http ' + r.status);
      return r.json();
    }).then(done).catch(fail);
  }
  // основной канал: CRM в админ-панели (панель сама пересылает лид на почту)
  if (LEAD_ENDPOINT){
    fetch(LEAD_ENDPOINT, {
      method: 'POST',
      headers: {'Content-Type':'application/json'},
      body: JSON.stringify(vals)
    }).then(function(r){
      if (!r.ok) throw new Error('http ' + r.status);
      return r.json();
    }).then(done).catch(sendDirect);
  } else sendDirect();
});
['f-name','f-phone','f-email'].forEach(function(id){
  document.getElementById(id).addEventListener('input', function(){ this.style.borderColor=''; });
});
`;

module.exports = { renderLanding };
