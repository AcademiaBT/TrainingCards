import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "./config.js";
import { ACTIVITIES, DEBRIEF, getRounds } from "./communication-data.js";

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
const $ = (id) => document.getElementById(id);
const code = new URLSearchParams(location.search).get("s");

let session = null;
let me = null;
let round = 1;
let modelPositions = [];
let selectedPiece = null;
let canvas = null;
let ctx = null;
let drawing = false;
let poll = null;

function hideAll() {
  ["join", "waiting", "activity", "reveal", "debrief", "error"].forEach((id) => ($(id).hidden = true));
}

function escapeHtml(s) {
  const d = document.createElement("div");
  d.textContent = s || "";
  return d.innerHTML;
}

function fail(msg) {
  window.__commReady = true;
  hideAll();
  $("error").hidden = false;
  $("error").textContent = msg;
}

// ---------- initializare + intrare ----------
async function init() {
  if (!code) return fail("Link invalid.");
  const { data, error } = await supabase
    .from("communication_sessions")
    .select("*")
    .eq("session_code", code)
    .maybeSingle();
  if (error) {
    console.error(error);
    return fail("Nu pot citi sesiunea: " + error.message);
  }
  if (!data) return fail("Sesiunea nu există.");
  session = data;
  $("title").textContent = ACTIVITIES[session.mode].name;

  const saved = localStorage.getItem(`comm_${session.id}`);
  if (saved) {
    const { data: p } = await supabase.from("communication_participants").select("*").eq("id", saved).maybeSingle();
    me = p;
  }
  render();
  window.__commReady = true;
  poll = setInterval(refresh, 2500);
}

$("join-btn").onclick = join;
$("alias").addEventListener("keydown", (e) => {
  if (e.key === "Enter") join();
});
// daca participantul modifica textul, intrebarea despre alias nu mai e valabila
$("alias").addEventListener("input", hideAliasSuggestion);

let suggestedAlias = null;
let baseAlias = null;

function hideAliasSuggestion() {
  $("alias-suggest").hidden = true;
  suggestedAlias = null;
}

async function join() {
  const alias = $("alias").value.trim();
  hideAliasSuggestion();
  $("join-error").textContent = "";
  if (!alias) {
    $("join-error").textContent = "Introdu un alias.";
    return;
  }
  await register(alias, alias);
}

// Inregistreaza participantul. Daca aliasul e deja luat in aceasta sesiune, il intreaba daca vrea varianta cu sufix.
const norm = (s) => s.trim().toLowerCase();

// Aliasurile deja folosite in sesiune (fara diferenta de majuscule). null daca citirea esueaza.
async function takenAliases() {
  const { data, error } = await supabase.from("communication_participants").select("alias").eq("session_id", session.id);
  if (error) return null;
  return new Set((data || []).map((p) => norm(p.alias)));
}

async function register(alias, base) {
  // verificare prealabila: functioneaza chiar daca regula unique din baza de date lipseste sau difera
  const taken = await takenAliases();
  if (taken && taken.has(norm(alias))) return offerSuffixedAlias(base);

  const { data, error } = await supabase
    .from("communication_participants")
    .insert({ session_id: session.id, alias })
    .select()
    .single();
  if (error) {
    if (error.code === "23505" || /duplicate key|unique constraint/i.test(error.message)) return offerSuffixedAlias(base);
    $("join-error").textContent = error.message;
    return;
  }
  me = data;
  localStorage.setItem(`comm_${session.id}`, me.id);
  hideAliasSuggestion();
  render();
}

// "Pustiu" -> primul "Pustiu (n)" liber, n >= 2 ("Pustiu (2)" devine tot "Pustiu (3)", nu "Pustiu (2) (2)")
async function nextFreeAlias(base) {
  const clean = base.replace(/\s*\(\d+\)$/, "") || base;
  const taken = (await takenAliases()) || new Set();
  let n = 2;
  while (taken.has(norm(`${clean} (${n})`))) n++;
  return `${clean} (${n})`;
}

async function offerSuffixedAlias(base) {
  baseAlias = base;
  suggestedAlias = await nextFreeAlias(base);
  $("alias-suggest-text").textContent = `Aliasul „${base}” e deja folosit. Vrei să apari ca „${suggestedAlias}”?`;
  $("alias-yes").textContent = `Da, apar ca „${suggestedAlias}”`;
  $("alias-suggest").hidden = false;
}

