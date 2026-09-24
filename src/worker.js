// Cloudflare Worker for rlfsecurity.com.
// Static files in public/ are served directly by Cloudflare; this script only
// sees requests that don't match a file:
//   POST /api/contact  website contact form: emails the request to the owner through
//                      Email Routing and saves it to the staff app's Inbox (Supabase).
//   POST /api/reply    staff app Inbox: previews or sends a branded reply to a request, or a new email,
//                      through Gmail (app password), from the business address.
//                      Owners and managers only.

import { EmailMessage } from 'cloudflare:email';
import { connect } from 'cloudflare:sockets';

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

// Shared black-and-gold frame for every email the site sends.
const emailTop = title => `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title></head>
<body style="margin:0;padding:0;background:#f4f1ea">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f1ea"><tr><td align="center" style="padding:24px 12px">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background:#ffffff;border:1px solid #e6e0d0">
    <tr><td style="background:#0b0b0c;border-bottom:3px solid #c9a227;padding:22px 28px">
      <span style="font:700 20px Georgia,'Times New Roman',serif;letter-spacing:.12em;color:#c9a227">&#9733;</span>
      <span style="font:700 17px Georgia,'Times New Roman',serif;letter-spacing:.1em;color:#f2efe6">&nbsp;R L FREDERICK</span>
      <div style="font:12px Arial,sans-serif;letter-spacing:.14em;color:#b8b3a6;margin-top:4px">PRIVATE SECURITY &amp; WEAPON SAFETY</div>
    </td></tr>`;
const emailBottom = note => `    <tr><td style="background:#0b0b0c;padding:14px 28px;font:12px Arial,sans-serif;color:#b8b3a6">${note}</td></tr>
  </table>
</td></tr></table>
</body></html>`;

// Branded HTML version of the request. Tables and inline styles, because email apps
// (Gmail, Outlook, Apple Mail) ignore most page-style CSS.
function requestHtml({ name, email, org, phone, need, message }) {
  const row = (label, value) => `<tr>
      <td style="padding:10px 0;border-bottom:1px solid #e6e0d0;width:130px;vertical-align:top;font:600 12px Arial,sans-serif;letter-spacing:.08em;text-transform:uppercase;color:#8a6d12">${label}</td>
      <td style="padding:10px 0;border-bottom:1px solid #e6e0d0;vertical-align:top;font:16px Arial,sans-serif;color:#141413">${value}</td></tr>`;
  const tel = phone.replace(/[^\d+]/g, '');
  const button = (href, label, dark) => `<a href="${href}" style="display:inline-block;margin:0 8px 8px 0;padding:13px 22px;border-radius:4px;font:700 15px Arial,sans-serif;text-decoration:none;${dark ? 'background:#0b0b0c;color:#f2efe6' : 'background:#c9a227;color:#0b0b0c'}">${label}</a>`;
  return `${emailTop('Website request')}
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
${emailBottom('Sent from the contact form at <a href="https://rlfsecurity.com" style="color:#c9a227">rlfsecurity.com</a>')}`;
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

  // Email the owner and save to the Inbox. Either one is enough for the visitor.
  const [sent, saved] = await Promise.allSettled([
    env.CONTACT_EMAIL.send(new EmailMessage(FROM, to, raw)),
    saveRequest(env, { name, email, phone, organization: org, need, message })
  ]);
  if (sent.status === 'rejected') console.error('contact form email failed', sent.reason);
  if (saved.status === 'rejected') console.error('contact form save failed', saved.reason);
  if (sent.status === 'rejected' && saved.status === 'rejected') return json({ error: 'The message could not be sent.' }, 502);
  return json({ ok: true });
}

/* ---------------- Supabase (the staff app's database) ---------------- */

const sbHeaders = (env, auth) => ({ apikey: env.SUPABASE_KEY, 'content-type': 'application/json', ...(auth ? { authorization: auth } : {}) });

