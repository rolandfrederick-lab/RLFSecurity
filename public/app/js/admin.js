const backMore = `<button class="back" data-tab="more">Back to More</button>`;
/* ================= workers ================= */
function renderWorkers() {
  const ws = [...S.workers].sort((a, b) => (a.archived ? 1 : 0) - (b.archived ? 1 : 0) || a.name.localeCompare(b.name));
  $("#v-workers").innerHTML = `${backMore}<h2>Workers</h2>` + (ws.length ? `<ul class="list">` + ws.map(w => `<li><button class="rowbtn" data-worker="${esc(w.id)}"><span class="main"><b>${esc(w.name)}</b><small class="num">${usd(w.rate)} per hour${w.archived ? ", archived" : ""}${S.people.some(p => p.worker_id === w.id) ? "" : ", no login linked"}</small></span><span class="tag ${w.type === "1099" ? "c" : ""}">${esc(w.type)}</span></button></li>`).join("") + `</ul>`
    : `<p class="empty">No workers yet. Add the first one to start running payroll.</p>`) + `<button class="primary" id="w-add">Add worker</button>`;
  $("#w-add").onclick = () => workerSheet(null);
}
function workerSheet(id) {
  const w = S.workers.find(x => x.id === id) || { type: "W-2", filing: "Single", mi_exemptions: 1, city_rate: 0 }, has = S.checks.some(c => c.worker_id === id) || S.punches.some(p => p.worker_id === id);
  openSheet(`<div class="bar"><h2>${id ? "Edit worker" : "Add worker"}</h2><button class="ghost" data-close>Close</button></div>
  <p class="help">Workers fill in their own W-4, address and Social Security number from their phone. Bank account numbers are never stored in the app.</p>
  <label class="f" for="w-name">Full name</label><input id="w-name" type="text" autocomplete="off" value="${esc(w.name || "")}">
  <label class="f">How this worker is paid</label>
  <div class="seg" id="w-type"><button type="button" data-v="W-2" aria-pressed="${w.type === "W-2"}">W-2 employee</button><button type="button" data-v="1099" aria-pressed="${w.type === "1099"}">1099 contractor</button></div>
  <div class="grid2"><div><label class="f" for="w-rate">Hourly rate ($)</label><input id="w-rate" type="number" inputmode="decimal" step="0.01" min="0" value="${esc(w.rate ?? "")}"></div>
  <div><label class="f" for="w-hire">Hire date</label><input id="w-hire" type="date" value="${esc(w.hire_date || todayStr())}"></div></div>
  <p class="help">The hire date drives the sick time waiting period and the employee headcount. ${w.terminated_on ? `<b>Employment ended ${esc(niceDate(w.terminated_on))}.</b>` : ""}</p>
  ${id ? `<p class="note num" id="w-sick">Sick time: loading</p>` : ""}
  <h3>Weekly hours cap</h3><div class="grid2"><div><label class="f" for="w-cap">Cap (blank = default ${esc(String((S.cfg.hours || {}).weeklyCap || 40))})</label><input id="w-cap" type="number" inputmode="decimal" min="1" step="0.5" value="${esc(w.weekly_cap ?? "")}"></div>
  <div><label class="f" for="w-capmode">At the cap</label><select id="w-capmode"><option value="" ${!w.cap_mode ? "selected" : ""}>Default (${(S.cfg.hours || {}).capMode === "block" ? "block" : "warn"})</option><option value="warn" ${w.cap_mode === "warn" ? "selected" : ""}>Warn only</option><option value="block" ${w.cap_mode === "block" ? "selected" : ""}>Block clock-in</option></select></div></div>
  <div id="w-w2" ${w.type === "W-2" ? "" : "hidden"}><h3>From the federal Form W-4</h3>
    <label class="f" for="w-filing">Step 1(c) filing status</label><select id="w-filing">${[["Single", "Single or married filing separately"], ["MFJ", "Married filing jointly"], ["HOH", "Head of household"]].map(o => `<option value="${o[0]}" ${w.filing === o[0] ? "selected" : ""}>${o[1]}</option>`).join("")}</select>
    <label class="check"><input id="w-step2" type="checkbox" ${w.step2 ? "checked" : ""}> Step 2(c) box is checked (two jobs)</label>
    <div class="grid2"><div><label class="f" for="w-dep">Step 3 dependents ($ per year)</label><input id="w-dep" type="number" inputmode="decimal" min="0" value="${esc(w.dependents_credit || "")}"></div>
    <div><label class="f" for="w-4c">Step 4(c) extra per paycheck ($)</label><input id="w-4c" type="number" inputmode="decimal" min="0" value="${esc(w.extra_withholding || "")}"></div>
    <div><label class="f" for="w-4a">Step 4(a) other income ($)</label><input id="w-4a" type="number" inputmode="decimal" min="0" value="${esc(w.other_income || "")}"></div>
    <div><label class="f" for="w-4b">Step 4(b) deductions ($)</label><input id="w-4b" type="number" inputmode="decimal" min="0" value="${esc(w.deductions || "")}"></div></div>
    <h3>Michigan</h3><label class="f" for="w-mi">MI-W4 line 6, number of exemptions</label><input id="w-mi" type="number" inputmode="numeric" min="0" step="1" value="${esc(w.mi_exemptions ?? 0)}">
    <label class="f" for="w-city">City the worker lives in</label><select id="w-city">${cityOptions(w.home_city)}</select>
    <p class="help">City tax is figured from where the worker lives and which site's city the work is done in. Residents pay their city's rate on all wages with a credit for tax paid to another city; nonresidents pay the work city's rate on wages earned there. A $600 per exemption allowance is applied.</p></div>
  ${id ? `<h3>Identity for tax forms</h3><div class="panel" id="w-ident"><p class="help">Loading</p></div>` : ""}
  <div id="w-1099" ${w.type === "1099" ? "" : "hidden"}><h3>Is this person really a contractor?</h3><p class="help">The IRS and Michigan decide this from how the work happens, not from the paperwork. Answer honestly.</p>
    <div class="checks">${[["own", "They run their own business: own supplies and equipment, other customers, invoices you"], ["sched", "They decide when and how the job gets done, not the company"], ["sub", "They could send someone else to do the work"], ["risk", "They can make a profit or take a loss on the job (flat price, their costs)"]].map(([k, t]) => `<label class="check" style="margin:6px 0"><input type="checkbox" data-cls="${k}" ${(w.classification || {})[k] ? "checked" : ""}> ${t}</label>`).join("")}</div>
    <p class="note" id="w-clswarn"></p>
    <label class="check"><input id="w-w9" type="checkbox" ${w.w9_on_file ? "checked" : ""}> Signed W-9 on file (paper, or the electronic one they sign in the app)</label>
    <p class="help">A contractor should not clock in on the schedule, use the checklist, or get guaranteed hours. Those are employee arrangements. If any box above is unchecked, talk to the accountant before paying on a 1099; the fix is switching them to W-2, which costs about 11% on top of wages plus workers' comp.</p></div>
  <label class="f" for="w-notes">Notes</label><textarea id="w-notes" rows="2" placeholder="Example: W-9 on file, brings own supplies">${esc(w.notes || "")}</textarea>
  <button class="primary" id="w-save">Save worker</button>
  ${id ? `<div class="actions"><button class="ghost" id="w-arch">${w.archived ? "Restore worker" : "Archive worker"}</button>${w.terminated_on ? "" : `<button class="danger" id="w-end">End employment</button>`}${has ? "" : `<button class="danger" id="w-del">Delete worker</button>`}</div>` : ""}`);
  if (id) sickLine(id, "#w-sick");
  let type = w.type;
  const clsWarn = () => { const n = [...document.querySelectorAll("[data-cls]")].filter(c => !c.checked).length, el = $("#w-clswarn"); if (!el) return; el.textContent = n === 0 ? "Looks like a genuine contractor." : `${n} of 4 unchecked. This person looks like an employee to the IRS. Paying them on a 1099 risks back taxes for both halves of Social Security and Medicare, penalties and interest, plus Michigan unemployment.`; el.style.color = n === 0 ? "inherit" : "var(--danger)"; };
  clsWarn(); document.querySelectorAll("[data-cls]").forEach(c => c.onchange = clsWarn);
  $("#w-type").onclick = e => { const v = e.target.dataset.v; if (!v) return; type = v; $("#w-type").querySelectorAll("button").forEach(b => b.setAttribute("aria-pressed", b.dataset.v === v)); $("#w-w2").hidden = v !== "W-2"; $("#w-1099").hidden = v !== "1099"; };
  const save = async body => { const r = id ? await sb.from("workers").update(body).eq("id", id) : await sb.from("workers").insert(body); if (r.error) return fail(r.error); closeSheet(); refresh(); return true; };
  $("#w-save").onclick = async () => { const name = $("#w-name").value.trim(); if (!name) return toast("Enter the worker's name"); if (!$("#w-hire").value) return toast("Enter the hire date");
    if (await save({ name, type, rate: num($("#w-rate").value), notes: $("#w-notes").value.trim(), filing: $("#w-filing").value, step2: $("#w-step2").checked, dependents_credit: num($("#w-dep").value),
      extra_withholding: num($("#w-4c").value), other_income: num($("#w-4a").value), deductions: num($("#w-4b").value), mi_exemptions: num($("#w-mi").value),
      hire_date: $("#w-hire").value, weekly_cap: $("#w-cap").value === "" ? null : num($("#w-cap").value), cap_mode: $("#w-capmode").value || null, home_city: $("#w-city").value,
      classification: Object.fromEntries([...document.querySelectorAll("[data-cls]")].map(c => [c.dataset.cls, c.checked])), w9_on_file: $("#w-w9").checked })) toast("Worker saved"); };
  if (id) identityPanel(id);
  if (id) { $("#w-arch").onclick = async () => { if (await save({ archived: !w.archived })) toast(w.archived ? "Worker restored" : "Worker archived"); };
    const we = $("#w-end"); if (we) we.onclick = () => terminateSheet(id);
    const d = $("#w-del"); if (d) d.onclick = async () => { if (d.dataset.ok !== "1") { d.dataset.ok = "1"; d.textContent = "Tap again to delete"; return; } const r = await sb.from("workers").delete().eq("id", id); if (r.error) return fail(r.error); closeSheet(); toast("Worker deleted"); refresh(); }; }
}

