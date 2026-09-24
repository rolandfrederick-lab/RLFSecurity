/* ================= contractor invoices ================= */
const INV_TAG = { pending: ["c", "Waiting"], approved: ["ok", "Approved"], rejected: ["no", "Rejected"], paid: ["ok", "Paid"] };
const myWorker = () => S.workers.find(w => w.id === S.me.worker_id) || {};
const isContractor = () => myWorker().type === "1099";
const invTotal = (hours, rate, extras) => Math.round((num(hours) * num(rate) + (extras || []).reduce((a, e) => a + num(e.amount), 0)) * 100) / 100;

function invoiceRow(i, withName) {
  const t = INV_TAG[i.status] || ["", i.status], off = Number(i.hours) > 0 && Number(i.rate) !== Number(i.agreed_rate);
  const ts = tasksFor(i.site_id).length, dn = ts ? S.invoiceChecks.filter(c => c.invoice_id === i.id).length : 0;
  return `<li><button class="rowbtn" data-inv="${esc(i.id)}"><span class="main"><b>${esc(withName ? nameOf(i.worker_id) : siteName(i.site_id))}</b><small>${withName ? esc(siteName(i.site_id)) + ", " : ""}${esc(niceDate(i.on_date))}${Number(i.hours) ? `, ${h2(i.hours)} h at ${usd(i.rate)}` : ""}${(i.extras || []).length ? `, ${i.extras.length} extra` : ""}</small><small style="display:block;margin-top:4px"><span class="tag ${t[0]}">${t[1]}</span>${off ? ` <span class="tag no">Rate differs</span>` : ""}${ts ? ` <span class="tag ${dn === ts ? "ok" : "c"}">${dn}/${ts} done</span>` : ""}${i.photo_path ? ` <span class="tag">Photo</span>` : ""}</small></span><span class="num"><b>${usd(i.total)}</b></span></button></li>`;
}

function renderInvoices() {
  const v = $("#v-invoices"), w = myWorker(), mine = S.invoices.filter(i => i.worker_id === w.id);
  const unpaid = mine.filter(i => i.status === "approved").reduce((a, i) => a + Number(i.total), 0), waiting = mine.filter(i => i.status === "pending").reduce((a, i) => a + Number(i.total), 0);
  v.innerHTML = `<h2>Invoices</h2>
    <div class="panel"><div class="stat num"><div><b>${usd(waiting)}</b><small>waiting for approval</small></div><div><b>${usd(unpaid)}</b><small>approved, not yet paid</small></div><div><b>${usd(w.rate)}</b><small>your agreed rate per hour</small></div></div>
    <p class="help" style="margin:10px 0 0">You are paid as a contractor. Bill each visit here instead of clocking in. No tax is withheld; you receive a 1099-NEC in January for the year's total.</p></div>
    ${jobsForContractorHtml()}
    <button class="primary" id="iv-add" style="margin-top:14px">Bill a visit not on the job board</button>
    <h3>My invoices</h3>${mine.length ? `<ul class="list">${mine.map(i => invoiceRow(i, false)).join("")}</ul>` : `<p class="help">Nothing billed yet.</p>`}`;
  $("#iv-add").onclick = () => invoiceSheet(null);
}

