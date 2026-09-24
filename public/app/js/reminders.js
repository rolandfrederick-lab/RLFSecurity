/* ================= reminders: what is due, when, and where to do it ================= */
const lastDay = (y, m) => new Date(y, m + 1, 0);   // m is 0-based
const dstr = d => ymd(d);
const daysUntil = dueYmd => Math.round((parseYmd(dueYmd) - parseYmd(todayStr())) / 864e5);
/* Every item has a stable key so it can be marked done. Only items within 30 days of due, or overdue, are shown. */
function todoItems() {
  const t = parseYmd(todayStr()), Y = t.getFullYear(), M = t.getMonth(), items = [], done = S.done || {};
  const add = (key, due, title, detail, tab, kind) => { if (done[key]) return; const d = daysUntil(due); if (d > 30) return; items.push({ key, due, days: d, title, detail, tab, kind: kind || "filing" }); };
  // operational, never "done", they clear themselves
  const sub = S.punches.filter(p => p.status === "submitted").length; if (sub) items.push({ key: "op-review", due: todayStr(), days: 0, title: `Review ${sub} shift${sub === 1 ? "" : "s"}`, detail: "Waiting for approval on the Timesheets tab.", tab: "team", kind: "op" });
  const owed = S.invoices.filter(i => i.status === "approved" && !i.paycheck_id); if (owed.length) items.push({ key: "op-owed", due: todayStr(), days: 0, title: `Pay ${usd(owed.reduce((a, i) => a + Number(i.total), 0))} to contractor${new Set(owed.map(i => i.worker_id)).size === 1 ? "" : "s"}`, detail: `${owed.length} approved invoice${owed.length === 1 ? "" : "s"} not yet paid. Pay tab, pick the contractor.`, tab: "run", kind: "op" });
  const inv = S.invoices.filter(i => i.status === "pending").length; if (inv) items.push({ key: "op-inv", due: todayStr(), days: 0, title: `${inv} contractor invoice${inv === 1 ? "" : "s"} waiting`, detail: "Approve or reject on the Timesheets tab.", tab: "team", kind: "op" });
  const req = S.requests.filter(r => r.status === "pending" && r.worker_id !== S.me.worker_id).length; if (req) items.push({ key: "op-req", due: todayStr(), days: 0, title: `${req} time off request${req === 1 ? "" : "s"} waiting`, detail: "Approve or deny on the Timesheets tab.", tab: "team", kind: "op" });
  const missed = S.shifts.filter(s => s.status === "missed" && new Date(s.on_date) > Date.now() - 14 * 864e5).length; if (missed) items.push({ key: "op-missed", due: todayStr(), days: 0, title: `${missed} missed shift${missed === 1 ? "" : "s"}`, detail: "Log attendance or clear them on the Timesheets tab.", tab: "team", kind: "op" });
  if ((S.paperworkMissing || []).length) items.push({ key: "op-paper", due: todayStr(), days: 0, title: `${S.paperworkMissing.length} worker${S.paperworkMissing.length === 1 ? " has" : "s have"} not done tax paperwork`, detail: S.paperworkMissing.join(", ") + ". They do it on their phone under More, My tax paperwork.", tab: "workers", kind: "op" });
  const wait = S.people.filter(p => !p.active).length; if (wait) items.push({ key: "op-people", due: todayStr(), days: 0, title: `${wait} new login${wait === 1 ? "" : "s"} waiting for approval`, detail: "Approve and link under People and roles.", tab: "people", kind: "op" });
  // deposits, from this year's paychecks
  if (S.year === Y) { const fed = Array(12).fill(0), mi = Array(12).fill(0), uia = [0, 0, 0, 0], futa = [0, 0, 0, 0];
    S.checks.filter(c => c.type === "W-2").forEach(c => { const m = Number(c.pay_date.slice(5, 7)) - 1; fed[m] += Number(c.fed941) || 0; mi[m] += (Number(c.state) || 0) + (Number(c.city) || 0); uia[Math.floor(m / 3)] += Number(c.suta) || 0; futa[Math.floor(m / 3)] += Number(c.futa) || 0; });
    for (let m = 0; m < M; m++) { if (fed[m] > 0.005 && !S.deposits["fed" + m]) add(`dep-fed-${Y}-${m}`, dstr(new Date(Y, m + 1, 15)), `Deposit ${usd(fed[m])} federal tax for ${MONTHS[m]}`, "Pay on EFTPS.gov, then mark it paid on the Taxes tab.", "taxes", "deposit");
      if (mi[m] > 0.005 && !S.deposits["mi" + m]) add(`dep-mi-${Y}-${m}`, dstr(new Date(Y, m + 1, 20)), `Pay ${usd(mi[m])} Michigan and city withholding for ${MONTHS[m]}`, "State on Michigan Treasury Online; city tax to each city. Mark paid on the Taxes tab.", "taxes", "deposit"); }
    let run = 0; for (let k = 0; k < 4; k++) { run += futa[k]; if (uia[k] > 0.005 && M >= (k + 1) * 3 && !S.deposits["uia" + k]) add(`dep-uia-${Y}-${k}`, dstr(new Date(Y, (k + 1) * 3, 25)), `Michigan UIA report and payment for Q${k + 1}`, "Upload the wage file from Tax filings in MiUI, then pay.", "filings", "deposit");
      if (run > 500 && M >= (k + 1) * 3 && !S.deposits["futa" + k]) { add(`dep-futa-${Y}-${k}`, dstr(new Date(Y, (k + 1) * 3, 30)), `Deposit ${usd(run)} FUTA (over $500 through Q${k + 1})`, "Pay on EFTPS.gov. Then mark done here.", "taxes", "deposit"); run = 0; } } }
  // filings, only for periods that actually had payroll
  const had = (y, k) => S.payQuarters.has(`${y}-Q${k + 1}`), hadYear = y => [0, 1, 2, 3].some(k => had(y, k));
  for (let k = 0; k < 4; k++) { const y = k === 3 ? Y - 1 : Y, qEnd = new Date(y, (k + 1) * 3, 0); if (qEnd > t || !had(y, k)) continue;
    add(`941-${y}-Q${k + 1}`, due941(y, k), `File Form 941 for Q${k + 1} ${y}`, "Build it under Tax filings, sign, mail. Mark done when sent.", "filings"); }
  if (hadYear(Y - 1)) { add(`w2-${Y - 1}`, `${Y}-01-31`, `W-2s and 1099s for ${Y - 1}`, "Give workers their copies and upload the SSA and IRIS files from Tax filings.", "filings");
    add(`940-${Y - 1}`, `${Y}-01-31`, `File Form 940 for ${Y - 1}`, "Build it under Tax filings, sign, mail.", "filings");
    add(`5081-${Y - 1}`, `${Y}-02-28`, `Michigan Form 5081 and city reconciliations for ${Y - 1}`, "Build under Tax filings. 5081 on Michigan Treasury Online; each city on its form.", "filings"); }
  // the owner's quarterly estimated payments, from the books (profit is taxed whether or not it is drawn)
  const ow = S.ownerTax || {};
  if (isOwner() && ow.filing && ow.type !== "other") { const est = (y, months) => { const rows = S.income.filter(x => x.on_date.startsWith(String(y))), inc = rows.reduce((a, x) => a + Number(x.amount), 0), exp = S.expenses.filter(x => x.on_date.startsWith(String(y)) && x.category !== "draw").reduce((a, x) => a + Number(x.amount), 0), pay = S.year === y ? S.checks.reduce((a, c) => a + Number(c.employer_cost), 0) : 0, profit = inc - exp - pay;
      return profit > 0 ? ownerTaxEstimate({ profit: profit * 12 / months, year: y, cfg: S.cfg, filing: ow.filing, homeCity: ow.homeCity, otherIncome: ow.otherIncome, otherWages: ow.otherWages, miExemptions: ow.miExemptions ?? 1, cityShares: incomeCityShares(rows) }) : null; };
    const detail = "Federal on IRS Direct Pay or EFTPS (Form 1040-ES), Michigan on Michigan Treasury Online (MI-1040ES). Books, Overview shows the breakdown; mark it paid there or here.";
    const cur = est(Y, M + 1); if (cur && cur.quarterly > 0) ownerEstDates(Y).slice(0, 3).forEach((d, k) => add(`est-${Y}-${k}`, d, `Owner's estimated tax payment ${k + 1} of 4 for ${Y}, about ${usd(cur.quarterly)}`, detail, "books", "deposit"));
    const prev = est(Y - 1, 12); if (prev && prev.quarterly > 0) add(`est-${Y - 1}-3`, ownerEstDates(Y - 1)[3], `Owner's estimated tax payment 4 of 4 for ${Y - 1}, about ${usd(prev.quarterly)}`, detail, "books", "deposit"); }
  if (M === 11) add(`tables-${Y + 1}`, `${Y}-12-31`, `Update tax tables for ${Y + 1}`, "New federal tables and the Michigan UIA rate notice arrive in December. Check Settings after the app updates.", "settings");
  return items.sort((a, b) => a.days - b.days);
}
/* Form 941 is due the last day of the month after the quarter ends. */
function due941(y, k) { const m = (k + 1) * 3; return m === 12 ? `${y + 1}-01-31` : dstr(lastDay(y, m)); }
function renderTodos() {
  const items = todoItems();
  if (!items.length) return "";
  return `<h3>To do</h3><ul class="list">${items.map(i => `<li><div class="rowbtn" style="display:flex;padding:12px 14px;gap:10px;align-items:center;flex-wrap:wrap"><span class="main"><b>${esc(i.title)}</b><small>${esc(i.detail)}${i.kind === "op" ? "" : ` Due ${esc(niceDate(i.due))}.`}</small></span>
    <span class="tag ${i.days < 0 ? "no" : i.days <= 7 ? "c" : ""}">${i.kind === "op" ? "Now" : i.days < 0 ? `${-i.days} day${i.days === -1 ? "" : "s"} late` : i.days === 0 ? "Due today" : `${i.days} day${i.days === 1 ? "" : "s"}`}</span>
    <button class="ghost" data-tab="${esc(i.tab)}" style="min-height:36px;padding:6px 10px">Open</button>${i.kind === "op" ? "" : `<button class="ghost" data-done="${esc(i.key)}" style="min-height:36px;padding:6px 10px">Done</button>`}</div></li>`).join("")}</ul>`;
}
function wireTodos() { document.querySelectorAll("[data-done]").forEach(b => b.onclick = async () => { const r = await sb.from("done_items").insert({ key: b.dataset.done, by_name: S.me.full_name || "" }); if (r.error) return fail(r.error); toast("Marked done"); refresh(); }); }
