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

// Contact form: opens the visitor's email app with the request filled in.
(function () {
  var form = document.getElementById('contact-form');
  if (!form) return;

  var TO = 'rolandfrederick@gmail.com';
  var status = document.getElementById('form-status');

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    if (!form.reportValidity()) return;

    var data = new FormData(form);
    var need = data.get('need');
    var body = [
      'Name: ' + data.get('name'),
      'Organization: ' + (data.get('organization') || '-'),
      'Email: ' + data.get('email'),
      'Phone: ' + (data.get('phone') || '-'),
      'Interested in: ' + need,
      '',
      data.get('message')
    ].join('\n');

    var to = (window.SITE_CONTENT && window.SITE_CONTENT.email) || TO;
    window.location.href = 'mailto:' + to +
      '?subject=' + encodeURIComponent('Website request: ' + need) +
      '&body=' + encodeURIComponent(body);

    var phone = (window.SITE_CONTENT && window.SITE_CONTENT.phone) || '313-693-5829';
    status.textContent = 'Your email app should open with your request. If it does not, call ' + phone + '.';
  });
})();
