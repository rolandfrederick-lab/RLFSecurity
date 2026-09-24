/* ================= pay run ================= */
const priorYTD = wid => S.checks.filter(c => c.worker_id === wid).reduce((a, c) => a + Number(c.gross), 0);
function defaultPeriod() {
  const len = S.cfg.payPeriods === 52 ? 7 : S.cfg.payPeriods === 26 ? 14 : 0; if (!len) return;
  const t = new Date(), back = ((t.getDay() - S.cfg.weekStart + 7) % 7) + 1, end = new Date(t.getFullYear(), t.getMonth(), t.getDate() - back);
  $("#r-end").value = ymd(end); $("#r-start").value = ymd(new Date(end.getFullYear(), end.getMonth(), end.getDate() - len + 1));
}
function renderRun() {
  const sel = $("#r-worker"), cur = sel.value, act = S.workers.filter(w => !w.archived);
  sel.innerHTML = `<option value="">Choose a worker</option>` + act.map(w => `<option value="${esc(w.id)}">${esc(w.name)} (${esc(w.type)})</option>`).join("");
  if (act.some(w => w.id === cur)) sel.value = cur;
  if (!$("#r-date").value) $("#r-date").value = todayStr();
  if (!$("#r-end").value && !$("#r-start").value) defaultPeriod();
  const cw = act.find(w => w.id === sel.value); $("#r-hourly").hidden = !!(cw && cw.type === "1099");
  $("#r-cpanel").innerHTML = cw && cw.type === "1099" ? contractorPanel(cw) : "";
  document.querySelectorAll("[data-inv-ok]").forEach(b => b.onclick = async () => { b.disabled = true; const { error } = await sb.rpc("decide_invoice", { p_id: b.dataset.invOk, p_status: "approved", p_note: "" }); if (error) { b.disabled = false; return fail(error); } toast("Approved"); await loadData(); renderRun(); pullHours(); });
  $("#r-none").hidden = act.length > 0; $("#r-form").hidden = act.length === 0;
  previewRun();
}
/* Every unpaid invoice for the contractor, with one-tap approval, so nothing is left out of the payment by accident. */
function contractorPanel(w) {
  const pend = S.invoices.filter(i => i.worker_id === w.id && i.status === "pending"), ok = S.invoices.filter(i => i.worker_id === w.id && i.status === "approved" && !i.paycheck_id);
  const row = i => `<li><div class="rowbtn" style="display:flex;padding:10px 14px;gap:10px;align-items:center;flex-wrap:wrap"><span class="main"><b>${esc(siteName(i.site_id))}</b><small>${esc(niceDate(i.on_date))}${Number(i.hours) ? `, ${h2(i.hours)} h at ${usd(i.rate)}` : ""}${(i.extras || []).length ? `, ${i.extras.length} extra` : ""}${i.job_id ? ", job board" : ""}</small></span><span class="num"><b>${usd(i.total)}</b></span>${i.status === "pending" ? `<button type="button" class="ghost" data-inv-ok="${esc(i.id)}" style="min-height:36px;padding:6px 10px">Approve</button><button type="button" class="ghost" data-inv="${esc(i.id)}" style="min-height:36px;padding:6px 10px">Open</button>` : `<span class="tag ok">Approved</span>`}</div></li>`;
  return `<div class="panel"><p class="help" style="margin-top:0"><b>Contractor.</b> Payments come from approved invoices. No tax is withheld; a payment statement is produced when you save.</p>
    ${pend.length ? `<h3 style="margin-top:6px">Waiting for your approval</h3><ul class="list">${pend.map(row).join("")}</ul>` : ""}
    ${ok.length ? `<h3 style="margin-top:6px">Approved, not yet paid</h3><ul class="list">${ok.map(row).join("")}</ul><p class="help num">Total ${usd(ok.reduce((a, i) => a + Number(i.total), 0))}. The work period below covers all of them.</p>` : `<p class="help">No approved invoices waiting to be paid.</p>`}</div>`;
}
async function pullHours() {
  { const w0 = S.workers.find(x => x.id === $("#r-worker").value); if (w0 && w0.type === "1099") { const ok = S.invoices.filter(i => i.worker_id === w0.id && i.status === "approved" && !i.paycheck_id);
      if (ok.length) { const ds = ok.map(i => i.on_date).sort(); if (!$("#r-start").value || $("#r-start").value > ds[0]) $("#r-start").value = ds[0]; if (!$("#r-end").value || $("#r-end").value < ds[ds.length - 1]) $("#r-end").value = ds[ds.length - 1]; } } }
  const wid = $("#r-worker").value, a = $("#r-start").value, b = $("#r-end").value, box = $("#r-pull"); S.run = { ids: [], pending: 0, sickIds: [] };
  if (!wid || !a || !b || a > b) { box.innerHTML = ""; return previewRun(); }
  const end = parseYmd(b); end.setDate(end.getDate() + 1);
  let ps, sk, iv; try { [ps, sk, iv] = await Promise.all([q(sb.from("punches").select("*").eq("worker_id", wid).gte("clock_in", parseYmd(a).toISOString()).lt("clock_in", end.toISOString())),
    q(sb.from("sick_requests").select("*").eq("worker_id", wid).eq("status", "approved").is("paycheck_id", null).gte("on_date", a).lte("on_date", b)),
    q(sb.from("invoices").select("*").eq("worker_id", wid).eq("status", "approved").is("paycheck_id", null).gte("on_date", a).lte("on_date", b))]); } catch (e) { return fail(e); }
  if (wid !== $("#r-worker").value) return;
  const ok = ps.filter(p => p.status === "approved" && !p.paycheck_id), waiting = ps.filter(p => p.status === "open" || p.status === "submitted").length, paid = ps.filter(p => p.paycheck_id).length;
  const w = S.workers.find(x => x.id === wid), hrs = splitHours(ok, S.cfg.weekStart, w.type === "W-2");
  const sickH = Math.round(sk.reduce((t, r) => t + Number(r.hours), 0) * 100) / 100, guarH = Math.round(ok.reduce((t, p) => t + Math.max(0, Number(p.paid_hours || 0) - punchHours(p)), 0) * 100) / 100;
  const byCity = {}; let tot = 0; ok.forEach(p => { const c = (S.sites.find(s => s.id === p.site_id) || {}).city || "none", h = Number(p.paid_hours) || punchHours(p); byCity[c] = (byCity[c] || 0) + h; tot += h; });
  const cityShares = {}; if (tot > 0) Object.keys(byCity).forEach(c => cityShares[c] = byCity[c] / tot);
  S.run = { ids: ok.map(p => p.id), pending: waiting, sickIds: sk.map(r => r.id), cityShares, invoiceIds: iv.map(i => i.id) };
  const invTot = Math.round(iv.reduce((t, i) => t + Number(i.total), 0) * 100) / 100, invWait = S.invoices.filter(i => i.worker_id === wid && i.status === "pending").length;
  if (iv.length) $("#r-other").value = invTot;
  $("#r-reg").value = hrs.reg || ""; $("#r-ot").value = hrs.ot || ""; $("#r-sick").value = sickH || ""; $("#r-guar").value = guarH || "";
  box.innerHTML = `<p class="note num">From the time clock: ${h2(hrs.reg + hrs.ot)} approved hours in ${ok.length} shift${ok.length === 1 ? "" : "s"}.${waiting ? ` <b>${waiting} shift${waiting === 1 ? " is" : "s are"} still waiting for review</b> and not included.` : ""}${paid ? ` ${paid} already paid.` : ""}${sickH ? ` ${h2(sickH)} sick hours from ${sk.length} approved request${sk.length === 1 ? "" : "s"}.` : ""}${guarH ? ` ${h2(guarH)} guaranteed hours on top of time worked.` : ""}${iv.length ? ` ${iv.length} approved invoice${iv.length === 1 ? "" : "s"} totaling ${usd(invTot)} filled in as other pay.` : ""}${invWait ? ` <b>${invWait} invoice${invWait === 1 ? " is" : "s are"} still waiting for approval</b> and not included.` : ""}</p>`;
  previewRun();
}
const runInputs = () => ({ cityShares: S.run.cityShares, regHours: $("#r-reg").value, otHours: $("#r-ot").value, sickHours: $("#r-sick").value, guaranteeHours: $("#r-guar").value, otherPay: $("#r-other").value, otherDed: $("#r-ded").value });
function previewRun() {
  const w = S.workers.find(x => x.id === $("#r-worker").value), box = $("#r-preview"), date = $("#r-date").value;
  $("#r-save").disabled = true;
  if (!w) { box.innerHTML = ""; return; }
  const z = calcPaycheck(calcWorker(w), runInputs(), priorYTD(w.id), cfgForYear(S.cfg, Number((date || todayStr()).slice(0, 4))));
  const cityRows = Object.entries(z.cityDetail || {}).map(([c, a]) => [cityName(c) + " city tax", a]);
  const rows = w.type === "W-2" ? [["Federal income tax", z.fed], ["Social Security", z.ss], ["Medicare", z.med], ["Michigan income tax", z.state], ...(cityRows.length ? cityRows : [["City income tax", 0]]), ["Other deductions", z.otherDed]] : [["Other deductions", z.otherDed]];
  box.innerHTML = `<div class="slip num">${num(runInputs().sickHours) ? `<div class="row"><span>Sick time, ${h2(num(runInputs().sickHours))} h</span><span>${usd(num(runInputs().sickHours) * num(w.rate))}</span></div>` : ""}${num(runInputs().guaranteeHours) ? `<div class="row"><span>Guaranteed time, ${h2(num(runInputs().guaranteeHours))} h</span><span>${usd(num(runInputs().guaranteeHours) * num(w.rate))}</span></div>` : ""}<div class="row gross"><span>Gross pay</span><span>${usd(z.gross)}</span></div>` +
    rows.filter(r => r[1] || w.type === "W-2").map(r => `<div class="row"><span>${r[0]}</span><span>−${usd(r[1])}</span></div>`).join("") +
    `<div class="net"><span>${w.type === "W-2" ? "Net pay" : "Contractor payment"}</span><b>${usd(z.net)}</b></div></div>` +
    (w.type === "W-2" ? `<p class="cost num">Employer taxes on top: Social Security ${usd(z.erSS)}, Medicare ${usd(z.erMed)}, FUTA ${usd(z.futa)}, Michigan UIA ${usd(z.suta)}. Total cost of this paycheck <b>${usd(z.employerCost)}</b>.</p>`
      : `<p class="cost">No taxes are withheld from contractors. Keep a signed W-9 on file.</p>`);
  $("#r-save").disabled = !(z.gross > 0 && date) || z.net < 0;
}
async function saveRun() {
  const w = S.workers.find(x => x.id === $("#r-worker").value), date = $("#r-date").value, btn = $("#r-save"); if (!w || !date) return;
  if (Number(date.slice(0, 4)) !== S.year) { S.year = Number(date.slice(0, 4)); await loadData(); }
  if (S.checks.some(c => c.worker_id === w.id && c.pay_date === date) && btn.dataset.ok !== "1") { btn.dataset.ok = "1"; btn.textContent = "Already paid on this date. Tap again to add another"; return; }
  const inp = runInputs(), z = calcPaycheck(calcWorker(w), inp, priorYTD(w.id), cfgForYear(S.cfg, Number(date.slice(0, 4)))); btn.disabled = true;
  const row = { worker_id: w.id, worker_name: w.name, type: w.type, pay_date: date, year: Number(date.slice(0, 4)), period_start: $("#r-start").value || null, period_end: $("#r-end").value || null,
    reg_hours: num(inp.regHours), ot_hours: num(inp.otHours), sick_hours: num(inp.sickHours), guarantee_hours: num(inp.guaranteeHours), other_pay: num(inp.otherPay), rate: num(w.rate), gross: z.gross, fed: z.fed, ss: z.ss, med: z.med, state: z.state, city: z.city,
    other_ded: z.otherDed, net: z.net, er_ss: z.erSS, er_med: z.erMed, futa: z.futa, suta: z.suta, employer_cost: z.employerCost, fed941: z.fed941,
    ss_wages: z.ssWages || 0, med_wages: z.medWages || 0, city_detail: z.cityDetail || {} };
  const { data, error } = await sb.from("paychecks").insert(row).select().single();
  if (error) { btn.disabled = false; return fail(error); }
  if (S.run.ids.length) { const r = await sb.rpc("attach_punches", { p_paycheck: data.id, p_ids: S.run.ids }); if (r.error) fail(r.error); }
  if ((S.run.sickIds || []).length) { const r = await sb.rpc("attach_sick", { p_paycheck: data.id, p_ids: S.run.sickIds }); if (r.error) fail(r.error); }
  if ((S.run.invoiceIds || []).length) { const r = await sb.rpc("attach_invoices", { p_paycheck: data.id, p_ids: S.run.invoiceIds }); if (r.error) fail(r.error); }
  ["#r-reg", "#r-ot", "#r-sick", "#r-guar", "#r-other", "#r-ded"].forEach(i => $(i).value = ""); $("#r-worker").value = ""; $("#r-pull").innerHTML = ""; S.run = { ids: [], pending: 0, sickIds: [], cityShares: null, invoiceIds: [] };
  btn.dataset.ok = ""; btn.textContent = "Save paycheck"; toast(w.type === "1099" ? "Payment saved. Statement downloading." : "Paycheck saved"); if (w.type === "1099") downloadStatement(data); refresh();
}

