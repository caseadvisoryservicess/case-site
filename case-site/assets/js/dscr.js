/* dscr.js
   Стенд на странице Feasibility: три ручки и одна цифра.

   Смысл в одном: объяснить продукт быстрее, чем его успеют прочитать.
   Посетитель двигает ставку, вакансию и задержку открытия и видит,
   в какой момент операционный поток перестаёт покрывать обслуживание долга.
   Все допущения напечатаны рядом, формула открыта, цифры условные.

   Без JavaScript блок показывает исходное состояние, посчитанное при сборке:
   значения и вывод уже стоят в разметке. */

const stand = document.querySelector('[data-stand]');

if (stand) {
  const GLA = 20000;          // м², сдаётся полностью
  const OPEX = 0.30;          // доля от валового дохода
  const DEBT = 18000000;      // USD
  const RATE = 0.12;          // годовых
  const YEARS = 10;
  const THRESHOLD = 1.30;

  // Аннуитет: постоянный годовой платёж по кредиту.
  const service = DEBT * RATE / (1 - Math.pow(1 + RATE, -YEARS));

  const dec = stand.dataset.dec || ',';
  const dials = Array.from(stand.querySelectorAll('input[type=range]'));
  const out = {
    noi: stand.querySelector('[data-noi]'),
    debt: stand.querySelector('[data-debt]'),
    dscr: stand.querySelector('[data-dscr]'),
    verdict: stand.querySelector('[data-verdict]'),
    fill: stand.querySelector('[data-fill]')
  };

  const money = (v) => Math.round(v).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  const ratio = (v) => v.toFixed(2).replace('.', dec);

  function recalc() {
    const rent = Number(dials[0].value);
    const vac = Number(dials[1].value) / 100;
    const delay = Number(dials[2].value) / 12;

    const gross = GLA * rent * 12 * (1 - vac) * (1 - delay);
    const noi = gross * (1 - OPEX);
    const dscr = noi / service;

    dials.forEach((d) => {
      const label = d.closest('.dial').querySelector('[data-out]');
      if (label) label.textContent = d.value;
    });
    if (out.noi) out.noi.textContent = money(noi);
    if (out.debt) out.debt.textContent = money(service);
    if (out.dscr) out.dscr.textContent = ratio(dscr);

    const ok = dscr >= THRESHOLD;
    stand.dataset.state = ok ? 'ok' : 'bad';
    if (out.verdict) out.verdict.textContent = ok ? stand.dataset.ok : stand.dataset.bad;
    // Шкала от 0 до 3,0: порог 1,30 стоит на 43 процентах ширины.
    if (out.fill) out.fill.style.width = Math.max(0, Math.min(100, dscr / 3 * 100)).toFixed(1) + '%';
  }

  dials.forEach((d) => d.addEventListener('input', recalc));
  recalc();
}
