/* ================= time off (sick time) ================= */
const REQ_TAG = { pending: ["c", "Waiting"], approved: ["ok", "Approved"], denied: ["no", "Denied"], cancelled: ["", "Cancelled"] };
const DENY_REASONS = ["No sick time available", "Not a covered use", "Still in the waiting period", "Duplicate request"];
const policyVersion = () => Number((S.cfg.sick || {}).policyVersion) || 1;
const hasAck = () => S.acks.some(a => Number(a.policy_version) === policyVersion());

function policyText(cfg, st) {
  const s = cfg.sick || {}, cap = Number(st.sick_use_cap) || 40, carry = Number(st.sick_carry_cap) || cap;
  return `<h2>Earned sick time policy</h2><p>${esc(cfg.businessName || "This business")} follows the Michigan Earned Sick Time Act.</p>
  <ol>
  <li><b>Amount.</b> You earn 1 hour of paid sick time for every 30 hours you work. You can use up to ${cap} hours per year. Unused hours carry over, up to ${carry} hours.</li>
  <li><b>Year.</b> The year runs ${s.yearBasis === "anniversary" ? "from your hire date anniversary" : "January 1 to December 31"}.</li>
  <li><b>Waiting period.</b> New hires can start using sick time ${s.waitDays ?? 120} days after their hire date.</li>
  <li><b>Uses.</b> Your own illness, injury, or medical care; caring for a family member; needs related to domestic violence or sexual assault; closure of your workplace or your child's school for a public health emergency.</li>
  <li><b>Notice.</b> For planned time such as an appointment, request it in the app at least ${s.plannedNoticeDays ?? 7} days ahead. For sudden illness, submit a "Sick today" request in the app as soon as you know, before your shift starts when possible.</li>
  <li><b>Documentation.</b> After 3 or more consecutive days, we may ask for a note from a health care provider. You have 15 days to provide it.</li>
  <li><b>No retaliation.</b> Using earned sick time properly will never count against you.</li>
  <li><b>Complaints.</b> You may file a complaint with the Michigan Department of Labor and Economic Opportunity, Wage and Hour Division.</li></ol>
  <p class="help">Policy version ${s.policyVersion || 1}${s.policyUpdatedAt ? ", updated " + esc(niceDate(s.policyUpdatedAt)) : ""}.</p>`;
}

function requestRow(r, withName) {
  const t = REQ_TAG[r.status] || ["", r.status];
  const tags = `<span class="tag ${t[0]}">${t[1]}</span> <span class="tag">${r.kind === "planned" ? "Planned" : "Sick today"}</span>${r.late ? ` <span class="tag late">Late notice</span>` : ""}${r.paycheck_id ? ` <span class="tag ok">Paid</span>` : ""}${r.doc_requested_on ? ` <span class="tag ${r.doc_received_on ? "ok" : "c"}">${r.doc_received_on ? "Note received" : "Note requested"}</span>` : ""}`;
  const inner = `<span class="main"><b>${esc(withName ? nameOf(r.worker_id) : niceDate(r.on_date))}</b><small>${withName ? esc(niceDate(r.on_date)) + ", " : ""}${esc(r.reason)}${r.decision_note ? ". " + esc(r.decision_note) : ""}</small><small style="display:block;margin-top:4px">${tags}</small></span><span class="num"><b>${h2(r.hours)} h</b></span>`;
  return `<li><button class="rowbtn" data-req="${esc(r.id)}">${inner}</button></li>`;
}

