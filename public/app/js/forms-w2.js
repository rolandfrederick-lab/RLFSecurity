/* ================= W-2 copies, SSA EFW2 file, 1099-NEC copies, IRIS CSV ================= */
/* One W-2 record per employee for the year. localities: up to two cities with tax. */
function w2Records(rows, details, ssns) {
  return Object.values(totalsByWorker(rows.filter(c => c.type === "W-2"))).map(o => { const d = details[o.worker_id] || {}, cities = Object.entries(o.cityDetail).filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]).slice(0, 2);
    return { ...o, ssn: ssns[o.worker_id] || "", ssnShown: ssns[o.worker_id] ? fmtSsn(ssns[o.worker_id]) : (d.ssn_last4 ? "***-**-" + d.ssn_last4 : "MISSING"), legal: legalName(d, o.name), first: d.legal_first || o.name.split(" ")[0], middle: d.legal_middle || "", last: d.legal_last || o.name.split(" ").slice(1).join(" "),
      street: [d.street, d.street2].filter(Boolean).join(", "), city: d.city || "", addrState: d.state || "MI", zip: d.zip || "", localities: cities.map(([code, tax]) => ({ code, name: cityName(code), tax: Math.round(tax * 100) / 100, wages: o.gross })) }; });
}
/* Substitute W-2, three copies per employee (B, C, 2) on one page each, per IRS Pub. 1141 substitute rules. */
async function buildW2Pdf(recs, year) {
  const ctx = await newDrawnDoc(), b = biz();
  for (const r of recs) for (const copy of [["B", "To Be Filed With Employee's FEDERAL Tax Return"], ["C", "For EMPLOYEE'S RECORDS (See Notice to Employee)"], ["2", "To Be Filed With Employee's State, City, or Local Income Tax Return"]]) {
    const pg = ctx.doc.addPage([612, 792]), X = 36, Y = 720;
    drawText(pg, X, Y + 30, `Form W-2 Wage and Tax Statement ${year}`, 14, ctx.bold); drawText(pg, X, Y + 16, `Copy ${copy[0]}: ${copy[1]}`, 8, ctx.font); drawText(pg, 400, Y + 30, "OMB No. 1545-0008", 7, ctx.font);
    drawText(pg, 400, Y + 20, "Substitute form. Department of the Treasury, Internal Revenue Service.", 6, ctx.font);
    drawBox(ctx, pg, X, Y - 30, 170, 30, "a  Employee's social security number", r.ssnShown, { bold: true }); drawBox(ctx, pg, X + 170, Y - 30, 170, 30, "b  Employer identification number (EIN)", fmtEin(b.ein));
    drawBox(ctx, pg, X + 340, Y - 30, 100, 30, "1  Wages, tips, other compensation", money2(r.gross)); drawBox(ctx, pg, X + 440, Y - 30, 100, 30, "2  Federal income tax withheld", money2(r.fed));
    drawBox(ctx, pg, X, Y - 90, 340, 60, "c  Employer's name, address, and ZIP code", ""); [b.legalName, b.street, `${b.city}, ${b.state} ${b.zip}`].forEach((t, i) => drawText(pg, X + 3, Y - 50 - i * 11, t, 9, ctx.font));
    drawBox(ctx, pg, X + 340, Y - 60, 100, 30, "3  Social security wages", money2(r.ss_wages)); drawBox(ctx, pg, X + 440, Y - 60, 100, 30, "4  Social security tax withheld", money2(r.ss));
    drawBox(ctx, pg, X + 340, Y - 90, 100, 30, "5  Medicare wages and tips", money2(r.med_wages)); drawBox(ctx, pg, X + 440, Y - 90, 100, 30, "6  Medicare tax withheld", money2(r.med));
    drawBox(ctx, pg, X, Y - 120, 340, 30, "d  Control number", ""); drawBox(ctx, pg, X + 340, Y - 120, 100, 30, "7  Social security tips", "0.00"); drawBox(ctx, pg, X + 440, Y - 120, 100, 30, "8  Allocated tips", "0.00");
    drawBox(ctx, pg, X, Y - 180, 340, 60, "e  Employee's first name and initial, last name    f  Employee's address and ZIP code", ""); [r.legal, r.street, `${r.city}, ${r.addrState} ${r.zip}`].forEach((t, i) => drawText(pg, X + 3, Y - 140 - i * 11, t, 9, ctx.font));
    drawBox(ctx, pg, X + 340, Y - 150, 100, 30, "9", ""); drawBox(ctx, pg, X + 440, Y - 150, 100, 30, "10  Dependent care benefits", "");
    drawBox(ctx, pg, X + 340, Y - 180, 100, 30, "11  Nonqualified plans", ""); drawBox(ctx, pg, X + 440, Y - 180, 100, 30, "12a  See instructions for box 12", "");
    drawBox(ctx, pg, X, Y - 210, 170, 30, "13  Statutory employee / Retirement plan / Third-party sick pay", "[ ]  [ ]  [ ]"); drawBox(ctx, pg, X + 170, Y - 210, 170, 30, "14  Other", ""); drawBox(ctx, pg, X + 340, Y - 210, 100, 30, "12b", ""); drawBox(ctx, pg, X + 440, Y - 210, 100, 30, "12c", "");
    drawBox(ctx, pg, X, Y - 240, 60, 30, "15  State", "MI"); drawBox(ctx, pg, X + 60, Y - 240, 140, 30, "Employer's state ID number", fmtEin(b.ein)); drawBox(ctx, pg, X + 200, Y - 240, 100, 30, "16  State wages, tips, etc.", money2(r.gross)); drawBox(ctx, pg, X + 300, Y - 240, 100, 30, "17  State income tax", money2(r.state));
    r.localities.forEach((l, i) => { const y = Y - 270 - i * 30; drawBox(ctx, pg, X, y, 200, 30, "18  Local wages, tips, etc.", money2(l.wages)); drawBox(ctx, pg, X + 200, y, 100, 30, "19  Local income tax", money2(l.tax)); drawBox(ctx, pg, X + 300, y, 240, 30, "20  Locality name", l.name.toUpperCase()); });
    if (!r.localities.length) { drawBox(ctx, pg, X, Y - 270, 200, 30, "18  Local wages, tips, etc.", ""); drawBox(ctx, pg, X + 200, Y - 270, 100, 30, "19  Local income tax", ""); drawBox(ctx, pg, X + 300, Y - 270, 240, 30, "20  Locality name", ""); }
    wrap(copy[0] === "B" ? "Notice to Employee: This information is being furnished to the Internal Revenue Service. If you are required to file a tax return, a negligence penalty or other sanction may be imposed on you if this income is taxable and you fail to report it. Attach Copy B to your federal return." : copy[0] === "C" ? "Keep this copy for your records. Wages shown in box 1 are before any payroll deductions. Box 3 shows Social Security wages up to the annual wage base. Box 5 shows Medicare wages." : "Attach Copy 2 to your Michigan income tax return and, if applicable, your city income tax return.", 120).forEach((t, i) => drawText(pg, X, Y - 360 - i * 10, t, 7, ctx.font));
    drawText(pg, X, 40, `Prepared with ${S.cfg.businessName || b.legalName} payroll on ${niceDate(todayStr())}.`, 7, ctx.font);
  }
  return ctx.doc;
}

