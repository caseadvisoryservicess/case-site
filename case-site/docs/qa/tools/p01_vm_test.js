/* CASE OS v4.33.0 — VM-тест P0-1: неизменяемый снапшот версии планировки + генерация LCR строго из снапшота.
   Запуск: node p01_vm_test.js /path/to/os
   Извлекает P0-1-блок и planDiff из index.html, загружает v417-master-plan.js в песочницу и
   прогоняет сценарии ядра без браузера/БД. Пишет JSON-результат в stdout. */
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const OS_DIR = process.argv[2] || '.';
const html = (function(){var i=fs.readFileSync(path.join(OS_DIR,'index.html'),'utf8');var c=path.join(OS_DIR,'core.js');return i+(fs.existsSync(c)?fs.readFileSync(c,'utf8'):'');})(); /* v4.49: ядро вынесено в core.js — читаем оба файла */
const v417 = fs.readFileSync(path.join(OS_DIR, 'v417-master-plan.js'), 'utf8');

/* ---- извлечение кода из index.html ---- */
function slice(from, to, name) {
  const a = html.indexOf(from);
  if (a < 0) throw new Error('не найден маркер: ' + name + ' (' + from.slice(0, 40) + '…)');
  const b = html.indexOf(to, a);
  if (b < 0) throw new Error('не найден конец: ' + name);
  return html.slice(a, b + to.length);
}
const p01Block = slice('/* ===== P0-1:', '/* ===== /P0-1 ===== */', 'P0-1 core');
const planDiffSrc = slice('function planDiff(objId,block,floor,labels)', 'return {onlyOnPlan,onlyInReg,areaDiff};}', 'planDiff');

/* ---- песочница ---- */
function makeSandbox() {
  const sb = {};
  sb.window = sb;
  sb.console = console;
  sb.JSON = JSON; sb.Object = Object; sb.Array = Array; sb.Math = Math; sb.Date = Date; sb.String = String; sb.Number = Number;
  sb.PLAN_CODES = {};
  sb.PLANSVG = {};
  sb.PLAN_STRUCT = {};
  sb.PLAN_SNAPSHOT_SVGS = {};
  sb.PLAN_IGNORED_CODES = {};
  sb.CASE_LAYOUT_VERSIONS = [];
  sb.LEASE_COMMISSION_DEALS = [];
  sb.U = [];
  sb.TODAY = new Date('2026-07-24');
  sb.iso = d => '2026-07-24';
  sb.S = { user: { name: 'VM Тест' }, obj: 'p1', view: '' };
  sb.R = () => ({ admin: true, edit: true, plans: true, leasing: true });
  sb.objById = id => ({ id, name: 'Проект ' + id });
  sb.audit = (a, d) => { sb._auditLog.push([a, d]); };
  sb._auditLog = [];
  sb.persist = () => { sb._persisted = (sb._persisted || 0) + 1; };
  sb.apiSaveState = () => {};
  sb.toast = () => {};
  sb.alert = m => { sb._alerts.push(String(m)); };
  sb._alerts = [];
  sb.confirm = () => true;
  sb.esc = v => String(v == null ? '' : v);
  sb.fmtA = n => String(Math.round(+n || 0));
  sb.LANG = 'ru';
  sb.document = { readyState: 'complete', getElementById: () => null, addEventListener: () => {}, querySelectorAll: () => [] };
  sb.unitsOf = pid => sb.U.filter(u => u.obj === pid);
  sb.floorLabel = f => String(f || '');
  sb.unitBlock = u => u.block || '';
  sb.planIsIgnored = () => false;
  let uidc = 0;
  sb.unit = (o, code, floor, area, terr, cat, sub, rate, total, gap, status, broker, vars, dates, comment, merged) =>
    ({ id: 'u' + (++uidc), obj: o, code, floor, area, terr, cat, sub, rate: rate || 0, total, gap, status, broker, vars: vars || [], dates: dates || [], comment: comment || '', merged: merged || null, hist: [] });
  vm.createContext(sb);
  vm.runInContext(p01Block, sb, { filename: 'index.html#P0-1' });
  vm.runInContext(planDiffSrc, sb, { filename: 'index.html#planDiff' });
  vm.runInContext(v417, sb, { filename: 'v417-master-plan.js' });
  return sb;
}

