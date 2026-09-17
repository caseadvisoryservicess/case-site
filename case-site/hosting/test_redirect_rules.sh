#!/bin/bash
# Проверка правил переадресации настоящим Apache, а не чтением глазами.
#
# Файл .htaccess нельзя проверить рассуждением: каждое правило заканчивается [L],
# поэтому исход определяет ПОРЯДОК, а порядок при чтении сверху вниз кажется
# очевидным ровно до того момента, когда окажется неверным. Здесь поднимается
# локальный Apache с этим самым файлом, и по нему прогоняются реальные запросы.
#
# Проверяется не «сервер ответил», а четыре свойства, нарушение любого из которых
# уже ломало этот домен:
#   1. продление сертификата НЕ перехватывается переадресацией;
#   2. платформа /os остаётся на .uz;
#   3. остальной сайт уходит на .com с сохранением пути;
#   4. адрес собирается со слэшем, а не склеивается в caseadvisory.comos.
#
# Запуск: sudo bash test_redirect_rules.sh

set -u
HT="$(cd "$(dirname "$0")" && pwd)/caseadvisory.uz/.htaccess"
[ -f "$HT" ] || { echo "!! не найден $HT"; exit 1; }

ROOT=$(mktemp -d /tmp/htcheck.XXXX)
PORT=8731
# Состав ровно как на проде, по паспорту проекта.
LANDINGS="taxtapul galaba kibray-dc mercure-restaurant botanica"
mkdir -p "$ROOT/www/os" "$ROOT/www/admin" "$ROOT/www/lp/newlanding" \
         "$ROOT/www/.well-known/acme-challenge" "$ROOT/logs"
for d in $LANDINGS; do mkdir -p "$ROOT/www/$d/uz" "$ROOT/www/$d/en"; done
cp "$HT" "$ROOT/www/.htaccess"
echo 'ЛЕНДИНГ .uz' > "$ROOT/www/index.html"
echo 'ПЛАТФОРМА CASE OS' > "$ROOT/www/os/index.html"
echo 'контакты' > "$ROOT/www/contacts.html"
echo 'АДМИНКА' > "$ROOT/www/admin/index.html"
for d in $LANDINGS; do
  echo "ЛЕНДИНГ $d" > "$ROOT/www/$d/index.html"
  echo "$d uz" > "$ROOT/www/$d/uz/index.html"
  echo "$d en" > "$ROOT/www/$d/en/index.html"
done
echo 'БУДУЩИЙ ЛЕНДИНГ' > "$ROOT/www/lp/newlanding/index.html"
# Служебные файлы в корне: подтверждения прав уехав на .com перестают работать.
echo 'User-agent: *' > "$ROOT/www/robots.txt"
echo 'ok' > "$ROOT/www/yandex_1234567890abcdef.html"
echo 'ok' > "$ROOT/www/google1234567890abcdef.html"
# mktemp -d создаёт каталог с правами 0700 для root, а Apache работает от www-data:
# без этого КАЖДЫЙ запрос отдаёт 403, и проверки «нет переадресации» проходят
# по ложной причине.
chmod -R a+rX "$ROOT/www"
chmod a+x "$ROOT"

MODS=/usr/lib/apache2/modules
# Часть модулей вкомпилирована в бинарник, и повторная загрузка роняет старт с
# «is built-in and can't be loaded». Список встроенных отличается между сборками,
# поэтому спрашиваем его у самого Apache, а не перечисляем наугад.
BUILTIN=$(apache2 -l 2>/dev/null)
load() {
  echo "$BUILTIN" | grep -q "mod_$1\.c" && return 0
  [ -f "$MODS/mod_$1.so" ] && echo "LoadModule ${1}_module $MODS/mod_$1.so"
}
{
cat <<CONF
ServerName localhost
Listen 127.0.0.1:$PORT
PidFile $ROOT/httpd.pid
ErrorLog $ROOT/logs/error.log
CONF
load mpm_event
load authz_core
load dir
load mime
load rewrite
# mod_alias нужен для директив Redirect / RedirectMatch. Без него Apache падает с
# «Invalid command» и отдаёт 500 на КАЖДЫЙ запрос - а это выглядит как дефект
# проверяемого правила, хотя дефект в стенде.
load alias
load log_config
cat <<CONF
TypesConfig /etc/mime.types
# Apache отказывается работать от root; на хостинге он и так работает от www-data.
User www-data
Group www-data
DocumentRoot $ROOT/www
<Directory $ROOT/www>
    AllowOverride All
    Require all granted
</Directory>
CONF
} > "$ROOT/httpd.conf"

