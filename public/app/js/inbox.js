/* ================= inbox (website requests, sent emails, compose) ================= */
/* Requests arrive from the website contact form (saved by the site's server).
   Replies and new emails go out as branded emails through /api/reply, which checks
   the sign-in and sends from the business address through Gmail.
   Folders: Inbox (open requests), Sent, Archived, Trash. Trash lives only in this
   app; Gmail is not changed. */
const INBOX = { list: null, sent: [], folder: "inbox", drafts: {}, countAt: 0 };
const INBOX_PLACEHOLDERS = ["[Write your answer here.]", "[Write your message here.]", "[Name]"];
const INBOX_FOLDERS = [["inbox", "Inbox"], ["sent", "Sent"], ["archived", "Archived"], ["trash", "Trash"]];

async function loadInbox() {
  const [m, r] = await Promise.all([
    sb.from("messages").select("*").order("created_at", { ascending: false }).limit(500),
    sb.from("message_replies").select("*").order("created_at", { ascending: false }).limit(500)
  ]);
  if (m.error) throw m.error; if (r.error) throw r.error;
  INBOX.list = m.data; INBOX.sent = r.data;
  S.inboxNew = m.data.filter(x => !x.read_at && (x.status === "new" || x.status === "replied")).length;
}

/* Keep the tab badge current without loading the whole inbox. */
async function refreshInboxCount() {
  if (!isMgr() || Date.now() - INBOX.countAt < 60000) return; INBOX.countAt = Date.now();
  const r = await sb.from("messages").select("id", { count: "exact", head: true }).is("read_at", null).in("status", ["new", "replied"]);
  if (!r.error && r.count !== S.inboxNew) { S.inboxNew = r.count; render(); }
}

const inboxDay = iso => new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
const inboxWhen = iso => { const d = new Date(iso), today = new Date(); return d.toDateString() === today.toDateString() ? niceTime(iso) : inboxDay(iso); };
const inboxSnippet = t => esc(t.replace(/\s+/g, " ").slice(0, 110)) + (t.length > 110 ? "..." : "");
const repliesFor = id => INBOX.sent.filter(r => r.message_id === id && r.status !== "trash");

function inboxRows(folder) {
  if (folder === "sent") return INBOX.sent.filter(r => r.status !== "trash").map(r => ({ kind: "sent", at: r.created_at, x: r }));
  if (folder === "trash") return [...INBOX.list.filter(x => x.status === "trash").map(x => ({ kind: "msg", at: x.created_at, x })),
    ...INBOX.sent.filter(r => r.status === "trash").map(r => ({ kind: "sent", at: r.created_at, x: r }))].sort((a, b) => b.at.localeCompare(a.at));
  const want = folder === "archived" ? ["archived"] : ["new", "replied"];
  return INBOX.list.filter(x => want.includes(x.status)).map(x => ({ kind: "msg", at: x.created_at, x }));
}

function inboxRow({ kind, x }) {
  if (kind === "sent") return `<li><button class="rowbtn" data-sent="${esc(x.id)}"><span class="main"><b style="font-weight:500">To: ${esc(x.to_name || x.to_email)}</b><small><b>${esc(x.subject)}</b> · ${inboxSnippet(x.body)}</small></span>
    <span style="text-align:right;flex:none"><small class="num" style="color:var(--muted)">${esc(inboxWhen(x.created_at))}</small><br><span class="tag">${x.message_id ? "Reply" : "New email"}</span></span></button></li>`;
  const n = repliesFor(x.id).length;
  return `<li><button class="rowbtn" data-msg="${esc(x.id)}"><span class="main"><b style="${x.read_at ? "font-weight:500" : ""}">${esc(x.name)}${x.need ? ` <small>· ${esc(x.need)}</small>` : ""}</b><small>${inboxSnippet(x.message)}</small></span>
    <span style="text-align:right;flex:none"><small class="num" style="color:var(--muted)">${esc(inboxWhen(x.created_at))}</small><br>${!x.read_at ? `<span class="tag c">New</span>` : n ? `<span class="tag ok">Replied${n > 1 ? ` ×${n}` : ""}</span>` : ""}</span></button></li>`;
}

