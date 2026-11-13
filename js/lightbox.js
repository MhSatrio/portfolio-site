(function () {
  'use strict';

  // Click a screenshot to view it large; click anywhere (or press Esc) to close.
  var overlay = null;
  var lastFocus = null;

  function close() {
    if (!overlay) return;
    overlay.remove();
    overlay = null;
    document.body.style.overflow = '';
    document.removeEventListener('keydown', onKey);
    if (lastFocus && lastFocus.focus) lastFocus.focus();
  }

  function onKey(e) {
    if (e.key === 'Escape') close();
  }

  function open(img) {
    if (overlay) close();
    lastFocus = img;
    overlay = document.createElement('div');
    overlay.className = 'lightbox';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.setAttribute('aria-label', 'Enlarged screenshot. Click anywhere to close.');

    var big = document.createElement('img');
    big.src = img.currentSrc || img.src;
    big.alt = img.alt;

    var cap = document.createElement('p');
    var fig = img.closest('figure');
    var fc = fig ? fig.querySelector('figcaption') : null;
    cap.textContent = fc ? fc.textContent : img.alt;

    var hint = document.createElement('span');
    hint.className = 'lightbox-hint';
    hint.textContent = 'Click anywhere to close';

    overlay.appendChild(big);
    overlay.appendChild(cap);
    overlay.appendChild(hint);
    overlay.addEventListener('click', close);
    document.body.appendChild(overlay);
    document.body.style.overflow = 'hidden';
    document.addEventListener('keydown', onKey);
  }

  document.querySelectorAll('.shot img, .vier-admin-shot img').forEach(function (img) {
    img.classList.add('zoomable');
    img.setAttribute('tabindex', '0');
    img.setAttribute('role', 'button');
    img.setAttribute('aria-label', 'Enlarge screenshot: ' + img.alt);
    img.addEventListener('click', function () { open(img); });
    img.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(img); }
    });
  });
})();
