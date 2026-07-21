-- CFO: полный доступ по всем разделам (как у генерального директора).
-- Клиент делает то же сам при первом входе после обновления (v2.38);
-- эта миграция — для порядка в БД. Идемпотентно.
UPDATE roles SET leasing=1, finance=1, edit=1, approve=1, plans=1, own_only=0, project_scope=0, admin=1
WHERE `key`='CFO';
