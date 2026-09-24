/* ---------- Payroll math (pure functions) ---------- */
/* Official federal tables by year. Add a year here each December when the IRS publishes Pub. 15-T and the SSA wage base;
   any year not listed is projected from the latest official year with the inflation assumption in Settings. */
const FED_DELTAS = [0.10, 0.02, 0.10, 0.02, 0.08, 0.03, 0.02];
const TAX_TABLES = {
  2026: { thresholds: {
      MFJ:     [19300, 44100, 120100, 230700, 422850, 531750, 788000],
      Single:  [7500, 19900, 57900, 113200, 209275, 263725, 648100],
      HOH:     [15550, 33250, 83000, 121250, 217300, 271750, 656150],
      MFJ_2:   [16100, 28500, 66500, 121800, 217875, 272325, 400450],
      Single_2:[8050, 14250, 33250, 60900, 108938, 136163, 328350],
      HOH_2:   [12075, 20925, 45800, 64925, 112950, 140175, 332375] },
    ssWageBase: 184500, w4AdjMFJ: 12900, w4AdjOther: 8600, miExemption: 5900 }
};
const TAX_TABLE_YEAR = Math.max(...Object.keys(TAX_TABLES).map(Number));
const FED_THRESHOLDS = TAX_TABLES[TAX_TABLE_YEAR].thresholds;
const roundTo = (n, step) => Math.round(n / step) * step;
/* Tables for any year: official when listed, otherwise the latest official year grown by the inflation rate (IRS rounds brackets to $50, the wage base to $300). */
function taxTablesFor(year, inflation) {
  if (TAX_TABLES[year]) return { year, estimated: false, baseYear: year, ...TAX_TABLES[year] };
  const base = TAX_TABLES[TAX_TABLE_YEAR], f = Math.pow(1 + (Number(inflation) || 0), Math.max(0, year - TAX_TABLE_YEAR));
  if (year < TAX_TABLE_YEAR) return { year, estimated: true, baseYear: TAX_TABLE_YEAR, ...base };
  const thresholds = {}; Object.entries(base.thresholds).forEach(([k, arr]) => thresholds[k] = arr.map(v => roundTo(v * f, 50)));
  return { year, estimated: true, baseYear: TAX_TABLE_YEAR, thresholds, ssWageBase: roundTo(base.ssWageBase * f, 300),
    w4AdjMFJ: roundTo(base.w4AdjMFJ * f, 100), w4AdjOther: roundTo(base.w4AdjOther * f, 100), miExemption: roundTo(base.miExemption * f, 100) };
}
/* Settings for a pay year: indexed figures come from the year's table so a settings save in 2026 does not freeze 2027 at 2026 numbers. */
function cfgForYear(cfg, year) {
  const t = taxTablesFor(year, cfg.inflation ?? 0.025), out = { ...cfg, fedThresholds: t.thresholds, taxYear: year, taxEstimated: t.estimated };
  ["ssWageBase", "w4AdjMFJ", "w4AdjOther", "miExemption"].forEach(k => { const official = TAX_TABLES[TAX_TABLE_YEAR][k];
    if (Number(cfg[k]) === official || cfg[k] == null) out[k] = t[k]; });   /* owner overrides are respected, defaults are projected */
  return out;
}
const DEFAULTS = {
  inflation: 0.025,
  businessName: "", payPeriods: 26, otMultiplier: 1.5,
  ssRate: 0.062, ssWageBase: 184500, medicareRate: 0.0145,
  addlMedicareRate: 0.009, addlMedicareThreshold: 200000,
  futaRate: 0.006, futaWageBase: 7000,
  w4AdjMFJ: 12900, w4AdjOther: 8600,
  miRate: 0.0425, miExemption: 5900,
  uiaRate: 0.027, uiaWageBase: 9500,
  necThreshold: 2000
};
/* Michigan cities with an income tax: resident rate, nonresident rate. Personal exemption $600 per exemption per year in every city. */
const CITY_TABLE = {
  albion: ["Albion", 0.01, 0.005], battle_creek: ["Battle Creek", 0.01, 0.005], benton_harbor: ["Benton Harbor", 0.01, 0.005], big_rapids: ["Big Rapids", 0.01, 0.005],
  detroit: ["Detroit", 0.024, 0.012], east_lansing: ["East Lansing", 0.01, 0.005], flint: ["Flint", 0.01, 0.005], grand_rapids: ["Grand Rapids", 0.015, 0.0075],
  grayling: ["Grayling", 0.01, 0.005], hamtramck: ["Hamtramck", 0.01, 0.005], highland_park: ["Highland Park", 0.02, 0.01], hudson: ["Hudson", 0.01, 0.005],
  ionia: ["Ionia", 0.01, 0.005], jackson: ["Jackson", 0.01, 0.005], lansing: ["Lansing", 0.01, 0.005], lapeer: ["Lapeer", 0.01, 0.005],
  muskegon: ["Muskegon", 0.01, 0.005], muskegon_heights: ["Muskegon Heights", 0.01, 0.005], pontiac: ["Pontiac", 0.01, 0.005], port_huron: ["Port Huron", 0.01, 0.005],
  portland: ["Portland", 0.01, 0.005], saginaw: ["Saginaw", 0.015, 0.0075], springfield: ["Springfield", 0.01, 0.005], walker: ["Walker", 0.01, 0.005]
};
const CITY_EXEMPTION = 600;
const cityName = c => (CITY_TABLE[c] || [c === "none" || !c ? "No city" : c])[0];
/* City tax for one paycheck. shares = { cityCode: fraction of wages earned there } ("none" for untaxed places).
   Residents owe their city's rate on all wages, less a credit for nonresident tax paid to other cities (capped at what the home city
   would charge a nonresident on that income). Nonresidents owe the work city's nonresident rate on wages earned there. */
