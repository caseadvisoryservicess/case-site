(function(){
  'use strict';
  var V='4.9.3';
  var DRAFT_KEY='asaas-os-brand-draft-v35';
  var BF={q:'',fit:'',chip:'all',view:'table',limit:50,pageSize:50,sort:'',dir:1,filters:{}};
  var renderTimer=null, lastFocus=null;
  function $(id){return document.getElementById(id);} 
  function arr(x){return Array.isArray(x)?x:[];}
  // ASAAS v3.5.7: index.html declares core data as top-level const/let (BRANDS, USERS, S, etc.).
  // Those bindings are visible to other classic scripts by name, but they are NOT window.* properties.
  // Using only window.BRANDS caused the brand database to appear empty.
  function coreBrands(){try{if(typeof BRANDS!=='undefined')return BRANDS;}catch(e){} return window.BRANDS;}
  function coreUsers(){try{if(typeof USERS!=='undefined')return USERS;}catch(e){} return window.USERS;}
  function coreAgents(){try{if(typeof AGENTS!=='undefined')return AGENTS;}catch(e){} return window.AGENTS;}
  function coreCats(){try{if(typeof CASECATS!=='undefined')return CASECATS;}catch(e){} return window.CASECATS;}
  function coreCatSubs(){try{if(typeof CATSUBS!=='undefined')return CATSUBS;}catch(e){} return window.CATSUBS;}
  function coreS(){try{if(typeof S!=='undefined')return S;}catch(e){} return window.S||{};}
  function coreReqs(){try{if(typeof BRAND_REQUESTS!=='undefined')return BRAND_REQUESTS;}catch(e){} return window.BRAND_REQUESTS;}
  function brands(){return arr(coreBrands());} 
  function esc(v){return (v==null?'':String(v)).replace(/[&<>"']/g,function(m){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m];});}
  function num(v){var n=parseFloat(String(v||'').replace(',','.').replace(/[^0-9.\-]/g,'')); return isNaN(n)?0:n;}
  function h(v){return esc(v);} 
  function toast(msg){try{ if(typeof window.toast==='function') return window.toast(msg); }catch(e){} var box=$('toastBox'); if(!box){box=document.createElement('div');box.id='toastBox';box.style.cssText='position:fixed;left:50%;bottom:22px;transform:translateX(-50%);z-index:999999';document.body.appendChild(box);} var el=document.createElement('div');el.textContent=msg;el.style.cssText='background:#222;color:#fff;padding:10px 16px;border-radius:18px;font-size:12px;margin-top:6px';box.appendChild(el);setTimeout(function(){el.remove();},2600);}
  function persistSafe(){try{ if(typeof window.persist==='function') window.persist(); }catch(e){}}
  function roleInfo(){
    try{ if(typeof R==='function') return R()||{}; }catch(e){}
    try{ if(window.R&&typeof window.R==='function') return window.R()||{}; }catch(e){}
    try{ var st=coreS(); var rs=(typeof ROLES!=='undefined'?ROLES:window.ROLES); if(st&&st.role&&rs&&rs[st.role]) return rs[st.role]||{}; }catch(e){}
    return {};
  }
  function canEdit(){var r=roleInfo(); return !!(r.edit||r.admin||r.brandsOnly||r.brandsEdit);}
  function lang(){try{return (typeof LANG!=='undefined'?LANG:(window.LANG||'ru'));}catch(e){return 'ru';}}
  function tr(ru,uz,en){var l=lang();return l==='uz'?(uz||ru):l==='en'?(en||ru):ru;}
  // ASAAS v3.5.7: clean professional taxonomy + brand ownership and structured contacts.
  // Only canonical categories are shown in filters/forms; old imported names remain as aliases.
  var CANON_CATEGORIES=[
    'F&B / рестораны и кафе',
    'Мода и одежда',
    'Супермаркет / продукты',
    'Дом и интерьер',
    'Электроника и техника',
    'Красота и здоровье',
    'Ювелирные изделия и аксессуары',
    'Спорт и фитнес',
    'Развлечения',
    'Дети и образование',
    'Услуги и сервисы',
    'Специализированный ритейл',
    'Авто',
    'Офис / коворкинг',
    'Склад / технические помещения',
    'Прочее'
  ];
  var CAT_ALIAS_GROUPS={
    'F&B / рестораны и кафе':['F&B','F&B / Рестораны и кафе','F&B / кафе и рестораны','Еда и напитки','Рестораны и кафе','Кафе и рестораны','Места общественного питания','Фастфуд и фудкорт','Кофе, выпечка и сладости','Кафе и рестораны','QSR','Фудкорт'],
    'Мода и одежда':['Fashion','Мода и стиль','Мода и одежда','Одежда','Женская одежда','Мужская одежда','Детская одежда','Обувь и аксессуары','Обувь'],
    'Супермаркет / продукты':['Продукты','Food retail','Grocery','Супермаркет','Супермаркеты и продукты','Гипермаркет','Минимаркет','Convenience store'],
    'Дом и интерьер':['Мебель и товары для дома','Дом и интерьер','Товары для дома','Домашний текстиль','Посуда','Декор и интерьер','Освещение'],
    'Электроника и техника':['Электроника','Электроника, бытовая техника','Бытовая техника','Телефоны и гаджеты','Компьютеры и офис'],
    'Красота и здоровье':['Аптека','Здоровье и медицина','Частная Клиника','Клиника / медцентр','Парфюмерия и косметика','Красота и уход','Оптика','Салон красоты'],
    'Ювелирные изделия и аксессуары':['Украшения и часы','Ювелирные изделия, очки и бижутерия','Ювелирные изделия','Бижутерия','Часы','Аксессуары'],
    'Спорт и фитнес':['Спортивная одежда и товары','Спорттовары и экипировка','Спорттовары','Спортивное питание','Фитнес','Фитнес-клуб'],
    'Развлечения':['Развлечение','Entertainment','Развлечения и досуг','Боулинг / бильярд','Детский развлекательный центр'],
    'Дети и образование':['Детская одежда','Детские товары','Детское развитие / образование','Игрушки, книги, канцтовары и хобби','Книги и канцтовары'],
    'Услуги и сервисы':['Услуги','Сервисы','Банк / обмен валют','Банк / финансы / ATM','Киоски, спец. магазины','Пункт выдачи','Сервис','Telecom'],
    'Специализированный ритейл':['Специализированный ритейл','Specialty retail','Спец. ритейл'],
    'Авто':['Автоаксессуары','Автозапчасти','Автозапчасти и аксессуары','Автохимия и масла','Автосервис'],
    'Офис / коворкинг':['Офис','Офисы','Office','Коворкинг','Представительство','Бизнес-сервис'],
    'Склад / технические помещения':['Склад арендатора','Кладовая','Технический склад','Техническое помещение','Серверная','Электрощитовая','Санузлы','Коридор / проход','Летняя терраса','Терраса ресторана','Вспомогательные и тех. помещения'],
    'Прочее':['Другое','Other','Разное']
  };
  var CANON_SUBS={
    'F&B / рестораны и кафе':['Ресторан','Кафе','Кофейня','QSR / фастфуд','Фудкорт','Пекарня / выпечка','Десерты / мороженое','Бар / лаундж','Пицца','Бургеры','Национальная кухня','Азиатская кухня','Европейская кухня','Соки / смузи'],
    'Мода и одежда':['Женская одежда','Мужская одежда','Детская одежда','Обувь','Аксессуары','Нижнее бельё','Масс-маркет','Premium fashion','Одежда multi-brand'],
    'Супермаркет / продукты':['Супермаркет','Гипермаркет','Минимаркет','Продукты','Convenience store'],
    'Дом и интерьер':['Мебель','Посуда','Домашний текстиль','Декор и интерьер','Освещение','Товары для дома'],
    'Электроника и техника':['Телефоны и гаджеты','Бытовая техника','Компьютеры','Аксессуары для техники','Электроника'],
    'Красота и здоровье':['Аптека','Клиника / медцентр','Косметика','Парфюмерия','Салон красоты','Оптика','Здоровье и уход'],
    'Ювелирные изделия и аксессуары':['Ювелирные изделия','Часы','Бижутерия','Аксессуары','Очки / оптика'],
    'Спорт и фитнес':['Спортивная одежда','Спорттовары','Фитнес-клуб','Спортивное питание','Экипировка'],
    'Развлечения':['Кинотеатр','Детский развлекательный центр','Игровая зона','Боулинг / бильярд','Аттракционы','VR / киберспорт'],
    'Дети и образование':['Игрушки','Книги и канцтовары','Детское развитие / образование','Детский центр','Детские товары'],
    'Услуги и сервисы':['Банк / обмен валют','Пункт выдачи','Ремонт / сервис','Ателье','Химчистка','Туризм / авиакасса','Telecom','Киоск / спец. магазин'],
    'Специализированный ритейл':['Подарки и сувениры','Оператор / группа','Книги и канцтовары','Товары по одной цене / разное','Специализированный магазин'],
    'Авто':['Автозапчасти','Автоаксессуары','Автохимия и масла','Автосервис'],
    'Офис / коворкинг':['Офис','Коворкинг','Представительство','Бизнес-сервис'],
    'Склад / технические помещения':['Склад арендатора','Кладовая','Технический склад','Серверная','Электрощитовая','Санузлы','Коридор / проход','Терраса / летняя зона'],
    'Прочее':['Прочее']
  };
  var SUB_ALIAS_GROUPS={
    'Ресторан':['Кафе / ресторан','Ресторан — европейская'],
    'Национальная кухня':['Ресторан — узбекская / национальная','Узбекская кухня'],
    'Азиатская кухня':['Ресторан — азиатская / японская','Японская кухня','Азиатская / японская'],
    'Европейская кухня':['Европейская кухня'],
    'QSR / фастфуд':['QSR','QSR (быстрое питание)','QSR (ресторан быстрого питания)','Фастфуд','Фастфуд и фудкорт'],
    'Бургеры':['Фастфуд — бургеры','Бургеры'],
    'Пекарня / выпечка':['Выпечка и сладости','Пекарня-кафе','Кофе, выпечка и сладости'],
    'Десерты / мороженое':['Мороженое / йогурт','Десерты'],
    'Фудкорт':['Фудкорт (мультиоператор)'],
    'Женская одежда':['Fashion (масс-маркет)','Унисекс / масс-маркет','Одежда'],
    'Масс-маркет':['Fashion','Мода и стиль','Общая мода'],
    'Аксессуары':['Аксессуары','Аксессуары / сумки'],
    'Клиника / медцентр':['Частная Клиника','Клиника','Медцентр'],
    'Косметика':['Парфюмерия и косметика','Красота и уход'],
    'Очки / оптика':['Оптика'],
    'Спорттовары':['Спорттовары и экипировка'],
    'Книги и канцтовары':['Игрушки, книги, канцтовары и хобби','Книги / канцелярия'],
    'Банк / обмен валют':['Банк / финансы / ATM','Банк'],
    'Киоск / спец. магазин':['Киоски, спец. магазины'],
    'Автозапчасти':['Автозапчасти и аксессуары'],
    'Офис':['Офисы','Office'],
    'Терраса / летняя зона':['Летняя терраса','Терраса ресторана'],
    'Прочее':['Другое','Other','Разное']
  };
  function aliasHit(s, canon, groups){
    var k=String(s||'').trim().toLowerCase();
    if(!k)return false;
    if(String(canon||'').toLowerCase()===k)return true;
    var a=groups[canon]||[];
    for(var i=0;i<a.length;i++){if(String(a[i]).toLowerCase()===k)return true;}
    return false;
  }
  function catNorm(v){
    var s=String(v||'').trim(); if(!s)return '';
    for(var i=0;i<CANON_CATEGORIES.length;i++){if(aliasHit(s,CANON_CATEGORIES[i],CAT_ALIAS_GROUPS))return CANON_CATEGORIES[i];}
    return 'Прочее';
  }
  function sameCat(a,b){if(!a||!b)return false; return catNorm(a)===catNorm(b);}
  function cats(){return CANON_CATEGORIES.slice();}
  function subNorm(v,cat){
    var s=String(v||'').trim(); if(!s)return '';
    var canonCat=catNorm(cat);
    var own=(CANON_SUBS[canonCat]||[]);
    for(var i=0;i<own.length;i++){if(aliasHit(s,own[i],SUB_ALIAS_GROUPS))return own[i];}
    var all=[]; Object.keys(CANON_SUBS).forEach(function(k){all=all.concat(CANON_SUBS[k]||[]);});
    for(var j=0;j<all.length;j++){if(aliasHit(s,all[j],SUB_ALIAS_GROUPS))return all[j];}
    return s;
  }
  function allSubs(cat){
    var c=catNorm(cat||'');
    var out=[];
    if(cat){
      out=(CANON_SUBS[c]||[]).slice();
      brands().forEach(function(b){if(sameCat(b.cat,cat) && b.sub)out.push(subNorm(b.sub,cat));});
    }else{
      Object.keys(CANON_SUBS).forEach(function(k){out=out.concat(CANON_SUBS[k]||[]);});
    }
    return uniq(out).sort(function(a,b){return String(a).localeCompare(String(b),'ru');});
  }
  function statuses(){return {target:['Потенциальный','Пот'],contacted:['Был контакт','Конт'],active:['Активный','Акт'],inactive:['Неактивный','Неакт'],refused:['Отказ','Отказ']};}
  function statusFull(k){var s=statuses()[k];return s?s[0]:(k||'');}
  function statusShort(k){var s=statuses()[k];return s?s[1]:(k||'');}
  function country2(v){var s=String(v||'').trim(); if(!s)return '-'; var map={'узбекистан':'UZ','таджикистан':'TJ','казахстан':'KZ','россия':'RU','турция':'TR','китай':'CN','сша':'US','usa':'US','united states':'US','испания':'ES','италия':'IT','франция':'FR','оаэ':'AE','uae':'AE'}; var m=map[s.toLowerCase()]; return m||s.slice(0,2).toUpperCase();}
  function normPhone(v,cc){var s=String(v||'').trim(); if(!s)return ''; var plus=s[0]==='+'; var d=s.replace(/\D/g,''); if(!d)return ''; if(plus) return '+'+d; if(d.length===9 && (cc==='UZ'||!cc)) return '+998'+d; if(d.length===12 && d.indexOf('998')===0) return '+'+d; return '+'+d;}
  function ccFromCountry(country){var c=country2(country); var map={UZ:'+998',RU:'+7',KZ:'+7',TR:'+90',US:'+1',CN:'+86',TJ:'+992',AE:'+971',ES:'+34'}; return map[c]||'+';}
  function phoneLocal(v,cc){var s=String(v||'').trim(); if(!s)return ''; var d=s.replace(/\D/g,''); var c=String(cc||'').replace(/\D/g,''); if(c&&d.indexOf(c)===0)d=d.slice(c.length); return d;}
  function normPhoneWithCC(phone,cc){var p=String(phone||'').trim(); if(!p)return ''; if(p[0]==='+')return normPhone(p); var c=String(cc||'').trim(); if(!c)c='+998'; if(c[0]!=='+')c='+'+c.replace(/\D/g,''); return c+p.replace(/\D/g,'');}
  function brandCategory(b){return catNorm(b.cat||'');}
  function brandSub(b){return subNorm(b.sub||'', b.cat||'');}
  function contactText(b){var cs=arr(b.contacts); var parts=[]; cs.forEach(function(c){parts=parts.concat([c.name,c.title,c.phone,c.email]);}); if(!parts.length)parts=[b.person,b.phone,b.email]; return parts.filter(Boolean).join(' ');}
  function hasContact(b){return !!String(contactText(b)||'').trim() && String(contactText(b)||'').trim()!=='-';}
  function fitArea(b,area){var a=num(area); if(!a)return true; var mn=num(b.amin), mx=num(b.amax); if(mn&&a<mn)return false; if(mx&&a>mx)return false; return true;}
  function textPass(v,q){return !q || String(v||'').toLowerCase().indexOf(String(q).toLowerCase())>=0;}
  function numPass(v,q){q=String(q||'').trim(); if(!q)return true; var n=num(v); var m=q.match(/^>=\s*(\d+(?:[.,]\d+)?)/); if(m)return n>=num(m[1]); m=q.match(/^<=\s*(\d+(?:[.,]\d+)?)/); if(m)return n<=num(m[1]); m=q.match(/^(\d+(?:[.,]\d+)?)\s*-\s*(\d+(?:[.,]\d+)?)/); if(m)return n>=num(m[1])&&n<=num(m[2]); return String(v||'').indexOf(q)>=0;}
  function passBrand(b){var f=BF.filters||{}; var q=String(BF.q||'').toLowerCase(); if(q){var blob=[b.name,b.cat,b.sub,b.country,b.owner,contactText(b),b.notes,b.reqs,b.format,b.group,b.presence,b.reviewFlag,b.areaVariants,b.about,b.pos,b.concept,b.rec,statusFull(b.status)].join(' ').toLowerCase(); if(blob.indexOf(q)<0)return false;}
    if(!fitArea(b,BF.fit))return false;
    if(BF.chip==='mine'){var me=(coreS().user&&(coreS().user.name||coreS().user.broker||coreS().user.email))||''; if(!textPass(b.owner,me))return false;}
    if(BF.chip==='request'){try{var req=arr(coreReqs()).some(function(r){return String(r.brand||'').toLowerCase()===String(b.name||'').toLowerCase();}); if(!req)return false;}catch(e){return false;}}
    if(BF.chip==='noContact'&&hasContact(b))return false;
    if(BF.chip==='noArea'&&(num(b.amin)||num(b.amax)))return false;
    if(BF.chip==='noCat'&&b.cat)return false;
    if(BF.chip==='dups'){var n=String(b.name||'').trim().toLowerCase(); if(!n||brands().filter(function(x){return String(x.name||'').trim().toLowerCase()===n;}).length<2)return false;}
    if(BF.chip==='review'&&!String(b.reviewFlag||'').trim())return false;
    if(f.status && String(statusFull(b.status)).toLowerCase().indexOf(String(f.status).toLowerCase())<0 && String(b.status||'').toLowerCase().indexOf(String(f.status).toLowerCase())<0) return false;
    if(f.cat && !sameCat(b.cat,f.cat))return false; if(f.sub && !textPass(subNorm(b.sub,b.cat)+' '+(b.sub||''),f.sub))return false; if(f.country && !textPass(country2(b.country)+' '+b.country,f.country))return false; if(f.price && !textPass(b.price,f.price))return false; if(f.tier && !textPass(b.tier,f.tier))return false; if(f.owner && !textPass(b.owner,f.owner))return false; if(f.contact && !textPass(contactText(b),f.contact))return false; if(f.amin && !numPass(b.amin,f.amin))return false; if(f.amax && !numPass(b.amax,f.amax))return false; return true;}
  function optList(id,list){return '<datalist id="'+h(id)+'">'+list.map(function(x){return '<option value="'+h(x)+'">';}).join('')+'</datalist>';}
  function uniq(list){var s={}; return list.filter(function(x){x=String(x||'').trim(); if(!x)return false; var k=x.toLowerCase(); if(s[k])return false; s[k]=1; return true;});}
  function filterInput(id,key,ph,list){var v=(key==='q'?BF.q:(key==='fit'?BF.fit:(BF.filters[key]||''))); return '<input id="'+id+'" data-bf="'+key+'" value="'+h(v)+'" '+(list?'list="'+h(list)+'"':'')+' placeholder="'+h(ph||'')+'" autocomplete="off">';}
  function sortBy(rows){var k=BF.sort, dir=BF.dir||1;if(!k)return rows;rows.sort(function(a,b){var av,bv; if(k==='status'){av=statusFull(a.status);bv=statusFull(b.status);} else if(k==='country'){av=country2(a.country);bv=country2(b.country);} else {av=a[k];bv=b[k];} if(k==='amin'||k==='amax') return dir*(num(av)-num(bv)); return dir*String(av||'').localeCompare(String(bv||''),'ru');}); return rows;}
  function cssEsc(s){try{if(window.CSS&&CSS.escape)return CSS.escape(String(s));}catch(e){} return String(s||'').replace(/\\/g,'\\\\').replace(/"/g,'\\"').replace(/'/g,"\\'");}
  function focusInfo(el){
    el=el||(document&&document.activeElement);
    if(!el||!(/^(INPUT|SELECT|TEXTAREA)$/i.test(el.tagName||'')))return null;
    var selector='';
    if(el.id)selector='#'+cssEsc(el.id);
    else if(el.name)selector=(el.tagName||'input').toLowerCase()+'[name="'+cssEsc(el.name)+'"]';
    else if(el.getAttribute('data-bf'))selector='[data-bf="'+cssEsc(el.getAttribute('data-bf'))+'"]';
    else if(el.getAttribute('placeholder'))selector=(el.tagName||'input').toLowerCase()+'[placeholder="'+cssEsc(el.getAttribute('placeholder'))+'"]';
    else if(el.getAttribute('oninput'))selector=(el.tagName||'input').toLowerCase()+'[oninput="'+cssEsc(el.getAttribute('oninput'))+'"]';
    if(!selector)return null;
    var start=0,end=0; try{start=el.selectionStart||0;end=el.selectionEnd||start;}catch(e){}
    return {selector:selector,id:el.id||'',value:el.value,start:start,end:end,tag:el.tagName};
  }
  function restoreFocusInfo(info,tries){
    if(!info)return; tries=tries==null?6:tries;
    var el=null;
    try{el=info.id?$(info.id):document.querySelector(info.selector);}catch(e){}
    if(el&&el.focus){
      try{el.focus({preventScroll:true});
        if('value' in el && info.value!=null && el.value!==info.value && (el.tagName||'').toUpperCase()!=='SELECT') el.value=info.value;
        if(el.setSelectionRange && typeof el.value==='string'){var pos=Math.min(info.start,el.value.length), end=Math.min(info.end,el.value.length);el.setSelectionRange(pos,end);}
      }catch(e){}
      return;
    }
    if(tries>0)setTimeout(function(){restoreFocusInfo(info,tries-1);},35);
  }
  function restoreFocus(){if(!lastFocus)return; var info=lastFocus; lastFocus=null; restoreFocusInfo(info,6);}
  function cancelPendingBrandRender(){clearTimeout(renderTimer);renderTimer=null;lastFocus=null;}
  function scheduleRender(active){clearTimeout(renderTimer); renderTimer=setTimeout(function(){renderTimer=null;if(coreS().view==='brands')renderBrandsResultsOnly(active);},220);}
  window.asaas35BrandFilter=function(el,key,now){ if(!el)return; lastFocus=focusInfo(el); if(key==='q')BF.q=el.value; else if(key==='fit')BF.fit=el.value; else BF.filters[key]=el.value; BF.limit=BF.pageSize||50; if(key==='cat'){var valid=allSubs(el.value); if(BF.filters.sub && valid.length && valid.indexOf(BF.filters.sub)<0) BF.filters.sub='';} if(now)renderBrandsResultsOnly(el); else scheduleRender(el); };
  window.asaas35Chip=function(chip){cancelPendingBrandRender();BF.chip=chip||'all';BF.limit=BF.pageSize||50;renderBrandsStable();};
  window.asaas35Sort=function(k){cancelPendingBrandRender();if(BF.sort!==k){BF.sort=k;BF.dir=1;}else if(BF.dir>0){BF.dir=-1;}else{BF.sort='';BF.dir=1;}renderBrandsStable();};
  window.asaas35Page=function(mode){cancelPendingBrandRender();if(mode==='more')BF.limit=(BF.limit||BF.pageSize||50)+(BF.pageSize||50); else if(mode==='all')BF.limit=999999; else {BF.pageSize=parseInt(mode,10)||50;BF.limit=BF.pageSize;}renderBrandsStable();};
  window.asaas35ResetFilters=function(){cancelPendingBrandRender();var ps=(BF&&BF.pageSize)||50;BF={q:'',fit:'',chip:'all',view:(BF&&BF.view)||'table',limit:ps,pageSize:ps,sort:(BF&&BF.sort)||'',dir:(BF&&BF.dir)||1,filters:{}};renderBrandsStable();};
  window.asaas35ResetSort=function(){cancelPendingBrandRender();BF.sort='';BF.dir=1;renderBrandsStable();};
  window.asaas35ResetAll=function(){cancelPendingBrandRender();var ps=(BF&&BF.pageSize)||50;BF={q:'',fit:'',chip:'all',view:(BF&&BF.view)||'table',limit:ps,pageSize:ps,sort:'',dir:1,filters:{}};renderBrandsStable();};
  function sortArrow(k){return BF.sort===k?(BF.dir>0?' <span class="asaas35-sort-arrow">▲</span>':' <span class="asaas35-sort-arrow">▼</span>'):'';}
  function sortHeader(k,label){return '<th title="1-й клик: по возрастанию; 2-й: по убыванию; 3-й: убрать сортировку" onclick="asaas35Sort(\''+h(k)+'\')">'+h(label)+sortArrow(k)+'</th>';}
  window.asaas35SetView=function(v){cancelPendingBrandRender();BF.view=v||'table';renderBrandsStable();};
  window.asaas35OpenBrand=function(id){cancelPendingBrandRender();if(typeof window.openBrand==='function')return window.openBrand(id); return brandEditStable(id);};
  function buildBrandTbody(shown){
    var open="asaas35OpenBrand";
    var rowHtml=shown.map(function(b){var cat=brandCategory(b), sub=brandSub(b), cont=contactText(b)||'-'; return '<tr onclick="'+open+'(\''+h(b.id)+'\')" title="Открыть карточку бренда">'+
      '<td class="sel" onclick="event.stopPropagation()"><input type="checkbox"></td>'+ 
      '<td class="brand-cell"><b>'+h(b.name||'-')+(b.reviewFlag?' <span title="'+h(b.reviewFlag)+'" style="color:#d17b00">⚠</span>':'')+'</b><small>'+h(b.group||'')+'</small></td>'+ 
      '<td class="status"><span title="'+h(statusFull(b.status))+'">'+h(statusShort(b.status))+'</span></td>'+ 
      '<td class="cat" title="'+h(cat)+'">'+h(cat||'-')+'</td>'+ 
      '<td class="sub" title="'+h(sub)+'">'+h(sub||'-')+'</td>'+ 
      '<td class="country" title="'+h(b.country||'')+'">'+h(country2(b.country))+'</td>'+ 
      '<td class="lvl">'+h(b.price||'–')+'</td>'+ 
      '<td class="lvl">'+h(b.tier||'–')+'</td>'+ 
      '<td class="num">'+h(b.amin||'-')+'</td>'+ 
      '<td class="num">'+h(b.amax||'-')+'</td>'+ 
      '<td class="owner" title="'+h(b.owner||'')+'">'+h(b.owner||'-')+'</td>'+ 
      '<td class="contact" title="'+h(cont)+'">'+h(cont)+'</td>'+ 
      '<td class="actions" onclick="event.stopPropagation()"><button class="btn ghost sm" onclick="'+open+'(\''+h(b.id)+'\')">Открыть</button></td>'+ 
      '<td class="notes" title="'+h(b.notes||'')+'">'+h(b.notes||'-')+'</td>'+ 
      '</tr>';}).join('');
    return rowHtml||'<tr><td colspan="14" class="empty">Нет записей по фильтрам</td></tr>';
  }
  function buildBrandContent(shown){
    var open="asaas35OpenBrand";
    function brandLine(b){var cont=contactText(b)||'-'; return '<div class="asaas35-list-row" onclick="'+open+'(\''+h(b.id)+'\')"><div><b>'+h(b.name||'-')+(b.reviewFlag?' <span title="'+h(b.reviewFlag)+'" style="color:#d17b00">⚠</span>':'')+'</b><small>'+h(statusFull(b.status))+' · '+h(b.cat||'-')+' / '+h(b.sub||'-')+' · '+h(country2(b.country))+'</small></div><div class="meta"><span>'+h((b.amin||'-')+'–'+(b.amax||'-'))+' м²</span><span>'+h(cont)+'</span><button class="btn ghost sm" onclick="event.stopPropagation();'+open+'(\''+h(b.id)+'\')">Открыть</button></div></div>';}
    function brandCard(b){var cont=contactText(b)||'-'; return '<div class="asaas35-card" onclick="'+open+'(\''+h(b.id)+'\')"><div class="badge">'+h(statusShort(b.status))+'</div><h3>'+h(b.name||'-')+(b.reviewFlag?' <span title="'+h(b.reviewFlag)+'" style="color:#d17b00">⚠</span>':'')+'</h3><p>'+h(b.cat||'-')+' / '+h(b.sub||'-')+'</p><p>'+h(country2(b.country))+' · '+h((b.amin||'-')+'–'+(b.amax||'-'))+' м²</p><small>'+h(cont)+'</small></div>';}
    if((BF.view||'table')==='list') return '<div class="asaas35-list">'+(shown.map(brandLine).join('')||'<div class="empty">Нет записей по фильтрам</div>')+'</div>';
    if(BF.view==='cards') return '<div class="asaas35-cards">'+(shown.map(brandCard).join('')||'<div class="empty">Нет записей по фильтрам</div>')+'</div>';
    return '<div class="asaas35-table-wrap"><table class="asaas35-table"><thead><tr>'+ 
      '<th class="sel"></th>'+sortHeader('name','Название')+sortHeader('status','Статус')+sortHeader('cat','Категория')+sortHeader('sub','Подкатегория')+sortHeader('country','Страна')+sortHeader('price','Цена, уровень')+sortHeader('tier','Бренд, уровень')+sortHeader('amin','Мин. площадь, м²')+sortHeader('amax','Макс. площадь, м²')+sortHeader('owner','Ответственный')+'<th>Контакт</th><th>Действия</th><th>Комментарии</th></tr>'+ 
      '<tr class="filters"><th></th><th>'+filterInput('bf_name','q','фильтр...','')+'</th><th>'+filterInput('bf_status','status','Все','dl_status')+'</th><th>'+filterInput('bf_cat','cat','Все','dl_cat')+'</th><th>'+filterInput('bf_sub','sub','фильтр...','dl_sub')+'</th><th>'+filterInput('bf_country','country','Все','dl_country')+'</th><th>'+filterInput('bf_price','price','A-D','dl_level')+'</th><th>'+filterInput('bf_tier','tier','A-D','dl_level')+'</th><th>'+filterInput('bf_amin','amin','>=50','')+'</th><th>'+filterInput('bf_amax','amax','<=300','')+'</th><th>'+filterInput('bf_owner','owner','фильтр...','dl_owner')+'</th><th>'+filterInput('bf_contact','contact','фильтр...','dl_contact')+'</th><th></th><th></th></tr></thead><tbody>'+buildBrandTbody(shown)+'</tbody></table></div>';
  }
  function brandRenderState(){
    var all=brands();
    var rows=sortBy(all.filter(passBrand));
    var shown=rows.slice(0,BF.limit||50);
    return {all:all,rows:rows,shown:shown};
  }
  function pagerHtml(st){
    var shown=st.shown, rows=st.rows;
    return '<label>На странице <select onchange="asaas35Page(this.value)"><option '+(BF.pageSize===50?'selected':'')+'>50</option><option '+(BF.pageSize===100?'selected':'')+'>100</option></select></label>'+(shown.length<rows.length?'<button class="btn" onclick="asaas35Page(\'more\')">Показать ещё</button><button class="btn ghost" onclick="asaas35Page(\'all\')">Все</button>':'');
  }
  function updateBrandDatalists(st){
    st=st||brandRenderState();
    var all=st.all||brands();
    var data={
      dl_status:Object.keys(statuses()).map(statusFull),
      dl_cat:cats(),
      dl_sub:allSubs(BF.filters.cat),
      dl_country:uniq(all.map(function(b){return country2(b.country);})).sort(),
      dl_level:['A','B','C','D'],
      dl_owner:uniq(all.map(function(b){return b.owner||'';})).sort(),
      dl_contact:uniq(all.map(contactText)).slice(0,500)
    };
    Object.keys(data).forEach(function(id){var el=$(id); if(el)el.innerHTML=data[id].map(function(x){return '<option value="'+h(x)+'">';}).join('');});
  }
  function syncBrandFilterInputs(active){
    document.querySelectorAll('[data-bf]').forEach(function(el){
      if(el===active)return;
      var k=el.getAttribute('data-bf');
      var v=(k==='q'?BF.q:(k==='fit'?BF.fit:(BF.filters[k]||'')));
      if(el.value!==String(v||''))el.value=String(v||'');
    });
  }
  function renderBrandsResultsOnly(active){
    var root=$('asaas35-results');
    if(!root){renderBrandsStable();return;}
    var f=focusInfo(active||document.activeElement);
    var st=brandRenderState();
    var tb=root.querySelector&&root.querySelector('.asaas35-table tbody');
    if((BF.view||'table')==='table'&&tb){tb.innerHTML=buildBrandTbody(st.shown);} else {root.innerHTML=buildBrandContent(st.shown);}
    var cnt=$('asaas35-count'); if(cnt)cnt.textContent=st.shown.length+' / '+st.rows.length+' / '+st.all.length;
    var pager=$('asaas35-pager'); if(pager)pager.innerHTML=pagerHtml(st);
    updateBrandDatalists(st);
    wireBrandInputs();
    syncBrandFilterInputs(active||document.activeElement);
    lastFocus=null;
    restoreFocusInfo(f,4);
  }
  function renderBrandsStable(){var st=brandRenderState(); var all=st.all, rows=st.rows, shown=st.shown; var subList=allSubs(BF.filters.cat); var catsList=cats(); var statusList=Object.keys(statuses()).map(statusFull); var countries=uniq(all.map(function(b){return country2(b.country);})).sort(); var owners=uniq(all.map(function(b){return b.owner||'';})).sort(); var contacts=uniq(all.map(contactText)).slice(0,500); var chip=function(id,label){return '<button class="asaas35-chip '+(BF.chip===id?'on':'')+'" onclick="asaas35Chip(\''+id+'\')">'+h(label)+'</button>';};
    function viewBtn(id,label){return '<button class="btn ghost sm asaas35-view '+((BF.view||'table')===id?'active':'')+'" onclick="asaas35SetView(\''+id+'\')">'+h(label)+'</button>';}
    var html='<section class="asaas35-head" data-asaas35-brand-shell="1"><div><div class="eye">БАЗА БРЕНДОВ</div><h1>Бренды</h1><p>Excel-таблица с фильтрами, быстрым вводом и стабильным черновиком карточки.</p></div><div class="asaas35-stats"><span>КД</span><b id="asaas35-count">'+shown.length+' / '+rows.length+' / '+all.length+'</b></div></section>'+ 
      '<div class="asaas35-toolbar"><div>'+(canEdit()?'<button class="btn" onclick="brandEdit()">+ Добавить бренд</button> <button class="btn ghost" onclick="if(window.v32RequestForm)v32RequestForm();else go(\'v32_requests\')">+ Запрос от бренда</button> <button class="btn ghost" onclick="asaas35ImportBrands()">⬆ Импорт CSV/XLSX</button> <button class="btn ghost" onclick="asaas3515DownloadTemplate()">Шаблон CSV</button> ':'')+'<button class="btn ghost" onclick="asaas35ExportBrands()">⬇ Экспорт CSV</button> <button class="btn ghost" onclick="asaas35ResetFilters()">Очистить фильтры</button> '+(BF.sort?'<button class="btn ghost asaas35-sort-reset" onclick="asaas35ResetSort()" title="Вернуть исходный порядок базы">↕ Сбросить сортировку</button> ':'')+'<button class="btn ghost" onclick="asaas35ResetAll()">Очистить всё</button></div><div class="asaas35-views">'+viewBtn('table','Таблица')+viewBtn('list','Список')+viewBtn('cards','Карточки')+'</div><div class="pager" id="asaas35-pager">'+pagerHtml(st)+'</div></div>'+ 
      '<div class="asaas35-search"><input id="bf_q" data-bf="q" value="'+h(BF.q||'')+'" placeholder="Поиск: бренд / категория / контакт..." autocomplete="off"><label>Подходит под м² '+filterInput('bf_fit','fit','120','')+'</label></div>'+ 
      '<div class="asaas35-chips">'+chip('all','Все')+chip('mine','Мои')+chip('request','Есть запрос')+chip('noContact','Без контакта')+chip('noArea','Без площади')+chip('noCat','Без категории')+chip('review','Требует проверки')+chip('dups','Дубли')+'</div><div id="asaas35-results">'+buildBrandContent(shown)+'</div>'+
      optList('dl_status',statusList)+optList('dl_cat',catsList)+optList('dl_sub',subList)+optList('dl_country',countries)+optList('dl_level',['A','B','C','D'])+optList('dl_owner',owners)+optList('dl_contact',contacts)+'<div class="foot-note">Фильтры применяются ко всей базе. Для длинных текстов наведите курсор на ячейку.</div>';
    var main=$('main'); if(main) main.innerHTML=html+(typeof window.footNote==='function'?window.footNote():''); wireBrandInputs(); restoreFocus();}
  function wireBrandInputs(){document.querySelectorAll('[data-bf]').forEach(function(el){ if(el.dataset.wired)return; el.dataset.wired='1'; var k=el.getAttribute('data-bf'); el.addEventListener('input',function(){window.asaas35BrandFilter(el,k);}); el.addEventListener('change',function(){window.asaas35BrandFilter(el,k,true);});});}
  window.asaas35ImportBrands=function(){
    cancelPendingBrandRender();
    if(!canEdit())return toast('Нет прав на импорт брендов.');
    try{ if(window.asaas3518ImportPicker&&typeof window.asaas3518ImportPicker==='function') return window.asaas3518ImportPicker(); }catch(e){}
    try{ if(window.importBrandsCSV&&typeof window.importBrandsCSV==='function') return window.importBrandsCSV(); }catch(e){}
    try{ if(typeof importBrandsCSV==='function') return importBrandsCSV(); }catch(e){}
    toast('Импорт CSV/XLSX недоступен. Обновите страницу с очисткой кэша.');
  };
  window.asaas35ExportBrands=function(){
    cancelPendingBrandRender();
    try{ if(window.exportBrandsCSV&&typeof window.exportBrandsCSV==='function') return window.exportBrandsCSV(); }catch(e){}
    try{ if(typeof exportBrandsCSV==='function') return exportBrandsCSV(); }catch(e){}
    toast('Экспорт брендов недоступен.');
  };
  function dl(id,list){return '<datalist id="'+id+'">'+list.map(function(x){return '<option value="'+h(x)+'">';}).join('')+'</datalist>';}
  function usersList(){var u=arr(coreUsers()).map(function(x){return x.name||x.email||x.u||'';}); var a=arr(coreAgents()).map(function(x){return x.name||x.broker||x||'';}); return uniq(u.concat(a)).sort();}
  function draftLoad(){try{return JSON.parse(localStorage.getItem(DRAFT_KEY)||'{}')||{};}catch(e){return {};}}
  function draftSaveFromDrawer(){var dr=$('drawer'); if(!dr||dr.dataset.brandDraft!=='new')return; var d={}; dr.querySelectorAll('input,select,textarea').forEach(function(el){if(el.id)d[el.id]=el.value;}); try{localStorage.setItem(DRAFT_KEY,JSON.stringify(d));}catch(e){} }
  function draftClear(){try{localStorage.removeItem(DRAFT_KEY);}catch(e){}}
  function input(label,id,val,list,type){return '<label><span>'+h(label)+'</span><input id="'+id+'" '+(type?'type="'+type+'"':'')+' '+(list?'list="'+list+'"':'')+' value="'+h(val||'')+'" autocomplete="off"></label>';}
  function select(label,id,val,opts){return '<label><span>'+h(label)+'</span><select id="'+id+'">'+opts.map(function(o){return '<option value="'+h(o[0])+'" '+(String(o[0])===String(val)?'selected':'')+'>'+h(o[1])+'</option>';}).join('')+'</select></label>';}
  function area(label,id,val){return '<label class="wide"><span>'+h(label)+'</span><textarea id="'+id+'">'+h(val||'')+'</textarea></label>';}

  function refreshBrandSubDatalist(){var cat=$('bd_cat'), sub=$('bd_sub'), dl=$('brandSubDL'); if(!cat||!dl)return; var list=allSubs(cat.value); dl.innerHTML=list.map(function(x){return '<option value="'+h(x)+'">';}).join(''); if(sub && sub.value && list.length && list.indexOf(sub.value)<0){sub.title='Эта подкатегория не входит в выбранную категорию, но может быть сохранена вручную.';}}
  function brandCompanyValue(b,d){return d.bd_group!==undefined?d.bd_group:(b.group||b.company||b.holding||b.ownerCompany||b.franchiseOwner||'');}
  function contactListFromBrand(b,d){
    var list=[];
    var hasIndexed=false;
    Object.keys(d||{}).forEach(function(k){if(/^bd_c_\d+_name$/.test(k))hasIndexed=true;});
    if(hasIndexed){
      var max=0; Object.keys(d).forEach(function(k){var m=k.match(/^bd_c_(\d+)_/); if(m)max=Math.max(max,parseInt(m[1],10));});
      for(var i=0;i<=max;i++){
        list.push({name:d['bd_c_'+i+'_name']||'',title:d['bd_c_'+i+'_title']||'',cc:d['bd_c_'+i+'_cc']||ccFromCountry(d.bd_country||b.country),phone:d['bd_c_'+i+'_phone']||'',email:d['bd_c_'+i+'_email']||''});
      }
    } else if(d.bd_contact_name!==undefined||d.bd_contacts_extra!==undefined){
      list.push({name:d.bd_contact_name||'',title:d.bd_contact_title||'',cc:d.bd_contact_cc||ccFromCountry(d.bd_country||b.country),phone:d.bd_contact_phone||'',email:d.bd_contact_email||''});
      String(d.bd_contacts_extra||'').split(/\n+/).forEach(function(line){var p=line.split('|').map(function(x){return x.trim();}); if(p[0]||p[1]||p[2]||p[3])list.push({name:p[0]||'',title:p[1]||'',cc:ccFromCountry(d.bd_country||b.country),phone:p[2]||'',email:p[3]||''});});
    } else {
      var cs=arr(b.contacts);
      if(!cs.length && (b.person||b.phone||b.email))cs=[{name:b.person||'',title:'',phone:b.phone||'',email:b.email||''}];
      cs.forEach(function(c){var cc=ccFromCountry(b.country); list.push({name:c.name||'',title:c.title||'',cc:cc,phone:phoneLocal(c.phone||'',cc),email:c.email||''});});
    }
    if(!list.length)list.push({name:'',title:'',cc:ccFromCountry(d.bd_country||b.country),phone:'',email:''});
    return list;
  }
  function contactRowHtml(c,i){return '<div class="asaas35-contact-row" data-contact-row="'+i+'">'+
    '<div class="grid2">'+input('ФИО','bd_c_'+i+'_name',c.name||'')+input('Должность','bd_c_'+i+'_title',c.title||'')+'</div>'+
    '<div class="grid3">'+input('Код страны','bd_c_'+i+'_cc',c.cc||'+998','ccDL')+input('Номер телефона','bd_c_'+i+'_phone',c.phone||'')+input('Email','bd_c_'+i+'_email',c.email||'')+'</div>'+
    (i>0?'<button type="button" class="btn ghost sm contact-remove" onclick="asaas35RemoveContact(this)">Удалить контакт</button>':'')+'</div>';}
  function contactRowsHtml(list){return '<div id="brandContacts">'+list.map(contactRowHtml).join('')+'</div><button type="button" class="btn ghost" onclick="asaas35AddContact()">+ Добавить контакт</button>';}
  window.asaas35AddContact=function(){var box=$('brandContacts'); if(!box)return; var i=box.querySelectorAll('[data-contact-row]').length; var tmp=document.createElement('div'); tmp.innerHTML=contactRowHtml({name:'',title:'',cc:ccFromCountry(($('bd_country')||{}).value),phone:'',email:''},i); box.appendChild(tmp.firstChild); wireDraftForm(); draftSaveFromDrawer();};
  window.asaas35RemoveContact=function(btn){var row=btn&&btn.closest&&btn.closest('[data-contact-row]'); if(row)row.remove(); draftSaveFromDrawer();};
  function wireDraftForm(){var dr=$('drawer'); if(!dr)return; dr.querySelectorAll('input,select,textarea').forEach(function(el){if(el.dataset.draftWired)return; el.dataset.draftWired='1'; ['input','change'].forEach(function(ev){el.addEventListener(ev,function(){draftSaveFromDrawer();});});});}
  function brandEditStable(id){cancelPendingBrandRender();if(id){var b=brands().find(function(x){return x.id===id;}); if(!b)return; return brandFormStable(b,false);} var d=draftLoad(); var b={id:'',name:d.bd_name||'',cat:d.bd_cat||'',sub:d.bd_sub||'',country:d.bd_country||'',status:d.bd_status||'target',presence:d.bd_presence||'',owner:d.bd_owner||'',lastContact:d.bd_lastc||'',price:d.bd_price||'',tier:d.bd_tier||'',amin:d.bd_amin||'',amax:d.bd_amax||'',areaVariants:d.bd_areaVariants||'',format:d.bd_format||'',fr:d.bd_fr||'',group:d.bd_group||'',reqs:d.bd_reqs||'',coten:d.bd_coten||'',reviewFlag:d.bd_reviewFlag||'',site:d.bd_site||'',ig:d.bd_ig||'',notes:d.bd_notes||'',contacts:[],founded:d.bd_founded||'',icsc:d.bd_icsc||'',netPts:d.bd_netPts||'',netCountries:d.bd_netCountries||'',uzOp:d.bd_uzOp||'',about:d.bd_about||'',pos:d.bd_pos||'',concept:d.bd_concept||'',rec:d.bd_rec||''}; b._draft=d; return brandFormStable(b,true);}
  function brandFormStable(b,isNew){var d=b._draft||{}; var sts=Object.keys(statuses()).map(function(k){return [k,statusFull(k)];}); var presenceOpts=[['','—'],['Есть в Узбекистане','Есть в Узбекистане'],['Нет в Узбекистане','Нет в Узбекистане'],['Выходит на рынок','Выходит на рынок'],['Уточнить','Уточнить']]; var levels=[['','—'],['A','A'],['B','B'],['C','C'],['D','D']]; var catList=cats(); var currentCat=(d.bd_cat!==undefined?d.bd_cat:catNorm(b.cat)); var currentSub=(d.bd_sub!==undefined?d.bd_sub:subNorm(b.sub,b.cat)); var subList=allSubs(currentCat); var contacts=contactListFromBrand(b,d); var html='<div class="dh"><span class="x" onclick="closeDrawer()">×</span><h2>'+(isNew?'Новый бренд — черновик':'Редактирование бренда')+'</h2><div class="s">Поля сохраняются локально. В базу попадает только после “Сохранить”.</div></div><div class="dbody asaas35-brand-form" data-brand-draft="'+(isNew?'new':'edit')+'">'+
      (isNew?'<div class="draft-note"><b>Черновик</b> Заполните карточку и нажмите “Сохранить бренд”.</div>':'')+
      input('Название бренда','bd_name',d.bd_name!==undefined?d.bd_name:b.name)+
      input('Компания / группа / владелец бренда или франшизы','bd_group',brandCompanyValue(b,d))+
      '<div class="grid2">'+input('Категория','bd_cat',currentCat,'brandCatDL')+input('Подкатегория','bd_sub',currentSub,'brandSubDL')+'</div>'+ 
      '<div class="grid2">'+input('Страна','bd_country',d.bd_country!==undefined?d.bd_country:b.country,'countryDL')+select('Статус','bd_status',d.bd_status!==undefined?d.bd_status:b.status,sts)+'</div>'+
      '<div class="grid2">'+select('Присутствие в Узбекистане','bd_presence',d.bd_presence!==undefined?d.bd_presence:(b.presence||''),presenceOpts)+input('Ответственный','bd_owner',d.bd_owner!==undefined?d.bd_owner:b.owner,'ownerDL')+'</div>'+ 
      '<div class="grid2">'+input('Последний контакт','bd_lastc',d.bd_lastc!==undefined?d.bd_lastc:b.lastContact,null,'date')+input('Формат','bd_format',d.bd_format!==undefined?d.bd_format:b.format)+'</div>'+ 
      '<div class="grid2">'+select('Ценовой уровень','bd_price',d.bd_price!==undefined?d.bd_price:b.price,levels)+select('Уровень бренда','bd_tier',d.bd_tier!==undefined?d.bd_tier:b.tier,levels)+'</div>'+ 
      '<div class="grid2">'+input('Площадь min, м²','bd_amin',d.bd_amin!==undefined?d.bd_amin:b.amin)+input('Площадь max, м²','bd_amax',d.bd_amax!==undefined?d.bd_amax:b.amax)+'</div>'+
      area('Варианты площади / исходное значение','bd_areaVariants',d.bd_areaVariants!==undefined?d.bd_areaVariants:(b.areaVariants||''))+input('Франшиза / модель','bd_fr',d.bd_fr!==undefined?d.bd_fr:b.fr)+area('Требования к помещению','bd_reqs',d.bd_reqs!==undefined?d.bd_reqs:b.reqs)+input('Co-tenancy','bd_coten',d.bd_coten!==undefined?d.bd_coten:b.coten)+area('Проверка данных','bd_reviewFlag',d.bd_reviewFlag!==undefined?d.bd_reviewFlag:(b.reviewFlag||''))+
      '<h3 class="form-section">Профиль бренда</h3>'+
      '<div class="grid2">'+input('Год основания','bd_founded',d.bd_founded!==undefined?d.bd_founded:b.founded)+input('Формат ICSC','bd_icsc',d.bd_icsc!==undefined?d.bd_icsc:b.icsc)+'</div>'+
      '<div class="grid2">'+input('Сеть: точек','bd_netPts',d.bd_netPts!==undefined?d.bd_netPts:b.netPts)+input('Сеть: стран','bd_netCountries',d.bd_netCountries!==undefined?d.bd_netCountries:b.netCountries)+'</div>'+
      input('Оператор в Узбекистане','bd_uzOp',d.bd_uzOp!==undefined?d.bd_uzOp:b.uzOp)+area('О бренде','bd_about',d.bd_about!==undefined?d.bd_about:b.about)+area('Позиционирование','bd_pos',d.bd_pos!==undefined?d.bd_pos:b.pos)+area('Концепция и ассортимент','bd_concept',d.bd_concept!==undefined?d.bd_concept:b.concept)+area('Рекомендация CASE','bd_rec',d.bd_rec!==undefined?d.bd_rec:b.rec)+
      '<h3 class="form-section">Контакты</h3>'+contactRowsHtml(contacts)+
      '<div class="grid2">'+input('Сайт','bd_site',d.bd_site!==undefined?d.bd_site:b.site)+input('Instagram','bd_ig',d.bd_ig!==undefined?d.bd_ig:b.ig)+'</div>'+area('О бренде / комментарии','bd_notes',d.bd_notes!==undefined?d.bd_notes:b.notes)+
      '<div class="form-actions"><button class="btn" onclick="asaas35SaveBrand(\''+(b.id||'')+'\')">Сохранить бренд</button><button class="btn ghost" onclick="closeDrawer()">Закрыть</button>'+(isNew?'<button class="btn ghost danger" onclick="localStorage.removeItem(\''+DRAFT_KEY+'\');closeDrawer();toast(\'Черновик очищен\')">Очистить черновик</button>':'<button class="btn ghost danger" onclick="asaas35DeleteBrand(\''+h(b.id)+'\')">🗑 Удалить бренд</button>')+'</div>'+optList('brandCatDL',catList)+optList('brandSubDL',subList)+optList('ownerDL',usersList())+optList('countryDL',['Узбекистан','Таджикистан','Казахстан','Турция','Россия','США','Китай','ОАЭ'])+optList('ccDL',['+998','+992','+7','+90','+1','+86','+971','+34'])+'</div>'; if(typeof window.openDrawer==='function')window.openDrawer(html); else {var dr=$('drawer'); if(dr){dr.innerHTML=html;dr.classList.add('open');}} refreshBrandSubDatalist(); var bc=$('bd_cat'); if(bc){['input','change'].forEach(function(ev){bc.addEventListener(ev,refreshBrandSubDatalist);});} wireDraftForm();}
  window.asaas35DeleteBrand=function(id){
    var b=brands().find(function(x){return x.id===id;});
    if(!b)return;
    if(!canEdit()){alert('Недостаточно прав.');return;}
    try{if(typeof deleteBrand==='function')return deleteBrand(id);}catch(e){}
    try{if(window.deleteBrand&&typeof window.deleteBrand==='function')return window.deleteBrand(id);}catch(e){}
    if(!confirm('Удалить бренд «'+(b.name||'')+'»? Бренд будет перемещён в корзину.'))return;
    var list=brands(), i=list.indexOf(b);
    if(i>=0)list.splice(i,1);
    try{if(typeof trashPut==='function')trashPut('brand',b.name||'-',b);}catch(e){}
    try{if(typeof audit==='function')audit('Удалён бренд',b.name||'-');}catch(e){}
    persistSafe();
    if(typeof window.closeDrawer==='function')window.closeDrawer();
    if(coreS().view==='brands')renderBrandsStable();
    toast('Бренд удалён');
  };

  window.asaas35SaveBrand=function(id){var g=function(i){var e=$(i);return e?e.value:'';}; var name=g('bd_name').trim(); if(!name){var n=$('bd_name'); if(n){n.focus();n.style.borderColor='var(--red)';} toast('Введите название бренда'); return;} var b=id?brands().find(function(x){return x.id===id;}):null; if(!b){try{b=typeof window.brand==='function'?window.brand({}):{id:'b'+Date.now()};}catch(e){b={id:'b'+Date.now()};} brands().unshift(b);} Object.assign(b,{name:name,group:g('bd_group'),cat:g('bd_cat'),sub:g('bd_sub'),country:g('bd_country'),status:g('bd_status')||'target',presence:g('bd_presence'),owner:g('bd_owner'),lastContact:g('bd_lastc'),price:g('bd_price'),tier:g('bd_tier'),amin:num(g('bd_amin')),amax:num(g('bd_amax')),areaVariants:g('bd_areaVariants'),format:g('bd_format'),fr:g('bd_fr'),reqs:g('bd_reqs'),coten:g('bd_coten'),reviewFlag:g('bd_reviewFlag'),site:g('bd_site'),ig:g('bd_ig'),founded:g('bd_founded'),icsc:g('bd_icsc'),netPts:g('bd_netPts'),netCountries:g('bd_netCountries'),uzOp:g('bd_uzOp'),about:g('bd_about'),pos:g('bd_pos'),concept:g('bd_concept'),rec:g('bd_rec'),notes:g('bd_notes'),editedBy:(coreS().user&&coreS().user.name)||'ASAAS',editedAt:(typeof window.nowMin==='function'?window.nowMin():new Date().toISOString().slice(0,16).replace('T',' '))}); var contacts=[]; var rows=document.querySelectorAll('#brandContacts [data-contact-row]'); rows.forEach(function(row){var idx=row.getAttribute('data-contact-row'); var cc=g('bd_c_'+idx+'_cc')||ccFromCountry(g('bd_country')); var phone=normPhoneWithCC(g('bd_c_'+idx+'_phone'),cc); var c={name:g('bd_c_'+idx+'_name').trim(),title:g('bd_c_'+idx+'_title').trim(),phone:phone,email:g('bd_c_'+idx+'_email').trim()}; if(c.name||c.title||c.phone||c.email)contacts.push(c);}); b.contacts=contacts; var c0=b.contacts[0]||{}; b.person=c0.name||''; b.phone=c0.phone||''; b.email=c0.email||''; b.hist=b.hist||[]; b.hist.push([(new Date()).toISOString().slice(0,10),b.editedBy,id?'Правка карточки':'Создан бренд']); draftClear(); persistSafe(); if(typeof window.closeDrawer==='function')window.closeDrawer(); if(coreS().view==='brands')renderBrandsStable(); toast('Бренд сохранён');};

  function patchCloseDrawer(){var old=window.closeDrawer; window.closeDrawer=function(){try{draftSaveFromDrawer();}catch(e){} if(old)return old.apply(this,arguments); var dr=$('drawer'),bg=$('dbg'); if(dr)dr.classList.remove('open'); if(bg)bg.classList.remove('open');};}
  function patchNav(){window.buildNav=function(){var nav=$('nav'); if(!nav)return; var r=roleInfo(); var ext=r&&r.external, brandsOnly=r&&r.brandsOnly; var groups=[]; function addGroup(label,items){if(brandsOnly){items=items.filter(function(x){return x[0]==='brands';}); if(!items.length)return;} groups.push([label,items]);}
    addGroup('Главное',[['dash','▦','Главный экран'],['map','⌖','Карта / GIS']]);
    addGroup('Портфель',[['registry','▤','Реестр'],['plans','▭','Планировки'],['brands','✦','Бренды'],['docs','▣','Документы']]);
    addGroup('Сделки',[['v32_action','◎','Центр действий'],['v32_requests','✉','Запросы брендов'],['v32_investors','◈','Инвесторы'],['v32_sales','◆','Продажи объектов'],['v326_lease','%','Комиссии аренды'],['v326_suppliers','✦','Поставщики']]);
    addGroup('Команда',[['kpi','★','KPI'],['study','✎','Обучение'],['rating','♛','Рейтинг'],['org','☖','Оргструктура'],['users','◍','Пользователи']]);
    var out=''; groups.forEach(function(g){var items=g[1].filter(function(x){if(x[0]==='users'&&!r.admin)return false; if(ext&&(x[0]==='map'))return false; return true;}); if(!items.length)return; out+='<div class="sep">'+h(g[0])+'</div>'; out+=items.map(function(x){return '<a data-v="'+x[0]+'" class="'+((coreS().view===x[0])?'active':'')+'" onclick="go(\''+x[0]+'\')"><span class="ic">'+x[1]+'</span> '+h(x[2])+'</a>';}).join('');}); nav.innerHTML=out;};}
  function patchLogoLogin(){document.addEventListener('click',function(e){var lg=e.target&&e.target.closest&&e.target.closest('.topbar .brand,.logo[data-home],.lg[data-home]'); if(lg&&typeof window.go==='function'){e.preventDefault();go('dash');}},true); document.addEventListener('keydown',function(e){if(e.key!=='Enter')return; var ae=document.activeElement; if(ae&&['lemail','lpass','lcode'].indexOf(ae.id)>=0){e.preventDefault();var b=$('l_go'); if(b)b.click();}},true);}
  function patchMapGIS(){var old=window.renderMap; if(typeof old==='function'&&!old._asaas35){window.renderMap=function(){var r=old.apply(this,arguments); setTimeout(injectGIS,30); return r;}; window.renderMap._asaas35=true;}}
  function injectGIS(){var main=$('main'); if(!main||main.querySelector('.asaas35-gis'))return; var card=document.createElement('div');card.className='asaas35-gis';card.innerHTML='<div><div class="eye">LOCATION INTELLIGENCE</div><h3>GIS, охват и market data</h3><p>Переключайте Yandex / 2GIS / Google / OSM, радиусы 1/3/5 км, drive-time 5/10/15 минут, POI и макро-снимок. Для production добавьте API-ключи в config.php.</p></div><div class="gis-grid"><span>Yandex</span><span>2GIS</span><span>Google</span><span>OSM</span><span>1 / 3 / 5 км</span><span>5 / 10 / 15 мин</span><span>POI</span><span>Heat map</span><span>Market data</span></div>'; main.insertBefore(card, main.firstChild&&main.firstChild.nextSibling);}
  function injectCSS(){if($('asaas35-css'))return; var st=document.createElement('style');st.id='asaas35-css';st.textContent='\n.asaas35-head,.asaas35-toolbar,.asaas35-search,.asaas35-chips,.asaas35-table-wrap,.asaas35-gis{background:var(--panel);border:1px solid var(--border);border-radius:16px;box-shadow:var(--shadow);padding:14px;margin:12px 0}.asaas35-head{display:flex;justify-content:space-between;gap:14px;align-items:flex-start}.asaas35-head h1{margin:0}.asaas35-head p{margin:4px 0 0;color:var(--muted)}.asaas35-head .eye,.asaas35-gis .eye{font-size:10px;color:var(--red-d);font-weight:900;letter-spacing:.09em;text-transform:uppercase}.asaas35-stats{display:flex;gap:8px;align-items:center}.asaas35-stats span,.asaas35-stats b{border:1px solid var(--border);border-radius:999px;padding:6px 10px;background:var(--soft)}.asaas35-toolbar{display:flex;justify-content:space-between;gap:10px;align-items:center;flex-wrap:wrap}.asaas35-toolbar .pager{display:flex;gap:8px;align-items:center;flex-wrap:wrap}.asaas35-search{display:grid;grid-template-columns:minmax(260px,1fr) 220px;gap:10px;align-items:center}.asaas35-search input,.asaas35-table input,.asaas35-table select,.asaas35-brand-form input,.asaas35-brand-form select,.asaas35-brand-form textarea{width:100%;border:1px solid var(--border);border-radius:10px;background:var(--panel);color:var(--ink);padding:8px 9px;font-family:inherit;font-size:12px}.asaas35-chips{display:flex;gap:7px;flex-wrap:wrap}.asaas35-chip{border:1px solid var(--border);background:var(--panel);border-radius:999px;padding:7px 12px;font-weight:800}.asaas35-chip.on{background:#181818;color:#fff}.asaas35-table-wrap{padding:0;overflow-x:auto;overflow-y:hidden}.asaas35-table{width:auto;min-width:100%;border-collapse:separate;border-spacing:0;table-layout:fixed;font-size:11.5px}.asaas35-table th,.asaas35-table td{border-bottom:1px solid var(--border);padding:7px 6px;vertical-align:middle;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.asaas35-table th{font-size:9.5px;color:var(--muted);text-transform:uppercase;letter-spacing:.04em;background:var(--soft);cursor:pointer}.asaas35-sort-arrow{color:var(--red-d);font-size:9px;margin-left:2px}.asaas35-sort-reset{border-color:rgba(158,0,0,.34)!important;color:var(--red-d)!important}.asaas35-table tr:hover td{background:rgba(158,0,0,.04)}.asaas35-table .sel{width:32px}.asaas35-table .brand-cell{display:table-cell!important;width:18%;font-size:11.5px!important;font-weight:700!important;gap:0!important;align-items:normal!important;white-space:nowrap!important;overflow:hidden!important;text-overflow:ellipsis!important}.asaas35-table .brand-cell b{display:block;max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.asaas35-table .brand-cell small{display:block;color:var(--muted);font-size:9px;max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.asaas35-table .status{width:62px}.asaas35-table .cat{width:11%}.asaas35-table .sub{width:13%}.asaas35-table .country{width:72px;text-align:center}.asaas35-table .lvl{width:112px;text-align:center}.asaas35-table .num{width:130px;text-align:right}.asaas35-table .owner{width:8%}.asaas35-table .contact{width:11%}.asaas35-table .actions{width:80px}.asaas35-table .notes{width:12%}.asaas35-table .empty{text-align:center;color:var(--muted);padding:24px}.foot-note{font-size:11px;color:var(--muted);margin:8px 0}.asaas35-brand-form label{display:block;margin:9px 0}.asaas35-brand-form label span{display:block;color:var(--muted);font-size:11px;font-weight:800;margin-bottom:4px}.asaas35-brand-form .grid2{display:grid;grid-template-columns:1fr 1fr;gap:10px}.asaas35-brand-form .grid3{display:grid;grid-template-columns:90px 1fr 1fr;gap:10px}.asaas35-contact-row{border:1px solid var(--border);border-radius:14px;padding:10px;margin:8px 0;background:var(--soft)}.asaas35-contact-row .contact-remove{margin-top:6px}.asaas35-brand-form .wide{grid-column:1/-1}.asaas35-brand-form textarea{min-height:74px;resize:vertical}.draft-note{border:1px solid #7b5d00;background:#2d260f;color:#ffe8a3;border-radius:12px;padding:10px;margin:8px 0;font-size:12px}.form-actions{display:flex;gap:8px;flex-wrap:wrap;margin-top:14px}.form-actions .danger{margin-left:auto;border-color:#c87;color:#c66}.asaas35-gis h3{margin:2px 0}.asaas35-gis p{color:var(--muted);margin:4px 0 10px}.gis-grid{display:flex;gap:8px;flex-wrap:wrap}.gis-grid span{border:1px solid var(--border);background:var(--soft);border-radius:999px;padding:6px 10px;font-size:11px;font-weight:800}.asaas35-table .sel{display:table-cell!important;background:transparent!important}.asaas35-table td{background:transparent}.asaas35-table tr:nth-child(even) td{background:rgba(0,0,0,.015)}body.dark .asaas35-table tr:nth-child(even) td{background:rgba(255,255,255,.02)}body.dark .asaas35-chip.on{background:#f2f2f2;color:#111}body.dark .asaas35-table th{background:#24221d}body.dark .asaas35-table tr:hover td{background:rgba(255,255,255,.04)}.asaas35-views{display:flex;gap:6px;flex-wrap:wrap}.asaas35-view.active{background:#181818!important;color:#fff!important}.asaas35-list{display:flex;flex-direction:column;gap:8px}.asaas35-list-row{background:var(--panel);border:1px solid var(--border);border-radius:14px;padding:12px;display:grid;grid-template-columns:minmax(220px,1fr) auto;gap:12px;align-items:center;box-shadow:var(--shadow);cursor:pointer}.asaas35-list-row b{display:block}.asaas35-list-row small{display:block;color:var(--muted);margin-top:3px}.asaas35-list-row .meta{display:flex;gap:8px;align-items:center;flex-wrap:wrap;color:var(--muted);font-size:12px}.asaas35-cards{display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:12px}.asaas35-card{position:relative;background:var(--panel);border:1px solid var(--border);border-radius:16px;padding:14px;box-shadow:var(--shadow);cursor:pointer;min-height:130px}.asaas35-card h3{margin:0 0 8px}.asaas35-card p{margin:4px 0;color:var(--muted);font-size:12px}.asaas35-card small{display:block;color:var(--muted);margin-top:8px}.asaas35-card .badge{position:absolute;right:10px;top:10px;border:1px solid var(--border);border-radius:999px;padding:3px 7px;font-size:10px;background:var(--soft);font-weight:900}.form-section{grid-column:1/-1;margin:14px 0 0;font-size:14px}.asaas35-brand-form .grid2+input{margin-top:0}body.dark .asaas35-view.active{background:#f2f2f2!important;color:#111!important}@media(max-width:1000px){.asaas35-search{grid-template-columns:1fr}.asaas35-table{font-size:10.5px}.asaas35-table .contact,.asaas35-table .owner,.asaas35-table .notes{display:none}.asaas35-brand-form .grid2{grid-template-columns:1fr}}';document.head.appendChild(st);}
  function cleanupText(){try{document.querySelectorAll('button,.chip,.asaas-chip').forEach(function(el){if(/^\s*hot\s*$/i.test(el.textContent||''))el.remove();});}catch(e){}}
  function wrapRenderer(name){
    var fn=window[name]; if(typeof fn!=='function'||fn._asaas359)return;
    var w=function(){var f=focusInfo(); var r=fn.apply(this,arguments); setTimeout(function(){restoreFocusInfo(f,6);},0); return r;};
    w._asaas359=true; window[name]=w;
  }
  function patchFocusLoss(){
    if(window._asaas359FocusPatch)return; window._asaas359FocusPatch=true;
    ['renderRegistry','renderPlans','renderStudy','pickerView','renderDocs','renderBench','renderUsers','renderKPI','renderDash'].forEach(wrapRenderer);
    var oldTblF=window.tblF;
    if(typeof oldTblF==='function'){
      var timers={};
      window.tblF=function(key,k,v){
        try{S.tbl=S.tbl||{};var st=S.tbl[key]=S.tbl[key]||{filters:{},sort:null};st.filters[k]=v;S._focus='flt_'+key+'_'+k;}catch(e){}
        var f=focusInfo(); clearTimeout(timers[key+'_'+k]);
        timers[key+'_'+k]=setTimeout(function(){try{go(S.view);}catch(e){try{oldTblF(key,k,v);}catch(_){}} setTimeout(function(){restoreFocusInfo(f,6);},0);},220);
      };
    }
    document.addEventListener('input',function(e){
      var el=e.target; if(!el||!(/^(INPUT|TEXTAREA)$/i.test(el.tagName||'')))return;
      if(el.id==='gq')return;
      if(el.closest&&el.closest('#drawer'))return;
      if(el.getAttribute('data-bf'))return;
      window._asaas359LastInputFocus=focusInfo(el);
      setTimeout(function(){restoreFocusInfo(window._asaas359LastInputFocus,2);},0);
    },true);
  }
  function install(){injectCSS(); patchNav(); patchCloseDrawer(); patchLogoLogin(); patchMapGIS(); patchFocusLoss(); window.renderBrands=renderBrandsStable; window.brandEdit=brandEditStable; try{if(typeof buildNav==='function')buildNav();}catch(e){} cleanupText(); if(coreS().view==='brands')setTimeout(renderBrandsStable,0); setInterval(cleanupText,3000); window.addEventListener('pagehide',draftSaveFromDrawer); document.addEventListener('visibilitychange',function(){if(document.hidden)draftSaveFromDrawer();});}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true}); else install();
})();
