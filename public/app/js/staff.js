/* ================= hiring codes, contact details, new-hire checklist, agency compliance ================= */

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
  return `${first ? `Hi ${first},` : "Hello,"}\n\nWelcome to ${biz}. To set up your staff account (time clock, schedule, pay and paperwork):\n\n1. Open ${hcLink(c)}\n2. Tap Create an account.\n3. Enter your hiring code: ${hcFormat(c.code)}\n4. Fill in your paperwork, phone, date of birth and emergency contact.\n\nThe code works one time and expires ${niceDate(ymd(new Date(c.expires_at)))}. Once you are signed up we approve your account. Before your first post we take your fingerprints for the required state and FBI background check.`;
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

/* ---------- contact details and CPL ---------- */
/* Michigan does not license security officers one by one: they work under the agency's license
   (held by the owner, backed by the surety bond and insurance). What the app keeps per person:
   phone, emergency contact, date of birth (for the quarterly LARA roster) and, for officers on
   armed posts, their Michigan CPL and its expiration. */
const lowerFirst = t => t.charAt(0).toLowerCase() + t.slice(1);
function licenseState(d) {
  if (!d || !d.license_expires) return null; const days = daysUntil(d.license_expires);
  return { days, expired: days < 0, soon: days >= 0 && days <= 30, text: days < 0 ? `Expired ${niceDate(d.license_expires)}` : days === 0 ? "Expires today" : `Expires ${niceDate(d.license_expires)}${days <= 30 ? `, in ${days} day${days === 1 ? "" : "s"}` : ""}` };
}
function staffFieldsHtml(d) {
  d = d || {}; const armed = !!d.license_number;
  return `<h3>Phone, birth date and emergency contact</h3>
    <div class="grid2"><div><label class="f" for="sd-phone">Your cell phone</label><input id="sd-phone" type="tel" autocomplete="tel" value="${esc(d.phone || "")}"></div>
      <div><label class="f" for="sd-dob">Date of birth</label><input id="sd-dob" type="date" autocomplete="bday" value="${esc(d.date_of_birth || "")}"></div></div>
    <p class="help">Your date of birth goes on the employee roster the company files with the State of Michigan each quarter.</p>
    <div class="grid2"><div><label class="f" for="sd-ename">Emergency contact name</label><input id="sd-ename" type="text" autocomplete="off" value="${esc(d.emergency_name || "")}"></div>
      <div><label class="f" for="sd-erel">Relationship</label><input id="sd-erel" type="text" placeholder="Spouse, parent, friend" value="${esc(d.emergency_relation || "")}"></div></div>
    <label class="f" for="sd-ephone">Emergency contact phone</label><input id="sd-ephone" type="tel" autocomplete="off" value="${esc(d.emergency_phone || "")}">
    <h3>Armed posts only</h3>
    <label class="check"><input id="sd-armed" type="checkbox" ${armed ? "checked" : ""}> I work, or want to work, armed posts and hold a Michigan concealed pistol license (CPL)</label>
    <div id="sd-licbox" ${armed ? "" : "hidden"}><div class="grid2"><div><label class="f" for="sd-lic">CPL number</label><input id="sd-lic" type="text" autocomplete="off" value="${esc(d.license_number || "")}"></div>
      <div><label class="f" for="sd-licexp">CPL expiration date</label><input id="sd-licexp" type="date" value="${esc(d.license_expires || "")}"></div></div>
      <p class="help">You get a reminder 30 days before it expires. No armed post with an expired CPL.</p></div>
    <p class="help">Security officers in Michigan are not licensed individually. You work under the company's State of Michigan security guard agency license, after a fingerprint background check.</p>`;
}
function wireStaffFields() { const c = $("#sd-armed"); if (c) c.onchange = () => $("#sd-licbox").hidden = !c.checked; }
/* Reads the form; returns the row or throws a message for the first missing piece. */
function readStaffFields(pid) {
  const v = id => $(id).value.trim(), armed = $("#sd-armed").checked, row = { profile_id: pid, phone: v("#sd-phone"), date_of_birth: $("#sd-dob").value || null, emergency_name: v("#sd-ename"), emergency_relation: v("#sd-erel"),
    emergency_phone: v("#sd-ephone"), license_number: armed ? v("#sd-lic") : "", license_expires: armed ? ($("#sd-licexp").value || null) : null, updated_at: new Date().toISOString() };
  const phoneOk = p => p.replace(/\D/g, "").length >= 10;
  if (!phoneOk(row.phone)) throw new Error("Enter your cell phone number with area code.");
  if (!row.date_of_birth) throw new Error("Enter your date of birth.");
  const age = (Date.now() - parseYmd(row.date_of_birth)) / (365.25 * 864e5); if (age < 16 || age > 100) throw new Error("Check the date of birth.");
  if (!row.emergency_name) throw new Error("Enter an emergency contact name.");
  if (!phoneOk(row.emergency_phone)) throw new Error("Enter the emergency contact's phone number with area code.");
  if (armed && !row.license_number) throw new Error("Enter your CPL number, or uncheck armed posts.");
  if (armed && !row.license_expires) throw new Error("Enter the date your CPL expires.");
  return row;
}
async function saveStaffFields(pid) { const row = readStaffFields(pid); const r = await sb.from("staff_details").upsert(row, { onConflict: "profile_id" }); if (r.error) throw r.error; S.staff = S.staff || {}; S.staff[pid] = row; }
function myContactSheet() {
  const d = (S.staff || {})[S.me.id];
  openSheet(`<div class="bar"><h2>My contact details</h2><button class="ghost" data-close>Close</button></div>
    <p class="help" style="margin-top:0">Managers use this to reach you and your emergency contact.</p>${staffFieldsHtml(d)}<button class="primary" id="sd-save">Save</button>`);
  wireStaffFields();
  $("#sd-save").onclick = async () => { const b = $("#sd-save"); b.disabled = true; try { await saveStaffFields(S.me.id); closeSheet(); toast("Saved"); refresh(); } catch (e) { fail(e); } b.disabled = false; };
}
/* Owner or manager view on People and roles, with editing. */
function staffPanelHtml(pid) {
  const d = (S.staff || {})[pid], ls = licenseState(d); if (!d) return `<h3>Contact details</h3><p class="note">Not filled in yet. They add it with their paperwork, or under More, My contact details. <button class="linkbtn" id="sd-edit" style="padding:0">Enter it for them</button></p>`;
  const tel = x => x ? `<a href="tel:${esc(x.replace(/[^\d+]/g, ""))}" style="color:var(--accent)">${esc(x)}</a>` : "Not given";
  return `<h3>Contact details</h3><dl class="kv"><dt>Phone</dt><dd>${tel(d.phone)}</dd><dt>Date of birth</dt><dd>${d.date_of_birth ? esc(niceDate(d.date_of_birth)) : "Not given"}</dd><dt>Emergency contact</dt><dd>${esc(d.emergency_name || "Not given")}${d.emergency_relation ? ` (${esc(d.emergency_relation)})` : ""}, ${tel(d.emergency_phone)}</dd>
    <dt>CPL (armed posts)</dt><dd>${d.license_number ? `${esc(d.license_number)} <span class="tag ${ls && ls.expired ? "no" : ls && ls.soon ? "c" : "ok"}">${esc(ls ? ls.text : "No expiration date")}</span>` : "Unarmed"}</dd></dl>
    <button class="linkbtn" id="sd-edit" style="padding:0">Edit contact details</button>`;
}
function wireStaffPanel(pid) { const b = $("#sd-edit"); if (!b) return; b.onclick = () => { const p = S.people.find(x => x.id === pid) || {};
  openSheet(`<div class="bar"><h2>${esc(p.full_name || p.email || "Contact details")}</h2><button class="ghost" data-close>Close</button></div>${staffFieldsHtml((S.staff || {})[pid])}<button class="primary" id="sd-save">Save</button><button class="linkbtn" id="sd-back">Back</button>`);
  wireStaffFields(); $("#sd-back").onclick = () => personSheet(pid);
  $("#sd-save").onclick = async () => { const s = $("#sd-save"); s.disabled = true; try { await saveStaffFields(pid); toast("Saved"); await loadData(); personSheet(pid); } catch (e) { fail(e); s.disabled = false; } }; }; }

