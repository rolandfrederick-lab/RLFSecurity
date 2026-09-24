/* ================= schedule (managers) ================= */
const SHIFT_TAG = { scheduled: ["", "Scheduled"], done: ["ok", "Done"], missed: ["no", "Missed"], sick: ["c", "Sick"], cancelled: ["", "Cancelled"] };
const timeOf = iso => new Date(iso).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
const hhmm = t => t ? String(t).slice(0, 5) : "";
/* "9:00 AM, 3 h" or "any time 8:00 PM to 7:00 AM, 4 h" */
const shiftWhen = s => (s.kind === "fixed" ? timeOf(s.start_at) : `any time ${timeOf(s.window_open)} to ${timeOf(s.window_due)}`) + `, ${h2(s.planned_hours)} h`;
const shiftEnd = s => new Date(s.kind === "fixed" ? new Date(s.start_at).getTime() + 4 * 36e5 : s.window_due);
const myNextShift = () => S.shifts.filter(s => s.worker_id === S.me.worker_id && s.status === "scheduled" && shiftEnd(s) > new Date()).sort((a, b) => (a.start_at || a.window_open).localeCompare(b.start_at || b.window_open))[0];

function shiftRow(s, withName) {
  const t = SHIFT_TAG[s.status] || ["", s.status];
  return `<li><button class="rowbtn" data-shift="${esc(s.id)}"><span class="main"><b>${esc(withName ? nameOf(s.worker_id) : siteName(s.site_id))}</b><small>${withName ? esc(siteName(s.site_id)) + ", " : ""}${esc(shiftWhen(s))}${s.note ? ". " + esc(s.note) : ""}</small></span><span class="tag ${t[0]}">${t[1]}${s.guarantee ? "" : ", no guarantee"}</span></button></li>`;
}

function renderSchedule() {
  const v = $("#v-schedule"); S.schedOff = S.schedOff || 0;
  const t = new Date(), ws = new Date(t.getFullYear(), t.getMonth(), t.getDate() - ((t.getDay() - S.cfg.weekStart + 7) % 7) + S.schedOff * 7);
  const days = Array.from({ length: 7 }, (_, i) => ymd(new Date(ws.getFullYear(), ws.getMonth(), ws.getDate() + i)));
  const inWeek = S.shifts.filter(s => days.includes(s.on_date) && s.status !== "cancelled");
  const planned = inWeek.filter(s => s.status !== "sick").reduce((a, s) => a + Number(s.planned_hours), 0);
  let h = `${backMore}<h2>Schedule</h2><div class="actions" style="margin:0 0 12px"><button class="ghost" id="sc-prev">Previous week</button><button class="ghost" id="sc-next">Next week</button></div>
    <p class="help num">Week of ${esc(niceDate(days[0]))}. ${inWeek.length} shift${inWeek.length === 1 ? "" : "s"}, ${h2(planned)} planned hours.</p>`;
  days.forEach(d => { const ds = inWeek.filter(s => s.on_date === d).sort((a, b) => (a.start_at || a.window_open).localeCompare(b.start_at || b.window_open));
    h += `<h3 class="num">${esc(parseYmd(d).toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" }))}${d === todayStr() ? ", today" : ""}</h3>` + (ds.length ? `<ul class="list">${ds.map(s => shiftRow(s, true)).join("")}</ul>` : `<p class="help">Nothing scheduled.</p>`); });
  h += `<button class="primary" id="sc-add">Add shift</button>` + jobBoardHtml();
  v.innerHTML = h; $("#jb-post").onclick = postJobSheet;
  $("#sc-prev").onclick = () => { S.schedOff--; renderSchedule(); }; $("#sc-next").onclick = () => { S.schedOff++; renderSchedule(); };
  $("#sc-add").onclick = () => shiftSheet(days[0] >= todayStr() ? days[0] : todayStr());
}