async function saveRequest(env, row) {
  const r = await fetch(`${env.SUPABASE_URL}/rest/v1/messages`, { method: 'POST', headers: { ...sbHeaders(env), prefer: 'return=minimal' }, body: JSON.stringify(row) });
  if (!r.ok) throw new Error(`Inbox save failed (${r.status}): ${await r.text()}`);
}

// The signed-in staff member making this request, if they are an owner or manager.
async function staffFrom(request, env) {
  const auth = request.headers.get('authorization') || '';
  if (!/^Bearer \S+$/.test(auth)) return null;
  const u = await fetch(`${env.SUPABASE_URL}/auth/v1/user`, { headers: sbHeaders(env, auth) });
  if (!u.ok) return null;
  const r = await fetch(`${env.SUPABASE_URL}/rest/v1/rpc/app_role`, { method: 'POST', headers: sbHeaders(env, auth), body: '{}' });
  const role = r.ok ? await r.json() : null;
  return role === 'owner' || role === 'manager' ? { auth, user: await u.json() } : null;
}

/* ---------------- Replies from the staff app ---------------- */

const niceDate = iso => new Date(iso).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric', timeZone: 'America/Detroit' });
// Blank lines start a new paragraph; single line breaks stay as line breaks.
const paragraphs = text => text.split(/\n\s*\n/).map(p => p.trim()).filter(Boolean)
  .map(p => `<p style="margin:0 0 16px;font:16px/1.6 Arial,sans-serif;color:#141413">${esc(p).replace(/\n/g, '<br>')}</p>`).join('');

function replyContent({ msg, body, senderName, senderTitle, site, from }) {
  const phones = [site.phone || '313-693-5829', site.phoneOffice].filter(Boolean);
  const phoneLabels = site.phoneOffice ? ['Direct', 'Office'] : ['Phone'];
  const telLink = p => `<a href="tel:${esc(p.replace(/[^\d+]/g, ''))}" style="color:#8a6d12;text-decoration:none">${esc(p)}</a>`;
  const html = `${emailTop('Reply from R L Frederick Private Security')}
    <tr><td style="padding:30px 28px 6px">
      ${paragraphs(body)}
    </td></tr>
    <tr><td style="padding:0 28px 26px">
      <table role="presentation" cellpadding="0" cellspacing="0" style="border-top:2px solid #c9a227;padding-top:14px"><tr><td style="padding-top:14px">
        <div style="font:700 18px Georgia,'Times New Roman',serif;color:#141413">${esc(senderName)}</div>
        ${senderTitle ? `<div style="font:14px Arial,sans-serif;color:#5f5b52;margin-top:2px">${esc(senderTitle)}</div>` : ''}
        <div style="font:600 13px Arial,sans-serif;letter-spacing:.06em;color:#8a6d12;margin-top:8px">R L FREDERICK PRIVATE SECURITY &amp; WEAPON SAFETY</div>
        <div style="font:14px/1.7 Arial,sans-serif;color:#141413;margin-top:6px">
          ${phones.map((p, i) => `${phoneLabels[i]}: ${telLink(p)}`).join('<br>')}<br>
          <a href="mailto:${esc(from)}" style="color:#8a6d12;text-decoration:none">${esc(from)}</a> &middot; <a href="https://rlfsecurity.com" style="color:#8a6d12;text-decoration:none">rlfsecurity.com</a>
        </div>
      </td></tr></table>
    </td></tr>
    ${msg ? `<tr><td style="padding:0 28px 28px">
      <div style="font:600 12px Arial,sans-serif;letter-spacing:.08em;text-transform:uppercase;color:#9a958a;margin-bottom:8px">Your request on ${esc(niceDate(msg.created_at))}${msg.need ? ` &middot; ${esc(msg.need)}` : ''}</div>
      <div style="background:#faf8f2;border-left:3px solid #d9d4c7;padding:12px 16px;font:14px/1.55 Arial,sans-serif;color:#5f5b52;white-space:pre-wrap">${esc(msg.message)}</div>
    </td></tr>` : ''}
${emailBottom('R L Frederick Private Security &amp; Weapon Safety &middot; Detroit, Michigan &middot; <a href="https://rlfsecurity.com" style="color:#c9a227">rlfsecurity.com</a>')}`;
  const text = [
    body.trim(), '', '--', senderName, senderTitle, 'R L Frederick Private Security & Weapon Safety',
    ...phones.map((p, i) => `${phoneLabels[i]}: ${p}`), from, 'rlfsecurity.com',
    ...(msg ? ['', `Your request on ${niceDate(msg.created_at)}${msg.need ? ` (${msg.need})` : ''}:`, ...msg.message.split('\n').map(l => `> ${l}`)] : [])
  ].filter(l => l !== undefined && l !== null).join('\n');
  return { html, text };
}

