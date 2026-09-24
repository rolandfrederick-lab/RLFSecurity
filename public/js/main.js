// Mobile menu toggle
(function () {
  var toggle = document.querySelector('.nav-toggle');
  var nav = document.getElementById('site-nav');
  if (!toggle || !nav) return;

  toggle.addEventListener('click', function () {
    var open = nav.classList.toggle('open');
    toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
  });
})();

// Contact form: sends the request straight to the owner's email through the site (/api/contact).
// It never opens the visitor's email app.
(function () {
  var form = document.getElementById('contact-form');
  if (!form) return;

  var status = document.getElementById('form-status');
  var button = form.querySelector('button[type="submit"]');
  var site = function (k, d) { return (window.SITE_CONTENT && window.SITE_CONTENT[k]) || d; };

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    if (!form.reportValidity()) return;

    var fd = new FormData(form), data = {};
    fd.forEach(function (v, k) { data[k] = String(v); });

    button.disabled = true;
    status.textContent = 'Sending...';

    fetch('/api/contact', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(data) })
      .then(function (r) { return r.json().catch(function () { return {}; }).then(function (j) { return { ok: r.ok, j: j }; }); })
      .then(function (res) {
        if (res.ok) {
          form.reset();
          status.textContent = 'Thank you. Your request was sent, and we will respond within one business day.';
        } else if (res.j && /name|email address/i.test(res.j.error || '')) {
          status.textContent = res.j.error;
        } else {
          throw new Error('send failed');
        }
      })
      .catch(function () {
        status.textContent = 'Sorry, the form could not send just now. Please try again, or call us at ' + site('phone', '313-693-5829') + '.';
      })
      .then(function () { button.disabled = false; });
  });
})();
