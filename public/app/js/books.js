/* ================= Books: income, expenses, profit ================= */
/* [code, label, Schedule C line, explanation]. Vehicle categories start with "veh_" and ask which vehicle. */
const EXP_CATS = [
  ["supplies", "Supplies and equipment", "22", "Flashlights, batteries, radios, patrol logs, first aid supplies. Anything used up on the job."],
  ["equipment", "Equipment and tools", "13 or 22", "Vacuums, floor machines, ladders. Under about $2,500 per item it is expensed; above that the accountant may depreciate it or elect Section 179."],
  ["uniforms", "Uniforms and safety gear", "27", "Only clothing that is not suitable for everyday wear: branded shirts, safety shoes, masks."],
  ["veh_miles", "Vehicle: mileage (standard rate)", "9", "Business miles in a vehicle you own or lease, at the IRS rate set in Settings. Keep a log of date, miles and purpose. If you use mileage for a vehicle you cannot also deduct its gas, repairs or insurance."],
  ["veh_gas", "Vehicle: fuel", "9", "Actual-cost method only. Do not use with mileage for the same vehicle."],
  ["veh_repairs", "Vehicle: repairs, maintenance, tires", "9", "Actual-cost method only."],
  ["veh_insurance", "Vehicle: insurance", "9", "Actual-cost method only. Commercial auto policy on business vehicles."],
  ["veh_rental", "Vehicle: rental or lease payments", "20a", "Rentals and leases are always actual cost. Business share only if also used personally."],
  ["veh_parking", "Vehicle: parking and tolls", "9", "Deductible under either method. Parking tickets are not."],
  ["veh_interest", "Vehicle: loan interest", "16b", "Business share of interest on a vehicle loan. Deductible under either method."],
  ["insurance", "Insurance (liability, bond, workers comp)", "15", "General liability, janitorial bond, workers compensation. Not health insurance for the owner, which goes on the 1040."],
  ["rent", "Rent: office, storage, equipment", "20b", "Space or equipment rented for the business."],
  ["utilities", "Phone, internet, utilities", "25", "Business share of phone and internet. A phone used half for business is half deductible."],
  ["software", "Software and subscriptions", "18", "Scheduling, accounting, this app's hosting, website."],
  ["advertising", "Advertising and marketing", "8", "Flyers, signs, online ads, business cards, website."],
  ["office", "Office supplies and postage", "18", "Paper, printer ink, stamps, envelopes."],
  ["legal", "Legal and professional fees", "17", "Accountant, lawyer, payroll service, bookkeeper."],
  ["bank", "Bank fees and merchant fees", "27", "Account fees, card processing fees, wire fees."],
  ["licenses", "Licenses, permits, business taxes", "23", "Business license, LLC annual statement, sales tax paid on purchases. Not federal income tax."],
  ["contract", "Contract labor (not through payroll)", "11", "Only for help not paid through this app. Contractors paid here are counted automatically."],
  ["training", "Training and certifications", "27", "Courses, OSHA training, certifications for you or workers."],
  ["travel", "Travel (overnight)", "24a", "Lodging and transportation for out-of-town business. Local driving is a vehicle expense."],
  ["meals", "Meals (50% deductible)", "24b", "Meals with a client or while traveling overnight. The app records the full amount; only half is deductible."],
  ["homeoffice", "Home office", "30", "Portion of home costs for a space used only for the business. The accountant computes the deduction; record the costs here."],
  ["interest", "Other interest", "16b", "Interest on a business credit card or loan, not vehicle loans."],
  ["repairs", "Repairs and maintenance (non-vehicle)", "21", "Equipment repair, office repairs."],
  ["draw", "Owner draw (not deductible)", "none", "Money the owner takes out. Tracked so the bank balance reconciles; it is not an expense and does not reduce taxes."],
  ["other", "Other", "27", "Anything else. Describe it in the note."]];
const catName = k => (EXP_CATS.find(c => c[0] === k) || ["", k])[1], catInfo = k => EXP_CATS.find(c => c[0] === k) || ["", k, "", ""];
const isVeh = k => String(k).startsWith("veh_");
const METHODS = { check: "Check", cash: "Cash", card: "Card", transfer: "Bank transfer", other: "Other" };
const mileRate = () => Number(S.cfg.mileageRate) || 0.70;
const BK = { view: "overview", period: "month" };
function periodRange(p) { const t = parseYmd(todayStr()), y = t.getFullYear(), m = t.getMonth(), q = Math.floor(m / 3);
  const r = { month: [new Date(y, m, 1), new Date(y, m + 1, 0)], lastmonth: [new Date(y, m - 1, 1), new Date(y, m, 0)], quarter: [new Date(y, q * 3, 1), new Date(y, q * 3 + 3, 0)], year: [new Date(y, 0, 1), new Date(y, 11, 31)], lastyear: [new Date(y - 1, 0, 1), new Date(y - 1, 11, 31)] }[p];
  return { a: ymd(r[0]), b: ymd(r[1]) }; }
