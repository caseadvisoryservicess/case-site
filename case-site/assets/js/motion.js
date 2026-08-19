/* motion.js
   Движение по прокрутке. Правило одно: анимация либо объясняет продукт,
   либо держит ритм. Всё остальное удалено. Анимируются только transform
   и opacity.

   Герой сюда не входит: он анимируется чистым CSS и не ждёт ни одного скрипта.
   Этот файл и вся библиотека подгружаются после события load, поэтому они
   физически не могут задержать LCP.

   Если GSAP не загрузился или пользователь просит меньше движения,
   страница просто показывает конечные состояния. */

const root = document.documentElement;
const reduced = window.matchMedia('(prefers-reduced-motion:reduce)').matches;

function ready() { root.classList.add('motion-ready'); }

/* Без библиотеки или при reduce: снимаем стартовые состояния и выходим. */
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
  initReveals();
  initChain();
  initScenarios();
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

/* --- Появление блоков. Один общий батч вместо десятка триггеров --- */
function initReveals() {
  const items = gsap.utils.toArray('.reveal:not([data-hero-after])');
  if (!items.length) return;
  ScrollTrigger.batch(items, {
    start: 'top 88%',
    once: true,
    onEnter: (batch) => gsap.to(batch, {
      opacity: 1, y: 0, duration: 0.62, stagger: 0.07, ease: 'power2.out',
      onComplete() { gsap.set(batch, { clearProps: 'willChange' }); }
    })
  });
  gsap.utils.toArray('.reveal-rule').forEach((el) => {
    gsap.to(el, {
      scaleX: 1, duration: 0.7, ease: 'power2.inOut',
      scrollTrigger: { trigger: el, start: 'top 92%', once: true }
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

/* --- Цифры, которые решают: силуэт участка перестраивается, счётчики считают --- */
function initScenarios() {
  const block = document.querySelector('[data-scenarios]');
  if (!block) return;
  const shape = block.querySelector('[data-shape]');
  const steps = gsap.utils.toArray(block.querySelectorAll('.scen__step'));
  if (!steps.length) return;

  steps.forEach((step) => {
    ScrollTrigger.create({
      trigger: step,
      start: 'top 65%',
      end: 'bottom 45%',
      onToggle(self) {
        step.classList.toggle('is-on', self.isActive);
        if (!self.isActive) return;
        const pts = step.getAttribute('data-points');
        if (shape && pts) gsap.to(shape, { attr: { points: pts }, duration: 0.7, ease: 'power2.inOut' });
        countUp(step);
      }
    });
  });
}

function countUp(step) {
  step.querySelectorAll('[data-count]').forEach((el) => {
    if (el.dataset.counted === '1') return;
    const target = parseFloat(el.getAttribute('data-count'));
    if (!isFinite(target)) return;
    el.dataset.counted = '1';
    const dec = parseInt(el.getAttribute('data-dec') || '0', 10);
    const obj = { v: 0 };
    gsap.to(obj, {
      v: target, duration: 1.1, ease: 'power2.out',
      onUpdate() { el.textContent = format(obj.v, dec); }
    });
  });
}

function format(v, dec) {
  const s = dec ? v.toFixed(dec) : String(Math.round(v));
  const [i, f] = s.split('.');
  const grouped = i.replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  return f ? grouped + ',' + f : grouped;
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
