import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "./config.js";
import { ACTIVITIES, DEBRIEF } from "./communication-data.js";

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
const $ = (id) => document.getElementById(id);

const stages = ["lobby", "round1", "round1_reveal", "round2", "round2_reveal", "debrief", "ended"];
const labels = {
  lobby: "Lobby",
  round1: "Runda 1 · fără clarificări",
  round1_reveal: "Reveal runda 1",
  round2: "Runda 2 · cu clarificări",
  round2_reveal: "Reveal runda 2",
  debrief: "Debrief",
  ended: "Încheiată",
};

let session = null;
let user = null;
let poll = null;

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
    .insert({ session_code: code(), admin_email: user.email, mode })
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

// ---------- navigare intre etape ----------
$("next").onclick = () => move(1);
$("back").onclick = () => move(-1);

$("end").onclick = async () => {
  await supabase.from("communication_sessions").update({ status: "ended" }).eq("id", session.id);
  session.status = "ended";
  render();
};

async function move(delta) {
  const i = stages.indexOf(session.status);
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
function targetHtml(items) {
  const cells = Array.from({ length: 16 }, () => "");
  items.forEach((p) => (cells[p.y * 4 + p.x] = p.s));
  return `<div class="mini-model">${cells.map((v) => `<span>${v}</span>`).join("")}</div>`;
}

async function render() {
  if (!session) return;
  const a = ACTIVITIES[session.mode];
  const ended = session.status === "ended";

  $("mode-badge").textContent = labels[session.status];
  $("activity-title").textContent = a.name;
  $("join-link").textContent = joinUrl();
  $("status-line").textContent = `Etapa curentă: ${labels[session.status]}`;
  $("back").disabled = session.status === "lobby";
  $("next").disabled = ended;

  // dupa incheiere oprim verificarea periodica si permitem crearea unei sesiuni noi
  if (ended) {
    clearInterval(poll);
    $("creator").hidden = false;
  }

  const r = session.status.includes("2") ? 1 : 0;
  const p = a.rounds[r];
  let html = "";

  if (session.status === "lobby") {
    html = "<p>Distribuie linkul. Pornește când participanții au intrat.</p>";
  } else if (session.status === "debrief") {
    html = `<ol>${DEBRIEF.map((x) => `<li>${escapeHtml(x)}</li>`).join("")}</ol>`;
  } else if (!ended) {
    html = `<p><b>${escapeHtml(p.title)}</b></p><p>${escapeHtml(p.rule)}</p>`;
    if (session.mode === "draw") {
      html += `<div class="rule"><b>Modelul verbal al ghidului:</b><br>${escapeHtml(p.guide)}</div>`;
    }
    if (session.mode === "client") {
      html += `<div class="rule"><b>Mesaj:</b> ${escapeHtml(p.message)}</div>`;
      if (session.status.includes("reveal")) {
        html += `<p><b>Informația lipsă:</b> ${escapeHtml(p.detail)}</p>`;
      }
    }
  }
  $("trainer-prompt").innerHTML = html;

  $("target").innerHTML =
    session.mode === "model" && session.status !== "lobby"
      ? `<h4>Model-țintă, runda ${r + 1}</h4>${targetHtml(p.target)}`
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

  const round = session.status.includes("2") ? 2 : 1;
  const aliasById = Object.fromEntries((parts || []).map((p) => [p.id, p.alias]));
  $("results").innerHTML =
    (subs || [])
      .filter((s) => s.round === round)
      .map((s) => resultCard(aliasById[s.participant_id] || "Participant", s.payload))
      .join("") || "Niciun răspuns pentru această rundă.";
}

function resultCard(alias, p) {
  let body = "";
  if (p.type === "draw") body = `<img src="${p.image}" alt="Desen">`;
  if (p.type === "model") body = targetHtml(p.positions || []);
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
