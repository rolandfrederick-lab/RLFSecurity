/* ================= settings ================= */
const SET_FIELDS = [["ssRate", "Social Security rate (%)", 100], ["ssWageBase", "Social Security wage base ($)", 1], ["medicareRate", "Medicare rate (%)", 100], ["futaRate", "FUTA rate after credit (%)", 100], ["futaWageBase", "FUTA wage base ($)", 1],
  ["miRate", "Michigan income tax rate (%)", 100], ["miExemption", "Michigan exemption per MI-W4 exemption ($ per year)", 1], ["uiaRate", "Michigan UIA rate (%)", 100], ["uiaWageBase", "Michigan UIA taxable wage base ($)", 1], ["necThreshold", "1099-NEC threshold ($)", 1]];
const DEFAULT_STEPS = [{ name: "Verbal warning", points: 3 }, { name: "Written warning", points: 5 }, { name: "Final warning", points: 7 }, { name: "Termination", points: 9 }];
const DEFAULT_POINTS = { no_call_no_show: 3, late_notice: 1, unexcused: 2, tardy: 0.5 };
const POINT_LABEL = { no_call_no_show: "No call, no show", late_notice: "Late notice", unexcused: "Unexcused absence", tardy: "Tardy" };

function statusPanel(st) {
  const lost = st.small_lost_on;
  return `<h3>Employer status (computed)</h3><div class="panel"><dl class="kv num">
    <dt>Employees this week</dt><dd>${esc(st.headcount ?? 0)}</dd>
    <dt>Weeks at 10 or more this year</dt><dd>${esc(st.weeks_at_10 ?? 0)} of 20</dd>
    <dt>Michigan sick time size</dt><dd>${st.small_business === false ? `Not a small business${lost ? " since " + esc(niceDate(lost)) : ""}` : "Small business (under 10)"}</dd>
    <dt>Sick time caps</dt><dd>${esc(st.sick_use_cap ?? 40)} h use, ${esc(st.sick_carry_cap ?? 40)} h carryover</dd>
    <dt>Full-time equivalents last year</dt><dd>${esc(st.fte_prior_year ?? 0)} of 50</dd></dl>
    <p class="help" style="margin-bottom:0">Counted from hire and end dates and from clocked hours. Nothing to set here. When the business crosses a line, the caps change on their own and a notice appears.</p></div>`;
}