function renderTimeoff() {
  const v = $("#v-timeoff"), back = isMgr() ? `<button class="back" data-tab="more">Back to More</button>` : "";
  if (!S.me.worker_id) { v.innerHTML = `${back}<h2>Time off</h2><p class="empty">Your login is not linked to a worker record yet. Ask a manager to link it under People.</p>`; return; }
  const b = S.sick || {}, s = S.cfg.sick || {}, notice = Number(s.plannedNoticeDays) || 7, mine = S.requests.filter(r => r.worker_id === S.me.worker_id);
  const from = b.usable_from && b.usable_from > todayStr() ? b.usable_from : null, unsigned = S.actions.filter(a => a.worker_id === S.me.worker_id && !a.worker_ack_at);
  const minPlanned = ymd(new Date(Date.now() + notice * 864e5));
  let h = `${back}<h2>Time off</h2>`;
  if (!hasAck()) h += `<div class="banner">Please read and sign the sick time policy. <button class="linkbtn" id="to-policy" style="padding:0">Read and sign</button></div>`;
  unsigned.forEach(a => h += `<div class="banner">A ${esc(a.step_name.toLowerCase())} was issued on ${esc(niceDate(a.issued_at.slice(0, 10)))}. <button class="linkbtn" data-ack="${esc(a.id)}" style="padding:0">Read and sign</button></div>`);
  h += `<div class="panel"><div class="stat num"><div><b>${h2(b.available || 0)}</b><small>hours available</small></div><div><b>${h2(b.earned_year || 0)}</b><small>earned this year</small></div><div><b>${h2(b.used_year || 0)}</b><small>used this year</small></div></div>
    <p class="help" style="margin:10px 0 0">You earn 1 hour for every 30 hours worked. Up to ${esc(b.use_cap || 40)} hours can be used per year.${from ? ` You can start using sick time on <b>${esc(niceDate(from))}</b>.` : ""}</p></div>`;
  h += `<h3>Request sick time</h3><div class="panel">
    <div class="seg" id="to-kind"><button type="button" data-v="unplanned" aria-pressed="true">Sick today</button><button type="button" data-v="planned" aria-pressed="false">Planned</button></div>
    <p class="help" id="to-hint">Sick today: submit as soon as you know, before your shift starts when possible.</p>
    <div class="grid2"><div><label class="f" for="to-date">Date</label><input id="to-date" type="date" value="${todayStr()}" min="${todayStr()}"></div>
    <div><label class="f" for="to-hours">Hours</label><input id="to-hours" type="number" inputmode="decimal" min="0.25" max="24" step="0.25" placeholder="8"></div></div>
    <label class="f" for="to-reason">Reason (kept private, a few words is fine)</label><input id="to-reason" type="text" placeholder="Example: fever, or dentist appointment">
    <button class="primary" id="to-send">Send request</button></div>`;
  h += `<h3>My requests</h3>` + (mine.length ? `<ul class="list">${mine.map(r => requestRow(r, false)).join("")}</ul>` : `<p class="help">No requests yet.</p>`);
  h += `<p class="help"><button class="linkbtn" id="to-read" style="padding:0">Read the sick time policy</button></p>`;
  v.innerHTML = h;
  let kind = "unplanned";
  $("#to-kind").onclick = e => { const k = e.target.dataset.v; if (!k) return; kind = k;
    $("#to-kind").querySelectorAll("button").forEach(x => x.setAttribute("aria-pressed", x.dataset.v === k));
    const d = $("#to-date"); if (k === "planned") { d.min = minPlanned; if (d.value < minPlanned) d.value = minPlanned; $("#to-hint").textContent = `Planned time needs ${notice} days notice. Earliest date: ${niceDate(minPlanned)}.`; }
    else { d.min = todayStr(); if (d.value > ymd(new Date(Date.now() + 864e5))) d.value = todayStr(); $("#to-hint").textContent = "Sick today: submit as soon as you know, before your shift starts when possible."; } };
  $("#to-send").onclick = async () => { const btn = $("#to-send"); btn.disabled = true;
    const open = myOpen(), { error } = await sb.rpc("submit_sick_request", { p_kind: kind, p_on: $("#to-date").value, p_hours: num($("#to-hours").value), p_reason: $("#to-reason").value.trim(), p_shift_start: open ? open.clock_in : null });
    btn.disabled = false; if (error) return fail(error); toast("Request sent"); refresh(); };
  const rp = $("#to-policy"); if (rp) rp.onclick = policySheet; $("#to-read").onclick = policySheet;
  document.querySelectorAll("[data-ack]").forEach(x => x.onclick = () => disciplineAckSheet(x.dataset.ack));
}

function policySheet() {
  openSheet(`<div class="bar"><h2>Sick time policy</h2><button class="ghost" data-close>Close</button></div>${policyText(S.cfg, S.status).replace("<h2>Earned sick time policy</h2>", "")}
    ${hasAck() ? `<p class="note">Signed.</p>` : `<label class="f" for="pa-name">Type your full name to sign</label><input id="pa-name" type="text" autocomplete="name"><button class="primary" id="pa-sign">I have read this policy</button>`}`);
  const b = $("#pa-sign"); if (b) b.onclick = async () => { const { error } = await sb.rpc("ack_policy", { p_version: policyVersion(), p_name: $("#pa-name").value.trim() }); if (error) return fail(error); closeSheet(); toast("Policy signed"); refresh(); };
}

function disciplineAckSheet(id) {
  const a = S.actions.find(x => x.id === id); if (!a) return;
  openSheet(`<div class="bar"><h2>${esc(a.step_name)}</h2><button class="ghost" data-close>Close</button></div>
    <p class="help">Issued ${esc(new Date(a.issued_at).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" }))} by ${esc(a.issued_by_name || "a manager")}. Attendance points at the time: ${esc(a.points_at_time)}.</p>
    <div class="panel">${esc(a.reason)}</div>
    ${a.worker_ack_at ? `<p class="note">Signed by ${esc(a.worker_ack_name)} on ${esc(niceDate(a.worker_ack_at.slice(0, 10)))}.</p>` : `<p class="help">Signing means you received this notice. It does not mean you agree with it.</p>
    <label class="f" for="da-name">Type your full name to sign</label><input id="da-name" type="text" autocomplete="name"><button class="primary" id="da-sign">I received this notice</button>`}`);
  const b = $("#da-sign"); if (b) b.onclick = async () => { const { error } = await sb.rpc("ack_discipline", { p_id: id, p_name: $("#da-name").value.trim() }); if (error) return fail(error); closeSheet(); toast("Signed"); refresh(); };
}

