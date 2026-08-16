// ─────────────────────────────────────────────
// Whale Shark Cinematic Sequence
// Real photography, scroll-scrubbed via GSAP ScrollTrigger.
// Degrades gracefully (static first frame) if GSAP fails to load.
// ─────────────────────────────────────────────
(function () {
  if (!window.gsap || !window.ScrollTrigger) return;

  gsap.registerPlugin(ScrollTrigger);

  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const isMobile = window.matchMedia('(max-width: 780px)').matches;

  const cinema = document.getElementById('ws-cinema');
  if (!cinema) return;

  if (reduceMotion) {
    // Show a calm static composition instead of the scrubbed sequence.
    gsap.set('#ws-copy-3', { opacity: 1 });
    gsap.set('.ws-img-primary .ws-img', { x: '2vw', scale: 1.55 });
    return;
  }

  const tl = gsap.timeline({
    scrollTrigger: {
      trigger: '#ws-cinema',
      start: 'top top',
      end: 'bottom bottom',
      scrub: 1,
    },
    defaults: { ease: 'none' },
  });

  // ===== STAGE 1 — tail enters, pans toward body — "The Gentle Giant" =====
  tl.fromTo('#ws-img-primary .ws-img',
    { x: '-9vw', scale: 1.5 },
    { x: '-1vw', scale: 1.56, duration: 2 }, 0);

  tl.to('#ws-copy-1', { opacity: 1, duration: 0.4 }, 0.3)
    .to('.ws-copy-1 .ws-line', { scaleX: 1, duration: 0.5, ease: 'power2.out' }, 0.35)
    .to('#ws-copy-1', { opacity: 0, duration: 0.4 }, 1.7);

  // ===== STAGE 2 — pan continues — 12M stat =====
  tl.to('#ws-img-primary .ws-img',
    { x: '5vw', scale: 1.6, duration: 2 }, 2);

  const statTarget = { v: 0 };
  const statEl = document.querySelector('.ws-stat-num');
  tl.to('#ws-copy-2', { opacity: 1, duration: 0.4 }, 2.3)
    .to(statTarget, {
      v: 12, duration: 0.8, ease: 'power1.out',
      onUpdate: () => { if (statEl) statEl.textContent = Math.round(statTarget.v); },
    }, 2.3)
    .to('#ws-copy-2', { opacity: 0, duration: 0.4 }, 3.7);

  // ===== STAGE 3 — pan completes to head — "World's Largest Fish" =====
  tl.to('#ws-img-primary .ws-img',
    { x: '10vw', scale: 1.65, duration: 2 }, 4);

  tl.to('#ws-copy-3', { opacity: 1, duration: 0.4 }, 4.3)
    .to('#ws-copy-3', { opacity: 0, duration: 0.4 }, 5.7);

  // ===== STAGE 4 — whale shark turns toward camera — "Wild. Powerful. Peaceful." =====
  tl.to('.ws-img-primary', { opacity: 0, duration: 1 }, 6)
    .fromTo('#ws-img-close-1', { opacity: 0 }, { opacity: 1, duration: 1 }, 6)
    .fromTo('#ws-img-close-1 .ws-img', { scale: 1.05 }, { scale: 1.22, duration: 1.9, ease: 'power1.in' }, 6);

  tl.to('#ws-copy-4', { opacity: 1, duration: 0.3 }, 6.3)
    .to('.ws-copy-4 .ws-stack span:nth-child(1)', { opacity: 1, y: 0, duration: 0.4 }, 6.3)
    .to('.ws-copy-4 .ws-stack span:nth-child(2)', { opacity: 1, y: 0, duration: 0.4 }, 6.6)
    .to('.ws-copy-4 .ws-stack span:nth-child(3)', { opacity: 1, y: 0, duration: 0.4 }, 6.9)
    .to('#ws-copy-4', { opacity: 0, duration: 0.4 }, 7.5);

  // ===== STAGE 5 — extreme close pass, screen fills with the whale shark, cut to next scene =====
  tl.to('#ws-img-close-1', { opacity: 0, duration: 1 }, 7.6)
    .fromTo('#ws-img-close-2', { opacity: 0 }, { opacity: 1, duration: 1 }, 7.6)
    .fromTo('#ws-img-close-2 .ws-img', { scale: 1.05 }, { scale: isMobile ? 1.9 : 2.6, duration: 2.4, ease: 'power2.in' }, 7.6);

  tl.to('.ws-vignette', { opacity: 1.6, duration: 1, ease: 'power2.in' }, 8.6)
    .to('.ws-stage', { backgroundColor: '#000', duration: 0.6 }, 9.2)
    .to('#ws-img-close-2', { opacity: 0, duration: 0.6 }, 9.3);
})();
