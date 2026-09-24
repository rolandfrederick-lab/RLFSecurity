/* ================= Form 941 (quarterly) and Form 940 (annual) on the official IRS PDFs ================= */
const P1 = n => `topmostSubform[0].Page1[0].f1_${n}[0]`, P2 = n => `topmostSubform[0].Page2[0].f2_${n}[0]`;
const H1 = n => `topmostSubform[0].Page1[0].Header[0].EntityArea[0].f1_${n}[0]`;

function fillHeader941(f, b) {
  f.text(H1(1), ein2(b)); f.text(H1(2), ein7(b)); f.text(H1(3), b.legalName); f.text(H1(4), b.tradeName); f.text(H1(5), b.street); f.text(H1(6), b.city); f.text(H1(7), b.state); f.text(H1(8), b.zip);
}
/* rows: this quarter's paychecks. deposits: {fedM: paid_on}. schedule: monthly | semiweekly. */
async function build941(year, quarter, rows, deposits, schedule) {
  const b = biz(), w2 = rows.filter(c => c.type === "W-2"), doc = await loadTemplate("f941"), f = filler(doc);
  fillHeader941(f, b); f.check(`topmostSubform[0].Page1[0].Header[0].ReportForQuarter[0].c1_1[${quarter - 1}]`);
  const months = [0, 1, 2].map(i => (quarter - 1) * 3 + i), liab = monthlyLiability(w2);
  const inQ = w2.filter(c => months.includes(Number(c.pay_date.slice(5, 7)) - 1));
  const employees = new Set(inQ.map(c => c.worker_id)).size, wages = sumKey(inQ, "gross"), fed = sumKey(inQ, "fed"), ssW = sumKey(inQ, "ss_wages"), medW = sumKey(inQ, "med_wages");
  const byW = totalsByWorker(inQ); let addlW = 0; Object.values(byW).forEach(o => { if (o.med_wages > 200000) addlW += o.med_wages - 200000; });   // close enough for a small employer; the true test is year-to-date over $200,000
  const c5a = Math.round(ssW * 0.124 * 100) / 100, c5c = Math.round(medW * 0.029 * 100) / 100, c5d = Math.round(addlW * 0.009 * 100) / 100, l5e = Math.round((c5a + c5c + c5d) * 100) / 100;
  const actual = Math.round(inQ.reduce((a, c) => a + Number(c.ss) + Number(c.med) + Number(c.er_ss) + Number(c.er_med), 0) * 100) / 100;
  const l6 = Math.round((fed + l5e) * 100) / 100, l7 = Math.round((actual - l5e) * 100) / 100, l10 = Math.round((l6 + l7) * 100) / 100, l12 = l10;
  const l13 = Math.round(months.reduce((a, m) => a + (deposits["fed" + m] ? liab[m] : 0), 0) * 100) / 100;
  f.text(P1(12), String(employees)); f.money(P1(13), P1(14), wages); f.money(P1(15), P1(16), fed);
  if (!ssW && !medW) f.check("topmostSubform[0].Page1[0].c1_3[0]");
  f.money(P1(17), P1(18), ssW); f.money(P1(19), P1(20), c5a); f.money(P1(25), P1(26), medW); f.money(P1(27), P1(28), c5c);
  if (addlW) { f.money(P1(29), P1(30), addlW); f.money(P1(31), P1(32), c5d); }
  f.money(P1(33), P1(34), l5e); f.money(P1(37), P1(38), l6); if (l7) f.money(P1(39), P1(40), l7); f.money(P1(45), P1(46), l10); f.money(P1(49), P1(50), l12); f.money(P1(51), P1(52), l13);
  if (l12 > l13) f.money(P1(53), P1(54), l12 - l13); else if (l13 > l12) { f.money(P1(55), P1(56), l13 - l12); f.check("topmostSubform[0].Page1[0].c1_4[0]"); }
  // Page 2: liability schedule
  f.text("topmostSubform[0].Page2[0].Name_ReadOrder[0].f1_3[0]", b.legalName); f.text("topmostSubform[0].Page2[0].EIN_Number[0].f1_1[0]", ein2(b)); f.text("topmostSubform[0].Page2[0].EIN_Number[0].f1_2[0]", ein7(b));
  if (l12 < 2500) f.check("topmostSubform[0].Page2[0].c2_1[0]");
  else if (schedule === "semiweekly") f.check("topmostSubform[0].Page2[0].c2_1[2]");
  else { f.check("topmostSubform[0].Page2[0].c2_1[1]"); f.money(P2(1), P2(2), liab[months[0]]); f.money(P2(3), P2(4), liab[months[1]]); f.money(P2(5), P2(6), liab[months[2]]); f.money(P2(7), P2(8), liab[months[0]] + liab[months[1]] + liab[months[2]]); }
  f.check("topmostSubform[0].Page2[0].c2_4[1]"); f.text(P2(13), b.contactName); f.text(P2(14), b.title); f.text(P2(15), b.phone);
  // Page 3: payment voucher, only meaningful when there is a balance
  if (l12 > l13) { f.text("topmostSubform[0].Page3[0].EIN_Number[0].f1_1[0]", ein2(b)); f.text("topmostSubform[0].Page3[0].EIN_Number[0].f1_2[0]", ein7(b)); f.money("topmostSubform[0].Page3[0].f4_2[0]", "topmostSubform[0].Page3[0].f4_3[0]", l12 - l13);
    f.check(`topmostSubform[0].Page3[0].Line3_ReadOrder[0].c4_1[${quarter - 1}]`); f.text("topmostSubform[0].Page3[0].f1_3[0]", b.legalName); f.text("topmostSubform[0].Page3[0].f4_5[0]", b.street); f.text("topmostSubform[0].Page3[0].f4_6[0]", `${b.city}, ${b.state} ${b.zip}`); }
  const summary = { employees, wages, fed, ssW, medW, l5e, l7, l12, l13, balance: Math.max(0, l12 - l13), overpaid: Math.max(0, l13 - l12), liab: months.map(m => liab[m]) };
  return { doc: await f.finish(), summary };
}