const inRange = (d, r) => d >= r.a && d <= r.b;

function renderBooks() {
  const v = $("#v-books"), r = periodRange(BK.period), inc = S.income.filter(x => inRange(x.on_date, r)), exp = S.expenses.filter(x => inRange(x.on_date, r));
  let h = `${backMore}<h2>Books</h2><div class="seg" style="grid-template-columns:1fr 1fr 1fr" id="bk-seg">${[["overview", "Overview"], ["income", "Income"], ["expenses", "Expenses"]].map(x => `<button type="button" data-v="${x[0]}" aria-pressed="${BK.view === x[0]}">${x[1]}</button>`).join("")}</div>
    <label class="f" for="bk-period">Period</label><select id="bk-period">${[["month", "This month"], ["lastmonth", "Last month"], ["quarter", "This quarter"], ["year", "This year"], ["lastyear", "Last year"]].map(x => `<option value="${x[0]}" ${BK.period === x[0] ? "selected" : ""}>${x[1]}</option>`).join("")}</select><p class="help num">${esc(niceDate(r.a))} to ${esc(niceDate(r.b))}.</p>`;
  if (BK.view === "overview") h += `<div id="bk-ov"><p class="help">Adding up</p></div>`;
  else if (BK.view === "income") h += `<button class="primary" id="bk-addinc" style="margin:0 0 12px">Record money received</button>` + (inc.length ? `<ul class="list">${inc.map(x => `<li><button class="rowbtn" data-inc="${esc(x.id)}"><span class="main"><b>${esc(x.client || siteName(x.site_id))}</b><small>${esc(niceDate(x.on_date))}, ${METHODS[x.method] || x.method}${x.reference ? ", " + esc(x.reference) : ""}${x.photo_path ? ", photo" : ""}</small></span><span class="num"><b>${usd(x.amount)}</b></span></button></li>`).join("")}</ul><p class="help num">Total ${usd(sum(inc, "amount"))}.</p>` : `<p class="empty">Nothing recorded in this period.</p>`);
  else h += `<button class="primary" id="bk-addexp" style="margin:0 0 12px">Record an expense</button>` + (exp.length ? `<ul class="list">${exp.map(x => `<li><button class="rowbtn" data-exp="${esc(x.id)}"><span class="main"><b>${esc(x.vendor || catName(x.category))}</b><small>${esc(niceDate(x.on_date))}, ${catName(x.category)}${x.miles ? ", " + x.miles + " miles" : ""}${x.receipt_path ? ", receipt" : ""}</small></span><span class="num"><b>${usd(x.amount)}</b></span></button></li>`).join("")}</ul><p class="help num">Total ${usd(sum(exp, "amount"))}.</p>` : `<p class="empty">Nothing recorded in this period.</p>`);
  h += `<div class="actions"><button class="ghost" id="bk-export">Export ${r.a.slice(0, 4)} for the accountant (CSV)</button></div><p class="help">Payroll cost comes from saved paychecks (wages plus employer taxes). Shifts not yet on a paycheck are estimated at the worker's rate plus the employer taxes payroll charges (${Math.round((Number(S.cfg.ssRate) + Number(S.cfg.medicareRate) + Number(S.cfg.futaRate) + Number(S.cfg.uiaRate)) * 10000) / 100}%).</p>`;
  v.innerHTML = h;
  $("#bk-seg").onclick = e => { if (e.target.dataset.v) { BK.view = e.target.dataset.v; renderBooks(); } }; $("#bk-period").onchange = () => { BK.period = $("#bk-period").value; renderBooks(); };
  const ai = $("#bk-addinc"); if (ai) ai.onclick = () => incomeSheet(null); const ae = $("#bk-addexp"); if (ae) ae.onclick = () => expenseSheet(null);
  document.querySelectorAll("[data-inc]").forEach(b => b.onclick = () => incomeSheet(b.dataset.inc)); document.querySelectorAll("[data-exp]").forEach(b => b.onclick = () => expenseSheet(b.dataset.exp));
  $("#bk-export").onclick = () => exportBooks(Number(r.a.slice(0, 4)));
  if (BK.view === "overview") overview(r, inc, exp);
}