function renderSettings() {
  const v = $("#v-settings"); if (document.activeElement && v.contains(document.activeElement) && document.activeElement.tagName !== "BUTTON") return;
  const c = S.cfg, owner = S.me.role === "owner" || !!S.me.is_admin, dis = owner ? "" : "disabled", hcfg = c.hours || {}, sk = c.sick || {}, ow = S.ownerTax || {}, dc = c.discipline || {}, steps = dc.steps || DEFAULT_STEPS, pv = dc.pointValues || DEFAULT_POINTS, st = S.status || {};
  v.innerHTML = `${backMore}<h2>Settings</h2>${owner ? "" : `<p class="note">Only an owner can change settings.</p>`}
    <div class="panel"><label class="f" for="c-name">Business name</label><input id="c-name" type="text" value="${esc(c.businessName)}" ${dis}>
    <label class="f" for="c-pp">Pay schedule</label><select id="c-pp" ${dis}>${[[52, "Weekly"], [26, "Every two weeks"], [24, "Twice a month"], [12, "Monthly"]].map(o => `<option value="${o[0]}" ${c.payPeriods === o[0] ? "selected" : ""}>${o[1]}</option>`).join("")}</select>
    <label class="f" for="c-ws">Workweek starts on</label><select id="c-ws" ${dis}>${DAYS.map((d, i) => `<option value="${i}" ${c.weekStart === i ? "selected" : ""}>${d}</option>`).join("")}</select>
    <label class="f" for="c-ot">Overtime multiplier</label><input id="c-ot" type="number" inputmode="decimal" step="0.1" min="1" value="${esc(c.otMultiplier)}" ${dis}>
    <p class="help">Overtime is counted per workweek, over 40 hours. Weekly or two-week pay periods that start on the workweek day keep the overtime split exact.</p></div>
    <h3>Time clock</h3><div class="panel"><label class="f" for="c-pol">When someone clocks in away from the site</label><select id="c-pol" ${dis}><option value="block" ${c.outsidePolicy === "block" ? "selected" : ""}>Block the clock-in</option><option value="flag" ${c.outsidePolicy === "flag" ? "selected" : ""}>Allow it, and flag it for review</option></select>
    <label class="check"><input id="c-auto" type="checkbox" ${c.autoApprove ? "checked" : ""} ${dis}> Approve on-site shifts automatically</label>
    <p class="help">Clocking out is never blocked. An off-site clock-out is flagged for review instead.</p></div>
    <h3>Weekly hours</h3><div class="panel"><div class="grid2"><div><label class="f" for="c-cap">Default weekly cap (hours)</label><input id="c-cap" type="number" inputmode="decimal" min="1" step="0.5" value="${esc(hcfg.weeklyCap ?? 40)}" ${dis}></div>
    <div><label class="f" for="c-capmode">At the cap</label><select id="c-capmode" ${dis}><option value="warn" ${hcfg.capMode !== "block" ? "selected" : ""}>Warn only</option><option value="block" ${hcfg.capMode === "block" ? "selected" : ""}>Block clock-in</option></select></div></div>
    <p class="help">Each worker can have their own cap on their worker record. Managers can always add hours by hand with a reason. Under federal law, 40 is the overtime line; health benefits are only required at 50 or more full-time equivalents.</p></div>
    ${statusPanel(st)}
    <h3>Sick time (Michigan Earned Sick Time Act)</h3><div class="panel">
    <div class="grid2"><div><label class="f" for="c-xuse">Extra use cap (blank = legal ${esc(st.sick_use_cap ?? 40)})</label><input id="c-xuse" type="number" inputmode="decimal" min="0" step="1" value="${esc(sk.extraUseCap ?? "")}" ${dis}></div>
    <div><label class="f" for="c-xcarry">Extra carryover cap (blank = legal ${esc(st.sick_carry_cap ?? 40)})</label><input id="c-xcarry" type="number" inputmode="decimal" min="0" step="1" value="${esc(sk.extraCarryCap ?? "")}" ${dis}></div>
    <div><label class="f" for="c-wait">New hire waiting period (days, max 120)</label><input id="c-wait" type="number" inputmode="numeric" min="0" max="120" step="1" value="${esc(sk.waitDays ?? 120)}" ${dis}></div>
    <div><label class="f" for="c-notice">Planned notice (days, max 7)</label><input id="c-notice" type="number" inputmode="numeric" min="0" max="7" step="1" value="${esc(sk.plannedNoticeDays ?? 7)}" ${dis}></div></div>
    <label class="f" for="c-basis">Benefit year</label><select id="c-basis" ${dis}><option value="calendar" ${sk.yearBasis !== "anniversary" ? "selected" : ""}>Calendar year</option><option value="anniversary" ${sk.yearBasis === "anniversary" ? "selected" : ""}>Hire date anniversary</option></select>
    <p class="help">Accrual is 1 hour per 30 worked and cannot be changed. Caps come from the employer status above; you can only give more. Saving any change here creates a new policy version that every worker is asked to sign again. Current version: ${esc(sk.policyVersion || 1)}.</p>
    <div class="actions"><button class="ghost" id="c-print">Print the policy notice</button></div></div>
    <h3>Business details for tax forms</h3><div class="panel"><p class="help">Printed on every federal, Michigan and city filing. Nothing here is secret, but only owners can change it.</p>
    ${[["legalName", "Legal business name (as registered with the IRS)"], ["tradeName", "Trade name, if different"], ["ein", "Employer identification number (EIN), 9 digits"], ["street", "Street address"], ["city", "City"], ["state", "State"], ["zip", "ZIP"],
       ["contactName", "Contact name (who signs the forms)"], ["title", "Contact title, for example Owner"], ["phone", "Phone"], ["email", "Email"], ["uiaAccount", "Michigan UIA employer account number, 7 digits"], ["bsoUserId", "SSA Business Services Online user ID (for the W-2 file)"]]
      .map(([k, l]) => `<label class="f" for="c-b-${k}">${l}</label><input id="c-b-${k}" type="text" value="${esc((c.business || {})[k] ?? (k === "state" ? "MI" : ""))}" ${dis}>`).join("")}</div>
    <h3>Attendance and discipline</h3><div class="panel"><p class="help">Points per event, and the point total that triggers each step. Approved sick time never creates points.</p>
    <div class="grid2">${Object.keys(POINT_LABEL).map(k => `<div><label class="f" for="c-pt-${k}">${POINT_LABEL[k]} (points)</label><input id="c-pt-${k}" type="number" inputmode="decimal" min="0" step="0.5" value="${esc(pv[k] ?? DEFAULT_POINTS[k])}" ${dis}></div>`).join("")}</div>
    ${[0, 1, 2, 3].map(i => `<div class="grid2"><div><label class="f" for="c-st-${i}">Step ${i + 1} name</label><input id="c-st-${i}" type="text" value="${esc((steps[i] || {}).name || "")}" ${dis}></div><div><label class="f" for="c-sp-${i}">At points</label><input id="c-sp-${i}" type="number" inputmode="decimal" min="0" step="0.5" value="${esc((steps[i] || {}).points ?? "")}" ${dis}></div></div>`).join("")}
    <label class="f" for="c-exp">Points expire after (days)</label><input id="c-exp" type="number" inputmode="numeric" min="30" step="1" value="${esc(dc.pointsExpireDays ?? 365)}" ${dis}></div>
    ${owner ? `<h3>Owner's own taxes (estimate)</h3><div class="panel"><p class="help">Private: only owners and administrators see this section and the estimate in Books. The profit left after wages, contractor payments and expenses is taxed to the owner personally, whether or not it is taken out of the business account. This sets up the estimate shown in Books and the quarterly payment reminders. It is a set-aside guide, not the return.</p>
    <label class="f" for="c-o-type">How the business is taxed</label><select id="c-o-type" ${dis}><option value="sole" ${(ow.type || "sole") === "sole" ? "selected" : ""}>Sole proprietor or single-member LLC (Schedule C)</option><option value="other" ${ow.type === "other" ? "selected" : ""}>Partnership, S corporation or C corporation</option></select>
    <div class="grid2"><div><label class="f" for="c-o-filing">Owner's filing status</label><select id="c-o-filing" ${dis}><option value="" ${!ow.filing ? "selected" : ""}>Not set</option>${[["Single", "Single"], ["MFJ", "Married filing jointly"], ["HOH", "Head of household"]].map(x => `<option value="${x[0]}" ${ow.filing === x[0] ? "selected" : ""}>${x[1]}</option>`).join("")}</select></div>
    <div><label class="f" for="c-o-city">Owner lives in</label><select id="c-o-city" ${dis}>${cityOptions(ow.homeCity)}</select></div></div>
    <div class="grid2"><div><label class="f" for="c-o-other">Other household income for the year ($)</label><input id="c-o-other" type="number" inputmode="decimal" min="0" step="1" value="${esc(ow.otherIncome ?? "")}" placeholder="0" ${dis}></div>
    <div><label class="f" for="c-o-wages">Of that, W-2 wages ($)</label><input id="c-o-wages" type="number" inputmode="decimal" min="0" step="1" value="${esc(ow.otherWages ?? "")}" placeholder="0" ${dis}></div></div>
    <label class="f" for="c-o-ex">Michigan exemptions (owner, spouse, dependents)</label><input id="c-o-ex" type="number" inputmode="numeric" min="0" step="1" value="${esc(ow.miExemptions ?? 1)}" ${dis}>
    <p class="help">Other income only sets the bracket; the tax on it is not counted here. A spouse's W-2 wages also count toward the Social Security wage base.</p></div>` : ""}
    <h3>Tax rates</h3><p class="help">Official federal tables loaded: ${TAX_TABLE_YEAR}. Later years are projected automatically, so nothing here needs a yearly update unless the IRS changes a rate. Replace the UIA rate and wage base with the numbers on the business's UIA rate notice.</p>
    <div class="panel"><label class="f" for="c-mile">Mileage rate (cents per mile)</label><input id="c-mile" type="number" inputmode="decimal" step="0.5" min="0" value="${esc(Math.round((c.mileageRate ?? 0.70) * 1000) / 10)}" ${dis}>
    <p class="help">The IRS sets the mileage rate each December (70 cents for 2025).</p></div>
    <div class="panel"><label class="f" for="c-infl">Assumed inflation for projected years (%)</label><input id="c-infl" type="number" inputmode="decimal" step="0.1" min="0" max="10" value="${esc(Math.round((c.inflation ?? 0.025) * 1000) / 10)}" ${dis}>
    <p class="help" style="margin-bottom:0">${[1, 2, 3].map(i => { const t = taxTablesFor(TAX_TABLE_YEAR + i, c.inflation ?? 0.025); return `${t.year}: Social Security wage base ${usd(t.ssWageBase)}, single 22% bracket from ${usd(t.thresholds.Single[2])}`; }).join(". ")}.</p></div>
    <div class="panel">${SET_FIELDS.map(f => `<label class="f" for="c-${f[0]}">${f[1]}</label><input id="c-${f[0]}" type="number" inputmode="decimal" step="any" min="0" value="${esc(Math.round(c[f[0]] * f[2] * 1e6) / 1e6)}" ${dis}>`).join("")}</div>
    ${owner ? `<button class="primary" id="c-save">Save settings</button>` : ""}
    <p class="help">Federal income tax uses the IRS Publication 15-T percentage method. Official tables are added to the app each December; until then the next year is projected. This app calculates payroll. It does not file returns or move money.</p>`;
  $("#c-print").onclick = printPolicy;
  if (owner) $("#c-save").onclick = async () => {
    const n = { ...S.cfg, businessName: $("#c-name").value.trim(), payPeriods: Number($("#c-pp").value), weekStart: Number($("#c-ws").value), otMultiplier: num($("#c-ot").value) || 1.5, outsidePolicy: $("#c-pol").value, autoApprove: $("#c-auto").checked,
      hours: { weeklyCap: num($("#c-cap").value) || 40, capMode: $("#c-capmode").value }, inflation: Math.min(0.1, Math.max(0, num($("#c-infl").value) / 100)), mileageRate: num($("#c-mile").value) / 100,
      discipline: { pointValues: Object.fromEntries(Object.keys(POINT_LABEL).map(k => [k, num($("#c-pt-" + k).value)])), steps: [0, 1, 2, 3].map(i => ({ name: $("#c-st-" + i).value.trim(), points: num($("#c-sp-" + i).value) })).filter(s => s.name), pointsExpireDays: Math.max(30, Math.round(num($("#c-exp").value)) || 365) } };
    const ns = { extraUseCap: $("#c-xuse").value === "" ? null : num($("#c-xuse").value), extraCarryCap: $("#c-xcarry").value === "" ? null : num($("#c-xcarry").value),
      waitDays: Math.min(120, Math.max(0, Math.round(num($("#c-wait").value)))), plannedNoticeDays: Math.min(7, Math.max(0, Math.round(num($("#c-notice").value)))), yearBasis: $("#c-basis").value };
    const old = S.cfg.sick || {}, changed = ["extraUseCap", "extraCarryCap", "waitDays", "plannedNoticeDays", "yearBasis"].some(k => (old[k] ?? null) !== (ns[k] ?? null)) || !old.policyVersion
      || (S.status.small_lost_on && (!old.policyUpdatedAt || old.policyUpdatedAt < S.status.small_lost_on));
    n.sick = { ...old, ...ns, policyVersion: changed ? (Number(old.policyVersion) || 0) + 1 : old.policyVersion, policyUpdatedAt: changed ? todayStr() : old.policyUpdatedAt };
    SET_FIELDS.forEach(f => n[f[0]] = num($("#c-" + f[0]).value) / f[2]);
    const ot = { type: $("#c-o-type").value, filing: $("#c-o-filing").value, homeCity: $("#c-o-city").value, otherIncome: num($("#c-o-other").value), otherWages: num($("#c-o-wages").value), miExemptions: num($("#c-o-ex").value) };
    { const r = await sb.from("owner_tax").upsert({ id: 1, data: ot, updated_at: new Date().toISOString() }); if (r.error) return fail(r.error); S.ownerTax = ot; }
    n.business = {}; ["legalName", "tradeName", "ein", "street", "city", "state", "zip", "contactName", "title", "phone", "email", "uiaAccount", "bsoUserId"].forEach(k => n.business[k] = $("#c-b-" + k).value.trim());
    n.business.ein = n.business.ein.replace(/\D/g, ""); n.business.uiaAccount = n.business.uiaAccount.replace(/\D/g, ""); n.business.state = (n.business.state || "MI").toUpperCase();
    const { error } = await sb.from("settings").update({ data: n }).eq("id", 1); if (error) return fail(error); document.activeElement.blur(); S.cfg = n;
    toast(changed ? "Settings saved. Workers will be asked to sign the new policy." : "Settings saved"); refresh(); };
}

/* Shown inside the app, never in a new window: a home-screen app has no way back from one. Print uses the page's own print styles. */
function printPolicy() {
  openSheet(`<div class="bar"><h2>Policy notice</h2><button class="ghost" data-close>Close</button></div>
    <div id="pp-body">${policyText(S.cfg, S.status).replace("<h2>Earned sick time policy</h2>", `<h2 style="font-size:19px">Earned sick time policy</h2><p class="help">${esc(S.cfg.businessName || "")}</p>`)}
    <p style="margin-top:28px">Employee name: ____________________________<br><br>Signature: ____________________________ &nbsp; Date: ____________</p>
    <p class="help">Given to each employee as the written notice required by MCL 408.968. Keep the signed copy for 3 years. Workers can also sign this on their phone under Time off.</p></div>
    <div class="actions"><button class="primary" id="pp-print" style="margin-top:0">Print or save as PDF</button><button class="ghost" data-close>Close</button></div>`);
  $("#pp-print").onclick = () => { try { window.print(); } catch (e) { toast("Printing is not available here. Open the app in Safari or Chrome to print."); } };
}
