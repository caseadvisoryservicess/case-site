-- Добавляет столбец projects в таблицу пользователей — список id объектов
-- (JSON-массив), доступных внешнему агенту. Пусто/NULL = доступа нет.
ALTER TABLE app_users ADD COLUMN projects TEXT;