/* What the owner personally owes on the profit shown above, and the four estimated payments. Shown for a whole year only. */
function ownerTaxPanel(r, profit) {
  if (!isOwner()) return ""; const ow = S.ownerTax || {}, y = Number(r.a.slice(0, 4)), full = r.a.endsWith("-01-01") && r.b.endsWith("-12-31"), head = `<h3>Owner's own taxes</h3>`;
  if (!full) return `${head}<div class="panel"><p class="help">Switch the period to This year or Last year to see the tax the owner owes on the profit and the quarterly payments.</p></div>`;
  if (ow.type === "other") return `${head}<div class="panel"><p class="help">Settings says the business is taxed as a partnership or corporation, so the owner's tax comes from that return. Ask the CPA what to set aside.</p></div>`;
  if (!ow.filing) return `${head}<div class="panel"><p class="help">The profit is taxed to the owner personally even if it stays in the business account. Set the owner's filing status under Settings, Owner's own taxes, and the amount shows here.</p></div>`;
  const t = parseYmd(todayStr()), months = y < t.getFullYear() ? 12 : y > t.getFullYear() ? 0 : t.getMonth() + 1, args = { year: y, cfg: S.cfg, filing: ow.filing, homeCity: ow.homeCity, otherIncome: ow.otherIncome, otherWages: ow.otherWages, miExemptions: ow.miExemptions ?? 1, cityShares: incomeCityShares(S.income.filter(x => inRange(x.on_date, r))) };
  const e = ownerTaxEstimate({ ...args, profit }), proj = months > 0 && months < 12 && profit > 0 ? ownerTaxEstimate({ ...args, profit: profit * 12 / months }) : e, dates = ownerEstDates(y);
  if (profit <= 0) return `${head}<div class="panel"><p class="help">No profit ${y === t.getFullYear() ? "so far" : ""} in ${y}, so nothing to set aside.</p></div>`;
  return `${head}<div class="panel"><p class="help num" style="margin-top:0">The ${usd(profit)} profit ${months < 12 ? "so far " : ""}is the owner's income for ${y}, drawn or not. Estimated tax on it, about <b>${Math.round(e.share * 100)}%</b>:</p>
    <dl class="kv num"><dt>Self-employment tax (Social Security and Medicare, both halves)</dt><dd>${usd(e.seTax)}</dd><dt>Federal income tax, ${e.filing === "MFJ" ? "married filing jointly" : e.filing === "HOH" ? "head of household" : "single"}, after the QBI deduction</dt><dd>${usd(e.fedTax)}</dd>
    <dt>Michigan income tax</dt><dd>${usd(e.miTax)}</dd>${Object.entries(e.cityDetail || {}).map(([c, a]) => `<dt>${esc(cityName(c))} ${c === ow.homeCity ? "resident" : `nonresident, ${Math.round((args.cityShares[c] || 0) * 100)}% of the billing`} tax</dt><dd>${usd(a)}</dd>`).join("")}<dt><b>Set aside</b></dt><dd><b>${usd(e.total)}</b></dd></dl>
    ${months > 0 && months < 12 ? `<p class="help num">At this pace ${y} lands near ${usd(proj.profit)} profit and ${usd(proj.total)} tax, so each quarterly payment is about <b>${usd(proj.quarterly)}</b>.` : `<p class="help num">Each quarterly payment: <b>${usd(e.quarterly)}</b>.`} Federal on IRS Direct Pay or EFTPS (Form 1040-ES), Michigan on Michigan Treasury Online (MI-1040ES). Paying late costs a penalty even when the year-end total is right.</p>
    <div class="tblwrap"><table class="num"><tr><th>Payment</th><th>Due</th><th>About</th><th></th></tr>${dates.map((d, k) => `<tr><td>${k + 1} of 4</td><td>${esc(niceDate(d))}</td><td>${usd(proj.quarterly)}</td><td>${S.done[`est-${y}-${k}`] ? `<span class="tag ok">Paid ${esc(niceDate(S.done[`est-${y}-${k}`].slice(0, 10)))}</span>` : `<button type="button" class="paid" data-done="est-${y}-${k}">Mark paid</button>`}</td></tr>`).join("")}</table></div>
    <p class="help">${e.estimated ? `${y} brackets are projected from the ${Math.max(...Object.keys(OWNER_TABLES).map(Number))} tables. ` : ""}City tax follows the work: each taxing city gets its share of the profit by the income billed from sites in that city (set each site's city under Sites), and the home city credits what the others charge. This is a set-aside estimate for a sole proprietor or single-member LLC; the real return can differ. A CPA files it.</p></div>`;
}
async function overview(r, inc, exp) {
  const box = $("#bk-ov"); let checks = [], punches = [];
  try { [checks, punches] = await Promise.all([q(sb.from("paychecks").select("id,worker_id,gross,employer_cost,pay_date,type").gte("pay_date", r.a).lte("pay_date", r.b)),
    q(sb.from("punches").select("worker_id,site_id,paid_hours,clock_in,clock_out,break_minutes,status").gte("clock_in", parseYmd(r.a).toISOString()).lt("clock_in", new Date(parseYmd(r.b).getTime() + 864e5).toISOString()).neq("status", "rejected"))]); } catch (e) { box.innerHTML = `<p class="help">${esc(e.message)}</p>`; return; }
  const income = sum(inc, "amount"), payroll = sum(checks.filter(c => c.type !== "1099"), "employer_cost"), contract = sum(checks.filter(c => c.type === "1099"), "employer_cost"), expenses = sum(exp.filter(x => x.category !== "draw"), "amount"), draws = sum(exp.filter(x => x.category === "draw"), "amount"), net = Math.round((income - payroll - contract - expenses) * 100) / 100;
  /* Same employer rates payroll uses: Social Security, Medicare, FUTA and Michigan UIA. Wage caps are ignored for this estimate. */
  const burden = 1 + Number(S.cfg.ssRate) + Number(S.cfg.medicareRate) + Number(S.cfg.futaRate) + Number(S.cfg.uiaRate);
  /* Labor by site: each worker's real paycheck cost in the period is split across the sites they worked, by paid hours. Shifts not yet on a paycheck are estimated and shown separately. */
  const bySite = {}; inc.forEach(x => { const k = x.site_id || "other"; (bySite[k] ||= { income: 0, labor: 0, est: 0, hours: 0 }).income += Number(x.amount); });
  const byWorker = {}; punches.forEach(p => { const hrs = Number(p.paid_hours) || punchHours(p), k = p.site_id || "other", w = byWorker[p.worker_id] ||= { hours: 0, sites: {}, unpaid: 0 }; w.hours += hrs; w.sites[k] = (w.sites[k] || 0) + hrs; if (!p.paycheck_id) w.unpaid += hrs; });
  const costByWorker = {}; checks.filter(c => c.type !== "1099").forEach(c => costByWorker[c.worker_id] = (costByWorker[c.worker_id] || 0) + Number(c.employer_cost));
  let unallocated = 0;
  /* Contractor payments go to the sites on the invoices they paid; approved invoices not yet paid count as an estimate. */
  const cIds = checks.filter(c => c.type === "1099").map(c => c.id); let invs = [], owed = [];
  try { if (cIds.length) invs = await q(sb.from("invoices").select("site_id,total,hours,paycheck_id").in("paycheck_id", cIds));
    owed = await q(sb.from("invoices").select("site_id,total,hours").eq("status", "approved").is("paycheck_id", null).gte("on_date", r.a).lte("on_date", r.b)); } catch (e) {}
  const invByCheck = {}; invs.forEach(i => { const o = invByCheck[i.paycheck_id] ||= { total: 0, sites: {} }, k = i.site_id || "other"; o.total += Number(i.total); o.sites[k] = (o.sites[k] || 0) + Number(i.total); (bySite[k] ||= { income: 0, labor: 0, est: 0, hours: 0 }).hours += Number(i.hours) || 0; });
  checks.filter(c => c.type === "1099").forEach(c => { const o = invByCheck[c.id]; if (!o || !o.total) { unallocated += Number(c.employer_cost); return; } Object.entries(o.sites).forEach(([k, t]) => { (bySite[k] ||= { income: 0, labor: 0, est: 0, hours: 0 }).labor += Number(c.employer_cost) * t / o.total; }); });
  owed.forEach(i => { const o = bySite[i.site_id || "other"] ||= { income: 0, labor: 0, est: 0, hours: 0 }; o.est += Number(i.total); o.hours += Number(i.hours) || 0; });
  Object.entries(costByWorker).forEach(([wid, cost]) => { const w = byWorker[wid]; if (!w || !w.hours) { unallocated += cost; return; } Object.entries(w.sites).forEach(([k, h]) => { const o = bySite[k] ||= { income: 0, labor: 0, est: 0, hours: 0 }; o.labor += cost * h / w.hours; }); });
  Object.entries(byWorker).forEach(([wid, w]) => { const rate = Number((S.workers.find(x => x.id === wid) || {}).rate) || 0; Object.entries(w.sites).forEach(([k, h]) => { const o = bySite[k] ||= { income: 0, labor: 0, est: 0, hours: 0 }; o.hours += h; }); if (!costByWorker[wid]) Object.entries(w.sites).forEach(([k, h]) => { bySite[k].est += h * rate * burden; }); });
  const estTotal = Object.values(bySite).reduce((a, o) => a + o.est, 0);
  const cats = {}; exp.forEach(x => cats[x.category] = (cats[x.category] || 0) + Number(x.amount));
  box.innerHTML = `<div class="stat num"><div><b>${usd(income)}</b><small>money in</small></div><div><b>${usd(payroll + contract + expenses)}</b><small>money out</small></div><div><b style="color:${net < 0 ? "var(--danger)" : "var(--accent)"}">${usd(net)}</b><small>${net < 0 ? "loss" : "profit"}</small></div></div>
    <p class="help num" style="margin:8px 0 0">Money in is what customers paid you. Money out is employee payroll (${usd(payroll)}), contractor payments (${usd(contract)}) and other expenses (${usd(expenses)}). ${estTotal ? `Another ${usd(estTotal)} of clocked work has not been put on a paycheck yet and is not counted here.` : ""}</p>
    <dl class="kv num" style="margin-top:12px"><dt>Employee payroll (wages and employer taxes)</dt><dd>${usd(payroll)}</dd><dt>Contractor payments (Schedule C line 11)</dt><dd>${usd(contract)}</dd><dt>Other expenses</dt><dd>${usd(expenses)}</dd>${Object.entries(cats).filter(([k]) => k !== "draw").sort((a, b) => b[1] - a[1]).map(([k, v]) => `<dt style="padding-left:12px">${esc(catName(k))}</dt><dd>${usd(v)}</dd>`).join("")}${draws ? `<dt>Owner draws (not an expense)</dt><dd>${usd(draws)}</dd>` : ""}</dl>
    ${ownerTaxPanel(r, net)}
    ${vehicleSummary(exp)}
    <h3>By site</h3><div class="tblwrap"><table class="num"><tr><th>Site</th><th>Billed</th><th>Hours</th><th>Labor paid</th><th>Not yet paid</th><th>Margin</th></tr>${Object.entries(bySite).sort((a, b) => b[1].income - a[1].income).map(([k, o]) => { const m = o.income - o.labor - o.est; return `<tr><td>${esc(k === "other" ? "Not tied to a site" : siteName(k))}</td><td>${usd(o.income)}</td><td>${h2(o.hours)}</td><td>${usd(o.labor)}</td><td>${o.est ? usd(o.est) : ""}</td><td style="color:${m < 0 ? "var(--danger)" : "inherit"}">${o.income ? usd(m) + " (" + Math.round(m / o.income * 100) + "%)" : usd(m)}</td></tr>`; }).join("") || `<tr><td colspan="6">Record income against a site to see margins.</td></tr>`}${unallocated ? `<tr><td>Payroll not tied to clocked hours</td><td></td><td></td><td>${usd(unallocated)}</td><td></td><td></td></tr>` : ""}</table></div>
    <p class="help">Labor paid is the real paycheck cost (wages plus employer taxes) split across the sites each employee clocked at, plus contractor payments on the sites their invoices name. Not yet paid is an estimate for shifts and approved invoices still waiting for a paycheck. Margin is what a site pays minus both. Under 30% usually means the job is priced too low or taking too long.</p>`;
  wireTodos();
}