/* ---- планы-фикстуры ---- */
function loadPlanA(sb) { // 3 юнита
  sb.PLAN_CODES['p1::A::1 этаж'] = [{ code: 'A-101', area: 120 }, { code: 'A-102', area: 80 }];
  sb.PLAN_CODES['p1::A::2 этаж'] = [{ code: 'A-201', area: 200 }];
  sb.PLAN_STRUCT['p1'] = { blocks: ['A'], floors: { A: ['1 этаж', '2 этаж'] } };
  sb.PLANSVG['p1::A::1 этаж'] = '<svg id="planA1">…A1…</svg>';
  sb.PLANSVG['p1::A::2 этаж'] = '<svg id="planA2">…A2…</svg>';
}
function loadPlanB(sb) { // чертёж переработан: другой состав и площади
  sb.PLAN_CODES['p1::A::1 этаж'] = [{ code: 'A-101', area: 150 }, { code: 'B-777', area: 55 }];
  delete sb.PLAN_CODES['p1::A::2 этаж'];
  sb.PLANSVG['p1::A::1 этаж'] = '<svg id="planB1">…B1…</svg>';
  delete sb.PLANSVG['p1::A::2 этаж'];
}

/* ---- раннер ---- */
const results = [];
let sb;
function test(name, fn) {
  try { fn(); results.push({ test: name, status: 'PASS' }); }
  catch (e) { results.push({ test: name, status: 'FAIL', error: String(e && e.message || e) }); }
}
function eq(a, b, msg) { if (a !== b) throw new Error((msg || 'eq') + ': ' + JSON.stringify(a) + ' !== ' + JSON.stringify(b)); }
function ok(v, msg) { if (!v) throw new Error(msg || 'assertion failed'); }

/* 1. Снапшот: сборка, состав, контрольная сумма, SVG-дедуп */
sb = makeSandbox();
loadPlanA(sb);
test('снапшот собирается: коды, структура, svgRefs, checksum, автор/дата', () => {
  const sn = sb.planSnapshotBuild('p1');
  eq(sn.plans, 2, 'plans');
  eq(sn.codes, 3, 'codes');
  ok(/^[0-9a-f]{8}$/.test(sn.checksum), 'checksum формата hex8: ' + sn.checksum);
  ok(sn.struct && sn.struct.blocks.join(',') === 'A', 'struct.blocks');
  eq(Object.keys(sn.svgRefs).length, 2, 'svgRefs');
  const h1 = sn.svgRefs['p1::A::1 этаж'];
  eq(sb.PLAN_SNAPSHOT_SVGS[h1], '<svg id="planA1">…A1…</svg>', 'SVG в дедуп-хранилище');
  eq(sn.frozenBy, 'VM Тест', 'frozenBy');
  eq(sn.frozenAt, '2026-07-24', 'frozenAt');
});
test('снапшот заморожен: мутации не проходят (deep freeze)', () => {
  const sn = sb.planSnapshotBuild('p1');
  ok(Object.isFrozen(sn), 'frozen root');
  ok(Object.isFrozen(sn.planCodes), 'frozen planCodes');
  ok(Object.isFrozen(sn.planCodes['p1::A::1 этаж']), 'frozen labels array');
  ok(Object.isFrozen(sn.planCodes['p1::A::1 этаж'][0]), 'frozen label object');
  try { sn.checksum = 'hacked'; } catch (e) {}
  try { sn.planCodes['p1::A::1 этаж'][0].area = 9999; } catch (e) {}
  ok(sn.checksum !== 'hacked', 'checksum неизменен');
  eq(sn.planCodes['p1::A::1 этаж'][0].area, 120, 'площадь в снапшоте неизменна');
});
test('checksum детерминирован и реагирует на изменение чертежа', () => {
  const c1 = sb.planCurrentChecksum('p1');
  const c2 = sb.planCurrentChecksum('p1');
  eq(c1, c2, 'детерминизм');
  sb.PLAN_CODES['p1::A::1 этаж'][0].area = 121;
  ok(sb.planCurrentChecksum('p1') !== c1, 'изменение площади меняет checksum');
  sb.PLAN_CODES['p1::A::1 этаж'][0].area = 120;
  eq(sb.planCurrentChecksum('p1'), c1, 'возврат данных возвращает checksum');
});
test('одинаковый SVG не дублируется в хранилище (дедуп по хешу)', () => {
  const before = Object.keys(sb.PLAN_SNAPSHOT_SVGS).length;
  sb.planSnapshotBuild('p1');
  sb.planSnapshotBuild('p1');
  eq(Object.keys(sb.PLAN_SNAPSHOT_SVGS).length, before, 'нет новых записей при повторной фиксации того же чертежа');
});

