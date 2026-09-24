/* ================= team timesheets ================= */
function renderTeam() {
  const v = $("#v-team"), all = S.punches, open = all.filter(p => p.status === "open"), sub = all.filter(p => p.status === "submitted");
  const cutoff = Date.now() - 14 * 864e5, done = all.filter(p => (p.status === "approved" || p.status === "rejected") && new Date(p.clock_in) > cutoff);
  const clean = sub.filter(p => !p.in_flagged && !p.out_flagged && p.worker_id !== S.me.worker_id);
  let h = `<h2>${isMgr() ? "Timesheets" : "Team"}</h2>`; if (isMgr()) h += renderTodos();
  h += weekTable();
  const pend = S.requests.filter(r => r.status === "pending" && r.worker_id !== S.me.worker_id), recent = S.requests.filter(r => r.status !== "pending" && r.worker_id !== S.me.worker_id && new Date(r.on_date) > cutoff);
  h += `<h3>Time off requests</h3>` + (pend.length ? `<ul class="list">${pend.map(r => requestRow(r, true)).join("")}</ul>` : `<p class="help">No requests waiting.</p>`) + (recent.length ? `<ul class="list">${recent.slice(0, 10).map(r => requestRow(r, true)).join("")}</ul>` : "");
  const pinv = S.invoices.filter(i => i.status === "pending"), rinv = S.invoices.filter(i => i.status !== "pending" && new Date(i.on_date) > cutoff);
  if (isMgr() && (pinv.length || rinv.length)) h += `<h3>Contractor invoices</h3>` + (pinv.length ? `<ul class="list">${pinv.map(i => invoiceRow(i, true)).join("")}</ul>` : `<p class="help">None waiting.</p>`) + (rinv.length ? `<ul class="list">${rinv.slice(0, 10).map(i => invoiceRow(i, true)).join("")}</ul>` : "");
  h += `<h3>On the clock now</h3>` + (open.length ? `<ul class="list">${open.map(p => punchRow(p, true)).join("")}</ul>` : `<p class="help">Nobody is clocked in.</p>`);
  h += `<h3>Waiting for review</h3>` + (sub.length ? `<ul class="list">${sub.map(p => punchRow(p, true)).join("")}</ul>` : `<p class="help">Nothing to review.</p>`);
  if (clean.length) h += `<button class="ghost" id="t-all">Approve ${clean.length} on-site shift${clean.length > 1 ? "s" : ""}</button>`;
  h += `<h3>Reviewed in the last 14 days</h3>` + (done.length ? `<ul class="list">${done.map(p => punchRow(p, true)).join("")}</ul>` : `<p class="help">No reviewed shifts yet.</p>`);
  const missed = S.shifts.filter(s => s.status === "missed" && new Date(s.on_date) > cutoff);
  if (missed.length) h += `<h3>Missed shifts</h3><ul class="list">${missed.map(s => `<li><div class="rowbtn" style="display:flex;padding:13px 14px;gap:12px;align-items:center;flex-wrap:wrap"><span class="main"><b>${esc(nameOf(s.worker_id))}</b><small>${esc(siteName(s.site_id))}, ${esc(niceDate(s.on_date))}, ${esc(shiftWhen(s))}</small></span><button class="ghost" data-ncns="${esc(s.id)}" style="min-height:36px;padding:6px 10px">Log no call, no show</button></div></li>`).join("")}</ul>`;
  h += `<button class="primary" id="t-add">Add hours by hand</button>`;
  v.innerHTML = h;
  $("#t-add").onclick = addPunchSheet; wireTodos();
  document.querySelectorAll("[data-ncns]").forEach(b => b.onclick = async () => { const s = S.shifts.find(x => x.id === b.dataset.ncns); if (!s) return; b.disabled = true;
    const { error } = await sb.rpc("add_attendance_event", { p_worker: s.worker_id, p_kind: "no_call_no_show", p_on: s.on_date, p_note: `Missed scheduled shift at ${siteName(s.site_id)}` }); if (error) { b.disabled = false; return fail(error); } toast("Logged"); refresh(); });
  const ba = $("#t-all"); if (ba) ba.onclick = async () => { ba.disabled = true; let n = 0;
    for (const p of clean) { const { error } = await sb.rpc("edit_punch", { p_id: p.id, p_in: p.clock_in, p_out: p.clock_out, p_break: p.break_minutes, p_status: "approved", p_reason: "" }); if (error) { fail(error); break; } n++; }
    toast(`${n} shift${n === 1 ? "" : "s"} approved`); refresh(); };
}
/* Hours this workweek for everyone visible, plus late-notice pattern flags. Tap a row for attendance and discipline. */
function weekTable() {
  const wk = weekKey(new Date().toISOString(), S.cfg.weekStart), people = (isMgr() ? S.workers.filter(w => w.type === "W-2") : S.directory).filter(w => !w.archived), ninety = Date.now() - 90 * 864e5;
  if (!people.length) return "";
  const rows = people.map(w => { const hrs = S.punches.filter(p => p.worker_id === w.id && p.status !== "rejected" && weekKey(p.clock_in, S.cfg.weekStart) === wk)
      .reduce((a, p) => a + (p.clock_out ? punchHours(p) : Math.max(0, (Date.now() - new Date(p.clock_in)) / 36e5)), 0);
    const cap = capOf(w), late = S.requests.filter(r => r.worker_id === w.id && r.late && new Date(r.on_date) > ninety).length, pts = pointsOf(w.id);
    const cls = hrs >= cap ? "red" : hrs >= cap * 0.9 ? "amber" : "";
    return `<li><button class="rowbtn" data-att="${esc(w.id)}"><span class="main"><b>${esc(w.name)}${late >= 3 ? ` <span class="tag late">Pattern</span>` : ""}${pts ? ` <span class="tag c">${pts} pts</span>` : ""}</b><div class="meter ${cls}"><div style="width:${Math.min(100, hrs / cap * 100)}%"></div></div></span><span class="num"><b>${h2(hrs)}</b><small style="display:block;color:var(--muted)">of ${h2(cap)} h</small></span></button></li>`; });
  return `<h3>This week</h3><ul class="list">${rows.join("")}</ul>`;
}
const pointsOf = wid => { const t = todayStr(); return Math.round(S.events.filter(e => e.worker_id === wid && e.on_date <= t && e.expires_on > t).reduce((a, e) => a + Number(e.points), 0) * 100) / 100; };
const EVENT_LABEL = { no_call_no_show: "No call, no show", late_notice: "Late notice", unexcused: "Unexcused absence", tardy: "Tardy" };

