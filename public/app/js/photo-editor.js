/* ================= photo editor: crop, zoom, move, rotate, background ================= */
/* openPhotoEditor({ source, aspect, params, title }) resolves with
   { photo: Blob (JPEG, framed), original: Blob|null (only for a new file), params } or null if cancelled.
   params = { zoom, u, v, rot, bg } where u/v is the crop center as a fraction of the (rotated) image. */
const MP_VERSION = "1.0.1";
const MP_BASE = `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${MP_VERSION}`;
const MP_MODEL = "https://storage.googleapis.com/mediapipe-models/image_segmenter/selfie_multiclass_256x256/float32/latest/selfie_multiclass_256x256.tflite";
const PE_BACKGROUNDS = [["original", "Original"], ["black", "Black"], ["cream", "Cream"], ["white", "White"], ["gold", "Gold"], ["blur", "Blurred"], ["image", "Your image"]];
let peSegmenter = null;

function peLoadImage(source) {
  return new Promise((resolve, reject) => {
    const img = new Image(), url = source instanceof Blob ? URL.createObjectURL(source) : source;
    if (!(source instanceof Blob)) img.crossOrigin = "anonymous";
    img.onload = () => { if (source instanceof Blob) URL.revokeObjectURL(url); resolve(img); };
    img.onerror = () => reject(new Error("That photo could not be read. Try a JPG or PNG."));
    img.src = url;
  });
}

/* Draw the photo, turned by rot quarter-turns, at most max px on its long side. */
function peBase(img, rot, max = 2000) {
  const s = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight)), w = Math.round(img.naturalWidth * s), h = Math.round(img.naturalHeight * s);
  const c = document.createElement("canvas"), side = rot % 2 === 1; c.width = side ? h : w; c.height = side ? w : h;
  const g = c.getContext("2d"); g.translate(c.width / 2, c.height / 2); g.rotate(rot * Math.PI / 2); g.drawImage(img, -w / 2, -h / 2, w, h);
  return c;
}

async function peGetSegmenter() {
  if (peSegmenter) return peSegmenter;
  const vision = await import(`${MP_BASE}/vision_bundle.mjs`);
  const files = await vision.FilesetResolver.forVisionTasks(`${MP_BASE}/wasm`);
  peSegmenter = await vision.ImageSegmenter.createFromOptions(files, {
    baseOptions: { modelAssetPath: MP_MODEL, delegate: "CPU" }, runningMode: "IMAGE", outputConfidenceMasks: true, outputCategoryMask: false });
  return peSegmenter;
}

/* Cut the people out of the photo: returns a canvas the size of base with the background made transparent. */
async function peCutout(base) {
  const seg = await peGetSegmenter(), res = seg.segment(base);
  try {
    const m = res.confidenceMasks[0], bg = m.getAsFloat32Array(), mw = m.width, mh = m.height;
    const mask = document.createElement("canvas"); mask.width = mw; mask.height = mh;
    const mg = mask.getContext("2d"), md = mg.createImageData(mw, mh);
    for (let i = 0; i < bg.length; i++) { const a = Math.max(0, Math.min(1, (1 - bg[i] - 0.1) / 0.8)); md.data[i * 4 + 3] = Math.round(a * 255); }
    mg.putImageData(md, 0, 0);
    const out = document.createElement("canvas"); out.width = base.width; out.height = base.height;
    const og = out.getContext("2d"); og.drawImage(mask, 0, 0, out.width, out.height); og.globalCompositeOperation = "source-in"; og.drawImage(base, 0, 0);
    return out;
  } finally { res.close && res.close(); }
}