function invoiceSheet(id, job) {
  const i = id ? S.invoices.find(x => x.id === id) : null, w = myWorker(), own = !i || i.worker_id === S.me.worker_id, review = i && !own && isMgr();
  const sites = job ? S.sites.filter(s => s.id === job.site_id) : S.sites.filter(s => s.active && S.assigns.some(a => a.site_id === s.id && a.worker_id === (i ? i.worker_id : w.id)));
  const jobRate = job && job.kind === "hourly" ? Number(job.price) : Number(w.rate);
  const t = i ? INV_TAG[i.status] : null, extras = i ? (i.extras || []) : [];
  if (i && (review || i.status !== "pending")) {
    openSheet(`<div class="bar"><h2>${esc(own ? "Invoice" : nameOf(i.worker_id))}</h2><button class="ghost" data-close>Close</button></div>
      <p class="help">${esc(siteName(i.site_id))}, ${esc(niceDate(i.on_date))}. <span class="tag ${t[0]}">${t[1]}</span></p>
      <div class="slip num">${Number(i.hours) ? `<div class="row"><span>${h2(i.hours)} h on site at ${usd(i.rate)}</span><span>${usd(num(i.hours) * num(i.rate))}</span></div>` : ""}${extras.map(e => `<div class="row"><span>${esc(e.desc)}</span><span>${usd(e.amount)}</span></div>`).join("")}<div class="net"><span>Total</span><b>${usd(i.total)}</b></div></div>
      ${Number(i.hours) > 0 && Number(i.rate) !== Number(i.agreed_rate) ? `<p class="note" style="color:var(--danger)">The invoice rate ${usd(i.rate)} differs from the agreed ${usd(i.agreed_rate)} per hour. At the agreed rate this visit would be ${usd(invTotal(i.hours, i.agreed_rate, extras))}.</p>` : ""}
      ${(() => { const ts = tasksFor(i.site_id); if (!ts.length) return ""; const done = S.invoiceChecks.filter(c => c.invoice_id === i.id); return `<h3>Work completed, ${done.length} of ${ts.length}</h3><ul class="list">${ts.map(t => { const c = done.find(x => x.task_id === t.id); return `<li><div class="rowbtn" style="display:flex;padding:10px 14px;gap:12px;align-items:center;min-height:44px;flex-wrap:wrap"><span class="main"><b style="font-weight:${c ? 400 : 600}">${esc(t.title)}</b>${t.proof !== "none" ? `<small>${PROOF_LABEL[t.proof]} ${t.proof_required ? "required" : "optional"}</small>` : ""}</span>${c && c.proof_path ? `<button type="button" class="ghost" data-view="${esc(c.proof_path)}" data-vtype="${esc(c.proof_type)}" style="min-height:36px;padding:6px 10px">View ${c.proof_type}</button>` : ""}<span class="tag ${c ? "ok" : "no"}">${c ? "Done" : "Not done"}</span><div id="pv-${esc(t.id)}" style="flex-basis:100%"></div></div></li>`; }).join("")}</ul>`; })()}
      ${i.note ? `<p class="help">${esc(i.note)}</p>` : ""}${i.decision_note ? `<p class="note">${esc(i.decision_note)}</p>` : ""}
      ${i.photo_path ? `<div class="actions"><button class="ghost" id="iv-view">View photo</button></div><div id="iv-preview"></div>` : ""}
      ${review && i.status === "pending" ? `<button class="primary" id="iv-ok">Approve ${usd(i.total)}</button><label class="f" for="iv-why">Or reject with a reason</label><input id="iv-why" type="text"><div class="actions"><button class="danger" id="iv-no">Reject</button></div>` : ""}`);
    document.querySelectorAll("#sheet [data-view]").forEach(b => b.onclick = async () => { b.disabled = true; try { const u = await proofUrl(b.dataset.view); const box = b.parentElement.querySelector("[id^=pv-]");
      box.innerHTML = b.dataset.vtype === "video" ? `<video src="${esc(u)}" controls playsinline style="width:100%;border-radius:8px;margin-top:8px"></video>` : `<a href="${esc(u)}" target="_blank" rel="noopener"><img src="${esc(u)}" alt="Proof" style="width:100%;border-radius:8px;margin-top:8px"></a>`; b.hidden = true; } catch (e) { fail(e); b.disabled = false; } });
    const pv = $("#iv-view"); if (pv) pv.onclick = async () => { try { const u = await proofUrl(i.photo_path); $("#iv-preview").innerHTML = /\.pdf$/i.test(i.photo_path) ? `<a href="${esc(u)}" target="_blank" rel="noopener" class="linkbtn">Open</a>` : `<a href="${esc(u)}" target="_blank" rel="noopener"><img src="${esc(u)}" style="width:100%;border-radius:8px;margin-top:8px"></a>`; pv.hidden = true; } catch (e) { fail(e); } };
    const ok = $("#iv-ok"); if (ok) ok.onclick = async () => { const { error } = await sb.rpc("decide_invoice", { p_id: id, p_status: "approved", p_note: "" }); if (error) return fail(error); closeSheet(); toast("Approved"); refresh(); };
    const no = $("#iv-no"); if (no) no.onclick = async () => { const { error } = await sb.rpc("decide_invoice", { p_id: id, p_status: "rejected", p_note: $("#iv-why").value.trim() }); if (error) return fail(error); closeSheet(); toast("Rejected"); refresh(); };
    return;
  }
  // own: new, or pending (withdraw)
  openSheet(`<div class="bar"><h2>${i ? "Invoice" : job ? "Bill this job" : "Bill a visit"}</h2><button class="ghost" data-close>Close</button></div>
    ${job ? `<p class="note">${esc(siteName(job.site_id))}, ${esc(jobPrice(job))}.${job.kind === "flat" ? " The flat price is filled in below; add extras only for materials you agreed on." : ""}</p>` : ""}
    ${i ? `<p class="help">Waiting for approval. You can withdraw it and submit a corrected one.</p><div class="actions"><button class="danger" id="iv-cancel">Withdraw invoice</button></div>` : `
    <label class="f" for="iv-site">Site</label><select id="iv-site"><option value="">Other</option>${sites.map(s => `<option value="${esc(s.id)}">${esc(s.name)}</option>`).join("")}</select>
    <div class="grid2"><div><label class="f" for="iv-date">Date of visit</label><input id="iv-date" type="date" value="${todayStr()}" max="${todayStr()}"></div><div><label class="f" for="iv-hours">Hours on site</label><input id="iv-hours" type="number" inputmode="decimal" min="0" max="24" step="0.25" placeholder="0"></div></div>
    <label class="f" for="iv-rate">Rate per hour (agreed: ${usd(jobRate)})</label><input id="iv-rate" type="number" inputmode="decimal" min="0" step="0.01" value="${esc(job && job.kind === "flat" ? 0 : jobRate)}"><p class="help" id="iv-ratewarn"></p>
    <div id="iv-work"></div>
    <h3>Extras (supplies, materials, anything beyond time)</h3><div id="iv-extras"></div><button type="button" class="ghost" id="iv-addline">Add a line</button>
    <label class="f" for="iv-note">Note</label><input id="iv-note" type="text" placeholder="Example: extra overnight coverage">
    <label class="f">Photo of your paper invoice or receipts (optional)</label><label class="linkbtn" style="padding:6px 0">Take a photo<input type="file" accept="image/*,application/pdf" capture="environment" id="iv-photo" hidden></label><span class="help" id="iv-photoname"></span>
    <div class="slip num" style="margin-top:14px"><div class="net"><span>Total</span><b id="iv-total">${usd(0)}</b></div></div>
    <button class="primary" id="iv-send">Send invoice</button>`}`);
  const cx = $("#iv-cancel"); if (cx) { cx.onclick = async () => { const { error } = await sb.rpc("cancel_invoice", { p_id: id }); if (error) return fail(error); closeSheet(); toast("Withdrawn"); refresh(); }; return; }
  /* Work completed: the site's task list with proof, uploaded as the contractor goes. */
  const checks = {};   // task_id -> { done, proof_path, proof_type }
  const drawWork = () => { const sid = $("#iv-site").value, ts = tasksFor(sid), box = $("#iv-work"); if (!ts.length) { box.innerHTML = ""; return; }
    box.innerHTML = `<h3>Work completed</h3><p class="help">Tick what you did. Items marked required need a photo or video before the invoice can be sent.</p><div class="panel checks">${ts.map(t => { const c = checks[t.id] || {}, need = t.proof !== "none";
      return `<div style="margin:6px 0"><label class="check" style="margin:0"><input type="checkbox" data-wt="${esc(t.id)}" ${c.done ? "checked" : ""}> ${esc(t.title)}</label>
        ${need ? `<div style="display:flex;gap:8px;align-items:center;margin:4px 0 6px 32px;flex-wrap:wrap"><span class="tag ${c.proof_path ? "ok" : t.proof_required ? "c" : ""}">${c.proof_path ? (c.proof_type === "video" ? "Video added" : "Photo added") : PROOF_LABEL[t.proof] + (t.proof_required ? " required" : " optional")}</span>
        ${t.proof !== "video" ? `<label class="linkbtn" style="padding:6px 0">${c.proof_path ? "Retake photo" : "Add photo"}<input type="file" accept="image/*" capture="environment" data-wp="${esc(t.id)}" data-kind="photo" hidden></label>` : ""}
        ${t.proof !== "photo" ? `<label class="linkbtn" style="padding:6px 0">${c.proof_path ? "Retake video" : "Add video"}<input type="file" accept="video/*" capture="environment" data-wp="${esc(t.id)}" data-kind="video" hidden></label>` : ""}</div>` : ""}</div>`; }).join("")}</div>`;
    box.querySelectorAll("[data-wt]").forEach(cb => cb.onchange = () => { (checks[cb.dataset.wt] ||= {}).done = cb.checked; });
    box.querySelectorAll("[data-wp]").forEach(inp => inp.onchange = async () => { const f = inp.files && inp.files[0]; if (!f) return; if (f.size > 60 * 1048576) return toast("That file is over 60 MB."); toast("Uploading");
      try { const ext = (f.name.split(".").pop() || "jpg").toLowerCase(), path = `invoices/${w.id}/${Date.now()}-${inp.dataset.wp}.${ext}`; const up = await sb.storage.from("proof").upload(path, f, { contentType: f.type || undefined }); if (up.error) throw up.error;
        checks[inp.dataset.wp] = { done: true, proof_path: path, proof_type: inp.dataset.kind }; toast("Added"); drawWork(); } catch (e) { fail(e); } }); };
  if (job) { $("#iv-site").value = job.site_id; $("#iv-site").disabled = true; }
  drawWork(); $("#iv-site").onchange = drawWork;
  const lines = job && job.kind === "flat" ? [{ desc: `Job: ${job.description || siteName(job.site_id)}`, amount: Number(job.price) }] : [], box = $("#iv-extras"), redraw = () => { box.innerHTML = lines.map((l, k) => `<div class="grid2" style="align-items:end"><div><label class="f">What</label><input type="text" data-ld="${k}" value="${esc(l.desc)}"></div><div><label class="f">Amount ($)</label><input type="number" inputmode="decimal" min="0" step="0.01" data-la="${k}" value="${esc(l.amount)}"></div></div>`).join("");
    box.querySelectorAll("[data-ld]").forEach(e => e.oninput = () => { lines[e.dataset.ld].desc = e.value; }); box.querySelectorAll("[data-la]").forEach(e => e.oninput = () => { lines[e.dataset.la].amount = e.value; tot(); }); tot(); };
  const tot = () => { $("#iv-total").textContent = usd(invTotal($("#iv-hours").value, $("#iv-rate").value, lines)); const r = num($("#iv-rate").value); $("#iv-ratewarn").textContent = (job && job.kind === "flat") ? (r ? "This is a flat-price job. Leave the hourly rate at 0." : "") : r !== jobRate ? `That is not the agreed rate of ${usd(jobRate)}. The office will see the difference.` : ""; };
  $("#iv-addline").onclick = () => { lines.push({ desc: "", amount: "" }); redraw(); }; $("#iv-hours").oninput = tot; $("#iv-rate").oninput = tot; if (lines.length) redraw(); tot();

  let file = null; $("#iv-photo").onchange = () => { file = $("#iv-photo").files[0]; $("#iv-photoname").textContent = file ? file.name : ""; };
  $("#iv-send").onclick = async () => { const b = $("#iv-send"); b.disabled = true; try { let photo = null;
      if (file) { if (file.size > 20 * 1048576) throw new Error("That file is over 20 MB."); const ext = (file.name.split(".").pop() || "jpg").toLowerCase(); photo = `invoices/${w.id}/${Date.now()}.${ext}`; const up = await sb.storage.from("proof").upload(photo, file, { contentType: file.type || undefined }); if (up.error) throw up.error; }
      const p_checks = Object.entries(checks).filter(([, c]) => c.done || c.proof_path).map(([task_id, c]) => ({ task_id, proof_path: c.proof_path || "", proof_type: c.proof_type || "" }));
      const { error } = await sb.rpc("submit_invoice", { p_site: $("#iv-site").value || null, p_on: $("#iv-date").value, p_hours: num($("#iv-hours").value), p_rate: num($("#iv-rate").value), p_extras: lines.filter(l => l.desc || num(l.amount)).map(l => ({ desc: l.desc, amount: num(l.amount) })), p_note: $("#iv-note").value.trim(), p_photo: photo, p_checks, p_job: job ? job.id : null });
      if (error) throw error; closeSheet(); toast("Invoice sent"); refresh(); } catch (e) { fail(e); } b.disabled = false; };
}