/* ---------- new-hire checklist ---------- */
/* Security screening (MCL 338.1067 and 338.1068), for everyone who provides security services, before their first post:
   fingerprints to the Michigan State Police and FBI, a signed employment application kept at least 1 year, and the
   eligibility rules for employees of a licensee. W-2 employees also get Form I-9 (by the third business day) and the
   Michigan new hire report (within 20 days). */
function addBusinessDays(s, n) { const d = parseYmd(s); while (n > 0) { d.setDate(d.getDate() + 1); if (d.getDay() !== 0 && d.getDay() !== 6) n--; } return ymd(d); }
const ELIGIBILITY = "At least 18; high school diploma, GED or equivalent; no felony conviction; no conviction in the last 5 years for impersonating a law enforcement officer, illegally using, carrying or possessing a dangerous weapon, or a controlled substance offense; not dishonorably discharged from the military.";
function hireSteps(w) {
  if (!w || !w.hire_checklist || w.archived || w.terminated_on) return [];
  const hire = w.hire_date || ymd(new Date(w.created_at)), steps = [
    { key: "fp", col: "fingerprint_on", done: w.fingerprint_on, due: hire, title: "Fingerprint background check (state and FBI)", screen: true,
      how: "Required before they stand a post. Have their fingerprints taken (Michigan State Police approved vendor) for the state and FBI criminal history check, and keep the result in their file. A Michigan State Police ICHAT name check is a quick first look but does not replace the fingerprints." },
    { key: "app", col: "application_on", done: w.application_on, due: hire, title: "Signed employment application on file", screen: true,
      how: "A complete, signed employment application. Keep it at least 1 year, along with their personnel records." },
    { key: "elig", col: "eligibility_on", done: w.eligibility_on, due: hire, title: "Eligibility confirmed", screen: true, how: ELIGIBILITY }];
  if (w.type === "W-2") steps.push(
    { key: "i9", col: "i9_done_on", done: w.i9_done_on, due: addBusinessDays(hire, 3), title: "Form I-9 (employment eligibility)",
      how: "Fill in Section 2 after seeing their original ID documents in person. Keep the form on file (3 years after hire, or 1 year after they leave, whichever is later). Do not mail it anywhere." },
    { key: "nh", col: "newhire_reported_on", done: w.newhire_reported_on, due: ymd(new Date(parseYmd(hire).getTime() + 20 * 864e5)), title: "Michigan new hire report",
      how: "Report them at mi-newhire.com (free): name, address, Social Security number, hire date and the business's federal EIN." });
  return steps;
}
/* Not yet cleared to stand a post: a screening step is still open. */
const notCleared = w => hireSteps(w).some(s => s.screen && !s.done);
function hireChecklistHtml(w) {
  const steps = hireSteps(w); if (!steps.length) return "";
  return `<h3>New-hire checklist</h3><div class="panel">${notCleared(w) ? `<p class="note" style="margin-top:0">Not cleared for posts yet. Finish the three screening steps before scheduling them.</p>` : ""}${steps.map(s => `<div style="margin:6px 0 12px"><b>${esc(s.title)}</b> <span class="tag ${s.done ? "ok" : daysUntil(s.due) < 0 ? "no" : "c"}">${s.done ? `Done ${esc(niceDate(s.done))}` : s.screen ? "Before first post" : `Due ${esc(niceDate(s.due))}`}</span>
    <p class="help" style="margin:4px 0">${esc(s.how)}</p><button class="ghost" data-hstep="${s.col}" data-hval="${s.done ? "" : "1"}" style="min-height:36px;padding:6px 10px">${s.done ? "Mark not done" : "Mark done today"}</button></div>`).join("")}
    ${steps.every(s => s.done) ? `<p class="help" style="margin:0">All done.</p>` : ""}</div>`;
}
function wireHireChecklist(wid) { document.querySelectorAll("[data-hstep]").forEach(b => b.onclick = async () => {
  const r = await sb.from("workers").update({ [b.dataset.hstep]: b.dataset.hval ? todayStr() : null }).eq("id", wid); if (r.error) return fail(r.error); toast(b.dataset.hval ? "Marked done" : "Marked not done"); await loadData(); workerSheet(wid); }); }

