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
    signup: `<h2>Create an account</h2><p class="help">After you sign up, a manager approves your account before you can clock in.</p>
      <label class="f" for="a-name">Full name</label><input id="a-name" type="text" autocomplete="name">
      <label class="f" for="a-email">Email</label><input id="a-email" type="text" inputmode="email" autocomplete="email" autocapitalize="off">
      <label class="f" for="a-pass">Password (8 characters or more)</label><input id="a-pass" type="password" autocomplete="new-password" style="width:100%;background:var(--paper);border:1px solid var(--line);border-radius:8px;padding:11px 12px;min-height:46px">
      <button class="primary" id="a-go">Create account</button><button class="linkbtn" data-auth="signin">I already have an account</button>`,
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
  $("#a-go").onclick = async () => {
    const email = ($("#a-email") || {}).value?.trim(), password = ($("#a-pass") || {}).value, btn = $("#a-go"); btn.disabled = true;
    try {
      if (mode === "signin") { const { error } = await sb.auth.signInWithPassword({ email, password }); if (error) throw error; return boot(); }
      else if (mode === "signup") {
        const full_name = $("#a-name").value.trim(); if (!full_name) throw new Error("Enter your full name.");
        if ((password || "").length < 8) throw new Error("Use a password with 8 characters or more.");
        const { data, error } = await sb.auth.signUp({ email, password, options: { data: { full_name } } }); if (error) throw error;
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
  if (!session) return showAuth("signin");
  let me; try { me = await q(sb.from("profiles").select("*").eq("id", session.user.id).maybeSingle()); } catch (e) { return showAuth("signin", e.message); }
  if (!me) return showAuth("pending", "Your profile was not created. Ask the owner to check the database setup.");
  if (!me.active) { try { S.pendingPaper = await q(sb.rpc("my_pending_paperwork")); } catch (e) { S.pendingPaper = {}; } showAuth("pending"); if (!S.pendingPaper.w4_signed_at && !S.paperPrompted) { S.paperPrompted = true; setTimeout(() => paperworkSheet(true), 400); } return; }
  S.me = me; if (me.worker_id) { try { await sb.rpc("apply_pending_paperwork", { p_profile: me.id }); } catch (e) {} } await loadData();
  if (!S.tab) S.tab = isMgr() ? "team" : isContractor() ? "invoices" : "clock";
  $("#auth").hidden = true; $("#app").hidden = false; render();
}
