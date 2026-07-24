# CASE OS v4.33.0 — краткая установка

Полная инструкция находится в корне пакета: `CASE_OS_v4.33.0_DEPLOY_RU.md`.
Новых SQL-миграций нет. После загрузки выполните hard reload.

1. Замените содержимое папки `/os` содержимым архива `CASE_OS_v4.33.0_os_only.zip`.
2. Проверьте: `index.html` загружает `v417-master-plan.js?v=4.33.0`, в `sw.js` cache key `case-os-v4330`.
3. Откройте `https://caseadvisory.uz/os/`, hard reload, убедитесь в номере `v4.33.0` в шапке.