/* ---------- agency license, surety bond, insurance (settings data.agency) ---------- */
/* MCL 338.1056-338.1060: the agency license is issued to the owner (qualifying person) and runs 2 years; the agency keeps
   a $25,000 surety bond, or insurance of $25,000 property damage / $100,000 one person / $200,000 more than one person,
   in force for the whole license period. Rosters are due April 15, July 15, October 15 and January 15. */
const AGENCY_DATES = [["licenseExpires", "Agency license", "Renew with LARA in MiCLEAR. A renewal is not processed unless a roster was filed for every quarter of the 2-year license period."],
  ["bondExpires", "Surety bond", "Renew with the surety company and make sure LARA has the continuation certificate. The license needs the bond (or the insurance) in force the whole time."],
  ["insuranceExpires", "Liability insurance", "Renew the policy and send the updated certificate to LARA and to clients who require one."],
  ["workersCompExpires", "Workers' compensation insurance", "Required in Michigan once you have employees. Renew before it lapses."]];
function agencyItems() { const a = (S.cfg || {}).agency || {}, out = [];
  AGENCY_DATES.forEach(([k, label, how]) => { if (!a[k]) return; const d = daysUntil(a[k]); if (d > 60) return;
    out.push({ key: `ag-${k}-${a[k]}`, due: a[k], days: d, title: `${label} ${d < 0 ? "expired" : "expires"} ${niceDate(a[k])}`, detail: how + " Then enter the new date in Settings.", tab: "settings", kind: "license" }); });
  return out; }