/* Request sheet: own request (cancel) or, for managers and supervisors, review. */
function requestSheet(id) {
  const r = S.requests.find(x => x.id === id); if (!r) return;
  const own = r.worker_id === S.me.worker_id, canReview = !own && (isMgr() || isSup()), t = REQ_TAG[r.status] || ["", r.status];
  let h = `<div class="bar"><h2>${esc(own ? niceDate(r.on_date) : nameOf(r.worker_id))}</h2><button class="ghost" data-close>Close</button></div>
    <p class="help">${own ? "" : esc(niceDate(r.on_date)) + ". "}${r.kind === "planned" ? "Planned" : "Sick today"}, ${h2(r.hours)} hours. <span class="tag ${t[0]}">${t[1]}</span>${r.late ? ` <span class="tag late">Late notice</span>` : ""}</p>
    <dl class="kv"><dt>Reason</dt><dd style="text-align:left">${esc(r.reason)}</dd><dt>Submitted</dt><dd>${esc(new Date(r.submitted_at).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" }))}</dd>
    ${r.shift_start ? `<dt>Shift started</dt><dd>${esc(niceTime(r.shift_start))}</dd>` : ""}${r.status === "approved" ? `<dt>Consecutive days</dt><dd>${r.consecutive_run}</dd>` : ""}
    ${r.decided_at ? `<dt>Decided</dt><dd>${esc(niceDate(r.decided_at.slice(0, 10)))}${r.decision_note ? ", " + esc(r.decision_note) : ""}</dd>` : ""}
    ${r.doc_requested_on ? `<dt>Doctor's note</dt><dd>${r.doc_received_on ? "Received " + esc(niceDate(r.doc_received_on)) : "Due " + esc(niceDate(r.doc_due_on))}</dd>` : ""}</dl>`;
  if (canReview) h += `<p class="note num" id="rq-sick">Sick time: loading</p>`;
  if (own && r.status === "pending") h += `<div class="actions"><button class="danger" id="rq-cancel">Cancel request</button></div>`;
  if (canReview && r.status === "pending") h += `<button class="primary" id="rq-ok">Approve</button>
    <h3>Or deny</h3><label class="f" for="rq-why">Reason</label><select id="rq-why">${DENY_REASONS.map(x => `<option>${x}</option>`).join("")}</select>
    <label class="f" for="rq-note">Note to the worker</label><input id="rq-note" type="text">
    <p class="help">${r.kind === "unplanned" ? "Short notice is not a reason to deny sudden illness. Michigan law protects it as long as the worker told you as soon as they could." : "Planned requests under the notice period are refused automatically before they reach you."}</p>
    <div class="actions"><button class="danger" id="rq-deny">Deny</button></div>`;
  if (isMgr() && r.status === "approved" && r.consecutive_run >= 3 && !r.doc_requested_on) h += `<div class="actions"><button class="ghost" id="rq-doc">Request a doctor's note</button></div><p class="help">Allowed after 3 or more consecutive days. The worker gets 15 days.</p>`;
  if (isMgr() && r.doc_requested_on && !r.doc_received_on) h += `<div class="actions"><button class="ghost" id="rq-got">Note received</button></div>`;
  openSheet(h);
  if (canReview) sickLine(r.worker_id, "#rq-sick", r.on_date);
  const rpc = async (fn, args, msg) => { const { error } = await sb.rpc(fn, args); if (error) return fail(error); closeSheet(); toast(msg); refresh(); };
  const c = $("#rq-cancel"); if (c) c.onclick = () => rpc("cancel_sick_request", { p_id: id }, "Request cancelled");
  const ok = $("#rq-ok"); if (ok) ok.onclick = () => rpc("decide_sick_request", { p_id: id, p_status: "approved", p_note: "" }, "Approved");
  const dn = $("#rq-deny"); if (dn) dn.onclick = () => rpc("decide_sick_request", { p_id: id, p_status: "denied", p_note: ($("#rq-why").value + ". " + $("#rq-note").value).trim() }, "Denied");
  const dc = $("#rq-doc"); if (dc) dc.onclick = () => rpc("request_documentation", { p_id: id }, "Note requested");
  const gt = $("#rq-got"); if (gt) gt.onclick = () => rpc("mark_documentation_received", { p_id: id }, "Marked received");
}
