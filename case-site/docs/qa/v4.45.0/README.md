# CASE OS v4.45.0 - материалы проверки

- `v4450_regression.json` - основной браузерный регрессионный прогон.
- `v4450_route_sweep.json` - 252 сочетания роль/экран для 10 ролей.
- `v4450_accessibility.json` - focus, labels, scroll regions, reduced motion, mobile touch targets и toast.
- `owner_report_all_projects.json` - отчёт владельцу по четырём объектам.
- `v4450_server_role_matrix.json` - серверная матрица рабочих областей.
- `roles_security_audit_v4450.json` - статический аудит ролевой безопасности.
- `v4450_static_validation.json` - JS, PHP, JSON/GeoJSON, HTML references и Service Worker.
- `v4450_functional_file_diff.json` - точная дельта production-функциональности без документации.
- `v4450_code_file_diff.json` - дельта папки `os` без самих generated diff-файлов.
- `v4450_package_file_diff.json` - дельта полного пакета без двух generated diff-файлов.

Ограничение: браузерный прогон выполнен на self-contained production bundle через Chrome DevTools Protocol. Реальные PHP/MySQL-сессии, внешние карты/CDN и фактическое скачивание PDF/PPTX/CSV должны быть подтверждены на staging по приложенному checklist.
