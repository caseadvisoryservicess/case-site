#!/bin/bash
# Заголовки безопасности платформы: проверка настоящим Apache, а не чтением файла.
#
# В v4.70.3 в os/.htaccess две правки, и обе такого рода, что глазами их не проверить:
#
#   1. С HSTS снято условие env=HTTPS. Оно завязывало заголовок на ту же переменную,
#      что и флаг Secure у cookie, поэтому за прокси обе защиты пропадали одновременно.
#      Убедиться, что заголовок теперь выдаётся всегда, можно только запросом.
#   2. В script-src добавлен api-maps.yandex.ru. Директива CSP - одна строка на 700
#      символов; ошибка в ней не роняет сервер, а тихо режет загрузку карт, и выглядит
#      это как «неверный API-ключ». Ровно так дефект и прожил незамеченным.
#
# Проверяется и то, что правка не задела соседние директивы: дампы базы должны
# оставаться закрытыми, а script-src - не превратиться в разрешение «любой https».
#
# Запуск: sudo bash v4703_os_headers.sh [папка os]

set -u
OSDIR="${1:-$(cd "$(dirname "$0")/../../.." && pwd)/os}"
HT="$OSDIR/.htaccess"
[ -f "$HT" ] || { echo "!! не найден $HT"; exit 1; }

ROOT=$(mktemp -d /tmp/oshdr.XXXX)
PORT=8741
mkdir -p "$ROOT/www/os/sql/backups" "$ROOT/www/os/listing" "$ROOT/logs"
cp "$HT" "$ROOT/www/os/.htaccess"
echo 'ПЛАТФОРМА' > "$ROOT/www/os/index.html"
echo 'код' > "$ROOT/www/os/core.js"
# Файлы, которые обязаны быть недоступны по прямой ссылке.
echo 'дамп' > "$ROOT/www/os/sql/backups/case_os_20250101_030000.sql.gz"
echo 'схема' > "$ROOT/www/os/sql/schema.sql"
echo 'лог' > "$ROOT/www/os/debug.log"
echo 'секреты' > "$ROOT/www/os/.env"
echo 'страница' > "$ROOT/www/os/listing/page.html"
# Каталог ВНЕ /os, то есть вне действия проверяемого .htaccess. Он нужен как контроль:
# если список файлов не выдаётся и здесь, значит выдача отключена сервером стенда, а не
# директивой платформы, и проверка ниже ничего не доказывает.
mkdir -p "$ROOT/www/open"
echo 'вне зоны действия' > "$ROOT/www/open/file.txt"
# mktemp -d даёт 0700 для root, а Apache работает от www-data: без этого каждый
# запрос вернул бы 403 и проверки «доступ закрыт» прошли бы по ложной причине.
chmod -R a+rX "$ROOT/www"
chmod a+x "$ROOT"

MODS=/usr/lib/apache2/modules
# Часть модулей вкомпилирована в бинарник, и повторная загрузка роняет старт.
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
load headers
# mod_autoindex обязателен, хотя проверяется его ЗАПРЕТ: без модуля каталог без
# index.html отдаёт 404, и проверка «список файлов не выдаётся» прошла бы, даже
# если снять Options -Indexes. То есть зеленела бы по ложной причине.
load autoindex
# mod_filter нужен для AddOutputFilterByType: без него mod_deflate есть, а директива
# не принимается, и Apache падает на старте с «Invalid command».
load filter
load deflate
load expires
load log_config
cat <<CONF
TypesConfig /etc/mime.types
User www-data
Group www-data
DocumentRoot $ROOT/www
<Directory $ROOT/www>
    AllowOverride All
    Require all granted
    # Выдача списка файлов включена НАМЕРЕННО: на типовом хостинге cPanel она включена
    # по умолчанию, ради чего Options -Indexes в .htaccess и написан. Без этой строки
    # список не выдавался бы и так, и проверка запрета ничего бы не значила.
    Options +Indexes
</Directory>
CONF
} > "$ROOT/httpd.conf"

apache2 -f "$ROOT/httpd.conf" -k start 2>"$ROOT/logs/start.log" || {
  echo "!! Apache не стартовал (значит .htaccess содержит недопустимую директиву):"
  cat "$ROOT/logs/start.log"; exit 1; }
for _ in $(seq 1 40); do
  curl -s -o /dev/null -m 1 "http://127.0.0.1:$PORT/os/" && break
  sleep 0.25
done

bad=0
ck() {
  local name="$1" ok="$2" detail="${3:-}"
  if [ "$ok" = "1" ]; then echo "OK  $name${detail:+ - $detail}"
  else echo "!!  $name${detail:+ - $detail}"; bad=$((bad+1)); fi
}
req()  { curl -sS -m 5 -o /dev/null -D - "http://127.0.0.1:$PORT$1" 2>/dev/null; }
# Запрос «как из-за прокси»: локальный стенд слушает http, а на хостинге TLS
# терминируется раньше Apache. Так проверяется поведение защищённого соединения
# без сертификата - тем же способом, каким это делает прокси.
reqs() { curl -sS -m 5 -o /dev/null -D - -H "X-Forwarded-Proto: https" \
           "http://127.0.0.1:$PORT$1" 2>/dev/null; }
code() { echo "$1" | awk 'NR==1{print $2}'; }
hdr()  { echo "$1" | grep -i "^$2:" | head -1 | cut -d' ' -f2- | tr -d '\r'; }
cnt()  { echo "$1" | grep -ci "^$2:"; }

