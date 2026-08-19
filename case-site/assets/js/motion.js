/* motion.js
   Движение по прокрутке. Правило одно: анимация либо объясняет продукт,
   либо держит ритм. Всё остальное удалено. Анимируются только transform,
   opacity и атрибуты SVG.

   Герой сюда не входит: он анимируется чистым CSS и не ждёт ни одного
   скрипта. Этот файл и вся библиотека подгружаются после события load,
   поэтому они физически не могут задержать LCP.

   Если GSAP не загрузился или пользователь просит меньше движения,
   страница просто показывает конечные состояния. */

const root = document.documentElement;
const reduced = window.matchMedia('(prefers-reduced-motion:reduce)').matches;

function ready() { root.classList.add('motion-ready'); }

function fallback() {
  root.classList.remove('js');
  ready();
}

const gsap = window.gsap;
const ScrollTrigger = window.ScrollTrigger;

if (!gsap || !ScrollTrigger) {
  fallback();
} else if (reduced) {
  fallback();
} else {
  gsap.registerPlugin(ScrollTrigger);
  ready();
  initSmooth();
  initLines();
  initReveals();
  initWipes();
  initDrift();
  initChain();
  initDive();
  initCaseTransition();
  window.addEventListener('load', () => ScrollTrigger.refresh());
}

/* --- Плавный скролл. На касании отключаем: там он стоит кадров дороже, чем даёт --- */
function initSmooth() {
  const coarse = window.matchMedia('(pointer:coarse)').matches;
  if (coarse || !window.Lenis) return;
  const lenis = new window.Lenis({ lerp: 0.09, wheelMultiplier: 1, smoothWheel: true });
  lenis.on('scroll', ScrollTrigger.update);
  gsap.ticker.add((t) => lenis.raf(t * 1000));
  gsap.ticker.lagSmoothing(0);
  window.CASElenis = lenis;
}

/* --- Заголовки поднимаются построчно из-под маски.
       Это главный носитель ритма на длинной странице: текст не появляется,
       он въезжает. После показа разбивку снимаем, чтобы переносы строк
       снова считал браузер. --- */
function initLines() {
  const Split = window.SplitText;
  if (!Split) return;
  gsap.registerPlugin(Split);

  const run = () => {
    gsap.utils.toArray('[data-lines]').forEach((el) => {
      if (!el.textContent.trim()) return;
      const split = (Split.create || ((e, o) => new Split(e, o)))(el, { type: 'lines', mask: 'lines' });
      gsap.from(split.lines, {
        yPercent: 100,
        duration: 0.85,
        ease: 'power3.out',
        stagger: 0.075,
        scrollTrigger: { trigger: el, start: 'top 90%', once: true },
        onComplete() { split.revert(); }
      });
    });
  };
  // Разбивать текст до загрузки шрифта нельзя: переносы посчитаются по фолбэку.
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(run);
  else run();
}

/* --- Появление блоков. Один общий батч вместо десятка триггеров --- */
function initReveals() {
  const items = gsap.utils.toArray('.reveal:not([data-hero-after])');
  if (items.length) {
    ScrollTrigger.batch(items, {
      start: 'top 88%',
      once: true,
      onEnter: (batch) => gsap.to(batch, {
        opacity: 1, y: 0, duration: 0.62, stagger: 0.07, ease: 'power2.out',
        onComplete() { gsap.set(batch, { clearProps: 'willChange' }); }
      })
    });
  }
  gsap.utils.toArray('.reveal-rule').forEach((el) => {
    gsap.to(el, {
      scaleX: 1, duration: 0.7, ease: 'power2.inOut',
      scrollTrigger: { trigger: el, start: 'top 92%', once: true }
    });
  });
}

/* --- Штора на тёмных секциях: переход читается как склейка, а не как
       появление блока. Раскрывается заранее, пока содержимое ещё под
       нижней кромкой экрана. --- */
function initWipes() {
  gsap.utils.toArray('[data-ground]').forEach((g) => {
    gsap.fromTo(g, { scaleY: 0 }, {
      scaleY: 1, ease: 'none',
      scrollTrigger: {
        trigger: g.parentElement,
        start: 'top bottom',
        end: 'top 55%',
        scrub: 0.35
      }
    });
  });
}

/* --- Крупные номера секций сносит потоком прокрутки.
       Это декоративный слой, а не текст: читаемости не мешает. --- */
function initDrift() {
  gsap.utils.toArray('[data-drift]').forEach((el) => {
    const section = el.closest('.section') || el;
    gsap.fromTo(el, { xPercent: -7 }, {
      xPercent: 7, ease: 'none',
      scrollTrigger: { trigger: section, start: 'top bottom', end: 'bottom top', scrub: 0.8 }
    });
  });
}

