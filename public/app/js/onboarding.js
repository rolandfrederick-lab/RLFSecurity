/* ================= employee paperwork: W-4, MI-W4, address, SSN ================= */
function paperworkSheet(pending) {
  const d = pending ? (S.pendingPaper || {}) : (S.myDetails || {}), w = pending ? { filing: d.filing, step2: d.step2, dependents_credit: d.dependents, extra_withholding: d.extra, other_income: d.other_income, deductions: d.deductions, mi_exemptions: d.mi_exemptions ?? 1, home_city: d.home_city } : (S.workers.find(x => x.id === S.me.worker_id) || {}), ss = 'style="width:100%;background:var(--paper);border:1px solid var(--line);border-radius:8px;padding:11px 12px;min-height:46px"';
  if (!pending && w.type === "1099") return w9Sheet(d, ss);
  openSheet(`<div class="bar"><h2>My tax paperwork</h2><button class="ghost" data-close>Close</button></div>
    <p class="help">${pending ? "Fill this in now so your record is ready before your first day. " : ""}This replaces the paper W-4 and MI-W4. Your Social Security number is encrypted and only the business owner can ever see it, and every time they do it is logged.${pending ? " If you will be paid as a contractor, the W-4 section is simply not used." : ""}${d.w4_signed_at ? ` Last signed ${esc(niceDate(d.w4_signed_at.slice(0, 10)))}.` : ""}</p>
    <h3>Name as on your Social Security card</h3>
    <div class="grid2"><div><label class="f" for="pw-first">First</label><input id="pw-first" type="text" autocomplete="given-name" value="${esc(d.legal_first || "")}"></div><div><label class="f" for="pw-mid">Middle</label><input id="pw-mid" type="text" autocomplete="additional-name" value="${esc(d.legal_middle || "")}"></div></div>
    <label class="f" for="pw-last">Last</label><input id="pw-last" type="text" autocomplete="family-name" value="${esc(d.legal_last || "")}">
    <h3>Home address</h3>
    <label class="f" for="pw-street">Street</label><input id="pw-street" type="text" autocomplete="address-line1" value="${esc(d.street || "")}">
    <label class="f" for="pw-street2">Apt or unit (optional)</label><input id="pw-street2" type="text" autocomplete="address-line2" value="${esc(d.street2 || "")}">
    <div class="grid2"><div><label class="f" for="pw-city">City</label><input id="pw-city" type="text" autocomplete="address-level2" value="${esc(d.city || "")}"></div><div><label class="f" for="pw-zip">ZIP</label><input id="pw-zip" type="text" inputmode="numeric" autocomplete="postal-code" value="${esc(d.zip || "")}"></div></div>
    <label class="f" for="pw-state">State</label><input id="pw-state" type="text" value="${esc(d.state || "MI")}" maxlength="2">
    <label class="f" for="pw-home">City income tax where you live</label><select id="pw-home">${cityOptions(d.home_city || w.home_city)}</select>
    <p class="help">Only Michigan cities that charge an income tax are listed. If your city is not there, choose No city income tax.</p>
    <h3>Social Security number</h3>
    <label class="f" for="pw-ssn">${d.has_ssn ? `On file ending in ${esc(d.ssn_last4)}. Enter it again only to correct it.` : "Needed for your W-2"}</label><input id="pw-ssn" type="password" inputmode="numeric" autocomplete="off" placeholder="###-##-####" ${ss}>
    <h3>Federal Form W-4</h3>
    <label class="f" for="pw-filing">Step 1(c) filing status</label><select id="pw-filing">${[["Single", "Single or married filing separately"], ["MFJ", "Married filing jointly or qualifying surviving spouse"], ["HOH", "Head of household"]].map(o => `<option value="${o[0]}" ${(w.filing || "Single") === o[0] ? "selected" : ""}>${o[1]}</option>`).join("")}</select>
    <label class="check"><input id="pw-step2" type="checkbox" ${w.step2 ? "checked" : ""}> Step 2(c): I hold two jobs, or my spouse also works, and we want the higher withholding</label>
    <div class="grid2"><div><label class="f" for="pw-dep">Step 3: dependents ($ per year)</label><input id="pw-dep" type="number" inputmode="decimal" min="0" step="500" value="${esc(w.dependents_credit || "")}"><p class="help">$2,000 per child under 17, $500 per other dependent.</p></div>
    <div><label class="f" for="pw-extra">Step 4(c): extra to withhold each paycheck ($)</label><input id="pw-extra" type="number" inputmode="decimal" min="0" value="${esc(w.extra_withholding || "")}"></div>
    <div><label class="f" for="pw-oi">Step 4(a): other income ($ per year)</label><input id="pw-oi" type="number" inputmode="decimal" min="0" value="${esc(w.other_income || "")}"></div>
    <div><label class="f" for="pw-ded">Step 4(b): deductions ($ per year)</label><input id="pw-ded" type="number" inputmode="decimal" min="0" value="${esc(w.deductions || "")}"></div></div>
    <h3>Michigan Form MI-W4</h3>
    <label class="f" for="pw-mi">Number of exemptions you claim</label><input id="pw-mi" type="number" inputmode="numeric" min="0" step="1" value="${esc(w.mi_exemptions ?? 1)}">
    <p class="help">Usually 1 for yourself, plus 1 for a spouse and 1 for each dependent. Enter 0 if someone else claims you.</p>
    <h3>Sign</h3><p class="help">Under penalties of perjury, I declare that this certificate, to the best of my knowledge and belief, is true, correct, and complete.</p>
    <label class="f" for="pw-sign">Type your full name to sign</label><input id="pw-sign" type="text" autocomplete="name">
    <button class="primary" id="pw-save">Save and sign</button>`);
  $("#pw-save").onclick = async () => { const b = $("#pw-save"); b.disabled = true;
    const { error } = await sb.rpc(pending ? "submit_pending_paperwork" : "submit_paperwork", { p_first: $("#pw-first").value, p_middle: $("#pw-mid").value, p_last: $("#pw-last").value, p_street: $("#pw-street").value, p_street2: $("#pw-street2").value,
      p_city: $("#pw-city").value, p_state: $("#pw-state").value, p_zip: $("#pw-zip").value, p_ssn: $("#pw-ssn").value || null, p_home_city: $("#pw-home").value, p_filing: $("#pw-filing").value, p_step2: $("#pw-step2").checked,
      p_dependents: num($("#pw-dep").value), p_extra: num($("#pw-extra").value), p_other_income: num($("#pw-oi").value), p_deductions: num($("#pw-ded").value), p_mi_exemptions: num($("#pw-mi").value), p_sign_name: $("#pw-sign").value.trim() });
    b.disabled = false; if (error) return fail(error); closeSheet(); toast("Paperwork saved and signed"); if (pending) { try { S.pendingPaper = await q(sb.rpc("my_pending_paperwork")); } catch (e) {} showAuth("pending"); } else refresh(); };
}