function incomeSheet(id) {
  const x = S.income.find(i => i.id === id) || { on_date: todayStr(), method: "check" };
  openSheet(`<div class="bar"><h2>${id ? "Money received" : "Record money received"}</h2><button class="ghost" data-close>Close</button></div>
    <div class="grid2"><div><label class="f" for="in-date">Date</label><input id="in-date" type="date" value="${esc(x.on_date)}"></div><div><label class="f" for="in-amt">Amount ($)</label><input id="in-amt" type="number" inputmode="decimal" min="0" step="0.01" value="${esc(x.amount ?? "")}"></div></div>
    <label class="f" for="in-site">Site (which customer)</label><select id="in-site"><option value="">Not tied to a site</option>${S.sites.map(s => `<option value="${esc(s.id)}" ${x.site_id === s.id ? "selected" : ""}>${esc(s.name)}</option>`).join("")}</select>
    <label class="f" for="in-client">Client name (if no site)</label><input id="in-client" type="text" value="${esc(x.client || "")}">
    <div class="grid2"><div><label class="f" for="in-method">How</label><select id="in-method">${Object.entries(METHODS).map(([k, l]) => `<option value="${k}" ${x.method === k ? "selected" : ""}>${l}</option>`).join("")}</select></div><div><label class="f" for="in-ref">Check or invoice number</label><input id="in-ref" type="text" value="${esc(x.reference || "")}"></div></div>
    <label class="f" for="in-note">Note</label><input id="in-note" type="text" value="${esc(x.note || "")}">
    <label class="f">Photo of the check or invoice</label><div style="display:flex;gap:16px;align-items:center;flex-wrap:wrap"><label class="linkbtn" style="padding:6px 0">${x.photo_path ? "Retake photo" : "Take a photo"}<input type="file" accept="image/*,application/pdf" capture="environment" id="in-photo" hidden></label>${x.photo_path ? `<button type="button" class="ghost" id="in-view" style="min-height:36px;padding:6px 10px">View</button>` : ""}<span class="help" id="in-photo-name"></span></div><div id="in-preview"></div>
    <button class="primary" id="in-save">Save</button>${id ? `<div class="actions"><button class="danger" id="in-del">Delete</button></div>` : ""}`);
  let file = null; $("#in-photo").onchange = () => { file = $("#in-photo").files[0]; $("#in-photo-name").textContent = file ? file.name : ""; };
  const vw = $("#in-view"); if (vw) vw.onclick = () => viewBooksFile(x.photo_path, "#in-preview");
  $("#in-save").onclick = async () => { const body = { on_date: $("#in-date").value, amount: num($("#in-amt").value), site_id: $("#in-site").value || null, client: $("#in-client").value.trim(), method: $("#in-method").value, reference: $("#in-ref").value.trim(), note: $("#in-note").value.trim() };
    if (!body.on_date || !(body.amount > 0)) return toast("Enter the date and amount"); if (!body.site_id && !body.client) return toast("Pick a site or type the client name");
    try { if (file) body.photo_path = await uploadBooksFile(file, "income"); const r = id ? await sb.from("income").update(body).eq("id", id) : await sb.from("income").insert(body); if (r.error) throw r.error; closeSheet(); toast("Saved"); refresh(); } catch (e) { fail(e); } };
  const d = $("#in-del"); if (d) d.onclick = async () => { if (d.dataset.ok !== "1") { d.dataset.ok = "1"; d.textContent = "Tap again to delete"; return; } const r = await sb.from("income").delete().eq("id", id); if (r.error) return fail(r.error); closeSheet(); refresh(); };
}