function agencyPanelHtml(c, dis) { const a = c.agency || {}, f = (k, l, type, ph) => `<div><label class="f" for="c-a-${k}">${l}</label><input id="c-a-${k}" type="${type || "text"}" value="${esc(a[k] ?? "")}" ${ph ? `placeholder="${esc(ph)}"` : ""} ${dis}></div>`;
  return `<h3>Agency license, bond and insurance</h3><div class="panel"><p class="help" style="margin-top:0">Michigan licenses the agency, not each officer. Every officer works under this license, which is held by the owner and backed by the surety bond and insurance. Reminders appear 60 days before each date below.</p>
    <div class="grid2">${f("licenseNumber", "LARA license number", "text", "10 digits starting 3801")}${f("licenseHolder", "License holder (qualifying person)", "text", "Roland L. Frederick")}${f("licenseExpires", "License expires", "date")}${f("bondCompany", "Surety company")}${f("bondNumber", "Bond number")}${f("bondAmount", "Bond amount ($)", "number", "25000")}${f("bondExpires", "Bond expires or renews", "date")}${f("insuranceCompany", "Liability insurer")}${f("insurancePolicy", "Policy number")}${f("insuranceExpires", "Liability policy expires", "date")}${f("workersCompExpires", "Workers' comp policy expires", "date")}</div>
    <p class="help" style="margin-bottom:0">The law requires a $25,000 surety bond, or insurance of at least $25,000 property damage, $100,000 injury or death of one person and $200,000 for more than one, kept in force for the whole license period. The surety or insurer must give LARA 30 days' notice before cancelling. The license number is also shown on the website (More, Website, Credentials).</p></div>`; }