/* Address, name as on the Social Security card, SSN last four. Owner or administrator can reveal or enter the full SSN; every reveal is logged. */
async function identityPanel(wid) {
  const box = $("#w-ident"); if (!box) return; let d = {}; try { d = await q(sb.rpc("worker_details", { p_worker: wid })); } catch (e) { box.innerHTML = `<p class="help">${esc(e.message)}</p>`; return; }
  const canSsn = S.me.role === "owner" || S.me.is_admin, ss = 'style="width:100%;background:var(--paper);border:1px solid var(--line);border-radius:8px;padding:11px 12px;min-height:46px"';
  box.innerHTML = `<p class="help" style="margin-top:0">${d.w4_signed_at ? `W-4 signed in the app by ${esc(d.w4_signed_name)} on ${esc(niceDate(d.w4_signed_at.slice(0, 10)))}.` : "The worker has not filled in their paperwork yet. They do it from their phone under More, then Finish your paperwork."}</p>
    <div class="grid2"><div><label class="f" for="wi-first">Legal first name</label><input id="wi-first" type="text" value="${esc(d.legal_first || "")}"></div><div><label class="f" for="wi-mid">Middle</label><input id="wi-mid" type="text" value="${esc(d.legal_middle || "")}"></div></div>
    <label class="f" for="wi-last">Legal last name (as on the Social Security card)</label><input id="wi-last" type="text" value="${esc(d.legal_last || "")}">
    <label class="f" for="wi-street">Street</label><input id="wi-street" type="text" value="${esc(d.street || "")}"><label class="f" for="wi-street2">Apt or unit</label><input id="wi-street2" type="text" value="${esc(d.street2 || "")}">
    <div class="grid2"><div><label class="f" for="wi-city">City</label><input id="wi-city" type="text" value="${esc(d.city || "")}"></div><div><label class="f" for="wi-zip">ZIP</label><input id="wi-zip" type="text" inputmode="numeric" value="${esc(d.zip || "")}"></div></div>
    <label class="f" for="wi-state">State</label><input id="wi-state" type="text" value="${esc(d.state || "MI")}" maxlength="2">
    <label class="f">Social Security number</label><div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap"><span class="num" id="wi-ssn-show">${d.has_ssn ? "***-**-" + esc(d.ssn_last4) : "Not entered"}</span>
      ${canSsn && d.has_ssn ? `<button type="button" class="ghost" id="wi-reveal" style="min-height:36px;padding:6px 10px">Reveal (logged)</button>` : ""}</div>
    ${canSsn ? `<label class="f" for="wi-ssn">${d.has_ssn ? "Replace SSN" : "Enter SSN"}</label><input id="wi-ssn" type="password" inputmode="numeric" autocomplete="off" placeholder="###-##-####" ${ss}>` : `<p class="help">Only an owner or administrator can enter or see the full number.</p>`}
    <button type="button" class="ghost" id="wi-save" style="margin-top:10px">Save identity</button>`;
  const rv = $("#wi-reveal"); if (rv) rv.onclick = async () => { try { const s = await q(sb.rpc("get_worker_ssn", { p_worker: wid, p_purpose: "Viewed on worker record" })); $("#wi-ssn-show").textContent = s ? s.replace(/(\d{3})(\d{2})(\d{4})/, "$1-$2-$3") : "Not entered"; rv.hidden = true; } catch (e) { fail(e); } };
  $("#wi-save").onclick = async () => { const { error } = await sb.rpc("set_worker_private", { p_worker: wid, p_first: $("#wi-first").value, p_middle: $("#wi-mid").value, p_last: $("#wi-last").value, p_street: $("#wi-street").value, p_street2: $("#wi-street2").value,
      p_city: $("#wi-city").value, p_state: $("#wi-state").value, p_zip: $("#wi-zip").value, p_ssn: canSsn && $("#wi-ssn") ? $("#wi-ssn").value : null, p_home_city: $("#w-city").value }); if (error) return fail(error); toast("Identity saved"); identityPanel(wid); };
}

