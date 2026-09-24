/* ================= website (owner edits rlfsecurity.com) ================= */
/* Text fields and photo slots. Keys match the data-c / data-photo attributes on the public site. */
const WEB_TEXT = [
  ["Contact details (every page)", [["phone", "Direct phone", "313-693-5829"], ["phoneOffice", "Office phone (leave empty to hide it on the site)", "Example: 313-555-0100"], ["email", "Email address", "rolandfrederick@gmail.com"], ["serviceArea", "Service area", "Detroit and surrounding metro area"], ["hours", "Office hours", "Example: Mon to Fri, 9 am to 5 pm"]]],
  ["Home page notice", [["notice", "Short notice shown at the top of the home page (leave empty for none)", "Example: Now hiring licensed officers. Call to apply."]]],
  ["Credentials", [["licenseType", "License type", "Example: Security Guard Agency"], ["licenseNumber", "State of Michigan license number", ""], ["instructorCert", "Instructor certification", "Example: NRA Certified Pistol Instructor"], ["years", "Years in business (number)", "Example: 10"]]],
  ["About page", [["history", "Company history", "When the company was founded, why, and the kinds of clients served since.", true], ["bio", "Owner bio", "Background, years of experience, certifications, and what led to founding the company.", true]]],
  ["Training page", [["priceFundamentals", "Firearm Safety Fundamentals price", "Example: $75"], ["lengthFundamentals", "Firearm Safety Fundamentals length", "Example: 4 hours"], ["priceCpl", "Michigan CPL Class price", "Example: $120"], ["pricePrivate", "Private and family sessions price", "Example: $60 per hour"], ["priceOrg", "Organizational training price", "Example: Quote"],
    ["trainingDates", "Upcoming class dates", "Example: Oct 4 · Oct 18 · Nov 1"], ["bringPolicy", "What students bring (firearm and ammo policy)", "Example: Bring your own handgun and 100 rounds."], ["classroomAddress", "Classroom address", "Example: 123 Main St, Detroit"], ["rangeName", "Range name and city", "Example: Range name, City"]]]
];
const WEB_PHOTOS = [
  ["About page photos", [["aboutTeam", "Team or facility photo"], ["aboutOwner", "Photo of Roland L. Frederick"]]],
  ["Home page gallery: Security in action", [1, 2, 3, 4, 5].map(i => [`home${i}`, `Photo ${i}`, `homeCaption${i}`])],
  ["Services page gallery", [["services1", "Armed & Unarmed Guards"], ["services2", "Healthcare & Crisis Facilities"], ["services3", "Event Security"], ["services4", "Mobile Patrol"], ["services5", "Weapon Safety Training"]]]
];
const HOME_CAPTIONS = ["On Post", "Access Control", "Event Coverage", "Mobile Patrol", "Training"];
/* Width / height of each photo frame on the site, so the editor crops to what visitors see. */
const webAspect = k => k === "aboutTeam" ? 7 / 8 : k === "aboutOwner" ? 4 / 5 : 6 / 5;
const webPhotoUrl = path => `${CONF.SUPABASE_URL}/storage/v1/object/public/website/${path.split("/").map(encodeURIComponent).join("/")}`;
let WEB = null;

async function loadWebsite() { const r = await sb.from("website").select("data").eq("id", 1).single(); if (r.error) throw r.error; WEB = r.data.data || {}; }
async function saveWebsite(data) { const r = await sb.from("website").update({ data }).eq("id", 1).select("data").single(); if (r.error) throw r.error; WEB = r.data.data || {}; }

