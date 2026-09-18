## graphify

This project has a knowledge graph at graphify-out/ with god nodes, community structure, and cross-file relationships.

Rules:
- For codebase questions, first run `graphify query "<question>"` when graphify-out/graph.json exists. Use `graphify path "<A>" "<B>"` for relationships and `graphify explain "<concept>"` for focused concepts. These return a scoped subgraph, usually much smaller than GRAPH_REPORT.md or raw grep output.
- If graphify-out/wiki/index.md exists, use it for broad navigation instead of raw source browsing.
- Read graphify-out/GRAPH_REPORT.md only for broad architecture review or when query/path/explain do not surface enough context.
- After modifying code, run `graphify update .` to keep the graph current (AST-only, no API cost).

## CASE Geo: стратегический бриф

Файл `docs/CASE_OS_REBUILD_BRIEF_v1.0.md` (владелец, 15.09.2026): решение по CASE Geo, модель данных
(три цепочки verified / asking / modelled, provenance на каждом числе, вакантность по юнитам, GBA и GLA
отдельно, SOATO как ключ районов), безопасность, правовые ограничения (Google Maps ToS: не использовать
Google для справочников и снимков в PDF; 2GIS и Яндекс не хранить), фазы. Новые модули геоаналитики
сверять с §5 и §6 брифа. Длинные тире в тексте заменены на короткие по правилу владельца.

## Данные Ташкента (v4.78.0)

Источники данных студии лежат в `docs/data/`: `tashkent_gis_dataset/` (пакет v1: слой
хокимията, ряды Toshstat, показатели города), `tashkent_gis_master/` (пакет v2: реестр Etirof с
кодами SOATO махалли, полигоны кадастра, SOATO районов, источники, недостающие данные),
`ngis/` (разбор геопортала open.ngis.uz), `tashkent_city_gis_research.md`. Рабочие файлы студии
собираются, а не правятся руками: `node docs/qa/tools/build_tashkent_data.js <v1> <v2>` пишет
`os/data/mahalla_registry_tashkent.json` и дополняет `os/data/demography_tashkent.json` (перед
пересборкой вернуть файл демографии к состоянию коммита), `node docs/qa/tools/ngis_to_studio.js
02_tashkent_mahallas.geojson` пишет `os/data/mahalla_boundaries.geojson`. Правила: каждое число с
источником и уверенностью (verified / asking / modelled), пустое значение не выдумывать, ключ
махалли только код (одноимённые махалли в разных районах не объединять), сырые выгрузки НГИС
(десятки МБ) в репозиторий не класть, только сводки. Длинных тире нигде не использовать.

