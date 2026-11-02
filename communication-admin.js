import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "./config.js";
import { ACTIVITIES, DEBRIEF, getRounds, randomVariant, variantLabel, stagesFor, stageLabel } from "./communication-data.js";
import { compareModel, gridHtml, scoreText } from "./communication-shared.js";

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
const $ = (id) => document.getElementById(id);

let session = null;
let user = null;
let poll = null;
let lastPromptHtml = "";
let showModel = false; // desenul de referinta: ascuns in timpul rundei, vizibil la reveal
let overlayOn = false; // suprapunere model peste desenele participantilor
let lastStatus = null;

function code() {
  return Math.random().toString(36).slice(2, 8).toUpperCase();
}

function escapeHtml(s) {
  const d = document.createElement("div");
  d.textContent = s || "";
  return d.innerHTML;
}

// ---------- autentificare + reluare sesiune ----------
async function init() {
  const { data } = await supabase.auth.getSession();
  if (data.session) {
    user = data.session.user;
    await enterAdmin();
  }
}

async function enterAdmin() {
  $("auth-box").hidden = true;
  $("creator").hidden = false;
  await resumeActiveSession();
}

// Dupa refresh / inchiderea tab-ului, reia ultima sesiune neincheiata a acestui trainer
async function resumeActiveSession() {
  const { data } = await supabase
    .from("communication_sessions")
    .select("*")
    .eq("admin_email", user.email)
    .neq("status", "ended")
    .order("created_at", { ascending: false })
    .limit(1);
  if (data && data.length > 0) openSession(data[0]);
}

$("login").onclick = async () => {
  const { data, error } = await supabase.auth.signInWithPassword({
    email: $("email").value.trim(),
    password: $("password").value,
  });
  if (error) {
    $("auth-error").textContent = error.message;
    return;
  }
  user = data.user;
  await enterAdmin();
};

// ---------- creare / deschidere sesiune ----------
document.querySelectorAll("[data-mode]").forEach((b) => {
  b.onclick = () => createSession(b.dataset.mode);
});

async function createSession(mode) {
  const { data, error } = await supabase
    .from("communication_sessions")
    .insert({ session_code: code(), admin_email: user.email, mode, prompt_index: randomVariant(mode) })
    .select()
    .single();
  if (error) {
    alert(error.message);
    return;
  }
  openSession(data);
}

function openSession(s) {
  session = s;
  $("creator").hidden = true;
  $("live").hidden = false;
  $("copy").textContent = "Copiază";
  resetQr();
  startWatch();
  render();
}

function joinUrl() {
  return new URL(`communication.html?s=${session.session_code}`, location.href).href;
}

$("copy").onclick = async () => {
  await navigator.clipboard.writeText(joinUrl());
  $("copy").textContent = "Copiat ✓";
};

// ---------- cod QR (acelasi serviciu si aceleasi butoane ca la celelalte activitati) ----------
function resetQr() {
  $("qr-img").style.display = "none";
  $("qr-btn").textContent = "Arată codul QR";
}

$("qr-btn").onclick = () => {
  const img = $("qr-img");
  if (img.style.display === "none") {
    img.src = `https://api.qrserver.com/v1/create-qr-code/?size=160x160&data=${encodeURIComponent(joinUrl())}`;
    img.style.display = "block";
    $("qr-btn").textContent = "Ascunde codul QR";
  } else {
    resetQr();
  }
};

