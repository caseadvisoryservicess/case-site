/* CASE OS v4.17.0 — tiered commissions panel.
   Rides on the existing "KPI и комиссии" (kpi) view: agents see their own payouts,
   manager/admin/finance see the whole department. Reads api/commission_tiered.php. */
(function(){
  'use strict';
  if (typeof window === 'undefined') return;
  function St(){ try{ return (typeof S!=='undefined'&&S)?S:(window.S||null); }catch(e){ return window.S||null; } }

  var _state = { month: '' };
  function esc(s){ return String(s==null?'':s).replace(/[&<>"]/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c];}); }
  function money(n){ n = Number(n)||0; return n.toLocaleString('ru-RU',{maximumFractionDigits:0}) + ' $'; }
  function curMonth(){ if(_state.month) return _state.month;
    try{ var st=St(); return (st && st._nowMonth) || new Date().toISOString().slice(0,7); }catch(e){ return '2026-07'; } }

  function panelShell(){
    return '<section class="card" id="tieredComm" style="margin-top:16px">'
      + '<div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin-bottom:10px">'
      + '<h3 style="margin:0;font-size:15px">Тарифная система комиссий</h3>'
      + '<input type="month" id="tcMonth" value="'+esc(curMonth())+'" onchange="window.__tcReload&&window.__tcReload(this.value)" '
      + 'style="font:inherit;font-size:13px;padding:5px 8px;border:1px solid var(--border);border-radius:7px">'
      + '<span id="tcScope" style="font-size:11.5px;color:var(--muted)"></span></div>'
      + '<div id="tcBody" style="font-size:13px;color:var(--muted)">Загрузка…</div></section>';
  }

  function kpiCards(cards){
    return '<div class="v326-kpis" style="display:flex;gap:10px;flex-wrap:wrap;margin-bottom:12px">'
      + cards.map(function(c){ return '<div class="kpi" style="min-width:150px;flex:1"><div class="lab">'+esc(c[0])+'</div>'
        + '<div class="val">'+esc(c[1])+'</div></div>'; }).join('') + '</div>';
  }

  function renderOwn(res){
    var mine = (res.perUser && res.perUser[0]) || {close:0,bonus:0,total:0,deals:0};
    var h = kpiCards([['Мои сделки в месяце', String(mine.deals||0)],
                      ['Закрытие', money(mine.close)],
                      ['Поддержка/Контроль', money(mine.bonus)],
                      ['Итого мне', money(mine.total)]]);
    var rows = (res.perDeal||[]);
    if (rows.length){
      h += '<div class="tbl-scroll"><table><thead><tr><th>Сделка</th><th>Комиссия</th><th>Тип</th><th class="num">%</th><th class="num">Мне</th></tr></thead><tbody>';
      rows.forEach(function(d){ (d.payouts||[]).forEach(function(p){
        h += '<tr><td>'+esc(d.deal_id)+'</td><td>'+money(d.commission)+'</td><td>'+esc(kindLabel(p.kind))+'</td><td class="num">'+esc(p.pct)+'%</td><td class="num">'+money(p.amount)+'</td></tr>';
      }); });
      h += '</tbody></table></div>';
    } else { h += '<div style="color:var(--muted)">В этом месяце начислений по вам нет.</div>'; }
    return h;
  }

  function renderAll(res){
    var h = kpiCards([['Комиссия CASE за месяц', money(res.totalCommission)],
                      ['Выплачено команде', money(res.totalPaid)],
                      ['Остаётся компании', money(res.company)]]);
    var pu = (res.perUser||[]).slice().sort(function(a,b){return b.total-a.total;});
    h += '<div class="tbl-scroll"><table><thead><tr><th>Сотрудник</th><th class="num">Сделок</th><th class="num">Закрытие</th><th class="num">Поддержка/Контроль</th><th class="num">Итого</th></tr></thead><tbody>';
    if(!pu.length) h += '<tr><td colspan="5" style="color:var(--muted)">Нет начислений за месяц.</td></tr>';
    pu.forEach(function(p){
      h += '<tr><td>'+esc(p.participant)+'</td><td class="num">'+(p.deals||0)+'</td><td class="num">'+money(p.close)+'</td><td class="num">'+money(p.bonus)+'</td><td class="num"><b>'+money(p.total)+'</b></td></tr>';
    });
    h += '</tbody></table></div>';
    return h;
  }

  function kindLabel(k){ return {close:'Закрытие',close_override:'Закрытие (ручное)',support:'Поддержка',control:'Контроль'}[k]||k; }

  function load(month){
    _state.month = month || curMonth();
    var body = document.getElementById('tcBody'); if(!body) return;
    body.textContent = 'Загрузка…';
    if (typeof apiGET !== 'function'){ body.textContent = 'Комиссии доступны при подключении к серверу.'; return; }
    apiGET('commission_tiered.php?month='+encodeURIComponent(_state.month)).then(function(j){
      var res = (j && j.result) || {};
      var scope = document.getElementById('tcScope');
      if (scope) scope.textContent = (res.scope==='all') ? 'режим: отдел (все сотрудники)' : 'режим: только мои начисления';
      body.innerHTML = (res.scope==='all') ? renderAll(res) : renderOwn(res);
      try{ if(typeof syncTblScroll==='function') syncTblScroll(); }catch(e){}
    }).catch(function(err){
      body.innerHTML = '<div style="color:var(--red)">Не удалось загрузить комиссии: '+esc(err&&err.message||err)+'</div>';
    });
  }
  window.__tcReload = function(m){ load(m); };

  function mount(){
    // only on the KPI tab of the kpi view, and once per render
    var st=St(); try{ if (!st || st.view!=='kpi' || st.kpiTab==='pipeline') return; }catch(e){ return; }
    var main = document.getElementById('main'); if(!main || document.getElementById('tieredComm')) return;
    main.insertAdjacentHTML('beforeend', panelShell());
    load(curMonth());
  }

  function wrap(){
    if (typeof window.renderKPI !== 'function'){ return false; }
    if (window.renderKPI.__tcWrapped) return true;
    var orig = window.renderKPI;
    window.renderKPI = function(){ var r = orig.apply(this, arguments); try{ mount(); }catch(e){} return r; };
    window.renderKPI.__tcWrapped = true;
    return true;
  }

  // renderKPI is defined in index.html inline script; this module is deferred so it loads after.
  if (!wrap()){
    var tries = 0, iv = setInterval(function(){ if (wrap() || ++tries > 40) clearInterval(iv); }, 50);
  }
})();
