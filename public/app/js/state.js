/* ================= helpers ================= */
const $ = s => document.querySelector(s);
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const usd = n => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(Number(n) || 0);
const pad = n => String(n).padStart(2, "0");
const ymd = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const todayStr = () => ymd(new Date());
const parseYmd = s => { const [y, m, d] = s.split("-").map(Number); return new Date(y, m - 1, d); };
const niceDate = s => parseYmd(s).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
const niceDay = iso => new Date(iso).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
const niceTime = iso => new Date(iso).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
const toLocalInput = iso => { if (!iso) return ""; const d = new Date(iso); return `${ymd(d)}T${pad(d.getHours())}:${pad(d.getMinutes())}`; };
const fromLocalInput = v => v ? new Date(v).toISOString() : null;
const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];
const DAYS = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];
let toastT; const toast = m => { const t = $("#toast"); t.textContent = m; t.classList.add("on"); clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove("on"), 3200); };
const fail = e => { toast((e && e.message) || "Something went wrong. Try again."); return false; };
const cityOptions = sel => `<option value="none" ${!sel || sel === "none" ? "selected" : ""}>No city income tax</option>` + Object.entries(CITY_TABLE).map(([k, v]) => `<option value="${k}" ${sel === k ? "selected" : ""}>${v[0]} (${v[1] * 100}% resident, ${v[2] * 100}% nonresident)</option>`).join("");
const APP_DEFAULTS = { ...DEFAULTS, outsidePolicy: "block", autoApprove: false, weekStart: 0 };
const ROLE_LABEL = { owner: "Owner", manager: "Manager", supervisor: "Supervisor", employee: "Worker" };
/* A worker login is an employee or a contractor depending on the worker record it is linked to. */
const workerLabel = p => { const w = S.workers.find(x => x.id === p.worker_id); return w ? (w.type === "1099" ? "Contractor" : "Employee") : "Worker"; };
const isOwner = () => !!S.me && (S.me.role === "owner" || !!S.me.is_admin);

/* ================= state ================= */
const CONF = window.APP_CONFIG || {};
const configured = CONF.SUPABASE_URL && !/YOUR-PROJECT/.test(CONF.SUPABASE_URL) && CONF.SUPABASE_KEY && !/PASTE_YOURS/.test(CONF.SUPABASE_KEY);
const sb = configured ? supabase.createClient(CONF.SUPABASE_URL, CONF.SUPABASE_KEY) : null;
const S = { me: null, cfg: { ...APP_DEFAULTS }, workers: [], directory: [], sites: [], assigns: [], punches: [], checks: [], deposits: {}, people: [],
  year: new Date().getFullYear(), tab: null, run: { ids: [], pending: 0, sickIds: [] },
  status: {}, week: { hours: 0, cap: 40, mode: "warn" }, sick: null, requests: [], events: [], actions: [], acks: [], tasks: [], taskChecks: [], shifts: [], myDetails: {}, income: [], expenses: [], done: {}, paperworkMissing: [], payQuarters: new Set(), invoices: [], invoiceChecks: [], jobs: [], pendingNames: [], pendingPaper: {}, ownerTax: null };
/* Each city's share of a set of income rows, by the site's city. Used to split the owner's profit between cities the way paychecks are split. */
const incomeCityShares = rows => { const by = {}; let tot = 0; rows.forEach(x => { const c = (S.sites.find(s => s.id === x.site_id) || {}).city || "none"; by[c] = (by[c] || 0) + Number(x.amount); tot += Number(x.amount); }); const out = {}; if (tot > 0) Object.keys(by).forEach(c => out[c] = by[c] / tot); return out; };
const needsPaperwork = () => S.me && S.me.worker_id && S.myDetails && !S.myDetails.w4_signed_at;
/* Upload a phone photo or video into the shift's folder in the private bucket. Returns the stored path. */
async function uploadShiftFile(punchId, file, kind, name) {
  if (file.size > 60 * 1048576) throw new Error("That file is over 60 MB. Try a shorter video.");
  const ext = (file.name.split(".").pop() || (kind === "video" ? "mp4" : "jpg")).toLowerCase(), path = `${punchId}/${name}.${ext}`;
  const up = await sb.storage.from("proof").upload(path, file, { upsert: true, contentType: file.type || undefined }); if (up.error) throw up.error;
  return path;
}