$("alias-yes").onclick = () => {
  if (suggestedAlias) register(suggestedAlias, baseAlias);
};

$("alias-no").onclick = () => {
  hideAliasSuggestion();
  $("alias").value = "";
  $("alias").focus();
  $("join-error").textContent = "Alege un alias diferit.";
};

async function refresh() {
  const { data } = await supabase.from("communication_sessions").select("*").eq("id", session.id).maybeSingle();
  if (!data || data.status === "ended") {
    clearInterval(poll);
    return fail("Sesiunea s-a încheiat.");
  }
  if (data.status !== session.status) {
    session = data;
    modelPositions = [];
    selectedPiece = null;
    render();
  }
}

// ---------- afisare in functie de etapa ----------
function render() {
  hideAll();
  if (!me) {
    $("join").hidden = false;
    return;
  }
  $("my-alias").textContent = me.alias;

  if (session.status === "lobby") {
    $("waiting").hidden = false;
    return;
  }
  if (session.status === "debrief") {
    $("debrief").hidden = false;
    $("debrief-list").innerHTML = DEBRIEF.map((x) => `<li>${escapeHtml(x)}</li>`).join("");
    return;
  }
  if (session.status.includes("reveal")) {
    round = session.status.includes("2") ? 2 : 1;
    showReveal();
    return;
  }
  round = session.status === "round2" ? 2 : 1;
  $("activity").hidden = false;
  buildActivity();
}

function buildActivity() {
  const p = getRounds(session.mode, session.prompt_index)[round - 1];
  $("round-badge").textContent = `Runda ${round}`;
  $("round-title").textContent = p.title;
  $("rule").textContent = p.rule;
  $("submitted").hidden = true;

  if (session.mode === "draw") buildCanvas();
  if (session.mode === "model") buildModel();
  if (session.mode === "client") buildClient(p);
}

// ---------- modul 1: desen ----------
// Rezolutie interna fixa: desenul ramane corect la rotirea telefonului / redimensionarea ferestrei,
// iar imaginea trimisa are mereu aceeasi dimensiune (usoara).
const CANVAS_W = 800;
const CANVAS_H = 600;

const PEN_COLORS = [
  { c: "#1a1a1a", n: "Negru" },
  { c: "#d32f2f", n: "Roșu" },
  { c: "#1565c0", n: "Albastru" },
  { c: "#2e7d32", n: "Verde" },
  { c: "#ef6c00", n: "Portocaliu" },
  { c: "#6a1b9a", n: "Mov" },
  { c: "#6d4c41", n: "Maro" },
];
const PEN_WIDTH = 5;
const ERASER_WIDTH = 32;

