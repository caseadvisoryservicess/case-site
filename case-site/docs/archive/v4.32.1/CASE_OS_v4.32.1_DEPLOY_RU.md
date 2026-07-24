# CASE OS v4.32.3 — установка и обновление

## Перед началом

1. Сделайте backup MySQL.
2. Сохраните текущую папку `/os`.
3. Отдельно сохраните рабочий `os/api/config.php`.
4. Разверните v4.32.3 сначала на staging.

## Обновление

1. Замените папку `/os` содержимым новой сборки.
2. Верните действующий `os/api/config.php`, если он не хранится вне web-root.
3. Не копируйте старую папку `api` поверх новой: в v4.32.3 добавлены:
   - `api/unit_patch.php`;
   - `api/units_batch.php`;
   - обновлённые `state.php`, `data.php`, `brand_requests.php`, `investor_requests.php`.
4. Войдите как администратор и запустите `os/api/migrate.php`.
5. Убедитесь, что применена миграция `2026_07_23_v4322_agx_lockdown.sql`.
6. Очистите старый Service Worker/cache и выполните hard refresh.
7. Проверьте версию `v4.32.3` и cache key `case-os-v4323`.
8. Пройдите `CASE_OS_v4.32.3_STAGING_ACCEPTANCE_CHECKLIST_RU.md`.

## Откат

1. Остановите работу пользователей.
2. Верните прежнюю папку `/os`.
3. При необходимости восстановите MySQL backup.
4. Очистите Service Worker/cache.

Изменение прав AGX обратимо через матрицу ролей, но до выхода v4.33.0 не рекомендуется возвращать AGX generic edit/leasing rights: серверные moderated endpoints v4.32.3 рассчитаны на закрытый режим.
