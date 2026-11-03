// Funcții comune pentru „Reconstruiește modelul” (pagina participantului și pagina trainerului)

const key = (p) => `${p.x},${p.y}`;

// Compară ce a așezat participantul cu modelul-țintă. O piesă e corectă dacă are același simbol în același pătrat.
export function compareModel(target, own = []) {
  const marks = {};
  let correct = 0;
  own.forEach((p) => {
    const hit = target.some((t) => t.s === p.s && t.x === p.x && t.y === p.y);
    marks[key(p)] = hit ? "ok" : "bad";
    if (hit) correct++;
  });
  return { correct, total: target.length, wrong: own.length - correct, marks };
}

// Grila 4×4; `marks` (opțional) colorează pătratele: „ok” = verde, „bad” = roșu
export function gridHtml(items = [], marks = {}, opts = {}) {
  const cells = Array.from({ length: 16 }, () => ({ s: "", cls: "" }));
  items.forEach((p) => {
    cells[p.y * 4 + p.x] = { s: p.s, cls: marks[key(p)] || "" };
  });
  const cell = (c) => `<span class="${c.cls}">${c.s}</span>`;
  if (opts.axes) {
    // rândurile (1–4, de sus în jos) și coloanele (1–4, de la stânga la dreapta) sunt numerotate: sistem de referință comun
    const head = `<span class="axis"></span>${[1, 2, 3, 4].map((n) => `<span class="axis">${n}</span>`).join("")}`;
    const rows = [0, 1, 2, 3].map((r) => `<span class="axis">${r + 1}</span>${cells.slice(r * 4, r * 4 + 4).map(cell).join("")}`).join("");
    return `<div class="mini-model axes">${head}${rows}</div>`;
  }
  return `<div class="mini-model">${cells.map(cell).join("")}</div>`;
}

export function scoreText(cmp) {
  const base = `${cmp.correct} din ${cmp.total} piese la locul lor`;
  return cmp.wrong > 0 ? `${base} · ${cmp.wrong} ${cmp.wrong === 1 ? "piesă greșită" : "piese greșite"}` : base;
}

// ---------------------------------------------------------------------
//  Instrucțiuni ca listă numerotată
// ---------------------------------------------------------------------
const esc = (t) => String(t ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
export const escapeText = esc;

// O instrucțiune pe rând. Prefixele „1.”, „2)”, „-”, „•” (de ex. la lipirea din Word) se elimină; numerotarea e automată.
export function parseSteps(text = "") {
  return String(text)
    .split(/\r?\n/)
    .map((line) => line.replace(/^\s*(?:\d+\s*[.)]|[-•*–])\s*/, "").trim())
    .filter(Boolean);
}

export function stepsHtml(steps = []) {
  return steps.length ? `<ol class="steps">${steps.map((t) => `<li>${esc(t)}</li>`).join("")}</ol>` : "";
}

// ---------------------------------------------------------------------
//  Imaginea de referință ca „suprapunere” roșie: liniile închise devin roșu transparent, fundalul alb dispare.
//  Imaginile sunt normalizate la 4:3 la încărcare, deci se potrivesc peste zona de desen (800×600).
// ---------------------------------------------------------------------
const tintDone = new Map(); // url -> data URL (sau false dacă nu s-a putut procesa)

function loadImage(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = url;
  });
}

async function computeTint(url) {
  try {
    const img = await loadImage(url);
    const w = 800;
    const h = 600;
    const c = document.createElement("canvas");
    c.width = w;
    c.height = h;
    const g = c.getContext("2d");
    g.fillStyle = "#fff";
    g.fillRect(0, 0, w, h);
    g.drawImage(img, 0, 0, w, h);
    const d = g.getImageData(0, 0, w, h);
    const px = d.data;
    for (let i = 0; i < px.length; i += 4) {
      const lum = 0.299 * px[i] + 0.587 * px[i + 1] + 0.114 * px[i + 2];
      px[i] = 211;
      px[i + 1] = 47;
      px[i + 2] = 47;
      px[i + 3] = Math.max(0, Math.min(255, (255 - lum) * 1.4));
    }
    g.putImageData(d, 0, 0);
    return c.toDataURL("image/png");
  } catch {
    return false; // ex. imagine fără CORS: se folosește amestecarea „multiply”
  }
}

function fillOverlay(el, tinted) {
  el.innerHTML = tinted ? `<img src="${tinted}" alt="">` : `<img class="blend" src="${esc(el.dataset.src)}" alt="">`;
}

// Completează elementele <div class="model-overlay" data-src="URL"> din `root`
export function hydrateOverlays(root = document) {
  root.querySelectorAll(".model-overlay[data-src]").forEach(async (el) => {
    if (el.firstChild) return;
    const url = el.dataset.src;
    if (tintDone.has(url)) return fillOverlay(el, tintDone.get(url));
    const tinted = await computeTint(url);
    tintDone.set(url, tinted);
    fillOverlay(el, tinted);
  });
}