function buildCanvas() {
  // pe telefon (ecran ingust sau scund) instructiunile sunt initial inchise, ca sa ramana loc pentru desen
  const compact = window.matchMedia("(max-width: 600px), (orientation: landscape) and (max-height: 520px)").matches;
  $("content").innerHTML = `
    <details class="how-to" ${compact ? "" : "open"}>
      <summary>ℹ️ Cum desenezi</summary>
      <ul>
        <li>Desenezi ținând degetul (sau mouse-ul) apăsat pe zona albă.</li>
        <li><b>Culoare:</b> atinge una dintre bulinele colorate sau bulina multicoloră pentru orice altă culoare.</li>
        <li><b>Radieră:</b> apasă „Radieră”, apoi treci peste ce vrei să ștergi. Revii la desen cu „Creion” sau alegând o culoare.</li>
        <li><b>Șterge tot</b> golește toată pagina.</li>
        <li>Când ești gata, apasă <b>Trimite răspunsul</b>. Dacă mai schimbi ceva, trimite din nou: se păstrează ultima versiune.</li>
      </ul>
    </details>
    <div class="canvas-tools">
      <div class="tool-group" role="group" aria-label="Instrument">
        <button class="tool-btn active" id="tool-pen" aria-pressed="true">✏️ Creion</button>
        <button class="tool-btn" id="tool-eraser" aria-pressed="false">🧽 Radieră</button>
        <button class="tool-btn clear" id="clear-canvas">Șterge tot</button>
      </div>
      <div class="tool-group" role="group" aria-label="Culoare">
        ${PEN_COLORS.map(
          (x, i) =>
            `<button class="swatch${i === 0 ? " active" : ""}" data-color="${x.c}" style="--c:${x.c}" title="${x.n}" aria-label="${x.n}"></button>`
        ).join("")}
        <label class="swatch custom" id="custom-swatch" title="Altă culoare" style="--c:#1a1a1a">
          <input type="color" id="custom-color" value="#1a1a1a" aria-label="Alege o altă culoare">
        </label>
      </div>
    </div>
    <canvas class="draw-canvas" id="canvas" width="${CANVAS_W}" height="${CANVAS_H}"></canvas>`;

  canvas = $("canvas");
  ctx = canvas.getContext("2d");
  const paintBackground = () => {
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
  };
  paintBackground();
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  let tool = "pen";
  let penColor = PEN_COLORS[0].c;
  const applyTool = () => {
    ctx.strokeStyle = tool === "eraser" ? "#ffffff" : penColor;
    ctx.lineWidth = tool === "eraser" ? ERASER_WIDTH : PEN_WIDTH;
  };
  const setTool = (t) => {
    tool = t;
    $("tool-pen").classList.toggle("active", t === "pen");
    $("tool-eraser").classList.toggle("active", t === "eraser");
    $("tool-pen").setAttribute("aria-pressed", String(t === "pen"));
    $("tool-eraser").setAttribute("aria-pressed", String(t === "eraser"));
    canvas.classList.toggle("erasing", t === "eraser");
    applyTool();
  };
  $("tool-pen").onclick = () => setTool("pen");
  $("tool-eraser").onclick = () => setTool("eraser");
  const markActive = (el) => document.querySelectorAll(".swatch").forEach((x) => x.classList.toggle("active", x === el));
  document.querySelectorAll(".swatch[data-color]").forEach((b) => {
    b.onclick = () => {
      penColor = b.dataset.color;
      markActive(b);
      setTool("pen"); // alegerea unei culori te readuce la creion
    };
  });
  // culoare la alegere (selectorul nativ al dispozitivului)
  $("custom-color").oninput = (e) => {
    penColor = e.target.value;
    $("custom-swatch").style.setProperty("--c", penColor);
    markActive($("custom-swatch"));
    setTool("pen");
  };
  applyTool();

  // coordonate in pixelii interni ai canvasului, indiferent cat de mare e afisat
  const pos = (e) => {
    const r = canvas.getBoundingClientRect();
    return {
      x: ((e.clientX - r.left) * CANVAS_W) / r.width,
      y: ((e.clientY - r.top) * CANVAS_H) / r.height,
    };
  };
  const start = (e) => {
    drawing = true;
    canvas.setPointerCapture?.(e.pointerId);
    const p = pos(e);
    applyTool();
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
    // un punct la simpla atingere
    ctx.lineTo(p.x + 0.01, p.y);
    ctx.stroke();
    e.preventDefault();
  };
  const move = (e) => {
    if (!drawing) return;
    const p = pos(e);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
    e.preventDefault();
  };
  const stop = () => (drawing = false);

  canvas.addEventListener("pointerdown", start);
  canvas.addEventListener("pointermove", move);
  canvas.addEventListener("pointerup", stop);
  canvas.addEventListener("pointercancel", stop);
  $("clear-canvas").onclick = paintBackground;
}

// ---------- modul 2: model pe grila 4x4 ----------
function buildModel() {
  const pieces = ["●", "▲", "■", "▬", "➜", "★"];
  $("content").innerHTML = `
    <p>Alege o piesă, apoi un pătrat din grilă. Click pe o piesă plasată o elimină.</p>
    <div class="piece-tray">
      ${pieces.map((s) => `<button class="piece" data-piece="${s}">${s}</button>`).join("")}
    </div>
    <div class="model-grid">
      ${Array.from({ length: 16 }, (_, i) => `<button class="model-cell" data-cell="${i}"></button>`).join("")}
    </div>`;

  document.querySelectorAll("[data-piece]").forEach((b) => {
    b.onclick = () => {
      selectedPiece = b.dataset.piece;
      document.querySelectorAll(".piece").forEach((x) => x.classList.toggle("active", x === b));
    };
  });

  document.querySelectorAll("[data-cell]").forEach((c) => {
    c.onclick = () => {
      const i = +c.dataset.cell;
      const x = i % 4;
      const y = Math.floor(i / 4);
      const idx = modelPositions.findIndex((p) => p.x === x && p.y === y);
      if (idx >= 0) {
        modelPositions.splice(idx, 1);
        c.textContent = "";
        return;
      }
      if (selectedPiece) {
        modelPositions.push({ s: selectedPiece, x, y });
        c.textContent = selectedPiece;
      }
    };
  });
}