/* The photo with the chosen background behind the cut-out people. */
function peCompose(base, cut, bg, bgImg) {
  if (!cut || bg === "original") return base;
  const c = document.createElement("canvas"); c.width = base.width; c.height = base.height; const g = c.getContext("2d");
  if (bg === "blur") { // shrink and stretch back: a soft blur that works in every browser, including Safari
    const t = document.createElement("canvas"); t.width = Math.max(8, Math.round(c.width / 24)); t.height = Math.max(8, Math.round(c.height / 24));
    t.getContext("2d").drawImage(base, 0, 0, t.width, t.height); g.imageSmoothingQuality = "high"; g.drawImage(t, 0, 0, c.width, c.height); }
  else if (bg === "gold") { const gr = g.createLinearGradient(0, 0, c.width, c.height); gr.addColorStop(0, "#E0BD4A"); gr.addColorStop(1, "#8A6D12"); g.fillStyle = gr; g.fillRect(0, 0, c.width, c.height); }
  else if (bg === "image" && bgImg) { const s = Math.max(c.width / bgImg.naturalWidth, c.height / bgImg.naturalHeight), w = bgImg.naturalWidth * s, h = bgImg.naturalHeight * s; g.drawImage(bgImg, (c.width - w) / 2, (c.height - h) / 2, w, h); }
  else { g.fillStyle = { black: "#0B0B0C", cream: "#F4F1EA", white: "#FFFFFF" }[bg] || "#0B0B0C"; g.fillRect(0, 0, c.width, c.height); }
  g.drawImage(cut, 0, 0);
  return c;
}

/* Draw src into a width x height frame with the given zoom and crop center. */
function peFrame(ctx, src, width, height, p) {
  const cover = Math.max(width / src.width, height / src.height), s = cover * p.zoom;
  const hu = width / (2 * src.width * s), hv = height / (2 * src.height * s);
  p.u = Math.min(1 - hu, Math.max(hu, p.u)); p.v = Math.min(1 - hv, Math.max(hv, p.v));
  ctx.fillStyle = "#0B0B0C"; ctx.fillRect(0, 0, width, height);
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(src, width / 2 - p.u * src.width * s, height / 2 - p.v * src.height * s, src.width * s, src.height * s);
  return s;
}