function attendanceSheet(wid) {
  const name = nameOf(wid), ev = S.events.filter(e => e.worker_id === wid), acts = S.actions.filter(a => a.worker_id === wid), pts = pointsOf(wid), d = S.cfg.discipline || {};
  const steps = d.steps || [{ name: "Verbal warning", points: 3 }, { name: "Written warning", points: 5 }, { name: "Final warning", points: 7 }, { name: "Termination", points: 9 }];
  const issued = new Set(acts.map(a => a.step_name)), next = steps.find(s => pts >= Number(s.points) && !issued.has(s.name));
  openSheet(`<div class="bar"><h2>${esc(name)}</h2><button class="ghost" data-close>Close</button></div>
    <p class="note num" id="at-sick">Sick time: loading</p>
    <p class="help num">Attendance points: <b>${pts}</b>${next ? `. Next step: <b>${esc(next.name)}</b> at ${next.points}.` : steps.length ? `. Next step at ${esc(String((steps.find(s => pts < Number(s.points)) || {}).points || "none"))} points.` : ""}</p>
    <h3>Add an attendance event</h3><div class="panel"><label class="f" for="ae-kind">What happened</label><select id="ae-kind">${Object.entries(EVENT_LABEL).map(([k, l]) => `<option value="${k}">${l} (${(d.pointValues || {})[k] ?? { no_call_no_show: 3, late_notice: 1, unexcused: 2, tardy: 0.5 }[k]} pts)</option>`).join("")}</select>
    <div class="grid2"><div><label class="f" for="ae-date">Date</label><input id="ae-date" type="date" value="${todayStr()}" max="${todayStr()}"></div><div><label class="f" for="ae-note">Note</label><input id="ae-note" type="text"></div></div>
    <button class="primary" id="ae-add">Add event</button><p class="help">Approved sick time can never be logged here. The app refuses it.</p></div>
    ${ev.length ? `<h3>Events</h3><ul class="list">${ev.map(e => `<li><div class="rowbtn" style="display:flex;padding:13px 14px;gap:12px;align-items:center"><span class="main"><b>${EVENT_LABEL[e.kind]}</b><small>${esc(niceDate(e.on_date))}${e.note ? ", " + esc(e.note) : ""}, by ${esc(e.created_by_name || "manager")}${e.expires_on <= todayStr() ? ", expired" : ""}</small></span><span class="num"><b>${e.points}</b></span>${isMgr() ? `<button class="ghost" data-ae-del="${esc(e.id)}" style="min-height:36px;padding:6px 10px">Remove</button>` : ""}</div></li>`).join("")}</ul>` : ""}
    ${isMgr() ? `<h3>Discipline</h3><div class="panel"><label class="f" for="di-step">Step</label><select id="di-step">${steps.map(s => `<option ${next && next.name === s.name ? "selected" : ""}>${esc(s.name)}</option>`).join("")}</select>
    <label class="f" for="di-why">Reason (the worker reads this)</label><textarea id="di-why" rows="2"></textarea><button class="primary" id="di-issue">Issue this step</button>
    <p class="help">The worker is asked to sign on their phone. Never issue a step for properly used sick time.</p></div>` : ""}
    ${acts.length ? `<ul class="list">${acts.map(a => `<li><div class="rowbtn" style="display:flex;padding:13px 14px;gap:12px;align-items:center"><span class="main"><b>${esc(a.step_name)}</b><small>${esc(niceDate(a.issued_at.slice(0, 10)))}, ${a.points_at_time} pts, by ${esc(a.issued_by_name || "manager")}. ${esc(a.reason)}</small></span><span class="tag ${a.worker_ack_at ? "ok" : "c"}">${a.worker_ack_at ? "Signed" : "Not signed"}</span></div></li>`).join("")}</ul>` : ""}`);
  sickLine(wid, "#at-sick");
  $("#ae-add").onclick = async () => { const { error } = await sb.rpc("add_attendance_event", { p_worker: wid, p_kind: $("#ae-kind").value, p_on: $("#ae-date").value, p_note: $("#ae-note").value.trim() });
    if (error) return fail(error); toast("Event added"); await loadData(); attendanceSheet(wid); };
  document.querySelectorAll("[data-ae-del]").forEach(b => b.onclick = async () => { const { error } = await sb.rpc("delete_attendance_event", { p_id: b.dataset.aeDel }); if (error) return fail(error); await loadData(); attendanceSheet(wid); });
  const di = $("#di-issue"); if (di) di.onclick = async () => { const { error } = await sb.rpc("issue_discipline", { p_worker: wid, p_step: $("#di-step").value, p_reason: $("#di-why").value.trim() }); if (error) return fail(error); toast("Issued"); await loadData(); attendanceSheet(wid); };
}
async function punchSheet(id) {
  const p = S.punches.find(x => x.id === id); if (!p) return;
  const locked = !!p.paycheck_id, own = isSup() && p.worker_id === S.me.worker_id;
  const dist = (d, f) => d == null ? "Not recorded" : `${Math.round(d)} m from site${f ? " (outside the radius)" : ""}`;
  openSheet(`<div class="bar"><h2>${esc(nameOf(p.worker_id))}</h2><button class="ghost" data-close>Close</button></div>
    <p class="help">${esc(siteName(p.site_id))}. ${punchTags(p)}</p>
    <dl class="kv num"><dt>Clock-in location</dt><dd>${p.manual ? "Added by hand" : dist(p.in_distance_m, p.in_flagged)}</dd><dt>Clock-out location</dt><dd>${p.manual ? "Added by hand" : p.clock_out ? dist(p.out_distance_m, p.out_flagged) : "Still on the clock"}</dd>
    ${p.shift_id ? `<dt>Planned</dt><dd>${h2(p.planned_hours || 0)} h</dd><dt>Worked</dt><dd>${p.clock_out ? h2(punchHours(p)) + " h" : "On the clock"}</dd><dt>Paid</dt><dd>${p.paid_hours != null ? h2(p.paid_hours) + " h" + (Number(p.paid_hours) > punchHours(p) + 0.005 ? " (guaranteed)" : "") : ""}</dd>` : ""}</dl>
    ${(() => { const pr = taskProgress(p); if (!pr) return ""; const d = doneSet(p.id); return `<h3>Checklist, ${pr.done} of ${pr.total} done</h3><ul class="list">${tasksFor(p.site_id).map(t => { const c = S.taskChecks.find(x => x.punch_id === p.id && x.task_id === t.id);
      return `<li><div class="rowbtn" style="display:flex;padding:10px 14px;gap:12px;align-items:center;min-height:44px;flex-wrap:wrap"><span class="main"><b style="font-weight:${d.has(t.id) ? 400 : 600}">${esc(t.title)}</b>${t.proof !== "none" ? `<small>${PROOF_LABEL[t.proof]} ${t.proof_required ? "required" : "optional"}</small>` : ""}</span>
      ${c && c.proof_path ? `<button type="button" class="ghost" data-view="${esc(c.proof_path)}" data-vtype="${esc(c.proof_type)}" style="min-height:36px;padding:6px 10px">View ${c.proof_type}</button>` : ""}<span class="tag ${d.has(t.id) ? "ok" : "no"}">${d.has(t.id) ? "Done" : "Not done"}</span><div id="pv-${esc(t.id)}" style="flex-basis:100%"></div></div></li>`; }).join("")}</ul>`; })()}
    ${locked ? `<p class="note">This shift is on a paycheck, so it cannot be changed. Delete the paycheck first if it needs a correction.</p>` : own ? `<p class="note">Supervisors cannot change their own hours. Ask a manager.</p>` : `
    <div><div><label class="f" for="p-in">Clock in</label><input id="p-in" type="datetime-local" value="${toLocalInput(p.clock_in)}" style="width:100%;background:var(--paper);border:1px solid var(--line);border-radius:8px;padding:11px 8px;min-height:46px"></div>
    <div><label class="f" for="p-out">Clock out</label><input id="p-out" type="datetime-local" value="${toLocalInput(p.clock_out)}" style="width:100%;background:var(--paper);border:1px solid var(--line);border-radius:8px;padding:11px 8px;min-height:46px"></div></div>
    <label class="f" for="p-break">Unpaid break (minutes)</label><input id="p-break" type="number" inputmode="numeric" min="0" step="1" value="${esc(p.break_minutes)}">
    <label class="f" for="p-reason">Reason (needed when you change times or reject)</label><input id="p-reason" type="text" placeholder="Example: forgot to clock out, left at 4:30">
    <button class="primary" data-ps="approved">${p.status === "approved" ? "Save changes" : "Approve"}</button>
    <div class="actions"><button class="ghost" data-ps="submitted">Save without approving</button><button class="danger" data-ps="rejected">Reject shift</button></div>`}
    <div id="p-hist"></div>`);
  document.querySelectorAll("[data-view]").forEach(b => b.onclick = async () => { b.disabled = true; try { const u = await proofUrl(b.dataset.view); const box = b.parentElement.querySelector("[id^=pv-]");
      box.innerHTML = b.dataset.vtype === "video" ? `<video src="${esc(u)}" controls playsinline style="width:100%;border-radius:8px;margin-top:8px"></video>` : `<a href="${esc(u)}" target="_blank" rel="noopener"><img src="${esc(u)}" alt="Proof photo" style="width:100%;border-radius:8px;margin-top:8px"></a>`; b.hidden = true; } catch (e) { fail(e); b.disabled = false; } });
  /* The inputs only hold minutes. If a field was not touched, send the stored value back unchanged so it does not count as an edit. */
  const same = (sel, orig) => $(sel).value === toLocalInput(orig) ? orig : fromLocalInput($(sel).value);
  document.querySelectorAll("[data-ps]").forEach(b => b.onclick = async () => {
    const { error } = await sb.rpc("edit_punch", { p_id: id, p_in: same("#p-in", p.clock_in), p_out: same("#p-out", p.clock_out), p_break: Math.round(num($("#p-break").value)), p_status: b.dataset.ps, p_reason: $("#p-reason").value.trim() });
    if (error) return fail(error); closeSheet(); toast(b.dataset.ps === "approved" ? "Shift approved" : b.dataset.ps === "rejected" ? "Shift rejected" : "Shift saved"); refresh(); });
  try { const ed = await q(sb.from("punch_edits").select("*").eq("punch_id", id).order("edited_at", { ascending: false })); const box = $("#p-hist");
    if (box && ed.length) box.innerHTML = `<h3>Change log</h3>` + ed.map(e => `<p class="help" style="margin:4px 0">${esc(new Date(e.edited_at).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" }))}, ${esc(e.edited_by_name || "Manager")}: ${esc(e.before ? (e.before.status + " to " + e.after.status) : "added by hand")}${e.reason ? ". " + esc(e.reason) : ""}</p>`).join(""); } catch (e) {}
}
function addPunchSheet() {
  const names = (isMgr() ? S.workers.filter(w => !w.archived) : S.directory.filter(w => !w.archived && w.id !== S.me.worker_id));
  const mySites = isMgr() ? S.sites : S.sites.filter(s => S.assigns.some(a => a.site_id === s.id && a.worker_id === S.me.worker_id));
  const dl = 'style="width:100%;background:var(--paper);border:1px solid var(--line);border-radius:8px;padding:11px 8px;min-height:46px"';
  openSheet(`<div class="bar"><h2>Add hours by hand</h2><button class="ghost" data-close>Close</button></div>
    <p class="help">Use this when someone could not clock in on their phone. These hours are marked as added by hand.</p>
    <label class="f" for="n-w">Worker</label><select id="n-w">${names.map(w => `<option value="${esc(w.id)}">${esc(w.name)}</option>`).join("")}</select>
    <label class="f" for="n-s">Site</label><select id="n-s">${mySites.map(s => `<option value="${esc(s.id)}">${esc(s.name)}</option>`).join("")}</select>
    <div><div><label class="f" for="n-in">Clock in</label><input id="n-in" type="datetime-local" ${dl}></div><div><label class="f" for="n-out">Clock out</label><input id="n-out" type="datetime-local" ${dl}></div></div>
    <label class="f" for="n-b">Unpaid break (minutes)</label><input id="n-b" type="number" inputmode="numeric" min="0" value="0">
    <label class="f" for="n-r">Reason</label><input id="n-r" type="text" placeholder="Example: phone was dead">
    <button class="primary" id="n-save">Add hours</button>`);
  $("#n-save").onclick = async () => { if (!$("#n-in").value || !$("#n-out").value) return toast("Enter both times");
    const { error } = await sb.rpc("add_punch", { p_worker: $("#n-w").value, p_site: $("#n-s").value || null, p_in: fromLocalInput($("#n-in").value), p_out: fromLocalInput($("#n-out").value), p_break: Math.round(num($("#n-b").value)), p_reason: $("#n-r").value.trim() });
    if (error) return fail(error); closeSheet(); toast("Hours added"); refresh(); };
}