/* Fills an element with a worker's sick balance as of a date. Used on the worker, attendance and request sheets. */
async function sickLine(wid, sel, onDate) {
  try { const b = await q(sb.rpc("sick_balance", { p_worker: wid, p_on: onDate || todayStr() })); const el = $(sel); if (!el) return;
    const wait = b.usable_from > (onDate || todayStr()) ? ` In the waiting period until ${niceDate(b.usable_from)}.` : "";
    el.textContent = `Sick time${onDate ? " as of " + niceDate(onDate) : ""}: ${h2(b.available)} h available. Earned ${h2(b.earned_year)} h and used ${h2(b.used_year)} h this year, cap ${b.use_cap} h.${wait}`;
  } catch (e) { const el = $(sel); if (el) el.textContent = "Sick time balance unavailable."; }
}

/* Next regular pay date after a given day, from the pay schedule. Michigan: final wages are due by the next regular payday. */
function nextPayday(afterYmd) {
  const d = parseYmd(afterYmd), pp = S.cfg.payPeriods;
  if (pp === 12) return ymd(new Date(d.getFullYear(), d.getMonth() + 1, 0));
  if (pp === 24) return d.getDate() < 15 ? ymd(new Date(d.getFullYear(), d.getMonth(), 15)) : ymd(new Date(d.getFullYear(), d.getMonth() + 1, 0));
  const last = S.checks.map(c => c.pay_date).sort().pop(); const len = pp === 52 ? 7 : 14;
  if (!last) return ymd(new Date(d.getFullYear(), d.getMonth(), d.getDate() + len));
  let n = parseYmd(last); while (n <= d) n = new Date(n.getFullYear(), n.getMonth(), n.getDate() + len); return ymd(n);
}
async function terminateSheet(id) {
  const w = S.workers.find(x => x.id === id); if (!w) return;
  let bal = null; try { bal = await q(sb.rpc("sick_balance", { p_worker: id })); } catch (e) {}
  openSheet(`<div class="bar"><h2>End employment</h2><button class="ghost" data-close>Close</button></div><p class="help"><b>${esc(w.name)}</b></p>
    <div class="grid2"><div><label class="f" for="te-on">Last day worked</label><input id="te-on" type="date" value="${todayStr()}"></div><div><label class="f" for="te-why">Reason (kept private)</label><input id="te-why" type="text" placeholder="Example: resigned, or attendance"></div></div>
    <h3>Checklist</h3><dl class="kv"><dt>Final paycheck due</dt><dd id="te-due">${esc(niceDate(nextPayday(todayStr())))}</dd>
    <dt>Sick time balance</dt><dd>${bal ? h2(bal.available) + " h, not paid out unless you add it as Other pay" : "unavailable"}</dd>
    <dt>App access</dt><dd>Turned off on save</dd><dt>Open shift</dt><dd>Closed for review</dd><dt>Records</dt><dd>Kept for 3 years</dd></dl>
    <div class="actions"><button class="ghost" id="te-export">Export this worker's record (CSV)</button></div>
    <button class="primary" id="te-go" style="background:var(--danger)">End employment</button>`);
  $("#te-on").onchange = () => $("#te-due").textContent = niceDate(nextPayday($("#te-on").value || todayStr()));
  $("#te-export").onclick = async () => { const qq = v => `"${String(v ?? "").replace(/"/g, '""')}"`, lines = [["Type", "Date", "Detail", "Hours or points", "Status"].map(qq).join(",")];
    try { const [ps, rs, es, as] = await Promise.all([q(sb.from("punches").select("*").eq("worker_id", id).order("clock_in")), q(sb.from("sick_requests").select("*").eq("worker_id", id).order("on_date")), q(sb.from("attendance_events").select("*").eq("worker_id", id).order("on_date")), q(sb.from("discipline_actions").select("*").eq("worker_id", id).order("issued_at"))]);
      ps.forEach(p => lines.push(["Shift", p.clock_in, siteName(p.site_id), h2(punchHours(p)), p.status].map(qq).join(","))); rs.forEach(r => lines.push(["Sick request", r.on_date, r.kind + ": " + r.reason, r.hours, r.status].map(qq).join(",")));
      es.forEach(e => lines.push(["Attendance", e.on_date, e.kind + ": " + e.note, e.points, ""].map(qq).join(","))); as.forEach(a => lines.push(["Discipline", a.issued_at, a.step_name + ": " + a.reason, a.points_at_time, a.worker_ack_at ? "signed" : "not signed"].map(qq).join(",")));
      download(`record-${w.name.replace(/[^a-z0-9]+/gi, "-")}.csv`, "text/csv", lines.join("\r\n")); } catch (e) { fail(e); } };
  $("#te-go").onclick = async () => { const b = $("#te-go"); if (b.dataset.ok !== "1") { b.dataset.ok = "1"; b.textContent = "Tap again to confirm"; return; }
    const { error } = await sb.rpc("terminate_worker", { p_worker: id, p_on: $("#te-on").value, p_reason: $("#te-why").value.trim() }); if (error) return fail(error); closeSheet(); toast("Employment ended"); refresh(); };
}