async function downloadQr(filename, format, triggerBtn) {
  const original = triggerBtn.textContent;
  triggerBtn.textContent = "Se descarcă...";
  triggerBtn.disabled = true;
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=600x600&format=${format}&data=${encodeURIComponent(joinUrl())}`;
  try {
    const res = await fetch(qrUrl);
    if (!res.ok) throw new Error("Serviciul de QR nu a răspuns");
    const objUrl = URL.createObjectURL(await res.blob());
    const link = document.createElement("a");
    link.href = objUrl;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(objUrl);
  } catch (err) {
    // fallback: deschide imaginea intr-un tab nou, ca sa poata fi salvata manual
    window.open(qrUrl, "_blank");
  } finally {
    triggerBtn.textContent = original;
    triggerBtn.disabled = false;
  }
}

$("qr-dl-png-btn").onclick = (e) => downloadQr(`qr-${session.session_code}.png`, "png", e.target);
$("qr-dl-jpg-btn").onclick = (e) => downloadQr(`qr-${session.session_code}.jpg`, "jpg", e.target);

$("overlay-toggle").onchange = (e) => {
  overlayOn = e.target.checked;
  $("results").classList.toggle("show-overlay", overlayOn);
};

// ---------- schimbare varianta (doar in lobby, inainte sa porneasca activitatea) ----------
async function reroll() {
  if (!session || session.status !== "lobby") return;
  const { data, error } = await supabase
    .from("communication_sessions")
    .update({ prompt_index: randomVariant(session.mode, session.prompt_index) })
    .eq("id", session.id)
    .select()
    .single();
  if (error) return alert(error.message);
  session = data;
  render();
}

// ---------- navigare intre etape ----------
$("next").onclick = () => move(1);
$("back").onclick = () => move(-1);

$("end").onclick = async () => {
  if (!confirm("Sigur închei sesiunea? Participanții nu vor mai putea continua și nu se poate relua.")) return;
  await supabase.from("communication_sessions").update({ status: "ended" }).eq("id", session.id);
  session.status = "ended";
  render();
};

async function move(delta) {
  const stages = stagesFor(session.mode);
  const i = Math.max(0, stages.indexOf(session.status)); // o sesiune veche cu etapa necunoscuta porneste de la inceput
  const next = stages[Math.max(0, Math.min(stages.length - 1, i + delta))];
  const { data, error } = await supabase
    .from("communication_sessions")
    .update({ status: next })
    .eq("id", session.id)
    .select()
    .single();
  if (!error) {
    session = data;
    render();
  }
}

// ---------- afisare ----------
const targetHtml = gridHtml;

async function render() {
  if (!session) return;
  const a = ACTIVITIES[session.mode];
  const ended = session.status === "ended";

  $("mode-badge").textContent = stageLabel(session.mode, session.status);
  $("activity-title").textContent = a.name;
  $("join-link").textContent = joinUrl();
  $("status-line").textContent = `Etapa curentă: ${stageLabel(session.mode, session.status)}`;
  $("back").disabled = session.status === "lobby" || ended;
  $("next").disabled = ended;
  $("end").disabled = ended;
  $("link-area").hidden = ended;
  $("ended-note").hidden = !ended;

  // dupa incheiere oprim verificarea periodica si permitem crearea unei sesiuni noi
  if (ended) {
    clearInterval(poll);
    $("creator").hidden = false;
  }

  const isModel = session.mode === "model";
  const r = isModel ? 0 : session.status.includes("2") ? 1 : 0;
  const p = getRounds(session.mode, session.prompt_index)[r];
  let html = "";
  if (session.status !== lastStatus) {
    lastStatus = session.status;
    showModel = session.status.includes("reveal");
  }

  if (session.status === "lobby") {
    html = `<p>Distribuie linkul. Pornește când participanții au intrat.</p>
      <p><b>Variantă:</b> ${escapeHtml(variantLabel(session.mode, session.prompt_index))}</p>
      <button class="btn outline" id="reroll">🎲 Altă variantă</button>`;
  } else if (session.status === "debrief") {
    html = `<ol>${DEBRIEF.map((x) => `<li>${escapeHtml(x)}</li>`).join("")}</ol>`;
  } else if (isModel && !ended) {
    if (session.status === "round1") {
      html = `<p><b>Pasul 1 · Poziționare</b></p>
        <p>Explică verbal poziționarea pieselor, fără să arăți grila. Participanții așază piesele; când treci la pasul următor, ce au pe grilă se trimite automat.</p>
        <div class="rule"><b>Descriere pentru ghid:</b><br>${escapeHtml(p.guide).replace(/\n/g, "<br>")}</div>`;
    } else if (session.status === "round1_reveal") {
      html = `<p><b>Pasul 2 · Reveal individual</b></p>
        <p>Fiecare participant vede, pe ecranul lui, modelul și ce a realizat (verde = piesă la locul ei, roșu = greșită sau în plus). Lasă-le timp, apoi treci la pasul următor.</p>`;
    } else {
      html = `<p><b>Pasul 3 · Rezultatele tuturor</b></p>
        <p>Participanții văd acum rezultatele tuturor colegilor, alături de model. Discutați diferențele înainte de debrief.</p>`;
    }
  } else if (!ended) {
    html = `<p><b>${escapeHtml(p.title)}</b></p><p>${escapeHtml(p.rule)}</p>`;
    if (session.mode === "draw") {
      html += `<div class="rule"><b>Modelul verbal al ghidului:</b><br>${escapeHtml(p.guide)}</div>`;
    }
    if (session.mode === "draw" && p.svg) {
      html += `<div class="model-fig-block">
        <button class="btn outline" id="toggle-model">${showModel ? "Ascunde modelul" : "Arată modelul"}</button>
        ${showModel ? `<div class="model-fig">${p.svg}</div>` : ""}
      </div>`;
    }
    if (session.mode === "model") {
      html += `<div class="rule"><b>Descriere pentru ghid:</b><br>${escapeHtml(p.guide).replace(/\n/g, "<br>")}</div>`;
    }
    if (session.mode === "client") {
      html += `<div class="rule"><b>Mesaj:</b> ${escapeHtml(p.message)}</div>`;
      if (session.status.includes("reveal")) {
        html += `<p><b>Informația lipsă:</b> ${escapeHtml(p.detail)}</p>`;
      }
    }
  }
  if (html !== lastPromptHtml) {
    $("trainer-prompt").innerHTML = html;
    lastPromptHtml = html;
    if ($("reroll")) $("reroll").onclick = reroll;
    if ($("toggle-model")) {
      $("toggle-model").onclick = () => {
        showModel = !showModel;
        render();
      };
    }
  }

  // comutatorul de suprapunere apare doar la desen, dupa lobby
  $("overlay-control").hidden = !(session.mode === "draw" && p.svg && session.status !== "lobby");

  $("target").innerHTML =
    isModel && ["round1", "round1_reveal", "round2_reveal"].includes(session.status)
      ? `<h4>Model-țintă</h4>${targetHtml(p.target)}`
      : "";

  await loadData();
}

async function loadData() {
  const [{ data: parts }, { data: subs }] = await Promise.all([
    supabase.from("communication_participants").select("*").eq("session_id", session.id).order("joined_at"),
    supabase.from("communication_submissions").select("*").eq("session_id", session.id),
  ]);

  $("participants").innerHTML =
    (parts || []).map((p) => `<div>✓ ${escapeHtml(p.alias)}</div>`).join("") || "Niciun participant încă.";

  const ended = session.status === "ended";
  const isModel = session.mode === "model";
  const round = isModel ? 1 : session.status.includes("2") ? 2 : 1;
  const rounds = getRounds(session.mode, session.prompt_index);
  const aliasById = Object.fromEntries((parts || []).map((p) => [p.id, p.alias]));
  $("results").innerHTML =
    (subs || [])
      .filter((s) => (isModel ? s.round === 1 : ended ? true : s.round === round))
      .sort((x, y) => x.round - y.round)
      .map((s) =>
        resultCard(
          (aliasById[s.participant_id] || "Participant") + (ended && !isModel ? ` · runda ${s.round}` : ""),
          s.payload,
          rounds[s.round - 1]?.svg,
          rounds[0]?.target
        )
      )
      .join("") || (ended ? "Niciun răspuns trimis în această sesiune." : "Niciun răspuns pentru această rundă.");
  $("results").classList.toggle("is-draw", session.mode === "draw");
  $("results").classList.toggle("show-overlay", overlayOn);
}

function resultCard(alias, p, svg, target) {
  let body = "";
  if (p.type === "draw") {
    body = `<div class="draw-wrap"><img src="${p.image}" alt="Desen">${svg ? `<div class="model-overlay">${svg}</div>` : ""}</div>`;
  }
  if (p.type === "model") {
    const cmp = target ? compareModel(target, p.positions || []) : null;
    body = targetHtml(p.positions || [], cmp?.marks) + (cmp ? `<p class="hint">${scoreText(cmp)}</p>` : "");
  }
  if (p.type === "client") {
    body =
      (p.assumption ? `<p><b>Interpretare:</b> ${escapeHtml(p.assumption)}</p>` : "") +
      (p.question ? `<p><b>Clarificare:</b> ${escapeHtml(p.question)}</p>` : "") +
      `<p><b>Răspuns:</b> ${escapeHtml(p.answer)}</p>`;
  }
  return `<article class="result-card"><b>${escapeHtml(alias)}</b>${body}</article>`;
}

function startWatch() {
  clearInterval(poll);
  poll = setInterval(async () => {
    const { data } = await supabase.from("communication_sessions").select("*").eq("id", session.id).single();
    if (data) session = data;
    render();
  }, 3000);
}

init();