// A complete email (plain text and HTML versions) ready to hand to a mail server.
function mimeMessage({ from, fromAddress, to, replyTo, subject, text, html }) {
  const boundary = `rlf-${crypto.randomUUID()}`;
  return [
    `From: ${encodeWord(from)} <${fromAddress}>`,
    `To: <${to}>`,
    `Reply-To: <${replyTo}>`,
    `Subject: ${encodeWord(subject)}`,
    `Date: ${new Date().toUTCString()}`,
    `Message-ID: <${crypto.randomUUID()}@rlfsecurity.com>`,
    `MIME-Version: 1.0`,
    `Content-Type: multipart/alternative; boundary="${boundary}"`,
    ``,
    `--${boundary}`,
    `Content-Type: text/plain; charset=utf-8`,
    `Content-Transfer-Encoding: base64`,
    ``,
    wrap76(b64(text)),
    `--${boundary}`,
    `Content-Type: text/html; charset=utf-8`,
    `Content-Transfer-Encoding: base64`,
    ``,
    wrap76(b64(html)),
    `--${boundary}--`,
    ``
  ].join('\r\n');
}

// Send through Gmail's mail server with the account's app password (encrypted TLS on
// port 465). Gmail allows the From address because it is a "Send mail as" address on
// that account, and it files a copy in Gmail's Sent folder.
async function smtpSend(env, { from, to, raw }) {
  const host = env.SMTP_HOST || 'smtp.gmail.com', port = Number(env.SMTP_PORT || 465);
  const socket = connect({ hostname: host, port }, { secureTransport: env.SMTP_TLS === 'off' ? 'off' : 'on' });
  const writer = socket.writable.getWriter(), reader = socket.readable.getReader();
  const enc = new TextEncoder(), dec = new TextDecoder();
  let buf = '';
  // Read one full server reply (the last line has a space after the 3-digit code).
  const reply = async () => {
    for (;;) {
      const lines = buf.split('\r\n');
      for (let i = 0; i < lines.length - 1; i++) {
        if (/^\d{3} /.test(lines[i])) { const text = lines.slice(0, i + 1).join('\n'); buf = lines.slice(i + 1).join('\r\n'); return { code: Number(lines[i].slice(0, 3)), text }; }
      }
      const { value, done } = await reader.read();
      if (done) throw new Error('The mail server closed the connection.');
      buf += dec.decode(value, { stream: true });
    }
  };
  const step = async (line, ok, what) => {
    if (line !== null) await writer.write(enc.encode(line + '\r\n'));
    const r = await reply();
    if (!ok.includes(r.code)) throw new Error(`${what} failed (${r.text.split('\n').pop()})`);
    return r;
  };
  try {
    await step(null, [220], 'Connecting to Gmail');
    await step('EHLO rlfsecurity.com', [250], 'Greeting Gmail');
    const user = env.GMAIL_USER, pass = String(env.GMAIL_APP_PASSWORD).replace(/\s+/g, '');
    await step(`AUTH PLAIN ${b64(`\0${user}\0${pass}`)}`, [235], 'Signing in to Gmail (check the app password)');
    await step(`MAIL FROM:<${from}>`, [250], 'Sender');
    for (const rcpt of to) await step(`RCPT TO:<${rcpt}>`, [250, 251], `Recipient ${rcpt}`);
    await step('DATA', [354], 'Starting the message');
    // Lines that begin with a dot get a second dot (SMTP rule); the lone dot ends the message.
    await step(raw.replace(/\r\n\./g, '\r\n..') + '\r\n.', [250], 'Sending');
    await writer.write(enc.encode('QUIT\r\n')).catch(() => {});
  } finally {
    try { await socket.close(); } catch {}
  }
}