function openPhotoEditor({ source, aspect, params, title }) {
  return new Promise(async resolve => {
    let img; try { img = await peLoadImage(source); } catch (e) { fail(e); return resolve(null); }
    const p = { zoom: 1, u: 0.5, v: 0.5, rot: 0, bg: "original", ...(params || {}) };
    let base = peBase(img, p.rot), cut = null, bgImg = null, comp = base, done = false;
    const finish = v => { if (done) return; done = true; closeSheet(); resolve(v); };
    openSheet(`<div class="bar"><h2>${esc(title || "Edit photo")}</h2><button class="ghost" id="pe-cancel">Cancel</button></div>
      <p class="help">Drag the photo to move it. Use the slider to zoom in and crop.</p>
      <div class="pe-stage"><canvas id="pe-view" aria-label="Photo preview. Drag to move."></canvas></div>
      <label class="f" for="pe-zoom">Zoom</label><input id="pe-zoom" type="range" min="1" max="4" step="0.01" value="${p.zoom}">
      <div class="actions"><button class="ghost" id="pe-left">Rotate left</button><button class="ghost" id="pe-right">Rotate right</button><button class="ghost" id="pe-reset">Reset</button></div>
      <h3>Background</h3>
      <p class="help" id="pe-bghelp">Remove the background behind people and put a new one in. Works best on photos of people.</p>
      <button class="ghost" id="pe-remove">Remove background</button>
      <div class="pe-bgs" id="pe-bgs" hidden>${PE_BACKGROUNDS.map(([k, n]) => `<button class="ghost" data-pebg="${k}" aria-pressed="${p.bg === k}">${n}</button>`).join("")}</div>
      <input type="file" accept="image/*" id="pe-bgfile" hidden>
      <button class="primary" id="pe-save">Use this photo</button>`);
    const view = $("#pe-view"), ctx = view.getContext("2d");
    const size = () => { const w = Math.min(view.parentElement.clientWidth - 20, 560, Math.round(window.innerHeight * 0.5 * aspect)), h = Math.round(w / aspect), dpr = Math.min(window.devicePixelRatio || 1, 2);
      view.style.width = w + "px"; view.style.height = h + "px"; view.width = Math.round(w * dpr); view.height = Math.round(h * dpr); };
    const draw = () => peFrame(ctx, comp, view.width, view.height, p);
    const rebuild = () => { comp = peCompose(base, cut, p.bg, bgImg); draw(); };
    size(); draw();
    const onResize = () => { if (!done) { size(); draw(); } }; window.addEventListener("resize", onResize);
    const markBg = () => document.querySelectorAll("[data-pebg]").forEach(b => b.setAttribute("aria-pressed", String(b.dataset.pebg === p.bg)));

    // Drag to move (mouse, touch or pen)
    let drag = null;
    view.addEventListener("pointerdown", e => { drag = { x: e.clientX, y: e.clientY, u: p.u, v: p.v }; view.setPointerCapture(e.pointerId); });
    view.addEventListener("pointermove", e => { if (!drag) return; const s = (Math.max(view.width / comp.width, view.height / comp.height) * p.zoom) * (view.clientWidth / view.width);
      p.u = drag.u - (e.clientX - drag.x) / (comp.width * s); p.v = drag.v - (e.clientY - drag.y) / (comp.height * s); draw(); });
    view.addEventListener("pointerup", () => { drag = null; }); view.addEventListener("pointercancel", () => { drag = null; });
    // Arrow keys move too, for keyboard users
    view.tabIndex = 0; view.addEventListener("keydown", e => { const d = { ArrowLeft: [-.02, 0], ArrowRight: [.02, 0], ArrowUp: [0, -.02], ArrowDown: [0, .02] }[e.key]; if (!d) return; e.preventDefault(); p.u += d[0] / p.zoom; p.v += d[1] / p.zoom; draw(); });

    $("#pe-zoom").oninput = e => { p.zoom = Number(e.target.value); draw(); };
    const turn = async d => { p.rot = (p.rot + d + 4) % 4; base = peBase(img, p.rot); p.u = 0.5; p.v = 0.5; if (cut) cut = await peCutout(base); rebuild(); };
    $("#pe-left").onclick = () => turn(-1); $("#pe-right").onclick = () => turn(1);
    $("#pe-reset").onclick = () => { p.zoom = 1; p.u = 0.5; p.v = 0.5; $("#pe-zoom").value = 1; draw(); };

    const removeBg = async () => {
      const b = $("#pe-remove"); b.disabled = true; b.textContent = "Finding the people in the photo...";
      try { cut = await peCutout(base); $("#pe-bgs").hidden = false; b.hidden = true; $("#pe-bghelp").textContent = "Pick the new background."; if (p.bg === "original") p.bg = "black"; markBg(); rebuild(); }
      catch (e) { console.error(e); b.disabled = false; b.textContent = "Remove background"; toast("Background removal could not load. Check the internet connection and try again."); }
    };
    $("#pe-remove").onclick = removeBg;
    document.querySelectorAll("[data-pebg]").forEach(b => b.onclick = () => { if (b.dataset.pebg === "image" && !bgImg) return $("#pe-bgfile").click(); p.bg = b.dataset.pebg; markBg(); rebuild(); });
    $("#pe-bgfile").onchange = async e => { const f = e.target.files[0]; if (!f) return; try { bgImg = await peLoadImage(f); p.bg = "image"; markBg(); rebuild(); } catch (err) { fail(err); } };
    if (p.bg !== "original") removeBg();

    $("#pe-cancel").onclick = () => { window.removeEventListener("resize", onResize); finish(null); };
    $("#pe-save").onclick = async () => {
      const b = $("#pe-save"); b.disabled = true; b.textContent = "Saving...";
      const long = 1600, w = aspect >= 1 ? long : Math.round(long * aspect), h = aspect >= 1 ? Math.round(long / aspect) : long;
      const out = document.createElement("canvas"); out.width = w; out.height = h; peFrame(out.getContext("2d"), comp, w, h, p);
      const toJpeg = c => new Promise(r => c.toBlob(r, "image/jpeg", 0.88));
      const photo = await toJpeg(out), original = source instanceof Blob ? await toJpeg(peBase(img, 0, 2400)) : null;
      window.removeEventListener("resize", onResize);
      finish({ photo, original, params: { zoom: p.zoom, u: p.u, v: p.v, rot: p.rot, bg: p.bg === "image" ? "original" : p.bg } });
    };
  });
}
