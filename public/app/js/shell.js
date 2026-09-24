/* ================= shell ================= */
const ICONS = {
  clock: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>', hours: '<path d="M5 4h14v16H5z"/><path d="M8.5 9h7M8.5 13h7M8.5 17h4"/>',
  team: '<circle cx="9" cy="8" r="3.2"/><path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6"/><path d="M16 5.2a3.2 3.2 0 0 1 0 5.6M18 14.5c1.8.9 3 2.8 3 5"/>',
  run: '<rect x="3" y="6" width="18" height="12" rx="2"/><circle cx="12" cy="12" r="2.5"/>', history: '<path d="M6 3h12v18l-3-2-3 2-3-2-3 2z"/><path d="M9 8h6M9 12h6"/>',
  mypay: '<path d="M6 3h12v18l-3-2-3 2-3-2-3 2z"/><path d="M9 8h6M9 12h6"/>', taxes: '<rect x="4" y="5" width="16" height="16" rx="2"/><path d="M4 10h16M9 3v4M15 3v4"/>',
  more: '<circle cx="5" cy="12" r="1.6"/><circle cx="12" cy="12" r="1.6"/><circle cx="19" cy="12" r="1.6"/>',
  timeoff: '<rect x="4" y="5" width="16" height="16" rx="2"/><path d="M4 10h16M9 3v4M15 3v4M12 13v5M9.5 15.5h5"/>',
  invoices: '<path d="M6 3h9l4 4v14H6z"/><path d="M15 3v4h4M9 12h6M9 16h6"/>',
  inbox: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 7l9 6 9-6"/>'
};
function tabsFor() {
  if (isMgr()) return [["team", "Timesheets"], ["run", "Pay"], ["history", "Paychecks"], ["taxes", "Taxes"], ["inbox", S.inboxNew ? `Inbox <span class="badge">${S.inboxNew}</span>` : "Inbox"], ["more", "More"]];
  if (isSup()) return [["clock", "Clock"], ["hours", "My hours"], ["timeoff", "Time off"], ["team", "Team"], ["more", "More"]];
  if (isContractor()) return [["invoices", "Invoices"], ["mypay", "My pay"], ["more", "More"]];
  return [["clock", "Clock"], ["hours", "My hours"], ["timeoff", "Time off"], ["mypay", "My pay"], ["more", "More"]];
}
const SUBVIEWS = ["workers", "sites", "people", "settings", "schedule", "filings", "books", "guide", "website"];
function render() {
  if (!S.me) return;
  $("#biz").textContent = S.cfg.businessName || "Payroll";
  const ys = $("#year"), now = new Date().getFullYear(), years = new Set([now - 1, now, now + 1, S.year]);
  ys.innerHTML = [...years].sort().map(y => `<option ${y === S.year ? "selected" : ""}>${y}</option>`).join("");
  ys.hidden = !isMgr() && S.tab !== "mypay";
  const b = []; let seenTax = ""; try { seenTax = localStorage.getItem("seen_tax") || ""; } catch (e) {}
  if (isMgr() && S.tab === "run" && S.year > TAX_TABLE_YEAR && seenTax !== String(S.year)) b.push(`${S.year} federal figures are projected from the ${TAX_TABLE_YEAR} tables with ${Math.round((S.cfg.inflation ?? 0.025) * 1000) / 10}% inflation until the IRS publishes them. Withholding evens out on each worker's tax return. <button class="linkbtn" id="b-tax" style="padding:0">Got it</button>`);
  const lost = S.status.small_lost_on; let seen = ""; try { seen = localStorage.getItem("seen_status") || ""; } catch (e) {}
  if (isMgr() && lost && seen !== lost) b.push(`Since ${niceDate(lost)} the business has had 10 or more employees in 20 or more weeks. Sick time caps are now 72 hours. Open Settings and save once so workers are asked to sign the updated policy. <button class="linkbtn" id="b-seen" style="padding:0">Dismiss</button>`);
  if (needsPaperwork() && S.tab !== "paperwork") b.push(`Finish your tax paperwork (W-4, address, Social Security number). <button class="linkbtn" id="b-paper" style="padding:0">Start</button>`);
  $("#banners").innerHTML = b.map(x => `<div class="banner">${x}</div>`).join("");
  const bp = $("#b-paper"); if (bp) bp.onclick = paperworkSheet;
  const bs = $("#b-seen"); if (bs) bs.onclick = () => { try { localStorage.setItem("seen_status", lost); } catch (e) {} render(); };
  const bt = $("#b-tax"); if (bt) bt.onclick = () => { try { localStorage.setItem("seen_tax", String(S.year)); } catch (e) {} render(); };
  const tabs = tabsFor(), nav = $("nav.tabs"); nav.style.setProperty("--tabs", tabs.length);
  const cur = SUBVIEWS.includes(S.tab) || (isMgr() && ["clock", "hours", "timeoff", "mypay"].includes(S.tab)) || S.tab === "guide" ? "more" : S.tab;
  nav.innerHTML = tabs.map(t => `<button data-tab="${t[0]}" aria-current="${t[0] === cur ? "page" : "false"}"><svg viewBox="0 0 24 24">${ICONS[t[0]]}</svg>${t[1]}</button>`).join("");
  document.querySelectorAll("#app main > section").forEach(x => x.hidden = x.id !== "v-" + S.tab);
  ({ clock: renderClock, hours: renderHours, timeoff: renderTimeoff, mypay: renderMyPay, team: renderTeam, run: renderRun, history: renderHistory, taxes: renderTaxes,
     more: renderMore, workers: renderWorkers, sites: renderSites, people: renderPeople, settings: renderSettings, schedule: renderSchedule, filings: renderFilings, books: renderBooks, guide: renderGuide, invoices: renderInvoices, website: renderWebsite, inbox: renderInbox })[S.tab]();
  refreshInboxCount();
}
function go(tab) { S.tab = tab; window.scrollTo(0, 0); render(); softRefresh(); }
/* Reload data in the background without disturbing what the user is doing. Also checks for a new app version. */
let softT;
function softRefresh() { clearTimeout(softT); softT = setTimeout(async () => { if (!S.me || !$("#sheet").hidden) return;
  if (document.activeElement && /INPUT|SELECT|TEXTAREA/.test(document.activeElement.tagName)) return; await loadData(); render(); checkVersion(); }, 150); }