function readAgencyPanel() { const a = {}; ["licenseNumber", "licenseHolder", "licenseExpires", "bondCompany", "bondNumber", "bondAmount", "bondExpires", "insuranceCompany", "insurancePolicy", "insuranceExpires", "workersCompExpires"].forEach(k => a[k] = $("#c-a-" + k).value.trim()); return a; }

/* ---------- quarterly LARA employee roster ---------- */
/* Everyone employed at any point in the quarter who provides security services: name, date of birth, hire date, termination date. */
function rosterRows(y, k) { const qs = `${y}-${pad((k * 3) + 1)}-01`, qe = ymd(new Date(y, (k + 1) * 3, 0)), dob = {};
  S.people.forEach(p => { if (p.worker_id && (S.staff || {})[p.id]) dob[p.worker_id] = S.staff[p.id].date_of_birth; });
  return S.workers.filter(w => { const h = w.hire_date || ymd(new Date(w.created_at)); return h <= qe && (!w.terminated_on || w.terminated_on >= qs); })
    .sort((a, b) => a.name.localeCompare(b.name)).map(w => ({ name: w.name, dob: dob[w.id] || "", hire: w.hire_date || "", end: w.terminated_on || "" })); }
function rosterSheet() {
  const t = new Date(), Y = t.getFullYear(), cur = Math.floor(t.getMonth() / 3), opts = []; for (let i = 1; i <= 6; i++) { const q = cur - i, y = Y + Math.floor(q / 4), k = ((q % 4) + 4) % 4; opts.push([y, k]); }
  openSheet(`<div class="bar"><h2>LARA employee roster</h2><button class="ghost" data-close>Close</button></div>
    <p class="help" style="margin-top:0">Filed every quarter in MiCLEAR (your license, Additional Actions, Security Guard Quarterly Report): Q1 by April 15, Q2 by July 15, Q3 by October 15, Q4 by January 15. Each quarter is filed separately. A missing roster can suspend the license and blocks renewal.</p>
    <label class="f" for="ro-q">Quarter</label><select id="ro-q">${opts.map(([y, k], i) => `<option value="${y}-${k}" ${i === 0 ? "selected" : ""}>Q${k + 1} ${y}</option>`).join("")}</select>
    <div id="ro-list"></div><button class="primary" id="ro-dl">Download the roster (CSV)</button>`);
  const show = () => { const [y, k] = $("#ro-q").value.split("-").map(Number), rows = rosterRows(y, k), miss = rows.filter(r => !r.dob).length;
    $("#ro-list").innerHTML = `<p class="help">${rows.length} ${rows.length === 1 ? "person" : "people"} employed during Q${k + 1} ${y}.${miss ? ` <b>${miss} missing a date of birth</b>: they add it under More, My contact details, or you enter it on their profile under People and roles.` : ""}</p>
      <div class="tblwrap"><table><tr><th>Name</th><th>Date of birth</th><th>Hired</th><th>Ended</th></tr>${rows.map(r => `<tr><td>${esc(r.name)}</td><td>${esc(r.dob ? niceDate(r.dob) : "Missing")}</td><td>${esc(r.hire ? niceDate(r.hire) : "")}</td><td>${esc(r.end ? niceDate(r.end) : "")}</td></tr>`).join("")}</table></div>`; };
  show(); $("#ro-q").onchange = show;
  $("#ro-dl").onclick = () => { const [y, k] = $("#ro-q").value.split("-").map(Number), cell = x => `"${String(x).replace(/"/g, '""')}"`;
    download(`LARA-roster-${y}-Q${k + 1}.csv`, "text/csv", ["Name,Date of birth,Date of hire,Date of termination", ...rosterRows(y, k).map(r => [r.name, r.dob, r.hire, r.end].map(cell).join(","))].join("\r\n")); toast("Roster downloaded"); };
}