apache2 -f "$ROOT/httpd.conf" -k start 2>"$ROOT/logs/start.log" || {
  echo "!! Apache не стартовал:"; cat "$ROOT/logs/start.log"; exit 1; }
for _ in $(seq 1 40); do
  curl -s -o /dev/null -m 1 "http://127.0.0.1:$PORT/" && break
  sleep 0.25
done

bad=0
# Запрос идёт с заголовком Host, потому что последнее правило смотрит на HTTP_HOST:
# без него условие не совпадёт, и проверка окажется бессмысленной.
req() {
  curl -sS -m 5 -o /dev/null -D - -H "Host: $1" "http://127.0.0.1:$PORT$2" 2>/dev/null
}
code() { echo "$1" | awk 'NR==1{print $2}'; }
loc()  { echo "$1" | grep -i '^location:' | head -1 | cut -d' ' -f2- | tr -d '\r'; }

# Запрос «как по https»: локальный Apache слушает обычный порт, а правило подъёма
# до https смотрит на X-Forwarded-Proto - тем же способом, каким это делают прокси
# у хостеров. Так проверяется поведение защищённого соединения без сертификата.
reqs() {
  curl -sS -m 5 -o /dev/null -D - -H "Host: $1" -H "X-Forwarded-Proto: https" \
    "http://127.0.0.1:$PORT$2" 2>/dev/null
}

ck() {
  local name="$1" ok="$2" detail="${3:-}"
  if [ "$ok" = "1" ]; then echo "OK  $name${detail:+ - $detail}"
  else echo "!!  $name${detail:+ - $detail}"; bad=$((bad+1)); fi
}

echo "--- 1. Продление сертификата не перехватывается"
r=$(req caseadvisory.uz "/.well-known/acme-challenge/probe")
c=$(code "$r"); l=$(loc "$r")
ck "запрос Let's Encrypt остаётся на .uz" "$([ -z "$l" ] && echo 1 || echo 0)" \
   "${l:-без переадресации, код $c}"

echo
echo "--- 2. Платформа остаётся на .uz"
# Проверяем, что страница ОТДАЁТСЯ, а не просто «не перенаправляется»: 403 и 500
# тоже приходят без Location, и слабое условие зеленело бы на сломанном сервере.
for p in /os/ /os/index.html; do
  # по http: подъём до https на том же домене, но НИ В КОЕМ СЛУЧАЕ не на .com
  r=$(req caseadvisory.uz "$p"); l=$(loc "$r"); c=$(code "$r")
  ck "$p по http поднимается до https на .uz" \
     "$(echo "$l" | grep -q "^https://caseadvisory.uz$p$" && echo 1 || echo 0)" "код $c $l"
  # по https: страница отдаётся. 403 и 500 тоже приходят без Location, поэтому
  # проверяем именно 200, а не отсутствие переадресации.
  r=$(reqs caseadvisory.uz "$p"); l=$(loc "$r"); c=$(code "$r")
  ck "$p по https отдаётся платформой" \
     "$([ -z "$l" ] && [ "$c" = "200" ] && echo 1 || echo 0)" "код $c ${l:-без Location}"
done
# /os без слэша: mod_dir сам добавляет слэш - это 301 на тот же домен, и это норма.
r=$(req caseadvisory.uz "/os"); l=$(loc "$r"); c=$(code "$r")
ck "/os без слэша остаётся на .uz" \
   "$(echo "$l" | grep -qv 'caseadvisory\.com' && echo 1 || echo 0)" "код $c $l"

echo
echo "--- 2b. Админка и лендинги тоже остаются на .uz"
# Ровно та ошибка, из-за которой лендинг перестал открываться: список исключений
# знал про /os и /admin, а про takhtapul нет.
# Все пять лендингов и обе их языковые версии.
for d in $LANDINGS; do
  for p in "/$d/" "/$d/uz/" "/$d/en/"; do
    r=$(reqs caseadvisory.uz "$p"); l=$(loc "$r"); c=$(code "$r")
    ck "$p отдаётся с .uz" "$([ -z "$l" ] && [ "$c" = "200" ] && echo 1 || echo 0)" \
       "код $c ${l:-без Location}"
  done
done
for p in /admin/ /lp/newlanding/; do
  r=$(reqs caseadvisory.uz "$p"); l=$(loc "$r"); c=$(code "$r")
  ck "$p отдаётся с .uz" "$([ -z "$l" ] && [ "$c" = "200" ] && echo 1 || echo 0)" \
     "код $c ${l:-без Location}"
