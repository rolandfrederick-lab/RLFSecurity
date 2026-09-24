/* ================= contractor payment statement (PDF) ================= */
/* One page per payment: the invoices it covered, totals, and the year-to-date figure that becomes the 1099-NEC. */
async function buildStatementPdf(check, invoices, ytd) {
  const ctx = await newDrawnDoc(), b = biz(), pg = ctx.doc.addPage([612, 792]); let y = 740;
  const line = (x, t, size, font) => drawText(pg, x, y, t, size || 9, font || ctx.font);
  line(36, "Contractor payment statement", 16, ctx.bold); y -= 18;
  line(36, `${b.legalName || S.cfg.businessName || "Payer"}${b.ein ? ", EIN " + fmtEin(b.ein) : ""}`, 9); y -= 12; if (b.street) { line(36, bizAddr(b), 9); y -= 12; }
  y -= 8; line(36, `Paid to: ${check.worker_name}`, 10, ctx.bold); y -= 13; line(36, `Payment date: ${niceDate(check.pay_date)}${check.period_start ? `.  Work from ${niceDate(check.period_start)} to ${niceDate(check.period_end)}.` : ""}`, 9); y -= 22;
  [["Date", 36], ["Site", 110], ["Detail", 260], ["Amount", 500]].forEach(([t, x]) => line(x, t, 8, ctx.bold)); y -= 4; pg.drawLine({ start: { x: 36, y }, end: { x: 576, y }, thickness: 0.6, color: PDFLib.rgb(0.55, 0.6, 0.68) }); y -= 13;
  let sum = 0;
  invoices.forEach(i => { const rows = []; if (Number(i.hours)) rows.push([`${h2(i.hours)} h at ${usd(i.rate)}`, num(i.hours) * num(i.rate)]); (i.extras || []).forEach(e => rows.push([e.desc, num(e.amount)]));
    rows.forEach((r, k) => { if (k === 0) { line(36, niceDate(i.on_date), 8); line(110, siteName(i.site_id).slice(0, 30), 8); } line(260, String(r[0]).slice(0, 48), 8); line(500, money2(r[1]), 8); y -= 12; if (y < 120) { y = 740; } });
    sum += Number(i.total); });
  if (!invoices.length) { line(36, `Contractor payment`, 8); line(260, "Amount entered on the Pay tab", 8); line(500, money2(check.gross), 8); y -= 12; sum = Number(check.gross); }
  if (Number(check.other_ded)) { line(260, "Less deductions", 8); line(500, "-" + money2(check.other_ded), 8); y -= 12; }
  y -= 4; pg.drawLine({ start: { x: 36, y }, end: { x: 576, y }, thickness: 0.6, color: PDFLib.rgb(0.55, 0.6, 0.68) }); y -= 15;
  line(260, "Total paid", 10, ctx.bold); line(500, money2(check.net), 10, ctx.bold); y -= 14;
  line(260, `Paid to this contractor in ${check.year} to date`, 8); line(500, money2(ytd), 8); y -= 28;
  wrap("No income tax, Social Security or Medicare was withheld from this payment. The contractor is responsible for their own income and self-employment taxes. Total payments of $2,000 or more in a calendar year are reported to the IRS on Form 1099-NEC, with a copy to the contractor by January 31.", 125).forEach(t => { line(36, t, 7.5); y -= 10; });
  line(36, `Prepared ${niceDate(todayStr())} with ${S.cfg.businessName || b.legalName || "the payroll app"}.`, 7);
  return ctx.doc;
}
async function downloadStatement(check) {
  try { const inv = await q(sb.from("invoices").select("*").eq("paycheck_id", check.id).order("on_date"));
    const ytd = (await q(sb.from("paychecks").select("net,pay_date,created_at").eq("worker_id", check.worker_id).eq("year", check.year))).filter(c => c.pay_date < check.pay_date || (c.pay_date === check.pay_date && c.created_at <= check.created_at)).reduce((a, c) => a + Number(c.net), 0);
    await savePdf(await buildStatementPdf(check, inv, Math.round(ytd * 100) / 100), `payment-${check.worker_name.replace(/[^a-z0-9]+/gi, "-")}-${check.pay_date}.pdf`); } catch (e) { fail(e); }
}