async function hardRefresh() { const b = $("#refresh"); b.classList.add("spin"); try { await loadData(); render(); toast("Up to date"); await checkVersion(true); } finally { b.classList.remove("spin"); } }
/* version.json is written at every deploy. When it changes, reload so the phone stops running old code. */
let appVersion = null;
async function checkVersion(force) {
  try { const r = await fetch("version.json?t=" + Date.now(), { cache: "no-store" }); if (!r.ok) return; const v = (await r.json()).version;
    if (appVersion === null) { appVersion = v; return; }
    if (v !== appVersion) { if (force || ($("#sheet").hidden && !(document.activeElement && /INPUT|SELECT|TEXTAREA/.test(document.activeElement.tagName)))) location.reload();
      else $("#banners").insertAdjacentHTML("afterbegin", `<div class="banner">A new version of the app is ready. <button class="linkbtn" onclick="location.reload()" style="padding:0">Tap to update</button></div>`); }
  } catch (e) {}
}
/* Pull down at the top of the page to refresh, like a native app. */
(() => { let y0 = null, armed = false; const ptr = () => $("#ptr");
  document.addEventListener("touchstart", e => { y0 = window.scrollY <= 0 && $("#sheet").hidden ? e.touches[0].clientY : null; armed = false; }, { passive: true });
  document.addEventListener("touchmove", e => { if (y0 === null) return; const dy = e.touches[0].clientY - y0; armed = dy > 80; ptr().classList.toggle("show", dy > 30); }, { passive: true });
  document.addEventListener("touchend", () => { ptr().classList.remove("show"); if (armed && S.me) hardRefresh(); y0 = null; armed = false; }, { passive: true }); })();