/* rows: the whole year's paychecks. futaDeposited: dollars already deposited through EFTPS. */
async function build940(year, rows, futaDeposited) {
  const b = biz(), w2 = rows.filter(c => c.type === "W-2"), doc = await loadTemplate("f940"), f = filler(doc), Q = n => `Page1[0].EntityArea[0].f1_${n}[0]`, L = n => `Page1[0].f1_${n}[0]`;
  const T = "topmostSubform[0].";
  f.text(T + Q(1), ein2(b)); f.text(T + Q(2), ein7(b)); f.text(T + Q(3), b.legalName); f.text(T + Q(4), b.tradeName); f.text(T + Q(5), b.street); f.text(T + Q(6), b.city); f.text(T + Q(7), b.state); f.text(T + Q(8), b.zip);
  f.text(T + L(12), "M"); f.text(T + L(13), "I");
  const total = sumKey(w2, "gross"), byW = totalsByWorker(w2); let excess = 0; Object.values(byW).forEach(o => excess += Math.max(0, o.gross - 7000)); excess = Math.round(excess * 100) / 100;
  const l6 = excess, l7 = Math.round((total - l6) * 100) / 100, l8 = Math.round(l7 * 0.006 * 100) / 100, l12 = l8, l13 = Math.round((Number(futaDeposited) || 0) * 100) / 100;
  f.money(T + L(14), T + L(15), total); if (excess) f.money(T + L(18), T + L(19), excess); f.money(T + L(20), T + L(21), l6); f.money(T + L(22), T + L(23), l7); f.money(T + L(24), T + L(25), l8);
  f.money(T + L(32), T + L(33), l12); f.money(T + L(34), T + L(35), l13);
  if (l12 > l13) f.money(T + L(36), T + L(37), l12 - l13); else if (l13 > l12) { f.money(T + L(48), T + L(49), l13 - l12); f.check(T + "Page1[0].c1_2[0]"); }
  f.text(T + "Page2[0].f1_3[0]", b.legalName); f.text(T + "Page2[0].f1_1[0]", ein2(b)); f.text(T + "Page2[0].f1_2[0]", ein7(b));
  if (l12 > 500) { const qs = [0, 0, 0, 0]; w2.forEach(c => qs[quarterOf(c.pay_date) - 1] += Number(c.futa) || 0); const P = n => T + `Page2[0].f2_${n}[0]`;
    f.money(P(1), P(2), qs[0]); f.money(P(3), P(4), qs[1]); f.money(P(5), P(6), qs[2]); f.money(P(7), P(8), qs[3]); f.money(P(9), P(10), qs.reduce((a, x) => a + x, 0)); }
  f.check(T + "Page2[0].c2_1[1]"); f.text(T + "Page2[0].f2_14[0]", b.contactName); f.text(T + "Page2[0].f2_15[0]", b.title); f.text(T + "Page2[0].f2_16[0]", b.phone);
  return { doc: await f.finish(), summary: { total, excess, taxable: l7, tax: l8, deposited: l13, balance: Math.max(0, l12 - l13) } };
}
