/* Home carousel runs independently of the XML catalogue loading. */
(() => {
  'use strict';
  const element = document.getElementById('store-carousel');
  if (element && window.bootstrap?.Carousel) {
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    const toggle = document.getElementById('carousel-toggle');
    const status = document.getElementById('carousel-position');
    let paused = reducedMotion.matches;
    const carousel = new bootstrap.Carousel(element, {
      interval: 6000, ride: false, pause: false, touch: true, keyboard: true, wrap: true
    });
    const sync = () => {
      paused ? carousel.pause() : carousel.cycle();
      toggle.textContent = paused ? '▶ Play slides' : 'Ⅱ Pause slides';
      toggle.setAttribute('aria-label', paused ? 'Play slideshow' : 'Pause slideshow');
      element.querySelector('.carousel-inner').setAttribute('aria-live', paused ? 'polite' : 'off');
    };
    toggle.hidden = false;
    toggle.addEventListener('click', () => { paused = !paused; sync(); });
    // Keep slides still once a visitor starts using the controls or slide links.
    element.addEventListener('focusin', event => {
      if (event.target !== toggle) { paused = true; sync(); }
    });
    element.addEventListener('mouseenter', () => carousel.pause());
    element.addEventListener('mouseleave', () => { if (!paused) carousel.cycle(); });
    element.addEventListener('touchstart', event => {
      if (!event.target.closest('#carousel-toggle')) { paused = true; sync(); }
    }, { passive: true });
    element.addEventListener('slid.bs.carousel', event => {
      status.textContent = `${String(event.to + 1).padStart(2, '0')} / 03`;
      if (paused) carousel.pause();
    });
    reducedMotion.addEventListener('change', () => { paused = reducedMotion.matches; sync(); });
    sync();
  }
  window.OceanGate.start();
})();
