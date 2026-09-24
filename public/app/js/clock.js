/* ================= clock ================= */
let tick;
function getSpot() {
  return new Promise(res => { if (!navigator.geolocation) return res(null);
    navigator.geolocation.getCurrentPosition(p => res({ lat: p.coords.latitude, lng: p.coords.longitude, acc: p.coords.accuracy }), () => res(null), { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }); });
}
const myOpen = () => S.punches.find(p => p.worker_id === S.me.worker_id && p.status === "open");
const elapsed = iso => { const m = Math.max(0, Math.floor((Date.now() - new Date(iso)) / 60000)); return `${Math.floor(m / 60)}:${pad(m % 60)}`; };
function renderClock() {
  clearInterval(tick); const v = $("#v-clock"), back = isMgr() ? `<button class="back" data-tab="more">Back to More</button>` : "";
  if (!S.me.worker_id) { v.innerHTML = `${back}<h2>Time clock</h2><p class="empty">Your login is not linked to a worker record yet. Ask a manager to link it under People.</p>`; return; }
  const open = myOpen(), mySites = S.sites.filter(s => s.active && S.assigns.some(a => a.site_id === s.id && a.worker_id === S.me.worker_id)), nxt = myNextShift();
  const linked = open && open.shift_id ? S.shifts.find(s => s.id === open.shift_id) : null;
  let h = `${back}<h2>Time clock</h2>`;
  if (!open && nxt) h += `<div class="note num"><b>Next shift:</b> ${esc(siteName(nxt.site_id))}, ${esc(nxt.on_date === todayStr() ? "today" : niceDay(nxt.start_at || nxt.window_open))}, ${esc(shiftWhen(nxt))}.${nxt.guarantee ? " Paid for the planned hours even if you finish early." : ""}${nxt.note ? " " + esc(nxt.note) : ""}</div>`;
  if (open) h += `<div class="clockcard"><p class="state">On the clock since ${esc(niceTime(open.clock_in))}</p><p class="big num" id="c-el">${elapsed(open.clock_in)}</p><p class="where">${esc(siteName(open.site_id))}</p>
    ${linked ? `<p class="help num" style="margin:0 0 12px">Planned ${h2(linked.planned_hours)} h${linked.kind === "window" ? `, due by ${esc(timeOf(linked.window_due))}` : ""}${linked.guarantee ? ". You are paid for the planned hours even if you finish early." : ""}</p>` : ""}<button class="punch out" id="c-out">Clock out</button></div>`;
  else if (!mySites.length) h += `<p class="empty">You are not assigned to a site yet. Ask a manager to add you to one.</p>`;
  else { const capped = S.week.mode === "block" && S.week.hours >= S.week.cap;
    h += `<div class="clockcard"><p class="state">You are off the clock</p><label class="f" for="c-site" style="text-align:left">Site</label><select id="c-site">${mySites.map(s => `<option value="${esc(s.id)}" ${nxt && nxt.site_id === s.id ? "selected" : ""}>${esc(s.name)}</option>`).join("")}</select><div style="height:14px"></div><button class="punch" id="c-in" ${capped ? "disabled" : ""}>${capped ? "Weekly cap reached" : "Clock in"}</button>${capped ? `<p class="help" style="margin:10px 0 0">Ask a manager if you need to work more this week.</p>` : ""}</div>`; }
  const prog = open ? taskProgress(open) : null;
  if (open && prog) { const d = doneSet(open.id), got = t => S.taskChecks.find(c => c.punch_id === open.id && c.task_id === t.id && c.proof_path);
    h += `<h3>Checklist for ${esc(siteName(open.site_id))}, ${prog.done} of ${prog.total} done</h3><div class="panel checks">${tasksFor(open.site_id).map(t => {
      const need = t.proof !== "none", lock = t.proof_required && !got(t);
      return `<div style="margin:6px 0"><label class="check" style="margin:0"><input type="checkbox" data-task="${esc(t.id)}" ${d.has(t.id) ? "checked" : ""} ${lock ? "disabled" : ""}> ${esc(t.title)}</label>
        ${need ? `<div style="display:flex;gap:8px;align-items:center;margin:4px 0 6px 32px;flex-wrap:wrap"><span class="tag ${got(t) ? "ok" : t.proof_required ? "c" : ""}">${got(t) ? (got(t).proof_type === "video" ? "Video added" : "Photo added") : PROOF_LABEL[t.proof] + (t.proof_required ? " required" : " optional")}</span>
        ${t.proof !== "video" ? `<label class="linkbtn" style="padding:6px 0">${got(t) ? "Retake photo" : "Add photo"}<input type="file" accept="image/*" capture="environment" data-proof="${esc(t.id)}" data-kind="photo" hidden></label>` : ""}
        ${t.proof !== "photo" ? `<label class="linkbtn" style="padding:6px 0">${got(t) ? "Retake video" : "Add video"}<input type="file" accept="video/*" capture="environment" data-proof="${esc(t.id)}" data-kind="video" hidden></label>` : ""}</div>` : ""}</div>`; }).join("")}</div>`; }
  if (mySites.length || open) h += `<div class="panel">${meterHtml(S.week.hours, S.week.cap)}</div>`;
  h += `<p class="help">Your location is checked once when you clock in and once when you clock out. It is not tracked in between.</p>`;
  const today = S.punches.filter(p => p.worker_id === S.me.worker_id && ymd(new Date(p.clock_in)) === todayStr());
  if (today.length) h += `<h3>Today</h3><ul class="list">${today.map(p => punchRow(p, false)).join("")}</ul>`;
  v.innerHTML = h;
  if (open) tick = setInterval(() => { const e = $("#c-el"); if (e) e.textContent = elapsed(open.clock_in); }, 20000);
  const bi = $("#c-in"), bo = $("#c-out");
  if (bi) bi.onclick = async () => { bi.disabled = true; bi.textContent = "Checking location"; const s = await getSpot();
    const { error } = await sb.rpc("clock_in", { p_site: $("#c-site").value, p_lat: s ? s.lat : null, p_lng: s ? s.lng : null, p_accuracy: s ? s.acc : null });
    if (error) { fail(error); bi.disabled = false; bi.textContent = "Clock in"; return; } toast("Clocked in"); refresh(); };
  document.querySelectorAll("[data-proof]").forEach(inp => inp.onchange = async () => { const f = inp.files && inp.files[0]; if (!f) return; toast("Uploading");
    try { const path = await uploadShiftFile(open.id, f, inp.dataset.kind, inp.dataset.proof);
      const { error } = await sb.rpc("set_task_done", { p_punch: open.id, p_task: inp.dataset.proof, p_done: true, p_proof_path: path, p_proof_type: inp.dataset.kind }); if (error) throw error;
      toast("Saved"); await loadData(); render(); } catch (e) { fail(e); } });
  document.querySelectorAll("[data-task]").forEach(cb => cb.onchange = async () => { cb.disabled = true;
    const { error } = await sb.rpc("set_task_done", { p_punch: open.id, p_task: cb.dataset.task, p_done: cb.checked }); if (error) { cb.checked = !cb.checked; fail(error); }
    cb.disabled = false; await loadData(); render(); });
  if (bo) bo.onclick = async () => {
    const left = taskProgress(open); if (left && left.missing.length && bo.dataset.ok !== "1") { bo.dataset.ok = "1"; bo.textContent = `${left.missing.length} task${left.missing.length === 1 ? "" : "s"} not done. Tap again to clock out`; return; }
    bo.disabled = true; bo.textContent = "Checking location"; const s = await getSpot();
    const { error } = await sb.rpc("clock_out", { p_lat: s ? s.lat : null, p_lng: s ? s.lng : null, p_accuracy: s ? s.acc : null });
    if (error) { fail(error); bo.disabled = false; bo.textContent = "Clock out"; return; } toast("Clocked out"); refresh(); };
}
function punchTags(p) {
  const t = [];
  if (p.status === "open") t.push(`<span class="tag open">On the clock</span>`);
  if (p.status === "submitted") t.push(`<span class="tag c">Needs review</span>`);
  if (p.status === "approved") t.push(`<span class="tag ok">${p.paycheck_id ? "Paid" : "Approved"}</span>`);
  if (p.status === "rejected") t.push(`<span class="tag no">Rejected</span>`);
  if (p.in_flagged || p.out_flagged) t.push(`<span class="tag flag">Off site</span>`);
  if (p.manual) t.push(`<span class="tag">By hand</span>`);
  const pr = taskProgress(p); if (pr && !p.manual) t.push(`<span class="tag ${pr.done === pr.total ? "ok" : "c"}">${pr.done}/${pr.total} tasks</span>`);
  if (p.paid_hours != null && Number(p.paid_hours) > punchHours(p) + 0.005) t.push(`<span class="tag ok">Paid ${h2(p.paid_hours)} h</span>`);
  if (p.started_late) t.push(`<span class="tag c">Started late</span>`);
  if (p.finished_late) t.push(`<span class="tag c">After deadline</span>`);
  return t.join(" ");
}
function punchRow(p, withName) {
  const when = `${niceDay(p.clock_in)}, ${niceTime(p.clock_in)} to ${p.clock_out ? niceTime(p.clock_out) : "now"}`;
  const inner = `<span class="main"><b>${esc(withName ? nameOf(p.worker_id) : siteName(p.site_id))}</b><small>${esc(when)}${withName ? ", " + esc(siteName(p.site_id)) : ""}</small><small style="display:block;margin-top:4px">${punchTags(p)}</small></span><span class="num"><b>${p.clock_out ? h2(punchHours(p)) + " h" : ""}</b></span>`;
  return withName ? `<li><button class="rowbtn" data-punch="${esc(p.id)}">${inner}</button></li>` : `<li><div class="rowbtn" style="display:flex;padding:13px 14px;gap:12px;align-items:center">${inner}</div></li>`;
}
function renderHours() {
  const v = $("#v-hours"), back = isMgr() ? `<button class="back" data-tab="more">Back to More</button>` : "";
  const mine = S.punches.filter(p => p.worker_id === S.me.worker_id);
  if (!mine.length) { v.innerHTML = `${back}<h2>My hours</h2><p class="empty">No shifts in the last 60 days. Shifts show up here after you clock in.</p>`; return; }
  const weeks = {}; mine.forEach(p => (weeks[weekKey(p.clock_in, S.cfg.weekStart)] ||= []).push(p));
  v.innerHTML = `${back}<h2>My hours</h2>` + Object.keys(weeks).sort().reverse().map(k => { const ps = weeks[k], tot = ps.filter(p => p.status !== "rejected").reduce((a, p) => a + punchHours(p), 0);
    return `<h3 class="num">Week of ${esc(niceDate(k))}, ${h2(tot)} hours</h3><ul class="list">${ps.map(p => punchRow(p, false)).join("")}</ul>`; }).join("") +
    `<p class="help">If a shift looks wrong, tell your supervisor. They can correct it, and every correction is logged.</p>`;
}
function renderMyPay() {
  const v = $("#v-mypay"), mine = S.checks.filter(c => c.worker_id === S.me.worker_id);
  v.innerHTML = `<h2>My pay</h2>` + (mine.length ? `<ul class="list">${mine.map(checkRow).join("")}</ul>` : `<p class="empty">No paychecks in ${S.year} yet.</p>`);
}
