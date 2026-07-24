/* CASE OS v4.9.3 — Commission Engines: Leasing + Supplier Mediation.
   Two private money modules requested by ASH. Frontend-first with backend-ready tables/endpoints. */
(function(){
  'use strict';
  if(window.CASE_OS_V326) return;
  window.CASE_OS_V326 = true;
  var V='3.4.3';
  var DATA_KEYS=['COMMISSION_ENGINE_CFG','LEASE_COMMISSION_DEALS','SUPPLIERS','SUPPLIER_COMMISSION_DEALS','SUPPLIER_COMMISSION_LEDGER'];
  var DEFAULT_SUPPLIER_CATS=[
    ['Реклама и вывеска','Outdoor advertising / signage','Tashqi reklama va peshlavha',10,5],
    ['Fit-out','Fit-out','Fit-out',5,3],
    ['MEP / инженерия','MEP / engineering','MEP / muhandislik',5,3],
    ['Мебель и оборудование','Furniture and equipment','Mebel va jihozlar',4,3],
    ['Безопасность','Security','Xavfsizlik',5,3],
    ['Клининг','Cleaning','Klining',5,3],
    ['IT / кассовое оборудование','IT / POS equipment','IT / kassa jihozlari',4,2],
    ['Дизайн / проектирование','Design / architecture','Dizayn / loyiha',5,2],
    ['Строительные материалы','Construction materials','Qurilish materiallari',3,2],
    ['Логистика','Logistics','Logistika',3,2]
  ];
  function h(s){try{if(typeof esc==='function')return esc(s);}catch(e){}return String(s==null?'':s).replace(/[&<>"']/g,function(m){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m];});}
  function lang(){try{return LANG||'ru';}catch(e){return 'ru';}}
  var I18N={
    ru:{
      lease:'Комиссии аренды', leaseSub:'Движок распределения комиссии CASE по сделкам аренды: агент, куратор, поддержка, компания.',
      supplier:'Поставщики', supplierSub:'Каталог поставщиков и посредническая комиссия CASE: комиссия, скидка клиенту, раскрытие.',
      addDeal:'Добавить сделку', addSupplier:'Добавить поставщика', addSupplierDeal:'Добавить заказ', settings:'Настройки',
      reports:'Отчёты', export:'Экспорт', registry:'Реестр', profile:'Профиль', ledger:'Начисления',
      gross:'Валовая комиссия', paid:'Выплачено', pending:'Ожидается', company:'Компания', companyNet:'Чистая прибыль компании',
      agent:'Агент', externalAgent:'Внешний агент', internalAgent:'Внутренний агент', curator:'Куратор', support:'Поддержка', house:'CASE house',
      tenant:'Арендатор', object:'Объект', unit:'Помещение', area:'Площадь', rate:'Ставка', term:'Срок', signed:'Дата подписания',
      scenario:'Тип закрытия', curatorSelf:'Куратор закрыл сам', closedExternal:'Закрыл внешний агент', closedInternal:'Закрыл внутренний агент',
      commissionBase:'База комиссии C', baseMethod:'Метод базы C', oneMonth:'1 месячная аренда', annualPercent:'% годовой аренды', fixed:'Фикс', manual:'Ручной ввод / виза ASH',
      ashConfirm:'Требует подтверждения ASH', currency:'Валюта', fx:'Курс ЦБ', stage:'Стадия', status:'Статус выплаты', preview:'Предпросмотр распределения',
      primaryAgent:'Агент 1', secondAgent:'Агент 2', split:'Разделение доли агента', salary:'Оклад / аллокация', salaryHint:'Оклад учитывается из доли компании по периоду.',
      deal:'Сделка', participant:'Участник', role:'Роль', amount:'Сумма', share:'Доля', weighted:'Weighted forecast', lost:'Упущено',
      supplierName:'Поставщик', category:'Категория', client:'Клиент / арендатор / проект', order:'Сумма заказа', commissionRate:'Ставка комиссии CASE',
      clientDiscount:'Скидка клиенту', clientSaving:'Экономия клиента', disclosure:'Раскрытие комиссии', supplierDisclosure:'Поставщик подтвердил', clientDisclosure:'Клиент подтвердил',
      disclosureDate:'Дата подтверждения', orderStatus:'Статус заказа', expected:'Ожидается', received:'Получено', reversed:'Реверс', conflict:'Конфликт интересов',
      noRows:'Пока нет записей', save:'Сохранить', cancel:'Отмена', edit:'Открыть', delete:'Удалить', search:'Поиск...', period:'Период',
      all:'Все', mine:'Мои', team:'Команда', back:'Назад', rules:'Правила', payouts:'Выплаты', clientSavings:'Экономия клиентов',
      required:'обязательное поле', formula:'Формула', accounting:'Для бухгалтерии', google:'CSV для Google Sheets',
      privacy:'Приватность: агент видит только свои начисления; полный реестр видят сотрудники с правами finance / approve / admin.',
      audit:'Аудит изменений включён: пересчёт, реверс, изменение ставок и выплат фиксируются.',
      openParams:'Открытые параметры на подтверждение ASH',
      needDisclosure:'Перед статусом “Получено” нужно отметить раскрытие комиссии клиенту и поставщику.',
      supplierCatalog:'Каталог поставщиков', supplierDeals:'Сделки-посредничество', clientKnows:'Клиент знает о комиссии CASE', supplierKnows:'Поставщик знает о комиссии CASE'
    },
    uz:{
      lease:'Ijara komissiyalari', leaseSub:'CASE ijara bitimlari komissiyasini taqsimlash: agent, kurator, support, kompaniya.',
      supplier:'Yetkazib beruvchilar', supplierSub:'Yetkazib beruvchilar katalogi va CASE vositachilik komissiyasi: komissiya, chegirma, oshkor qilish.',
      addDeal:'Bitim qo‘shish', addSupplier:'Yetkazib beruvchi qo‘shish', addSupplierDeal:'Buyurtma qo‘shish', settings:'Sozlamalar',
      reports:'Hisobotlar', export:'Eksport', registry:'Reyestr', profile:'Profil', ledger:'Hisoblanganlar',
      gross:'Yalpi komissiya', paid:'To‘langan', pending:'Kutilmoqda', company:'Kompaniya', companyNet:'Kompaniya sof foydasi',
      agent:'Agent', externalAgent:'Tashqi agent', internalAgent:'Ichki agent', curator:'Kurator', support:'Support', house:'CASE house',
      tenant:'Ijarachi', object:'Obyekt', unit:'Xona', area:'Maydon', rate:'Stavka', term:'Muddat', signed:'Imzolangan sana',
      scenario:'Yopish turi', curatorSelf:'Kurator o‘zi yopdi', closedExternal:'Tashqi agent yopdi', closedInternal:'Ichki agent yopdi',
      commissionBase:'Komissiya bazasi C', baseMethod:'C bazasi metodi', oneMonth:'1 oylik ijara', annualPercent:'Yillik ijaradan %', fixed:'Fiks', manual:'Qo‘lda / ASH tasdig‘i',
      ashConfirm:'ASH tasdig‘i kerak', currency:'Valyuta', fx:'MB kursi', stage:'Bosqich', status:'To‘lov statusi', preview:'Taqsimot preview',
      primaryAgent:'Agent 1', secondAgent:'Agent 2', split:'Agent ulushini bo‘lish', salary:'Oylik / allokatsiya', salaryHint:'Oylik kompaniya ulushidan davr bo‘yicha hisoblanadi.',
      deal:'Bitim', participant:'Ishtirokchi', role:'Rol', amount:'Summa', share:'Ulush', weighted:'Weighted forecast', lost:'Yo‘qotilgan',
      supplierName:'Yetkazib beruvchi', category:'Kategoriya', client:'Mijoz / ijarachi / loyiha', order:'Buyurtma summasi', commissionRate:'CASE komissiya stavkasi',
      clientDiscount:'Mijoz chegirmasi', clientSaving:'Mijoz tejashi', disclosure:'Komissiyani oshkor qilish', supplierDisclosure:'Yetkazib beruvchi tasdiqladi', clientDisclosure:'Mijoz tasdiqladi',
      disclosureDate:'Tasdiq sanasi', orderStatus:'Buyurtma statusi', expected:'Kutilmoqda', received:'Olingan', reversed:'Revers', conflict:'Manfaatlar to‘qnashuvi',
      noRows:'Yozuvlar yo‘q', save:'Saqlash', cancel:'Bekor', edit:'Ochish', delete:'O‘chirish', search:'Qidiruv...', period:'Davr',
      all:'Hammasi', mine:'Mening', team:'Jamoa', back:'Orqaga', rules:'Qoidalar', payouts:'To‘lovlar', clientSavings:'Mijozlar tejashi',
      required:'majburiy maydon', formula:'Formula', accounting:'Buxgalteriya uchun', google:'Google Sheets uchun CSV',
      privacy:'Maxfiylik: agent faqat o‘z hisoblanganini ko‘radi; to‘liq reyestr finance / approve / admin huquqlari bilan ochiladi.',
      audit:'Audit yoqilgan: qayta hisoblash, revers, stavka va to‘lov o‘zgarishlari yoziladi.',
      openParams:'ASH tasdig‘i kerak bo‘lgan parametrlar',
      needDisclosure:'“Olingan” statusidan oldin komissiya mijoz va yetkazib beruvchiga oshkor qilinganini belgilang.',
      supplierCatalog:'Yetkazib beruvchilar katalogi', supplierDeals:'Vositachilik bitimlari', clientKnows:'Mijoz CASE komissiyasini biladi', supplierKnows:'Yetkazib beruvchi CASE komissiyasini biladi'
    },
    en:{
      lease:'Lease Commissions', leaseSub:'CASE lease commission distribution engine: agent, curator, support, company.',
      supplier:'Suppliers', supplierSub:'Approved suppliers and CASE mediation commission: commission, client discount, disclosure.',
      addDeal:'Add deal', addSupplier:'Add supplier', addSupplierDeal:'Add order', settings:'Settings',
      reports:'Reports', export:'Export', registry:'Registry', profile:'Profile', ledger:'Ledger',
      gross:'Gross commission', paid:'Paid', pending:'Pending', company:'Company', companyNet:'Company net profit',
      agent:'Agent', externalAgent:'External agent', internalAgent:'Internal agent', curator:'Curator', support:'Support', house:'CASE house',
      tenant:'Tenant', object:'Property', unit:'Unit', area:'Area', rate:'Rate', term:'Term', signed:'Signed date',
      scenario:'Closing type', curatorSelf:'Curator closed directly', closedExternal:'Closed by external agent', closedInternal:'Closed by internal agent',
      commissionBase:'Commission base C', baseMethod:'C base method', oneMonth:'One monthly rent', annualPercent:'% of annual rent', fixed:'Fixed', manual:'Manual / ASH approval',
      ashConfirm:'Requires ASH approval', currency:'Currency', fx:'CB rate', stage:'Stage', status:'Payment status', preview:'Distribution preview',
      primaryAgent:'Agent 1', secondAgent:'Agent 2', split:'Agent share split', salary:'Salary allocation', salaryHint:'Salary is allocated from company share by period.',
      deal:'Deal', participant:'Participant', role:'Role', amount:'Amount', share:'Share', weighted:'Weighted forecast', lost:'Lost',
      supplierName:'Supplier', category:'Category', client:'Client / tenant / project', order:'Order amount', commissionRate:'CASE commission rate',
      clientDiscount:'Client discount', clientSaving:'Client saving', disclosure:'Commission disclosure', supplierDisclosure:'Supplier confirmed', clientDisclosure:'Client confirmed',
      disclosureDate:'Confirmation date', orderStatus:'Order status', expected:'Expected', received:'Received', reversed:'Reversed', conflict:'Conflict of interest',
      noRows:'No records yet', save:'Save', cancel:'Cancel', edit:'Open', delete:'Delete', search:'Search...', period:'Period',
      all:'All', mine:'Mine', team:'Team', back:'Back', rules:'Rules', payouts:'Payouts', clientSavings:'Client savings',
      required:'required field', formula:'Formula', accounting:'For accounting', google:'CSV for Google Sheets',
      privacy:'Privacy: agents see only their own commissions; the full team ledger requires finance / approve / admin rights.',
      audit:'Audit enabled: recalculation, reversal, rate and payout changes are logged.',
      openParams:'Open parameters for ASH confirmation',
      needDisclosure:'Before “Received” status, disclosure must be confirmed by both client and supplier.',
      supplierCatalog:'Supplier catalog', supplierDeals:'Mediation deals', clientKnows:'Client knows about CASE commission', supplierKnows:'Supplier knows about CASE commission'
    }
  };
  function t(k){var L=I18N[lang()]||I18N.ru; return L[k]||I18N.ru[k]||k;}
  function id(){return 'v326_'+Date.now().toString(36)+'_'+Math.random().toString(36).slice(2,8);}
  function today(){try{return iso(TODAY);}catch(e){return new Date().toISOString().slice(0,10);}}
  function addDays(n){var d=new Date(); d.setDate(d.getDate()+n); return d.toISOString().slice(0,10);}
  function num(x){return +String(x==null?'':x).replace(/\s/g,'').replace(',','.')||0;}
  function money(n,cur){n=+n||0; cur=cur||'USD'; if(cur==='UZS') return Math.round(n).toLocaleString('ru-RU')+' сум'; return '$'+Math.round(n).toLocaleString('en-US');}
  function role(){try{return (S&&S.role)||'';}catch(e){return '';}}
  function rights(){try{return R()||{};}catch(e){return {};}}
  function canAll(){var x=rights(); return !!(x.admin||x.finance||x.approve);}
  function brokerName(){try{return (S.user&&S.user.broker_name)||S.user.name||'';}catch(e){return '';}}
  function userName(){try{return (S.user&&S.user.name)||'';}catch(e){return '';}}
  function brokers(){try{return typeof brokerNames==='function'?brokerNames():[];}catch(e){return [];}}

  function defaultCfg(){
    return {
      fxRate:11974,
      lease:{
        baseMethod:'manual', annualPercent:8, fixedAmount:0, needsAshConfirmation:true,
        curatorName:'Нодир', supportName:'Хилола',
        curatorSelfShare:25, externalAgentShare:20, internalAgentShare:15, curatorShare:5, supportShare:5,
        scenario3CompanyShare:75, salaryAllocationMode:'period', internalMonthlySalary:0,
        splitDefault:'equal', offTheTop:true,
        stageProb:{lead:20,neg:35,loi:65,contract:85,signed:100,paid:100,lost:0,reversed:0}
      },
      supplier:{
        defaultCommissionRate:5, defaultClientDiscount:5, requireDisclosureBeforePaid:true,
        categories:DEFAULT_SUPPLIER_CATS.map(function(c){return {name:c[0],en:c[1],uz:c[2],commissionRate:c[3],discountRate:c[4]};})
      }
    };
  }
  function mergeCfg(a,b){a=a||{}; b=b||{}; Object.keys(b).forEach(function(k){ if(b[k]&&typeof b[k]==='object'&&!Array.isArray(b[k])) a[k]=mergeCfg(a[k]||{},b[k]); else if(a[k]===undefined) a[k]=b[k]; }); return a; }
  function ensureData(){
    if(!window.COMMISSION_ENGINE_CFG || Array.isArray(window.COMMISSION_ENGINE_CFG)) window.COMMISSION_ENGINE_CFG={};
    mergeCfg(window.COMMISSION_ENGINE_CFG, defaultCfg());
    ['LEASE_COMMISSION_DEALS','SUPPLIERS','SUPPLIER_COMMISSION_DEALS','SUPPLIER_COMMISSION_LEDGER'].forEach(function(k){ if(!Array.isArray(window[k])) window[k]=[]; });
  }
  function wrapState(){
    if(window.stateBlob && !window.stateBlob._v326){
      var old=window.stateBlob;
      window.stateBlob=function(){var b=old.apply(this,arguments)||{}; ensureData(); DATA_KEYS.forEach(function(k){b[k]=window[k];}); return b;};
      window.stateBlob._v326=true;
    }
    if(window.applyState && !window.applyState._v326){
      var oldA=window.applyState;
      window.applyState=function(d){var r=oldA.apply(this,arguments); try{ensureData(); if(d&&typeof d==='object'){ DATA_KEYS.forEach(function(k){ if(k==='COMMISSION_ENGINE_CFG' && d[k]&&typeof d[k]==='object'){ window[k]=mergeCfg(d[k], defaultCfg()); } else if(Array.isArray(d[k])){ window[k].splice(0,window[k].length); Array.prototype.push.apply(window[k],d[k]); } }); }}catch(e){} return r;};
      window.applyState._v326=true;
    }
  }
  function persist326(){try{ if(typeof persist==='function') persist(); }catch(e){}}
  function audit326(action,detail){
    try{ if(typeof audit==='function') audit(action,detail||''); }catch(e){}
    try{ (window.AUDIT=window.AUDIT||[]).unshift({t:new Date().toISOString(),by:userName(),act:action,detail:detail||''}); }catch(e){}
  }

  function leaseBase(deal){
    var c=window.COMMISSION_ENGINE_CFG.lease, area=num(deal.area), rate=num(deal.rate), term=num(deal.termMonths||12);
    var monthly=num(deal.monthlyRent)||area*rate;
    var annual=monthly*12;
    var method=deal.baseMethod||c.baseMethod||'manual';
    var C=num(deal.commissionBase);
    if(method==='one_month') C=monthly;
    if(method==='annual_percent') C=annual*(num(deal.annualPercent||c.annualPercent)/100);
    if(method==='fixed') C=num(deal.fixedAmount||c.fixedAmount);
    if(method==='manual') C=num(deal.commissionBase);
    return {C:C,monthly:monthly,annual:annual,method:method,term:term};
  }
  function leaseProb(stage){var p=(window.COMMISSION_ENGINE_CFG.lease.stageProb||{})[stage]; return num(p)/100;}
  function leaseCalc(deal){
    ensureData(); var c=window.COMMISSION_ENGINE_CFG.lease, b=leaseBase(deal), C=b.C, sc=deal.scenario||'external';
    var out={C:C,monthly:b.monthly,annual:b.annual,rows:[],agentTotal:0,curator:0,support:0,company:0,companyNet:0,salary:0,total:0,prob:leaseProb(deal.stage||'lead')};
    var primary=deal.agent1||deal.broker||brokerName(), secondary=deal.agent2||'', split1=num(deal.split1), split2=num(deal.split2);
    if(secondary && (!split1&&!split2)){split1=50;split2=50;} else if(!secondary){split1=100;split2=0;} else {var s=split1+split2;if(s>0){split1=split1/s*100;split2=100-split1;}}
    if(sc==='curator_self'){
      out.curator=C*num(c.curatorSelfShare)/100; out.support=C*num(c.supportShare)/100; out.agentTotal=0;
    }else if(sc==='internal'){
      out.agentTotal=C*num(c.internalAgentShare)/100; out.curator=C*num(c.curatorShare)/100; out.support=C*num(c.supportShare)/100; out.salary=num(deal.salaryAllocation||c.internalMonthlySalary);
    }else{
      out.agentTotal=C*num(c.externalAgentShare)/100; out.curator=C*num(c.curatorShare)/100; out.support=C*num(c.supportShare)/100;
    }
    out.company=C-out.agentTotal-out.curator-out.support;
    out.companyNet=out.company-out.salary;
    if(out.agentTotal&&primary) out.rows.push({name:primary,role:sc==='internal'?t('internalAgent'):t('externalAgent'),roleKey:'agent',share:(out.agentTotal/C*split1/100*100),amount:out.agentTotal*split1/100,owner:primary});
    if(out.agentTotal&&secondary) out.rows.push({name:secondary,role:t('agent'),roleKey:'agent',share:(out.agentTotal/C*split2/100*100),amount:out.agentTotal*split2/100,owner:secondary});
    var cur=deal.curator||c.curatorName; if(out.curator&&cur) out.rows.push({name:cur,role:t('curator'),roleKey:'curator',share:out.curator/C*100,amount:out.curator,owner:cur});
    var sup=deal.support||c.supportName; if(out.support&&sup) out.rows.push({name:sup,role:t('support'),roleKey:'support',share:out.support/C*100,amount:out.support,owner:sup});
    out.rows.push({name:t('house'),role:t('company'),roleKey:'company',share:out.company/C*100,amount:out.company,owner:'CASE'});
    out.total=out.rows.reduce(function(s,r){return s+(+r.amount||0);},0);
    return out;
  }
  function visibleLeaseDeals(){ensureData(); var rows=window.LEASE_COMMISSION_DEALS.slice(); if(canAll()) return rows; var me=brokerName(); return rows.filter(function(d){return d.agent1===me||d.agent2===me||d.broker===me||d.curator===me||d.support===me;});}
  function leaseLedgerRows(deals){
    var rows=[]; deals.forEach(function(d){var calc=leaseCalc(d), status=d.paymentStatus||d.stage||'pending'; calc.rows.forEach(function(r){var amount=r.amount, earned=0,pending=0,lost=0,weighted=0; if(['paid','signed'].indexOf(status)>=0||d.stage==='signed'){earned=amount;} else if(['lost','reversed','canceled'].indexOf(status)>=0||['lost','reversed'].indexOf(d.stage)>=0){lost=amount;} else {pending=amount; weighted=amount*calc.prob;} rows.push({deal:d,name:r.name,role:r.role,roleKey:r.roleKey,amount:amount,earned:earned,pending:pending,lost:lost,weighted:weighted,currency:d.currency||'USD'});});});
    if(canAll()) return rows; var me=brokerName(); return rows.filter(function(r){return r.name===me;});
  }
  function sum(rows,key){return rows.reduce(function(s,r){return s+(+r[key]||0);},0);}
  function stageOpts(){return [['lead','Lead'],['neg','Negotiation'],['loi','LOI'],['contract','Contract signing'],['signed','Signed'],['paid','Paid'],['lost','Lost'],['reversed','Reversed']];}
  function val(idv){var e=document.getElementById(idv); return e?e.value:'';}
  function checked(idv){var e=document.getElementById(idv); return !!(e&&e.checked);}
  function inp(label,idv,value,type,attrs){return '<label>'+h(label)+'</label><input id="'+idv+'" type="'+(type||'text')+'" value="'+h(value==null?'':value)+'" '+(attrs||'')+'>'; }
  function area(label,idv,value){return '<label>'+h(label)+'</label><textarea id="'+idv+'">'+h(value||'')+'</textarea>'; }
  function sel(label,idv,value,opts,attrs){return '<label>'+h(label)+'</label><select id="'+idv+'" '+(attrs||'')+'>'+opts.map(function(o){var v=Array.isArray(o)?o[0]:o, tx=Array.isArray(o)?o[1]:o; return '<option value="'+h(v)+'" '+(String(v)===String(value)?'selected':'')+'>'+h(tx)+'</option>';}).join('')+'</select>'; }
  function peopleOptions(selected){var arr=brokers(); if(!arr.length) arr=[brokerName(),userName(),'Нодир','Хилола','Азиз'].filter(Boolean); arr=[...new Set(arr)]; return arr.map(function(x){return '<option '+(x===selected?'selected':'')+'>'+h(x)+'</option>';}).join('');}
  function chips(html){return '<div class="v326-chips">'+html+'</div>';}
  function pageHead(title,sub,buttons){return '<div class="ph"><h1>'+h(title)+'</h1></div><p class="sub">'+h(sub)+'</p><div class="v326-tools"><div>'+chips('<span>'+h(t('privacy'))+'</span>')+'</div><div>'+buttons+'</div></div>';}

  function exportCSV(name,cols,rows){
    var csv=[cols.map(function(c){return c[0];}).join(',')].concat(rows.map(function(r){return cols.map(function(c){var raw=(typeof c[1]==='function'?c[1](r):r[c[1]]); var v=String(raw==null?'':raw); if(/^[=+\-@]/.test(v))v="'"+v; return '"'+v.replace(/"/g,'""')+'"';}).join(',');})).join('\n');
    var blob=new Blob(['\ufeff'+csv],{type:'text/csv;charset=utf-8'}), a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download=name+'.csv'; document.body.appendChild(a); a.click(); setTimeout(function(){URL.revokeObjectURL(a.href);a.remove();},500);
  }

  function renderLease(){
    ensureData(); var deals=visibleLeaseDeals(), ledger=leaseLedgerRows(deals), cfg=window.COMMISSION_ENGINE_CFG.lease;
    var k='<div class="v326-kpis">'+
      '<div class="v326-kpi"><small>'+h(t('gross'))+'</small><b>'+money(sum(deals.map(function(d){return {x:leaseCalc(d).C};}),'x'))+'</b></div>'+
      '<div class="v326-kpi"><small>'+h(t('paid'))+'</small><b>'+money(sum(ledger,'earned'))+'</b></div>'+
      '<div class="v326-kpi warn"><small>'+h(t('pending'))+'</small><b>'+money(sum(ledger,'pending'))+'</b></div>'+
      '<div class="v326-kpi"><small>'+h(t('weighted'))+'</small><b>'+money(sum(ledger,'weighted'))+'</b></div>'+
      '<div class="v326-kpi bad"><small>'+h(t('lost'))+'</small><b>'+money(sum(ledger,'lost'))+'</b></div>'+
      '</div>';
    var open='<div class="v326-card"><div class="v326-head"><div><div class="v326-eye">'+h(t('openParams'))+'</div><h3>'+h(t('rules'))+'</h3></div><button class="btn ghost sm" onclick="v326LeaseSettings()">'+h(t('settings'))+'</button></div>'+
      chips('<span>C: '+h(cfg.baseMethod==='one_month'?t('oneMonth'):cfg.baseMethod==='annual_percent'?t('annualPercent'):cfg.baseMethod==='fixed'?t('fixed'):t('manual'))+'</span><span>'+h(t('curator'))+' '+num(cfg.curatorShare)+'%</span><span>HO '+num(cfg.supportShare)+'%</span><span>'+h(t('externalAgent'))+' '+num(cfg.externalAgentShare)+'%</span><span>'+h(t('internalAgent'))+' '+num(cfg.internalAgentShare)+'%</span><span>'+h(t('ashConfirm'))+': '+(cfg.needsAshConfirmation?'✓':'—')+'</span>')+
      '<div class="mut" style="font-size:12px;margin-top:8px">'+h(t('audit'))+'</div></div>';
    var table=deals.length?'<table class="v326-table"><tr><th>'+h(t('deal'))+'</th><th>'+h(t('tenant'))+'</th><th>'+h(t('scenario'))+'</th><th>C</th><th>'+h(t('payouts'))+'</th><th>'+h(t('status'))+'</th><th></th></tr>'+deals.map(function(d){var c=leaseCalc(d); return '<tr'+(d.autoCreated?' style="background:rgba(174,112,0,.06)"':'')+'><td><b>'+h(d.objectName||d.object||'-')+'</b>'+(d.autoCreated?' <span class="v326-bad" title="Создано автоматически из канбана - проверьте и уточните данные сделки">авто</span>':'')+'<div class="mut">'+h(d.unit||'')+' · '+h(d.signedDate||'')+'</div></td><td>'+h(d.tenant||'-')+'<div class="mut">'+h(d.agent1||d.broker||'')+'</div></td><td>'+h(d.scenario==='curator_self'?t('curatorSelf'):d.scenario==='internal'?t('closedInternal'):t('closedExternal'))+'</td><td><b>'+money(c.C,d.currency)+'</b><div class="mut">'+h(d.baseMethod||cfg.baseMethod)+'</div></td><td>'+c.rows.map(function(r){return '<span class="v326-minirow"><b>'+h(r.name)+'</b> '+h(r.role)+' · '+money(r.amount,d.currency)+'</span>';}).join('')+'<div class="mut">'+h(t('companyNet'))+': '+money(c.companyNet,d.currency)+'</div></td><td>'+h(d.paymentStatus||d.stage||'pending')+(cfg.needsAshConfirmation?(d.ashConfirmed?' <span class="v326-ok" title="'+h(t('ashConfirm'))+': '+h(d.ashConfirmedBy||'')+'">✓ ASH</span>':' <span class="v326-bad" title="'+h(t('ashConfirm'))+'">! ASH</span>'):'')+'</td><td><button class="btn ghost sm" onclick="v326LeaseDealForm(\''+h(d.id)+'\')">'+h(t('edit'))+'</button></td></tr>';}).join('')+'</table>':'<div class="v326-empty">'+h(t('noRows'))+'</div>';
    var profile=renderLeaseProfile(ledger);
    return pageHead(t('lease'),t('leaseSub'),'<button class="btn" onclick="v326LeaseDealForm()">+ '+h(t('addDeal'))+'</button> <button class="btn ghost" onclick="v326LeaseReport()">'+h(t('reports'))+'</button> <button class="btn ghost" onclick="v326ExportLease()">'+h(t('export'))+'</button> '+(canAll()?'<button class="btn ghost" onclick="v326LeaseSettings()">'+h(t('settings'))+'</button>':''))+k+open+'<div class="v326-split"><div class="v326-card"><div class="v326-head"><div><div class="v326-eye">LEASE LEDGER</div><h3>'+h(t('registry'))+'</h3></div></div>'+table+'</div>'+profile+'</div>';
  }
  function renderLeaseProfile(ledger){
    var grouped={}; ledger.forEach(function(r){var k=r.name||'-'; grouped[k]=grouped[k]||{name:k,earned:0,pending:0,weighted:0,lost:0}; grouped[k].earned+=r.earned; grouped[k].pending+=r.pending; grouped[k].weighted+=r.weighted; grouped[k].lost+=r.lost;});
    var rows=Object.values(grouped).sort(function(a,b){return (b.earned+b.pending)-(a.earned+a.pending);});
    return '<div class="v326-card"><div class="v326-head"><div><div class="v326-eye">'+h(canAll()?t('team'):t('profile'))+'</div><h3>'+h(canAll()?t('ledger'):t('profile'))+'</h3></div></div>'+(rows.length?'<table class="v326-table compact"><tr><th>'+h(t('participant'))+'</th><th>'+h(t('paid'))+'</th><th>'+h(t('pending'))+'</th><th>'+h(t('weighted'))+'</th></tr>'+rows.map(function(r){return '<tr><td><b>'+h(r.name)+'</b></td><td>'+money(r.earned)+'</td><td>'+money(r.pending)+'</td><td>'+money(r.weighted)+'</td></tr>';}).join('')+'</table>':'<div class="v326-empty">'+h(t('noRows'))+'</div>')+'</div>';
  }

  window.v326LeaseDealForm=function(did){
    ensureData(); var d=window.LEASE_COMMISSION_DEALS.find(function(x){return x.id===did;})||{}; var cfg=window.COMMISSION_ENGINE_CFG.lease;
    var objOpts=(window.OBJECTS||[]).map(function(o){return [o.name,o.name];}); if(!objOpts.length)objOpts=[['','']];
    var html='<div class="v326-form" oninput="v326LeasePreview()" onchange="v326LeasePreview()">'+
      '<div class="v326-row3">'+sel(t('object'),'lc_obj',d.objectName||d.object||'',objOpts)+inp(t('unit'),'lc_unit',d.unit||'')+inp(t('tenant'),'lc_tenant',d.tenant||'')+'</div>'+
      '<div class="v326-row4">'+inp(t('area'),'lc_area',d.area||'', 'number')+inp(t('rate'),'lc_rate',d.rate||'', 'number')+inp(t('term'),'lc_term',d.termMonths||12,'number')+inp(t('signed'),'lc_signed',d.signedDate||today(),'date')+'</div>'+
      '<div class="v326-row4">'+sel(t('baseMethod'),'lc_base_method',d.baseMethod||cfg.baseMethod,[['manual',t('manual')],['one_month',t('oneMonth')],['annual_percent',t('annualPercent')],['fixed',t('fixed')]])+inp(t('commissionBase'),'lc_C',d.commissionBase||'', 'number')+inp('% annual','lc_annpct',d.annualPercent||cfg.annualPercent,'number')+sel(t('currency'),'lc_cur',d.currency||'USD',[['USD','USD'],['UZS','UZS']])+'</div>'+
      '<div class="v326-row3">'+sel(t('scenario'),'lc_scenario',d.scenario||'external',[['curator_self',t('curatorSelf')],['external',t('closedExternal')],['internal',t('closedInternal')]])+sel(t('stage'),'lc_stage',d.stage||'lead',stageOpts())+sel(t('status'),'lc_pay',d.paymentStatus||'pending',[['pending',t('pending')],['paid',t('paid')],['lost',t('lost')],['reversed',t('reversed')]])+'</div>'+
      (rights().approve?'<label style="margin-top:8px"><input type="checkbox" id="lc_ash" '+(d.ashConfirmed?'checked':'')+'> '+h(t('ashConfirm'))+'</label>':'<div class="v326-chips" style="margin-top:8px"><span>'+h(t('ashConfirm'))+': '+(d.ashConfirmed?'✓ '+h(d.ashConfirmedBy||''):'—')+'</span></div>')+
      '<div class="v326-row4">'+sel(t('primaryAgent'),'lc_a1',d.agent1||d.broker||brokerName(),brokers().map(function(x){return [x,x];}))+sel(t('secondAgent'),'lc_a2',d.agent2||'',[['','—']].concat(brokers().map(function(x){return [x,x];})))+inp('% A1','lc_split1',d.split1||'', 'number')+inp('% A2','lc_split2',d.split2||'', 'number')+'</div>'+
      '<div class="v326-row3">'+sel(t('curator'),'lc_curator',d.curator||cfg.curatorName,[[cfg.curatorName,cfg.curatorName]].concat(brokers().map(function(x){return [x,x];})))+sel(t('support'),'lc_support',d.support||cfg.supportName,[[cfg.supportName,cfg.supportName]].concat(brokers().map(function(x){return [x,x];})))+inp(t('salary'),'lc_salary',d.salaryAllocation||cfg.internalMonthlySalary,'number')+'</div>'+
      area('Notes','lc_notes',d.notes||'')+'<div id="v326LeasePreview" class="v326-preview"></div></div>';
    modal(t('lease'),html,'<button class="btn ghost" onclick="v326CloseModal()">'+h(t('cancel'))+'</button><button class="btn" onclick="v326SaveLeaseDeal(\''+(did||'')+'\')">'+h(t('save'))+'</button>');
    setTimeout(window.v326LeasePreview,50);
  };
  function modal(title,body,actions){var m=document.createElement('div');m.className='v326-modal';m.innerHTML='<div class="v326-modal-box"><button class="v326-close" onclick="v326CloseModal()">×</button><div class="v326-eye">CASE OS '+V+'</div><h3>'+h(title)+'</h3>'+body+'<div class="v326-actions">'+actions+'</div></div>';document.body.appendChild(m);return m;}
  window.v326CloseModal=function(){var m=document.querySelector('.v326-modal'); if(m)m.remove();};
  function formDealFromDOM(idv){
    var existing=window.LEASE_COMMISSION_DEALS.find(function(x){return x.id===idv;})||{};
    var out={id:idv||id(),objectName:val('lc_obj'),unit:val('lc_unit'),tenant:val('lc_tenant'),area:num(val('lc_area')),rate:num(val('lc_rate')),termMonths:num(val('lc_term'))||12,signedDate:val('lc_signed'),baseMethod:val('lc_base_method'),commissionBase:num(val('lc_C')),annualPercent:num(val('lc_annpct')),currency:val('lc_cur'),scenario:val('lc_scenario'),stage:val('lc_stage'),paymentStatus:val('lc_pay'),agent1:val('lc_a1'),agent2:val('lc_a2'),split1:num(val('lc_split1')),split2:num(val('lc_split2')),curator:val('lc_curator'),support:val('lc_support'),salaryAllocation:num(val('lc_salary')),notes:val('lc_notes'),broker:val('lc_a1'),createdAt:existing.createdAt||today()};
    // ASH-confirmation can only be granted by a user holding the "approve" right (ASH/ADM/CFO) —
    // for everyone else, preserve whatever was already on the record instead of trusting the DOM.
    if(rights().approve){ out.ashConfirmed=checked('lc_ash'); if(out.ashConfirmed&&!existing.ashConfirmed){out.ashConfirmedBy=userName();out.ashConfirmedAt=new Date().toISOString();} else if(!out.ashConfirmed){out.ashConfirmedBy='';out.ashConfirmedAt='';} else {out.ashConfirmedBy=existing.ashConfirmedBy;out.ashConfirmedAt=existing.ashConfirmedAt;} }
    else { out.ashConfirmed=!!existing.ashConfirmed; out.ashConfirmedBy=existing.ashConfirmedBy; out.ashConfirmedAt=existing.ashConfirmedAt; }
    return out;
  }
  window.v326LeasePreview=function(){var box=document.getElementById('v326LeasePreview'); if(!box)return; var d=formDealFromDOM('x'), c=leaseCalc(d); box.innerHTML='<h4>'+h(t('preview'))+'</h4>'+chips('<span>C = '+money(c.C,d.currency)+'</span><span>'+h(t('agent'))+': '+money(c.agentTotal,d.currency)+'</span><span>'+h(t('curator'))+': '+money(c.curator,d.currency)+'</span><span>HO: '+money(c.support,d.currency)+'</span><span>'+h(t('company'))+': '+money(c.company,d.currency)+'</span><span>'+h(t('companyNet'))+': '+money(c.companyNet,d.currency)+'</span>')+'<table class="v326-table compact"><tr><th>'+h(t('participant'))+'</th><th>'+h(t('role'))+'</th><th>'+h(t('share'))+'</th><th>'+h(t('amount'))+'</th></tr>'+c.rows.map(function(r){return '<tr><td>'+h(r.name)+'</td><td>'+h(r.role)+'</td><td>'+((+r.share||0).toFixed(2))+'%</td><td>'+money(r.amount,d.currency)+'</td></tr>';}).join('')+'</table>';};
  window.v326SaveLeaseDeal=function(did){var d=formDealFromDOM(did); if(!d.tenant){fieldWarn('lc_tenant',t('tenant')+' — '+t('required'));return;} var cfg=window.COMMISSION_ENGINE_CFG.lease; if(d.paymentStatus==='paid'&&cfg.needsAshConfirmation&&!d.ashConfirmed){fieldWarn('lc_pay',t('ashConfirm')+' — '+t('required'));return;} var i=window.LEASE_COMMISSION_DEALS.findIndex(function(x){return x.id===d.id;}); if(i>=0) window.LEASE_COMMISSION_DEALS[i]=Object.assign(window.LEASE_COMMISSION_DEALS[i],d,{updatedAt:new Date().toISOString()}); else window.LEASE_COMMISSION_DEALS.unshift(d); audit326('Lease commission deal saved',d.tenant+' · '+money(leaseCalc(d).C,d.currency)); persist326(); v326CloseModal(); go('v326_lease');};
  function fieldWarn(idv,msg){var e=document.getElementById(idv); if(e){e.classList.add('v326-invalid'); e.focus();} try{alert(msg);}catch(_){}} 

  window.v326LeaseSettings=function(){
    ensureData(); var c=window.COMMISSION_ENGINE_CFG.lease;
    var html='<div class="v326-form"><div class="v326-row3">'+sel(t('baseMethod'),'ls_base',c.baseMethod,[['manual',t('manual')],['one_month',t('oneMonth')],['annual_percent',t('annualPercent')],['fixed',t('fixed')]])+inp('% annual','ls_ann',c.annualPercent,'number')+inp(t('fixed'),'ls_fixed',c.fixedAmount,'number')+'</div><div class="v326-row4">'+inp(t('curatorSelf'),'ls_cs',c.curatorSelfShare,'number')+inp(t('externalAgent'),'ls_ex',c.externalAgentShare,'number')+inp(t('internalAgent'),'ls_in',c.internalAgentShare,'number')+inp('HO','ls_ho',c.supportShare,'number')+'</div><div class="v326-row4">'+inp(t('curator'),'ls_curshare',c.curatorShare,'number')+inp(t('company')+' scenario 3','ls_comp3',c.scenario3CompanyShare,'number')+inp(t('salary'),'ls_sal',c.internalMonthlySalary,'number')+inp(t('fx'),'ls_fx',window.COMMISSION_ENGINE_CFG.fxRate,'number')+'</div><div class="v326-row3">'+inp(t('curator'),'ls_curname',c.curatorName)+inp(t('support'),'ls_supname',c.supportName)+'<label style="margin-top:28px"><input type="checkbox" id="ls_ash" '+(c.needsAshConfirmation?'checked':'')+'> '+h(t('ashConfirm'))+'</label></div>'+chips('<span>25 / 20 / 15 / 5 / 5 — '+h(t('settings'))+'</span><span>'+h(t('formula'))+': C × share</span>')+'</div>';
    modal(t('settings'),html,'<button class="btn ghost" onclick="v326CloseModal()">'+h(t('cancel'))+'</button><button class="btn" onclick="v326SaveLeaseSettings()">'+h(t('save'))+'</button>');
  };
  window.v326SaveLeaseSettings=function(){var c=window.COMMISSION_ENGINE_CFG.lease; c.baseMethod=val('ls_base'); c.annualPercent=num(val('ls_ann')); c.fixedAmount=num(val('ls_fixed')); c.curatorSelfShare=num(val('ls_cs')); c.externalAgentShare=num(val('ls_ex')); c.internalAgentShare=num(val('ls_in')); c.supportShare=num(val('ls_ho')); c.curatorShare=num(val('ls_curshare')); c.scenario3CompanyShare=num(val('ls_comp3')); c.internalMonthlySalary=num(val('ls_sal')); c.curatorName=val('ls_curname'); c.supportName=val('ls_supname'); c.needsAshConfirmation=checked('ls_ash'); window.COMMISSION_ENGINE_CFG.fxRate=num(val('ls_fx'))||11974; audit326('Lease commission settings changed',''); persist326(); v326CloseModal(); go('v326_lease');};
  window.v326LeaseReport=function(){var deals=visibleLeaseDeals(), led=leaseLedgerRows(deals); var rows='<table class="v326-table"><tr><th>'+h(t('participant'))+'</th><th>'+h(t('role'))+'</th><th>'+h(t('paid'))+'</th><th>'+h(t('pending'))+'</th><th>'+h(t('weighted'))+'</th><th>'+h(t('lost'))+'</th></tr>'; var g={}; led.forEach(function(r){var k=r.name+'|'+r.role; g[k]=g[k]||{name:r.name,role:r.role,earned:0,pending:0,weighted:0,lost:0}; ['earned','pending','weighted','lost'].forEach(function(x){g[k][x]+=r[x];});}); Object.values(g).forEach(function(r){rows+='<tr><td>'+h(r.name)+'</td><td>'+h(r.role)+'</td><td>'+money(r.earned)+'</td><td>'+money(r.pending)+'</td><td>'+money(r.weighted)+'</td><td>'+money(r.lost)+'</td></tr>';}); rows+='</table>'; modal(t('reports'),'<div class="v326-form">'+chips('<span>'+h(t('accounting'))+'</span><span>'+h(t('google'))+'</span>')+rows+'</div>','<button class="btn ghost" onclick="v326ExportLease()">'+h(t('export'))+'</button><button class="btn" onclick="v326CloseModal()">OK</button>');};
  window.v326ExportLease=function(){var led=leaseLedgerRows(visibleLeaseDeals()); exportCSV('case_os_lease_commission_ledger',[['Deal',function(r){return r.deal.tenant;}],['Participant','name'],['Role','role'],['Amount','amount'],['Earned','earned'],['Pending','pending'],['Weighted','weighted'],['Lost','lost'],['Currency','currency']],led);};

  function supplierCatLabel(c){var L=lang(); return L==='uz'?(c.uz||c.name):L==='en'?(c.en||c.name):c.name;}
  function supplierCalc(deal){
    var sup=window.SUPPLIERS.find(function(s){return s.id===deal.supplierId;})||{}, cfg=window.COMMISSION_ENGINE_CFG.supplier;
    var cat=(cfg.categories||[]).find(function(c){return c.name===(deal.category||sup.category);})||{};
    var rate=num(deal.commissionRate||sup.commissionRate||cat.commissionRate||cfg.defaultCommissionRate);
    var disc=num(deal.discountRate||sup.discountRate||cat.discountRate||cfg.defaultClientDiscount);
    var order=num(deal.orderAmount), comm=order*rate/100, saving=order*disc/100;
    return {supplier:sup,commissionRate:rate,discountRate:disc,caseCommission:comm,clientSaving:saving};
  }
  function visibleSupplierDeals(){ensureData(); var rows=window.SUPPLIER_COMMISSION_DEALS.slice(); if(canAll())return rows; var me=brokerName(); return rows.filter(function(d){return d.owner===me||d.broker===me;});}
  function renderSuppliers(){
    ensureData(); var deals=visibleSupplierDeals(), sups=window.SUPPLIERS.slice(), cats=window.COMMISSION_ENGINE_CFG.supplier.categories||[];
    var totals=deals.map(function(d){var c=supplierCalc(d); return {order:num(d.orderAmount),comm:c.caseCommission,saving:c.clientSaving,paid:d.status==='received'?c.caseCommission:0,pending:d.status!=='received'&&d.status!=='reversed'?c.caseCommission:0};});
    var k='<div class="v326-kpis"><div class="v326-kpi"><small>'+h(t('supplierCatalog'))+'</small><b>'+sups.length+'</b></div><div class="v326-kpi"><small>'+h(t('supplierDeals'))+'</small><b>'+deals.length+'</b></div><div class="v326-kpi"><small>'+h(t('gross'))+'</small><b>'+money(sum(totals,'comm'))+'</b></div><div class="v326-kpi warn"><small>'+h(t('pending'))+'</small><b>'+money(sum(totals,'pending'))+'</b></div><div class="v326-kpi"><small>'+h(t('clientSavings'))+'</small><b>'+money(sum(totals,'saving'))+'</b></div></div>';
    var catsHtml='<div class="v326-card"><div class="v326-head"><div><div class="v326-eye">SUPPLIER CATEGORIES</div><h3>'+h(t('category'))+'</h3></div><button class="btn ghost sm" onclick="v326SupplierSettings()">'+h(t('settings'))+'</button></div>'+chips(cats.map(function(c){return '<span><b>'+h(supplierCatLabel(c))+'</b> · CASE '+num(c.commissionRate)+'% · '+h(t('clientDiscount'))+' '+num(c.discountRate)+'%</span>';}).join(''))+'</div>';
    var supTable=sups.length?'<table class="v326-table"><tr><th>'+h(t('supplierName'))+'</th><th>'+h(t('category'))+'</th><th>'+h(t('commissionRate'))+'</th><th>'+h(t('clientDiscount'))+'</th><th>'+h(t('client'))+'</th><th></th></tr>'+sups.map(function(s){return '<tr><td><b>'+h(s.name)+'</b><div class="mut">'+h(s.phone||'')+' '+h(s.email||'')+'</div></td><td>'+h(s.category||'')+'</td><td>'+num(s.commissionRate)+'%</td><td>'+num(s.discountRate)+'%</td><td>'+h(s.contact||'-')+'</td><td><button class="btn ghost sm" onclick="v326SupplierForm(\''+h(s.id)+'\')">'+h(t('edit'))+'</button></td></tr>';}).join('')+'</table>':'<div class="v326-empty">'+h(t('noRows'))+'</div>';
    var dealTable=deals.length?'<table class="v326-table"><tr><th>'+h(t('supplierName'))+'</th><th>'+h(t('client'))+'</th><th>'+h(t('order'))+'</th><th>'+h(t('commissionRate'))+'</th><th>'+h(t('clientSaving'))+'</th><th>'+h(t('disclosure'))+'</th><th>'+h(t('status'))+'</th><th></th></tr>'+deals.map(function(d){var c=supplierCalc(d);return '<tr><td><b>'+h((c.supplier&&c.supplier.name)||d.supplierName||'-')+'</b><div class="mut">'+h(d.category||'')+'</div></td><td>'+h(d.client||'-')+'</td><td>'+money(d.orderAmount,d.currency)+'</td><td>'+num(c.commissionRate)+'%<div class="mut">'+money(c.caseCommission,d.currency)+'</div></td><td>'+num(c.discountRate)+'%<div class="mut">'+money(c.clientSaving,d.currency)+'</div></td><td>'+((d.clientDisclosure&&d.supplierDisclosure)?'<span class="v326-ok">✓</span>':'<span class="v326-bad">!</span>')+'<div class="mut">'+h(d.disclosureDate||'')+'</div></td><td>'+h(d.status||'expected')+'</td><td><button class="btn ghost sm" onclick="v326SupplierDealForm(\''+h(d.id)+'\')">'+h(t('edit'))+'</button></td></tr>';}).join('')+'</table>':'<div class="v326-empty">'+h(t('noRows'))+'</div>';
    return pageHead(t('supplier'),t('supplierSub'),'<button class="btn" onclick="v326SupplierForm()">+ '+h(t('addSupplier'))+'</button> <button class="btn ghost" onclick="v326SupplierDealForm()">+ '+h(t('addSupplierDeal'))+'</button> <button class="btn ghost" onclick="v326ExportSuppliers()">'+h(t('export'))+'</button> '+(canAll()?'<button class="btn ghost" onclick="v326SupplierSettings()">'+h(t('settings'))+'</button>':''))+k+catsHtml+'<div class="v326-split"><div class="v326-card"><div class="v326-head"><div><div class="v326-eye">CATALOG</div><h3>'+h(t('supplierCatalog'))+'</h3></div></div>'+supTable+'</div><div class="v326-card"><div class="v326-head"><div><div class="v326-eye">DEALS</div><h3>'+h(t('supplierDeals'))+'</h3></div></div>'+dealTable+'</div></div>';
  }
  window.v326SupplierForm=function(sid){ensureData(); var s=window.SUPPLIERS.find(function(x){return x.id===sid;})||{}, cats=window.COMMISSION_ENGINE_CFG.supplier.categories||[]; var html='<div class="v326-form"><div class="v326-row2">'+inp(t('supplierName'),'sp_name',s.name||'')+sel(t('category'),'sp_cat',s.category||'',cats.map(function(c){return [c.name,supplierCatLabel(c)];}))+'</div><div class="v326-row4">'+inp(t('commissionRate'),'sp_rate',s.commissionRate||window.COMMISSION_ENGINE_CFG.supplier.defaultCommissionRate,'number')+inp(t('clientDiscount'),'sp_disc',s.discountRate||window.COMMISSION_ENGINE_CFG.supplier.defaultClientDiscount,'number')+inp('Phone','sp_phone',s.phone||'')+inp('Email','sp_email',s.email||'')+'</div>'+inp('Contact','sp_contact',s.contact||'')+area('Terms / notes','sp_notes',s.notes||'')+'</div>'; modal(t('supplierName'),html,'<button class="btn ghost" onclick="v326CloseModal()">'+h(t('cancel'))+'</button><button class="btn" onclick="v326SaveSupplier(\''+(sid||'')+'\')">'+h(t('save'))+'</button>');};
  window.v326SaveSupplier=function(sid){var row={id:sid||id(),name:val('sp_name').trim(),category:val('sp_cat'),commissionRate:num(val('sp_rate')),discountRate:num(val('sp_disc')),phone:val('sp_phone'),email:val('sp_email'),contact:val('sp_contact'),notes:val('sp_notes'),createdAt:today()}; if(!row.name){fieldWarn('sp_name',t('supplierName')+' — '+t('required'));return;} var i=window.SUPPLIERS.findIndex(function(x){return x.id===row.id;}); if(i>=0) window.SUPPLIERS[i]=Object.assign(window.SUPPLIERS[i],row); else window.SUPPLIERS.unshift(row); audit326('Supplier saved',row.name); persist326(); v326CloseModal(); go('v326_suppliers');};
  window.v326SupplierDealForm=function(did){ensureData(); var d=window.SUPPLIER_COMMISSION_DEALS.find(function(x){return x.id===did;})||{}, supOpts=[['','—']].concat(window.SUPPLIERS.map(function(s){return [s.id,s.name];})); var html='<div class="v326-form" oninput="v326SupplierPreview()" onchange="v326SupplierPreview()"><div class="v326-row3">'+sel(t('supplierName'),'sd_sup',d.supplierId||'',supOpts)+inp(t('client'),'sd_client',d.client||'')+sel(t('currency'),'sd_cur',d.currency||'USD',[['USD','USD'],['UZS','UZS']])+'</div><div class="v326-row4">'+inp(t('order'),'sd_order',d.orderAmount||'','number')+inp(t('commissionRate'),'sd_rate',d.commissionRate||'','number')+inp(t('clientDiscount'),'sd_disc',d.discountRate||'','number')+sel(t('orderStatus'),'sd_status',d.status||'expected',[['expected',t('expected')],['received',t('received')],['reversed',t('reversed')]])+'</div><div class="v326-row3"><label><input type="checkbox" id="sd_client_disc" '+(d.clientDisclosure?'checked':'')+'> '+h(t('clientKnows'))+'</label><label><input type="checkbox" id="sd_supplier_disc" '+(d.supplierDisclosure?'checked':'')+'> '+h(t('supplierKnows'))+'</label>'+inp(t('disclosureDate'),'sd_discdate',d.disclosureDate||today(),'date')+'</div><div class="v326-row2">'+inp(t('agent'),'sd_owner',d.owner||brokerName())+inp(t('stage'),'sd_stage',d.stage||'order')+'</div>'+area('Notes','sd_notes',d.notes||'')+'<div id="v326SupplierPreview" class="v326-preview"></div></div>'; modal(t('supplierDeals'),html,'<button class="btn ghost" onclick="v326CloseModal()">'+h(t('cancel'))+'</button><button class="btn" onclick="v326SaveSupplierDeal(\''+(did||'')+'\')">'+h(t('save'))+'</button>'); setTimeout(window.v326SupplierPreview,50);};
  function supplierDealFromDOM(idv){var supId=val('sd_sup'), sup=window.SUPPLIERS.find(function(s){return s.id===supId;})||{}; return {id:idv||id(),supplierId:supId,supplierName:sup.name||'',category:sup.category||'',client:val('sd_client'),currency:val('sd_cur'),orderAmount:num(val('sd_order')),commissionRate:num(val('sd_rate'))||num(sup.commissionRate),discountRate:num(val('sd_disc'))||num(sup.discountRate),status:val('sd_status'),clientDisclosure:checked('sd_client_disc'),supplierDisclosure:checked('sd_supplier_disc'),disclosureDate:val('sd_discdate'),owner:val('sd_owner'),broker:val('sd_owner'),stage:val('sd_stage'),notes:val('sd_notes'),createdAt:today()};}
  window.v326SupplierPreview=function(){var box=document.getElementById('v326SupplierPreview'); if(!box)return; var d=supplierDealFromDOM('x'), c=supplierCalc(d); box.innerHTML='<h4>'+h(t('preview'))+'</h4>'+chips('<span>'+h(t('gross'))+': '+money(d.orderAmount,d.currency)+'</span><span>'+h(t('commissionRate'))+': '+num(c.commissionRate)+'%</span><span>CASE: '+money(c.caseCommission,d.currency)+'</span><span>'+h(t('clientSaving'))+': '+money(c.clientSaving,d.currency)+'</span>')+(!d.clientDisclosure||!d.supplierDisclosure?'<div class="v326-warn">'+h(t('needDisclosure'))+'</div>':'');};
  window.v326SaveSupplierDeal=function(did){var d=supplierDealFromDOM(did); if(!d.supplierId){fieldWarn('sd_sup',t('supplierName')+' — '+t('required'));return;} if(!d.client){fieldWarn('sd_client',t('client')+' — '+t('required'));return;} if(d.status==='received'&&window.COMMISSION_ENGINE_CFG.supplier.requireDisclosureBeforePaid&&(!d.clientDisclosure||!d.supplierDisclosure)){fieldWarn('sd_status',t('needDisclosure'));return;} var i=window.SUPPLIER_COMMISSION_DEALS.findIndex(function(x){return x.id===d.id;}); if(i>=0) window.SUPPLIER_COMMISSION_DEALS[i]=Object.assign(window.SUPPLIER_COMMISSION_DEALS[i],d,{updatedAt:new Date().toISOString()}); else window.SUPPLIER_COMMISSION_DEALS.unshift(d); audit326('Supplier commission deal saved',d.supplierName+' · '+d.client); persist326(); v326CloseModal(); go('v326_suppliers');};
  window.v326SupplierSettings=function(){var s=window.COMMISSION_ENGINE_CFG.supplier, cats=s.categories||[]; var catRows='<table class="v326-table compact"><tr><th>'+h(t('category'))+'</th><th>CASE %</th><th>'+h(t('clientDiscount'))+' %</th></tr>'+cats.map(function(c,i){return '<tr><td><b>'+h(supplierCatLabel(c))+'</b></td><td><input id="ss_cat_cr_'+i+'" type="number" value="'+h(c.commissionRate||s.defaultCommissionRate)+'"></td><td><input id="ss_cat_disc_'+i+'" type="number" value="'+h(c.discountRate||s.defaultClientDiscount)+'"></td></tr>';}).join('')+'</table>'; var html='<div class="v326-form"><div class="v326-row3">'+inp(t('commissionRate'),'ss_rate',s.defaultCommissionRate,'number')+inp(t('clientDiscount'),'ss_disc',s.defaultClientDiscount,'number')+'<label style="margin-top:28px"><input type="checkbox" id="ss_req" '+(s.requireDisclosureBeforePaid?'checked':'')+'> '+h(t('disclosure'))+'</label></div><h4>'+h(t('category'))+' / '+h(t('rules'))+'</h4>'+catRows+'<div class="v326-warn">'+h(t('conflict'))+': '+h('скидка клиенту должна быть реальной, а комиссия CASE раскрытой.')+'</div></div>'; modal(t('settings'),html,'<button class="btn ghost" onclick="v326CloseModal()">'+h(t('cancel'))+'</button><button class="btn" onclick="v326SaveSupplierSettings()">'+h(t('save'))+'</button>');};
  window.v326SaveSupplierSettings=function(){var s=window.COMMISSION_ENGINE_CFG.supplier; s.defaultCommissionRate=num(val('ss_rate')); s.defaultClientDiscount=num(val('ss_disc')); s.requireDisclosureBeforePaid=checked('ss_req'); (s.categories||[]).forEach(function(c,i){c.commissionRate=num(val('ss_cat_cr_'+i))||s.defaultCommissionRate;c.discountRate=num(val('ss_cat_disc_'+i))||s.defaultClientDiscount;}); audit326('Supplier commission settings changed',''); persist326(); v326CloseModal(); go('v326_suppliers');};
  window.v326ExportSuppliers=function(){var rows=visibleSupplierDeals().map(function(d){var c=supplierCalc(d);return Object.assign({},d,c);}); exportCSV('asaas_os_supplier_commissions',[['Supplier','supplierName'],['Client','client'],['Order','orderAmount'],['Commission rate','commissionRate'],['CASE commission','caseCommission'],['Client saving','clientSaving'],['Client disclosure',function(r){return r.clientDisclosure?'yes':'no';}],['Supplier disclosure',function(r){return r.supplierDisclosure?'yes':'no';}],['Status','status']],rows);};

  function installCSS(){if(document.getElementById('case-v326-style'))return; var css=
    '.v326-tools{display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap;margin:8px 0 12px}.v326-card{background:var(--card);border:1px solid var(--border);border-radius:16px;padding:14px;margin:12px 0;box-shadow:var(--shadow)}.v326-head{display:flex;align-items:flex-start;justify-content:space-between;gap:10px;margin-bottom:10px}.v326-eye{font-size:10px;font-weight:900;letter-spacing:.08em;text-transform:uppercase;color:var(--red-d)}.v326-kpis{display:grid;grid-template-columns:repeat(5,minmax(120px,1fr));gap:9px}.v326-kpi{border:1px solid var(--border);border-radius:13px;padding:10px;background:var(--soft)}.v326-kpi small{display:block;color:var(--muted);font-size:11px}.v326-kpi b{display:block;color:var(--ink);font-size:20px}.v326-kpi.warn b{color:#a86800}.v326-kpi.bad b{color:var(--red-d)}.v326-split{display:grid;grid-template-columns:1.45fr .75fr;gap:12px}.v326-table{width:100%;border-collapse:separate;border-spacing:0;font-size:12px}.v326-table th,.v326-table td{border-bottom:1px solid var(--border);padding:9px 8px;text-align:left;vertical-align:top;color:var(--ink)}.v326-table th{color:var(--muted);font-size:10.5px;text-transform:uppercase;letter-spacing:.04em;background:var(--card);position:sticky;top:0}.v326-table.compact th,.v326-table.compact td{padding:6px}.v326-minirow{display:block;margin:2px 0}.v326-chips{display:flex;gap:6px;flex-wrap:wrap}.v326-chips span{display:inline-flex;border:1px solid var(--border);background:var(--soft);border-radius:999px;padding:5px 9px;color:var(--ink);font-size:11.5px}.v326-empty{border:1px dashed var(--border);border-radius:13px;padding:22px;text-align:center;color:var(--muted);background:var(--soft)}.v326-form label{display:block;font-size:11px;font-weight:700;color:var(--muted);margin:8px 0 4px}.v326-form input,.v326-form select,.v326-form textarea{box-sizing:border-box;width:100%;background:var(--card);color:var(--ink);border:1px solid var(--border);border-radius:10px;padding:8px 9px;font-family:inherit;font-size:12.5px}.v326-form textarea{min-height:72px;resize:vertical}.v326-row2{display:grid;grid-template-columns:1fr 1fr;gap:9px}.v326-row3{display:grid;grid-template-columns:1fr 1fr 1fr;gap:9px}.v326-row4{display:grid;grid-template-columns:repeat(4,1fr);gap:9px}.v326-preview{border:1px solid var(--border);border-radius:13px;background:var(--soft);padding:10px;margin-top:10px}.v326-modal{position:fixed;inset:0;background:rgba(0,0,0,.48);z-index:10050;display:flex;align-items:center;justify-content:center;padding:18px}.v326-modal-box{position:relative;max-width:980px;width:100%;max-height:88vh;overflow:auto;background:var(--card);color:var(--ink);border:1px solid var(--border);border-radius:18px;box-shadow:0 18px 60px rgba(0,0,0,.34);padding:18px}.v326-close{position:absolute;right:12px;top:10px;border:0;background:transparent;color:var(--muted);font-size:22px;cursor:pointer}.v326-actions{display:flex;justify-content:flex-end;gap:8px;flex-wrap:wrap;margin-top:14px}.v326-ok{color:var(--green);font-weight:900}.v326-bad{color:var(--red-d);font-weight:900}.v326-warn{margin-top:8px;border:1px solid rgba(174,112,0,.28);background:rgba(174,112,0,.08);color:var(--ink);border-radius:10px;padding:8px;font-size:12px}.v326-invalid{border-color:#b40000!important;box-shadow:0 0 0 3px rgba(180,0,0,.12)!important}.v326-nav a{display:flex;align-items:center;gap:8px;padding:9px 10px;border-radius:10px;color:var(--ink);text-decoration:none;cursor:pointer}.v326-nav a:hover,.v326-nav a.active{background:var(--soft);color:var(--red-d)}body.dark .v326-card,body.dark .v326-modal-box{background:#211f1b;color:#f6efe6}body.dark .v326-kpi,body.dark .v326-chips span,body.dark .v326-empty,body.dark .v326-preview{background:#28261f}body.dark .v326-form input,body.dark .v326-form select,body.dark .v326-form textarea{background:#1f1d19;color:#f6efe6;border-color:#4a4438}body.dark .v326-table th{background:#211f1b}@media(max-width:1100px){.v326-kpis{grid-template-columns:repeat(2,1fr)}.v326-split,.v326-row2,.v326-row3,.v326-row4{grid-template-columns:1fr}}';
    var st=document.createElement('style'); st.id='case-v326-style'; st.textContent=css; document.head.appendChild(st);
  }
  function appendNav(){var nav=document.getElementById('nav'); if(!nav||nav.querySelector('.v326-nav'))return; var html='<div class="v326-nav"><div class="sep">CASE OS 4.9.3</div><a data-v="v326_lease" onclick="go(\'v326_lease\')"><span class="ic">%</span> '+h(t('lease'))+'</a><a data-v="v326_suppliers" onclick="go(\'v326_suppliers\')"><span class="ic">✦</span> '+h(t('supplier'))+'</a></div>'; nav.insertAdjacentHTML('beforeend',html);}
  function installNav(){var old=window.buildNav; if(typeof old==='function'&&!old._v326){window.buildNav=function(){var r=old.apply(this,arguments); try{appendNav();}catch(e){} return r;}; window.buildNav._v326=true;}}
  function installGo(){var old=window.go; if(typeof old==='function'&&!old._v326){window.go=function(v){ if(v==='v326_lease'||v==='v326_suppliers'){ensureData(); try{S.view=v;}catch(e){} var main=document.getElementById('main'); if(main) main.innerHTML=(v==='v326_lease'?renderLease():renderSuppliers())+footSafe(); document.querySelectorAll('#nav a').forEach(function(a){a.classList.toggle('active',a.dataset.v===v);}); try{saveUiPrefs();}catch(e){} return;} return old.apply(this,arguments);}; window.go._v326=true;}}
  function footSafe(){try{return typeof footNote==='function'?footNote():'';}catch(e){return '';}}
  function wrapDash(){var old=window.renderDash; if(typeof old==='function'&&!old._v326){window.renderDash=function(){var r=old.apply(this,arguments); try{injectDashCards();}catch(e){} return r;}; window.renderDash._v326=true;}}
  function injectDashCards(){var main=document.getElementById('main'); if(!main||main.querySelector('.v326-dash'))return; ensureData(); var deals=visibleLeaseDeals(), sup=visibleSupplierDeals(); var leaseSum=sum(deals.map(function(d){return {x:leaseCalc(d).C};}),'x'); var supSum=sum(sup.map(function(d){return {x:supplierCalc(d).caseCommission};}),'x'); /* v4.34: без английской «шапки-девиза» и текста о приватности на самом видном месте (переехал в title);
   плитка «Открытые параметры — ASH» убрана с дашборда — она ничего не сообщала */
 var html='<div class="v326-card v326-dash" title="'+h(t('privacy'))+'"><div class="v326-head"><div><h3>'+h(t('lease'))+' / '+h(t('supplier'))+'</h3></div><div><button class="btn ghost sm" onclick="go(\'v326_lease\')">'+h(t('lease'))+'</button> <button class="btn ghost sm" onclick="go(\'v326_suppliers\')">'+h(t('supplier'))+'</button></div></div><div class="v326-kpis"><div class="v326-kpi"><small>'+h(t('lease'))+'</small><b>'+money(leaseSum)+'</b></div><div class="v326-kpi"><small>'+h(t('supplier'))+'</small><b>'+money(supSum)+'</b></div><div class="v326-kpi warn"><small>'+h(t('pending'))+'</small><b>'+money(sum(leaseLedgerRows(deals),'pending'))+'</b></div><div class="v326-kpi"><small>'+h(t('clientSavings'))+'</small><b>'+money(sum(sup.map(function(d){return {x:supplierCalc(d).clientSaving};}),'x'))+'</b></div></div></div>'; var after=main.querySelector('.v32-hub')||main.querySelector('.v31-practice-card')||main.querySelector('.ph'); if(after)after.insertAdjacentHTML('afterend',html);}
  function install(){ensureData(); installCSS(); wrapState(); installNav(); installGo(); wrapDash(); try{if(typeof buildNav==='function')buildNav();}catch(e){} try{if(S&&S.view==='dash')injectDashCards();}catch(e){}}
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',install,{once:true}); else install();
})();
