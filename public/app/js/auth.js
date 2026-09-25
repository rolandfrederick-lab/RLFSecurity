/* ================= sign in ================= */
function showAuth(mode, msg) {
  $("#app").hidden = true; const a = $("#auth"); a.hidden = false;
  if (!configured) { a.innerHTML = `<div class="auth"><h2>Finish setup</h2><p class="help">Open config.js and paste your Supabase project URL and publishable key. The setup guide has the steps.</p></div>`; return; }
  const forms = {
    signin: `<h2>Sign in</h2><p class="help">Time clock and payroll.</p>
      <label class="f" for="a-email">Email</label><input id="a-email" type="text" inputmode="email" autocomplete="email" autocapitalize="off">
      <label class="f" for="a-pass">Password</label><input id="a-pass" type="password" autocomplete="current-password" style="width:100%;background:var(--paper);border:1px solid var(--line);border-radius:8px;padding:11px 12px;min-height:46px">
      <button class="primary" id="a-go">Sign in</button>
      <button class="linkbtn" data-auth="signup">Create an account</button><br><button class="linkbtn" data-auth="forgot">Forgot password</button>`,
    signup: S.signupCode == null ? `<h2>Create an account</h2><p class="help">Enter the hiring code you were sent. No code? Ask the person who hired you.</p>
      ${hcLockedMin() ? `<p class="note">Too many wrong codes. Try again in ${hcLockedMin()} minute${hcLockedMin() === 1 ? "" : "s"}, or ask for the code to be sent again.</p>` : `
      <label class="f" for="a-code">Hiring code</label><input id="a-code" type="text" autocomplete="one-time-code" autocapitalize="characters" spellcheck="false" maxlength="12" placeholder="XXXX-XXXX" value="${esc(hcFormat(inviteFromUrl()))}" style="letter-spacing:.1em;text-transform:uppercase">
      <button class="primary" id="a-code-go">Continue</button>`}<button class="linkbtn" data-auth="signin">I already have an account</button>`
      : `<h2>Create an account</h2><p class="help">${S.signupCode ? `Hiring code <b>${esc(hcFormat(S.signupCode))}</b> accepted. ` : ""}Next you fill in your paperwork; a manager then approves your account.</p>
      <label class="f" for="a-name">Full name</label><input id="a-name" type="text" autocomplete="name">
      <label class="f" for="a-email">Email</label><input id="a-email" type="text" inputmode="email" autocomplete="email" autocapitalize="off">
      <label class="f" for="a-pass">Password (8 characters or more)</label><input id="a-pass" type="password" autocomplete="new-password" style="width:100%;background:var(--paper);border:1px solid var(--line);border-radius:8px;padding:11px 12px;min-height:46px">
      <button class="primary" id="a-go">Create account</button>${S.signupCode ? `<button class="linkbtn" id="a-recode">Use a different code</button>` : ""}<button class="linkbtn" data-auth="signin">I already have an account</button>`,
    forgot: `<h2>Reset password</h2><label class="f" for="a-email">Email</label><input id="a-email" type="text" inputmode="email" autocomplete="email" autocapitalize="off">
      <button class="primary" id="a-go">Email me a reset link</button><button class="linkbtn" data-auth="signin">Back to sign in</button>`,
    newpass: `<h2>Choose a new password</h2><label class="f" for="a-pass">New password</label><input id="a-pass" type="password" autocomplete="new-password" style="width:100%;background:var(--paper);border:1px solid var(--line);border-radius:8px;padding:11px 12px;min-height:46px">
      <button class="primary" id="a-go">Save password</button>`,
    pending: `<h2>${(S.pendingPaper || {}).w4_signed_at ? "Paperwork done, waiting for approval" : "One more step"}</h2>
      <p class="help">${(S.pendingPaper || {}).w4_signed_at ? "Your tax paperwork is signed. A manager will approve your account and you can start. Check back after they confirm." : "Your account is created. Fill in your tax paperwork now (legal name, address, Social Security number, W-4) so everything is ready before your first day."}</p>
      ${(S.pendingPaper || {}).w4_signed_at ? `<button class="primary" id="a-go">Check again</button><button class="linkbtn" id="a-paper">Review my paperwork</button>` : `<button class="primary" id="a-paper">Fill in my paperwork</button><button class="linkbtn" id="a-go">I will do it later, check again</button>`}
      <br><button class="linkbtn" data-auth="signout">Sign out</button>`
  };
  a.innerHTML = `<div class="auth">${msg ? `<div class="banner">${esc(msg)}</div>` : ""}${forms[mode]}</div>`;
  const ap = $("#a-paper"); if (ap) ap.onclick = () => paperworkSheet(true);
  const rc = $("#a-recode"); if (rc) rc.onclick = () => { S.signupCode = null; showAuth("signup"); };
  const cg = $("#a-code-go"); if (cg) { const ci = $("#a-code"); ci.onkeydown = e => { if (e.key === "Enter") cg.click(); };
    cg.onclick = async () => { const code = hcClean(ci.value); if (code.length !== 8) { toast("The code has 8 letters and numbers, like ABCD-2345."); return ci.focus(); }
      cg.disabled = true; let st; try { st = await q(sb.rpc("check_hire_code", { p_code: code })); } catch (e) { cg.disabled = false; return fail(e); } cg.disabled = false;
      if (st === "ok" || st === "open") { hcSetWall({}); S.signupCode = st === "ok" ? code : ""; return showAuth("signup"); }
      if (st === "used") return showAuth("signup", "That code has already been used. Each code works once. Ask for a new one.");
      if (st === "expired") return showAuth("signup", "That code has expired. Ask for a new one.");
      const left = hcMiss(); showAuth("signup", left > 0 ? `That code is not right. Check it against the message you were sent. ${left} ${left === 1 ? "try" : "tries"} left.` : ""); }; }
  const go = $("#a-go"); if (!go) return;
  go.onclick = async () => {
    const email = ($("#a-email") || {}).value?.trim(), password = ($("#a-pass") || {}).value, btn = $("#a-go"); btn.disabled = true;
    try {
      if (mode === "signin") { const { error } = await sb.auth.signInWithPassword({ email, password }); if (error) throw error; return boot(); }
      else if (mode === "signup") {
        const full_name = $("#a-name").value.trim(); if (!full_name) throw new Error("Enter your full name.");
        if ((password || "").length < 8) throw new Error("Use a password with 8 characters or more.");
        const { data, error } = await sb.auth.signUp({ email, password, options: { data: { full_name, hire_code: S.signupCode || "" } } });
        if (error) { if (/database error/i.test(error.message)) { S.signupCode = null; throw new Error("That hiring code could not be used. It may have just been used, cancelled or expired. Ask for a new one."); } throw error; }
        S.signupCode = null;
        if (!data.session) return showAuth("signin", "Check your email to confirm your account, then sign in."); return boot();
      }
      else if (mode === "forgot") { const { error } = await sb.auth.resetPasswordForEmail(email, { redirectTo: location.origin + location.pathname }); if (error) throw error; showAuth("signin", "If that email has an account, a reset link is on its way."); }
      else if (mode === "newpass") { const { error } = await sb.auth.updateUser({ password }); if (error) throw error; toast("Password saved"); boot(); }
      else if (mode === "pending") boot();
    } catch (e) { fail(e); } btn.disabled = false;
  };
}
async function boot() {
  const { data: { session } } = await sb.auth.getSession();
  if (!session) { if (inviteFromUrl() && S.signupCode == null) return showAuth("signup"); return showAuth("signin"); }
  S.uid = session.user.id;
  let me; try { me = await q(sb.from("profiles").select("*").eq("id", session.user.id).maybeSingle()); } catch (e) { return showAuth("signin", e.message); }
  if (!me) return showAuth("pending", "Your profile was not created. Ask the owner to check the database setup.");
  if (!me.active) { try { S.pendingPaper = await q(sb.rpc("my_pending_paperwork")); } catch (e) { S.pendingPaper = {}; }
    try { const sd = await q(sb.from("staff_details").select("*").eq("profile_id", me.id)); S.staff = {}; sd.forEach(x => S.staff[x.profile_id] = x); } catch (e) { S.staff = {}; } showAuth("pending"); if (!S.pendingPaper.w4_signed_at && !S.paperPrompted) { S.paperPrompted = true; setTimeout(() => paperworkSheet(true), 400); } return; }
  S.me = me; if (me.worker_id) { try { await sb.rpc("apply_pending_paperwork", { p_profile: me.id }); } catch (e) {} } await loadData();
  if (!S.tab) S.tab = isMgr() ? "team" : isContractor() ? "invoices" : "clock";
  $("#auth").hidden = true; $("#app").hidden = false; render();
}