/* ================= more ================= */
function renderMore() {
  const items = []; if (isMgr()) { items.push(["schedule", "Schedule", "Who works where, and when"], ["workers", "Workers", "Pay rates and W-4 answers"], ["sites", "Sites", "Locations and who works where"],
    ["people", "People and roles", `${S.people.filter(p => !p.active).length} waiting for approval`], ["settings", "Settings", "Time clock rules and tax rates"]);
    if (S.me.worker_id) items.push(["clock", "Clock in or out", "Your own time clock"], ["hours", "My hours", "Your own shifts"], ["timeoff", "Time off", "Your own sick time"], ["mypay", "My pay", "Your own pay stubs"]); }
  if (isMgr()) items.splice(1, 0, ["books", "Books", "Money in, money out, profit by site"], ["filings", "Tax filings", "941, 940, W-2, 1099, Michigan and city forms"]);
  if (isOwner()) items.push(["website", "Website", "Photos, prices and contact details on rlfsecurity.com"]);
  items.push(["guide", "Guide", "How everything works and when to do what"]);
  if (S.me.worker_id) items.push(["paperwork", "My tax paperwork", needsPaperwork() ? "Not done yet" : "W-4, address, Social Security number"]);
  $("#v-more").innerHTML = `<h2>More</h2>${items.length ? `<ul class="list morelist">${items.map(i => `<li><button class="rowbtn" ${i[0] === "paperwork" ? "data-paper=1" : `data-tab="${i[0]}"`}><span class="main"><b>${i[1]}</b><small>${esc(i[2])}</small></span></button></li>`).join("")}</ul>` : ""}
    <div class="panel"><b>${esc(S.me.full_name || S.me.email)}</b><p class="help" style="margin-bottom:0">${esc(S.me.email)}, ${S.me.is_admin ? "Administrator" : ROLE_LABEL[S.me.role]}</p><div class="actions"><button class="ghost" id="m-refresh">Refresh</button><button class="ghost" id="m-out">Sign out</button></div></div>`;
  $("#m-out").onclick = async () => { await sb.auth.signOut(); S.me = null; S.tab = null; showAuth("signin"); };
  $("#m-refresh").onclick = async () => { await refresh(); toast("Up to date"); };
}

/* ================= events ================= */
document.addEventListener("click", e => {
  const t = e.target.closest("[data-tab],[data-close],[data-worker],[data-stub],[data-dep],[data-punch],[data-site],[data-person],[data-auth],[data-req],[data-att],[data-shift],[data-paper],[data-inv],[data-job]"); if (!t) { if (e.target.id === "sheet") closeSheet(); return; }
  if (t.dataset.shift) return shiftDetail(t.dataset.shift); if (t.dataset.paper) return paperworkSheet(); if (t.dataset.inv) return invoiceSheet(t.dataset.inv); if (t.dataset.job) return jobSheet(t.dataset.job);
  if (t.dataset.tab) go(t.dataset.tab); else if ("close" in t.dataset) closeSheet(); else if (t.dataset.worker) workerSheet(t.dataset.worker); else if (t.dataset.stub) stubSheet(t.dataset.stub);
  else if (t.dataset.dep) toggleDeposit(t.dataset.dep); else if (t.dataset.punch) punchSheet(t.dataset.punch); else if (t.dataset.site) siteSheet(t.dataset.site); else if (t.dataset.person) personSheet(t.dataset.person);
  else if (t.dataset.req) requestSheet(t.dataset.req); else if (t.dataset.att) attendanceSheet(t.dataset.att);
  else if (t.dataset.auth === "signout") sb.auth.signOut().then(() => showAuth("signin")); else if (t.dataset.auth) showAuth(t.dataset.auth);
});
["#r-date", "#r-reg", "#r-ot", "#r-sick", "#r-guar", "#r-other", "#r-ded"].forEach(i => $(i).addEventListener("input", () => { $("#r-save").dataset.ok = ""; $("#r-save").textContent = "Save paycheck"; previewRun(); }));
["#r-worker", "#r-start", "#r-end"].forEach(i => $(i).addEventListener("change", pullHours));
$("#r-save").onclick = saveRun; $("#r-addw").onclick = () => { go("workers"); workerSheet(null); }; $("#h-export").onclick = exportCsv;
$("#year").onchange = async e => { S.year = Number(e.target.value); await refresh(); };
document.addEventListener("visibilitychange", () => { if (!document.hidden) softRefresh(); });
window.addEventListener("focus", softRefresh);
$("#refresh").onclick = hardRefresh;
setInterval(() => { if (S.me && !document.hidden) softRefresh(); }, 5 * 60 * 1000);
checkVersion();
if (!configured) showAuth("signin");
else { sb.auth.onAuthStateChange((event) => { if (event === "PASSWORD_RECOVERY") setTimeout(() => showAuth("newpass"), 0); }); boot(); }