/* ================= paychecks + stubs ================= */
const checkRow = c => `<li><button class="rowbtn" data-stub="${esc(c.id)}"><span class="main"><b>${esc(isMgr() ? c.worker_name : niceDate(c.pay_date))}</b><small class="num">${isMgr() ? esc(niceDate(c.pay_date)) + ", " : ""}gross ${usd(c.gross)}</small></span><span class="num"><b>${usd(c.net)}</b></span></button></li>`;
function renderHistory() {
  const cs = S.checks; $("#h-export").hidden = !cs.length;
  if (!cs.length) { $("#h-list").innerHTML = `<p class="empty">No paychecks in ${S.year} yet. Saved paychecks show up here.</p>`; return; }
  let html = "", last = "";
  cs.forEach(c => { if (c.pay_date !== last) { if (last) html += "</ul>"; html += `<h3 class="num">${esc(niceDate(c.pay_date))}, net ${usd(sum(cs.filter(x => x.pay_date === c.pay_date), "net"))}</h3><ul class="list">`; last = c.pay_date; } html += checkRow(c); });
  $("#h-list").innerHTML = html + "</ul>";
}
function stubRows(c) {
  const ytd = S.checks.filter(x => x.worker_id === c.worker_id && (x.pay_date < c.pay_date || (x.pay_date === c.pay_date && x.created_at <= c.created_at)));
  const items = c.type === "W-2" ? [["Gross pay", "gross"], ["Federal income tax", "fed"], ["Social Security", "ss"], ["Medicare", "med"], ["Michigan income tax", "state"], ["City income tax", "city"], ["Other deductions", "other_ded"], ["Net pay", "net"]]
    : [["Payment", "gross"], ["Other deductions", "other_ded"], ["Net paid", "net"]];
  return items.map(([l, k]) => [l, Number(c[k]) || 0, sum(ytd, k)]);
}
const stubLine = c => `${c.period_start && c.period_end ? `Work from ${niceDate(c.period_start)} to ${niceDate(c.period_end)}. ` : ""}${Number(c.reg_hours) ? c.reg_hours + " regular hours" : ""}${Number(c.ot_hours) ? ", " + c.ot_hours + " overtime hours" : ""}${Number(c.sick_hours) ? ", " + c.sick_hours + " sick hours" : ""}${Number(c.guarantee_hours) ? ", " + c.guarantee_hours + " guaranteed hours" : ""}${Number(c.reg_hours) || Number(c.ot_hours) || Number(c.sick_hours) || Number(c.guarantee_hours) ? " at " + usd(c.rate) + "." : ""}${Number(c.other_pay) ? " Other pay " + usd(c.other_pay) + "." : ""}`;
function stubSheet(id) {
  const c = S.checks.find(x => x.id === id); if (!c) return; const rows = stubRows(c);
  openSheet(`<div class="bar"><h2>${c.type === "W-2" ? "Pay stub" : "Contractor payment"}</h2><button class="ghost" data-close>Close</button></div>
    <p class="help num"><b>${esc(c.worker_name)}</b>, paid ${esc(niceDate(c.pay_date))}. ${esc(stubLine(c))}</p>
    <div class="tblwrap"><table class="num"><tr><th>Item</th><th>This paycheck</th><th>Year to date</th></tr>${rows.map(r => `<tr><td>${r[0]}</td><td>${usd(r[1])}</td><td>${usd(r[2])}</td></tr>`).join("")}</table></div>
    <p class="help num" id="s-sick"></p>
    <div class="actions"><button class="ghost" id="s-dl">${c.type === "1099" ? "Download payment statement (PDF)" : "Download stub"}</button>${isMgr() ? `<button class="danger" id="s-del">Delete paycheck</button>` : ""}</div>
    ${isMgr() ? `<p class="help">Deleting a paycheck frees its shifts to be paid again. It does not recalculate later paychecks for this worker.</p>` : ""}`);
  (async () => { if (c.type === "1099") return; try { const bal = isMgr() ? await q(sb.rpc("sick_balance", { p_worker: c.worker_id, p_on: c.pay_date })) : S.sick; const el = $("#s-sick");
    if (el && bal) el.textContent = `Sick time as of this pay date: ${h2(bal.earned_year)} h earned, ${h2(bal.used_year)} h used, ${h2(bal.available)} h available.`; } catch (e) {} })();
  $("#s-dl").onclick = () => c.type === "1099" ? downloadStatement(c) : download(`paystub-${c.worker_name.replace(/[^a-z0-9]+/gi, "-")}-${c.pay_date}.html`, "text/html", stubHtml(c, rows));
  const d = $("#s-del"); if (d) d.onclick = async () => { if (d.dataset.ok !== "1") { d.dataset.ok = "1"; d.textContent = "Tap again to delete"; return; }
    const { error } = await sb.from("paychecks").delete().eq("id", id); if (error) return fail(error); closeSheet(); toast("Paycheck deleted"); refresh(); };
}
function stubHtml(c, rows) {
  const td = 'style="padding:6px;border-bottom:1px solid #ccc', th = 'style="border-bottom:2px solid #14213D;padding:6px';
  return `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Pay stub</title>
<body style="font-family:Arial,sans-serif;max-width:560px;margin:24px auto;padding:0 16px;color:#14213D"><h2 style="margin-bottom:4px">${esc(S.cfg.businessName || "Pay stub")}</h2>
<p>${c.type === "W-2" ? "Employee pay stub" : "Contractor payment statement (no taxes withheld)"}<br><b>${esc(c.worker_name)}</b><br>Pay date ${esc(niceDate(c.pay_date))}<br>${esc(stubLine(c))}</p>
<table style="width:100%;border-collapse:collapse"><tr><th ${th};text-align:left">Item</th><th ${th};text-align:right">This paycheck</th><th ${th};text-align:right">Year to date</th></tr>
${rows.map(r => `<tr><td ${td}">${r[0]}</td><td ${td};text-align:right">${usd(r[1])}</td><td ${td};text-align:right">${usd(r[2])}</td></tr>`).join("")}</table></body></html>`;
}
function exportCsv() {
  const cols = ["pay_date", "worker_name", "type", "period_start", "period_end", "reg_hours", "ot_hours", "sick_hours", "guarantee_hours", "rate", "other_pay", "gross", "fed", "ss", "med", "state", "city", "other_ded", "net", "er_ss", "er_med", "futa", "suta", "employer_cost", "fed941"];
  const head = ["Pay date", "Worker", "Type", "Period start", "Period end", "Regular hours", "OT hours", "Sick hours", "Guaranteed hours", "Rate", "Other pay", "Gross", "Federal income tax", "Social Security", "Medicare", "Michigan tax", "City tax", "Other deductions", "Net pay", "Employer SS", "Employer Medicare", "FUTA", "Michigan UIA", "Total employer cost", "Federal deposit (941)"];
  const qq = v => `"${String(v ?? "").replace(/"/g, '""')}"`;
  download(`payroll-${S.year}.csv`, "text/csv", [head.map(qq).join(","), ...[...S.checks].reverse().map(c => cols.map(k => qq(c[k])).join(","))].join("\r\n"));
}