async function renderInbox() {
  const v = $("#v-inbox"); if (document.activeElement && v.contains(document.activeElement) && document.activeElement.tagName !== "BUTTON") return;
  if (!INBOX.list) { v.innerHTML = `<h2>Inbox</h2><p class="help">Loading...</p>`; try { await loadInbox(); } catch (e) { v.innerHTML = `<h2>Inbox</h2><p class="note">The inbox could not be loaded. ${esc(e.message)}</p>`; return; } }
  const f = INBOX.folder, rows = inboxRows(f), trashCount = inboxRows("trash").length;
  const empty = { inbox: "No open requests. They appear here as soon as someone uses the contact form.", sent: "Nothing sent yet. Replies and new emails you send show up here.",
    archived: "Nothing archived.", trash: "Trash is empty." }[f];
  v.innerHTML = `<div class="inbox-head"><h2>Inbox</h2><button class="primary" id="ib-compose" style="margin:0">Compose</button></div>
    <p class="help">Website requests and the emails you send from ${esc("rolandfrederick@rlfsecurity.com")}. Trash only affects this app, not Gmail.</p>
    <div class="seg inbox-folders" role="group" aria-label="Folders">${INBOX_FOLDERS.map(([k, n]) => `<button data-ifolder="${k}" aria-pressed="${f === k}">${n}${k === "inbox" && S.inboxNew ? ` (${S.inboxNew})` : k === "trash" && trashCount ? ` (${trashCount})` : ""}</button>`).join("")}</div>
    ${f === "trash" && rows.length ? `<div class="actions" style="margin:0 0 12px"><button class="ghost" id="ib-empty" style="color:var(--danger);border-color:var(--danger)">Empty trash</button></div>` : ""}
    ${rows.length ? `<ul class="list">${rows.map(inboxRow).join("")}</ul>` : `<p class="empty">${empty}</p>`}`;
  $("#ib-compose").onclick = () => composeSheet();
  v.querySelectorAll("[data-ifolder]").forEach(b => b.onclick = () => { INBOX.folder = b.dataset.ifolder; renderInbox(); });
  v.querySelectorAll("[data-msg]").forEach(b => b.onclick = () => inboxSheet(b.dataset.msg));
  v.querySelectorAll("[data-sent]").forEach(b => b.onclick = () => sentSheet(b.dataset.sent));
  const e = $("#ib-empty"); if (e) e.onclick = async () => {
    if (!confirm(`Delete everything in Trash for good (${rows.length} item${rows.length > 1 ? "s" : ""})? This cannot be undone. Gmail is not affected.`)) return;
    const a = await sb.from("messages").delete().eq("status", "trash"), b = await sb.from("message_replies").delete().eq("status", "trash");
    if (a.error || b.error) return fail(a.error || b.error); toast("Trash emptied"); await inboxReload(); };
}

async function inboxReload() { try { await loadInbox(); } catch (e) { fail(e); } render(); }

async function inboxCall(payload) {
  const { data } = await sb.auth.getSession(); const token = data && data.session && data.session.access_token;
  if (!token) throw new Error("Please sign in again.");
  const r = await fetch("/api/reply", { method: "POST", headers: { "content-type": "application/json", authorization: `Bearer ${token}` }, body: JSON.stringify(payload) });
  const j = await r.json().catch(() => ({})); if (!r.ok) throw new Error(j.error || "Something went wrong. Try again."); return j;
}

function sigDefaults() { let title = ""; try { title = localStorage.getItem("rlf_sig_title") || ""; } catch (e) {}
  return { senderName: S.me.full_name || "", senderTitle: title || (S.me.role === "owner" ? "Chief Executive Officer" : "Manager") }; }