function cityTax(gross, homeCity, shares, exemptions, payPeriods) {
  const detail = {}, ex = Math.max(0, CITY_EXEMPTION * (Number(exemptions) || 0) / (payPeriods || 26)), home = CITY_TABLE[homeCity] ? homeCity : null;
  let nonres = 0, creditCap = 0;
  Object.entries(shares || {}).forEach(([c, f]) => { if (!CITY_TABLE[c] || c === home || !f) return;
    const w = gross * f, t = Math.max(0, w - ex * f) * CITY_TABLE[c][2]; detail[c] = (detail[c] || 0) + t; nonres += t;
    if (home) creditCap += Math.max(0, w - ex * f) * CITY_TABLE[home][2]; });
  if (home) { const t = Math.max(0, gross - ex) * CITY_TABLE[home][1] - Math.min(nonres, creditCap); detail[home] = (detail[home] || 0) + Math.max(0, t); }
  let total = 0; Object.keys(detail).forEach(c => { detail[c] = Math.round(detail[c] * 100) / 100; total += detail[c]; });
  return { total: Math.round(total * 100) / 100, detail };
}
const r2 = n => Math.round((n + Number.EPSILON) * 100) / 100;
const num = v => { const n = parseFloat(v); return isFinite(n) ? n : 0; };

function federalWithholding(gross, w, cfg) {
  const P = cfg.payPeriods;
  const status = ["MFJ", "HOH"].includes(w.filing) ? w.filing : "Single";
  const adj = w.step2 ? 0 : (status === "MFJ" ? cfg.w4AdjMFJ : cfg.w4AdjOther);
  const annual = Math.max(0, gross * P + num(w.otherIncome) - num(w.deductions) - adj);
  const thr = (cfg.fedThresholds || FED_THRESHOLDS)[status + (w.step2 ? "_2" : "")];
  let tax = 0;
  for (let i = 0; i < thr.length; i++) if (annual > thr[i]) tax += (annual - thr[i]) * FED_DELTAS[i];
  return r2(Math.max(0, tax / P - num(w.dependentsCredit) / P) + num(w.extraWithholding));
}

/* w: worker, inp: {regHours, otHours, sickHours, otherPay, otherDed}, priorYTD: gross already paid this calendar year */
function calcPaycheck(w, inp, priorYTD, cfg) {
  const rate = num(w.rate);
  const gross = r2(num(inp.regHours) * rate + num(inp.otHours) * rate * cfg.otMultiplier + num(inp.sickHours) * rate + num(inp.guaranteeHours) * rate + num(inp.otherPay));
  const otherDed = r2(num(inp.otherDed));
  const z = { gross, fed: 0, ss: 0, med: 0, state: 0, city: 0, otherDed, erSS: 0, erMed: 0, futa: 0, suta: 0 };
  if (w.type === "W-2") {
    const capped = base => Math.max(0, Math.min(gross, base - priorYTD));
    z.fed = federalWithholding(gross, w, cfg);
    z.ss = r2(capped(cfg.ssWageBase) * cfg.ssRate);
    const T = cfg.addlMedicareThreshold;
    z.med = r2(gross * cfg.medicareRate + (Math.max(0, priorYTD + gross - T) - Math.max(0, priorYTD - T)) * cfg.addlMedicareRate);
    z.state = r2(Math.max(0, gross - cfg.miExemption * num(w.miExemptions) / cfg.payPeriods) * cfg.miRate);
    const ct = cityTax(gross, w.homeCity, inp.cityShares || (w.homeCity && w.homeCity !== "none" ? { [w.homeCity]: 1 } : {}), w.miExemptions, cfg.payPeriods);
    z.city = ct.total; z.cityDetail = ct.detail;
    z.ssWages = r2(capped(cfg.ssWageBase)); z.medWages = gross;
    z.erSS = z.ss;
    z.erMed = r2(gross * cfg.medicareRate);
    z.futa = r2(capped(cfg.futaWageBase) * cfg.futaRate);
    z.suta = r2(capped(cfg.uiaWageBase) * cfg.uiaRate);
  }
  z.net = r2(gross - z.fed - z.ss - z.med - z.state - z.city - otherDed);
  z.employerCost = r2(gross + z.erSS + z.erMed + z.futa + z.suta);
  z.fed941 = r2(z.fed + z.ss + z.med + z.erSS + z.erMed);
  return z;
}

