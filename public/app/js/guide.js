/* ================= in-app guide, rendered from guide.md ================= */
function mdToHtml(md) {
  const lines = md.split(/\r?\n/), out = []; let list = null, para = [];
  const inline = s => esc(s).replace(/\*\*(.+?)\*\*/g, "<b>$1</b>").replace(/`(.+?)`/g, "<code>$1</code>");
  const flush = () => { if (para.length) { out.push(`<p>${inline(para.join(" "))}</p>`); para = []; } if (list) { out.push(`</${list}>`); list = null; } };
  lines.forEach(l => { const h = l.match(/^(#{1,3})\s+(.*)/), li = l.match(/^\s*[-*]\s+(.*)/), ol = l.match(/^\s*\d+\.\s+(.*)/), tbl = l.match(/^\|/);
    if (h) { flush(); const lvl = h[1].length, id = h[2].toLowerCase().replace(/[^a-z0-9]+/g, "-"); out.push(`<h${lvl + 1} id="g-${id}">${inline(h[2])}</h${lvl + 1}>`); }
    else if (li || ol) { if (para.length) { out.push(`<p>${inline(para.join(" "))}</p>`); para = []; } const kind = li ? "ul" : "ol"; if (list !== kind) { if (list) out.push(`</${list}>`); out.push(`<${kind}>`); list = kind; } out.push(`<li>${inline((li || ol)[1])}</li>`); }
    else if (tbl) { flush(); if (/^\|\s*-/.test(l)) return; const cells = l.split("|").slice(1, -1).map(c => c.trim()); const tag = out[out.length - 1] && out[out.length - 1].startsWith("<table") || (out[out.length - 1] || "").startsWith("<tr") ? "td" : "th"; if (tag === "th") out.push(`<table class="gtbl">`); out.push(`<tr>${cells.map(c => `<${tag}>${inline(c)}</${tag}>`).join("")}</tr>`); }
    else if (!l.trim()) { flush(); if ((out[out.length - 1] || "").startsWith("<tr")) out.push("</table>"); }
    else para.push(l.trim()); });
  flush(); if ((out[out.length - 1] || "").startsWith("<tr")) out.push("</table>");
  return out.join("\n");
}
async function renderGuide() {
  const v = $("#v-guide"); v.innerHTML = `${isMgr() ? backMore : `<button class="back" data-tab="more">Back to More</button>`}<h2>Guide</h2><p class="help">Loading</p>`;
  try { const md = await (await fetch("guide.md?v=" + (appVersion || Date.now()))).text(); const html = mdToHtml(md);
    const toc = [...html.matchAll(/<h3 id="([^"]+)">(.*?)<\/h3>/g)].map(m => `<li><a href="#${m[1]}" class="linkbtn" style="padding:4px 0">${m[2]}</a></li>`).join("");
    v.innerHTML = `${isMgr() ? backMore : `<button class="back" data-tab="more">Back to More</button>`}<h2>Guide</h2><div class="panel"><b>Contents</b><ul style="margin:6px 0 0;padding-left:18px">${toc}</ul></div><div class="guide">${html}</div>`;
    v.querySelectorAll("a[href^='#']").forEach(a => a.onclick = e => { e.preventDefault(); const t = document.getElementById(a.getAttribute("href").slice(1)); if (t) t.scrollIntoView({ behavior: "smooth", block: "start" }); });
  } catch (e) { v.innerHTML += `<p class="help">${esc(e.message)}</p>`; }
}
