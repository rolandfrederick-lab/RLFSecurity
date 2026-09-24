// Accordion gallery (after React Bits' AccordionGallery), plain JS + CSS transitions.
// Markup: <div class="accordion-gallery" data-accordion data-default="2"> with .ag-panel children.
(function () {
  var TILT = 8;          // degrees on collapsed panels
  var EXPAND = 0.52;     // share of the row the open panel takes
  var PARALLAX = 0.5;

  function setup(root) {
    var panels = Array.prototype.slice.call(root.querySelectorAll('.ag-panel'));
    var count = panels.length;
    if (!count) return;
    var active = Math.min(Math.max(parseInt(root.dataset.default || '0', 10), 0), count - 1);
    var hoverable = window.matchMedia && window.matchMedia('(hover: hover)').matches;

    function measure() {
      var usable = Math.max(root.clientWidth - 10 * (count - 1), 120);
      root.style.setProperty('--ag-media-size', Math.max(140, usable * EXPAND * 1.22) + 'px');
    }

    function layout() {
      var grow = count > 1 ? (EXPAND * (count - 1)) / (1 - EXPAND) : 1;
      var size = parseFloat(getComputedStyle(root).getPropertyValue('--ag-media-size')) || 320;
      panels.forEach(function (panel, i) {
        var isActive = i === active;
        var rot = isActive ? 0 : i < active ? TILT : -TILT;
        var drift = Math.max(-1.5, Math.min(1.5, active - i));
        panel.style.flexGrow = isActive ? grow : 1;
        panel.style.setProperty('--ag-rot', rot + 'deg');
        panel.style.setProperty('--ag-shift', (isActive ? 0 : drift * PARALLAX * size * 0.06) + 'px');
        panel.classList.toggle('ag-panel--active', isActive);
        if (isActive) panel.setAttribute('aria-current', 'true');
        else panel.removeAttribute('aria-current');
      });
    }

    function activate(i) {
      if (i === active) return;
      active = i;
      layout();
    }

    // Whether the panel was still closed when the press began. Focus fires
    // between press and click and would otherwise open it too early.
    var pressedClosed = false;

    panels.forEach(function (panel, i) {
      panel.addEventListener('mouseenter', function () { if (hoverable) activate(i); });
      panel.addEventListener('pointerdown', function () { pressedClosed = i !== active; });
      panel.addEventListener('focus', function () { activate(i); });
      panel.addEventListener('click', function (e) {
        // First tap opens a panel; a tap on the open panel follows its link.
        if (pressedClosed || i !== active) { e.preventDefault(); activate(i); }
        pressedClosed = false;
      });
      panel.addEventListener('keydown', function (e) {
        if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
          e.preventDefault(); panels[(i + 1) % count].focus();
        } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
          e.preventDefault(); panels[(i - 1 + count) % count].focus();
        }
      });
    });

    measure();
    layout();
    if ('ResizeObserver' in window) new ResizeObserver(function () { measure(); layout(); }).observe(root);
    // Enable transitions only after the first layout so the page doesn't animate on load.
    requestAnimationFrame(function () { root.classList.add('ag-ready'); });
  }

  var galleries = document.querySelectorAll('[data-accordion]');
  for (var i = 0; i < galleries.length; i++) setup(galleries[i]);
})();