/* ---------- The owner's own taxes on the profit (sole proprietor or single-member LLC, Schedule C) ---------- */
/* Personal brackets and standard deduction, official for the years listed; other years projected like the withholding tables. */
const OWNER_TABLES = {
  2026: { std: { Single: 16100, MFJ: 32200, HOH: 24150 },
    brackets: { Single: [12400, 50400, 105700, 201775, 256225, 640600], MFJ: [24800, 100800, 211400, 403550, 512450, 768700], HOH: [17700, 67450, 105700, 201775, 256200, 640600] } }
};
const OWNER_RATES = [0.10, 0.12, 0.22, 0.24, 0.32, 0.35, 0.37];
function ownerTablesFor(year, inflation) {
  const base = Math.max(...Object.keys(OWNER_TABLES).map(Number)); if (OWNER_TABLES[year]) return { ...OWNER_TABLES[year], estimated: false };
  const f = Math.pow(1 + (Number(inflation) || 0), Math.max(0, year - base)), t = OWNER_TABLES[base], out = { std: {}, brackets: {}, estimated: true };
  Object.entries(t.std).forEach(([k, v]) => out.std[k] = roundTo(v * f, 50)); Object.entries(t.brackets).forEach(([k, arr]) => out.brackets[k] = arr.map(v => roundTo(v * f, 50))); return out;
}
const bracketTax = (taxable, cuts) => { let tax = 0, prev = 0; for (let i = 0; i < OWNER_RATES.length; i++) { const top = cuts[i] ?? Infinity; if (taxable <= prev) break; tax += (Math.min(taxable, top) - prev) * OWNER_RATES[i]; prev = top; } return tax; };
/* Federal estimated payments are due April 15, June 15, September 15 and January 15 of the next year. Michigan uses the same dates. */
const ownerEstDates = y => [`${y}-04-15`, `${y}-06-15`, `${y}-09-15`, `${y + 1}-01-15`];
/* What the owner personally owes on the business profit: self-employment tax, federal income tax (after half the SE tax and the 20% qualified
   business income deduction), Michigan, and city tax if they live in one. Other household income only sets the bracket; the tax on it is not counted.
   City tax follows the same rule as paychecks: the home city taxes all of it at the resident rate, every other taxing city where work was done taxes its
   share at the nonresident rate, and the home city credits that. cityShares is each city's share of the year's billing (from the sites' cities).
   The profit is taxed whether or not it leaves the business account. */
function ownerTaxEstimate(o) {
  const year = Number(o.year), cfg = o.cfg || {}, infl = cfg.inflation ?? 0.025, t = ownerTablesFor(year, infl), fed = taxTablesFor(year, infl), filing = ["Single", "MFJ", "HOH"].includes(o.filing) ? o.filing : "Single";
  const profit = Math.max(0, Number(o.profit) || 0), other = Math.max(0, Number(o.otherIncome) || 0), otherWages = Math.min(other, Math.max(0, Number(o.otherWages) || 0)), ex = Math.max(0, Number(o.miExemptions) || 0);
  const wageBase = Number(cfg.ssWageBase) || fed.ssWageBase, miEx = Number(cfg.miExemption) || fed.miExemption;
  const seBase = profit * 0.9235, ss = 0.124 * Math.max(0, Math.min(seBase, wageBase - otherWages)), med = 0.029 * seBase, seTax = r2(ss + med), halfSE = r2(seTax / 2);
  const income = p => { const agi = p - (p ? halfSE : 0) + other, before = Math.max(0, agi - t.std[filing]), qbi = p ? Math.min(0.2 * (p - halfSE), 0.2 * before) : 0;
    return { fed: bracketTax(Math.max(0, before - qbi), t.brackets[filing]), qbi, mi: 0.0425 * Math.max(0, agi - ex * miEx) }; };
  const home = o.homeCity && CITY_TABLE[o.homeCity] ? o.homeCity : null, shares = o.cityShares && Object.keys(o.cityShares).length ? o.cityShares : (home ? { [home]: 1 } : {});
  const c = cityTax(Math.max(0, profit - halfSE), home, shares, ex, 1);
  const w = income(profit), z = income(0), fedTax = r2(Math.max(0, w.fed - z.fed)), miTax = r2(Math.max(0, w.mi - z.mi)), total = r2(seTax + fedTax + miTax + c.total);
  return { profit, seTax, halfSE, qbi: r2(w.qbi), fedTax, miTax, cityTax: c.total, cityDetail: c.detail, total, quarterly: r2(total / 4), share: profit ? total / profit : 0, estimated: t.estimated, std: t.std[filing], filing };
}