async function renderWebsite() {
  const v = $("#v-website"); if (document.activeElement && v.contains(document.activeElement) && document.activeElement.tagName !== "BUTTON") return;
  if (!isOwner()) { v.innerHTML = `${backMore}<h2>Website</h2><p class="note">Only an owner can change the website.</p>`; return; }
  if (!WEB) { v.innerHTML = `${backMore}<h2>Website</h2><p class="help">Loading...</p>`; try { await loadWebsite(); } catch (e) { v.innerHTML = `${backMore}<h2>Website</h2><p class="note">The website settings could not be loaded. ${esc(e.message)}</p>`; return; } }
  const d = WEB;
  const text = WEB_TEXT.map(([title, fields]) => `<h3>${esc(title)}</h3><div class="panel">${fields.map(([k, label, ph, long]) => `<label class="f" for="w-${k}">${esc(label)}</label>` +
    (long ? `<textarea id="w-${k}" data-wk="${k}" rows="5" placeholder="${esc(ph)}">${esc(d[k])}</textarea>` : `<input id="w-${k}" data-wk="${k}" type="text" value="${esc(d[k])}" placeholder="${esc(ph)}">`)).join("")}</div>`).join("");
  const photos = WEB_PHOTOS.map(([title, slots]) => `<h3>${esc(title)}</h3><div class="panel webphotos">${slots.map(([k, label, capKey]) => {
    const i = capKey ? Number(k.slice(4)) - 1 : -1;
    return `<div class="webphoto">${d[k] ? `<img src="${esc(webPhotoUrl(d[k]))}" alt="">` : `<div class="webphoto-empty">No photo yet</div>`}
      ${capKey ? `<label class="f" for="w-${capKey}">Caption</label><input id="w-${capKey}" data-wk="${capKey}" type="text" value="${esc(d[capKey])}" placeholder="${esc(HOME_CAPTIONS[i])}">` : `<b>${esc(label)}</b>`}
      <div class="actions"><label class="linkbtn" style="padding:6px 0">${d[k] ? "Replace photo" : "Add photo"}<input type="file" accept="image/*" data-wphoto="${k}" hidden></label>${d[k] ? `<button class="linkbtn" data-wadjust="${k}">Crop and adjust</button><button class="linkbtn" style="color:var(--danger)" data-wremove="${k}">Remove</button>` : ""}</div></div>`; }).join("")}</div>`).join("");
  v.innerHTML = `${backMore}<h2>Website</h2><p class="help">Changes show on <a href="../" target="_blank" rel="noopener">rlfsecurity.com</a> as soon as you save. Empty fields keep the placeholder text shown on the site.</p>
    ${text}<button class="primary" id="w-save">Save text changes</button>
    ${photos}<p class="help">When you add a photo, you can crop it, zoom in, move it, rotate it and change the background before it goes on the site. The full original is kept, so you can re-crop it later with Crop and adjust. Only post photos you have permission to show: faces, client buildings and license plates.</p>`;
  $("#w-save").onclick = async () => {
    const data = { ...WEB }; v.querySelectorAll("[data-wk]").forEach(el => { const val = el.value.trim(); if (val) data[el.dataset.wk] = val; else delete data[el.dataset.wk]; });
    const b = $("#w-save"); b.disabled = true; try { await saveWebsite(data); toast("Website updated"); } catch (e) { fail(e); } finally { b.disabled = false; }
  };
  const label = k => (WEB_PHOTOS.flatMap(x => x[1]).find(x => x[0] === k) || [k, "Photo"])[1];
  /* Upload the framed photo (and the full original for a new one), then point the site at it. */
  const place = async (k, result) => {
    toast("Saving photo..."); const stamp = Date.now(), store = sb.storage.from("website"), put = async (path, blob) => { const up = await store.upload(path, blob, { contentType: "image/jpeg" }); if (up.error) throw up.error; return path; };
    const data = { ...WEB }, old = [WEB[k], result.original ? WEB[k + "Orig"] : null].filter(Boolean);
    data[k] = await put(`${k}-${stamp}.jpg`, result.photo);
    if (result.original) data[k + "Orig"] = await put(`${k}-orig-${stamp}.jpg`, result.original);
    data[k + "Edit"] = result.params;
    await saveWebsite(data); if (old.length) await store.remove(old);
    toast("Photo updated"); renderWebsite();
  };
  v.querySelectorAll("[data-wphoto]").forEach(inp => inp.onchange = async () => {
    const k = inp.dataset.wphoto, file = inp.files[0]; inp.value = ""; if (!file) return;
    if (!/^image\//.test(file.type)) return fail(new Error("Pick a photo (JPG or PNG)."));
    try { const r = await openPhotoEditor({ source: file, aspect: webAspect(k), title: label(k) }); if (r) await place(k, r); } catch (e) { fail(e); } });
  v.querySelectorAll("[data-wadjust]").forEach(b => b.onclick = async () => {
    const k = b.dataset.wadjust, orig = WEB[k + "Orig"];
    try { const r = await openPhotoEditor({ source: webPhotoUrl(orig || WEB[k]), aspect: webAspect(k), params: orig ? WEB[k + "Edit"] : null, title: label(k) }); if (r) await place(k, r); } catch (e) { fail(e); } });
  v.querySelectorAll("[data-wremove]").forEach(b => b.onclick = async () => {
    const k = b.dataset.wremove, old = [WEB[k], WEB[k + "Orig"]].filter(Boolean); if (!confirm("Remove this photo from the website?")) return;
    try { const data = { ...WEB }; delete data[k]; delete data[k + "Orig"]; delete data[k + "Edit"]; await saveWebsite(data); if (old.length) await sb.storage.from("website").remove(old); toast("Photo removed"); renderWebsite(); } catch (e) { fail(e); } });
}