/* Site checklists: active tasks for a site, and which of them were ticked on a given shift. */
const PROOF_LABEL = { none: "No proof", photo: "Photo", video: "Video", either: "Photo or video" };
/* Signed link to a proof file in the private bucket, valid 10 minutes. */
const proofUrl = async path => { const r = await sb.storage.from("proof").createSignedUrl(path, 600); if (r.error) throw r.error; return r.data.signedUrl; };
const tasksFor = siteId => S.tasks.filter(t => t.site_id === siteId && t.active);
const doneSet = punchId => new Set(S.taskChecks.filter(c => c.punch_id === punchId).map(c => c.task_id));
function taskProgress(p) { const ts = tasksFor(p.site_id); if (!ts.length) return null; const d = doneSet(p.id); return { done: ts.filter(t => d.has(t.id)).length, total: ts.length, missing: ts.filter(t => !d.has(t.id)) }; }
const capOf = w => Number(w.weekly_cap) || Number((S.cfg.hours || {}).weeklyCap) || 40;
function meterHtml(hours, cap) {
  const pct = cap ? Math.min(100, hours / cap * 100) : 0, cls = hours >= cap ? "red" : hours >= cap * 0.9 ? "amber" : "";
  return `<div class="meter ${cls}"><div style="width:${pct}%"></div></div><p class="help num" style="margin:4px 0 0">This week: ${h2(hours)} h of ${h2(cap)}. ${hours >= cap ? "At the cap." : h2(cap - hours) + " h left."}</p>`;
}
const isMgr = () => S.me && (S.me.role === "owner" || S.me.role === "manager" || S.me.is_admin);
const isSup = () => S.me && S.me.role === "supervisor";
const nameOf = id => (S.workers.find(w => w.id === id) || S.directory.find(w => w.id === id) || {}).name || "Worker";
const siteName = id => (S.sites.find(s => s.id === id) || {}).name || "No site";
const punchHours = p => p.clock_out ? Math.max(0, (new Date(p.clock_out) - new Date(p.clock_in)) / 3600000 - (p.break_minutes || 0) / 60) : 0;
const h2 = n => (Math.round(n * 100) / 100).toFixed(2);
const sum = (arr, k) => Math.round(arr.reduce((a, c) => a + (Number(c[k]) || 0), 0) * 100) / 100;
const weekKey = (iso, ws) => { const d = new Date(iso); const s = new Date(d.getFullYear(), d.getMonth(), d.getDate() - ((d.getDay() - ws + 7) % 7)); return ymd(s); };
/* Overtime is counted per workweek (over 40 hours), not per pay period. */
function splitHours(punches, ws, overtime) {
  const weeks = {}; punches.forEach(p => { const k = weekKey(p.clock_in, ws); weeks[k] = (weeks[k] || 0) + punchHours(p); });
  let reg = 0, ot = 0; Object.values(weeks).forEach(t => { if (overtime) { reg += Math.min(40, t); ot += Math.max(0, t - 40); } else reg += t; });
  return { reg: Math.round(reg * 100) / 100, ot: Math.round(ot * 100) / 100 };
}
const calcWorker = w => ({ type: w.type, rate: w.rate, filing: w.filing, step2: w.step2, dependentsCredit: w.dependents_credit, extraWithholding: w.extra_withholding,
  otherIncome: w.other_income, deductions: w.deductions, miExemptions: w.mi_exemptions, homeCity: w.home_city || "none" });

/* ================= data ================= */
/* Runs a query. Supabase returns at most 1,000 rows per request, so when a page comes back full the rest is fetched page by page: a busy year has more than 1,000 checklist rows or punches. */
async function q(builder) { const PAGE = 1000; const { data, error } = await builder; if (error) throw error;
  if (!Array.isArray(data) || data.length < PAGE || typeof builder.range !== "function") return data;
  let out = data; for (let from = PAGE; ; from += PAGE) { const r = await builder.range(from, from + PAGE - 1); if (r.error) throw r.error; out = out.concat(r.data || []); if (!r.data || r.data.length < PAGE) break; } return out; }