/* The writing area shared by replies and new emails. */
function composerHtml(d, { toFields, help, sendLabel }) {
  return `${toFields ? `<div class="grid2"><div><label class="f" for="ib-to">To (email address)</label><input id="ib-to" type="email" value="${esc(d.to)}" placeholder="name@example.com" autocomplete="off"></div>
      <div><label class="f" for="ib-toname">Their name (for the greeting)</label><input id="ib-toname" type="text" value="${esc(d.toName)}" autocomplete="off"></div></div>` : ""}
    <label class="f" for="ib-subject">Subject</label><input id="ib-subject" type="text" value="${esc(d.subject)}">
    <label class="f" for="ib-body">Message</label><textarea id="ib-body" rows="10">${esc(d.body)}</textarea>
    <p class="help">${help} Leave a blank line to start a new paragraph.</p>
    <div class="grid2"><div><label class="f" for="ib-name">Sign as</label><input id="ib-name" type="text" value="${esc(d.senderName)}"></div><div><label class="f" for="ib-title">Title</label><input id="ib-title" type="text" value="${esc(d.senderTitle)}"></div></div>
    <div class="actions"><button class="ghost" id="ib-preview">Preview email</button><button class="primary" id="ib-send" style="margin-top:0">${sendLabel}</button></div>
    <div id="ib-previewbox" hidden><h3>Preview: what they will see</h3><iframe id="ib-frame" class="inbox-frame" sandbox title="Email preview"></iframe></div>`;
}

function wireComposer(d, { extra, recipient, onSent }) {
  const fields = { subject: "#ib-subject", body: "#ib-body", senderName: "#ib-name", senderTitle: "#ib-title", to: "#ib-to", toName: "#ib-toname" };
  const keep = () => Object.entries(fields).forEach(([k, s]) => { if ($(s)) d[k] = $(s).value; });
  Object.values(fields).forEach(s => { if ($(s)) $(s).addEventListener("input", keep); });
  // The greeting follows their first name as it is typed (until the greeting is edited by hand).
  const tn = $("#ib-toname"); if (tn) tn.addEventListener("input", () => {
    const b = $("#ib-body"), first = tn.value.trim().split(/\s+/)[0] || "", now = d.autoName ? `Hi ${d.autoName},` : "Hi [Name],";
    if (!b.value.includes(now)) return;
    b.value = b.value.replace(now, first ? `Hi ${first},` : "Hi [Name],"); d.autoName = first; keep(); });
  const body = $("#ib-body"), ph = INBOX_PLACEHOLDERS.find(p => body.value.includes(p) && p !== "[Name]");
  if (ph && !$("#ib-to") && !matchMedia("(hover: none)").matches) { const at = body.value.indexOf(ph); body.focus(); body.setSelectionRange(at, at + ph.length); }
  const payload = send => ({ ...extra(d), subject: d.subject.trim(), body: d.body, senderName: d.senderName.trim(), senderTitle: d.senderTitle.trim(), send });
  const check = () => { keep(); const left = INBOX_PLACEHOLDERS.find(p => d.body.includes(p));
    if (left) { toast(`Replace ${left} in the message first.`); body.focus(); return false; }
    if ($("#ib-to") && !/^[^\s@<>,;]+@[^\s@<>,;]+\.[^\s@<>,;]+$/.test(d.to.trim())) { toast("Check the email address you are sending to."); $("#ib-to").focus(); return false; }
    if (!d.subject.trim() || !d.body.trim() || !d.senderName.trim()) { toast("Add a subject, a message and your name."); return false; } return true; };
  $("#ib-preview").onclick = async () => { keep(); if ($("#ib-to") && !d.to.trim()) return toast("Add the email address first."); const b = $("#ib-preview"); b.disabled = true;
    try { const j = await inboxCall(payload(false)); $("#ib-previewbox").hidden = false; $("#ib-frame").srcdoc = j.preview; $("#ib-previewbox").scrollIntoView({ behavior: "smooth", block: "start" }); }
    catch (e) { fail(e); } finally { b.disabled = false; } };
  $("#ib-send").onclick = async () => { if (!check() || !confirm(`Send this email to ${recipient(d)}?`)) return; const b = $("#ib-send"), label = b.textContent; b.disabled = true; b.textContent = "Sending...";
    try { await inboxCall(payload(true)); try { localStorage.setItem("rlf_sig_title", d.senderTitle.trim()); } catch (e) {}
      closeSheet(); toast(`Sent to ${recipient(d)}`); onSent(); await inboxReload(); }
    catch (e) { fail(e); b.disabled = false; b.textContent = label; } };
}

