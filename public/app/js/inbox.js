/* ================= inbox (website requests and replies) ================= */
/* Requests arrive from the website contact form (saved by the site's server).
   Replies go out as branded emails through /api/reply, which checks the sign-in
   and sends from the business address. */
const INBOX = { list: null, replies: [], view: "open", drafts: {}, countAt: 0 };
const INBOX_PLACEHOLDER = "[Write your answer here.]";

async function loadInbox() {
  const [m, r] = await Promise.all([
    sb.from("messages").select("*").order("created_at", { ascending: false }).limit(300),
    sb.from("message_replies").select("*").order("created_at", { ascending: true })
  ]);
  if (m.error) throw m.error; if (r.error) throw r.error;
  INBOX.list = m.data; INBOX.replies = r.data;
  S.inboxNew = m.data.filter(x => !x.read_at && x.status !== "archived").length;
}

/* Keep the tab badge current without loading the whole inbox. */
async function refreshInboxCount() {
  if (!isMgr() || Date.now() - INBOX.countAt < 60000) return; INBOX.countAt = Date.now();
  const r = await sb.from("messages").select("id", { count: "exact", head: true }).is("read_at", null).neq("status", "archived");
  if (!r.error && r.count !== S.inboxNew) { S.inboxNew = r.count; render(); }
}

const inboxDay = iso => new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
const inboxWhen = iso => { const d = new Date(iso), today = new Date(); return d.toDateString() === today.toDateString() ? niceTime(iso) : inboxDay(iso); };

async function renderInbox() {
  const v = $("#v-inbox"); if (document.activeElement && v.contains(document.activeElement) && document.activeElement.tagName !== "BUTTON") return;
  if (!INBOX.list) { v.innerHTML = `<h2>Inbox</h2><p class="help">Loading...</p>`; try { await loadInbox(); } catch (e) { v.innerHTML = `<h2>Inbox</h2><p class="note">The inbox could not be loaded. ${esc(e.message)}</p>`; return; } }
  const archived = INBOX.view === "archived", rows = INBOX.list.filter(x => (x.status === "archived") === archived);
  v.innerHTML = `<h2>Inbox</h2><p class="help">Requests sent through the contact form on rlfsecurity.com. Open one to reply with a designed email from ${esc("rolandfrederick@rlfsecurity.com")}.</p>
    <div class="seg" style="max-width:360px;margin-bottom:14px"><button data-iview="open" aria-pressed="${!archived}">Open</button><button data-iview="archived" aria-pressed="${archived}">Archived</button></div>
    ${rows.length ? `<ul class="list">${rows.map(x => { const n = INBOX.replies.filter(r => r.message_id === x.id).length;
      return `<li><button class="rowbtn" data-msg="${esc(x.id)}"><span class="main"><b style="${x.read_at ? "font-weight:500" : ""}">${esc(x.name)}${x.need ? ` <small>· ${esc(x.need)}</small>` : ""}</b><small>${esc(x.message.slice(0, 110))}${x.message.length > 110 ? "..." : ""}</small></span>
        <span style="text-align:right;flex:none"><small class="num" style="color:var(--muted)">${esc(inboxWhen(x.created_at))}</small><br>${!x.read_at ? `<span class="tag c">New</span>` : n ? `<span class="tag ok">Replied${n > 1 ? ` ×${n}` : ""}</span>` : ""}</span></button></li>`; }).join("")}</ul>`
      : `<p class="empty">${archived ? "Nothing archived." : "No requests yet. They appear here as soon as someone uses the contact form."}</p>`}`;
  v.querySelectorAll("[data-iview]").forEach(b => b.onclick = () => { INBOX.view = b.dataset.iview; renderInbox(); });
  v.querySelectorAll("[data-msg]").forEach(b => b.onclick = () => inboxSheet(b.dataset.msg));
}

function inboxDraft(x) {
  if (INBOX.drafts[x.id]) return INBOX.drafts[x.id];
  const first = (x.name.split(/\s+/)[0] || x.name), topic = x.need ? x.need.charAt(0).toLowerCase() + x.need.slice(1) : "your request";
  let title = ""; try { title = localStorage.getItem("rlf_sig_title") || ""; } catch (e) {}
  return INBOX.drafts[x.id] = {
    subject: `Re: Your request about ${topic}`,
    body: `Hi ${first},\n\nThank you for contacting R L Frederick Private Security about ${topic}.\n\n${INBOX_PLACEHOLDER}\n\nBest regards,`,
    senderName: S.me.full_name || "", senderTitle: title || (S.me.role === "owner" ? "Chief Executive Officer" : "Manager")
  };
}

async function inboxCall(payload) {
  const { data } = await sb.auth.getSession(); const token = data && data.session && data.session.access_token;
  if (!token) throw new Error("Please sign in again.");
  const r = await fetch("/api/reply", { method: "POST", headers: { "content-type": "application/json", authorization: `Bearer ${token}` }, body: JSON.stringify(payload) });
  const j = await r.json().catch(() => ({})); if (!r.ok) throw new Error(j.error || "Something went wrong. Try again."); return j;
}

