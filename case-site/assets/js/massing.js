/* massing.js
   Оживление сцены объёма на странице Feasibility.

   Почему не three.js: бюджет JS на весь сайт меньше 120 КБ, а один three.js
   весит больше. Объём нарисован изометрией в SVG, где геометрия точна и
   читается на любом экране, а скрипт добавляет только свет и лёгкий доворот.
   Две трансформации на кадр, никакого WebGL.

   Условия включения строгие. Не выполнено хотя бы одно, остаётся постер. */

const stage = document.querySelector('[data-massing]');

function allowed() {
  if (!stage) return false;
  if (!window.matchMedia('(min-width: 1024px)').matches) return false;
  if (!window.matchMedia('(prefers-reduced-motion: no-preference)').matches) return false;
  if ((navigator.hardwareConcurrency || 2) < 4) return false;
  return true;
}

function build() {
  const poster = stage.querySelector('.stage3d__poster');
  const scene = stage.querySelector('.stage3d__scene');
  if (!poster || !scene) return;

  const sweep = document.createElement('div');
  sweep.className = 'stage3d__sweep';
  scene.appendChild(sweep);
  stage.classList.add('is-live');

  let frame = 0;
  const onScroll = () => {
    if (frame) return;
    frame = requestAnimationFrame(() => {
      frame = 0;
      const r = stage.getBoundingClientRect();
      if (r.bottom < 0 || r.top > window.innerHeight) return;
      // 0 когда блок только вошёл снизу, 1 когда уходит вверх
      const p = Math.min(1, Math.max(0, 1 - (r.top + r.height) / (window.innerHeight + r.height)));
      poster.style.transform =
        'rotateY(' + (5 - p * 10).toFixed(2) + 'deg) rotateX(' + (2 - p * 4).toFixed(2) + 'deg) scale(1.04)';
      sweep.style.transform = 'translate3d(' + (-60 + p * 120).toFixed(1) + '%,0,0)';
    });
  };
  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', onScroll, { passive: true });
  onScroll();
}

if (allowed()) {
  if ('requestIdleCallback' in window) window.requestIdleCallback(build, { timeout: 2500 });
  else window.addEventListener('load', () => setTimeout(build, 400));
}
