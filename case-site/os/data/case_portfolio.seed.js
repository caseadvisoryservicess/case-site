/* CASE Portfolio seed emptied in v4.11.0 by request - projects added manually via UI.

   v4.65.0: массив снова не пустой, и это осознанно. Механизм дозаливки в
   v493-portfolio-suite.js добавляет отсюда только те проекты, которых в установке ещё нет,
   а у существующих заполняет ИСКЛЮЧИТЕЛЬНО пустые поля - введённое руками он не трогает.
   Поэтому запись здесь безопасна: она доедет до уже работающих установок, где массив
   проектов давно не пуст (SEED в v492 срабатывает только на пустом состоянии), и не
   затрёт то, что команда потом заполнит в интерфейсе.

   Координата помечена как ручная (coordinateAccuracy: exact_manual, verification: verified).
   Это не украшательство: migrate() перезаписывает координаты из своей таблицы COORDS у всех
   записей, КРОМЕ помеченных ручными. Без этой пометки точный адрес однажды заменился бы
   центроидом города. */
window.CASE_PORTFOLIO_SEED_V493 = [
  {
    "id": "portfolio-096",
    "sourceId": 96,
    "name": "Uchtepa Park",
    "country": "Uzbekistan",
    "city": "Tashkent",
    "category": "",
    "type": "",
    "investor": "",
    "architect": "",
    "gba": null,
    "gla": null,
    "openingYear": null,
    "scope": [],
    "businessLines": [
      "Advisory"
    ],
    "note": "Новый проект. Подтверждена только координата - передана владельцем вручную, попадает в район Учтепа. Категория, тип, площади, инвестор, архитектор и год открытия не заполнены.",
    "lat": 41.29667581538922,
    "lng": 69.17693062226368,
    "coordinateAccuracy": "exact_manual",
    "verification": "verified",
    "source": "Указано владельцем",
    "sourceDate": "2026-08-13",
    "inferredLocation": false,
    "portfolio": true,
    "status": "pipeline",
    "coordinateSource": "Координата задана вручную владельцем проекта",
    "geocodeMethod": "manual",
    "dataVersion": "4.9.3",
    "verifiedAt": "2026-08-13",
    "verifiedBy": ""
  }
];