/* A website request: details, replies sent, reply box, and folder actions. */
async function inboxSheet(id) {
  const x = INBOX.list.find(m => m.id === id); if (!x) return;
  if (!x.read_at) { const now = new Date().toISOString(); x.read_at = now; S.inboxNew = Math.max(0, (S.inboxNew || 0) - 1);
    sb.from("messages").update({ read_at: now }).eq("id", id).then(r => { if (r.error) console.error(r.error); }); }
  const sent = repliesFor(id).slice().reverse(), tel = x.phone.replace(/[^\d+]/g, ""), trashed = x.status === "trash";
  const first = x.name.split(/\s+/)[0] || x.name, topic = x.need ? x.need.charAt(0).toLowerCase() + x.need.slice(1) : "your request";
  const d = INBOX.drafts[id] || (INBOX.drafts[id] = { subject: `Re: Your request about ${topic}`,
    body: `Hi ${first},\n\nThank you for contacting R L Frederick Private Security about ${topic}.\n\n[Write your answer here.]\n\nBest regards,`, ...sigDefaults() });
  openSheet(`<div class="bar"><h2>${esc(x.name)}</h2><button class="ghost" data-close>Close</button></div>
    <p class="help" style="margin-top:0">${esc(x.need || "General question")} · ${esc(inboxDay(x.created_at))} at ${esc(niceTime(x.created_at))}${trashed ? " · <b>In Trash</b>" : x.status === "archived" ? " · Archived" : ""}</p>
    <dl class="kv"><dt>Email</dt><dd><a href="mailto:${esc(x.email)}">${esc(x.email)}</a></dd><dt>Phone</dt><dd>${x.phone ? `<a href="tel:${esc(tel)}">${esc(x.phone)}</a>` : "Not given"}</dd><dt>Organization</dt><dd>${esc(x.organization || "Not given")}</dd></dl>
    <div class="inbox-msg">${esc(x.message)}</div>
    ${sent.length ? `<h3>Replies sent</h3>${sent.map(r => `<details class="inbox-reply"><summary><b>${esc(r.sender_name || "Reply")}</b> · ${esc(inboxDay(r.created_at))} ${esc(niceTime(r.created_at))}</summary><div class="inbox-msg">${esc(r.body)}</div></details>`).join("")}` : ""}
    ${trashed ? "" : `<h3>${sent.length ? "Send another reply" : "Reply"}</h3>${composerHtml(d, { help: "Write it like a normal email. Your name, title, phone numbers, email and website are added below it automatically, with their original request quoted at the bottom.", sendLabel: "Send reply" })}`}
    <div class="actions" style="border-top:1px solid var(--line);padding-top:12px;margin-top:18px">
      ${trashed ? `<button class="ghost" id="ib-restore">Restore</button><button class="ghost" id="ib-delete" style="color:var(--danger);border-color:var(--danger)">Delete forever</button>`
        : `<button class="ghost" id="ib-archive">${x.status === "archived" ? "Move to Inbox" : "Archive"}</button><button class="ghost" id="ib-unread">Mark as unread</button><button class="ghost" id="ib-trash" style="color:var(--danger);border-color:var(--danger)">Move to Trash</button>`}</div>`);
  if (!trashed) wireComposer(d, { extra: () => ({ messageId: id }), recipient: () => x.email, onSent: () => { delete INBOX.drafts[id]; } });
  const setStatus = async (status, note) => { const r = await sb.from("messages").update({ status }).eq("id", id); if (r.error) return fail(r.error);
    x.status = status; closeSheet(); toast(note); render(); };
  const open = sent.length ? "replied" : "new";
  if ($("#ib-archive")) $("#ib-archive").onclick = () => x.status === "archived" ? setStatus(open, "Moved to Inbox") : setStatus("archived", "Archived");
  if ($("#ib-trash")) $("#ib-trash").onclick = () => setStatus("trash", "Moved to Trash");
  if ($("#ib-restore")) $("#ib-restore").onclick = () => setStatus(open, "Restored to Inbox");
  if ($("#ib-delete")) $("#ib-delete").onclick = async () => { if (!confirm("Delete this request for good? This cannot be undone. Emails you already sent stay in Sent.")) return;
    const r = await sb.from("messages").delete().eq("id", id); if (r.error) return fail(r.error); closeSheet(); toast("Deleted"); await inboxReload(); };
  if ($("#ib-unread")) $("#ib-unread").onclick = async () => { const r = await sb.from("messages").update({ read_at: null }).eq("id", id); if (r.error) return fail(r.error);
    x.read_at = null; S.inboxNew = (S.inboxNew || 0) + 1; closeSheet(); render(); };
  if (S.tab === "inbox") renderInbox();
}

