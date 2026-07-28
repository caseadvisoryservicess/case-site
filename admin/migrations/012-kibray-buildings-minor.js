/**
 * Правка 012: у участка в Кибрае акцент на землю и назначение, строения - второстепенно.
 *
 * Владелец: площадь существующих строений не значимая цифра, упомянуть где-то
 * коротко; главное - размер самой земли целиком и назначение проекта (дата-центр).
 *
 * Что делаем:
 *  1. Из фактов героя убираем «2 269,0 м² строений» - место занимала цифра,
 *     которая покупателю площадки под ЦОД ничего не решает.
 *  2. В «Об участке» строка про строения ужимается до одной фразы без метража
 *     и уезжает в конец списка; вместо неё наверх поднимается назначение.
 *  3. В вопросе «Что именно продаётся?» первым идёт земля и назначение,
 *     строения - в конце одной фразой.
 *  4. Точные метражи остаются ровно в одном месте - в отдельном вопросе
 *     «Что со строениями на участке?», где они уместны и никому не мешают.
 *
 * Идемпотентна. Запуск: node migrations/012-kibray-buildings-minor.js [slug]
 */
'use strict';
const fs = require('fs');
const path = require('path');

const slug = process.argv[2] || 'kibray-dc';
const FILE = path.join(__dirname, '..', 'data', 'projects', slug, 'project.json');
const cfg = JSON.parse(fs.readFileSync(FILE, 'utf8'));
if (!(cfg.schemaVersion >= 2)) { console.error('Проект не на схеме v2'); process.exit(1); }

const ml = (ru, uz, en) => ({ ru, uz, en });
const ruOf = (v) => (v && typeof v === 'object' ? v.ru : v) || '';
let changes = 0;

// 1) факты героя: строения уходят, остаются земля, связь и расстояние
const facts = (cfg.intro && cfg.intro.facts) || [];
const bIdx = facts.findIndex((f) => /строени/i.test(ruOf(f.l)));
if (bIdx >= 0) {
  facts.splice(bIdx, 1); changes++;
  console.log('✓ факт героя про строения убран, осталось фактов:', facts.length);
}
// площадь участка первым фактом и с полной подписью
if (facts[0] && /га/.test(ruOf(facts[0].l))) {
  const wantL = ml('га земли, 65 000 м²', 'ga yer, 65 000 m²', 'hectares of land, 65,000 m²');
  if (JSON.stringify(facts[0].l) !== JSON.stringify(wantL)) {
    facts[0].l = wantL; changes++;
    console.log('✓ подпись главного факта: «га земли, 65 000 м²»');
  }
}

// 2) «Об участке»: назначение наверх, строения одной строкой в конец
const specs = (cfg.about && cfg.about.specs) || [];
const sIdx = specs.findIndex((s) => /Строения/i.test(ruOf(s.b)));
if (sIdx >= 0) {
  const row = specs[sIdx];
  const wantS = ml('два капитальных строения, в собственности, входят в сделку',
                   'ikkita kapital inshoot, mulk huquqida, bitimga kiradi',
                   'two permanent structures, held freehold, included in the deal');
  if (JSON.stringify(row.s) !== JSON.stringify(wantS)) { row.s = wantS; changes++; console.log('✓ «Об участке»: строения одной фразой, без метража'); }
  if (sIdx !== specs.length - 1) {
    specs.splice(sIdx, 1); specs.push(row); changes++;
    console.log('✓ строка про строения перенесена в конец списка');
  }
}
// назначение участка - отдельной строкой сразу после площади
if (!specs.some((s) => /Назначение/i.test(ruOf(s.b)))) {
  const row = {
    b: ml('Назначение проекта', 'Loyiha maqsadi', 'Intended use'),
    s: ml('площадка под дата-центр: концепция и проектная документация разработаны',
          'data-markaz uchun maydon: konsepsiya va loyiha hujjatlari ishlab chiqilgan',
          'a data center site: concept and design documentation prepared')
  };
  specs.splice(1, 0, row); changes++;
  console.log('✓ «Об участке»: добавлена строка «Назначение проекта»');
}

// 3) вопрос «Что именно продаётся?»: земля и назначение впереди
const items = Array.isArray(cfg.faq) ? cfg.faq : (cfg.faq && cfg.faq.items) || [];
const q1 = items.find((q) => /Что именно прода/i.test(ruOf(q.q)));
if (q1) {
  const want = ml(
    'Земельный участок 65 000 м² (6,5 га) с правом постоянного пользования, подготовленный под размещение дата-центра: подведены две независимые линии оптоволокна, разработаны концепция и проектная документация. Всё зарегистрировано в Государственном реестре, кадастровый номер 11:05:41:01:02:0105. В сделку также входят два капитальных строения на участке.',
    '65 000 m² (6,5 ga) yer uchastkasi doimiy foydalanish huquqi bilan, data-markaz joylashtirish uchun tayyorlangan: ikkita mustaqil optik tolali liniya tortilgan, konsepsiya va loyiha hujjatlari ishlab chiqilgan. Barchasi Davlat reyestrida ro\'yxatdan o\'tgan, kadastr raqami 11:05:41:01:02:0105. Bitimga uchastkadagi ikkita kapital inshoot ham kiradi.',
    'A 65,000 m² (6.5 ha) land plot held under permanent use, prepared for a data center: two independent fibre routes are already in place and the concept and design documentation have been completed. Everything is registered in the State Register, cadastral number 11:05:41:01:02:0105. Two permanent structures on the plot are included in the deal.');
  if (JSON.stringify(q1.a) !== JSON.stringify(want)) {
    q1.a = want; changes++;
    console.log('✓ вопрос «Что именно продаётся?»: сначала земля и назначение');
  }
}

// 4) карточка сценария: метраж строений оттуда тоже убираем
const cards = (cfg.useCases && cfg.useCases.cards) || [];
const cIT = cards.find((c) => /строени/i.test(ruOf(c.p)));
if (cIT) {
  const want = ml(
    'На участке есть два капитальных строения, оформленные в собственность. Их можно задействовать под офис стройки, охрану и склад на период работ либо снести под новую планировку - решение за проектом покупателя.',
    'Uchastkada mulk huquqida rasmiylashtirilgan ikkita kapital inshoot bor. Ularni ish davrida qurilish ofisi, qo\'riqxona va ombor sifatida ishlatish yoki yangi planirovka uchun buzib tashlash mumkin - qaror xaridor loyihasiga bog\'liq.',
    'There are two permanent structures on the plot, both held freehold. They can serve as a site office, security post and storage during construction, or be demolished to free the layout - that is for the buyer\'s design to decide.');
  if (JSON.stringify(cIT.p) !== JSON.stringify(want)) {
    cIT.p = want; changes++;
    console.log('✓ карточка сценария: метраж строений убран');
  }
}

if (changes) {
  fs.writeFileSync(FILE, JSON.stringify(cfg, null, 2));
  console.log('Готово:', FILE);
} else {
  console.log('Изменений нет: правка уже применена.');
}