done
# Регистр: правило обязано НЕ уводить на .com. Отдаст ли сервер страницу - вопрос
# файловой системы, а не правила: в Linux Taxtapul и taxtapul разные папки,
# поэтому здесь корректно ждать 404 с .uz, а не 200.
r=$(reqs caseadvisory.uz "/Taxtapul/"); l=$(loc "$r"); c=$(code "$r")
ck "/Taxtapul/ с большой буквы не уводится на .com" \
   "$([ -z "$l" ] && echo 1 || echo 0)" "код $c ${l:-без Location}"

echo
echo "--- 2c. Служебные файлы в корне остаются на .uz"
# Подтверждение прав на домен, уехавшее на .com, перестаёт что-либо подтверждать.
for p in /robots.txt /yandex_1234567890abcdef.html /google1234567890abcdef.html; do
  r=$(reqs caseadvisory.uz "$p"); l=$(loc "$r"); c=$(code "$r")
  ck "$p отдаётся с .uz" "$([ -z "$l" ] && [ "$c" = "200" ] && echo 1 || echo 0)" \
     "код $c ${l:-без Location}"
done

echo
echo "--- 2d. Старые адреса доводят до нового, а не на .com"
r=$(reqs caseadvisory.uz "/restaurant"); l=$(loc "$r")
ck "/restaurant -> /mercure-restaurant/ на .uz" \
   "$(echo "$l" | grep -q '^https\?://caseadvisory.uz/mercure-restaurant/$' && echo 1 || echo 0)" "$l"
# Слаг из панели: takhtapul через kh. Раньше такая ссылка уезжала на .com.
r=$(reqs caseadvisory.uz "/takhtapul/"); l=$(loc "$r")
ck "/takhtapul/ (слаг панели) -> /taxtapul/ на .uz" \
   "$(echo "$l" | grep -q '^https\?://caseadvisory.uz/taxtapul/$' && echo 1 || echo 0)" "$l"
r=$(reqs caseadvisory.uz "/taktapul/uz/"); l=$(loc "$r")
ck "/taktapul/uz/ -> /taxtapul/uz/ с сохранением языка" \
   "$(echo "$l" | grep -q '^https\?://caseadvisory.uz/taxtapul/uz/$' && echo 1 || echo 0)" "$l"
# Похожее имя не должно попадать в исключение по случайному совпадению начала строки.
r=$(reqs caseadvisory.uz "/takhtapul-old"); l=$(loc "$r")
ck "похожий путь takhtapul-old всё же уходит на .com" \
   "$([ "$l" = "https://caseadvisory.com/takhtapul-old" ] && echo 1 || echo 0)" "$l"

echo
echo "--- 3. Остальной сайт уходит на .com с сохранением пути"
r=$(req caseadvisory.uz "/"); c=$(code "$r"); l=$(loc "$r")
ck "корень -> .com" "$([ "$l" = "https://caseadvisory.com/" ] && echo 1 || echo 0)" "$c $l"
r=$(req caseadvisory.uz "/contacts.html"); l=$(loc "$r")
ck "путь сохраняется" "$([ "$l" = "https://caseadvisory.com/contacts.html" ] && echo 1 || echo 0)" "$l"
r=$(req caseadvisory.uz "/contacts.html?utm=mail"); l=$(loc "$r")
ck "строка запроса сохраняется" "$(echo "$l" | grep -q 'utm=mail' && echo 1 || echo 0)" "$l"
r=$(req www.caseadvisory.uz "/"); l=$(loc "$r")
ck "www тоже уходит" "$([ "$l" = "https://caseadvisory.com/" ] && echo 1 || echo 0)" "$l"

echo
echo "--- 4. Адрес не склеивается (та самая прежняя ошибка)"
r=$(req caseadvisory.uz "/os-catalog"); l=$(loc "$r")
ck "нет склейки вида caseadvisory.comos" \
   "$([ -n "$l" ] && ! echo "$l" | grep -q 'caseadvisory\.com[a-z]' && echo 1 || echo 0)" "$l"
ck "похожий путь os-catalog НЕ считается платформой" \
   "$(echo "$l" | grep -q '^https://caseadvisory.com/os-catalog$' && echo 1 || echo 0)" "$l"

echo
echo "--- 5. Временная переадресация, а не постоянная"
r=$(req caseadvisory.uz "/"); c=$(code "$r")
ck "код 302, пока не проверено вручную" "$([ "$c" = "302" ] && echo 1 || echo 0)" "код $c"

apache2 -f "$ROOT/httpd.conf" -k stop 2>/dev/null
sleep 0.5; rm -rf "$ROOT"
echo
[ "$bad" = "0" ] && echo "Правила переадресации ведут себя как задумано" \
                 || echo "ПРОВАЛЕНО проверок: $bad"
exit "$bad"
