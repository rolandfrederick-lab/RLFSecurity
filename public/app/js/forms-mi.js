/* ================= Michigan 5081 annual, MiUI quarterly wage file, city reconciliations ================= */
/* deposits: {miM: paid_on}. Line 18 has no fillable field on the state PDF, so it is drawn in place. */
async function build5081(year, rows, deposits) {
  const b = biz(), w2 = rows.filter(c => c.type === "W-2"), doc = await loadTemplate("mi5081"), f = filler(doc);
  const gross = sumKey(w2, "gross"), withheld = sumKey(w2, "state"), forms = new Set(rows.map(c => c.worker_id)).size;
  const byMonth = Array(12).fill(0); w2.forEach(c => byMonth[Number(c.pay_date.slice(5, 7)) - 1] += Number(c.state) || 0);
  const paid = Math.round(byMonth.reduce((a, v, i) => a + (deposits["mi" + i] ? v : 0), 0) * 100) / 100;
  f.text("Name", b.legalName); f.text("FEIN", fmtEin(b.ein)); f.text("Street Address", b.street); f.text("City", b.city); f.text("State", b.state); f.text("ZIP Code", b.zip);
  f.text("16b", money2(gross)); f.text("17", String(forms)); f.text("18b", money2(paid));   // the field named 18b sits on line 19a of the printed form
  const total = withheld, l20 = total, l21 = paid;
  f.text("20b", money2(l20)); f.text("21b", money2(l21));
  if (l21 > l20) { f.text("22b", money2(l21 - l20)); f.text("24b", money2(l21 - l20)); } else if (l20 > l21) { f.text("25b", money2(l20 - l21)); f.text("28b", money2(l20 - l21)); }
  f.text("PrintName", b.contactName); f.text("Title", b.title); f.text("Phone", b.phone); f.text("Date", niceDate(todayStr()));
  const out = await f.finish(), font = await out.embedFont(PDFLib.StandardFonts.Helvetica), p2 = out.getPages()[1];
  p2.drawText(money2(withheld), { x: 522, y: 523, size: 10, font });   // line 18: total Michigan income tax withheld
  return { doc: out, summary: { gross, withheld, forms, paid, balance: Math.max(0, withheld - paid), overpaid: Math.max(0, paid - withheld) } };
}

/* MiUI delimited quarterly wage report (Employer Header RE + Employee Detail RW rows). Validate with the MiUI file validator before uploading. */
function miuiDelimited(year, quarter, rows, details, ssns) {
  const b = biz(), yq = `${year}${String(quarter * 3).padStart(2, "0")}`, ean = (b.uiaAccount || "").replace(/\D/g, "").padStart(7, "0").slice(-7), clean = s => String(s || "").replace(/[,"\r\n]/g, " ").trim();
  const inQ = rows.filter(c => c.type === "W-2" && quarterOf(c.pay_date) === quarter), by = totalsByWorker(inQ), months = [0, 1, 2].map(i => (quarter - 1) * 3 + i);
  const lines = [["RE", yq, ean, clean(b.legalName).slice(0, 60), clean(b.street).slice(0, 45), "", clean(b.city).replace(/[^A-Za-z ]/g, "").slice(0, 35), b.state, (b.zip || "").slice(0, 5), "", "N", "N"].join(",")];
  Object.values(by).forEach(o => { const d = details[o.worker_id] || {}, worked = months.map(m => inQ.some(c => c.worker_id === o.worker_id && Number(c.pay_date.slice(5, 7)) - 1 === m) ? "1" : "0");
    lines.push(["RW", ean, "000", yq, ...worked, ssns[o.worker_id] || "", clean(d.legal_last || o.name.split(" ").slice(1).join(" ")).toUpperCase().slice(0, 30), clean(d.legal_first || o.name.split(" ")[0]).toUpperCase().slice(0, 15), clean(d.legal_middle || "").toUpperCase().slice(0, 30),
      String(Math.round(o.gross * 100)), "N", "N", "0", "0", "N", "", ""].join(",")); });
  return lines.join("\r\n") + "\r\n";
}

/* City income tax annual reconciliation summary, one page per city. Detroit is filed on Form 5321 through Michigan Treasury Online; other cities on their own CW-3 style forms. This page carries the numbers to key. */
async function buildCityRecon(year, rows, details, ssns) {
  const ctx = await newDrawnDoc(), b = biz(), by = totalsByWorker(rows.filter(c => c.type === "W-2")), cities = {};
  Object.values(by).forEach(o => Object.entries(o.cityDetail).forEach(([code, tax]) => { if (tax > 0) (cities[code] ||= []).push({ o, tax }); }));
  const codes = Object.keys(cities).sort(); if (!codes.length) return null;
  for (const code of codes) { const list = cities[code], pg = ctx.doc.addPage([612, 792]); let y = 740;
    drawText(pg, 36, y, `City of ${cityName(code)}, Employer's Annual Reconciliation of Income Tax Withheld, ${year}`, 13, ctx.bold); y -= 16;
    drawText(pg, 36, y, `${b.legalName}   EIN ${fmtEin(b.ein)}   ${bizAddr(b)}`, 9, ctx.font); y -= 14;
    drawText(pg, 36, y, code === "detroit" ? "File on Michigan Treasury Online (Form 5321). Attach W-2 data. Due February 28." : "File with the city income tax office on its annual reconciliation form (CW-3 or equivalent) with W-2 copies. Due February 28.", 8, ctx.font); y -= 24;
    [["Employee", 36], ["SSN", 220], ["Home city", 300], ["Wages", 400], ["Tax withheld", 480]].forEach(([t, x]) => drawText(pg, x, y, t, 8, ctx.bold)); y -= 4; pg.drawLine({ start: { x: 36, y }, end: { x: 576, y }, thickness: 0.6, color: PDFLib.rgb(0.55, 0.6, 0.68) }); y -= 14;
    let tw = 0, tt = 0; list.sort((a, c) => a.o.name.localeCompare(c.o.name)).forEach(({ o, tax }) => { const d = details[o.worker_id] || {}, w = S.workers.find(x => x.id === o.worker_id) || {};
      [[legalName(d, o.name).slice(0, 34), 36], [ssns[o.worker_id] ? fmtSsn(ssns[o.worker_id]) : "***-**-" + (d.ssn_last4 || "????"), 220], [cityName(w.home_city || "none"), 300], [money2(o.gross), 400], [money2(tax), 480]].forEach(([t, x]) => drawText(pg, x, y, t, 8, ctx.font));
      tw += o.gross; tt += tax; y -= 13; if (y < 80) { y = 740; } });
    y -= 6; pg.drawLine({ start: { x: 36, y }, end: { x: 576, y }, thickness: 0.6, color: PDFLib.rgb(0.55, 0.6, 0.68) }); y -= 14;
    drawText(pg, 36, y, `Totals: ${list.length} employee${list.length === 1 ? "" : "s"}`, 9, ctx.bold); drawText(pg, 400, y, money2(tw), 9, ctx.bold); drawText(pg, 480, y, money2(tt), 9, ctx.bold);
    drawText(pg, 36, 60, `Rates used: resident ${CITY_TABLE[code][1] * 100}%, nonresident ${CITY_TABLE[code][2] * 100}%, $${CITY_EXEMPTION} per exemption. Prepared ${niceDate(todayStr())}.`, 7, ctx.font); }
  return ctx.doc;
}