/* Contractors: Form W-9 in place of the W-4. Same encrypted storage for the taxpayer number. */
function w9Sheet(d, ss) {
  openSheet(`<div class="bar"><h2>Form W-9</h2><button class="ghost" data-close>Close</button></div>
    <p class="help">You are paid as an independent contractor. This replaces the paper W-9: it gives the business your taxpayer number for the 1099-NEC you receive each January. No tax is withheld from your pay; you pay your own income and self-employment tax.${d.w4_signed_at ? ` Last signed ${esc(niceDate(d.w4_signed_at.slice(0, 10)))}.` : ""}</p>
    <h3>Name as shown on your tax return</h3>
    <div class="grid2"><div><label class="f" for="pw-first">First</label><input id="pw-first" type="text" value="${esc(d.legal_first || "")}"></div><div><label class="f" for="pw-mid">Middle</label><input id="pw-mid" type="text" value="${esc(d.legal_middle || "")}"></div></div>
    <label class="f" for="pw-last">Last</label><input id="pw-last" type="text" value="${esc(d.legal_last || "")}">
    <h3>Address</h3>
    <label class="f" for="pw-street">Street</label><input id="pw-street" type="text" value="${esc(d.street || "")}"><label class="f" for="pw-street2">Apt or unit</label><input id="pw-street2" type="text" value="${esc(d.street2 || "")}">
    <div class="grid2"><div><label class="f" for="pw-city">City</label><input id="pw-city" type="text" value="${esc(d.city || "")}"></div><div><label class="f" for="pw-zip">ZIP</label><input id="pw-zip" type="text" inputmode="numeric" value="${esc(d.zip || "")}"></div></div>
    <label class="f" for="pw-state">State</label><input id="pw-state" type="text" value="${esc(d.state || "MI")}" maxlength="2">
    <h3>Taxpayer identification number</h3>
    <label class="f" for="pw-ssn">${d.has_ssn ? `On file ending in ${esc(d.ssn_last4)}. Enter again only to correct.` : "Social Security number (or your business EIN if you have one)"}</label><input id="pw-ssn" type="password" inputmode="numeric" autocomplete="off" placeholder="###-##-####" ${ss}>
    <h3>Certification</h3><p class="help">Under penalties of perjury, I certify that the number shown is correct, that I am not subject to backup withholding, and that I am a U.S. person.</p>
    <label class="f" for="pw-sign">Type your full name to sign</label><input id="pw-sign" type="text" autocomplete="name">
    <button class="primary" id="pw-save">Save and sign</button>`);
  $("#pw-save").onclick = async () => { const b = $("#pw-save"); b.disabled = true;
    const { error } = await sb.rpc("submit_paperwork", { p_first: $("#pw-first").value, p_middle: $("#pw-mid").value, p_last: $("#pw-last").value, p_street: $("#pw-street").value, p_street2: $("#pw-street2").value,
      p_city: $("#pw-city").value, p_state: $("#pw-state").value, p_zip: $("#pw-zip").value, p_ssn: $("#pw-ssn").value || null, p_home_city: "none", p_filing: "Single", p_step2: false,
      p_dependents: 0, p_extra: 0, p_other_income: 0, p_deductions: 0, p_mi_exemptions: 0, p_sign_name: $("#pw-sign").value.trim() });
    b.disabled = false; if (error) return fail(error); closeSheet(); toast("W-9 saved and signed"); refresh(); };
}