async function handleReply(request, env) {
  const staff = await staffFrom(request, env);
  if (!staff) return json({ error: 'Please sign in again. Only owners and managers can send replies.' }, 401);
  let f;
  try { f = await request.json(); } catch { return json({ error: 'Bad request.' }, 400); }

  // A reply names the request (messageId); a new email names the recipient (to, toName).
  const id = clean(f.messageId, 60);
  const subject = oneLine(clean(f.subject, 200));
  const body = clean(f.body, 20000);
  const senderName = oneLine(clean(f.senderName, 80)).replace(/[<>"]/g, '');
  const senderTitle = oneLine(clean(f.senderTitle, 80));
  if (id && !/^[0-9a-f-]{36}$/i.test(id)) return json({ error: 'That request could not be found.' }, 400);
  if (!subject || !body || !senderName) return json({ error: 'Add a subject, a message and your name.' }, 400);

  const w = await fetch(`${env.SUPABASE_URL}/rest/v1/website?select=data&id=eq.1`, { headers: sbHeaders(env) });
  const site = (w.ok ? ((await w.json())[0] || {}).data : null) || {};
  let msg = null, toEmail, toName;
  if (id) {
    const m = await fetch(`${env.SUPABASE_URL}/rest/v1/messages?id=eq.${id}&select=*`, { headers: sbHeaders(env, staff.auth) });
    msg = m.ok ? (await m.json())[0] : null;
    if (!msg) return json({ error: 'That request could not be found.' }, 404);
    toEmail = msg.email; toName = msg.name;
  } else {
    toEmail = oneLine(clean(f.to, 200)); toName = oneLine(clean(f.toName, 120));
    if (!/^[^\s@<>,;]+@[^\s@<>,;]+\.[^\s@<>,;]+$/.test(toEmail)) return json({ error: 'Check the email address you are sending to.' }, 400);
  }

  const from = env.REPLY_FROM;
  const { html, text } = replyContent({ msg, body, senderName, senderTitle, site, from });
  if (!f.send) return json({ ok: true, preview: html, to: toEmail });

  if (!env.GMAIL_APP_PASSWORD) return json({ error: 'Sending replies is not switched on yet. The Gmail app password still needs to be added in Cloudflare.' }, 503);
  const raw = mimeMessage({ from: `${senderName} · R L Frederick Private Security`, fromAddress: from, to: toEmail, replyTo: from, subject, text, html });
  try {
    await smtpSend(env, { from, to: [toEmail], raw });
  } catch (e) {
    console.error('reply send failed', e);
    return json({ error: `The reply could not be sent. ${e.message || ''}`.trim() }, 502);
  }

  // Keep a copy in Sent and, for a reply, mark the request answered.
  const now = new Date().toISOString(), saves = [
    fetch(`${env.SUPABASE_URL}/rest/v1/message_replies`, { method: 'POST', headers: { ...sbHeaders(env, staff.auth), prefer: 'return=minimal' },
      body: JSON.stringify({ message_id: id || null, to_email: toEmail, to_name: toName, subject, body, sender_name: senderName, sent_by: staff.user.id }) })];
  if (id) saves.push(fetch(`${env.SUPABASE_URL}/rest/v1/messages?id=eq.${id}`, { method: 'PATCH', headers: { ...sbHeaders(env, staff.auth), prefer: 'return=minimal' },
    body: JSON.stringify({ status: msg.status === 'new' ? 'replied' : msg.status, read_at: msg.read_at || now }) }));
  await Promise.allSettled(saves);
  return json({ ok: true });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const routes = { '/api/contact': handleContact, '/api/reply': handleReply };
    const handler = routes[url.pathname];
    if (handler) {
      if (request.method !== 'POST') return json({ error: 'Method not allowed.' }, 405);
      return handler(request, env);
    }
    return env.ASSETS.fetch(request);
  }
};
