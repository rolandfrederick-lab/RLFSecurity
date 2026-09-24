// Cloudflare Worker for rlfsecurity.com.
// Static files in public/ are served directly by Cloudflare; this script only
// sees requests that don't match a file. It handles the contact form
// (POST /api/contact) by emailing the request to the owner through Email Routing.

import { EmailMessage } from 'cloudflare:email';

const FROM = 'website@rlfsecurity.com';
const FROM_NAME = 'RLF Security Website';

function json(body, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
}

const clean = (v, max) => String(v ?? '').replace(/\r/g, '').trim().slice(0, max);
const oneLine = v => v.replace(/[\n\t]+/g, ' ');
const b64 = s => {
  const bytes = new TextEncoder().encode(s);
  let bin = '';
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin);
};
// Header text in UTF-8, safe for names with accents.
const encodeWord = s => `=?UTF-8?B?${b64(s)}?=`;
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const wrap76 = s => s.replace(/.{76}/g, '$&\r\n');

// Branded HTML version of the request. Tables and inline styles, because email apps
// (Gmail, Outlook, Apple Mail) ignore most page-style CSS.
function requestHtml({ name, email, org, phone, need, message }) {
  const row = (label, value) => `<tr>
      <td style="padding:10px 0;border-bottom:1px solid #e6e0d0;width:130px;vertical-align:top;font:600 12px Arial,sans-serif;letter-spacing:.08em;text-transform:uppercase;color:#8a6d12">${label}</td>
      <td style="padding:10px 0;border-bottom:1px solid #e6e0d0;vertical-align:top;font:16px Arial,sans-serif;color:#141413">${value}</td></tr>`;
  const tel = phone.replace(/[^\d+]/g, '');
  const button = (href, label, dark) => `<a href="${href}" style="display:inline-block;margin:0 8px 8px 0;padding:13px 22px;border-radius:4px;font:700 15px Arial,sans-serif;text-decoration:none;${dark ? 'background:#0b0b0c;color:#f2efe6' : 'background:#c9a227;color:#0b0b0c'}">${label}</a>`;
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Website request</title></head>
<body style="margin:0;padding:0;background:#f4f1ea">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f1ea"><tr><td align="center" style="padding:24px 12px">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background:#ffffff;border:1px solid #e6e0d0">
    <tr><td style="background:#0b0b0c;border-bottom:3px solid #c9a227;padding:22px 28px">
      <span style="font:700 20px Georgia,'Times New Roman',serif;letter-spacing:.12em;color:#c9a227">&#9733;</span>
      <span style="font:700 17px Georgia,'Times New Roman',serif;letter-spacing:.1em;color:#f2efe6">&nbsp;R L FREDERICK</span>
      <div style="font:12px Arial,sans-serif;letter-spacing:.14em;color:#b8b3a6;margin-top:4px">PRIVATE SECURITY &amp; WEAPON SAFETY</div>
    </td></tr>
    <tr><td style="padding:28px 28px 8px">
      <div style="font:600 12px Arial,sans-serif;letter-spacing:.18em;color:#8a6d12">NEW WEBSITE REQUEST</div>
      <h1 style="margin:6px 0 4px;font:700 26px Georgia,'Times New Roman',serif;color:#141413">${esc(name)}</h1>
      <div style="font:16px Arial,sans-serif;color:#5f5b52">${esc(need || 'General question')}</div>
    </td></tr>
    <tr><td style="padding:12px 28px 4px">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
        ${row('Email', `<a href="mailto:${esc(email)}" style="color:#8a6d12">${esc(email)}</a>`)}
        ${row('Phone', phone ? `<a href="tel:${esc(tel)}" style="color:#8a6d12">${esc(phone)}</a>` : '<span style="color:#9a958a">Not given</span>')}
        ${row('Organization', org ? esc(org) : '<span style="color:#9a958a">Not given</span>')}
      </table>
    </td></tr>
    <tr><td style="padding:20px 28px 8px">
      <div style="font:600 12px Arial,sans-serif;letter-spacing:.08em;text-transform:uppercase;color:#8a6d12;margin-bottom:8px">Message</div>
      <div style="background:#faf8f2;border-left:3px solid #c9a227;padding:14px 16px;font:16px/1.55 Arial,sans-serif;color:#141413;white-space:pre-wrap">${esc(message)}</div>
    </td></tr>
    <tr><td style="padding:20px 28px 26px">
      ${button(`mailto:${esc(email)}?subject=${encodeURIComponent('Re: your request to R L Frederick Private Security')}`, `Reply to ${esc(name.split(' ')[0] || name)}`)}${phone ? button(`tel:${esc(tel)}`, 'Call', true) : ''}
      <div style="font:13px Arial,sans-serif;color:#5f5b52;margin-top:6px">Or just press Reply in your email app. It goes straight to ${esc(name)}.</div>
    </td></tr>
    <tr><td style="background:#0b0b0c;padding:14px 28px;font:12px Arial,sans-serif;color:#b8b3a6">Sent from the contact form at <a href="https://rlfsecurity.com" style="color:#c9a227">rlfsecurity.com</a></td></tr>
  </table>
</td></tr></table>
</body></html>`;
}

async function handleContact(request, env) {
  let f;
  try { f = await request.json(); } catch { return json({ error: 'Bad request.' }, 400); }

  // Bots fill in the hidden field; people never see it.
  if (clean(f.website, 200)) return json({ ok: true });

  const name = oneLine(clean(f.name, 120));
  const email = oneLine(clean(f.email, 200));
  const org = oneLine(clean(f.organization, 160));
  const phone = oneLine(clean(f.phone, 40));
  const need = oneLine(clean(f.need, 120));
  const message = clean(f.message, 5000);

  if (!name || !message) return json({ error: 'Please add your name and a message.' }, 400);
  if (!/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(email)) return json({ error: 'Please check your email address.' }, 400);

  // Delivered to the verified Gmail inbox (env.CONTACT_EMAIL_TO), but addressed to the
  // business address, so Gmail replies from the business address once "Send mail as" is set up.
  const to = env.CONTACT_EMAIL_TO;
  const shownTo = env.CONTACT_SHOWN_TO || to;
  const body = [
    `New request from the website contact form.`,
    ``,
    `Name: ${name}`,
    `Organization: ${org || '-'}`,
    `Email: ${email}`,
    `Phone: ${phone || '-'}`,
    `Interested in: ${need || '-'}`,
    ``,
    message,
    ``,
    `Reply to this email to answer ${name} directly.`
  ].join('\r\n');

  const boundary = `rlf-${crypto.randomUUID()}`;
  const raw = [
    `From: ${encodeWord(FROM_NAME)} <${FROM}>`,
    `To: <${shownTo}>`,
    `Reply-To: ${encodeWord(name)} <${email}>`,
    `Subject: ${encodeWord(`Website request: ${need || 'General'} from ${name}`)}`,
    `Date: ${new Date().toUTCString()}`,
    `Message-ID: <${crypto.randomUUID()}@rlfsecurity.com>`,
    `MIME-Version: 1.0`,
    `Content-Type: multipart/alternative; boundary="${boundary}"`,
    ``,
    `--${boundary}`,
    `Content-Type: text/plain; charset=utf-8`,
    `Content-Transfer-Encoding: base64`,
    ``,
    wrap76(b64(body)),
    `--${boundary}`,
    `Content-Type: text/html; charset=utf-8`,
    `Content-Transfer-Encoding: base64`,
    ``,
    wrap76(b64(requestHtml({ name, email, org, phone, need, message }))),
    `--${boundary}--`,
    ``
  ].join('\r\n');

  try {
    await env.CONTACT_EMAIL.send(new EmailMessage(FROM, to, raw));
  } catch (e) {
    console.error('contact form send failed', e);
    return json({ error: 'The message could not be sent.' }, 502);
  }
  return json({ ok: true });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === '/api/contact') {
      if (request.method !== 'POST') return json({ error: 'Method not allowed.' }, 405);
      return handleContact(request, env);
    }
    return env.ASSETS.fetch(request);
  }
};