echo "--- 1. HSTS выдаётся независимо от того, видит ли Apache TLS"
# Ради этого правка и делалась: раньше за прокси заголовка не было вовсе.
for p in "/os/" "/os/core.js"; do
  r=$(req "$p")
  ck "$p по http: заголовок есть" \
     "$(hdr "$r" 'Strict-Transport-Security' | grep -q 'max-age=31536000' && echo 1 || echo 0)" \
     "$(hdr "$r" 'Strict-Transport-Security')"
  r=$(reqs "$p")
  ck "$p за прокси с TLS: заголовок есть" \
     "$(hdr "$r" 'Strict-Transport-Security' | grep -q 'max-age=31536000' && echo 1 || echo 0)" \
     "$(hdr "$r" 'Strict-Transport-Security')"
done
# always, а не set: на ответах об ошибке обычный Header не срабатывает, а именно
# на них браузер чаще всего и попадает при подмене соединения.
r=$(req "/os/нет-такой-страницы")
h=$(hdr "$r" 'Strict-Transport-Security')
ck "на ответе 404 заголовок тоже есть (директива always)" \
   "$(echo "$h" | grep -q 'max-age' && echo 1 || echo 0)" \
   "код $(code "$r") ${h:-нет заголовка}"
# Соседние поддомены хостинга не наши: includeSubDomains заблокировал бы и их,
# а preload - необратимо и на уровне браузера.
r=$(req "/os/")
ck "без includeSubDomains и preload" \
   "$(hdr "$r" 'Strict-Transport-Security' | grep -qiE 'includeSubDomains|preload' && echo 0 || echo 1)" \
   "$(hdr "$r" 'Strict-Transport-Security')"
ck "заголовок выдаётся один раз, а не дублируется" \
   "$([ "$(cnt "$r" 'Strict-Transport-Security')" = "1" ] && echo 1 || echo 0)" \
   "экземпляров: $(cnt "$r" 'Strict-Transport-Security')"

echo
echo "--- 2. CSP пропускает ровно те источники, которые платформа грузит сама"
r=$(req "/os/"); CSP=$(hdr "$r" 'Content-Security-Policy')
SCRIPTSRC=$(echo "$CSP" | tr ';' '\n' | grep -i 'script-src')
ck "Яндекс.Карты разрешены в script-src" \
   "$(echo "$SCRIPTSRC" | grep -q 'https://api-maps.yandex.ru' && echo 1 || echo 0)" "$SCRIPTSRC"
ck "jsDelivr не потерян (выгрузка в PPTX)" \
   "$(echo "$SCRIPTSRC" | grep -q 'https://cdn.jsdelivr.net' && echo 1 || echo 0)"
# Соблазн при отладке - вписать в script-src просто https:. Это снимает защиту
# целиком: любой домен становится источником скриптов.
ck "script-src НЕ разрешает любой https" \
   "$(echo "$SCRIPTSRC" | grep -qE "(^|[ '])https:( |$)" && echo 0 || echo 1)" "$SCRIPTSRC"
for d in "default-src 'self'" "base-uri 'self'" "form-action 'self'" "frame-ancestors 'self'" "object-src"; do
  ck "директива на месте: $d" "$(echo "$CSP" | grep -q "$d" && echo 1 || echo 0)"
done
ck "политика выдаётся один раз" \
   "$([ "$(cnt "$r" 'Content-Security-Policy')" = "1" ] && echo 1 || echo 0)" \
   "экземпляров: $(cnt "$r" 'Content-Security-Policy')"

echo
echo "--- 3. Остальные заголовки правка не задела"
ck "X-Content-Type-Options: nosniff" "$([ "$(hdr "$r" 'X-Content-Type-Options')" = "nosniff" ] && echo 1 || echo 0)"
ck "X-Frame-Options: SAMEORIGIN"     "$([ "$(hdr "$r" 'X-Frame-Options')" = "SAMEORIGIN" ] && echo 1 || echo 0)"
ck "Referrer-Policy: same-origin"    "$([ "$(hdr "$r" 'Referrer-Policy')" = "same-origin" ] && echo 1 || echo 0)"
ck "Permissions-Policy закрывает гео, микрофон и камеру" \
   "$(hdr "$r" 'Permissions-Policy' | grep -q 'geolocation=()' && echo 1 || echo 0)" \
   "$(hdr "$r" 'Permissions-Policy')"

echo
echo "--- 4. Дампы базы и служебные файлы по прямой ссылке не отдаются"
# Имена копий предсказуемы с точностью до секунды, так что «никто не угадает» - не довод.
for p in /os/sql/backups/case_os_20250101_030000.sql.gz /os/sql/schema.sql /os/debug.log /os/.env; do
  c=$(code "$(req "$p")")
  ck "$p закрыт" "$([ "$c" = "403" ] && echo 1 || echo 0)" "код $c"
done
c=$(code "$(req "/os/listing/")")
ck "список файлов в папке не выдаётся (Options -Indexes)" \
   "$([ "$c" = "403" ] && echo 1 || echo 0)" "код $c"
# Контроль осмысленности предыдущей проверки: за пределами /os список обязан выдаваться.
c=$(code "$(req "/open/")")
ck "контроль: вне /os выдача списка работает, значит 403 выше - от директивы" \
   "$([ "$c" = "200" ] && echo 1 || echo 0)" "код $c"

echo
echo "--- 5. Обычные файлы платформы при этом отдаются"
# Без этой проверки весь раздел 4 зеленел бы и на полностью сломанном сервере.
for p in /os/ /os/core.js /os/listing/page.html; do
  c=$(code "$(req "$p")")
  ck "$p отдаётся" "$([ "$c" = "200" ] && echo 1 || echo 0)" "код $c"
done

apache2 -f "$ROOT/httpd.conf" -k stop 2>/dev/null
sleep 0.5
rm -rf "$ROOT"

echo
if [ "$bad" = "0" ]; then echo "Заголовки платформы выставляются верно"; exit 0
else echo "ПРОВАЛЕНО проверок: $bad"; exit 1; fi
