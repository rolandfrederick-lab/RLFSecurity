// Fills the site with the text and photos the owner manages in the staff app
// (More, Website). Elements opt in with data-c="key" (text) and data-photo="key"
// (photo). Anything not filled in keeps the text already in the page.
(function () {
  var C = window.APP_CONFIG;
  if (!C || !C.SUPABASE_URL || /YOUR-PROJECT/.test(C.SUPABASE_URL) || /PASTE_YOURS/.test(C.SUPABASE_KEY)) return;
  var CACHE = 'rlf-site-content';

  function photoUrl(path) {
    return C.SUPABASE_URL + '/storage/v1/object/public/website/' + path.split('/').map(encodeURIComponent).join('/');
  }

  function each(sel, fn) { Array.prototype.forEach.call(document.querySelectorAll(sel), fn); }

  function apply(d) {
    window.SITE_CONTENT = d;

    each('[data-c]', function (el) {
      if (!('cOrig' in el.dataset)) { el.dataset.cOrig = el.textContent; if (el.href) el.dataset.cHref = el.getAttribute('href'); }
      var v = d[el.dataset.c];
      if (!v) { el.textContent = el.dataset.cOrig; if (el.dataset.cHref) el.setAttribute('href', el.dataset.cHref); return; }
      el.textContent = v;
      if (el.dataset.cLink === 'tel') el.href = 'tel:+1' + v.replace(/\D/g, '').replace(/^1(?=\d{10}$)/, '');
      if (el.dataset.cLink === 'mailto') el.href = 'mailto:' + v;
    });

    // Lines that only make sense when their value is set, such as the office phone.
    each('[data-c-wrap]', function (el) { el.hidden = !d[el.dataset.cWrap]; });

    var notice = document.getElementById('site-notice');
    if (notice) notice.hidden = !d.notice;

    each('[data-photo]', function (el) {
      if (!('photoOrig' in el.dataset)) el.dataset.photoOrig = el.innerHTML;
      var path = d[el.dataset.photo];
      if (!path || !/^[\w.-]+$/.test(path)) {
        if (el.classList.contains('has-photo')) { el.innerHTML = el.dataset.photoOrig; el.classList.remove('has-photo'); }
        return;
      }
      var img = el.querySelector('img.site-photo');
      if (!img) {
        img = document.createElement('img');
        img.className = 'site-photo';
        img.loading = 'lazy';
        img.decoding = 'async';
        el.textContent = '';
        el.appendChild(img);
        el.classList.add('has-photo');
      }
      img.alt = (el.dataset.photoAltKey && d[el.dataset.photoAltKey]) || el.dataset.photoAlt || '';
      img.src = photoUrl(path);
    });
  }

  // Show the last known content right away, then refresh it.
  try { var cached = localStorage.getItem(CACHE); if (cached) apply(JSON.parse(cached)); } catch (e) {}

  fetch(C.SUPABASE_URL + '/rest/v1/website?select=data&id=eq.1', { headers: { apikey: C.SUPABASE_KEY } })
    .then(function (r) { return r.ok ? r.json() : null; })
    .then(function (rows) {
      if (!rows || !rows[0]) return;
      var d = rows[0].data || {};
      apply(d);
      try { localStorage.setItem(CACHE, JSON.stringify(d)); } catch (e) {}
    })
    .catch(function () {});
})();