/* ================= taxes ================= */
function renderTaxes() {
  const y = S.year, m = Array.from({ length: 12 }, () => ({ fed: 0, mi: 0, city: 0, futa: 0, suta: 0 }));
  S.checks.forEach(c => { const t = m[Number(c.pay_date.slice(5, 7)) - 1]; t.fed += +c.fed941; t.mi += +c.state; t.city += +c.city; t.futa += +c.futa; t.suta += +c.suta; });
  const due = (mo, day) => new Date(y, mo + 1, day).toLocaleDateString("en-US", { month: "short", day: "numeric" });
  const paidBtn = k => `<button class="paid" data-dep="${k}" aria-pressed="${!!S.deposits[k]}">${S.deposits[k] ? "Paid" : "Mark paid"}</button>`;
  const active = m.map((t, i) => ({ ...t, i })).filter(t => t.fed || t.mi || t.city); let h = "";
  if (!S.checks.length) h += `<p class="empty">Nothing owed yet for ${y}. Amounts appear here after you save W-2 paychecks.</p>`;
  else {
    h += `<h3>Federal deposits (EFTPS), monthly schedule</h3><div class="tblwrap"><table class="num"><tr><th>Month</th><th>Owed</th><th>Due</th><th></th></tr>` +
      (active.map(t => `<tr><td>${MONTHS[t.i]}</td><td>${usd(t.fed)}</td><td>${due(t.i, 15)}</td><td>${paidBtn("fed" + t.i)}</td></tr>`).join("") || `<tr><td colspan="4">No W-2 wages yet</td></tr>`) + `</table></div>
      <p class="help">Employee federal income tax plus both halves of Social Security and Medicare. Form 941 is filed each quarter: April 30, July 31, October 31, January 31.</p>`;
    h += `<h3>Michigan withholding (Michigan Treasury Online)</h3><div class="tblwrap"><table class="num"><tr><th>Month</th><th>State</th><th>City</th><th>Due</th><th></th></tr>` +
      (active.map(t => `<tr><td>${MONTHS[t.i]}</td><td>${usd(t.mi)}</td><td>${usd(t.city)}</td><td>${due(t.i, 20)}</td><td>${paidBtn("mi" + t.i)}</td></tr>`).join("") || `<tr><td colspan="5">No W-2 wages yet</td></tr>`) + `</table></div>
      <p class="help">Due dates shown are for monthly filers. Treasury assigns the filing frequency when the business registers. City tax is paid to each city, not to the state. Annual return Form 5081 is due February 28.</p>`;
    h += `<h3>Unemployment taxes</h3><div class="tblwrap"><table class="num"><tr><th>Quarter</th><th>Michigan UIA</th><th>UIA due</th><th>FUTA to date</th><th></th></tr>`;
    let run = 0; const qd = ["Apr 25", "Jul 25", "Oct 25", "Jan 25, " + (y + 1)];
    for (let k = 0; k < 4; k++) { const ms = m.slice(k * 3, k * 3 + 3); run += ms.reduce((a, t) => a + t.futa, 0); h += `<tr><td>Q${k + 1}</td><td>${usd(ms.reduce((a, t) => a + t.suta, 0))}</td><td>${qd[k]}</td><td>${usd(run)}</td><td>${paidBtn("uia" + k)}</td></tr>`; }
    h += `</table></div><p class="help">UIA reports are filed in MiWAM each quarter. FUTA is deposited through EFTPS once the running total passes $500, otherwise it is paid with Form 940 by January 31.</p>`;
  }
  const byW = {}; S.checks.forEach(c => { const o = byW[c.worker_id] ||= { name: c.worker_name, type: c.type, gross: 0, fed: 0, ss: 0, med: 0, state: 0, city: 0 }; ["gross", "fed", "ss", "med", "state", "city"].forEach(k => o[k] += +c[k]); });
  const ws = Object.values(byW).sort((a, b) => a.name.localeCompare(b.name)), w2 = ws.filter(w => w.type === "W-2"), nec = ws.filter(w => w.type === "1099");
  if (w2.length) h += `<h3>W-2 totals for ${y}</h3><div class="tblwrap"><table class="num"><tr><th>Employee</th><th>Wages</th><th>Federal</th><th>Soc. Sec.</th><th>Medicare</th><th>Michigan</th><th>City</th></tr>` +
    w2.map(w => `<tr><td>${esc(w.name)}</td><td>${usd(w.gross)}</td><td>${usd(w.fed)}</td><td>${usd(w.ss)}</td><td>${usd(w.med)}</td><td>${usd(w.state)}</td><td>${usd(w.city)}</td></tr>`).join("") + `</table></div><p class="help">W-2s go to employees and the SSA by January 31.</p>`;
  if (nec.length) h += `<h3>1099 contractors for ${y}</h3><div class="tblwrap"><table class="num"><tr><th>Contractor</th><th>Paid</th><th>1099-NEC</th></tr>` +
    nec.map(w => `<tr><td>${esc(w.name)}</td><td>${usd(w.gross)}</td><td>${w.gross >= S.cfg.necThreshold ? "Required" : "Not yet"}</td></tr>`).join("") + `</table></div><p class="help num">A 1099-NEC is required at ${usd(S.cfg.necThreshold)} or more for the year, due January 31.</p>`;
  $("#t-body").innerHTML = h;
}
async function toggleDeposit(k) {
  const r = S.deposits[k] ? await sb.from("deposits").delete().eq("year", S.year).eq("key", k) : await sb.from("deposits").insert({ year: S.year, key: k, paid_on: todayStr() });
  if (r.error) return fail(r.error); refresh();
}
