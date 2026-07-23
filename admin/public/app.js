/* Панель CASE — админка лендингов. Vanilla JS, без зависимостей. */
'use strict';
(function () {

  // ---------------------------------------------------------------- state
  var app = document.getElementById('app');
  var me = null;          // {username, role, projects}
  var slug = null;        // slug открытого в редакторе проекта
  var project = null;     // объект конфига открытого проекта
  var dirty = false;
  var activeTabId = 'main';
  var genUrl = null;

  var dotEl = null;       // индикатор несохранённых изменений
  var genLinkEl = null;   // ссылка «Открыть /p/slug/»
  var topNameEl = null;   // имя проекта в шапке редактора
  var tabsNavEl = null;
  var tabContentEl = null;

  var leadsBadgeEl = null;     // бейдж «новых» лидов на кнопке «Лиды»
  var leadsFilterProject = ''; // фильтры раздела «Лиды» (живут между переходами)
  var leadsFilterStatus = '';
  var leadsAnalyticsOpen = true;
  var statsProject = 'all';    // раздел «Аналитика»: выбранный лендинг ('all' - сводно)
  var statsDays = 30;          // период в днях (0 - за всё время)

  // ---------------------------------------------------------------- helpers
  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  // DOM-конструктор: h('div', {class:'x', onclick:fn}, child1, child2, ...)
  // Дочерние строки вставляются как текст (безопасно для пользовательских данных).
  function h(tag, attrs) {
    var el = document.createElement(tag);
    if (attrs) {
      for (var k in attrs) {
        var v = attrs[k];
        if (v === null || v === undefined || v === false) continue;
        if (k === 'class') el.className = v;
        else if (k.slice(0, 2) === 'on' && typeof v === 'function') el.addEventListener(k.slice(2), v);
        else el.setAttribute(k, v === true ? '' : v);
      }
    }
    for (var i = 2; i < arguments.length; i++) appendChild(el, arguments[i]);
    return el;
  }
  function appendChild(el, c) {
    if (c === null || c === undefined || c === false) return;
    if (Array.isArray(c)) { for (var i = 0; i < c.length; i++) appendChild(el, c[i]); return; }
    el.appendChild(c instanceof Node ? c : document.createTextNode(String(c)));
  }

  // Доступ по пути 'hero.stats.0.n' с защитой от отсутствующих узлов.
  function get(obj, path) {
    var ks = path.split('.'), cur = obj;
    for (var i = 0; i < ks.length; i++) {
      if (cur === null || cur === undefined) return undefined;
      cur = cur[ks[i]];
    }
    return cur;
  }
  function set(obj, path, val) {
    var ks = path.split('.'), cur = obj;
    for (var i = 0; i < ks.length - 1; i++) {
      var k = ks[i];
      if (cur[k] === null || cur[k] === undefined || typeof cur[k] !== 'object') {
        cur[k] = /^\d+$/.test(ks[i + 1]) ? [] : {};
      }
      cur = cur[k];
    }
    cur[ks[ks.length - 1]] = val;
  }
  function ensure(obj, path, def) {
    var v = get(obj, path);
    if (v === null || v === undefined) { set(obj, path, def); return def; }
    return v;
  }

  function ml(ru) { return { ru: ru || '', uz: '', en: '' }; }

  // Гарантирует, что по пути лежит корректный ML-объект, и возвращает его.
  function ensureML(path) {
    var v = get(project, path);
    if (typeof v === 'string') v = { ru: v, uz: '', en: '' };
    if (!v || typeof v !== 'object' || Array.isArray(v)) v = { ru: '', uz: '', en: '' };
    ['ru', 'uz', 'en'].forEach(function (l) {
      if (typeof v[l] !== 'string') v[l] = (v[l] === null || v[l] === undefined) ? '' : String(v[l]);
    });
    set(project, path, v);
    return v;
  }

  var TRANSLIT = {
    'а': 'a', 'б': 'b', 'в': 'v', 'г': 'g', 'д': 'd', 'е': 'e', 'ё': 'e', 'ж': 'zh',
    'з': 'z', 'и': 'i', 'й': 'y', 'к': 'k', 'л': 'l', 'м': 'm', 'н': 'n', 'о': 'o',
    'п': 'p', 'р': 'r', 'с': 's', 'т': 't', 'у': 'u', 'ф': 'f', 'х': 'kh', 'ц': 'ts',
    'ч': 'ch', 'ш': 'sh', 'щ': 'shch', 'ъ': '', 'ы': 'y', 'ь': '', 'э': 'e',
    'ю': 'yu', 'я': 'ya', 'ў': 'o', 'қ': 'q', 'ғ': 'g', 'ҳ': 'h', '’': '', 'ʼ': ''
  };
  function translit(s) {
    var out = '';
    s = String(s).toLowerCase();
    for (var i = 0; i < s.length; i++) {
      var c = s[i];
      out += (TRANSLIT[c] !== undefined) ? TRANSLIT[c] : c;
    }
    return out.replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40);
  }

  function fmtDate(s) {
    if (!s) return '';
    var d = new Date(s);
    if (isNaN(d.getTime())) return String(s);
    return d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short', year: 'numeric' }) +
      ', ' + d.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
  }

  function pad2(n) { return (n < 10 ? '0' : '') + n; }
  // Ключ дня в локальном времени браузера: yyyy-mm-dd
  function dayKey(d) { return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate()); }

  // Дата лида: dd.mm hh:mm
  function fmtLeadTs(s) {
    var d = new Date(s);
    if (isNaN(d.getTime())) return String(s || '');
    function p2(n) { return (n < 10 ? '0' : '') + n; }
    return p2(d.getDate()) + '.' + p2(d.getMonth() + 1) + ' ' + p2(d.getHours()) + ':' + p2(d.getMinutes());
  }

  // Обёртка для async-обработчиков: ошибки, уже показанные пользователю, не всплывают.
  function guard(fn) {
    return function () {
      var args = arguments, self = this;
      return Promise.resolve().then(function () { return fn.apply(self, args); })
        .catch(function (err) { if (!(err && err.handled)) console.error(err); });
    };
  }

  // ---------------------------------------------------------------- toast
  function toast(msg, type) {
    var box = document.getElementById('toasts');
    var t = h('div', { class: 'toast' + (type ? ' ' + type : '') }, msg);
    box.appendChild(t);
    setTimeout(function () {
      t.classList.add('hide');
      setTimeout(function () { t.remove(); }, 350);
    }, 3200);
  }

  // ---------------------------------------------------------------- api
  // cfg.loginForm: не показывать экран логина / тосты, ошибку обрабатывает форма.
  // пути относительные — панель работает и в корне домена, и в подпапке (например /admin/)
  function rel(path) { return path.charAt(0) === '/' ? '.' + path : path; }
  function api(path, opts, cfg) {
    opts = opts || {}; cfg = cfg || {};
    var method = (opts.method || 'GET').toUpperCase();
    var headers = {};
    if (method !== 'GET') headers['X-Api'] = '1';
    var body = opts.body;
    if (body !== undefined && !(body instanceof FormData)) {
      headers['Content-Type'] = 'application/json';
      body = JSON.stringify(body);
    }
    return fetch(rel(path), { method: method, headers: headers, body: body }).catch(function () {
      if (!cfg.loginForm) toast('Нет связи с сервером', 'error');
      var err = new Error('Нет связи с сервером');
      err.handled = !cfg.loginForm; err.network = true;
      throw err;
    }).then(function (res) {
      return res.json().catch(function () { return null; }).then(function (data) {
        if (res.status === 401 && !cfg.loginForm) {
          me = null;
          renderLogin();
          var e401 = new Error('Не авторизован');
          e401.handled = true; e401.status = 401;
          throw e401;
        }
        if (!res.ok) {
          var msg = (data && data.error) || ('Ошибка ' + res.status);
          if (!cfg.loginForm) toast(msg, 'error');
          var err = new Error(msg);
          err.handled = !cfg.loginForm; err.status = res.status;
          throw err;
        }
        return data || {};
      });
    });
  }

  function setDirty() {
    if (!dirty) { dirty = true; if (dotEl) dotEl.hidden = false; }
  }
  function clearDirty() {
    dirty = false;
    if (dotEl) dotEl.hidden = true;
  }
  window.addEventListener('beforeunload', function (e) {
    if (dirty) { e.preventDefault(); e.returnValue = ''; }
  });

  // ---------------------------------------------------------------- form widgets
  function fieldWrap(label, control, hint, toggle) {
    var labelRow = toggle
      ? h('div', { class: 'label-row' }, h('label', null, label), toggle)
      : h('label', null, label);
    return h('div', { class: 'field' }, labelRow, control, hint ? h('div', { class: 'hint' }, hint) : null);
  }

  function makeInput(opts, value, onInput) {
    var input = opts && opts.textarea
      ? h('textarea', { rows: (opts && opts.rows) || 3 })
      : h('input', { type: (opts && opts.type) || 'text' });
    input.value = (value === null || value === undefined) ? '' : value;
    input.addEventListener('input', function () { onInput(input.value); });
    return input;
  }

  // Обычное строковое поле, привязанное к пути в project.
  function fieldText(label, path, opts) {
    opts = opts || {};
    var input = makeInput(opts, get(project, path), function (v) {
      set(project, path, v);
      setDirty();
      if (opts.onInput) opts.onInput(v);
    });
    if (opts.placeholder) input.placeholder = opts.placeholder;
    if (opts.autocomplete) input.autocomplete = opts.autocomplete;
    return fieldWrap(label, input, opts.hint);
  }

  function fieldNum(label, path) {
    var input = h('input', { type: 'number', step: 'any' });
    var v = get(project, path);
    input.value = (v === null || v === undefined) ? '' : v;
    input.addEventListener('input', function () {
      var n = parseFloat(String(input.value).replace(',', '.'));
      set(project, path, isFinite(n) ? n : 0);
      setDirty();
    });
    return fieldWrap(label, input);
  }

  function fieldCheck(label, path) {
    var input = h('input', { type: 'checkbox' });
    input.checked = !!get(project, path);
    input.addEventListener('change', function () {
      set(project, path, input.checked);
      setDirty();
    });
    return h('label', { class: 'check' }, input, h('span', null, label));
  }

  function fieldSelect(label, path, options) {
    var opts = [];
    for (var val in options) opts.push(h('option', { value: val }, options[val]));
    var sel = h('select', null, opts);
    var cur = get(project, path);
    if (cur !== null && cur !== undefined && options[cur] !== undefined) sel.value = cur;
    sel.addEventListener('change', function () {
      set(project, path, sel.value);
      setDirty();
    });
    return fieldWrap(label, sel);
  }

  // ML-поле: RU видно всегда, UZ/EN раскрываются переключателем.
  function mlField(label, path, opts) {
    opts = opts || {};
    var v = ensureML(path);

    function langInput(lang) {
      var inp = makeInput(opts, v[lang], function (val) { v[lang] = val; setDirty(); });
      return inp;
    }
    var extra = h('div', { class: 'ml-extra' },
      h('div', { class: 'ml-lang' }, h('span', { class: 'lang-tag' }, 'UZ'), langInput('uz')),
      h('div', { class: 'ml-lang' }, h('span', { class: 'lang-tag' }, 'EN'), langInput('en'))
    );
    var open = !!(v.uz || v.en);
    extra.hidden = !open;
    var toggle = h('button', {
      type: 'button',
      class: 'ml-toggle' + (open ? ' on' : ''),
      title: 'Показать переводы (узбекский и английский)'
    }, 'UZ/EN');
    toggle.addEventListener('click', function () {
      extra.hidden = !extra.hidden;
      toggle.classList.toggle('on', !extra.hidden);
    });

    var ru = langInput('ru');
    if (opts.placeholder) ru.placeholder = opts.placeholder; // подсказка стандартного текста - только в RU
    return h('div', { class: 'field' },
      h('div', { class: 'label-row' }, h('label', null, label), toggle),
      ru,
      opts.hint ? h('div', { class: 'hint' }, opts.hint) : null,
      extra
    );
  }

  // Редактор списков: блоки с «✕ удалить» и кнопкой «＋ Добавить».
  // opts: {path, addLabel, blank(), render(basePath, item, index)}
  function listEditor(opts) {
    var arr = ensure(project, opts.path, []);
    if (!Array.isArray(arr)) { arr = []; set(project, opts.path, arr); }
    var blocks = [];
    arr.forEach(function (item, i) {
      blocks.push(h('div', { class: 'list-item' },
        h('button', {
          type: 'button', class: 'item-remove',
          onclick: function () { arr.splice(i, 1); setDirty(); renderTab(); }
        }, '✕ удалить'),
        opts.render(opts.path + '.' + i, item, i)
      ));
    });
    return h('div', { class: 'list-editor' },
      blocks,
      h('button', {
        type: 'button', class: 'btn ghost add-btn',
        onclick: function () { arr.push(opts.blank()); setDirty(); renderTab(); }
      }, '＋ ' + (opts.addLabel || 'Добавить'))
    );
  }

  // ---------------------------------------------------------------- image picker
  function uploadsUrl(name) {
    return './uploads/' + encodeURIComponent(slug) + '/' + encodeURIComponent(name);
  }

  function imagePicker(label, path) {
    var preview = h('div', { class: 'img-preview' });
    var removeBtn = h('button', {
      type: 'button', class: 'btn ghost small',
      onclick: function () { set(project, path, ''); setDirty(); refresh(); }
    }, 'Убрать');

    function refresh() {
      preview.innerHTML = '';
      var name = get(project, path);
      if (name) {
        preview.appendChild(h('img', { src: uploadsUrl(name), alt: '' }));
        preview.appendChild(h('div', { class: 'img-name', title: name }, name));
        removeBtn.hidden = false;
      } else {
        preview.appendChild(h('div', { class: 'img-empty' }, 'Нет изображения'));
        removeBtn.hidden = true;
      }
    }

    var file = h('input', { type: 'file', accept: 'image/jpeg,image/png,image/webp,image/svg+xml', hidden: true });
    file.addEventListener('change', guard(function () {
      var f = file.files && file.files[0];
      if (!f) return;
      if (f.size > 20 * 1024 * 1024) {
        toast('Файл больше 20 МБ - выберите файл поменьше', 'error');
        file.value = '';
        return;
      }
      var fd = new FormData();
      fd.append('file', f);
      return api('/api/projects/' + encodeURIComponent(slug) + '/upload', { method: 'POST', body: fd })
        .then(function (d) {
          set(project, path, d.filename);
          setDirty();
          refresh();
          toast('Файл загружен');
          file.value = '';
        });
    }));

    var uploadBtn = h('button', { type: 'button', class: 'btn ghost small', onclick: function () { file.click(); } }, 'Загрузить');
    var pickBtn = h('button', {
      type: 'button', class: 'btn ghost small',
      onclick: guard(function () {
        return pickFromUploaded().then(function (name) {
          if (name) { set(project, path, name); setDirty(); refresh(); }
        });
      })
    }, 'Выбрать из загруженных');

    refresh();
    return h('div', { class: 'field' },
      h('label', null, label),
      h('div', { class: 'image-picker' },
        preview,
        h('div', { class: 'img-btns' }, uploadBtn, pickBtn, removeBtn, file)
      )
    );
  }

  // Модалка выбора из загруженных изображений → Promise<имя файла | null>
  function pickFromUploaded() {
    return api('/api/projects/' + encodeURIComponent(slug) + '/images').then(function (d) {
      var images = (d && d.images) || [];
      return new Promise(function (resolve) {
        function close(val) {
          document.removeEventListener('keydown', onKey);
          overlay.remove();
          resolve(val);
        }
        function onKey(e) { if (e.key === 'Escape') close(null); }

        var body;
        if (images.length) {
          body = h('div', { class: 'img-grid' }, images.map(function (name) {
            return h('button', { type: 'button', class: 'img-cell', onclick: function () { close(name); } },
              h('img', { src: uploadsUrl(name), alt: '' }),
              h('span', { title: name }, name)
            );
          }));
        } else {
          body = h('p', { class: 'muted' }, 'Пока нет загруженных файлов. Нажмите «Загрузить», чтобы добавить изображение.');
        }

        var overlay = h('div', {
          class: 'modal-overlay',
          onclick: function (e) { if (e.target === overlay) close(null); }
        },
          h('div', { class: 'modal' },
            h('div', { class: 'modal-head' },
              h('h3', null, 'Загруженные изображения'),
              h('button', { type: 'button', class: 'modal-close', onclick: function () { close(null); } }, '✕')
            ),
            body
          )
        );
        document.addEventListener('keydown', onKey);
        document.body.appendChild(overlay);
      });
    });
  }

  // ---------------------------------------------------------------- login
  function renderLogin() {
    dirty = false;
    genUrl = null; project = null; slug = null;
    document.title = 'Вход - Панель CASE';
    app.innerHTML = '';

    var errBox = h('div', { class: 'login-error' });
    errBox.hidden = true;
    var userInput = h('input', { type: 'text', autocomplete: 'username', required: true });
    var passInput = h('input', { type: 'password', autocomplete: 'current-password', required: true });
    var submitBtn = h('button', { type: 'submit', class: 'btn primary wide' }, 'Войти');

    var form = h('form', null,
      h('div', { class: 'field' }, h('label', null, 'Логин'), userInput),
      h('div', { class: 'field' }, h('label', null, 'Пароль'), passInput),
      errBox,
      submitBtn
    );
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      errBox.hidden = true;
      submitBtn.disabled = true;
      api('/api/login', { method: 'POST', body: { username: userInput.value.trim(), password: passInput.value } }, { loginForm: true })
        .then(function (d) {
          me = d.user;
          return showProjects();
        })
        .catch(function (err) {
          errBox.textContent = (err && err.network)
            ? 'Нет связи с сервером'
            : ((err && err.message) || 'Неверный логин или пароль');
          errBox.hidden = false;
        })
        .then(function () { submitBtn.disabled = false; });
    });

    app.appendChild(h('div', { class: 'login-wrap' },
      h('div', { class: 'login-card' },
        h('div', { class: 'login-logo' }, h('span', { class: 'brand-mark' }, 'CASE'), h('span', { class: 'login-title' }, 'Панель CASE')),
        h('p', { class: 'muted login-sub' }, 'Управление лендингами'),
        form
      )
    ));
    userInput.focus();
  }

  function logout() {
    return api('/api/logout', { method: 'POST' }).then(function () {
      me = null;
      renderLogin();
    });
  }

  // ---------------------------------------------------------------- header (список/пользователи)
  function header(active) {
    leadsBadgeEl = h('span', { class: 'nav-badge' });
    leadsBadgeEl.hidden = true;
    var nav = [
      h('button', {
        class: 'nav-btn' + (active === 'projects' ? ' active' : ''),
        onclick: guard(showProjects)
      }, 'Лендинги'),
      h('button', {
        class: 'nav-btn' + (active === 'leads' ? ' active' : ''),
        onclick: guard(showLeads)
      }, 'Лиды', leadsBadgeEl),
      h('button', {
        class: 'nav-btn' + (active === 'stats' ? ' active' : ''),
        onclick: guard(showStats)
      }, 'Аналитика')
    ];
    if (me && me.role === 'admin') {
      nav.push(h('button', {
        class: 'nav-btn' + (active === 'users' ? ' active' : ''),
        onclick: guard(showUsers)
      }, 'Пользователи'));
    }
    return h('header', { class: 'topnav' },
      h('div', { class: 'topnav-in' },
        h('div', { class: 'brand' }, h('span', { class: 'brand-mark' }, 'CASE'), h('span', { class: 'brand-name' }, 'Панель')),
        h('nav', { class: 'nav' }, nav),
        h('div', { class: 'user-box' },
          h('span', { class: 'user-name' }, me ? me.username : ''),
          h('span', { class: 'role-badge ' + (me && me.role === 'admin' ? 'admin' : 'agent') },
            me && me.role === 'admin' ? 'Админ' : 'Агент'),
          h('button', { class: 'btn ghost small', onclick: guard(logout) }, 'Выйти')
        )
      )
    );
  }

  // ---------------------------------------------------------------- projects list
  function showProjects() {
    return api('/api/projects').then(function (d) {
      var projects = (d && d.projects) || [];
      document.title = 'Лендинги - Панель CASE';
      app.innerHTML = '';

      var titleRow = h('div', { class: 'page-head' },
        h('h1', { class: 'page-title' }, 'Лендинги'),
        me.role === 'admin'
          ? h('button', { class: 'btn accent', onclick: guard(createProject) }, '＋ Новый лендинг')
          : null
      );

      var list;
      if (projects.length) {
        list = h('div', { class: 'projects-grid' }, projects.map(projectCard));
      } else {
        list = h('div', { class: 'card empty-card' },
          h('p', { class: 'muted' }, me.role === 'admin'
            ? 'Пока нет ни одного лендинга. Нажмите «＋ Новый лендинг», чтобы создать первый.'
            : 'Вам пока не назначен ни один лендинг. Обратитесь к администратору.')
        );
      }

      app.appendChild(header('projects'));
      app.appendChild(h('main', { class: 'container' }, titleRow, list));
      refreshLeadsBadge();
    });
  }

  function projectCard(p) {
    var actions = [
      h('button', { class: 'btn primary small', onclick: guard(function () { return openEditor(p.slug); }) }, 'Редактировать'),
      h('a', { class: 'btn ghost small', href: './p/' + encodeURIComponent(p.slug) + '/', target: '_blank', rel: 'noopener' }, 'Предпросмотр'),
      h('a', { class: 'btn ghost small', href: './api/projects/' + encodeURIComponent(p.slug) + '/export' }, 'Скачать сайт (zip)')
    ];
    if (me.role === 'admin') {
      actions.push(h('button', {
        class: 'btn ghost small danger',
        onclick: guard(function () {
          if (!confirm('Удалить лендинг «' + (p.name || p.slug) + '»? Это действие необратимо.')) return;
          return api('/api/projects/' + encodeURIComponent(p.slug), { method: 'DELETE' }).then(function () {
            toast('Лендинг удалён');
            return showProjects();
          });
        })
      }, 'Удалить'));
    }
    return h('div', { class: 'card project-card' },
      h('div', { class: 'p-name' }, p.name || p.slug),
      h('div', { class: 'p-meta' },
        h('span', { class: 'p-slug' }, '/' + p.slug + '/'),
        p.updatedAt ? h('span', { class: 'muted' }, 'обновлён ' + fmtDate(p.updatedAt)) : null
      ),
      h('div', { class: 'p-actions' }, actions)
    );
  }

  function createProject() {
    var name = prompt('Название нового лендинга:');
    if (name === null) return;
    name = name.trim();
    if (!name) return;
    var s = prompt('Адрес (slug) - строчные латинские буквы, цифры и дефис:', translit(name));
    if (s === null) return;
    s = s.trim().toLowerCase();
    if (!/^[a-z0-9-]{2,40}$/.test(s)) {
      toast('Некорректный slug: 2–40 символов, только a-z, 0-9 и дефис', 'error');
      return;
    }
    return api('/api/projects', { method: 'POST', body: { slug: s, name: name } }).then(function (d) {
      toast('Лендинг создан');
      return openEditor((d && d.slug) || s);
    });
  }

  // ---------------------------------------------------------------- editor
  var ICON_OPTIONS = {
    office: 'Офис', clinic: 'Клиника', service: 'Сервис', education: 'Образование',
    building: 'Здание', ceiling: 'Потолки', parking: 'Паркинг', grid: 'Планировка',
    power: 'Инженерия', shield: 'Отделка', star: 'Звезда', key: 'Ключи'
  };
  var STATE_OPTIONS = { done: 'Завершено', now: 'Идёт сейчас', next: 'Впереди' };

  // v1: старый лендинг; v2 (schemaVersion>=2): только секции, которые
  // реально читает новый шаблон - мёртвые вкладки не показываем
  var TABS_V1 = [
    { id: 'main', label: 'Основное', render: tabMain },
    { id: 'seo', label: 'SEO', render: tabSeo },
    { id: 'hero', label: 'Главный экран', render: tabHero },
    { id: 'uses', label: 'Назначение', render: tabUses },
    { id: 'lots', label: 'Лоты', render: tabLots },
    { id: 'building', label: 'О здании', render: tabBuilding },
    { id: 'invest', label: 'Инвесторам', render: tabInvest },
    { id: 'progress', label: 'Стройка', render: tabProgress },
    { id: 'location', label: 'Локация', render: tabLocation },
    { id: 'lead', label: 'Заявка', render: tabLead },
    { id: 'faq', label: 'FAQ', render: tabFaq },
    { id: 'texts', label: 'Кнопки и тексты', render: tabTexts },
    { id: 'footer', label: 'Футер', render: tabFooter }
  ];
  var TABS_V2 = [
    { id: 'main', label: 'Основное', render: tabMain },
    { id: 'intro', label: 'Главный экран', render: tabIntro },
    { id: 'units', label: 'Юниты', render: tabUnits },
    { id: 'usecases', label: 'Кому подходит', render: tabUseCases2 },
    { id: 'scenarios', label: 'Форматы сделки', render: tabScenarios2 },
    { id: 'about2', label: 'О здании', render: tabAbout2 },
    { id: 'location2', label: 'Локация', render: tabLocation2 },
    { id: 'lead', label: 'Заявка', render: tabLead },
    { id: 'faq', label: 'FAQ', render: tabFaq },
    { id: 'seo', label: 'SEO', render: tabSeo },
    { id: 'footer', label: 'Футер', render: tabFooter }
  ];
  function TABS() { return (project && project.schemaVersion >= 2) ? TABS_V2 : TABS_V1; }

  function openEditor(s) {
    return api('/api/projects/' + encodeURIComponent(s)).then(function (d) {
      slug = s;
      project = (d && d.project) || {};
      dirty = false;
      genUrl = null;
      activeTabId = 'main';
      renderEditor();
    });
  }

  function renderEditor() {
    document.title = (project.name || slug) + ' - Панель CASE';
    app.innerHTML = '';

    dotEl = h('span', { class: 'dot', title: 'Есть несохранённые изменения' });
    dotEl.hidden = !dirty;
    topNameEl = h('span', { class: 'et-name-text' }, project.name || slug);
    genLinkEl = h('a', { class: 'gen-link', target: '_blank', rel: 'noopener' });
    genLinkEl.hidden = true;

    var top = h('div', { class: 'editor-top' },
      h('div', { class: 'editor-top-in' },
        h('div', { class: 'et-left' },
          h('button', { class: 'btn ghost small', onclick: goBack }, '← Назад'),
          h('div', { class: 'et-name' }, topNameEl, dotEl)
        ),
        h('div', { class: 'et-actions' },
          genLinkEl,
          h('button', { class: 'btn primary', onclick: guard(doSave) }, 'Сохранить'),
          h('button', { class: 'btn accent', onclick: guard(doSaveBuild) }, 'Сохранить и собрать')
        )
      )
    );

    tabsNavEl = h('nav', { class: 'tabs' }, TABS().map(function (t) {
      return h('button', {
        class: 'tab-btn' + (t.id === activeTabId ? ' active' : ''),
        'data-id': t.id,
        onclick: function () { switchTab(t.id); }
      }, t.label);
    }));
    tabContentEl = h('div', { class: 'tab-content' });

    app.appendChild(h('div', { class: 'editor' },
      top,
      h('div', { class: 'editor-body' }, tabsNavEl, tabContentEl)
    ));
    renderTab();
  }

  function switchTab(id) {
    activeTabId = id;
    renderTab();
    var btns = tabsNavEl.querySelectorAll('.tab-btn');
    for (var i = 0; i < btns.length; i++) {
      btns[i].classList.toggle('active', btns[i].getAttribute('data-id') === id);
    }
  }

  function renderTab() {
    var tab = null;
    var tabs = TABS();
    for (var i = 0; i < tabs.length; i++) if (tabs[i].id === activeTabId) tab = tabs[i];
    if (!tab) tab = tabs[0];
    tabContentEl.innerHTML = '';
    appendChild(tabContentEl, h('h2', { class: 'tab-title' }, tab.label));
    appendChild(tabContentEl, tab.render());
  }

  function goBack() {
    if (dirty && !confirm('Есть несохранённые изменения. Уйти без сохранения?')) return;
    clearDirty();
    project = null; slug = null; genUrl = null;
    dotEl = null; genLinkEl = null; topNameEl = null;
    guard(showProjects)();
  }

  function doSave() {
    return api('/api/projects/' + encodeURIComponent(slug), { method: 'PUT', body: { project: project } })
      .then(function () {
        clearDirty();
        toast('Сохранено');
      });
  }

  function doSaveBuild() {
    return api('/api/projects/' + encodeURIComponent(slug), { method: 'PUT', body: { project: project } })
      .then(function () {
        clearDirty();
        return api('/api/projects/' + encodeURIComponent(slug) + '/generate', { method: 'POST' });
      })
      .then(function (d) {
        genUrl = './p/' + slug + '/';
        genLinkEl.href = genUrl;
        genLinkEl.textContent = 'Открыть ' + genUrl;
        genLinkEl.hidden = false;
        toast('Собрано');
      });
  }

  function groupTitle(text) { return h('h3', { class: 'group-title' }, text); }
  function row() { return h('div', { class: 'row' }, Array.prototype.slice.call(arguments)); }
  function row3() { return h('div', { class: 'row row-3' }, Array.prototype.slice.call(arguments)); }

  // ------------------------------------------------ tabs
  function tabMain() {
    return [
      fieldText('Название проекта (внутреннее, видно только в панели)', 'name', {
        onInput: function (v) { if (topNameEl) topNameEl.textContent = v || slug; }
      }),
      groupTitle('Бренд'),
      fieldText('Метка логотипа (до 3 букв)', 'brand.mark', { placeholder: 'BC' }),
      imagePicker('Логотип-картинка (пусто - используется буквенная метка выше)', 'brand.logo'),
      mlField('Название', 'brand.name'),
      mlField('Подпись под названием (адрес · город)', 'brand.tag'),
      fieldText('Акцентный цвет (hex)', 'brand.accent', {
        placeholder: '#a8804c',
        hint: 'Например #a8804c. Кнопки и акценты лендинга. Пусто - фирменная бронза.'
      }),
      groupTitle('Контакты'),
      row(
        fieldText('Телефон', 'contacts.phone', { placeholder: '+998 …' }),
        fieldText('Telegram (имя без @)', 'contacts.telegram')
      ),
      fieldText('E-mail для лидов', 'contacts.email', {
        hint: 'Каждая заявка пересылается сюда письмом. Можно несколько адресов через запятую: taxtapul@caseadvisory.uz, boss@caseadvisory.uz'
      }),
      fieldText('Google Таблица (URL скрипта)', 'contacts.sheetsEndpoint', {
        hint: 'Адрес веб-приложения Apps Script, куда отправляются заявки. Пусто - заявки идут только в Telegram/почту.'
      }),
      fieldText('Кнопка «Войти» на лендинге', 'adminUrl', {
        hint: 'Адрес входа в эту панель, например /admin/ или https://panel.caseadvisory.uz. Пусто - кнопки не будет.'
      }),
      fieldText('Приём заявок (URL)', 'leadEndpoint', {
        hint: 'Куда лендинг шлёт заявки. Пусто - в эту панель (работает на /p/ и за /admin/). Для лендинга на другом хостинге: полный адрес, например https://panel.example.com/api/lead/takhtapul'
      })
    ].concat(me.role === 'admin' ? [
      groupTitle('Своя почта проекта (только админ)'),
      h('p', { class: 'muted', style: 'margin:-6px 0 14px' },
        'Через какой ящик уходят письма с заявками и автоответ клиенту. Пусто - используется общий ящик приложения, ' +
        'настроенный на хостинге (переменные окружения SMTP_*). Агентам эти поля не видны и не редактируются.'),
      row(
        fieldText('SMTP-сервер', 'contacts.smtpHost', { placeholder: 'mail.caseadvisory.uz' }),
        fieldText('Порт', 'contacts.smtpPort', { placeholder: '465' })
      ),
      row(
        fieldText('Логин (обычно = email)', 'contacts.smtpUser', { placeholder: 'project@caseadvisory.uz', autocomplete: 'off' }),
        fieldText('Пароль', 'contacts.smtpPass', { type: 'password', autocomplete: 'new-password' })
      ),
      groupTitle('Telegram-уведомления о лидах (только админ)'),
      h('p', { class: 'muted', style: 'margin:-6px 0 14px' },
        'При новой заявке бот пришлёт сообщение в чат. Токен - у @BotFather (команда /newbot). ' +
        'Chat ID - напишите боту любое сообщение, затем откройте https://api.telegram.org/bot<ТОКЕН>/getUpdates ' +
        'и возьмите число "chat":{"id":…}. Пусто - уведомления в Telegram не отправляются.'),
      row(
        fieldText('Токен бота', 'contacts.tgBotToken', { placeholder: '123456:AA...', autocomplete: 'off' }),
        fieldText('Chat ID', 'contacts.tgChatId', { placeholder: '123456789' })
      )
    ] : []);
  }

  // Юниты (схема v2): статусы уровней и подсказки по использованию.
  // GLA намеренно только для чтения в этой вкладке - площади верифицированы
  // по обмерам, менять их с клавиатуры слишком легко и слишком дорого.
  var UNIT_STATUS_OPTIONS = {
    available: 'Свободно', reserved: 'Резерв', leased: 'Сдано', sold: 'Продано'
  };
  function tabUnits() {
    if (!project.units || !project.units.length) {
      return [h('p', { class: 'muted' },
        'Проект использует старую схему лендинга - вкладка «Юниты» появится после миграции на схему v2.')];
    }
    var out = [groupTitle('Статусы уровней'),
      h('p', { class: 'muted', style: 'margin:-6px 0 14px' },
        'Статус показывается в таблице помещений на лендинге. Занятые уровни не скрываются - видимый спрос работает на доверие. После смены статусов нажмите «Опубликовать».')];
    project.units.forEach(function (u, i) {
      out.push(h('div', { class: 'card', style: 'margin-bottom:12px' },
        h('div', { style: 'display:flex;align-items:baseline;gap:12px;margin-bottom:10px' },
          h('b', null, (u.level && u.level.ru) || u.id),
          h('span', { class: 'muted' }, 'GLA ' + (u.gla || '?') + ' м²' + (u.glaNote ? ' (' + u.glaNote + ')' : ''))
        ),
        row(
          fieldSelect('Статус', 'units.' + i + '.status', UNIT_STATUS_OPTIONS),
          h('div')
        ),
        mlField('Возможное использование (строка в таблице)', 'units.' + i + '.uses'),
        u.whole ? null : imagePicker('Планировка уровня (SVG, JPG или PNG)', 'units.' + i + '.plan')
      ));
    });
    return out;
  }

  // ─── редакторы секций лендинга v2 ───
  function tabIntro() {
    return [
      imagePicker('Фон главного экрана (рендер, сумерки)', 'intro.image'),
      mlField('Заголовок (H1)', 'intro.h1', { textarea: true }),
      mlField('Подзаголовок (форматы сделки одной строкой)', 'intro.sub'),
      groupTitle('Три факта под заголовком'),
      listEditor({
        path: 'intro.facts',
        addLabel: 'Добавить факт',
        blank: function () { return { n: '', l: ml('') }; },
        render: function (base) {
          return [
            fieldText('Число/значение (пусто - выводится только подпись)', base + '.n'),
            mlField('Подпись', base + '.l')
          ];
        }
      }),
      groupTitle('Лента ключевых параметров (тёмная полоса под hero)'),
      listEditor({
        path: 'params',
        addLabel: 'Добавить параметр',
        blank: function () { return { n: '', l: ml('') }; },
        render: function (base) {
          return [
            fieldText('Число/значение', base + '.n'),
            mlField('Подпись', base + '.l')
          ];
        }
      })
    ];
  }

  var USECASE_ICONS = { clinic: 'Клиника', education: 'Образование', office: 'Офис', service: 'Сервис' };
  function tabUseCases2() {
    return [
      mlField('Заголовок секции', 'useCases.h2'),
      listEditor({
        path: 'useCases.cards',
        addLabel: 'Добавить карточку',
        blank: function () { return { icon: 'office', h: ml(''), levels: ml(''), p: ml('') }; },
        render: function (base) {
          return [
            fieldSelect('Иконка', base + '.icon', USECASE_ICONS),
            mlField('Название', base + '.h'),
            mlField('Подходящие уровни (строка под названием)', base + '.levels'),
            mlField('Описание', base + '.p', { textarea: true })
          ];
        }
      })
    ];
  }

  function tabScenarios2() {
    return [
      mlField('Заголовок секции', 'scenarios.h2'),
      listEditor({
        path: 'scenarios.cols',
        addLabel: 'Добавить колонку',
        blank: function () { return { h: ml(''), p: ml('') }; },
        render: function (base) {
          return [
            mlField('Заголовок', base + '.h'),
            mlField('Текст', base + '.p', { textarea: true })
          ];
        }
      })
    ];
  }

  function tabAbout2() {
    return [
      mlField('Заголовок секции', 'about.h2'),
      groupTitle('Характеристики'),
      listEditor({
        path: 'about.specs',
        addLabel: 'Добавить строку',
        blank: function () { return { b: ml(''), s: ml('') }; },
        render: function (base) {
          return [
            mlField('Параметр', base + '.b'),
            mlField('Значение (пусто - строка не показывается)', base + '.s')
          ];
        }
      }),
      mlField('Статус объекта (плашка под таблицей)', 'about.status', { textarea: true }),
      mlField('Примечание (единственное упоминание SFB)', 'about.sfbNote'),
      groupTitle('Галерея рендеров (подпись «визуализация» ставится автоматически)'),
      listEditor({
        path: 'about.images',
        addLabel: 'Добавить изображение',
        blank: function () { return { file: '' }; },
        render: function (base) { return [imagePicker('Изображение', base + '.file')]; }
      })
    ];
  }

  function tabLocation2() {
    return [
      mlField('Заголовок секции', 'location.h2'),
      mlField('Адрес', 'location.address'),
      row(
        fieldText('Широта', 'location.lat'),
        fieldText('Долгота', 'location.lng')
      ),
      groupTitle('Время в пути на автомобиле'),
      listEditor({
        path: 'location.drive',
        addLabel: 'Добавить строку',
        blank: function () { return { to: ml(''), time: ml('') }; },
        render: function (base) {
          return [
            mlField('Куда', base + '.to'),
            mlField('Время · расстояние', base + '.time')
          ];
        }
      }),
      mlField('Окружение (абзац под таблицей)', 'location.around', { textarea: true }),
      mlField('Справочная строка про метро (в самом низу)', 'location.metroNote')
    ];
  }

  function tabSeo() {
    return [
      mlField('Заголовок страницы (title)', 'seo.title'),
      mlField('Описание (description)', 'seo.description', { textarea: true }),
      fieldText('Ключевые слова (keywords)', 'seo.keywords', { textarea: true, rows: 3, hint: 'Через запятую' }),
      fieldText('Публичный URL лендинга (обязательно для схемы v2)', 'seo.publicUrl', {
        hint: 'Полный адрес, по которому живёт лендинг, например https://caseadvisory.uz/taxtapul. От него строятся canonical, hreflang, og:url и sitemap.xml.'
      }),
      fieldText('Домен лендинга (для старой схемы)', 'seo.domain', {
        hint: 'Используется только лендингами старой схемы. Для новой схемы заполняйте «Публичный URL» выше.'
      }),
      fieldText('Подтверждение Google Search Console', 'seo.googleVerification', {
        hint: 'Код из мета-тега google-site-verification (только значение content)'
      }),
      fieldText('Подтверждение Яндекс Вебмастера', 'seo.yandexVerification', {
        hint: 'Код из мета-тега yandex-verification (только значение content)'
      })
    ];
  }

  function tabHero() {
    return [
      imagePicker('Фоновое изображение', 'hero.image'),
      groupTitle('Бейджи'),
      listEditor({
        path: 'hero.badges',
        addLabel: 'Добавить бейдж',
        blank: function () { return ml(''); },
        render: function (base) { return [mlField('Текст бейджа', base)]; }
      }),
      groupTitle('Тексты'),
      mlField('Заголовок', 'hero.title', { textarea: true, hint: 'Можно HTML: <span> выделяет бронзой' }),
      mlField('Подзаголовок', 'hero.subtitle', { textarea: true, hint: 'Можно HTML' }),
      groupTitle('Цифры'),
      listEditor({
        path: 'hero.stats',
        addLabel: 'Добавить цифру',
        blank: function () { return { n: ml(''), l: ml('') }; },
        render: function (base) {
          return [
            mlField('Число', base + '.n', { hint: 'Можно <small> для мелкой части, например 4 <small>этажа</small>' }),
            mlField('Подпись', base + '.l')
          ];
        }
      })
    ];
  }

  function tabUses() {
    return [
      fieldCheck('Показывать секцию', 'uses.enabled'),
      mlField('Заголовок (H2)', 'uses.h2'),
      mlField('Подзаголовок', 'uses.sub', { textarea: true }),
      mlField('Сноска под карточками', 'uses.note'),
      groupTitle('Карточки сценариев'),
      listEditor({
        path: 'uses.cards',
        addLabel: 'Добавить карточку',
        blank: function () { return { icon: 'office', h: ml(''), p: ml('') }; },
        render: function (base) {
          return [
            fieldSelect('Иконка', base + '.icon', ICON_OPTIONS),
            mlField('Заголовок', base + '.h'),
            mlField('Текст', base + '.p', { textarea: true })
          ];
        }
      })
    ];
  }

  function tabLots() {
    return [
      mlField('Заголовок (H2)', 'lots.h2'),
      mlField('Подзаголовок', 'lots.sub', { textarea: true }),
      groupTitle('Лоты'),
      listEditor({
        path: 'lots.items',
        addLabel: 'Добавить лот',
        blank: function () { return { title: ml(''), area: ml(''), plan: '', features: [] }; },
        render: function (base) {
          return [
            mlField('Название (этаж - площадь)', base + '.title'),
            mlField('Подпись (тип, формат)', base + '.area'),
            imagePicker('Планировка', base + '.plan'),
            h('div', { class: 'sub-title' }, 'Особенности'),
            listEditor({
              path: base + '.features',
              addLabel: 'Добавить особенность',
              blank: function () { return ml(''); },
              render: function (fb) { return [mlField('Текст', fb)]; }
            })
          ];
        }
      })
    ];
  }

  function tabBuilding() {
    ensure(project, 'building.images', []);
    return [
      fieldCheck('Показывать секцию', 'building.enabled'),
      mlField('Заголовок (H2)', 'building.h2'),
      mlField('Подзаголовок', 'building.sub', { textarea: true }),
      groupTitle('Характеристики'),
      listEditor({
        path: 'building.specs',
        addLabel: 'Добавить характеристику',
        blank: function () { return { icon: 'building', b: ml(''), s: ml('') }; },
        render: function (base) {
          return [
            fieldSelect('Иконка', base + '.icon', ICON_OPTIONS),
            mlField('Заголовок', base + '.b'),
            mlField('Пояснение', base + '.s')
          ];
        }
      }),
      mlField('Примечание (о фасаде и т.п.)', 'building.note', { textarea: true, hint: 'Можно HTML' }),
      groupTitle('Фотографии'),
      row(
        imagePicker('Фото 1', 'building.images.0'),
        imagePicker('Фото 2', 'building.images.1')
      )
    ];
  }

  function tabInvest() {
    return [
      fieldCheck('Показывать секцию', 'invest.enabled'),
      mlField('Заголовок (H2)', 'invest.h2'),
      groupTitle('Карточки'),
      listEditor({
        path: 'invest.cards',
        addLabel: 'Добавить карточку',
        blank: function () { return { h: ml(''), p: ml('') }; },
        render: function (base) {
          return [
            mlField('Заголовок', base + '.h'),
            mlField('Текст', base + '.p', { textarea: true })
          ];
        }
      }),
      mlField('Лента под карточками', 'invest.strip', { textarea: true, hint: 'Можно HTML' })
    ];
  }

  function tabProgress() {
    return [
      fieldCheck('Показывать секцию', 'progress.enabled'),
      mlField('Заголовок (H2)', 'progress.h2'),
      mlField('Подзаголовок', 'progress.sub'),
      imagePicker('Фото стройки', 'progress.image'),
      groupTitle('Этапы'),
      listEditor({
        path: 'progress.steps',
        addLabel: 'Добавить этап',
        blank: function () { return { state: 'next', b: ml(''), s: ml('') }; },
        render: function (base) {
          return [
            fieldSelect('Статус', base + '.state', STATE_OPTIONS),
            mlField('Название этапа', base + '.b'),
            mlField('Пояснение', base + '.s')
          ];
        }
      })
    ];
  }

  function tabLocation() {
    return [
      mlField('Заголовок (H2)', 'location.h2'),
      mlField('Подзаголовок', 'location.sub', { textarea: true }),
      mlField('Адрес', 'location.address'),
      mlField('Примечание к адресу (район · координаты)', 'location.addressNote'),
      row3(
        fieldText('Город', 'location.city'),
        fieldNum('Широта (lat)', 'location.lat'),
        fieldNum('Долгота (lng)', 'location.lng')
      ),
      groupTitle('Что рядом'),
      listEditor({
        path: 'location.pois',
        addLabel: 'Добавить место',
        blank: function () { return { name: ml(''), dist: ml('') }; },
        render: function (base) {
          return [
            mlField('Название', base + '.name'),
            mlField('Расстояние', base + '.dist')
          ];
        }
      })
    ];
  }

  function tabLead() {
    return [
      mlField('Заголовок (H2)', 'lead.h2'),
      mlField('Подзаголовок', 'lead.sub', { textarea: true })
    ];
  }

  function tabFaq() {
    return [
      listEditor({
        path: 'faq',
        addLabel: 'Добавить вопрос',
        blank: function () { return { q: ml(''), a: ml('') }; },
        render: function (base) {
          return [
            mlField('Вопрос', base + '.q'),
            mlField('Ответ', base + '.a', { textarea: true, hint: 'Можно HTML, например ссылку на телефон: <a href="tel:+998…">…</a>' })
          ];
        }
      })
    ];
  }

  function tabFooter() {
    return [
      mlField('Адрес в подвале', 'footer.addr'),
      mlField('Юридическая строка', 'footer.legal', { textarea: true })
    ];
  }

  // Все надписи лендинга. Пустое значение = используется стандартный текст,
  // стандарт показан как placeholder в RU-поле.
  function tabTexts() {
    function t(label, path, ph, opts) {
      opts = opts || {};
      if (ph) opts.placeholder = ph;
      return mlField(label, path, opts);
    }
    return [
      h('p', { class: 'muted texts-intro' },
        'Все надписи лендинга. Пустое поле - используется стандартный текст (показан как подсказка).'),
      groupTitle('Меню и шапка'),
      row(t('Пункт «Назначение»', 'texts.nav.uses', 'Назначение'),
        t('Пункт «Помещения»', 'texts.nav.lots', 'Помещения')),
      row(t('Пункт «О здании»', 'texts.nav.building', 'О здании'),
        t('Пункт «Локация»', 'texts.nav.location', 'Локация')),
      row(t('Пункт «Вопросы»', 'texts.nav.faq', 'Вопросы'),
        t('Кнопка заявки в шапке', 'texts.nav.cta', 'Оставить заявку')),
      t('Кнопка входа для сотрудников', 'texts.nav.login', 'Войти'),
      groupTitle('Главный экран'),
      row(t('Кнопка 1', 'texts.hero.btn1', 'Получить планировки и цены'),
        t('Кнопка 2', 'texts.hero.btn2', 'Смотреть помещения')),
      groupTitle('Подписи над секциями'),
      row(t('Над секцией «Назначение»', 'texts.uses.lbl', 'Свободное назначение'),
        t('Над секцией «Лоты»', 'texts.lots.lbl', 'Свободные лоты')),
      row(t('Над секцией «О здании»', 'texts.bld.lbl', 'О здании'),
        t('Над секцией «Инвесторам»', 'texts.inv.lbl', 'Инвесторам')),
      row(t('Над секцией «Стройка»', 'texts.prog.lbl', 'Ход строительства'),
        t('Над секцией «Локация»', 'texts.loc.lbl', 'Локация')),
      row(t('Над секцией «Заявка»', 'texts.lead.lbl', 'Заявка'),
        t('Над секцией «Вопросы»', 'texts.faq.lbl', 'Частые вопросы')),
      t('Заголовок FAQ', 'texts.faq.h2', 'Коротко о главном'),
      groupTitle('Лоты'),
      t('Кнопка над лотами', 'texts.lots.cta', 'Запросить актуальные условия'),
      row(t('Плашка статуса', 'texts.lots.tag', 'В продаже · Возможна аренда'),
        t('Подсказка на плане', 'texts.lots.hint', 'Нажмите, чтобы увеличить')),
      row(t('Подпись цены', 'texts.lots.priceL', 'Продажа · Аренда'),
        t('Текст цены', 'texts.lots.priceV', 'цена и условия - по запросу')),
      row(t('Кнопка лота', 'texts.lots.btn1', 'Узнать цену и условия'),
        t('Кнопка «Позвонить»', 'texts.lots.btn2', 'Позвонить')),
      t('Кнопка «Инвесторам»', 'texts.inv.cta', 'Обсудить условия'),
      groupTitle('Форма заявки'),
      t('Заголовок', 'texts.form.h3', 'Оставить заявку'),
      t('Подзаголовок', 'texts.form.p', '', { textarea: true }),
      row(t('Подпись телефона в контактах', 'texts.lead.c1', 'отдел продаж'),
        t('Подпись Telegram', 'texts.lead.c2', 'Telegram - ответим быстрее всего')),
      row(t('Поле «Имя»', 'texts.form.lName', 'Имя *'),
        t('Поле «Телефон»', 'texts.form.lPhone', 'Телефон *')),
      row(t('Поле «Email»', 'texts.form.lEmail', 'Email'),
        t('Поле «Интересует»', 'texts.form.lInt', 'Интересует')),
      row(t('Поле «Помещение»', 'texts.form.lLot', 'Помещение'),
        t('Поле «Комментарий»', 'texts.form.lMsg', 'Комментарий')),
      row(t('Вариант 1', 'texts.form.o1', 'Покупка'),
        t('Вариант 2', 'texts.form.o2', 'Аренда')),
      row(t('Вариант 3', 'texts.form.o3', 'Покупка как инвестиция'),
        t('Вариант 4', 'texts.form.o4', 'Консультация')),
      row(t('Вариант «Оба лота»', 'texts.form.oLall', 'Оба лота'),
        t('Вариант «Ещё не выбрал(а)»', 'texts.form.oLnone', 'Ещё не выбрал(а)')),
      row(t('Кнопка отправки', 'texts.form.send', 'Отправить заявку'),
        t('Текст при отправке', 'texts.form.sending', 'Отправляем…')),
      t('Согласие под кнопкой', 'texts.form.note', '', { textarea: true }),
      t('Заголовок после отправки', 'texts.form.okH', 'Заявка отправлена!'),
      groupTitle('Плейсхолдеры полей'),
      row(t('Подсказка в поле «Имя»', 'texts.ph.name', 'Как к вам обращаться'),
        t('Подсказка в поле «Телефон»', 'texts.ph.phone', '+998 __ ___ __ __')),
      row(t('Подсказка в поле «Email»', 'texts.ph.email', 'для отправки планировок'),
        t('Подсказка в поле «Комментарий»', 'texts.ph.msg', 'Ваш комментарий'))
    ];
  }

  // ---------------------------------------------------------------- users
  function showUsers() {
    return Promise.all([api('/api/users'), api('/api/projects')]).then(function (res) {
      var users = (res[0] && res[0].users) || [];
      var allSlugs = ((res[1] && res[1].projects) || []).map(function (p) { return p.slug; });
      document.title = 'Пользователи - Панель CASE';
      app.innerHTML = '';

      var rows = users.map(function (u) { return userRow(u, allSlugs); });
      var table = h('table', { class: 'users-table' },
        h('thead', null, h('tr', null,
          h('th', null, 'Логин'), h('th', null, 'Роль'), h('th', null, 'Проекты'), h('th', null, '')
        )),
        h('tbody', null, rows)
      );

      app.appendChild(header('users'));
      app.appendChild(h('main', { class: 'container' },
        h('div', { class: 'page-head' },
          h('h1', { class: 'page-title' }, 'Пользователи'),
          h('a', { class: 'btn ghost small', href: './api/backup' }, 'Скачать бэкап данных')
        ),
        h('div', { class: 'card' }, h('div', { class: 'table-wrap' }, table)),
        h('h2', { class: 'group-title users-create-title' }, 'Новый пользователь'),
        h('div', { class: 'card' }, createUserForm(allSlugs))
      ));
      refreshLeadsBadge();
    });
  }

  function projectChips(allSlugs, selected) {
    var boxes = [];
    var wrap;
    if (!allSlugs.length) {
      wrap = h('span', { class: 'muted' }, 'нет проектов');
    } else {
      wrap = h('div', { class: 'chips' }, allSlugs.map(function (s) {
        var cb = h('input', { type: 'checkbox' });
        cb.checked = selected.indexOf(s) !== -1;
        boxes.push({ slug: s, cb: cb });
        return h('label', { class: 'chip' }, cb, h('span', null, s));
      }));
    }
    return {
      el: wrap,
      value: function () {
        return boxes.filter(function (b) { return b.cb.checked; }).map(function (b) { return b.slug; });
      }
    };
  }

  function roleSelect(value) {
    var sel = h('select', null,
      h('option', { value: 'agent' }, 'Агент'),
      h('option', { value: 'admin' }, 'Админ')
    );
    sel.value = value === 'admin' ? 'admin' : 'agent';
    return sel;
  }

  function userRow(u, allSlugs) {
    var isSelf = me && u.username === me.username;
    var sel = roleSelect(u.role);
    var chips = projectChips(allSlugs, u.projects || []);

    var saveBtn = h('button', {
      class: 'btn ghost small',
      onclick: guard(function () {
        return api('/api/users/' + encodeURIComponent(u.username), {
          method: 'PUT',
          body: { role: sel.value, projects: chips.value() }
        }).then(function () { toast('Сохранено'); });
      })
    }, 'Сохранить');

    var pwBtn = h('button', {
      class: 'btn ghost small',
      onclick: guard(function () {
        var pw = prompt('Новый пароль для «' + u.username + '»:');
        if (pw === null) return;
        if (!pw.trim()) { toast('Пароль не может быть пустым', 'error'); return; }
        return api('/api/users/' + encodeURIComponent(u.username), { method: 'PUT', body: { password: pw } })
          .then(function () { toast('Пароль изменён'); });
      })
    }, 'Сменить пароль');

    var actions = [saveBtn, pwBtn];
    if (!isSelf) {
      actions.push(h('button', {
        class: 'btn ghost small danger',
        onclick: guard(function () {
          if (!confirm('Удалить пользователя «' + u.username + '»?')) return;
          return api('/api/users/' + encodeURIComponent(u.username), { method: 'DELETE' })
            .then(function () { toast('Пользователь удалён'); return showUsers(); });
        })
      }, 'Удалить'));
    }

    return h('tr', null,
      h('td', { class: 'td-user' }, u.username, isSelf ? h('span', { class: 'muted' }, ' (вы)') : null),
      h('td', null, sel),
      h('td', null, chips.el),
      h('td', { class: 'td-actions' }, actions)
    );
  }

  function createUserForm(allSlugs) {
    var userInput = h('input', { type: 'text', autocomplete: 'off', required: true });
    var passInput = h('input', { type: 'text', autocomplete: 'off', required: true });
    var sel = roleSelect('agent');
    var chips = projectChips(allSlugs, []);

    var form = h('form', { class: 'create-user' },
      row3(
        h('div', { class: 'field' }, h('label', null, 'Логин'), userInput),
        h('div', { class: 'field' }, h('label', null, 'Пароль'), passInput),
        h('div', { class: 'field' }, h('label', null, 'Роль'), sel)
      ),
      h('div', { class: 'field' }, h('label', null, 'Проекты'), chips.el),
      h('button', { type: 'submit', class: 'btn primary' }, 'Создать пользователя')
    );
    form.addEventListener('submit', guard(function (e) {
      e.preventDefault();
      var username = userInput.value.trim();
      var password = passInput.value;
      if (!username || !password) { toast('Заполните логин и пароль', 'error'); return; }
      return api('/api/users', {
        method: 'POST',
        body: { username: username, password: password, role: sel.value, projects: chips.value() }
      }).then(function () {
        toast('Пользователь создан');
        return showUsers();
      });
    }));
    return form;
  }

  // ---------------------------------------------------------------- «Аналитика»: дашборд лендингов
  var UNIT_LABELS = { b: 'Подвал', f1: '1 этаж', f2: '2 этаж', f3: '3 этаж', f4: '4 этаж', all: 'Здание целиком' };
  var CTA_LABELS = {
    hero: 'Кнопка в hero', usecases: 'После «Кому подходит»', scenarios: '«Форматы сделки»',
    about: 'После «О здании»', location: '«Локация»', faq: 'После FAQ', sticky: 'Липкая панель', case_logo: 'Логотип CASE'
  };
  var FUNNEL_STEPS = [
    ['visit', 'Зашли на сайт'], ['scroll50', 'Проскроллили 50%+'], ['units', 'Смотрели помещения'],
    ['cta', 'Кликнули CTA/контакты'], ['form_start', 'Начали форму'], ['form_submit', 'Отправили'], ['form_success', 'Заявка принята']
  ];

  function statRank(title, obj, labelMap) {
    var items = Object.keys(obj || {}).map(function (k) {
      return { label: (labelMap && labelMap[k]) || k, count: obj[k] };
    }).sort(function (a, b) { return b.count - a.count; }).slice(0, 12);
    return analyticsRankList(title, items);
  }

  function statsFunnelCol(title, f, visits) {
    var base = f.visit || 0;
    return h('div', { class: 'analytics-block' },
      h('h3', { class: 'analytics-subtitle' }, title),
      FUNNEL_STEPS.map(function (st) {
        var n = f[st[0]] || 0;
        var pct = base ? Math.round(n / base * 100) : 0;
        return h('div', { class: 'funnel-row' },
          h('div', { class: 'funnel-label', style: 'width:150px;font-size:12px' }, st[1]),
          h('div', { class: 'funnel-track' },
            h('div', { class: 'funnel-fill st-new', style: 'width:' + (n ? Math.max(pct, 2) : 0) + '%', title: n + ' (' + pct + '%)' })),
          h('div', { class: 'funnel-count' }, n)
        );
      })
    );
  }

  function showStats() {
    return api('/api/projects').then(function (d) {
      var projects = (d && d.projects) || [];
      document.title = 'Аналитика - Панель CASE';
      app.innerHTML = '';

      var projSel = h('select', { class: 'leads-filter' },
        h('option', { value: 'all' }, 'Все лендинги'),
        projects.map(function (p) { return h('option', { value: p.slug }, p.name || p.slug); })
      );
      projSel.value = statsProject;
      projSel.addEventListener('change', function () { statsProject = projSel.value; guard(showStats)(); });

      var periods = [[7, '7 дней'], [30, '30 дней'], [90, '90 дней'], [0, 'Всё время']];
      var periodBtns = h('div', { class: 'period-btns' }, periods.map(function (p) {
        return h('button', {
          class: 'period-btn' + (statsDays === p[0] ? ' on' : ''),
          onclick: function () { statsDays = p[0]; guard(showStats)(); }
        }, p[1]);
      }));

      var body = h('div', { class: 'analytics-body' }, h('p', { class: 'muted' }, 'Загрузка…'));

      var projName = statsProject === 'all' ? 'Все лендинги'
        : (projects.filter(function (p) { return p.slug === statsProject; })[0] || {}).name || statsProject;
      var periodName = statsDays ? 'последние ' + statsDays + ' дней' : 'за всё время';

      app.appendChild(header('stats'));
      app.appendChild(h('main', { class: 'container' },
        h('div', { class: 'page-head' },
          h('h1', { class: 'page-title' }, 'Аналитика'),
          h('button', { class: 'btn ghost small', onclick: function () { window.print(); } }, 'Скачать PDF-отчёт')
        ),
        h('div', { class: 'leads-toolbar stats-toolbar' }, projSel, periodBtns),
        h('div', { class: 'print-head' },
          h('b', null, 'TAXTAPUL · Отчёт по лендингу'),
          h('span', null, projName + ' · ' + periodName + ' · сформирован ' + new Date().toLocaleDateString('ru-RU')),
          h('span', { class: 'muted' }, 'CASE Real Estate Advisory · caseadvisory.uz')
        ),
        body
      ));

      return api('/api/analytics/' + encodeURIComponent(statsProject) + '?days=' + statsDays).then(function (a) {
        body.innerHTML = '';
        if (!a.visits) {
          body.appendChild(h('div', { class: 'analytics-block analytics-empty' },
            'Пока нет данных за выбранный период. Аналитика копится с момента публикации нового лендинга.'));
          return;
        }
        var conv = a.uniques ? Math.round(a.leads / a.uniques * 100) : 0;

        body.appendChild(h('div', { class: 'stat-tiles' },
          statTile(a.visits, 'Визиты'),
          statTile(a.uniques, 'Уникальные'),
          statTile(a.leads, 'Лиды'),
          statTile(conv + '%', 'Конверсия в лид'),
          statTile(a.pdf, 'Скачали PDF'),
          statTile(a.mapOpens, 'Открыли карту')
        ));

        // воронка: все / аренда / покупка
        body.appendChild(h('div', { class: 'funnel-3' },
          statsFunnelCol('Воронка - все', a.funnel.all, a.visits),
          statsFunnelCol('Только аренда', a.funnel.lease, a.visits),
          statsFunnelCol('Только покупка', a.funnel.buy, a.visits)
        ));

        // визиты по дням
        var days = Object.keys(a.byDay).sort();
        if (days.length) {
          var max = 1;
          days.forEach(function (d2) { max = Math.max(max, a.byDay[d2].views); });
          body.appendChild(h('div', { class: 'analytics-block' },
            h('h3', { class: 'analytics-subtitle' }, 'Визиты по дням'),
            h('div', { class: 'trend-chart' }, days.slice(-30).map(function (d2) {
              var n = a.byDay[d2].views;
              return h('div', { class: 'trend-col', title: d2 + ': ' + n + ' визитов, ' + a.byDay[d2].uniques + ' уник.' },
                h('div', { class: 'trend-bar', style: 'height:' + (n ? Math.max(Math.round(n / max * 100), 4) : 1) + '%' }));
            }))
          ));
        }

        // источники: рефереры + UTM-метки
        var sources = {};
        Object.keys(a.sources || {}).forEach(function (k) { sources[k] = a.sources[k]; });
        Object.keys(a.utm || {}).forEach(function (k) { sources['UTM: ' + k] = a.utm[k]; });

        body.appendChild(h('div', { class: 'analytics-rank-row' },
          statRank('Откуда приходят', sources),
          statRank('Топ кликов', Object.assign({}, a.clicks,
            (function () { var o = {}; Object.keys(a.ctas || {}).forEach(function (k) { o[CTA_LABELS[k] || k] = a.ctas[k]; }); return o; })()))
        ));
        body.appendChild(h('div', { class: 'analytics-rank-row' },
          statRank('Устройства', a.devices),
          statRank('Языки версии', a.langs)
        ));

        // интерес к этажам
        var unitRows = {};
        Object.keys(a.units || {}).forEach(function (k) {
          var p = k.split('|');
          if (!unitRows[p[0]]) unitRows[p[0]] = { clicks: 0, plans: 0, downloads: 0, requests: 0 };
          unitRows[p[0]][p[1]] = a.units[k];
        });
        var uKeys = Object.keys(unitRows);
        if (uKeys.length) {
          var table = h('table', { class: 'users-table' },
            h('thead', null, h('tr', null,
              h('th', null, 'Уровень'), h('th', null, 'Клики'), h('th', null, 'Просмотры плана'),
              h('th', null, 'Скачивания плана'), h('th', null, 'Запросы условий')
            )),
            h('tbody', null, ['b', 'f1', 'f2', 'f3', 'f4', 'all'].filter(function (k) { return unitRows[k]; }).map(function (k) {
              var r = unitRows[k];
              return h('tr', null,
                h('td', null, h('b', null, UNIT_LABELS[k] || k)),
                h('td', null, String(r.clicks || 0)),
                h('td', null, String(r.plans || 0)),
                h('td', null, String(r.downloads || 0)),
                h('td', null, String(r.requests || 0))
              );
            }))
          );
          body.appendChild(h('div', { class: 'analytics-block' },
            h('h3', { class: 'analytics-subtitle' }, 'Интерес к этажам'),
            h('div', { class: 'table-wrap' }, table)
          ));
        }

        // маршруты и прочее
        body.appendChild(h('div', { class: 'analytics-rank-row' },
          statRank('Маршруты к объекту', a.routes),
          analyticsRankList('Прочее', [
            { label: 'Открытий FAQ', count: a.faqOpens || 0 },
            { label: 'Открытий карты', count: a.mapOpens || 0 },
            { label: 'Скачиваний презентации', count: a.pdf || 0 }
          ].filter(function (x) { return x.count; }))
        ));
      });
    });
  }

  // ---------------------------------------------------------------- CRM «Лиды»
  var LEAD_SOURCES = ['Звонок', 'Telegram', 'Рекомендация', 'Другое'];
  var LEAD_ST_CLASS = {
    'Новый': 'st-new', 'В работе': 'st-work', 'Встреча/показ': 'st-meet',
    'Переговоры': 'st-neg', 'Договор': 'st-deal', 'Отказ': 'st-lost'
  };
  // порядок этапов воронки; «Отказ» — потери, показывается отдельно
  var LEAD_FUNNEL = ['Новый', 'В работе', 'Встреча/показ', 'Переговоры', 'Договор'];

  function setLeadsBadge(n) {
    if (!leadsBadgeEl) return;
    if (n > 0) { leadsBadgeEl.textContent = String(n); leadsBadgeEl.hidden = false; }
    else { leadsBadgeEl.textContent = ''; leadsBadgeEl.hidden = true; }
  }
  // Тихо обновляет бейдж «новых» лидов в шапке (без тостов при ошибке).
  function refreshLeadsBadge() {
    api('/api/leads').then(function (d) {
      var leads = (d && d.leads) || [];
      setLeadsBadge(leads.filter(function (l) { return l.status === 'Новый'; }).length);
    }).catch(function () {});
  }

  function leadApiPath(l) {
    return '/api/leads/' + encodeURIComponent(l.project) + '/' + encodeURIComponent(l.id);
  }

  // ---------------------------------------------------------------- аналитика лидов (воронка, источники, динамика)
  function countBy(list, keyFn) {
    var m = {}, order = [];
    list.forEach(function (l) {
      var k = keyFn(l) || '-';
      if (!(k in m)) { m[k] = 0; order.push(k); }
      m[k]++;
    });
    return order.map(function (k) { return { label: k, count: m[k] }; })
      .sort(function (a, b) { return b.count - a.count; });
  }

  function statTile(value, label) {
    return h('div', { class: 'stat-tile' },
      h('div', { class: 'stat-value' }, String(value)),
      h('div', { class: 'stat-label' }, label)
    );
  }

  function analyticsStats(list) {
    var total = list.length;
    var byStatus = {};
    list.forEach(function (l) { byStatus[l.status] = (byStatus[l.status] || 0) + 1; });
    var won = byStatus['Договор'] || 0;
    var lost = byStatus['Отказ'] || 0;
    var fresh = byStatus['Новый'] || 0;
    var active = total - won - lost - fresh;
    var conv = total ? Math.round(won / total * 100) : 0;
    return h('div', { class: 'stat-tiles' },
      statTile(total, 'Всего лидов'),
      statTile(fresh, 'Новых'),
      statTile(active, 'В работе'),
      statTile(won, 'Договор'),
      statTile(conv + '%', 'Конверсия'),
      statTile(lost, 'Отказ')
    );
  }

  function analyticsFunnel(list) {
    var total = list.length;
    var byStatus = {};
    list.forEach(function (l) { byStatus[l.status] = (byStatus[l.status] || 0) + 1; });
    var rows = LEAD_FUNNEL.map(function (st) {
      var n = byStatus[st] || 0;
      var pct = total ? Math.round(n / total * 100) : 0;
      return h('div', { class: 'funnel-row' },
        h('div', { class: 'funnel-label' }, st),
        h('div', { class: 'funnel-track' },
          h('div', {
            class: 'funnel-fill ' + (LEAD_ST_CLASS[st] || 'st-new'),
            style: 'width:' + (n ? Math.max(pct, 2) : 0) + '%',
            title: st + ': ' + n + ' из ' + total + ' (' + pct + '%)'
          })
        ),
        h('div', { class: 'funnel-count' }, n)
      );
    });
    var lostN = byStatus['Отказ'] || 0;
    var lostPct = total ? Math.round(lostN / total * 100) : 0;
    return h('div', { class: 'analytics-block' },
      h('h3', { class: 'analytics-subtitle' }, 'Воронка по этапам'),
      h('div', { class: 'funnel' }, rows),
      h('div', { class: 'funnel-lost', title: 'Лиды со статусом «Отказ» не входят в воронку выше' },
        'Отказ: ' + lostN + ' (' + lostPct + '%)')
    );
  }

  function analyticsRankList(title, items) {
    var maxCount = items.length ? items[0].count : 0;
    var total = items.reduce(function (s, it) { return s + it.count; }, 0) || 1;
    return h('div', { class: 'analytics-block' },
      h('h3', { class: 'analytics-subtitle' }, title),
      items.length
        ? items.map(function (it) {
          var pct = Math.round(it.count / total * 100);
          var w = maxCount ? Math.round(it.count / maxCount * 100) : 0;
          return h('div', { class: 'rank-row', title: it.label + ': ' + it.count + ' (' + pct + '%)' },
            h('div', { class: 'rank-label' }, it.label),
            h('div', { class: 'rank-track' }, h('div', { class: 'rank-fill', style: 'width:' + Math.max(w, 2) + '%' })),
            h('div', { class: 'rank-count' }, it.count)
          );
        })
        : h('p', { class: 'muted' }, 'Нет данных')
    );
  }

  function analyticsTrend(list) {
    var DAYS = 14;
    var byDay = {};
    list.forEach(function (l) {
      var d = new Date(l.ts);
      if (isNaN(d.getTime())) return;
      var k = dayKey(d);
      byDay[k] = (byDay[k] || 0) + 1;
    });
    var today = new Date();
    var series = [];
    var max = 1;
    for (var i = DAYS - 1; i >= 0; i--) {
      var d = new Date(today.getFullYear(), today.getMonth(), today.getDate() - i);
      var n = byDay[dayKey(d)] || 0;
      max = Math.max(max, n);
      series.push({ d: d, n: n });
    }
    var cols = series.map(function (s) {
      var pct = Math.round(s.n / max * 100);
      return h('div', {
        class: 'trend-col',
        title: s.d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' }) + ': ' + s.n
      }, h('div', { class: 'trend-bar', style: 'height:' + (s.n ? Math.max(pct, 4) : 1) + '%' }));
    });
    return h('div', { class: 'analytics-block' },
      h('h3', { class: 'analytics-subtitle' }, 'Заявки по дням (последние 14 дней)'),
      h('div', { class: 'trend-chart' }, cols)
    );
  }

  // allLeads — все доступные лиды; names — {slug: имя проекта}; фильтр по проекту берётся из leadsFilterProject
  function leadAnalyticsBlock(allLeads, names) {
    var body = h('div', { class: 'analytics-body' });
    body.hidden = !leadsAnalyticsOpen;
    var toggleBtn = h('button', {
      type: 'button', class: 'analytics-toggle',
      onclick: function () {
        leadsAnalyticsOpen = !leadsAnalyticsOpen;
        body.hidden = !leadsAnalyticsOpen;
        toggleBtn.textContent = leadsAnalyticsOpen ? 'Скрыть' : 'Показать';
      }
    }, leadsAnalyticsOpen ? 'Скрыть' : 'Показать');

    function refresh() {
      body.innerHTML = '';
      var scoped = leadsFilterProject ? allLeads.filter(function (l) { return l.project === leadsFilterProject; }) : allLeads;
      if (!scoped.length) {
        body.appendChild(h('div', { class: 'analytics-block analytics-empty' }, 'Нет данных для аналитики.'));
        return;
      }
      var rankBlocks = [analyticsRankList('По источнику', countBy(scoped, function (l) { return l.source; }))];
      if (!leadsFilterProject) {
        rankBlocks.push(analyticsRankList('По проекту', countBy(scoped, function (l) { return names[l.project] || l.project; })));
      }
      body.appendChild(analyticsStats(scoped));
      body.appendChild(analyticsFunnel(scoped));
      body.appendChild(h('div', { class: 'analytics-rank-row' + (rankBlocks.length === 1 ? ' single' : '') }, rankBlocks));
      body.appendChild(analyticsTrend(scoped));
    }
    refresh();

    return {
      el: h('div', { class: 'analytics-panel' },
        h('div', { class: 'analytics-head' },
          h('h2', { class: 'group-title analytics-title' }, 'Аналитика'),
          toggleBtn
        ),
        body
      ),
      refresh: refresh
    };
  }

  function showLeads() {
    return Promise.all([api('/api/leads'), api('/api/projects')]).then(function (res) {
      var leads = (res[0] && res[0].leads) || [];
      var statuses = (res[0] && res[0].statuses) || Object.keys(LEAD_ST_CLASS);
      var projects = (res[1] && res[1].projects) || [];
      var isAdmin = me && me.role === 'admin';
      document.title = 'Лиды - Панель CASE';
      app.innerHTML = '';

      var names = {};
      projects.forEach(function (p) { names[p.slug] = p.name || p.slug; });

      function countNew() {
        return leads.filter(function (l) { return l.status === 'Новый'; }).length;
      }

      var analytics = leadAnalyticsBlock(leads, names);

      // ---- фильтры
      var projSel = h('select', { class: 'leads-filter' },
        h('option', { value: '' }, 'Все проекты'),
        projects.map(function (p) { return h('option', { value: p.slug }, p.name || p.slug); })
      );
      if (leadsFilterProject && names[leadsFilterProject] === undefined) leadsFilterProject = '';
      projSel.value = leadsFilterProject;
      projSel.addEventListener('change', function () {
        leadsFilterProject = projSel.value;
        renderList(); updateExportLink(); analytics.refresh();
      });

      var stSel = h('select', { class: 'leads-filter' },
        h('option', { value: '' }, 'Все статусы'),
        statuses.map(function (s) { return h('option', { value: s }, s); })
      );
      if (leadsFilterStatus && statuses.indexOf(leadsFilterStatus) === -1) leadsFilterStatus = '';
      stSel.value = leadsFilterStatus;
      stSel.addEventListener('change', function () { leadsFilterStatus = stSel.value; renderList(); updateExportLink(); });

      var exportLink = h('a', { class: 'btn ghost' }, 'Скачать CSV');
      function updateExportLink() {
        var params = [];
        if (leadsFilterProject) params.push('project=' + encodeURIComponent(leadsFilterProject));
        if (leadsFilterStatus) params.push('status=' + encodeURIComponent(leadsFilterStatus));
        exportLink.href = './api/leads/export' + (params.length ? '?' + params.join('&') : '');
      }
      updateExportLink();

      var listBox = h('div', { class: 'leads-list' });

      // ---- строка таблицы
      function leadRow(l) {
        var statusSel = h('select', { class: 'status-sel ' + (LEAD_ST_CLASS[l.status] || 'st-new') },
          statuses.map(function (s) { return h('option', { value: s }, s); })
        );
        statusSel.value = l.status;
        statusSel.addEventListener('change', guard(function () {
          var prev = l.status;
          return api(leadApiPath(l), { method: 'PUT', body: { status: statusSel.value } })
            .then(function () {
              l.status = statusSel.value;
              statusSel.className = 'status-sel ' + (LEAD_ST_CLASS[l.status] || 'st-new');
              setLeadsBadge(countNew());
              toast('Статус обновлён');
            })
            .catch(function (err) { statusSel.value = prev; throw err; });
        }));

        var noteBtn = h('button', {
          type: 'button',
          class: 'lead-note' + (l.note ? '' : ' empty'),
          title: 'Изменить заметку'
        }, l.note || '＋ заметка');
        noteBtn.addEventListener('click', guard(function () {
          var v = prompt('Заметка по лиду «' + (l.name || '') + '»:', l.note || '');
          if (v === null) return;
          return api(leadApiPath(l), { method: 'PUT', body: { note: v } }).then(function () {
            l.note = v;
            noteBtn.textContent = v || '＋ заметка';
            noteBtn.classList.toggle('empty', !v);
            toast('Заметка сохранена');
          });
        }));

        var cells = [
          h('td', { class: 'td-date' },
            fmtLeadTs(l.ts),
            l.emailSent === false ? h('span', { class: 'lead-warn', title: 'Письмо не отправилось' }, ' ⚠') : null
          ),
          h('td', { class: 'td-client' },
            h('div', { class: 'lead-name' }, l.name || '-'),
            l.phone ? h('a', { class: 'lead-phone', href: 'tel:' + String(l.phone).replace(/[^+\d]/g, '') }, l.phone) : null,
            l.message ? h('div', { class: 'lead-msg', title: 'Комментарий клиента' }, l.message) : null
          ),
          h('td', { 'data-l': 'Проект' }, names[l.project] || l.project),
          h('td', { 'data-l': 'Интерес', class: 'td-interest' },
            l.interest ? h('div', null, l.interest) : null,
            l.lot ? h('div', { class: 'muted' }, l.lot) : null,
            (!l.interest && !l.lot) ? '-' : null
          ),
          h('td', { 'data-l': 'Источник' }, l.source || '-'),
          h('td', { 'data-l': 'Статус', class: 'td-status' }, statusSel),
          h('td', { 'data-l': 'Заметка', class: 'td-note' }, noteBtn)
        ];
        if (isAdmin) {
          cells.push(h('td', { class: 'td-del' }, h('button', {
            type: 'button', class: 'lead-del', title: 'Удалить лид',
            onclick: guard(function () {
              if (!confirm('Удалить лид «' + (l.name || '') + '»?')) return;
              return api(leadApiPath(l), { method: 'DELETE' }).then(function () {
                var i = leads.indexOf(l);
                if (i !== -1) leads.splice(i, 1);
                setLeadsBadge(countNew());
                toast('Лид удалён');
                renderList();
              });
            })
          }, '✕')));
        }
        return h('tr', null, cells);
      }

      function renderList() {
        listBox.innerHTML = '';
        if (!leads.length) {
          listBox.appendChild(h('div', { class: 'card empty-card' },
            h('p', { class: 'muted' }, 'Пока нет лидов. Заявки с лендингов будут появляться здесь автоматически.')));
          return;
        }
        var shown = leads.filter(function (l) {
          if (leadsFilterProject && l.project !== leadsFilterProject) return false;
          if (leadsFilterStatus && l.status !== leadsFilterStatus) return false;
          return true;
        });
        if (!shown.length) {
          listBox.appendChild(h('div', { class: 'card empty-card' },
            h('p', { class: 'muted' }, 'Нет лидов по выбранным фильтрам.')));
          return;
        }
        var head = [
          h('th', null, 'Дата'), h('th', null, 'Клиент'), h('th', null, 'Проект'),
          h('th', null, 'Интерес'), h('th', null, 'Источник'), h('th', null, 'Статус'), h('th', null, 'Заметка')
        ];
        if (isAdmin) head.push(h('th', null, ''));
        listBox.appendChild(h('div', { class: 'card leads-card' },
          h('div', { class: 'table-wrap' },
            h('table', { class: 'leads-table' },
              h('thead', null, h('tr', null, head)),
              h('tbody', null, shown.map(leadRow))
            )
          )
        ));
      }

      // ---- ручное добавление лида
      function addLeadDialog() {
        if (!projects.length) { toast('Нет доступных проектов', 'error'); return; }
        function close() {
          document.removeEventListener('keydown', onKey);
          overlay.remove();
        }
        function onKey(e) { if (e.key === 'Escape') close(); }

        var mProj = h('select', null, projects.map(function (p) {
          return h('option', { value: p.slug }, p.name || p.slug);
        }));
        mProj.value = leadsFilterProject || projects[0].slug;
        var mSrc = h('select', null, LEAD_SOURCES.map(function (s) { return h('option', { value: s }, s); }));
        mSrc.value = 'Звонок';
        var mName = h('input', { type: 'text' });
        var mPhone = h('input', { type: 'text', placeholder: '+998 …' });
        var mEmail = h('input', { type: 'text' });
        var mMsg = h('textarea', { rows: 3 });
        var submitBtn = h('button', { type: 'submit', class: 'btn primary' }, 'Добавить');

        var form = h('form', null,
          h('div', { class: 'field' }, h('label', null, 'Проект'), mProj),
          row(
            h('div', { class: 'field' }, h('label', null, 'Имя *'), mName),
            h('div', { class: 'field' }, h('label', null, 'Телефон *'), mPhone)
          ),
          row(
            h('div', { class: 'field' }, h('label', null, 'Email'), mEmail),
            h('div', { class: 'field' }, h('label', null, 'Источник'), mSrc)
          ),
          h('div', { class: 'field' }, h('label', null, 'Комментарий'), mMsg),
          submitBtn
        );
        form.addEventListener('submit', guard(function (e) {
          e.preventDefault();
          var name = mName.value.trim(), phone = mPhone.value.trim();
          if (!name || !phone) { toast('Заполните имя и телефон', 'error'); return; }
          submitBtn.disabled = true;
          return api('/api/leads', {
            method: 'POST',
            body: {
              project: mProj.value, name: name, phone: phone,
              email: mEmail.value.trim(), message: mMsg.value.trim(), source: mSrc.value
            }
          }).then(function () {
            toast('Лид добавлен');
            close();
            return showLeads();
          }).catch(function (err) { submitBtn.disabled = false; throw err; });
        }));

        var overlay = h('div', {
          class: 'modal-overlay',
          onclick: function (e) { if (e.target === overlay) close(); }
        },
          h('div', { class: 'modal modal-narrow' },
            h('div', { class: 'modal-head' },
              h('h3', null, 'Новый лид'),
              h('button', { type: 'button', class: 'modal-close', onclick: function () { close(); } }, '✕')
            ),
            form
          )
        );
        document.addEventListener('keydown', onKey);
        document.body.appendChild(overlay);
        mName.focus();
      }

      app.appendChild(header('leads'));
      app.appendChild(h('main', { class: 'container' },
        h('h1', { class: 'page-title' }, 'Лиды'),
        analytics.el,
        h('div', { class: 'leads-toolbar' },
          projSel, stSel,
          h('span', { class: 'toolbar-spacer' }),
          h('button', { class: 'btn accent', onclick: function () { addLeadDialog(); } }, '＋ Добавить лид'),
          h('button', { class: 'btn ghost', onclick: guard(showLeads) }, 'Обновить'),
          exportLink
        ),
        listBox
      ));
      setLeadsBadge(countNew());
      renderList();
    });
  }

  // ---------------------------------------------------------------- boot
  api('/api/me')
    .then(function (d) {
      me = d.user;
      return showProjects();
    })
    .catch(function (err) {
      // 401 уже показал экран логина; на прочие ошибки тоже показываем логин.
      if (!(err && err.status === 401)) renderLogin();
    });

  // Экспорт esc на случай использования из консоли/расширений.
  window.__panelEsc = esc;
})();
