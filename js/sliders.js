(function () {
  'use strict';

  // Screenshot sliders: one independent slider per featured project.
  // - Auto-advances every 5 s, but only while its card is on screen.
  // - Pauses on hover, keyboard focus, and while a touch is in progress.
  // - Prev/next buttons, dots, arrow keys, and swipe on touch screens.
  // - No auto-advance when the visitor prefers reduced motion.

  var INTERVAL_MS = 5000;
  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var hasObserver = 'IntersectionObserver' in window;

  document.querySelectorAll('[data-slider]').forEach(function (root) {
    var track = root.querySelector('.shots-track');
    var slides = track ? track.querySelectorAll('.shot') : [];
    var dotsWrap = root.querySelector('.shots-dots');
    var prevBtn = root.querySelector('.shots-btn.prev');
    var nextBtn = root.querySelector('.shots-btn.next');
    if (!track || slides.length === 0) return;

    var index = 0;
    var timer = null;
    var hovered = false;
    var focused = false;
    var touching = false;
    var onScreen = !hasObserver;
    var startX = null;

    var dots = [];
    if (dotsWrap) {
      slides.forEach(function (_, i) {
        var dot = document.createElement('button');
        dot.type = 'button';
        dot.className = 'shots-dot';
        dot.setAttribute('aria-label', 'Show screenshot ' + (i + 1) + ' of ' + slides.length);
        dot.addEventListener('click', function () { goTo(i, true); });
        dotsWrap.appendChild(dot);
        dots.push(dot);
      });
    }

    function render() {
      track.style.transform = 'translateX(' + (-index * 100) + '%)';
      dots.forEach(function (dot, i) {
        dot.setAttribute('aria-current', i === index ? 'true' : 'false');
      });
      slides.forEach(function (slide, i) {
        slide.setAttribute('aria-hidden', i === index ? 'false' : 'true');
      });
    }

    function goTo(i, byUser) {
      index = (i + slides.length) % slides.length;
      render();
      if (byUser) restart();
    }

    function isPaused() {
      return hovered || focused || touching || !onScreen;
    }

    function tick() {
      if (!isPaused()) goTo(index + 1, false);
    }

    function start() {
      if (reduceMotion || slides.length < 2 || timer) return;
      timer = setInterval(tick, INTERVAL_MS);
    }

    function stop() {
      if (timer) clearInterval(timer);
      timer = null;
    }

    function restart() {
      stop();
      start();
    }

    if (prevBtn) prevBtn.addEventListener('click', function () { goTo(index - 1, true); });
    if (nextBtn) nextBtn.addEventListener('click', function () { goTo(index + 1, true); });

    root.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowLeft') { e.preventDefault(); goTo(index - 1, true); }
      if (e.key === 'ArrowRight') { e.preventDefault(); goTo(index + 1, true); }
    });

    root.addEventListener('mouseenter', function () { hovered = true; });
    root.addEventListener('mouseleave', function () { hovered = false; });
    root.addEventListener('focusin', function () { focused = true; });
    root.addEventListener('focusout', function () { focused = false; });

    // Swipe on touch screens (mouse drags are ignored so desktop clicks stay simple).
    root.addEventListener('pointerdown', function (e) {
      if (e.pointerType !== 'touch') return;
      touching = true;
      startX = e.clientX;
    });
    root.addEventListener('pointerup', function (e) {
      if (e.pointerType !== 'touch') return;
      touching = false;
      if (startX === null) return;
      var dx = e.clientX - startX;
      startX = null;
      if (Math.abs(dx) > 40) goTo(index + (dx < 0 ? 1 : -1), true);
    });
    root.addEventListener('pointercancel', function () {
      touching = false;
      startX = null;
    });

    if (hasObserver) {
      new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          onScreen = entry.isIntersecting;
          if (onScreen) { start(); } else { stop(); }
        });
      }, { threshold: 0.35 }).observe(root);
    } else {
      start();
    }

    render();
  });
})();