/* 2. Изоляция снапшота от живого PLAN_CODES */
sb = makeSandbox();
loadPlanA(sb);
test('изменение PLAN_CODES после фиксации не влияет на снапшот', () => {
  const v1 = sb.planVersionForCurrent('p1');
  const snap = v1.snapshot;
  const csA = snap.checksum;
  loadPlanB(sb);
  eq(snap.planCodes['p1::A::1 этаж'][0].area, 120, 'площадь A-101 в снапшоте прежняя');
  ok(snap.planCodes['p1::A::2 этаж'], '2 этаж остался в снапшоте');
  eq(snap.checksum, csA, 'checksum снапшота прежний');
  ok(sb.planCurrentChecksum('p1') !== csA, 'текущий чертёж теперь другой (drift)');
});

/* 3. lcrScan: снапшот против живого чертежа */
sb = makeSandbox();
loadPlanA(sb);
test('lcrScan(ver) читает снапшот, lcrScan() — живой чертёж', () => {
  const v1 = sb.planVersionForCurrent('p1');
  loadPlanB(sb);
  const t = sb.masterTab; // модуль загружен
  ok(typeof sb.masterLcrApply === 'function', 'masterLcrApply есть');
  // прямого доступа к lcrScan нет (замыкание) — проверяем через применение ниже; здесь проверяем данные снапшота
  eq(v1.snapshot.planCodes['p1::A::1 этаж'].length, 2, 'в снапшоте A: 2 кода на 1 этаже');
  eq(sb.PLAN_CODES['p1::A::1 этаж'].length, 2, 'вживую: 2 кода (A-101, B-777)');
  ok(sb.PLAN_CODES['p1::A::1 этаж'].some(l => l.code === 'B-777'), 'вживую есть B-777');
  ok(!v1.snapshot.planCodes['p1::A::1 этаж'].some(l => l.code === 'B-777'), 'в снапшоте B-777 нет');
});

/* 4. Генерация строго из снапшота выбранной версии */
sb = makeSandbox();
loadPlanA(sb);
test('masterLcrApply создаёт юниты из СНАПШОТА, а не из текущего чертежа', () => {
  const v1 = sb.planVersionForCurrent('p1');
  loadPlanB(sb); // чертёж уже другой
  sb.masterLcrApply('p1', { versionId: v1.id });
  const codes = sb.U.map(u => u.code).sort();
  eq(JSON.stringify(codes), JSON.stringify(['A-101', 'A-102', 'A-201']), 'созданы юниты плана A');
  ok(!sb.U.some(u => u.code === 'B-777'), 'B-777 (из нового чертежа) НЕ создан');
  const u101 = sb.U.find(u => u.code === 'A-101');
  eq(u101.area, 120, 'площадь A-101 из снапшота (120), не из нового чертежа (150)');
  eq(u101.layoutVersionId, v1.id, 'привязка к версии');
  eq(u101.snapshotChecksum, v1.snapshot.checksum, 'привязка к checksum снапшота');
  eq(u101.genStatus, 'generated', 'genStatus');
  ok(u101.hist.some(hh => String(hh[1]).indexOf('#' + v1.snapshot.checksum) >= 0), 'история юнита содержит checksum');
});
test('переключение версии-источника меняет результат генерации', () => {
  const v2 = sb.planVersionForCurrent('p1'); // теперь план B → новая версия
  ok(v2.id !== sb.CASE_LAYOUT_VERSIONS[0].id, 'создана вторая версия');
  eq(v2.active, true, 'новая версия активна');
  sb.masterLcrApply('p1', { versionId: v2.id });
  const b = sb.U.find(u => u.code === 'B-777');
  ok(b, 'после генерации из v2 появился B-777');
  eq(b.layoutVersionId, v2.id, 'B-777 привязан к v2');
  const u101 = sb.U.find(u => u.code === 'A-101');
  eq(u101.area, 150, 'площадь A-101 обновлена по снапшоту v2 (150)');
  eq(u101.layoutVersionId, v2.id, 'A-101 перепривязан к v2');
});