/* An email sent from the app (a reply or a new email). */
function sentSheet(id) {
  const r = INBOX.sent.find(s => s.id === id); if (!r) return;
  const trashed = r.status === "trash", req = r.message_id && INBOX.list.find(m => m.id === r.message_id);
  openSheet(`<div class="bar"><h2>${esc(r.subject)}</h2><button class="ghost" data-close>Close</button></div>
    <p class="help" style="margin-top:0">${r.message_id ? "Reply" : "New email"} sent ${esc(inboxDay(r.created_at))} at ${esc(niceTime(r.created_at))}${trashed ? " · <b>In Trash</b>" : ""}</p>
    <dl class="kv"><dt>To</dt><dd>${esc(r.to_name ? `${r.to_name} <${r.to_email}>` : r.to_email)}</dd><dt>From</dt><dd>${esc(r.sender_name)}</dd></dl>
    <div class="inbox-msg">${esc(r.body)}</div>
    <p class="help">The email also had your signature${r.message_id ? " and their original request" : ""} added below the message.</p>
    <div class="actions" style="border-top:1px solid var(--line);padding-top:12px;margin-top:18px">
      ${req ? `<button class="ghost" id="ib-openreq">Open the request</button>` : ""}
      ${!trashed ? `<button class="ghost" id="ib-again">Write another email to ${esc((r.to_name || r.to_email).split(/\s+/)[0])}</button>` : ""}
      ${trashed ? `<button class="ghost" id="ib-srestore">Restore</button><button class="ghost" id="ib-sdelete" style="color:var(--danger);border-color:var(--danger)">Delete forever</button>`
        : `<button class="ghost" id="ib-strash" style="color:var(--danger);border-color:var(--danger)">Move to Trash</button>`}</div>`);
  const setStatus = async (status, note) => { const q = await sb.from("message_replies").update({ status }).eq("id", id); if (q.error) return fail(q.error);
    r.status = status; closeSheet(); toast(note); render(); };
  if ($("#ib-openreq")) $("#ib-openreq").onclick = () => { closeSheet(); inboxSheet(req.id); };
  if ($("#ib-again")) $("#ib-again").onclick = () => { closeSheet(); composeSheet({ to: r.to_email, toName: r.to_name }); };
  if ($("#ib-strash")) $("#ib-strash").onclick = () => setStatus("trash", "Moved to Trash");
  if ($("#ib-srestore")) $("#ib-srestore").onclick = () => setStatus("sent", "Restored to Sent");
  if ($("#ib-sdelete")) $("#ib-sdelete").onclick = async () => { if (!confirm("Delete this sent email from the app for good? It stays in Gmail's Sent folder.")) return;
    const q = await sb.from("message_replies").delete().eq("id", id); if (q.error) return fail(q.error); closeSheet(); toast("Deleted"); await inboxReload(); };
}

/* A new email to anyone. */
function composeSheet(start) {
  const d = INBOX.drafts.compose && !start ? INBOX.drafts.compose : (INBOX.drafts.compose = { to: "", toName: "", subject: "",
    body: `Hi [Name],\n\n[Write your message here.]\n\nBest regards,`, ...sigDefaults(), ...(start || {}) });
  if (start && start.toName) { d.autoName = start.toName.split(/\s+/)[0]; d.body = d.body.replace("[Name]", d.autoName); }
  openSheet(`<div class="bar"><h2>New email</h2><button class="ghost" data-close>Close</button></div>
    <p class="help" style="margin-top:0">Sent from rolandfrederick@rlfsecurity.com in the black and gold design. A copy is kept in Sent here and in Gmail.</p>
    ${composerHtml(d, { toFields: true, help: "Write it like a normal email. Your name, title, phone numbers, email and website are added below it automatically.", sendLabel: "Send email" })}
    <div class="actions" style="border-top:1px solid var(--line);padding-top:12px;margin-top:18px"><button class="ghost" id="ib-discard">Discard draft</button></div>`);
  wireComposer(d, { extra: x => ({ to: x.to.trim(), toName: x.toName.trim() }), recipient: x => x.to.trim(), onSent: () => { delete INBOX.drafts.compose; } });
  $("#ib-discard").onclick = () => { delete INBOX.drafts.compose; closeSheet(); toast("Draft discarded"); };
}
