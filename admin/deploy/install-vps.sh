#!/usr/bin/env bash
# Установка панели на чистый Ubuntu VPS (20.04+). Запускать от root ИЗ ПАПКИ admin:
#   cd case-site/admin && bash deploy/install-vps.sh
set -euo pipefail

APP_DIR="$(pwd)"
if [ ! -f "$APP_DIR/server.js" ]; then
  echo "Запустите скрипт из папки admin (там, где server.js)"; exit 1
fi

echo "── 1/4 Node.js 22 ──"
if ! command -v node >/dev/null || [ "$(node -v | cut -c2-3)" -lt 18 ]; then
  curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
  apt-get install -y nodejs
fi
node -v

echo "── 2/4 Зависимости ──"
npm ci --omit=dev

echo "── 3/4 Служба systemd (автозапуск и перезапуск при сбое) ──"
cat > /etc/systemd/system/sfb-panel.service <<EOF
[Unit]
Description=SFB landing admin panel
After=network.target

[Service]
WorkingDirectory=$APP_DIR
ExecStart=$(command -v node) $APP_DIR/server.js
Restart=always
RestartSec=3
Environment=PORT=3000
# Environment=ADMIN_PASSWORD=постоянный-пароль-для-первого-запуска

[Install]
WantedBy=multi-user.target
EOF
systemctl daemon-reload
systemctl enable --now sfb-panel
sleep 1
systemctl --no-pager status sfb-panel | head -5

echo "── 4/4 Готово ──"
echo "Панель:   http://$(hostname -I | awk '{print $1}'):3000"
echo "Дальше:   поставьте nginx + HTTPS (см. deploy/nginx.conf.example и DEPLOY.md)"
