/* ================= PDF helpers (pdf-lib) and shared filing data ================= */
const biz = () => ({ legalName: "", tradeName: "", ein: "", street: "", city: "", state: "MI", zip: "", contactName: "", title: "", phone: "", email: "", uiaAccount: "", bsoUserId: "", ...(S.cfg.business || {}) });
const money2 = n => (Math.round((Number(n) || 0) * 100) / 100).toFixed(2);
const dollars = n => String(Math.floor(Math.round((Number(n) || 0) * 100) / 100));
const cents = n => String(Math.round((Number(n) || 0) * 100) % 100).padStart(2, "0");
const ein2 = b => (b.ein || "").slice(0, 2), ein7 = b => (b.ein || "").slice(2, 9);
const fmtEin = e => e && e.length === 9 ? e.slice(0, 2) + "-" + e.slice(2) : e || "";
const fmtSsn = s => s && s.length === 9 ? s.slice(0, 3) + "-" + s.slice(3, 5) + "-" + s.slice(5) : s || "";
const bizAddr = b => `${b.street}, ${b.city}, ${b.state} ${b.zip}`.replace(/^, |, ,/g, "");

async function loadTemplate(name) {
  const r = await fetch(`forms/${name}.pdf`); if (!r.ok) throw new Error(`Could not load the ${name} form template.`);
  const doc = await PDFLib.PDFDocument.load(await r.arrayBuffer(), { ignoreEncryption: true });
  const acro = doc.catalog.lookup(PDFLib.PDFName.of("AcroForm")); if (acro) acro.delete(PDFLib.PDFName.of("XFA"));   // IRS forms carry XFA; drop it so viewers show our values
  return doc;
}
/* Fill by field name. Missing fields are skipped so a form revision does not break the whole run; they are listed in the console. */
function filler(doc) {
  const form = doc.getForm(), missing = [];
  const f = {
    text(name, value) { if (value == null || value === "") return; try { const t = form.getTextField(name); t.setText(String(value)); } catch (e) { missing.push(name); } },
    money(nameDollars, nameCents, value) { if (!(Number(value) > 0) && Number(value) !== 0) return; f.text(nameDollars, dollars(value)); f.text(nameCents, cents(value)); },
    check(name) { try { form.getCheckBox(name).check(); } catch (e) { missing.push(name); } },
    async finish() { const font = await doc.embedFont(PDFLib.StandardFonts.Helvetica); try { form.updateFieldAppearances(font); } catch (e) {} if (missing.length) console.warn("Fields not found:", missing); return doc; }
  };
  return f;
}
async function savePdf(doc, filename) { const bytes = await doc.save(); downloadBytes(filename, "application/pdf", bytes); }
function downloadBytes(name, type, bytes) { const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([bytes], { type })); a.download = name; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 800); }

/* Drawn documents (W-2 copies, 1099 copies, city summaries). Letter size, points from the bottom-left. */
async function newDrawnDoc() { const doc = await PDFLib.PDFDocument.create(); const font = await doc.embedFont(PDFLib.StandardFonts.Helvetica), bold = await doc.embedFont(PDFLib.StandardFonts.HelveticaBold); return { doc, font, bold }; }
function drawText(page, x, y, text, size, font, color) { page.drawText(String(text ?? ""), { x, y, size, font, color: color || PDFLib.rgb(0.08, 0.13, 0.24) }); }
function drawBox(ctx, page, x, y, w, h, label, value, opts = {}) {
  page.drawRectangle({ x, y, width: w, height: h, borderColor: PDFLib.rgb(0.55, 0.6, 0.68), borderWidth: 0.6 });
  drawText(page, x + 3, y + h - 8, label, 5.5, ctx.font, PDFLib.rgb(0.36, 0.4, 0.47));
  drawText(page, x + 3, y + 4, value, opts.size || 9, opts.bold ? ctx.bold : ctx.font);
}
const wrap = (s, n) => { const out = [], words = String(s || "").split(/\s+/); let line = ""; words.forEach(w => { if ((line + " " + w).trim().length > n) { out.push(line.trim()); line = w; } else line += " " + w; }); if (line.trim()) out.push(line.trim()); return out; };

/* ---------- data for a filing year ---------- */
const quarterOf = ymdStr => Math.floor((Number(ymdStr.slice(5, 7)) - 1) / 3) + 1;
async function loadYearChecks(year) { return q(sb.from("paychecks").select("*").eq("year", year).order("pay_date")); }
async function loadDeposits(year) { const d = await q(sb.from("deposits").select("*").eq("year", year)); const m = {}; d.forEach(x => m[x.key] = x.paid_on); return m; }
/* Per-worker totals for a set of paychecks. */
function totalsByWorker(rows) {
  const by = {};
  rows.forEach(c => { const o = by[c.worker_id] ||= { worker_id: c.worker_id, name: c.worker_name, type: c.type, gross: 0, fed: 0, ss: 0, ss_wages: 0, med: 0, med_wages: 0, state: 0, city: 0, cityDetail: {}, futa: 0, suta: 0, checks: 0 };
    ["gross", "fed", "ss", "ss_wages", "med", "med_wages", "state", "city", "futa", "suta"].forEach(k => o[k] += Number(c[k]) || 0); o.checks++;
    Object.entries(c.city_detail || {}).forEach(([k, v]) => o.cityDetail[k] = (o.cityDetail[k] || 0) + Number(v)); });
  Object.values(by).forEach(o => ["gross", "fed", "ss", "ss_wages", "med", "med_wages", "state", "city", "futa", "suta"].forEach(k => o[k] = Math.round(o[k] * 100) / 100));
  return by;
}
const sumKey = (rows, k) => Math.round(rows.reduce((a, c) => a + (Number(c[k]) || 0), 0) * 100) / 100;
/* Monthly 941 liability (employee withholding plus both halves of Social Security and Medicare) by pay-date month, 0-based. */
function monthlyLiability(rows) { const m = Array(12).fill(0); rows.filter(c => c.type === "W-2").forEach(c => m[Number(c.pay_date.slice(5, 7)) - 1] += Number(c.fed941) || 0); return m.map(x => Math.round(x * 100) / 100); }
/* Federal deposit schedule for a year: lookback is July 1 two years back to June 30 last year. Over $50,000 means semiweekly. */
async function depositSchedule(year) {
  const rows = await q(sb.from("paychecks").select("fed941,pay_date").gte("pay_date", `${year - 2}-07-01`).lte("pay_date", `${year - 1}-06-30`));
  const total = sumKey(rows, "fed941"); return { lookback: total, schedule: total > 50000 ? "semiweekly" : "monthly" };
}
/* Identity for every worker who appears in the rows. SSNs only for owners and administrators. */
async function loadIdentities(workerIds, purpose) {
  const out = {}; for (const id of workerIds) { try { out[id] = await q(sb.rpc("worker_details", { p_worker: id })); } catch (e) { out[id] = {}; } }
  let ssns = {}; if (S.me.role === "owner" || S.me.is_admin) { try { (await q(sb.rpc("get_all_ssns", { p_purpose: purpose }))).forEach(r => ssns[r.worker_id] = r.ssn); } catch (e) { toast(e.message); } }
  return { details: out, ssns };
}
const legalName = (d, fallback) => d && d.legal_last ? `${d.legal_first} ${d.legal_middle ? d.legal_middle + " " : ""}${d.legal_last}`.replace(/\s+/g, " ").trim() : fallback;