function expenseSheet(id) {
  const x = S.expenses.find(i => i.id === id) || { on_date: todayStr(), category: "supplies" };
  openSheet(`<div class="bar"><h2>${id ? "Expense" : "Record an expense"}</h2><button class="ghost" data-close>Close</button></div>
    <div class="grid2"><div><label class="f" for="ex-date">Date</label><input id="ex-date" type="date" value="${esc(x.on_date)}"></div><div><label class="f" for="ex-cat">Category</label><select id="ex-cat">${EXP_CATS.map(c => `<option value="${c[0]}" ${x.category === c[0] ? "selected" : ""}>${c[1]}</option>`).join("")}</select></div></div>
    <p class="help" id="ex-info"></p>
    <div id="ex-vehwrap" ${isVeh(x.category) ? "" : "hidden"}><label class="f" for="ex-veh">Which vehicle</label><input id="ex-veh" type="text" list="ex-vehlist" value="${esc(x.vehicle || "")}" placeholder="Example: 2019 Transit van"><datalist id="ex-vehlist">${[...new Set(S.expenses.map(e => e.vehicle).filter(Boolean))].map(v => `<option value="${esc(v)}">`).join("")}</datalist><p class="help" id="ex-vehwarn"></p></div>
    <label class="f" for="ex-vendor">Paid to</label><input id="ex-vendor" type="text" value="${esc(x.vendor || "")}" placeholder="Example: Home Depot">
    <div class="grid2"><div><label class="f" for="ex-amt">Amount ($)</label><input id="ex-amt" type="number" inputmode="decimal" min="0" step="0.01" value="${esc(x.amount ?? "")}"></div><div><label class="f" for="ex-miles">Or miles driven</label><input id="ex-miles" type="number" inputmode="decimal" min="0" step="0.1" value="${esc(x.miles ?? "")}"><p class="help">At ${(mileRate() * 100).toFixed(1)} cents a mile, set in Settings.</p></div></div>
    <label class="f" for="ex-site">Site (optional, for job costing)</label><select id="ex-site"><option value="">None</option>${S.sites.map(s => `<option value="${esc(s.id)}" ${x.site_id === s.id ? "selected" : ""}>${esc(s.name)}</option>`).join("")}</select>
    <label class="f" for="ex-note">Note</label><input id="ex-note" type="text" value="${esc(x.note || "")}">
    <label class="f">Receipt</label><div style="display:flex;gap:16px;align-items:center;flex-wrap:wrap"><label class="linkbtn" style="padding:6px 0">${x.receipt_path ? "Retake receipt photo" : "Photograph the receipt"}<input type="file" accept="image/*,application/pdf" capture="environment" id="ex-photo" hidden></label>${x.receipt_path ? `<button type="button" class="ghost" id="ex-view" style="min-height:36px;padding:6px 10px">View</button>` : ""}<span class="help" id="ex-photo-name"></span></div><div id="ex-preview"></div>
    <p class="help">Type the amount from the receipt. The photo is kept for your records; the IRS accepts photos of receipts.</p>
    <button class="primary" id="ex-save">Save</button>${id ? `<div class="actions"><button class="danger" id="ex-del">Delete</button></div>` : ""}`);
  let file = null; $("#ex-photo").onchange = () => { file = $("#ex-photo").files[0]; $("#ex-photo-name").textContent = file ? file.name : ""; };
  const info = () => { const k = $("#ex-cat").value, c = catInfo(k); $("#ex-info").textContent = `${c[3]}${c[2] && c[2] !== "none" ? ` Schedule C line ${c[2]}.` : ""}`; $("#ex-vehwrap").hidden = !isVeh(k); vehWarn(); };
  const vehWarn = () => { const k = $("#ex-cat").value, veh = ($("#ex-veh").value || "").trim().toLowerCase(), yr = ($("#ex-date").value || "").slice(0, 4), el = $("#ex-vehwarn"); if (!isVeh(k) || !veh) { el.textContent = ""; return; }
    const same = S.expenses.filter(e => e.id !== id && (e.vehicle || "").trim().toLowerCase() === veh && e.on_date.startsWith(yr)), actual = same.some(e => ["veh_gas", "veh_repairs", "veh_insurance"].includes(e.category)), miles = same.some(e => e.category === "veh_miles");
    el.textContent = (k === "veh_miles" && actual) ? "This vehicle already has fuel, repair or insurance entries this year. The IRS allows mileage or actual costs for a vehicle, not both. Talk to the accountant before mixing." : (["veh_gas", "veh_repairs", "veh_insurance"].includes(k) && miles) ? "This vehicle already has mileage entries this year. Mileage and actual costs cannot both be deducted for the same vehicle." : ""; };
  info(); $("#ex-cat").onchange = info; $("#ex-veh").oninput = vehWarn; $("#ex-date").onchange = vehWarn;
  $("#ex-miles").oninput = () => { const m = num($("#ex-miles").value); if (m) { $("#ex-amt").value = (Math.round(m * mileRate() * 100) / 100).toFixed(2); $("#ex-cat").value = "veh_miles"; info(); } };
  const vw = $("#ex-view"); if (vw) vw.onclick = () => viewBooksFile(x.receipt_path, "#ex-preview");
  $("#ex-save").onclick = async () => { const body = { on_date: $("#ex-date").value, category: $("#ex-cat").value, vendor: $("#ex-vendor").value.trim(), amount: num($("#ex-amt").value), miles: $("#ex-miles").value === "" ? null : num($("#ex-miles").value), site_id: $("#ex-site").value || null, note: $("#ex-note").value.trim(), vehicle: isVeh($("#ex-cat").value) ? $("#ex-veh").value.trim() : "" };
    if (isVeh(body.category) && !body.vehicle) return toast("Say which vehicle");
    if (!body.on_date || !(body.amount > 0)) return toast("Enter the date and amount");
    try { if (file) body.receipt_path = await uploadBooksFile(file, "receipt"); const r = id ? await sb.from("expenses").update(body).eq("id", id) : await sb.from("expenses").insert(body); if (r.error) throw r.error; closeSheet(); toast("Saved"); refresh(); } catch (e) { fail(e); } };
  const d = $("#ex-del"); if (d) d.onclick = async () => { if (d.dataset.ok !== "1") { d.dataset.ok = "1"; d.textContent = "Tap again to delete"; return; } const r = await sb.from("expenses").delete().eq("id", id); if (r.error) return fail(r.error); closeSheet(); refresh(); };
}

