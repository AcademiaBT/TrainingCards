import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "./config.js";
import { ACTIVITIES, DEBRIEF } from "./communication-data.js";

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
  hideAll();
  $("error").hidden = false;
  $("error").textContent = msg;
}

// ---------- initializare + intrare ----------
async function init() {
  if (!code) return fail("Link invalid.");
  const { data } = await supabase
    .from("communication_sessions")
    .select("*")
    .eq("session_code", code)
    .maybeSingle();
  if (!data) return fail("Sesiunea nu există.");
  session = data;
  $("title").textContent = ACTIVITIES[session.mode].name;

  const saved = localStorage.getItem(`comm_${session.id}`);
  if (saved) {
    const { data: p } = await supabase.from("communication_participants").select("*").eq("id", saved).maybeSingle();
    me = p;
  }
  render();
  poll = setInterval(refresh, 2500);
}

$("join-btn").onclick = join;
$("alias").addEventListener("keydown", (e) => {
  if (e.key === "Enter") join();
});

async function join() {
  const alias = $("alias").value.trim();
  if (!alias) return ($("join-error").textContent = "Introdu un alias.");
  const { data, error } = await supabase
    .from("communication_participants")
    .insert({ session_id: session.id, alias })
    .select()
    .single();
  if (error) {
    return ($("join-error").textContent = error.code === "23505" ? "Alias deja folosit." : error.message);
  }
  me = data;
  localStorage.setItem(`comm_${session.id}`, me.id);
  render();
}

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
  const p = ACTIVITIES[session.mode].rounds[round - 1];
  $("round-badge").textContent = `Runda ${round}`;
  $("round-title").textContent = p.title;
  $("rule").textContent = p.rule;
  $("submitted").hidden = true;

  if (session.mode === "draw") buildCanvas();
  if (session.mode === "model") buildModel();
  if (session.mode === "client") buildClient(p);
}

// ---------- modul 1: desen ----------
function buildCanvas() {
  $("content").innerHTML = `
    <div class="canvas-tools">
      <button class="btn outline" id="clear-canvas">Șterge tot</button>
      <input id="pen-color" type="color" value="#213a2e">
    </div>
    <canvas class="draw-canvas" id="canvas"></canvas>`;

  canvas = $("canvas");
  const rect = canvas.getBoundingClientRect();
  const ratio = devicePixelRatio || 1;
  canvas.width = rect.width * ratio;
  canvas.height = rect.height * ratio;
  ctx = canvas.getContext("2d");
  ctx.scale(ratio, ratio);
  ctx.lineWidth = 3;
  ctx.lineCap = "round";

  const pos = (e) => {
    const r = canvas.getBoundingClientRect();
    const t = e.touches?.[0] || e;
    return { x: t.clientX - r.left, y: t.clientY - r.top };
  };
  const start = (e) => {
    drawing = true;
    const p = pos(e);
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
    e.preventDefault();
  };
  const move = (e) => {
    if (!drawing) return;
    const p = pos(e);
    ctx.strokeStyle = $("pen-color").value;
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
    e.preventDefault();
  };
  const stop = () => (drawing = false);

  canvas.addEventListener("pointerdown", start);
  canvas.addEventListener("pointermove", move);
  canvas.addEventListener("pointerup", stop);
  canvas.addEventListener("pointerleave", stop);
  $("clear-canvas").onclick = () => ctx.clearRect(0, 0, canvas.width, canvas.height);
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
  const p = ACTIVITIES[session.mode].rounds[round - 1];

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
    own = `<h3>Desenul tău</h3><img src="${x.image}" style="max-width:100%;background:white">`;
  }
  if (x?.type === "client") {
    own = `<p><b>Răspunsul tău:</b> ${escapeHtml(x.answer)}</p>`;
  }

  $("reveal-content").innerHTML = intro + own;
}

init();
