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

// Contact form: sends the request to the owner's email through the site (/api/contact).
// If that fails, it falls back to opening the visitor's email app.
(function () {
  var form = document.getElementById('contact-form');
  if (!form) return;

  var TO = 'rolandfrederick@gmail.com';
  var status = document.getElementById('form-status');
  var button = form.querySelector('button[type="submit"]');
  var site = function (k, d) { return (window.SITE_CONTENT && window.SITE_CONTENT[k]) || d; };

  function openEmailApp(data) {
    var body = [
      'Name: ' + data.name,
      'Organization: ' + (data.organization || '-'),
      'Email: ' + data.email,
      'Phone: ' + (data.phone || '-'),
      'Interested in: ' + data.need,
      '',
      data.message
    ].join('\n');
    window.location.href = 'mailto:' + site('email', TO) +
      '?subject=' + encodeURIComponent('Website request: ' + data.need) +
      '&body=' + encodeURIComponent(body);
  }

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
        status.textContent = 'The form could not send just now. Opening your email app instead. You can also call ' + site('phone', '313-693-5829') + '.';
        openEmailApp(data);
      })
      .then(function () { button.disabled = false; });
  });
})();
