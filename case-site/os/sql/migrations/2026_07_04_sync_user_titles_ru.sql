-- Синхронизирует поле "должность" у уже созданных сотрудников, если оно ещё
-- содержит старое (англ./смешанное) значение по умолчанию. Персональные
-- должности, отличающиеся от стандартных, не трогает. Идемпотентно.
UPDATE app_users SET title = CASE title
  WHEN 'Founder / CEO' THEN 'Генеральный директор'
  WHEN 'Leasing Director' THEN 'Директор по аренде'
  WHEN 'Lease Admin (тыл)' THEN 'Администратор аренды (тыл)'
  WHEN 'Lease Admin' THEN 'Администратор аренды (тыл)'
  WHEN 'Advisory Manager' THEN 'Менеджер по консалтингу'
  WHEN 'CFO (финансовый директор)' THEN 'Финансовый директор'
  ELSE title END
WHERE title IN ('Founder / CEO','Leasing Director','Lease Admin (тыл)','Lease Admin','Advisory Manager','CFO (финансовый директор)');