/* 5. Legacy-версия без снапшота: заморозка при первой генерации */
sb = makeSandbox();
loadPlanA(sb);
test('версия без снапшота получает снапшот при первой генерации и дальше неизменна', () => {
  sb.CASE_LAYOUT_VERSIONS.push({ id: 'lv_legacy', projectId: 'p1', version: '1.0', type: 'leasing', status: 'working', active: true, handoverStatus: 'draft' });
  sb.masterLcrApply('p1', { versionId: 'lv_legacy' });
  const v = sb.CASE_LAYOUT_VERSIONS.find(x => x.id === 'lv_legacy');
  ok(v.snapshot, 'снапшот зафиксирован при генерации');
  eq(v.snapshot.checksum, sb.planCurrentChecksum('p1'), 'снапшот соответствует чертежу на момент генерации');
  eq(sb.U.length, 3, 'создано 3 юнита');
  const cs = v.snapshot.checksum;
  loadPlanB(sb);
  sb.masterLcrApply('p1', { versionId: 'lv_legacy' }); // повторная генерация из той же версии
  eq(v.snapshot.checksum, cs, 'повторная генерация НЕ перезаписала снапшот');
  ok(!sb.U.some(u => u.code === 'B-777'), 'повторная генерация из legacy-версии не подтянула новый чертёж');
});