/* ================= sites ================= */
function renderSites() {
  $("#v-sites").innerHTML = `${backMore}<h2>Sites</h2><p class="help">Each site has a pin and a radius. Workers can clock in only at sites they are assigned to.</p>` +
    (S.sites.length ? `<ul class="list">` + S.sites.map(s => { const n = S.assigns.filter(a => a.site_id === s.id).length; return `<li><button class="rowbtn" data-site="${esc(s.id)}"><span class="main"><b>${esc(s.name)}</b><small>${s.lat == null ? "No pin set, location is not checked" : s.radius_m + " m radius"}, ${n} worker${n === 1 ? "" : "s"}${s.active ? "" : ", inactive"}</small></span></button></li>`; }).join("") + `</ul>`
      : `<p class="empty">No sites yet. Add the first site your officers cover.</p>`) + `<button class="primary" id="s-add">Add site</button>`;
  $("#s-add").onclick = () => siteSheet(null);
}
function siteSheet(id) {
  const s = S.sites.find(x => x.id === id) || { radius_m: 150, active: true }, on = new Set(S.assigns.filter(a => a.site_id === id).map(a => a.worker_id));
  const ws = S.workers.filter(w => !w.archived || on.has(w.id));
  openSheet(`<div class="bar"><h2>${id ? "Edit site" : "Add site"}</h2><button class="ghost" data-close>Close</button></div>
    <label class="f" for="s-name">Site name</label><input id="s-name" type="text" value="${esc(s.name || "")}" placeholder="Example: Dr. Patel's office">
    <label class="f" for="s-addr">Address (for your reference)</label><input id="s-addr" type="text" value="${esc(s.address || "")}">
    <label class="f" for="s-city">City income tax where this site is</label><select id="s-city">${cityOptions(s.city)}</select>
    <h3>Pin</h3><p class="help">Easiest way: stand at the site and tap the button. Or press and hold the spot in Google Maps and copy the two numbers.</p>
    <button class="ghost" id="s-here">Use my current location</button>
    <div class="grid2"><div><label class="f" for="s-lat">Latitude</label><input id="s-lat" type="number" inputmode="decimal" step="any" value="${esc(s.lat ?? "")}"></div><div><label class="f" for="s-lng">Longitude</label><input id="s-lng" type="number" inputmode="decimal" step="any" value="${esc(s.lng ?? "")}"></div></div>
    <p class="help" id="s-map"></p>
    <label class="f" for="s-rad">Clock-in radius (meters)</label><input id="s-rad" type="number" inputmode="numeric" min="25" max="5000" step="5" value="${esc(s.radius_m)}">
    <p class="help">150 meters works for most buildings. Phone GPS drifts indoors, so a tight radius causes false rejections.</p>
    <label class="check"><input id="s-active" type="checkbox" ${s.active ? "checked" : ""}> Site is active</label>
    <h3>Scheduling defaults</h3><p class="help">Filled in automatically when you add a shift here. Any shift can override them.</p>
    <div class="seg" id="s-kind"><button type="button" data-v="fixed" aria-pressed="${(s.sched_type || "fixed") === "fixed"}">Fixed start</button><button type="button" data-v="window" aria-pressed="${s.sched_type === "window"}">Any time in a window</button></div>
    <div id="s-kfixed" ${(s.sched_type || "fixed") === "fixed" ? "" : "hidden"}><label class="f" for="s-start">Usual start time</label><input id="s-start" type="time" value="${esc(hhmm(s.default_start))}"></div>
    <div id="s-kwindow" ${s.sched_type === "window" ? "" : "hidden"}><div class="grid2"><div><label class="f" for="s-open">Site opens for coverage</label><input id="s-open" type="time" value="${esc(hhmm(s.window_open))}"></div><div><label class="f" for="s-due">Work due by</label><input id="s-due" type="time" value="${esc(hhmm(s.window_due))}"></div></div></div>
    <label class="f" for="s-hours">Usual job length (hours)</label><input id="s-hours" type="number" inputmode="decimal" min="0" max="24" step="0.25" value="${esc(Number(s.default_hours) || "")}">
    <label class="check"><input id="s-guar" type="checkbox" ${s.guarantee !== false ? "checked" : ""}> Guaranteed pay: paid for the planned hours even when they finish early</label>
    <label class="check"><input id="s-rt" type="checkbox" ${s.requires_tasks ? "checked" : ""}> Guarantee only when all required checklist tasks are done</label>
    <h3>Who works here</h3><div class="checks">${ws.length ? ws.map(w => `<label class="check" style="margin:6px 0"><input type="checkbox" data-aw="${esc(w.id)}" ${on.has(w.id) ? "checked" : ""}> ${esc(w.name)}</label>`).join("") : `<p class="help">Add workers first.</p>`}</div>
    <h3>Checklist</h3><p class="help">Tasks the worker ticks off on their phone while clocked in here. Each shift starts with a fresh list.</p>
    ${id ? `<ul class="list" id="st-list">${tasksFor(id).map(t => `<li><div class="rowbtn" style="display:flex;padding:8px 8px 8px 14px;gap:10px;align-items:center;min-height:44px;flex-wrap:wrap"><span class="main"><b>${esc(t.title)}</b><small>${PROOF_LABEL[t.proof]}${t.proof !== "none" ? (t.proof_required ? ", required" : ", optional") : ""}</small></span>
      <select data-st-proof="${esc(t.id)}" style="width:auto;min-height:36px;padding:6px 8px">${Object.entries(PROOF_LABEL).map(([k, l]) => `<option value="${k}" ${t.proof === k ? "selected" : ""}>${l}</option>`).join("")}</select>
      <label class="check" style="margin:0;font-size:13px"><input type="checkbox" data-st-req="${esc(t.id)}" ${t.proof_required ? "checked" : ""} ${t.proof === "none" ? "disabled" : ""}> Required</label>
      <button type="button" class="ghost" data-st-del="${esc(t.id)}" style="min-height:36px;padding:6px 10px">Remove</button></div></li>`).join("")}</ul>
    <div class="panel" style="margin-top:8px"><label class="f" for="st-new">New task</label><input id="st-new" type="text" placeholder="Example: Vacuum lobby and hallways">
    <div class="grid2"><div><label class="f" for="st-proof">Proof</label><select id="st-proof">${Object.entries(PROOF_LABEL).map(([k, l]) => `<option value="${k}">${l}</option>`).join("")}</select></div>
    <div><label class="f">&nbsp;</label><label class="check" style="margin:0;min-height:46px"><input id="st-req" type="checkbox"> Proof is required</label></div></div>
    <button type="button" class="ghost" id="st-add" style="margin-top:10px">Add task</button></div>` : `<p class="help">Save the site first, then come back to add tasks.</p>`}
    <button class="primary" id="s-save">Save site</button>${id ? `<div class="actions"><button class="danger" id="s-del">Delete site</button></div>` : ""}`);
  const map = () => { const a = $("#s-lat").value, b = $("#s-lng").value; $("#s-map").innerHTML = a && b ? `<a href="https://maps.google.com/?q=${encodeURIComponent(a + "," + b)}" target="_blank" rel="noopener" style="color:var(--accent)">Check this pin on a map</a>` : ""; };
  map(); $("#s-lat").oninput = map; $("#s-lng").oninput = map;
  let kind = s.sched_type || "fixed";
  $("#s-kind").onclick = e => { const k = e.target.dataset.v; if (!k) return; kind = k; $("#s-kind").querySelectorAll("button").forEach(b => b.setAttribute("aria-pressed", b.dataset.v === k)); $("#s-kfixed").hidden = k !== "fixed"; $("#s-kwindow").hidden = k !== "window"; };
  const sa = $("#st-add"); if (sa) sa.onclick = async () => { const title = $("#st-new").value.trim(); if (!title) return toast("Type the task first");
    const proof = $("#st-proof").value, r = await sb.from("site_tasks").insert({ site_id: id, title, sort_order: tasksFor(id).length, proof, proof_required: proof !== "none" && $("#st-req").checked }); if (r.error) return fail(r.error); await loadData(); siteSheet(id); setTimeout(() => { const n = $("#st-new"); if (n) n.focus(); }, 50); };
  const upd = async (tid, body) => { const r = await sb.from("site_tasks").update(body).eq("id", tid); if (r.error) return fail(r.error); await loadData(); siteSheet(id); };
  document.querySelectorAll("[data-st-del]").forEach(b => b.onclick = () => upd(b.dataset.stDel, { active: false }));
  document.querySelectorAll("[data-st-proof]").forEach(s => s.onchange = () => upd(s.dataset.stProof, { proof: s.value, proof_required: s.value === "none" ? false : (S.tasks.find(t => t.id === s.dataset.stProof) || {}).proof_required }));
  document.querySelectorAll("[data-st-req]").forEach(c => c.onchange = () => upd(c.dataset.stReq, { proof_required: c.checked }));
  $("#s-here").onclick = async () => { const b = $("#s-here"); b.disabled = true; b.textContent = "Finding you"; const p = await getSpot(); b.disabled = false; b.textContent = "Use my current location";
    if (!p) return toast("Location is off or blocked for this app."); $("#s-lat").value = p.lat.toFixed(6); $("#s-lng").value = p.lng.toFixed(6); map(); toast(`Pin set, accurate to about ${Math.round(p.acc)} m`); };
  $("#s-save").onclick = async () => { const name = $("#s-name").value.trim(); if (!name) return toast("Enter a site name");
    const la = $("#s-lat").value, lo = $("#s-lng").value; if ((la === "") !== (lo === "")) return toast("Enter both latitude and longitude");
    if (la !== "" && (Math.abs(+la) > 90 || Math.abs(+lo) > 180)) return toast("Those coordinates are out of range");
    const body = { name, address: $("#s-addr").value.trim(), lat: la === "" ? null : +la, lng: lo === "" ? null : +lo, radius_m: Math.min(5000, Math.max(25, Math.round(num($("#s-rad").value) || 150))), active: $("#s-active").checked,
      city: $("#s-city").value, sched_type: kind, default_start: $("#s-start").value || null, window_open: $("#s-open").value || null, window_due: $("#s-due").value || null, default_hours: num($("#s-hours").value), guarantee: $("#s-guar").checked, requires_tasks: $("#s-rt").checked };
    let sid = id; if (id) { const r = await sb.from("sites").update(body).eq("id", id); if (r.error) return fail(r.error); } else { const r = await sb.from("sites").insert(body).select().single(); if (r.error) return fail(r.error); sid = r.data.id; }
    const want = new Set([...document.querySelectorAll("[data-aw]")].filter(c => c.checked).map(c => c.dataset.aw));
    const add = [...want].filter(x => !on.has(x)).map(worker_id => ({ site_id: sid, worker_id })), drop = [...on].filter(x => !want.has(x));
    if (add.length) { const r = await sb.from("site_assignments").insert(add); if (r.error) return fail(r.error); }
    if (drop.length) { const r = await sb.from("site_assignments").delete().eq("site_id", sid).in("worker_id", drop); if (r.error) return fail(r.error); }
    closeSheet(); toast("Site saved"); refresh(); };
  const d = $("#s-del"); if (d) d.onclick = async () => { if (d.dataset.ok !== "1") { d.dataset.ok = "1"; d.textContent = "Tap again to delete"; return; } const r = await sb.from("sites").delete().eq("id", id); if (r.error) return fail(r.error); closeSheet(); toast("Site deleted"); refresh(); };
}