function shiftSheet(dateStr) {
  const ws = S.workers.filter(w => !w.archived && w.type === "W-2"), sites = S.sites.filter(s => s.active);
  if (!ws.length || !sites.length) return toast("Add an employee and a site first. Contractors are not scheduled; post a job instead.");
  openSheet(`<div class="bar"><h2>Add shift</h2><button class="ghost" data-close>Close</button></div>
    <label class="f" for="sh-w">Worker</label><select id="sh-w">${ws.map(w => `<option value="${esc(w.id)}">${esc(w.name)}</option>`).join("")}</select>
    <label class="f" for="sh-s">Site</label><select id="sh-s">${sites.map(s => `<option value="${esc(s.id)}">${esc(s.name)}</option>`).join("")}</select>
    <div class="grid2"><div><label class="f" for="sh-d">Date</label><input id="sh-d" type="date" value="${esc(dateStr)}" min="${todayStr()}"></div><div><label class="f" for="sh-h">Planned hours</label><input id="sh-h" type="number" inputmode="decimal" min="0.25" max="24" step="0.25"></div></div>
    <label class="f">Timing</label><div class="seg" id="sh-kind"><button type="button" data-v="fixed" aria-pressed="true">Fixed start</button><button type="button" data-v="window" aria-pressed="false">Any time in a window</button></div>
    <div id="sh-fixed"><label class="f" for="sh-start">Start time</label><input id="sh-start" type="time"></div>
    <div id="sh-window" hidden><div class="grid2"><div><label class="f" for="sh-open">Site opens for coverage</label><input id="sh-open" type="time"></div><div><label class="f" for="sh-due">Work due by</label><input id="sh-due" type="time"></div></div><p class="help">If the due time is earlier than the open time, it means the next morning.</p></div>
    <label class="check"><input id="sh-g" type="checkbox" checked> Guaranteed pay: paid for the planned hours even if they finish early</label>
    <label class="check"><input id="sh-rt" type="checkbox"> Guarantee only when all required checklist tasks are done</label>
    <div class="grid2"><div><label class="f" for="sh-rep">Repeat weekly</label><select id="sh-rep">${[[1, "Just this once"], [2, "2 weeks"], [4, "4 weeks"], [8, "8 weeks"], [12, "12 weeks"], [26, "26 weeks"]].map(o => `<option value="${o[0]}">${o[1]}</option>`).join("")}</select></div>
    <div><label class="f" for="sh-note">Note (optional)</label><input id="sh-note" type="text" placeholder="Example: key under mat"></div></div>
    <button class="primary" id="sh-save">Add to schedule</button>`);
  let kind = "fixed";
  const setKind = k => { kind = k; $("#sh-kind").querySelectorAll("button").forEach(b => b.setAttribute("aria-pressed", b.dataset.v === k)); $("#sh-fixed").hidden = k !== "fixed"; $("#sh-window").hidden = k !== "window"; };
  const fill = () => { const s = S.sites.find(x => x.id === $("#sh-s").value) || {}; setKind(s.sched_type || "fixed");
    $("#sh-h").value = Number(s.default_hours) || ""; $("#sh-start").value = hhmm(s.default_start); $("#sh-open").value = hhmm(s.window_open); $("#sh-due").value = hhmm(s.window_due);
    $("#sh-g").checked = s.guarantee !== false; $("#sh-rt").checked = !!s.requires_tasks; };
  fill(); $("#sh-s").onchange = fill;
  $("#sh-kind").onclick = e => { if (e.target.dataset.v) setKind(e.target.dataset.v); };
  $("#sh-save").onclick = async () => { const b = $("#sh-save"); b.disabled = true;
    const { error } = await sb.rpc("schedule_shift", { p_worker: $("#sh-w").value, p_site: $("#sh-s").value, p_on: $("#sh-d").value, p_kind: kind, p_start: kind === "fixed" ? $("#sh-start").value || null : null,
      p_open: kind === "window" ? $("#sh-open").value || null : null, p_due: kind === "window" ? $("#sh-due").value || null : null, p_planned: num($("#sh-h").value), p_guarantee: $("#sh-g").checked, p_requires_tasks: $("#sh-rt").checked,
      p_repeat_weeks: Number($("#sh-rep").value), p_note: $("#sh-note").value.trim() });
    b.disabled = false; if (error) return fail(error); closeSheet(); toast("Shift added"); refresh(); };
}

function shiftDetail(id) {
  const s = S.shifts.find(x => x.id === id); if (!s) return; const t = SHIFT_TAG[s.status] || ["", s.status], p = s.punch_id ? S.punches.find(x => x.id === s.punch_id) : null;
  openSheet(`<div class="bar"><h2>${esc(nameOf(s.worker_id))}</h2><button class="ghost" data-close>Close</button></div>
    <p class="help">${esc(siteName(s.site_id))}, ${esc(niceDate(s.on_date))}. <span class="tag ${t[0]}">${t[1]}</span></p>
    <dl class="kv num"><dt>Timing</dt><dd>${esc(shiftWhen(s))}</dd><dt>Guaranteed pay</dt><dd>${s.guarantee ? (s.requires_tasks ? "Yes, when required tasks are done" : "Yes") : "No, actual time"}</dd>
    ${p ? `<dt>Worked</dt><dd>${p.clock_out ? h2(punchHours(p)) + " h" : "On the clock"}</dd><dt>Paid</dt><dd>${p.paid_hours != null ? h2(p.paid_hours) + " h" : ""}</dd>` : ""}${s.note ? `<dt>Note</dt><dd>${esc(s.note)}</dd>` : ""}</dl>
    ${isMgr() && s.status === "scheduled" ? `<div class="actions"><button class="danger" id="sd-one">Cancel this shift</button>${s.series_id ? `<button class="danger" id="sd-all">Cancel this and later repeats</button>` : ""}</div>` : ""}`);
  const go = async series => { const { error } = await sb.rpc("cancel_shift", { p_id: id, p_series: series }); if (error) return fail(error); closeSheet(); toast("Cancelled"); refresh(); };
  const a = $("#sd-one"); if (a) a.onclick = () => go(false); const b = $("#sd-all"); if (b) b.onclick = () => go(true);
}
