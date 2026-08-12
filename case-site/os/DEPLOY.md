# CASE OS v4.61.0 - краткая установка

Что вошло в релиз: `CHANGELOG_CASE_OS_v4.61.0.md` в корне пакета.
Базовая инструкция по установке и правам: `CASE_OS_v4.51.0_DEPLOY_RU.md` (порядок действий с тех пор не менялся).

1. Замените всё содержимое папки `/os` содержимым архива.
2. Ctrl+Shift+R. В шапке `v4.61.0`.

Изменены `v4600-sun-wind.js` (новый), `api/gis_proxy.php`, `index.html`, `core.js`, `sw.js`, `v4450-ux-system.js`, `v4451-live-sync.js`,
`v420-geo-studio.js`, `v4530-geo-export.js`, `v4327-patch.js`, `v490-workflow.js`,
`v493-portfolio-suite.js`, `geoanalytics-studio.html`, `feasibility-studio.html`,
`mep-studio.html`, `lift-studio.html`.
Миграций базы нет. Включает v4.52.0-v4.60.0.

Проверка после заливки: в консоли браузера должно быть `CASE OS: все модули версии 4.61.0`,
а при открытой гео-студии - `CASE OS: модули гео-студии актуальны`. Если вместо этого
появилось предупреждение с именами файлов, залита не вся папка `/os`.

Целостность: `sha256sum -c SHA256SUMS_v4.61.0.txt` из папки `/os`.
Файлы `api/config.php` и `api/config.local*.php` в архив не входят - они ваши,
их не перезаписывают.
