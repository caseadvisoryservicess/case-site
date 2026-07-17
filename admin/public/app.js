/* Панель SFB — админка лендингов. Vanilla JS, без зависимостей. */
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
    return fetch(path, { method: method, headers: headers, body: body }).catch(function () {
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
      : h('input', { type: 'text' });
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
    return '/uploads/' + encodeURIComponent(slug) + '/' + encodeURIComponent(name);
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

    var file = h('input', { type: 'file', accept: 'image/jpeg,image/png,image/webp', hidden: true });
    file.addEventListener('change', guard(function () {
      var f = file.files && file.files[0];
      if (!f) return;
      if (f.size > 20 * 1024 * 1024) {
        toast('Файл больше 20 МБ — выберите файл поменьше', 'error');
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
    document.title = 'Вход — Панель SFB';
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
        h('div', { class: 'login-logo' }, h('span', { class: 'brand-mark' }, 'SFB'), h('span', { class: 'login-title' }, 'Панель SFB')),
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
    var nav = [
      h('button', {
        class: 'nav-btn' + (active === 'projects' ? ' active' : ''),
        onclick: guard(showProjects)
      }, 'Лендинги')
    ];
    if (me && me.role === 'admin') {
      nav.push(h('button', {
        class: 'nav-btn' + (active === 'users' ? ' active' : ''),
        onclick: guard(showUsers)
      }, 'Пользователи'));
    }
    return h('header', { class: 'topnav' },
      h('div', { class: 'topnav-in' },
        h('div', { class: 'brand' }, h('span', { class: 'brand-mark' }, 'SFB'), h('span', { class: 'brand-name' }, 'Панель')),
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
      document.title = 'Лендинги — Панель SFB';
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
    });
  }

  function projectCard(p) {
    var actions = [
      h('button', { class: 'btn primary small', onclick: guard(function () { return openEditor(p.slug); }) }, 'Редактировать'),
      h('a', { class: 'btn ghost small', href: '/p/' + encodeURIComponent(p.slug) + '/', target: '_blank', rel: 'noopener' }, 'Предпросмотр'),
      h('a', { class: 'btn ghost small', href: '/api/projects/' + encodeURIComponent(p.slug) + '/export' }, 'Скачать сайт (zip)')
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
    var s = prompt('Адрес (slug) — строчные латинские буквы, цифры и дефис:', translit(name));
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

  var TABS = [
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
    { id: 'footer', label: 'Футер', render: tabFooter }
  ];

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
    document.title = (project.name || slug) + ' — Панель SFB';
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

    tabsNavEl = h('nav', { class: 'tabs' }, TABS.map(function (t) {
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
    for (var i = 0; i < TABS.length; i++) if (TABS[i].id === activeTabId) tab = TABS[i];
    if (!tab) tab = TABS[0];
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
        genUrl = (d && d.url) || ('/p/' + slug + '/');
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
      fieldText('Метка логотипа (до 3 букв)', 'brand.mark', { placeholder: 'SFB' }),
      mlField('Название', 'brand.name'),
      mlField('Подпись под названием (адрес · город)', 'brand.tag'),
      groupTitle('Контакты'),
      row(
        fieldText('Телефон', 'contacts.phone', { placeholder: '+998 …' }),
        fieldText('Telegram (имя без @)', 'contacts.telegram')
      ),
      fieldText('E-mail', 'contacts.email'),
      fieldText('Google Таблица (URL скрипта)', 'contacts.sheetsEndpoint', {
        hint: 'Адрес веб-приложения Apps Script, куда отправляются заявки. Пусто — заявки идут только в Telegram/почту.'
      })
    ];
  }

  function tabSeo() {
    return [
      mlField('Заголовок страницы (title)', 'seo.title'),
      mlField('Описание (description)', 'seo.description', { textarea: true }),
      fieldText('Ключевые слова (keywords)', 'seo.keywords', { textarea: true, rows: 3, hint: 'Через запятую' })
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
            mlField('Название (этаж — площадь)', base + '.title'),
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

  // ---------------------------------------------------------------- users
  function showUsers() {
    return Promise.all([api('/api/users'), api('/api/projects')]).then(function (res) {
      var users = (res[0] && res[0].users) || [];
      var allSlugs = ((res[1] && res[1].projects) || []).map(function (p) { return p.slug; });
      document.title = 'Пользователи — Панель SFB';
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
        h('h1', { class: 'page-title' }, 'Пользователи'),
        h('div', { class: 'card' }, h('div', { class: 'table-wrap' }, table)),
        h('h2', { class: 'group-title users-create-title' }, 'Новый пользователь'),
        h('div', { class: 'card' }, createUserForm(allSlugs))
      ));
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