async function uploadBooksFile(file, kind) { if (file.size > 20 * 1048576) throw new Error("That file is over 20 MB."); const ext = (file.name.split(".").pop() || "jpg").toLowerCase(), path = `${new Date().getFullYear()}/${kind}-${Date.now()}.${ext}`;
  const up = await sb.storage.from("books").upload(path, file, { contentType: file.type || undefined }); if (up.error) throw up.error; return path; }
async function viewBooksFile(path, sel) { try { const r = await sb.storage.from("books").createSignedUrl(path, 600); if (r.error) throw r.error; const u = r.data.signedUrl, box = $(sel);
    box.innerHTML = /\.pdf$/i.test(path) ? `<a href="${esc(u)}" target="_blank" rel="noopener" class="linkbtn">Open the PDF</a>` : `<a href="${esc(u)}" target="_blank" rel="noopener"><img src="${esc(u)}" alt="Receipt" style="width:100%;border-radius:8px;margin-top:8px"></a>`; } catch (e) { fail(e); } }

/* Per-vehicle totals for the period, with the method each vehicle appears to be using. */
function vehicleSummary(exp) {
  const v = {}; exp.filter(x => isVeh(x.category)).forEach(x => { const k = x.vehicle || "Unnamed vehicle", o = v[k] ||= { miles: 0, mileageAmt: 0, actual: 0, either: 0 }; if (x.category === "veh_miles") { o.miles += Number(x.miles) || 0; o.mileageAmt += Number(x.amount); } else if (["veh_parking", "veh_interest", "veh_rental"].includes(x.category)) o.either += Number(x.amount); else o.actual += Number(x.amount); });
  const ks = Object.keys(v); if (!ks.length) return "";
  return `<h3>Vehicles</h3><div class="tblwrap"><table class="num"><tr><th>Vehicle</th><th>Miles</th><th>Mileage value</th><th>Actual costs</th><th>Either method</th><th>Method</th></tr>${ks.map(k => { const o = v[k]; return `<tr><td>${esc(k)}</td><td>${o.miles}</td><td>${usd(o.mileageAmt)}</td><td>${usd(o.actual)}</td><td>${usd(o.either)}</td><td>${o.mileageAmt && o.actual ? "Both (fix)" : o.mileageAmt ? "Mileage" : o.actual ? "Actual" : ""}</td></tr>`; }).join("")}</table></div>
    <p class="help">Pick one method per vehicle for the year. Standard mileage is simpler and usually better for a car; actual costs can win for a van or truck with high running costs. Parking, tolls, loan interest and rentals count under either.</p>`;
}
/* One CSV for the accountant: every income line, every expense line, and payroll by month. */
async function exportBooks(year) {
  const qq = v => `"${String(v ?? "").replace(/"/g, '""')}"`, rows = [["Type", "Date", "Who", "Category", "Site", "Amount", "Miles", "Method or note", "Attachment"]];
  S.income.filter(x => x.on_date.startsWith(String(year))).forEach(x => rows.push(["Income", x.on_date, x.client || siteName(x.site_id), "Sales", siteName(x.site_id), money2(x.amount), "", METHODS[x.method] + (x.reference ? " " + x.reference : "") + (x.note ? ". " + x.note : ""), x.photo_path || ""]));
  S.expenses.filter(x => x.on_date.startsWith(String(year))).forEach(x => rows.push([x.category === "draw" ? "Owner draw" : "Expense", x.on_date, x.vendor, `${catName(x.category)} (Sch C ${catInfo(x.category)[2]})${x.vehicle ? " " + x.vehicle : ""}`, x.site_id ? siteName(x.site_id) : "", money2(x.amount), x.miles ?? "", x.note, x.receipt_path || ""]));
  try { const checks = await q(sb.from("paychecks").select("pay_date,worker_name,type,gross,er_ss,er_med,futa,suta,employer_cost").eq("year", year).order("pay_date"));
    checks.forEach(c => rows.push([c.type === "W-2" ? "Payroll" : "Contract labor", c.pay_date, c.worker_name, c.type === "W-2" ? "Wages" : "Contract labor", "", money2(c.gross), "", c.type === "W-2" ? `Employer taxes ${money2(Number(c.er_ss) + Number(c.er_med) + Number(c.futa) + Number(c.suta))}` : "", ""])); } catch (e) { fail(e); }
  download(`books-${year}.csv`, "text/csv", rows.map(r => r.map(qq).join(",")).join("\r\n"));
}