/* SSA EFW2 (Pub. 42-007) file: RA, RE, RW and RS (Michigan) records, RT, RF. Every record is 512 characters. Test it with SSA AccuWage Online before uploading. */
function efw2(recs, year) {
  const b = biz(), A = (s, n) => String(s ?? "").toUpperCase().replace(/[^A-Z0-9 .,'&/#-]/g, "").slice(0, n).padEnd(n, " "), N = (v, n) => String(Math.round((Number(v) || 0) * 100)).padStart(n, "0").slice(-n), D = (s, n) => String(s || "").replace(/\D/g, "").slice(0, n).padEnd(n, " ");
  const rec = parts => { let s = ""; parts.forEach(([pos, val]) => { s = s.padEnd(pos - 1, " ") + val; }); return s.padEnd(512, " ").slice(0, 512); };
  const lines = [];
  lines.push(rec([[1, "RA"], [3, D(b.ein, 9)], [12, A(b.bsoUserId, 8)], [29, "0"], [38, A(b.legalName, 57)], [117, A(b.street, 22)], [139, A(b.city, 22)], [161, A(b.state, 2)], [163, D(b.zip, 5)], [217, A(b.legalName, 57)], [296, A(b.street, 22)], [318, A(b.city, 22)], [340, A(b.state, 2)], [342, D(b.zip, 5)], [396, A(b.contactName, 27)], [423, D(b.phone, 15)], [446, A(b.email, 40).toLowerCase()], [500, "L"]]));
  lines.push(rec([[1, "RE"], [3, String(year)], [8, D(b.ein, 9)], [40, A(b.legalName, 57)], [119, A(b.street, 22)], [141, A(b.city, 22)], [163, A(b.state, 2)], [165, D(b.zip, 5)], [174, "N"], [219, "R"], [222, A(b.contactName, 27)], [249, D(b.phone, 15)], [279, A(b.email, 40).toLowerCase()]]));
  const t = { n: 0, gross: 0, fed: 0, ssw: 0, ss: 0, medw: 0, med: 0 };
  recs.forEach(r => { t.n++; t.gross += r.gross; t.fed += r.fed; t.ssw += r.ss_wages; t.ss += r.ss; t.medw += r.med_wages; t.med += r.med;
    lines.push(rec([[1, "RW"], [3, D(r.ssn || "000000000", 9)], [12, A(r.first, 15)], [27, A(r.middle, 15)], [42, A(r.last, 20)], [88, A(r.street, 22)], [110, A(r.city, 22)], [132, A(r.addrState, 2)], [134, D(r.zip, 5)], [188, N(r.gross, 11)], [199, N(r.fed, 11)], [210, N(r.ss_wages, 11)], [221, N(r.ss, 11)], [232, N(r.med_wages, 11)], [243, N(r.med, 11)], [486, "0"], [488, "0"], [489, "0"]]));
    const loc = r.localities[0];
    lines.push(rec([[1, "RS"], [3, "26"], [10, D(r.ssn || "000000000", 9)], [19, A(r.first, 15)], [34, A(r.middle, 15)], [49, A(r.last, 20)], [95, A(r.street, 22)], [117, A(r.city, 22)], [139, A(r.addrState, 2)], [141, D(r.zip, 5)], [248, D(b.ein, 20)], [274, "26"], [276, N(r.gross, 11)], [287, N(r.state, 11)], [308, loc ? "C" : " "], [309, loc ? N(loc.wages, 11) : N(0, 11)], [320, loc ? N(loc.tax, 11) : N(0, 11)], [338, loc ? A(loc.name, 75) : A("", 75)]])); });
  lines.push(rec([[1, "RT"], [3, String(t.n).padStart(7, "0")], [10, N(t.gross, 15)], [25, N(t.fed, 15)], [40, N(t.ssw, 15)], [55, N(t.ss, 15)], [70, N(t.medw, 15)], [85, N(t.med, 15)]]));
  lines.push(rec([[1, "RF"], [8, String(t.n).padStart(9, "0")]]));
  return lines.join("\r\n") + "\r\n";
}

/* 1099-NEC recipient copies and the IRIS bulk-upload CSV. */
function necRecords(rows, details, ssns, threshold) {
  return Object.values(totalsByWorker(rows.filter(c => c.type === "1099"))).filter(o => o.gross >= threshold).map(o => { const d = details[o.worker_id] || {};
    return { ...o, ssn: ssns[o.worker_id] || "", ssnShown: ssns[o.worker_id] ? fmtSsn(ssns[o.worker_id]) : (d.ssn_last4 ? "***-**-" + d.ssn_last4 : "MISSING"), legal: legalName(d, o.name), street: [d.street, d.street2].filter(Boolean).join(", "), city: d.city || "", addrState: d.state || "MI", zip: d.zip || "" }; });
}
async function build1099Pdf(recs, year) {
  const ctx = await newDrawnDoc(), b = biz();
  for (const r of recs) for (const copy of [["B", "For Recipient"], ["2", "To be filed with recipient's state income tax return, when required"]]) {
    const pg = ctx.doc.addPage([612, 792]), X = 36, Y = 720;
    drawText(pg, X, Y + 30, `Form 1099-NEC Nonemployee Compensation ${year}`, 14, ctx.bold); drawText(pg, X, Y + 16, `Copy ${copy[0]}: ${copy[1]}`, 8, ctx.font); drawText(pg, 400, Y + 30, "OMB No. 1545-0116", 7, ctx.font);
    drawBox(ctx, pg, X, Y - 70, 300, 70, "PAYER'S name, street address, city or town, state, ZIP code, and telephone no.", ""); [b.legalName, b.street, `${b.city}, ${b.state} ${b.zip}`, b.phone].forEach((t, i) => drawText(pg, X + 3, Y - 24 - i * 11, t, 9, ctx.font));
    drawBox(ctx, pg, X + 300, Y - 35, 240, 35, "1  Nonemployee compensation", money2(r.gross), { bold: true }); drawBox(ctx, pg, X + 300, Y - 70, 240, 35, "4  Federal income tax withheld", "0.00");
    drawBox(ctx, pg, X, Y - 100, 150, 30, "PAYER'S TIN", fmtEin(b.ein)); drawBox(ctx, pg, X + 150, Y - 100, 150, 30, "RECIPIENT'S TIN", r.ssnShown);
    drawBox(ctx, pg, X, Y - 170, 300, 70, "RECIPIENT'S name, street address, city or town, state, and ZIP code", ""); [r.legal, r.street, `${r.city}, ${r.addrState} ${r.zip}`].forEach((t, i) => drawText(pg, X + 3, Y - 124 - i * 11, t, 9, ctx.font));
    drawBox(ctx, pg, X + 300, Y - 100, 240, 30, "2  Payer made direct sales totaling $5,000 or more", "[ ]"); drawBox(ctx, pg, X + 300, Y - 170, 80, 30, "5  State tax withheld", ""); drawBox(ctx, pg, X + 380, Y - 170, 80, 30, "6  State/Payer's state no.", "MI"); drawBox(ctx, pg, X + 460, Y - 170, 80, 30, "7  State income", money2(r.gross));
    wrap("Instructions for Recipient: You received this form instead of Form W-2 because the payer did not consider you an employee and did not withhold income tax or social security and Medicare tax. If you believe you are an employee and cannot get the payer to correct this form, report the amount shown in box 1 on the line for wages and, if applicable, complete Form 8919. Otherwise report the box 1 amount as self-employment income on Schedule C and Schedule SE.", 120).forEach((t, i) => drawText(pg, X, Y - 200 - i * 10, t, 7, ctx.font));
  }
  return ctx.doc;
}
/* Comma-separated file laid out like the IRIS 1099-NEC template. Open it next to the template downloaded from IRIS and match the column order before uploading. */
function irisCsv(recs, year) {
  const b = biz(), qq = v => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const head = ["Tax Year", "Payer TIN", "Payer TIN Type", "Payer Name Line 1", "Payer Address Line 1", "Payer City", "Payer State", "Payer ZIP", "Payer Phone", "Recipient TIN", "Recipient TIN Type", "Recipient Name Line 1", "Recipient Address Line 1", "Recipient City", "Recipient State", "Recipient ZIP", "Box 1 Nonemployee Compensation", "Box 4 Federal Income Tax Withheld", "State", "State Income"];
  const rows = recs.map(r => [year, b.ein, "EIN", b.legalName, b.street, b.city, b.state, b.zip, b.phone.replace(/\D/g, ""), r.ssn, "SSN", r.legal, r.street, r.city, r.addrState, r.zip, money2(r.gross), "0.00", "MI", money2(r.gross)]);
  return [head, ...rows].map(x => x.map(qq).join(",")).join("\r\n") + "\r\n";
}
