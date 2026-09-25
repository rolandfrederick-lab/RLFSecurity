/* ================= hiring codes, contact and guard license, new-hire checklist ================= */

/* ---------- hiring codes ---------- */
/* No 0/O, 1/I/L: easy to read out loud or copy from a text. 31^8 possible codes. */
const HC_ALPHA = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
const hcFormat = c => c ? c.slice(0, 4) + "-" + c.slice(4) : "";
const hcClean = s => String(s || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
function hcNew() { const out = [], buf = new Uint8Array(32);
  while (out.length < 8) { crypto.getRandomValues(buf); for (const b of buf) { if (b < 248 && out.length < 8) out.push(HC_ALPHA[b % 31]); } } return out.join(""); }
const hcOpen = c => !c.used_at && !c.revoked && new Date(c.expires_at) > new Date();
const hcLink = c => `https://rlfsecurity.com/app/?code=${hcFormat(c.code)}`;
function hcMessage(c) {
  const first = (c.note || "").trim().split(/\s+/)[0], biz = S.cfg.businessName || "R L Frederick Private Security";
  return `${first ? `Hi ${first},` : "Hello,"}\n\nWelcome to ${biz}. To set up your staff account (time clock, schedule, pay and paperwork):\n\n1. Open ${hcLink(c)}\n2. Tap Create an account.\n3. Enter your hiring code: ${hcFormat(c.code)}\n4. Fill in your paperwork, phone, emergency contact and guard license.\n\nThe code works one time and expires ${niceDate(ymd(new Date(c.expires_at)))}. Once you are signed up we approve your account and you can start.`;
}
function hiringCodesHtml() {
  const all = S.hireCodes || [], open = all.filter(hcOpen), used = all.filter(c => c.used_at).slice(0, 5);
  const who = id => { const p = S.people.find(x => x.id === id); return p ? (p.full_name || p.email) : "a removed account"; };
  return `<h3>Hiring codes</h3><div class="panel"><p class="help" style="margin-top:0">New people need a hiring code to create an account, so nobody else can sign up. Each code works once and expires after 14 days.</p>
    <label class="f" for="hc-note">Who is it for? (optional)</label><input id="hc-note" type="text" maxlength="120" placeholder="Example: Marcus Hill, night shift" autocomplete="off">
    <button class="primary" id="hc-new">Create hiring code</button>
    ${open.length ? `<h3 style="margin-top:16px">Waiting to be used</h3><ul class="list">${open.map(c => `<li><div class="rowbtn" style="display:flex;padding:12px 14px;gap:10px;align-items:center;flex-wrap:wrap"><span class="main"><b class="num" style="letter-spacing:.08em">${esc(hcFormat(c.code))}</b><small>${esc(c.note || "No name")}. Expires ${esc(niceDate(ymd(new Date(c.expires_at))))}.</small></span>
      <button class="ghost" data-hc-send="${esc(c.code)}" style="min-height:36px;padding:6px 10px">Send</button><button class="ghost" data-hc-revoke="${esc(c.code)}" style="min-height:36px;padding:6px 10px">Cancel code</button></div></li>`).join("")}</ul>` : ""}
    ${used.length ? `<p class="help">${used.map(c => `${esc(hcFormat(c.code))} used by ${esc(who(c.used_by))} on ${esc(niceDate(ymd(new Date(c.used_at))))}`).join(". ")}.</p>` : ""}</div>`;
}
function wireHiringCodes() {
  const nb = $("#hc-new"); if (!nb) return;
  nb.onclick = async () => { nb.disabled = true; let r;
    for (let i = 0; i < 3; i++) { r = await sb.from("hire_codes").insert({ code: hcNew(), note: $("#hc-note").value.trim() }).select().single(); if (!r.error || r.error.code !== "23505") break; }
    nb.disabled = false; if (r.error) return fail(r.error); await loadData(); render(); hcSendSheet(r.data.code); };
  document.querySelectorAll("[data-hc-send]").forEach(b => b.onclick = () => hcSendSheet(b.dataset.hcSend));
  document.querySelectorAll("[data-hc-revoke]").forEach(b => b.onclick = async () => { if (b.dataset.ok !== "1") { b.dataset.ok = "1"; b.textContent = "Tap again to cancel"; return; }
    const r = await sb.from("hire_codes").update({ revoked: true }).eq("code", b.dataset.hcRevoke); if (r.error) return fail(r.error); toast("Code cancelled. It can no longer be used."); refresh(); });
}
function hcSendSheet(code) {
  const c = (S.hireCodes || []).find(x => x.code === code); if (!c) return; const msg = hcMessage(c);
  openSheet(`<div class="bar"><h2>Send the hiring code</h2><button class="ghost" data-close>Close</button></div>
    <p class="help" style="margin-top:0">${c.note ? `For ${esc(c.note)}. ` : ""}Send this to the new hire by text or email. The link opens the sign-up page with the code already filled in.</p>
    <p class="num" style="font-size:30px;letter-spacing:.12em;text-align:center;margin:10px 0;font-weight:700">${esc(hcFormat(c.code))}</p>
    <label class="f" for="hc-msg">Message</label><textarea id="hc-msg" rows="11">${esc(msg)}</textarea>
    <button class="primary" id="hc-copy">Copy message</button>
    <div class="actions"><button class="ghost" id="hc-sms">Text it</button><button class="ghost" id="hc-email">Email it</button></div>`);
  $("#hc-copy").onclick = async () => { const t = $("#hc-msg").value; try { await navigator.clipboard.writeText(t); } catch (e) { const el = $("#hc-msg"); el.select(); document.execCommand("copy"); } toast("Message copied"); };
  $("#hc-sms").onclick = () => { location.href = "sms:?&body=" + encodeURIComponent($("#hc-msg").value); };
  $("#hc-email").onclick = () => { const body = $("#hc-msg").value; closeSheet(); INBOX.drafts.compose = null;
    composeSheet({ toName: c.note || "", subject: `Your hiring code for ${S.cfg.businessName || "R L Frederick Private Security"}`, body }); };
}

/* Sign-up wall: 5 wrong codes locks the form on this device for 15 minutes. The real check is in the database. */
const HC_TRIES = 5, HC_LOCK_MIN = 15;
function hcWall() { try { return JSON.parse(localStorage.getItem("hc_wall") || "{}"); } catch (e) { return {}; } }
function hcSetWall(w) { try { localStorage.setItem("hc_wall", JSON.stringify(w)); } catch (e) {} }
function hcLockedMin() { const w = hcWall(); return w.until && w.until > Date.now() ? Math.ceil((w.until - Date.now()) / 60000) : 0; }
function hcMiss() { const w = hcWall(), n = (w.until && w.until <= Date.now() ? 0 : (w.n || 0)) + 1;
  hcSetWall(n >= HC_TRIES ? { n, until: Date.now() + HC_LOCK_MIN * 60000 } : { n }); return HC_TRIES - n; }
function inviteFromUrl() { try { return hcClean(new URLSearchParams(location.search).get("code")); } catch (e) { return ""; } }

/* ---------- contact and guard license ---------- */
const lowerFirst = t => t.charAt(0).toLowerCase() + t.slice(1);
function licenseState(d) {
  if (!d || !d.license_expires) return null; const days = daysUntil(d.license_expires);
  return { days, expired: days < 0, soon: days >= 0 && days <= 30, text: days < 0 ? `Expired ${niceDate(d.license_expires)}` : days === 0 ? "Expires today" : `Expires ${niceDate(d.license_expires)}${days <= 30 ? `, in ${days} day${days === 1 ? "" : "s"}` : ""}` };
}
function staffFieldsHtml(d) {
  d = d || {}; const noLic = d.profile_id && !d.license_number;
  return `<h3>Phone and emergency contact</h3>
    <label class="f" for="sd-phone">Your cell phone</label><input id="sd-phone" type="tel" autocomplete="tel" value="${esc(d.phone || "")}">
    <div class="grid2"><div><label class="f" for="sd-ename">Emergency contact name</label><input id="sd-ename" type="text" autocomplete="off" value="${esc(d.emergency_name || "")}"></div>
      <div><label class="f" for="sd-erel">Relationship</label><input id="sd-erel" type="text" placeholder="Spouse, parent, friend" value="${esc(d.emergency_relation || "")}"></div></div>
    <label class="f" for="sd-ephone">Emergency contact phone</label><input id="sd-ephone" type="tel" autocomplete="off" value="${esc(d.emergency_phone || "")}">
    <h3>Security guard license</h3>
    <div id="sd-licbox" ${noLic ? "hidden" : ""}><div class="grid2"><div><label class="f" for="sd-lic">License number</label><input id="sd-lic" type="text" autocomplete="off" value="${esc(d.license_number || "")}"></div>
      <div><label class="f" for="sd-licexp">Expiration date</label><input id="sd-licexp" type="date" value="${esc(d.license_expires || "")}"></div></div>
      <p class="help">You will get a reminder 30 days before it expires. Working a post with an expired license is not allowed.</p></div>
    <label class="check"><input id="sd-nolic" type="checkbox" ${noLic ? "checked" : ""}> I do not have a guard license (office staff, or my license is still being processed)</label>`;
}
function wireStaffFields() { const c = $("#sd-nolic"); if (c) c.onchange = () => $("#sd-licbox").hidden = c.checked; }
/* Reads the form; returns the row or throws a message for the first missing piece. */
function readStaffFields(pid) {
  const v = id => $(id).value.trim(), noLic = $("#sd-nolic").checked, row = { profile_id: pid, phone: v("#sd-phone"), emergency_name: v("#sd-ename"), emergency_relation: v("#sd-erel"),
    emergency_phone: v("#sd-ephone"), license_number: noLic ? "" : v("#sd-lic"), license_expires: noLic ? null : ($("#sd-licexp").value || null), updated_at: new Date().toISOString() };
  const phoneOk = p => p.replace(/\D/g, "").length >= 10;
  if (!phoneOk(row.phone)) throw new Error("Enter your cell phone number with area code.");
  if (!row.emergency_name) throw new Error("Enter an emergency contact name.");
  if (!phoneOk(row.emergency_phone)) throw new Error("Enter the emergency contact's phone number with area code.");
  if (!noLic && !row.license_number) throw new Error("Enter your guard license number, or check the box if you do not have one.");
  if (!noLic && !row.license_expires) throw new Error("Enter the date your guard license expires.");
  return row;
}
async function saveStaffFields(pid) { const row = readStaffFields(pid); const r = await sb.from("staff_details").upsert(row, { onConflict: "profile_id" }); if (r.error) throw r.error; S.staff = S.staff || {}; S.staff[pid] = row; }
function myContactSheet() {
  const d = (S.staff || {})[S.me.id];
  openSheet(`<div class="bar"><h2>My contact and license</h2><button class="ghost" data-close>Close</button></div>
    <p class="help" style="margin-top:0">Managers use this to reach you and your emergency contact, and to keep guard licenses current.</p>${staffFieldsHtml(d)}<button class="primary" id="sd-save">Save</button>`);
  wireStaffFields();
  $("#sd-save").onclick = async () => { const b = $("#sd-save"); b.disabled = true; try { await saveStaffFields(S.me.id); closeSheet(); toast("Saved"); refresh(); } catch (e) { fail(e); } b.disabled = false; };
}
/* Owner or manager view on People and roles, with editing. */
function staffPanelHtml(pid) {
  const d = (S.staff || {})[pid], ls = licenseState(d); if (!d) return `<h3>Contact and license</h3><p class="note">Not filled in yet. They add it with their paperwork, or under More, My contact and license. <button class="linkbtn" id="sd-edit" style="padding:0">Enter it for them</button></p>`;
  const tel = x => x ? `<a href="tel:${esc(x.replace(/[^\d+]/g, ""))}" style="color:var(--accent)">${esc(x)}</a>` : "Not given";
  return `<h3>Contact and license</h3><dl class="kv"><dt>Phone</dt><dd>${tel(d.phone)}</dd><dt>Emergency contact</dt><dd>${esc(d.emergency_name || "Not given")}${d.emergency_relation ? ` (${esc(d.emergency_relation)})` : ""}, ${tel(d.emergency_phone)}</dd>
    <dt>Guard license</dt><dd>${d.license_number ? `${esc(d.license_number)} <span class="tag ${ls && ls.expired ? "no" : ls && ls.soon ? "c" : "ok"}">${esc(ls ? ls.text : "No expiration date")}</span>` : "None on file"}</dd></dl>
    <button class="linkbtn" id="sd-edit" style="padding:0">Edit contact and license</button>`;
}
function wireStaffPanel(pid) { const b = $("#sd-edit"); if (!b) return; b.onclick = () => { const p = S.people.find(x => x.id === pid) || {};
  openSheet(`<div class="bar"><h2>${esc(p.full_name || p.email || "Contact and license")}</h2><button class="ghost" data-close>Close</button></div>${staffFieldsHtml((S.staff || {})[pid])}<button class="primary" id="sd-save">Save</button><button class="linkbtn" id="sd-back">Back</button>`);
  wireStaffFields(); $("#sd-back").onclick = () => personSheet(pid);
  $("#sd-save").onclick = async () => { const s = $("#sd-save"); s.disabled = true; try { await saveStaffFields(pid); toast("Saved"); await loadData(); personSheet(pid); } catch (e) { fail(e); s.disabled = false; } }; }; }

/* ---------- new-hire checklist (W-2 employees) ---------- */
/* Form I-9: by the end of the third business day after the first day of work. Michigan new hire report: within 20 days of hire. */
function addBusinessDays(s, n) { const d = parseYmd(s); while (n > 0) { d.setDate(d.getDate() + 1); if (d.getDay() !== 0 && d.getDay() !== 6) n--; } return ymd(d); }
function hireSteps(w) {
  if (!w || !w.hire_checklist || w.type !== "W-2" || w.archived || w.terminated_on) return [];
  const hire = w.hire_date || ymd(new Date(w.created_at));
  return [{ key: "i9", col: "i9_done_on", done: w.i9_done_on, due: addBusinessDays(hire, 3), title: "Form I-9 (employment eligibility)",
      how: "Fill in Section 2 after seeing their original ID documents in person. Keep the form on file (3 years after hire, or 1 year after they leave, whichever is later). Do not mail it anywhere." },
    { key: "nh", col: "newhire_reported_on", done: w.newhire_reported_on, due: ymd(new Date(parseYmd(hire).getTime() + 20 * 864e5)), title: "Michigan new hire report",
      how: "Report them at mi-newhire.com (free): name, address, Social Security number, hire date and the business's federal EIN." }];
}
function hireChecklistHtml(w) {
  const steps = hireSteps(w); if (!steps.length) return "";
  return `<h3>New-hire checklist</h3><div class="panel">${steps.map(s => `<div style="margin:6px 0 12px"><b>${esc(s.title)}</b> <span class="tag ${s.done ? "ok" : daysUntil(s.due) < 0 ? "no" : "c"}">${s.done ? `Done ${esc(niceDate(s.done))}` : `Due ${esc(niceDate(s.due))}`}</span>
    <p class="help" style="margin:4px 0">${esc(s.how)}</p><button class="ghost" data-hstep="${s.col}" data-hval="${s.done ? "" : "1"}" style="min-height:36px;padding:6px 10px">${s.done ? "Mark not done" : "Mark done today"}</button></div>`).join("")}
    ${steps.every(s => s.done) ? `<p class="help" style="margin:0">All done.</p>` : ""}</div>`;
}
function wireHireChecklist(wid) { document.querySelectorAll("[data-hstep]").forEach(b => b.onclick = async () => {
  const r = await sb.from("workers").update({ [b.dataset.hstep]: b.dataset.hval ? todayStr() : null }).eq("id", wid); if (r.error) return fail(r.error); toast(b.dataset.hval ? "Marked done" : "Marked not done"); await loadData(); workerSheet(wid); }); }
