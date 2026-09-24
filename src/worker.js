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

  const raw = [
    `From: ${encodeWord(FROM_NAME)} <${FROM}>`,
    `To: <${shownTo}>`,
    `Reply-To: ${encodeWord(name)} <${email}>`,
    `Subject: ${encodeWord(`Website request: ${need || 'General'} from ${name}`)}`,
    `Date: ${new Date().toUTCString()}`,
    `Message-ID: <${crypto.randomUUID()}@rlfsecurity.com>`,
    `MIME-Version: 1.0`,
    `Content-Type: text/plain; charset=utf-8`,
    `Content-Transfer-Encoding: base64`,
    ``,
    b64(body).replace(/.{76}/g, '$&\r\n')
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
