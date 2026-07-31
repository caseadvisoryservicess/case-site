/* v4.50.6: границы районов Ташкента должны браться из локального файла, без интернета.

   До этого `ensureGeo()` в geoanalytics-studio.html пробовал по очереди:
     1) data/tashkent_districts.geojson  — локально, но файла НЕ БЫЛО;
     2) cdn.jsdelivr.net/gh/akbartus/GeoJSON-Uzbekistan…;
     3) raw.githubusercontent.com/…
   То есть слой районов работал только при доступе к GitHub, а при неудаче молча
   пропускался — в консоль писалось «границы районов города недоступны». Для Узбекистана,
   где часть внешних сервисов отдаёт ответ через раз, это означало слой-невидимку.

   Тест режет ВЕСЬ внешний трафик и проверяет, что районы всё равно отрисовались.

   Запуск: node v4506_districts_local.js [папка os] */
const { chromium } = require('playwright-core');
const { createMockServer } = require('./mock_backend.js');

const OS = process.argv[2] || '/home/user/case-site/case-site/os';
const CHROME = process.env.CASE_CHROME || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const EXPECTED = ['Olmazor', 'Yunusabad', 'Shaykhantakhur', 'Mirzo-Ulugbek', 'Yashnabad', 'Uchtepa',
                  'Chilanzar', 'Yangihayot', 'Sergeli', 'Mirabad', 'Yakkasaray', 'Bektemir'];

let failed = 0;
function check(name, cond, detail) {
  console.log((cond ? 'OK  ' : '!!  ') + name + (detail === undefined ? '' : ' — ' + detail));
  if (!cond) failed++;
}

(async () => {
  const { srv, base } = await createMockServer(OS, {});
  const b = await chromium.launch({ executablePath: CHROME, args: ['--no-sandbox', '--no-proxy-server'] });
  const pg = await b.newPage({ viewport: { width: 1400, height: 900 } });
  const errs = [];
  pg.on('pageerror', e => errs.push(e.message));

  /* Всё, что не наш сервер, — обрываем. Если слой отрисуется, значит взят локальный файл. */
  const external = [];
  await pg.route('**/*', route => {
    const u = route.request().url();
    if (u.startsWith(base) || u.startsWith('data:') || u.startsWith('blob:')) return route.continue();
    external.push(u);
    return route.abort();
  });

  await pg.goto(base + '/geoanalytics-studio.html', { waitUntil: 'domcontentloaded' });
  await pg.waitForTimeout(4000);

  const real = errs.filter(e => !/Failed to fetch|net::|NetworkError|Load failed/i.test(e));
  check('студия открылась без ошибок сценария', real.length === 0, real[0] || 'ошибок нет');

  /* Включаем слой районов и ждём отрисовку */
  const drew = await pg.evaluate(async () => {
    const cb = document.getElementById('lDist');
    if (!cb) return { err: 'нет переключателя районов' };
    cb.checked = true;
    cb.dispatchEvent(new Event('change', { bubbles: true }));
    /* DISTGEO/gDist объявлены через let — свойствами window они НЕ становятся,
       обращаемся по имени напрямую из области видимости страницы. */
    for (let i = 0; i < 40; i++) {
      try { if (DISTGEO && DISTGEO.features && DISTGEO.features.length) break; } catch (_) {}
      await new Promise(r => setTimeout(r, 250));
    }
    /* Данные приходят раньше отрисовки: renderDist вызывается следом за ensureGeo.
       Ждём именно слои, иначе проверка читает пустую группу и ложно падает. */
    for (let i = 0; i < 40; i++) {
      try { if (gDist && gDist.getLayers && gDist.getLayers().length) break; } catch (_) {}
      await new Promise(r => setTimeout(r, 250));
    }
    let g = null; try { g = DISTGEO; } catch (_) {}
    return {
      features: g && g.features ? g.features.length : 0,
      names: g && g.features ? g.features.map(f => f.properties && (f.properties.name || f.properties.tuman)) : [],
      layers: (function(){ try { return (gDist && gDist.getLayers) ? gDist.getLayers().length : -1; } catch (_) { return -1; } })()
    };
  });
  check('районы загрузились из локального файла', drew.features === 12,
    'получено ' + drew.features + (drew.err ? ' (' + drew.err + ')' : ''));
  check('слой отрисован на карте', drew.layers > 0, 'слоёв: ' + drew.layers);

  /* Каждый район должен опознаться таблицей синонимов — иначе не будет подписи и статистики */
  const matched = await pg.evaluate(exp => {
    if (typeof matchD !== 'function') return { err: 'matchD недоступна' };
    let fc = null; try { fc = DISTGEO; } catch (_) {}
    if (!fc || !fc.features) return { err: 'DISTGEO пуст' };
    const got = fc.features.map(f => matchD(f.properties)).filter(Boolean);
    return { got, missing: exp.filter(x => got.indexOf(x) < 0) };
  }, EXPECTED);
  check('все 12 районов опознаны гео-модулем',
    matched.got && matched.got.length === 12 && matched.missing.length === 0,
    matched.err || (matched.missing.length ? 'не опознаны: ' + matched.missing.join(', ') : 'все 12'));

  /* Ни один внешний адрес не должен был помочь — проверяем, что мы их действительно резали */
  const github = external.filter(u => /githubusercontent|jsdelivr/i.test(u));
  check('внешние источники были недоступны', true,
    github.length ? 'попыток к GitHub: ' + github.length + ' (все оборваны)' : 'к GitHub не обращались');

  await pg.screenshot({ path: __dirname.replace(/\/docs\/qa\/tools$/, '') + '/districts_map.png' }).catch(() => {});
  await b.close(); srv.close();
  console.log(failed ? '\nПРОВАЛЕНО проверок: ' + failed : '\nВсе проверки пройдены');
  process.exit(failed ? 1 : 0);
})();
