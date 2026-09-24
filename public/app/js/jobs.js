/* ================= job board: managers post, contractors claim and bill ================= */
const JOB_TAG = { open: ["", "Open"], claimed: ["c", "Claimed"], done: ["ok", "Done"], cancelled: ["", "Cancelled"] };
const jobWhen = j => j.due_by && j.due_by !== j.on_date ? `${niceDate(j.on_date)} to ${niceDate(j.due_by)}` : niceDate(j.on_date);
const jobPrice = j => j.kind === "flat" ? `${usd(j.price)} flat` : `${usd(j.price)} per hour${j.hours_est ? `, about ${h2(j.hours_est)} h` : ""}`;
function jobRow(j, mine) {
  const t = JOB_TAG[j.status] || ["", j.status];
  return `<li><button class="rowbtn" data-job="${esc(j.id)}"><span class="main"><b>${esc(siteName(j.site_id))}</b><small>${esc(jobWhen(j))}, ${esc(jobPrice(j))}${j.description ? ". " + esc(j.description) : ""}${j.claimed_by && !mine ? `. ${esc(nameOf(j.claimed_by))}` : ""}</small></span><span class="tag ${t[0]}">${t[1]}</span></button></li>`;
}
/* Manager side, on the Schedule page. */
function jobBoardHtml() {
  const open = S.jobs.filter(j => j.status === "open"), claimed = S.jobs.filter(j => j.status === "claimed"), recent = S.jobs.filter(j => j.status === "done" && new Date(j.on_date) > Date.now() - 30 * 864e5);
  return `<h3>Job board for contractors</h3><p class="help">Post work here instead of scheduling a contractor. They choose whether to take it, do it, and bill it; the site's task list is the scope, and required proof comes back on the invoice.</p>
    ${open.length ? `<ul class="list">${open.map(j => jobRow(j)).join("")}</ul>` : `<p class="help">No open jobs.</p>`}${claimed.length ? `<ul class="list">${claimed.map(j => jobRow(j)).join("")}</ul>` : ""}${recent.length ? `<ul class="list">${recent.slice(0, 5).map(j => jobRow(j)).join("")}</ul>` : ""}
    <button class="ghost" id="jb-post">Post a job</button>`;
}
function postJobSheet() {
  const sites = S.sites.filter(s => s.active); if (!sites.length) return toast("Add a site first.");
  openSheet(`<div class="bar"><h2>Post a job</h2><button class="ghost" data-close>Close</button></div>
    <label class="f" for="jb-site">Site</label><select id="jb-site">${sites.map(s => `<option value="${esc(s.id)}">${esc(s.name)}</option>`).join("")}</select>
    <div class="grid2"><div><label class="f" for="jb-on">Can start</label><input id="jb-on" type="date" value="${todayStr()}"></div><div><label class="f" for="jb-due">Must be done by (optional)</label><input id="jb-due" type="date"></div></div>
    <label class="f" for="jb-desc">What the job is (the site's task list is attached automatically)</label><input id="jb-desc" type="text" placeholder="Example: event security for Saturday night">
    <label class="f">Pay</label><div class="seg" id="jb-kind"><button type="button" data-v="flat" aria-pressed="true">Flat price per job</button><button type="button" data-v="hourly" aria-pressed="false">Hourly</button></div>
    <div class="grid2"><div><label class="f" for="jb-price" id="jb-pricelabel">Price ($)</label><input id="jb-price" type="number" inputmode="decimal" min="0" step="0.01"></div><div id="jb-hourswrap" hidden><label class="f" for="jb-hours">Expected hours</label><input id="jb-hours" type="number" inputmode="decimal" min="0" step="0.25"></div></div>
    <p class="help">A flat price is the cleanest contractor arrangement: they earn more by working efficiently and carry the risk. Hourly is allowed but leans toward employee treatment.</p>
    <button class="primary" id="jb-save">Post</button>`);
  let kind = "flat"; $("#jb-kind").onclick = e => { const v = e.target.dataset.v; if (!v) return; kind = v; $("#jb-kind").querySelectorAll("button").forEach(b => b.setAttribute("aria-pressed", b.dataset.v === v)); $("#jb-hourswrap").hidden = v !== "hourly"; $("#jb-pricelabel").textContent = v === "flat" ? "Price ($)" : "Rate per hour ($)"; };
  $("#jb-save").onclick = async () => { const { error } = await sb.rpc("post_job", { p_site: $("#jb-site").value, p_on: $("#jb-on").value, p_due: $("#jb-due").value || null, p_desc: $("#jb-desc").value.trim(), p_kind: kind, p_price: num($("#jb-price").value), p_hours: kind === "hourly" ? (num($("#jb-hours").value) || null) : null });
    if (error) return fail(error); closeSheet(); toast("Job posted"); refresh(); };
}
function jobSheet(id) {
  const j = S.jobs.find(x => x.id === id); if (!j) return; const t = JOB_TAG[j.status], mine = j.claimed_by === S.me.worker_id, ts = tasksFor(j.site_id);
  openSheet(`<div class="bar"><h2>${esc(siteName(j.site_id))}</h2><button class="ghost" data-close>Close</button></div>
    <p class="help">${esc(jobWhen(j))}. <span class="tag ${t[0]}">${t[1]}</span>${j.claimed_by ? ` ${esc(isMgr() ? nameOf(j.claimed_by) : "You")} claimed it ${esc(niceDate(j.claimed_at.slice(0, 10)))}.` : ""}</p>
    <dl class="kv"><dt>Pay</dt><dd>${esc(jobPrice(j))}</dd>${j.description ? `<dt>Job</dt><dd style="text-align:left">${esc(j.description)}</dd>` : ""}${(S.sites.find(s => s.id === j.site_id) || {}).address ? `<dt>Address</dt><dd style="text-align:left">${esc(S.sites.find(s => s.id === j.site_id).address)}</dd>` : ""}</dl>
    ${ts.length ? `<h3>Scope of work</h3><ul class="list">${ts.map(x => `<li><div class="rowbtn" style="display:flex;padding:10px 14px;min-height:40px;align-items:center"><span class="main">${esc(x.title)}${x.proof !== "none" ? `<small>${PROOF_LABEL[x.proof]} ${x.proof_required ? "required" : "optional"}</small>` : ""}</span></div></li>`).join("")}</ul>` : ""}
    ${!isMgr() && isContractor() && j.status === "open" ? `<button class="primary" id="jb-claim">Take this job</button>` : ""}
    ${!isMgr() && mine && j.status === "claimed" ? `<button class="primary" id="jb-bill">Bill this job</button><div class="actions"><button class="ghost" id="jb-release">Give it back</button></div>` : ""}
    ${isMgr() && (j.status === "open" || j.status === "claimed") ? `<div class="actions"><button class="danger" id="jb-cancel">Cancel job</button></div>` : ""}`);
  const rpc = async (fn, msg) => { const { error } = await sb.rpc(fn, { p_id: id }); if (error) return fail(error); closeSheet(); toast(msg); refresh(); };
  const c = $("#jb-claim"); if (c) c.onclick = () => rpc("claim_job", "It's yours");
  const r = $("#jb-release"); if (r) r.onclick = () => rpc("release_job", "Released");
  const x = $("#jb-cancel"); if (x) x.onclick = () => rpc("cancel_job", "Cancelled");
  const bl = $("#jb-bill"); if (bl) bl.onclick = () => { closeSheet(); invoiceSheet(null, j); };
}
/* Contractor side, on the Invoices tab. */
function jobsForContractorHtml() {
  const open = S.jobs.filter(j => j.status === "open"), mine = S.jobs.filter(j => j.status === "claimed" && j.claimed_by === S.me.worker_id);
  return `${mine.length ? `<h3>Jobs you have taken</h3><ul class="list">${mine.map(j => jobRow(j, true)).join("")}</ul><p class="help">Do the work, then open the job and tap Bill this job.</p>` : ""}
    <h3>Open jobs</h3>${open.length ? `<ul class="list">${open.map(j => jobRow(j, true)).join("")}</ul>` : `<p class="help">Nothing posted right now.</p>`}`;
}