/* 6. Защита коммерческих юнитов (P1-2: per-unit разрешение с причиной, массового override нет) */
sb = makeSandbox();
loadPlanA(sb);
test('P1-2: защищённый юнит не меняется без per-unit разрешения; меняется с allowIds+reason (причина в истории и аудите)', () => {
  const v1 = sb.planVersionForCurrent('p1');
  const prot = sb.unit('p1', 'A-101', '1 этаж', 100, 0, '', '', 10, 0, 0, 'neg', '', [], [], '');
  prot.block = 'A';
  sb.U.push(prot);
  sb.masterLcrApply('p1', { versionId: v1.id });
  eq(prot.area, 100, 'без разрешения площадь защищённого юнита не тронута');
  sb.masterLcrApply('p1', { versionId: v1.id, overrideProtected: true });
  eq(prot.area, 100, 'старый массовый overrideProtected больше НЕ действует');
  sb.masterLcrApply('p1', { versionId: v1.id, allowIds: [prot.id], reason: 'КП пересогласовано с арендатором' });
  eq(prot.area, 120, 'с per-unit разрешением площадь обновлена по снапшоту');
  ok(prot.hist.some(hh => String(hh[1]).indexOf('причина: КП пересогласовано с арендатором') >= 0), 'причина записана в историю юнита');
  ok(sb._auditLog.some(a => String(a[1]).indexOf('разрешены защищённые: 1') >= 0 && String(a[1]).indexOf('КП пересогласовано') >= 0), 'разрешение и причина в аудите');
});
test('P1-1: сделка защищает юнит по unitId; тот же код в ДРУГОМ проекте не защищает; сделка без привязок защищает консервативно', () => {
  // (a) точный unitId
  const ua = sb.U.find(u => u.code === 'A-102') || sb.unit('p1', 'A-102', '1 этаж', 50, 0, '', '', 0, 0, 0, 'vac', '', [], [], '');
  if (sb.U.indexOf(ua) < 0) { ua.block = 'A'; sb.U.push(ua); }
  ua.area = 50; ua.status = 'vac';
  sb.LEASE_COMMISSION_DEALS = [{ id: 'd1', unitId: ua.id, unit: 'A-102', objectName: 'Проект p1' }];
  const v1 = sb.CASE_LAYOUT_VERSIONS[0];
  sb.masterLcrApply('p1', { versionId: v1.id });
  eq(ua.area, 50, '(a) unitId-сделка защищает: площадь не тронута');
  // (b) тот же код, но сделка другого проекта — НЕ защищает
  sb.LEASE_COMMISSION_DEALS = [{ id: 'd2', unit: 'A-102', objectName: 'Проект p2' }];
  sb.masterLcrApply('p1', { versionId: v1.id });
  eq(ua.area, 80, '(b) сделка чужого проекта не защищает: площадь обновлена по снапшоту');
  // (c) сделка без unitId и объекта — консервативная защита по коду
  ua.area = 50;
  sb.LEASE_COMMISSION_DEALS = [{ id: 'd3', unit: 'A-102' }];
  sb.masterLcrApply('p1', { versionId: v1.id });
  eq(ua.area, 50, '(c) сделка без привязок защищает по коду (консервативно)');
  sb.LEASE_COMMISSION_DEALS = [];
});
test('юнит, которого нет в снапшоте, помечается genOrphan (не удаляется)', () => {
  const ghost = sb.unit('p1', 'X-999', '1 этаж', 33, 0, '', '', 0, 0, 0, 'vac', '', [], [], '');
  ghost.block = 'A';
  sb.U.push(ghost);
  const v1 = sb.CASE_LAYOUT_VERSIONS[0];
  sb.masterLcrApply('p1', { versionId: v1.id });
  ok(sb.U.some(u => u.code === 'X-999'), 'юнит не удалён');
  eq(sb.U.find(u => u.code === 'X-999').genOrphan, true, 'помечен genOrphan');
});

/* 7. planVersionForCurrent: переиспользование и drift */
sb = makeSandbox();
loadPlanA(sb);
test('planVersionForCurrent переиспользует версию с тем же checksum', () => {
  const v1 = sb.planVersionForCurrent('p1');
  const v1b = sb.planVersionForCurrent('p1');
  eq(v1.id, v1b.id, 'без изменений чертежа версия та же');
  eq(sb.CASE_LAYOUT_VERSIONS.length, 1, 'дубликат не создан');
});
test('drift чертежа ⇒ новая активная версия, старая деактивируется, снапшот старой цел', () => {
  const v1 = sb.CASE_LAYOUT_VERSIONS[0];
  const cs1 = v1.snapshot.checksum;
  loadPlanB(sb);
  const v2 = sb.planVersionForCurrent('p1');
  ok(v2.id !== v1.id, 'новая версия');
  eq(v2.active, true, 'v2 активна');
  eq(v1.active, false, 'v1 деактивирована');
  eq(v1.snapshot.checksum, cs1, 'снапшот v1 не изменился');
  eq(v2.snapshot.checksum, sb.planCurrentChecksum('p1'), 'снапшот v2 = текущий чертёж');
});
test('активная версия без снапшота получает заморозку вместо создания новой', () => {
  sb.CASE_LAYOUT_VERSIONS.forEach(v => { v.active = false; });
  sb.CASE_LAYOUT_VERSIONS.push({ id: 'lv_manual', projectId: 'p1', version: '2.0', type: 'leasing', status: 'working', active: true, handoverStatus: 'draft' });
  loadPlanA(sb); // вернулись к плану A — checksum не совпадает ни с одним снапшотом? v1 совпадает!
  // v1 (план A) существует со снапшотом — должен быть переиспользован раньше заморозки lv_manual
  const got = sb.planVersionForCurrent('p1');
  eq(got.version, 'план-1', 'найдена версия со снапшотом того же чертежа (переиспользование приоритетнее)');
});
test('заморозка активной версии без снапшота (когда совпадений нет)', () => {
  loadPlanB(sb);
  sb.PLAN_CODES['p1::A::1 этаж'].push({ code: 'C-1', area: 10 }); // уникальный чертёж
  sb.CASE_LAYOUT_VERSIONS.forEach(v => { v.active = false; });
  const manual = { id: 'lv_manual2', projectId: 'p1', version: '3.0', type: 'leasing', status: 'working', active: true, handoverStatus: 'draft' };
  sb.CASE_LAYOUT_VERSIONS.push(manual);
  const got = sb.planVersionForCurrent('p1');
  eq(got.id, 'lv_manual2', 'выбрана активная версия без снапшота');
  ok(got.snapshot, 'снапшот заморожен в неё');
  eq(got.snapshot.checksum, sb.planCurrentChecksum('p1'), 'checksum соответствует');
});