/* --- Цепочка стадий: переход секции читается как движение камеры вбок --- */
function initChain() {
  const chain = document.querySelector('[data-chain]');
  if (!chain) return;
  const track = chain.querySelector('.chain__track');
  const viewport = chain.querySelector('.chain__viewport');
  const prog = chain.querySelector('.chain__prog');
  const stages = gsap.utils.toArray(chain.querySelectorAll('.chain__stage'));
  if (!track || !viewport) return;

  const mm = gsap.matchMedia();
  mm.add('(min-width: 861px)', () => {
    const distance = () => Math.max(0, track.scrollWidth - viewport.clientWidth);
    if (distance() < 8) return;
    chain.classList.add('is-driven');

    const tl = gsap.timeline({
      scrollTrigger: {
        trigger: chain,
        start: 'top top',
        end: () => '+=' + (distance() + window.innerHeight * 0.6),
        pin: true,
        scrub: 0.6,
        anticipatePin: 1,
        invalidateOnRefresh: true,
        onUpdate(self) {
          const lit = Math.round(self.progress * stages.length + 0.15);
          stages.forEach((s, i) => s.classList.toggle('is-lit', i < lit));
        }
      }
    });
    tl.to(track, { x: () => -distance(), ease: 'none' }, 0);
    if (prog) tl.fromTo(prog, { scaleX: 0 }, { scaleX: 1, ease: 'none' }, 0);

    return () => { chain.classList.remove('is-driven'); stages.forEach((s) => s.classList.remove('is-lit')); };
  });
}

/* --- Погружение: один участок проходит через программу и выходит тремя
       разными объектами. Разрез перестраивается, состав перераспределяется,
       свет уходит вниз вместе с читателем. Это и есть наш дифференциатор:
       архитектор показывает картинку, мы показываем, как считается решение. --- */
function initDive() {
  const dive = document.querySelector('[data-dive]');
  if (!dive) return;
  const shape = dive.querySelector('[data-shape]');
  const segs = gsap.utils.toArray(dive.querySelectorAll('[data-seg]'));
  const ghosts = gsap.utils.toArray(dive.querySelectorAll('[data-ghost]'));
  const steps = gsap.utils.toArray(dive.querySelectorAll('.dive__step'));
  const wrap = dive.querySelector('.dive__steps');
  const mark = dive.querySelector('[data-dive-mark]');
  const light = dive.querySelector('[data-dive-light]');
  if (!shape || !steps.length) return;

  const WIDTH = 500; // ширина полосы состава в координатах разреза
  let current = -1;

  function apply(i) {
    const step = steps[i];
    steps.forEach((s, j) => s.classList.toggle('is-on', j === i));
    gsap.to(shape, { attr: { points: step.dataset.points }, duration: 0.7, ease: 'power2.inOut' });

    const parts = (step.dataset.comp || '0,0,0').split(',').map(Number);
    let x = 0;
    segs.forEach((seg, j) => {
      const w = parts[j] / 100 * WIDTH;
      gsap.to(seg, { attr: { width: w, x: x }, duration: 0.55, ease: 'power2.inOut' });
      x += w;
    });
    // На последнем шаге рядом проступают два других силуэта: сравнение
    // и есть вывод секции.
    gsap.to(ghosts, { opacity: step.dataset.final ? 1 : 0, duration: 0.45 });
  }

  // Один драйвер на всю секцию: состояние всегда ровно одно, соседние
  // шаги не перебивают друг друга.
  ScrollTrigger.create({
    trigger: wrap || dive,
    start: 'top 62%',
    end: 'bottom 42%',
    scrub: 0.4,
    onUpdate(self) {
      const p = self.progress;
      const i = Math.max(0, Math.min(steps.length - 1, Math.floor(p * steps.length + 0.0001)));
      if (i !== current) { current = i; apply(i); }
      if (mark && wrap) {
        mark.style.transform = 'translate3d(0,' + (p * (wrap.offsetHeight - 10)).toFixed(1) + 'px,0)';
      }
      if (light) light.style.setProperty('--lit', (14 + p * 60).toFixed(1) + '%');
    }
  });
  apply(0);
}

/* --- Переход в кейс. Где браузер умеет View Transitions, работает он сам --- */
function initCaseTransition() {
  if (document.startViewTransition) return;
  document.querySelectorAll('a[data-case-link]').forEach((a) => {
    a.addEventListener('click', (e) => {
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
      const media = a.querySelector('.case-card__media');
      if (!media) return;
      e.preventDefault();
      const href = a.getAttribute('href');
      gsap.to(media, {
        scale: 1.06, duration: 0.22, ease: 'power2.in',
        onComplete() { window.location.href = href; }
      });
    });
  });
}