async function inboxSheet(id) {
  const x = INBOX.list.find(m => m.id === id); if (!x) return;
  if (!x.read_at) { const now = new Date().toISOString(); x.read_at = now; S.inboxNew = Math.max(0, (S.inboxNew || 0) - 1);
    sb.from("messages").update({ read_at: now }).eq("id", id).then(r => { if (r.error) console.error(r.error); }); }
  const d = inboxDraft(x), sent = INBOX.replies.filter(r => r.message_id === id), tel = x.phone.replace(/[^\d+]/g, "");
  openSheet(`<div class="bar"><h2>${esc(x.name)}</h2><button class="ghost" data-close>Close</button></div>
    <p class="help" style="margin-top:0">${esc(x.need || "General question")} · ${esc(inboxDay(x.created_at))} at ${esc(niceTime(x.created_at))}</p>
    <dl class="kv"><dt>Email</dt><dd><a href="mailto:${esc(x.email)}">${esc(x.email)}</a></dd><dt>Phone</dt><dd>${x.phone ? `<a href="tel:${esc(tel)}">${esc(x.phone)}</a>` : "Not given"}</dd><dt>Organization</dt><dd>${esc(x.organization || "Not given")}</dd></dl>
    <div class="inbox-msg">${esc(x.message)}</div>
    ${sent.length ? `<h3>Replies sent</h3>${sent.map(r => `<details class="inbox-reply"><summary><b>${esc(r.sender_name || "Reply")}</b> · ${esc(inboxDay(r.created_at))} ${esc(niceTime(r.created_at))}</summary><div class="inbox-msg">${esc(r.body)}</div></details>`).join("")}` : ""}
    <h3>${sent.length ? "Send another reply" : "Reply"}</h3>
    <label class="f" for="ib-subject">Subject</label><input id="ib-subject" type="text" value="${esc(d.subject)}">
    <label class="f" for="ib-body">Message</label><textarea id="ib-body" rows="10">${esc(d.body)}</textarea>
    <p class="help">Write it like a normal email. Your name, title, phone numbers, email and website are added below it automatically, with their original request quoted at the bottom. Leave a blank line to start a new paragraph.</p>
    <div class="grid2"><div><label class="f" for="ib-name">Sign as</label><input id="ib-name" type="text" value="${esc(d.senderName)}"></div><div><label class="f" for="ib-title">Title</label><input id="ib-title" type="text" value="${esc(d.senderTitle)}"></div></div>
    <div class="actions"><button class="ghost" id="ib-preview">Preview email</button><button class="primary" id="ib-send" style="margin-top:0">Send reply</button></div>
    <div id="ib-previewbox" hidden><h3>Preview: what ${esc(x.name.split(/\s+/)[0])} will see</h3><iframe id="ib-frame" class="inbox-frame" sandbox title="Email preview"></iframe></div>
    <div class="actions" style="border-top:1px solid var(--line);padding-top:12px;margin-top:18px">
      <button class="ghost" id="ib-archive">${x.status === "archived" ? "Move back to Open" : "Archive"}</button><button class="ghost" id="ib-unread">Mark as unread</button></div>`);
  const keep = () => { d.subject = $("#ib-subject").value; d.body = $("#ib-body").value; d.senderName = $("#ib-name").value; d.senderTitle = $("#ib-title").value; };
  ["#ib-subject", "#ib-body", "#ib-name", "#ib-title"].forEach(s => $(s).addEventListener("input", keep));
  const body = $("#ib-body"), at = body.value.indexOf(INBOX_PLACEHOLDER); if (at >= 0 && !matchMedia("(hover: none)").matches) { body.focus(); body.setSelectionRange(at, at + INBOX_PLACEHOLDER.length); }
  const payload = send => ({ messageId: id, subject: d.subject.trim(), body: d.body, senderName: d.senderName.trim(), senderTitle: d.senderTitle.trim(), send });
  const check = () => { keep(); if (d.body.includes(INBOX_PLACEHOLDER)) { toast("Replace [Write your answer here.] with your answer first."); body.focus(); return false; }
    if (!d.subject.trim() || !d.body.trim() || !d.senderName.trim()) { toast("Add a subject, a message and your name."); return false; } return true; };
  $("#ib-preview").onclick = async () => { keep(); const b = $("#ib-preview"); b.disabled = true;
    try { const j = await inboxCall(payload(false)); $("#ib-previewbox").hidden = false; $("#ib-frame").srcdoc = j.preview; $("#ib-previewbox").scrollIntoView({ behavior: "smooth", block: "start" }); }
    catch (e) { fail(e); } finally { b.disabled = false; } };
  $("#ib-send").onclick = async () => { if (!check() || !confirm(`Send this reply to ${x.email}?`)) return; const b = $("#ib-send"); b.disabled = true; b.textContent = "Sending...";
    try { await inboxCall(payload(true)); try { localStorage.setItem("rlf_sig_title", d.senderTitle.trim()); } catch (e) {}
      delete INBOX.drafts[id]; closeSheet(); toast(`Reply sent to ${x.email}`); await loadInbox(); renderInbox(); }
    catch (e) { fail(e); b.disabled = false; b.textContent = "Send reply"; } };
  $("#ib-archive").onclick = async () => { const status = x.status === "archived" ? (sent.length ? "replied" : "new") : "archived";
    const r = await sb.from("messages").update({ status }).eq("id", id); if (r.error) return fail(r.error); x.status = status; closeSheet(); toast(status === "archived" ? "Archived" : "Moved back to Open"); renderInbox(); };
  $("#ib-unread").onclick = async () => { const r = await sb.from("messages").update({ read_at: null }).eq("id", id); if (r.error) return fail(r.error);
    x.read_at = null; S.inboxNew = (S.inboxNew || 0) + 1; closeSheet(); render(); };
  if (S.tab === "inbox") renderInbox();
}