/* ================= people ================= */
function renderPeople() {
  const ps = [...S.people].sort((a, b) => (a.active ? 1 : 0) - (b.active ? 1 : 0) || (a.full_name || "").localeCompare(b.full_name || ""));
  $("#v-people").innerHTML = `${backMore}<h2>People and roles</h2><p class="help">Everyone who created an account. Approve new people, pick their role, and link each login to a worker so they can clock in.</p><ul class="list">` +
    ps.map(p => `<li><button class="rowbtn" data-person="${esc(p.id)}"><span class="main"><b>${esc(p.full_name || p.email)}</b><small>${esc(p.email)}${p.worker_id ? "" : ", not linked to a worker"}</small></span>${readyToHire(p) ? `<span class="tag c">Ready to approve</span>` : `<span class="tag ${p.active ? "" : "c"}">${p.active ? roleLabel(p) : "Waiting"}</span>`}</button></li>`).join("") + `</ul>`;
}
/* Signed their paperwork at sign-up and has no worker record yet: one form approves them. */
const readyToHire = p => !p.worker_id && (S.pendingNames || []).some(x => x.profile_id === p.id);
const roleLabel = p => p.is_admin ? "Administrator" : p.role === "employee" ? workerLabel(p) : ROLE_LABEL[p.role];
function personSheet(id) {
  const p = S.people.find(x => x.id === id); if (!p) return; const owner = S.me.role === "owner" || S.me.is_admin, admin = !!S.me.is_admin;
  const locked = (!owner && (p.role === "owner" || p.role === "manager")) || (p.is_admin && !admin), roles = owner ? ["owner", "manager", "supervisor", "employee"] : ["supervisor", "employee"];
  const taken = new Set(S.people.filter(x => x.worker_id && x.id !== id).map(x => x.worker_id)), ws = S.workers.filter(w => !taken.has(w.id) && (!w.archived || w.id === p.worker_id));
  const about = { owner: "Everything, including tax settings and who holds which role.", manager: "Workers, sites, timesheets and payroll.", supervisor: "Reviews and corrects shifts at the sites they are assigned to.", employee: "A worker. An employee clocks in and out; a contractor bills visits and picks up jobs. Which one is set by the pay type on the worker record you link below." };
  const pp = (S.pendingNames || []).find(x => x.profile_id === id), hire = !locked && readyToHire(p);
  openSheet(`<div class="bar"><h2>${esc(p.full_name || p.email)}</h2><button class="ghost" data-close>Close</button></div><p class="help">${esc(p.email)}</p>
    ${pp ? `<p class="note">Signed paperwork on file as <b>${esc(pp.legal_name)}</b>${pp.city ? ", " + esc(pp.city) : ""}.${hire ? "" : ` It moves onto the worker record the moment you link one below.`}${!hire && !p.worker_id && !S.workers.some(w => !w.archived && w.name.toLowerCase() === pp.legal_name.toLowerCase()) ? ` <button class="linkbtn" id="pr-mkw" style="padding:0">Create the worker record now</button>` : ""}</p>` : ""}
    ${p.is_admin ? `<p class="note">Administrator. Has every owner power and can assign owners and administrators.</p>` : ""}
    ${hire ? `<h3>Approve and add to payroll</h3><div class="panel">
      <p class="help" style="margin-top:0">One step: creates the worker record for <b>${esc(pp.legal_name)}</b> with the pay below, moves their signed W-4, MI-W4, address and Social Security number onto it, assigns their sites, and lets them sign in.</p>
      <div class="grid2"><div><label class="f" for="hr-type">Pay type</label><select id="hr-type"><option value="W-2">Employee (W-2)</option><option value="1099">Contractor (1099)</option></select></div>
        <div><label class="f" for="hr-rate">Hourly rate ($)</label><input id="hr-rate" type="number" inputmode="decimal" min="0.01" step="0.01" placeholder="18.00"></div></div>
      <div class="grid2"><div><label class="f" for="hr-hire">Hire date</label><input id="hr-hire" type="date" value="${todayStr()}"></div>
        <div><label class="f" for="hr-role">Role</label><select id="hr-role">${roles.filter(r => r !== "owner").map(r => `<option value="${r}" ${r === "employee" ? "selected" : ""}>${ROLE_LABEL[r]}</option>`).join("")}</select></div></div>
      ${S.sites.some(x => x.active) ? `<label class="f">Sites they work at</label><div class="checks">${S.sites.filter(x => x.active).map(x => `<label class="check"><input type="checkbox" data-hrsite="${esc(x.id)}"> ${esc(x.name)}</label>`).join("")}</div>`
        : `<p class="help">No sites yet. Assign sites later under More, Sites.</p>`}
      <button class="primary" id="hr-go">Approve and add to payroll</button></div>
      <details class="inbox-reply"><summary>Set up by hand instead</summary>` : ""}
    ${locked ? `<p class="note">${p.is_admin ? "Only an administrator can change an administrator." : "Only an owner can change owners and managers."}</p>` : `
    <label class="f" for="pr-role">Role</label><select id="pr-role">${roles.map(r => `<option value="${r}" ${p.role === r ? "selected" : ""}>${ROLE_LABEL[r]}</option>`).join("")}</select><p class="help" id="pr-about"></p>
    <label class="f" for="pr-worker">Worker record</label><select id="pr-worker"><option value="">Not linked</option>${ws.map(w => `<option value="${esc(w.id)}" ${p.worker_id === w.id ? "selected" : ""}>${esc(w.name)}</option>`).join("")}</select>
    <p class="help">Linking is what lets this person clock in and see their own pay. Supervisors also need a link, plus a site assignment.</p>
    <label class="check"><input id="pr-active" type="checkbox" ${p.active ? "checked" : ""}> Account is approved and can sign in</label>
    ${admin ? `<label class="check"><input id="pr-admin" type="checkbox" ${p.is_admin ? "checked" : ""}> Administrator (everything an owner can do, plus assigning owners)</label>` : ""}
    <button class="primary" id="pr-save">Save</button>`}${hire ? `</details>` : ""}`);
  if (hire) $("#hr-go").onclick = async () => {
    const rate = Number($("#hr-rate").value), hireDate = $("#hr-hire").value, role = $("#hr-role").value, type = $("#hr-type").value;
    if (!(rate > 0)) { toast("Enter their hourly rate."); return $("#hr-rate").focus(); }
    if (!hireDate) { toast("Enter their hire date."); return $("#hr-hire").focus(); }
    const sites = [...document.querySelectorAll("[data-hrsite]:checked")].map(c => c.dataset.hrsite), b = $("#hr-go"); b.disabled = true; b.textContent = "Approving...";
    const w = await sb.from("workers").insert({ name: pp.legal_name, type, rate, hire_date: hireDate, home_city: "none" }).select().single();
    if (w.error) { b.disabled = false; b.textContent = "Approve and add to payroll"; return fail(w.error); }
    const a = sites.length ? await sb.from("site_assignments").insert(sites.map(site_id => ({ site_id, worker_id: w.data.id }))) : { error: null };
    const r = a.error ? a : await sb.rpc("set_profile", { p_id: id, p_role: role, p_active: true, p_worker: w.data.id });
    if (r.error) { await sb.from("workers").delete().eq("id", w.data.id); b.disabled = false; b.textContent = "Approve and add to payroll"; return fail(r.error); }
    closeSheet(); toast(`${pp.legal_name} is approved and on payroll`); refresh(); };
  const mk = $("#pr-mkw"); if (mk) mk.onclick = async () => { const r = await sb.from("workers").insert({ name: pp.legal_name, type: "W-2", rate: 0, hire_date: todayStr(), home_city: "none" }).select().single(); if (r.error) return fail(r.error); await loadData(); personSheet(id); $("#pr-worker").value = r.data.id; toast("Worker record created. Set the pay rate under Workers."); };
  if (locked) return; const ab = () => $("#pr-about").textContent = about[$("#pr-role").value]; ab(); $("#pr-role").onchange = ab;
  $("#pr-save").onclick = async () => { const { error } = await sb.rpc("set_profile", { p_id: id, p_role: $("#pr-role").value, p_active: $("#pr-active").checked, p_worker: $("#pr-worker").value || null });
    if (error) return fail(error);
    const pa = $("#pr-admin"); if (pa && pa.checked !== !!p.is_admin) { const r = await sb.rpc("set_admin", { p_id: id, p_admin: pa.checked }); if (r.error) return fail(r.error); }
    closeSheet(); toast("Saved"); if (id === S.me.id) return boot(); refresh(); };
}
