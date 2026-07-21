(function(){
  'use strict';
  var V='3.5.15';
  function brands(){try{return typeof BRANDS!=='undefined'?BRANDS:(window.BRANDS||[]);}catch(e){return window.BRANDS||[];}}
  function state(){try{return typeof S!=='undefined'?S:(window.S||{});}catch(e){return window.S||{};}}
  function persistSafe(){try{if(window.persist&&typeof window.persist==='function')window.persist();else if(typeof persist==='function')persist();}catch(e){}}
  function renderSafe(){try{if(window.renderBrands&&typeof window.renderBrands==='function')window.renderBrands();else if(typeof renderBrands==='function')renderBrands();}catch(e){}}
  function escCsv(v){v=v==null?'':String(v);return /[;"\r\n]/.test(v)?'"'+v.replace(/"/g,'""')+'"':v;}
  function downloadText(name,text,type){var b=new Blob([text],{type:type||'text/plain;charset=utf-8'}),a=document.createElement('a');a.href=URL.createObjectURL(b);a.download=name;document.body.appendChild(a);a.click();setTimeout(function(){URL.revokeObjectURL(a.href);a.remove();},500);}
  function parseCSV(text){text=String(text||'').replace(/^\uFEFF/,'').replace(/\r\n/g,'\n').replace(/\r/g,'\n');var first=text.split('\n')[0]||'';var delim=(first.split(';').length>=first.split(',').length)?';':',';var rows=[],row=[],cur='',q=false;for(var i=0;i<text.length;i++){var c=text[i];if(q){if(c==='"'){if(text[i+1]==='"'){cur+='"';i++;}else q=false;}else cur+=c;}else{if(c==='"')q=true;else if(c===delim){row.push(cur);cur='';}else if(c==='\n'){row.push(cur);rows.push(row);row=[];cur='';}else cur+=c;}}if(cur!==''||row.length){row.push(cur);rows.push(row);}return rows.filter(function(r){return r.some(function(x){return String(x||'').trim()!=='';});});}
  function hn(s){return String(s||'').trim().toLowerCase().replace(/ё/g,'е').replace(/[–—]/g,'-').replace(/\s+/g,' ');}
  function normName(s){return String(s||'').toLowerCase().replace(/[^a-zа-яё0-9]+/gi,'');}
  function value(row,ix,k){var i=ix[k];return i>=0?String(row[i]==null?'':row[i]).trim():'';}
  function num(v){var n=parseFloat(String(v||'').replace(/\s/g,'').replace(',','.').replace(/[^0-9.\-]/g,''));return isNaN(n)?0:n;}
  function statusCode(raw){raw=String(raw||'').toLowerCase();if(/был контакт|contacted/.test(raw))return 'contacted';if(/неактив|inactive/.test(raw))return 'inactive';if(/отказ|refus/.test(raw))return 'refused';if(/актив|active/.test(raw))return 'active';return 'target';}
  function presenceCode(raw){raw=String(raw||'').trim();var k=raw.toLowerCase();if(!k)return '';if(k==='есть'||k==='да'||/present|active in uz/.test(k))return 'Есть в Узбекистане';if(k==='нет'||k==='не представлен'||/not present/.test(k))return 'Нет в Узбекистане';if(/выходит|launch|entering/.test(k))return 'Выходит на рынок';if(/уточнить|unknown|check/.test(k))return 'Уточнить';return raw;}
  function parseContacts(text){var out=[];String(text||'').split(/\n+/).forEach(function(line){line=line.trim();if(!line)return;var p=line.split('|').map(function(x){return x.trim();});var c={name:p[0]||'',title:p[1]||'',phone:p[2]||'',email:p.slice(3).join(' | ')||''};if(c.name||c.title||c.phone||c.email)out.push(c);});return out;}
  function mergeContacts(a,b){var seen={},out=[];[].concat(a||[],b||[]).forEach(function(c){if(!c)return;var k=[c.name,c.phone,c.email].join('|').toLowerCase();if(!k.replace(/\|/g,'')||seen[k])return;seen[k]=1;out.push({name:c.name||'',title:c.title||'',phone:c.phone||'',email:c.email||''});});return out;}
  function createBrand(){try{if(typeof brand==='function')return brand({});}catch(e){}return {id:'b'+Date.now()+Math.random().toString(36).slice(2),contacts:[],hist:[]};}
  var HEADERS=['Название бренда','Статус','Присутствие в Узбекистане','Ответственный','Категория','Подкатегория','Ценовой уровень (A–D)','Уровень (A–D)','Страна происхождения','Формат','Площадь min','Площадь max','Варианты площади / исходное значение','Группа / холдинг','Контакты','Контактное лицо','Должность','Телефон','Email','Сайт','Instagram','Последний контакт','Франшиза / модель','Требования к помещению','Co-tenancy','Год основания','Формат ICSC','Сеть: точек','Сеть: стран','Оператор в Узбекистане','О бренде','Позиционирование','Концепция и ассортимент','Рекомендация CASE','Примечания','Проверка данных'];
  function mapHeaders(head){var m={};head.forEach(function(h,i){m[hn(h)]=i;});function f(){for(var i=0;i<arguments.length;i++){var k=hn(arguments[i]);if(Object.prototype.hasOwnProperty.call(m,k))return m[k];}return -1;}return {
    name:f('Название бренда','name','brand','бренд','название'),status:f('Статус','status'),presence:f('Присутствие в Узбекистане','presence','market presence'),owner:f('Ответственный','owner'),cat:f('Категория','category','cat'),sub:f('Подкатегория','subcategory','sub'),price:f('Ценовой уровень (A-D)','Ценовой уровень (A–D)','price'),tier:f('Уровень (A-D)','Уровень (A–D)','tier'),country:f('Страна происхождения','страна','country'),format:f('Формат','format'),amin:f('Площадь min','amin','min'),amax:f('Площадь max','amax','max'),areaVariants:f('Варианты площади / исходное значение','Варианты площади','Типовая площадь (м²)','Типовая площадь'),group:f('Группа / холдинг','группа','holding'),contacts:f('Контакты','contacts'),person:f('Контактное лицо','контакт','person'),title:f('Должность','title'),phone:f('Телефон','phone'),email:f('Email','почта'),site:f('Сайт','site'),ig:f('Instagram','ig'),lastc:f('Последний контакт','last contact'),fr:f('Франшиза / модель','франшиза','model'),reqs:f('Требования к помещению','требования','requirements'),coten:f('Co-tenancy','cotenancy'),founded:f('Год основания','founded'),icsc:f('Формат ICSC','icsc'),netPts:f('Сеть: точек','Сеть точек','network points'),netCountries:f('Сеть: стран','Сеть стран','network countries'),uzOp:f('Оператор в Узбекистане','оператор','uz operator'),about:f('О бренде','about'),pos:f('Позиционирование','positioning'),concept:f('Концепция и ассортимент','concept'),rec:f('Рекомендация CASE','recommendation'),notes:f('Примечания','notes','заметки'),review:f('Проверка данных','⚠ Проверка','review')};}
  function applyImported(b,row,ix,isUpdate){
    function g(k){return value(row,ix,k);}var importedContacts=parseContacts(g('contacts'));if(!importedContacts.length&&(g('person')||g('title')||g('phone')||g('email')))importedContacts=[{name:g('person'),title:g('title'),phone:g('phone'),email:g('email')}];
    var data={name:g('name'),status:statusCode(g('status')),presence:presenceCode(g('presence')),owner:g('owner'),cat:g('cat'),sub:g('sub'),price:g('price').toUpperCase().replace('С','C').slice(0,1),tier:g('tier').toUpperCase().replace('С','C').slice(0,1),country:g('country'),format:g('format'),amin:num(g('amin')),amax:num(g('amax')),areaVariants:g('areaVariants'),group:g('group'),site:g('site'),ig:g('ig'),lastContact:g('lastc'),fr:g('fr'),reqs:g('reqs'),coten:g('coten'),founded:g('founded'),icsc:g('icsc'),netPts:g('netPts'),netCountries:g('netCountries'),uzOp:g('uzOp'),about:g('about'),pos:g('pos'),concept:g('concept'),rec:g('rec'),notes:g('notes'),reviewFlag:g('review')};
    Object.keys(data).forEach(function(k){var v=data[k];if(k==='name'){if(v)b.name=v;return;}if(v!==''&&v!==0)b[k]=v;else if(!isUpdate&&b[k]==null)b[k]=v;});
    b.contacts=mergeContacts(isUpdate?b.contacts:[],importedContacts);var c0=b.contacts[0]||{};b.person=c0.name||'';b.phone=c0.phone||'';b.email=c0.email||'';
    b.editedBy=(state().user&&state().user.name)||'Импорт CSV';b.editedAt=(new Date()).toISOString().slice(0,16).replace('T',' ');b.hist=b.hist||[];b.hist.push([(new Date()).toISOString().slice(0,10),b.editedBy,isUpdate?'Обновлён из CSV':'Импорт из CSV']);
  }
  window.asaas3515ImportText=function(text,opts){
    opts=opts||{};
    try{
      var rows=parseCSV(text);
      if(rows.length<2)throw new Error('CSV пустой или без строк данных.');
      var ix=mapHeaders(rows[0]);
      if(ix.name<0)throw new Error('Не найдена колонка «Название бренда».');
      var by={};brands().forEach(function(b){if(b&&b.name)by[normName(b.name)]=b;});
      var added=0,updated=0,skipped=0;
      for(var i=1;i<rows.length;i++){
        var nm=value(rows[i],ix,'name');if(!nm){skipped++;continue;}
        var key=normName(nm),b=by[key];
        if(b){applyImported(b,rows[i],ix,true);updated++;}
        else{b=createBrand();applyImported(b,rows[i],ix,false);brands().push(b);by[key]=b;added++;}
      }
      persistSafe();renderSafe();
      var result={added:added,updated:updated,skipped:skipped,total:added+updated};
      if(!opts.silent)alert('Импорт завершён. Добавлено: '+added+'. Обновлено существующих: '+updated+'. Пропущено без названия: '+skipped+'.');
      return result;
    }catch(ex){
      if(!opts.silent)alert('Ошибка чтения CSV: '+(ex&&ex.message||ex));
      if(opts.throwError)throw ex;
      return {added:0,updated:0,skipped:0,total:0,error:String(ex&&ex.message||ex)};
    }
  };
  window.importBrandsCSV=function(){
    var inp=document.createElement('input');
    inp.type='file';inp.accept='.csv,text/csv';inp.style.display='none';document.body.appendChild(inp);
    inp.onchange=function(e){
      var f=e.target.files&&e.target.files[0];if(!f){inp.remove();return;}
      var r=new FileReader();
      r.onload=function(){window.asaas3515ImportText(r.result);inp.remove();};
      r.onerror=function(){alert('Ошибка чтения файла CSV.');inp.remove();};
      r.readAsText(f,'utf-8');
    };
    inp.click();
  };
  function contactsText(b){var cs=(b.contacts&&b.contacts.length)?b.contacts:[{name:b.person||'',title:'',phone:b.phone||'',email:b.email||''}];return cs.filter(function(c){return c.name||c.title||c.phone||c.email;}).map(function(c){return [c.name||'',c.title||'',c.phone||'',c.email||''].join(' | ');}).join('\n');}
  window.exportBrandsCSV=function(){var rows=brands().map(function(b){var c0=(b.contacts&&b.contacts[0])||{name:b.person||'',title:'',phone:b.phone||'',email:b.email||''};return [b.name||'',({active:'Активный',contacted:'Был контакт',target:'Потенциальный',inactive:'Неактивный',refused:'Отказ'}[b.status]||b.status||''),b.presence||'',b.owner||'',b.cat||'',b.sub||'',b.price||'',b.tier||'',b.country||'',b.format||'',b.amin||'',b.amax||'',b.areaVariants||'',b.group||'',contactsText(b),c0.name||'',c0.title||'',c0.phone||'',c0.email||'',b.site||'',b.ig||'',b.lastContact||'',b.fr||'',b.reqs||'',b.coten||'',b.founded||'',b.icsc||'',b.netPts||'',b.netCountries||'',b.uzOp||'',b.about||'',b.pos||'',b.concept||'',b.rec||'',b.notes||'',b.reviewFlag||''];});var text='\uFEFF'+[HEADERS].concat(rows).map(function(r){return r.map(escCsv).join(';');}).join('\r\n');downloadText('CASE_OS_brands_full_'+new Date().toISOString().slice(0,10)+'.csv',text,'text/csv;charset=utf-8');};
  window.asaas3515DownloadTemplate=function(){var text='\uFEFF'+HEADERS.map(escCsv).join(';')+'\r\n';downloadText('CASE_OS_brands_import_template.csv',text,'text/csv;charset=utf-8');};
  function install(){/* версия — единый источник (index.html) */}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});else install();
})();