// ---------- modul 3: ce ai inteles ----------
function buildClient(p) {
  const r1 = round === 1;
  $("content").innerHTML = `
    <div class="client-box">
      <div class="rule"><b>Client:</b> ${escapeHtml(p.message)}</div>
      ${
        r1
          ? `<label>Ce presupui că este problema?</label><textarea id="assumption"></textarea>`
          : `<label>Ce întrebare de clarificare ai pune?</label><textarea id="question"></textarea>`
      }
      <label>Ce ai răspunde clientului?</label>
      <textarea id="answer"></textarea>
    </div>`;
}

// ---------- trimitere raspuns ----------
$("submit").onclick = submit;

async function submit() {
  let payload;
  if (session.mode === "draw") payload = { type: "draw", image: canvas.toDataURL("image/png") };
  if (session.mode === "model") payload = { type: "model", positions: modelPositions };
  if (session.mode === "client") {
    payload = {
      type: "client",
      assumption: $("assumption")?.value || "",
      question: $("question")?.value || "",
      answer: $("answer").value,
    };
  }
  const { error } = await supabase
    .from("communication_submissions")
    .upsert(
      { session_id: session.id, participant_id: me.id, round, payload },
      { onConflict: "session_id,participant_id,round" }
    );
  if (error) return alert(error.message);
  $("submitted").hidden = false;
}

// ---------- reveal ----------
async function showReveal() {
  $("reveal").hidden = false;
  const p = getRounds(session.mode, session.prompt_index)[round - 1];

  let intro = "";
  if (session.mode === "draw") {
    intro = `<div class="rule"><b>Instrucțiunea originală:</b> ${escapeHtml(p.guide)}</div>`;
  }
  if (session.mode === "model") {
    intro = `<p>Compară rezultatul tău cu modelul descris de trainer.</p>`;
  }
  if (session.mode === "client") {
    intro = `<div class="rule"><b>Informația care lipsea:</b> ${escapeHtml(p.detail)}</div>`;
  }

  const { data } = await supabase
    .from("communication_submissions")
    .select("payload")
    .eq("session_id", session.id)
    .eq("participant_id", me.id)
    .eq("round", round)
    .maybeSingle();

  let own = "";
  const x = data?.payload;
  if (x?.type === "draw") {
    // desenul participantului + desenul de referinta (daca runda are unul): vizualizare simpla, model sau suprapus
    own = p.svg
      ? `<h3>Desenul tău</h3>
         <div class="tool-group view-switch" role="group" aria-label="Vizualizare">
           <button class="tool-btn active" data-view="own">Desenul meu</button>
           <button class="tool-btn" data-view="model">Modelul</button>
           <button class="tool-btn" data-view="both">Suprapus</button>
         </div>
         <div class="draw-wrap reveal-draw" id="reveal-draw" data-view="own">
           <img src="${x.image}" alt="Desenul tău">
           <div class="model-overlay">${p.svg}</div>
         </div>
         <p class="hint" id="reveal-hint" hidden>Modelul apare în roșu peste desenul tău.</p>`
      : `<h3>Desenul tău</h3><img src="${x.image}" style="max-width:100%;background:white">`;
  } else if (session.mode === "draw" && p.svg) {
    own = `<p>Nu ai trimis un desen în această rundă. Iată modelul:</p><div class="model-fig">${p.svg}</div>`;
  }
  if (x?.type === "client") {
    own = `<p><b>Răspunsul tău:</b> ${escapeHtml(x.answer)}</p>`;
  }

  $("reveal-content").innerHTML = intro + own;

  document.querySelectorAll(".view-switch [data-view]").forEach((b) => {
    b.onclick = () => {
      $("reveal-draw").dataset.view = b.dataset.view;
      $("reveal-hint").hidden = b.dataset.view !== "both";
      document.querySelectorAll(".view-switch [data-view]").forEach((o) => o.classList.toggle("active", o === b));
    };
  });
}

init();
