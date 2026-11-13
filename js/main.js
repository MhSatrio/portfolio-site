(function () {
  'use strict';

  // ---- Re-align deep-link anchor after late web-font/layout reflow ----
  // A direct load of /#section jumps once, early; Inter loading late can
  // grow section heights afterward and leave the jump short. Re-jump once
  // fonts and the full page (images) are actually settled.
  if (location.hash) {
    var target = document.querySelector(location.hash);
    if (target) {
      var rejump = function () { target.scrollIntoView({ block: 'start' }); };
      if (document.fonts && document.fonts.ready) {
        document.fonts.ready.then(function () { setTimeout(rejump, 50); });
      }
      window.addEventListener('load', function () { setTimeout(rejump, 250); });
    }
  }

  // ---- Sticky nav blur on scroll ----
  var nav = document.getElementById('nav');
  function onScroll() {
    if (window.scrollY > 8) {
      nav.classList.add('scrolled');
    } else {
      nav.classList.remove('scrolled');
    }
  }
  onScroll();
  window.addEventListener('scroll', onScroll, { passive: true });

  // ---- Mobile menu ----
  var navToggle = document.getElementById('navToggle');
  var mobileMenu = document.getElementById('mobileMenu');
  navToggle.addEventListener('click', function () {
    mobileMenu.classList.toggle('open');
  });
  mobileMenu.querySelectorAll('a').forEach(function (link) {
    link.addEventListener('click', function () {
      mobileMenu.classList.remove('open');
    });
  });

  // ---- Scroll reveal ----
  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var revealEls = document.querySelectorAll('.reveal');

  if (reduceMotion || !('IntersectionObserver' in window)) {
    revealEls.forEach(function (el) { el.classList.add('in-view'); });
  } else {
    var observer = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            entry.target.classList.add('in-view');
            observer.unobserve(entry.target);
          }
        });
      },
      // threshold: 0 fires as soon as any part of an element enters the
      // viewport. A fractional threshold (e.g. 0.12) requires that % of the
      // element's OWN height to be visible at once, for a tall single
      // container like a stacked mobile card-grid (which can run several
      // times taller than the viewport once cards stack into one column),
      // that requirement is literally impossible to satisfy and the
      // section never reveals. threshold: 0 has no such ceiling.
      { threshold: 0, rootMargin: '0px 0px -60px 0px' }
    );
    revealEls.forEach(function (el) { observer.observe(el); });
  }

  // ---- Experience category filter ----
  var chips = document.querySelectorAll('.filter-chip');
  var companyBlocks = document.querySelectorAll('#experience .company-block');

  chips.forEach(function (chip) {
    chip.addEventListener('click', function () {
      chips.forEach(function (c) { c.classList.remove('active'); });
      chip.classList.add('active');
      var filter = chip.getAttribute('data-filter');

      companyBlocks.forEach(function (block) {
        var cards = block.querySelectorAll('.card[data-category]');
        if (cards.length === 0) {
          // Additional Experience strip has no filterable cards, always visible
          block.style.display = '';
          return;
        }
        var visibleCount = 0;
        cards.forEach(function (card) {
          var match = filter === 'all' || card.getAttribute('data-category') === filter;
          card.style.display = match ? '' : 'none';
          if (match) visibleCount++;
        });
        block.style.display = visibleCount > 0 ? '' : 'none';
      });
    });
  });
})();