/* 8. Handover фиксирует снапшот */
sb = makeSandbox();
loadPlanA(sb);
test('masterHandoverMark фиксирует снапшот при передаче в аренду', () => {
  sb.CASE_LAYOUT_VERSIONS.push({ id: 'lv_adv', projectId: 'p1', version: 'A-01', type: 'advisory', status: 'working', active: true, handoverStatus: 'draft' });
  sb.masterHandoverMark('p1', 'lv_adv');
  const v = sb.CASE_LAYOUT_VERSIONS.find(x => x.id === 'lv_adv');
  eq(v.handoverStatus, 'ready_for_leasing', 'статус передачи');
  ok(v.snapshot, 'снапшот зафиксирован');
  ok(Object.isFrozen(v.snapshot), 'снапшот заморожен');
});
test('masterSnapshotFreeze не перезаписывает существующий снапшот', () => {
  const v = sb.CASE_LAYOUT_VERSIONS.find(x => x.id === 'lv_adv');
  const cs = v.snapshot.checksum;
  loadPlanB(sb);
  sb.masterSnapshotFreeze('p1', 'lv_adv');
  eq(v.snapshot.checksum, cs, 'снапшот не изменён');
  ok(sb._alerts.some(a => a.indexOf('неизменяемы') >= 0), 'показано предупреждение о неизменяемости');
});

/* 9. Сериализация: снапшот переживает JSON round-trip и повторную заморозку (applyState) */
sb = makeSandbox();
loadPlanA(sb);
test('снапшот сериализуется в JSON и замораживается после загрузки', () => {
  const v1 = sb.planVersionForCurrent('p1');
  const roundtrip = JSON.parse(JSON.stringify(sb.CASE_LAYOUT_VERSIONS));
  const loaded = roundtrip[0];
  ok(!Object.isFrozen(loaded.snapshot), 'после парсинга объект обычный');
  sb.planSnapshotDeepFreeze(loaded.snapshot);
  ok(Object.isFrozen(loaded.snapshot) && Object.isFrozen(loaded.snapshot.planCodes), 'после applyState-заморозки неизменяем');
  eq(loaded.snapshot.checksum, v1.snapshot.checksum, 'checksum сохранился');
  const svgHash = loaded.snapshot.svgRefs['p1::A::1 этаж'];
  eq(sb.planSnapshotSvg(loaded.snapshot, 'p1::A::1 этаж'), '<svg id="planA1">…A1…</svg>', 'SVG достаётся из дедуп-хранилища по хешу ' + svgHash);
});

/* ---- итог ---- */
const pass = results.filter(r => r.status === 'PASS').length;
const out = {
  suite: 'CASE OS v4.33.0 · P0-1 snapshot VM test',
  date: '2026-07-24',
  env: 'node ' + process.version + ' (vm sandbox, без браузера/БД)',
  total: results.length, pass, fail: results.length - pass,
  results
};
console.log(JSON.stringify(out, null, 2));
process.exit(pass === results.length ? 0 : 1);
