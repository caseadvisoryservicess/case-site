# Установка и запуск панели — инструкция

Панель — это Node.js-приложение. Лендинги, которые она собирает, — обычные
статичные сайты. Ниже три способа запуска: выберите один.

> Во всех вариантах при первом запуске создаётся пользователь **admin**.
> Пароль — тот, что вы укажете в `ADMIN_PASSWORD`, иначе `admin`.
> **Сразу после входа смените пароль**: Пользователи → Сменить пароль.

---

## Вариант 0. Попробовать на своём компьютере (5 минут)

1. Установите Node.js: https://nodejs.org (кнопка LTS, «далее-далее»).
2. Скачайте репозиторий: GitHub → зелёная кнопка **Code → Download ZIP** → распакуйте.
3. Откройте терминал (Windows: в папке `admin` — правый клик → «Открыть в терминале»):
   ```
   cd admin
   npm install
   node server.js
   ```
4. Откройте в браузере **http://localhost:3000** — логин `admin`, пароль `admin`.

Этого достаточно, чтобы посмотреть панель и собрать лендинг. Для работы
команды агентов нужен постоянный сервер — варианты ниже.

---

## Вариант А. Render.com — самый простой (≈10 минут, ~$7–8/мес)

В репозитории уже лежит готовый конфиг `render.yaml` — Render всё сделает сам.

1. Зарегистрируйтесь на https://render.com (можно через GitHub-аккаунт).
2. Нажмите **New + → Blueprint** → подключите репозиторий
   `caseadvisoryservicess/case-site`.
3. Render найдёт `render.yaml` и покажет сервис **sfb-panel**. При создании
   спросит `ADMIN_PASSWORD` — придумайте и сохраните пароль администратора.
4. Нажмите **Apply**. Через 2–3 минуты панель будет доступна по адресу вида
   `https://sfb-panel.onrender.com` (HTTPS уже включён).
5. Свой домен: Settings → Custom Domains → добавьте, например,
   `panel.вашдомен.uz` и пропишите у регистратора CNAME, который покажет Render.

Данные (проекты, фото, пользователи) живут на подключённом диске и
переживают перезапуски и обновления. Лендинги доступны по
`https://…/p/takhtapul/`.

## Вариант Б. VPS — свой сервер (~$5/мес, полный контроль)

Подойдёт любой VPS с Ubuntu 22+ (Timeweb, Beget, ahost.uz, DigitalOcean…).

```bash
ssh root@IP-сервера
apt update && apt install -y git
git clone https://github.com/caseadvisoryservicess/case-site.git /opt/case-site
cd /opt/case-site/admin
bash deploy/install-vps.sh        # Node, зависимости, автозапуск systemd
```

Панель поднимется на `http://IP-сервера:3000`. Дальше домен и HTTPS:

```bash
apt install -y nginx certbot python3-certbot-nginx
cp deploy/nginx.conf.example /etc/nginx/sites-available/sfb-panel
nano /etc/nginx/sites-available/sfb-panel     # впишите свои домены
ln -s /etc/nginx/sites-available/sfb-panel /etc/nginx/sites-enabled/
nginx -t && systemctl reload nginx
certbot --nginx                                # бесплатный HTTPS
```

В `deploy/nginx.conf.example` уже показано, как отдать лендинг Тахтапула
на отдельном домене (`sfb.вашдомен.uz`) напрямую как статику.

Обновление панели: `cd /opt/case-site && git pull && cd admin && npm ci --omit=dev && systemctl restart sfb-panel`.

## Вариант В. Docker (если хостинг работает с контейнерами)

```bash
cd admin
ADMIN_PASSWORD=ваш-пароль docker compose up -d --build
```

Панель — на порту 3000, данные — в именованных томах `panel-data`/`panel-sites`.

---

## После запуска: чек-лист

1. Войти `admin` → **сменить пароль**.
2. Создать агентов: Пользователи → логин/пароль, роль «Агент», отметить их проекты.
3. Открыть проект Тахтапул → вкладка **SEO** → вписать домен лендинга,
   коды подтверждения Google Search Console и Яндекс Вебмастера → «Сохранить и собрать».
4. Добавить сайт в поисковики:
   - Google: https://search.google.com/search-console → «Добавить ресурс» →
     подтверждение мета-тегом (код уже на странице) → отправить `sitemap.xml`;
   - Яндекс: https://webmaster.yandex.ru → «Добавить сайт» → мета-тег →
     Индексирование → Файлы Sitemap → добавить `https://домен/sitemap.xml`.
5. Проверить форму заявки: первое письмо от FormSubmit попросит одноразовое
   подтверждение почты. URL Google-таблицы для CRM вписывается на вкладке
   «Основное» (см. `../takhtapul/crm-apps-script.gs`).

## Бэкапы

Вся ценность — в папке `admin/data/` (конфиги, фото, пользователи).
Копируйте её целиком; собранные сайты (`admin/sites/`) панель пересоздаёт сама.