async function loadData() {
  const since = new Date(Date.now() - 60 * 864e5).toISOString();
  const jobs = [
    q(sb.from("settings").select("data").eq("id", 1).maybeSingle()).then(d => S.cfg = { ...APP_DEFAULTS, ...((d && d.data) || {}) }),
    q(sb.from("sites").select("*").order("name")).then(d => S.sites = d),
    q(sb.from("site_tasks").select("*").order("sort_order").order("created_at")).then(d => S.tasks = d),
    q(sb.from("task_checks").select("*").order("checked_at", { ascending: false }).limit(5000)).then(d => S.taskChecks = d),
    q(sb.from("site_assignments").select("*")).then(d => S.assigns = d),
    q(sb.from("punches").select("*").gte("clock_in", since).order("clock_in", { ascending: false }).limit(1000)).then(d => S.punches = d),
    q(sb.from("workers").select("*").order("name")).then(d => S.workers = d),
    q(sb.from("paychecks").select("*").eq("year", S.year).order("pay_date", { ascending: false })).then(d => S.checks = d)
  ];
  if (isSup()) jobs.push(q(sb.from("worker_directory").select("*")).then(d => S.directory = d));
  if (isMgr()) {
    jobs.push(q(sb.from("profiles").select("*").order("created_at")).then(d => S.people = d));
    jobs.push(q(sb.from("deposits").select("*").eq("year", S.year)).then(d => { S.deposits = {}; d.forEach(x => S.deposits[x.key] = x.paid_on); }));
    jobs.push(q(sb.from("income").select("*").order("on_date", { ascending: false }).limit(5000)).then(d => S.income = d));
    jobs.push(q(sb.from("expenses").select("*").order("on_date", { ascending: false }).limit(5000)).then(d => S.expenses = d));
    jobs.push(q(sb.from("done_items").select("*")).then(d => { S.done = {}; d.forEach(x => S.done[x.key] = x.done_on); }));
    jobs.push(q(sb.rpc("paperwork_missing")).then(d => S.paperworkMissing = d || []));
    jobs.push(q(sb.rpc("pending_paperwork_names")).then(d => S.pendingNames = d || []));
    if (isOwner()) jobs.push(q(sb.from("owner_tax").select("data").eq("id", 1).maybeSingle()).then(d => S.ownerTax = (d && d.data) || {}).catch(() => S.ownerTax = {})); else S.ownerTax = null;
    jobs.push(q(sb.rpc("pay_quarters")).then(d => S.payQuarters = new Set(d || [])));
  }
  jobs.push(q(sb.rpc("employer_status")).then(d => S.status = d || {}));
  const shiftQ = () => q(sb.from("shifts").select("*").gte("on_date", ymd(new Date(Date.now() - 21 * 864e5))).lte("on_date", ymd(new Date(Date.now() + 35 * 864e5))).order("on_date")).then(d => S.shifts = d);
  jobs.push(isMgr() ? sb.rpc("sweep_shifts").then(shiftQ) : shiftQ());
  if (S.me.worker_id) {
    jobs.push(q(sb.rpc("week_hours", { p_worker: S.me.worker_id })).then(h => S.week.hours = Number(h) || 0));
    jobs.push(q(sb.rpc("effective_cap", { p_worker: S.me.worker_id })).then(c => { S.week.cap = Number(c.cap) || 40; S.week.mode = c.mode || "warn"; }));
    jobs.push(q(sb.rpc("sick_balance", { p_worker: S.me.worker_id })).then(b => S.sick = b));
    jobs.push(q(sb.from("policy_acknowledgements").select("*").eq("worker_id", S.me.worker_id)).then(d => S.acks = d));
    jobs.push(q(sb.rpc("worker_details", { p_worker: S.me.worker_id })).then(d => S.myDetails = d || {}));
  }
  jobs.push(q(sb.from("sick_requests").select("*").order("on_date", { ascending: false }).limit(500)).then(d => S.requests = d));
  jobs.push(q(sb.from("invoices").select("*").order("on_date", { ascending: false }).limit(1000)).then(d => S.invoices = d));
  jobs.push(q(sb.from("invoice_checks").select("*").limit(5000)).then(d => S.invoiceChecks = d));
  jobs.push(q(sb.from("jobs").select("*").gte("on_date", ymd(new Date(Date.now() - 60 * 864e5))).order("on_date")).then(d => S.jobs = d));
  if (isMgr() || isSup()) jobs.push(q(sb.from("attendance_events").select("*").order("on_date", { ascending: false }).limit(1000)).then(d => S.events = d));
  if (isMgr() || S.me.worker_id) jobs.push(q(sb.from("discipline_actions").select("*").order("issued_at", { ascending: false })).then(d => S.actions = d));
  try { await Promise.all(jobs); } catch (e) { fail(e); }
}
async function refresh() { await loadData(); render(); }


/* ================= sheets ================= */
function openSheet(html) { const s = $("#sheet"); s.innerHTML = `<div role="dialog" aria-modal="true">${html}</div>`; s.hidden = false; }
function closeSheet() { $("#sheet").hidden = true; $("#sheet").innerHTML = ""; }
function download(name, type, text) { const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([text], { type })); a.download = name; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500); }
