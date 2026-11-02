import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "./config.js";
import { ACTIVITIES, DEBRIEF, getRounds, randomVariant, variantLabel, stagesFor, stageLabel } from "./communication-data.js";
import { compareModel, gridHtml, scoreText, parseSteps, stepsHtml, hydrateOverlays, escapeText } from "./communication-shared.js";

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

function setCreator(visible) {
  $("creator").hidden = !visible;
  $("scenarios").hidden = !visible;
}

async function enterAdmin() {
  $("auth-box").hidden = true;
  setCreator(true);
  await loadScenarios();
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
  let scenario = null;
  if (mode === "draw") {
    const sc = pickScenario();
    if (!sc) {
      $("scenario-hint").textContent = "Ca să pornești „Desenează după instrucțiuni”, creează mai întâi un scenariu propriu.";
      $("scenario-hint").hidden = false;
      openScenarioForm();
      $("scenarios").scrollIntoView({ behavior: "smooth", block: "start" });
      return;
    }
    scenario = snapshot(sc);
  }
  const { data, error } = await supabase
    .from("communication_sessions")
    .insert({ session_code: code(), admin_email: user.email, mode, prompt_index: randomVariant(mode), scenario })
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
  setCreator(false);
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
async function changeScenario(id) {
  if (!session || session.status !== "lobby") return;
  const sc = myScenarios.find((x) => x.id === id);
  if (!sc) return;
  const { data, error } = await supabase
    .from("communication_sessions")
    .update({ scenario: snapshot(sc) })
    .eq("id", session.id)
    .select()
    .single();
  if (error) return alert(error.message);
  localStorage.setItem(lastKey(), id);
  session = data;
  render();
}

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
  const stages = stagesFor(session.mode, session);
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

  $("mode-badge").textContent = stageLabel(session.mode, session.status, session);
  $("activity-title").textContent = a.name;
  $("join-link").textContent = joinUrl();
  $("status-line").textContent = `Etapa curentă: ${stageLabel(session.mode, session.status, session)}`;
  $("back").disabled = session.status === "lobby" || ended;
  $("next").disabled = ended;
  $("end").disabled = ended;
  $("link-area").hidden = ended;
  $("ended-note").hidden = !ended;

  // dupa incheiere oprim verificarea periodica si permitem crearea unei sesiuni noi
  if (ended) {
    clearInterval(poll);
    setCreator(true);
  }

  const isModel = session.mode === "model";
  const r = isModel ? 0 : session.status.includes("2") ? 1 : 0;
  const p = getRounds(session.mode, session.prompt_index, session.scenario)[r];
  let html = "";
  if (session.status !== lastStatus) {
    lastStatus = session.status;
    showModel = session.status.includes("reveal");
  }

  if (session.status === "lobby") {
    if (session.mode === "draw") {
      const current = session.scenario;
      const nRounds = getRounds(session.mode, session.prompt_index, session.scenario).length;
      const options = [...myScenarios];
      if (current && !options.some((o) => o.id === current.id)) options.unshift(current); // scenariu sters intre timp: ramane in sesiune
      html = `<p>Distribuie linkul. Pornește când participanții au intrat.</p>
        <p><b>Scenariu:</b> <select id="scenario-select">${options
          .map((o) => `<option value="${escapeHtml(o.id)}"${current && o.id === current.id ? " selected" : ""}>${escapeHtml(o.title)}</option>`)
          .join("")}</select></p>
        <p class="hint">${nRounds} ${nRounds === 1 ? "rundă" : "runde"}. Scenariile se gestionează mai jos, la „Scenariile mele”.</p>`;
    } else {
      html = `<p>Distribuie linkul. Pornește când participanții au intrat.</p>
        <p><b>Variantă:</b> ${escapeHtml(variantLabel(session.mode, session.prompt_index, session.scenario))}</p>
        <button class="btn outline" id="reroll">🎲 Altă variantă</button>`;
    }
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
      html += `<div class="rule"><b>Instrucțiuni de rostit:</b>${stepsHtml(p.steps)}</div>`;
    }
    if (session.mode === "draw" && p.image) {
      html += `<div class="model-fig-block">
        <button class="btn outline" id="toggle-model">${showModel ? "Ascunde modelul" : "Arată modelul"}</button>
        ${showModel ? `<div class="model-fig"><img src="${escapeHtml(p.image)}" alt="Modelul"></div>` : ""}
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
    if ($("scenario-select")) $("scenario-select").onchange = (e) => changeScenario(e.target.value);
    if ($("toggle-model")) {
      $("toggle-model").onclick = () => {
        showModel = !showModel;
        render();
      };
    }
  }

  // comutatorul de suprapunere apare doar la desen, dupa lobby
  $("overlay-control").hidden = !(session.mode === "draw" && p.image && session.status !== "lobby");

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
  const rounds = getRounds(session.mode, session.prompt_index, session.scenario);
  const aliasById = Object.fromEntries((parts || []).map((p) => [p.id, p.alias]));
  $("results").innerHTML =
    (subs || [])
      .filter((s) => (isModel ? s.round === 1 : ended ? true : s.round === round))
      .sort((x, y) => x.round - y.round)
      .map((s) =>
        resultCard(
          (aliasById[s.participant_id] || "Participant") + (ended && !isModel ? ` · runda ${s.round}` : ""),
          s.payload,
          rounds[s.round - 1]?.image,
          rounds[0]?.target
        )
      )
      .join("") || (ended ? "Niciun răspuns trimis în această sesiune." : "Niciun răspuns pentru această rundă.");
  hydrateOverlays($("results"));
  $("results").classList.toggle("is-draw", session.mode === "draw");
  $("results").classList.toggle("show-overlay", overlayOn);
}

function resultCard(alias, p, refImage, target) {
  let body = "";
  if (p.type === "draw") {
    body = `<div class="draw-wrap"><img src="${p.image}" alt="Desen">${refImage ? `<div class="model-overlay" data-src="${escapeHtml(refImage)}"></div>` : ""}</div>`;
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

// =====================================================================
//  „Scenariile mele” (desen): fiecare trainer isi creeaza scenariile; ale altora nu se vad
// =====================================================================
let myScenarios = [];
let form = null; // starea formularului: { id, title, rounds: [{ title, stepsText, image_url, blob, blobUrl, questions }] }

const lastKey = () => `comm_last_scenario_${(user?.email || "").toLowerCase()}`;
const snapshot = (sc) => ({ id: sc.id, title: sc.title, rounds: sc.rounds });

async function loadScenarios() {
  const { data, error } = await supabase
    .from("communication_scenarios")
    .select("*")
    .eq("owner_email", user.email.toLowerCase())
    .eq("mode", "draw")
    .order("created_at", { ascending: false });
  if (error) {
    $("scenario-list").innerHTML = `<p class="error-msg">Nu pot citi scenariile: ${escapeHtml(error.message)}. Ai rulat scriptul SQL pentru scenarii?</p>`;
    myScenarios = [];
    return;
  }
  myScenarios = data || [];
  renderScenarioList();
}

function pickScenario() {
  const last = localStorage.getItem(lastKey());
  return myScenarios.find((s) => s.id === last) || myScenarios[0] || null;
}

function renderScenarioList() {
  $("scenario-list").innerHTML =
    myScenarios
      .map(
        (s) => `<div class="sc-item"><b>${escapeHtml(s.title)}</b>
          <span class="hint">${s.rounds.length} ${s.rounds.length === 1 ? "rundă" : "runde"}${s.rounds.some((r) => r.image_url) ? " · cu imagine" : ""}</span>
          <button class="btn outline" data-sc-edit="${escapeHtml(s.id)}">Editează</button>
          <button class="btn outline" data-sc-del="${escapeHtml(s.id)}">Șterge</button></div>`
      )
      .join("") || `<p class="hint">Nu ai niciun scenariu încă.</p>`;
  document.querySelectorAll("[data-sc-edit]").forEach((b) => (b.onclick = () => openScenarioForm(b.dataset.scEdit)));
  document.querySelectorAll("[data-sc-del]").forEach((b) => (b.onclick = () => deleteScenario(b.dataset.scDel)));
}

function blankRound(i) {
  return { title: "", stepsText: "", image_url: null, blob: null, blobUrl: null, questions: i === 1 };
}

function openScenarioForm(id = null) {
  const sc = id ? myScenarios.find((s) => s.id === id) : null;
  form = {
    id: sc?.id || null,
    title: sc?.title || "",
    rounds: sc
      ? sc.rounds.map((r) => ({ title: r.title || "", stepsText: (r.steps || []).join("\n"), image_url: r.image_url || null, blob: null, blobUrl: null, questions: !!r.questions }))
      : [blankRound(0)],
  };
  $("scenario-form-title").textContent = sc ? "Editează scenariul" : "Scenariu nou";
  $("sc-title").value = form.title;
  $("sc-error").textContent = "";
  renderFormRounds();
  $("scenario-form").hidden = false;
  $("scenario-new").hidden = true;
  $("sc-title").focus();
}

function closeScenarioForm() {
  form?.rounds.forEach((r) => r.blobUrl && URL.revokeObjectURL(r.blobUrl));
  form = null;
  $("scenario-form").hidden = true;
  $("scenario-new").hidden = false;
}

function renderFormRounds() {
  $("sc-rounds").innerHTML = form.rounds
    .map(
      (r, i) => `<fieldset class="sc-round">
        <legend>Runda ${i + 1}</legend>
        <label for="sc-r${i}-title">Titlul rundei (opțional)</label>
        <input id="sc-r${i}-title" type="text" maxlength="80" placeholder="implicit: numele scenariului" value="${escapeHtml(r.title)}">
        <label for="sc-r${i}-steps">Instrucțiunile pe care le rostește trainerul (câte una pe rând; se numerotează automat)</label>
        <textarea id="sc-r${i}-steps" rows="6" placeholder="Desenează un pătrat mare în centru&#10;În interior, un cerc mic sus-stânga&#10;Sub cerc, un triunghi">${escapeHtml(r.stepsText)}</textarea>
        <div class="sc-preview"><b>Previzualizare:</b><div id="sc-r${i}-preview"></div></div>
        <label for="sc-r${i}-image">Imagine de referință (opțional): PNG, JPG sau BMP</label>
        <input type="file" id="sc-r${i}-image" accept=".png,.jpg,.jpeg,.bmp,.webp,image/*">
        <div class="sc-img-preview" id="sc-r${i}-img"></div>
        <button class="btn outline" id="sc-r${i}-img-remove" hidden>Elimină imaginea</button>
        <label class="check"><input type="checkbox" id="sc-r${i}-q"${r.questions ? " checked" : ""}> Participanții pot pune întrebări de clarificare în această rundă</label>
      </fieldset>`
    )
    .join("");
  form.rounds.forEach((r, i) => {
    const refreshPreview = () => {
      $(`sc-r${i}-preview`).innerHTML = stepsHtml(parseSteps($(`sc-r${i}-steps`).value)) || `<span class="hint">Scrie instrucțiunile, câte una pe rând.</span>`;
    };
    $(`sc-r${i}-steps`).oninput = refreshPreview;
    refreshPreview();
    const showImage = () => {
      const src = r.blobUrl || r.image_url;
      $(`sc-r${i}-img`).innerHTML = src ? `<img src="${escapeHtml(src)}" alt="Imagine de referință">` : "";
      $(`sc-r${i}-img-remove`).hidden = !src;
    };
    showImage();
    $(`sc-r${i}-image`).onchange = async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      try {
        const blob = await prepareImage(file);
        if (r.blobUrl) URL.revokeObjectURL(r.blobUrl);
        r.blob = blob;
        r.blobUrl = URL.createObjectURL(blob);
        $("sc-error").textContent = "";
        showImage();
      } catch (err) {
        $("sc-error").textContent = err.message;
        e.target.value = "";
      }
    };
    $(`sc-r${i}-img-remove`).onclick = () => {
      if (r.blobUrl) URL.revokeObjectURL(r.blobUrl);
      r.blob = null;
      r.blobUrl = null;
      r.image_url = null;
      $(`sc-r${i}-image`).value = "";
      showImage();
    };
  });
  $("sc-add-round").hidden = form.rounds.length >= 2;
  $("sc-remove-round").hidden = form.rounds.length < 2;
}

// citeste valorile din campuri in starea formularului
function syncForm() {
  form.title = $("sc-title").value.trim();
  form.rounds.forEach((r, i) => {
    r.title = $(`sc-r${i}-title`).value.trim();
    r.stepsText = $(`sc-r${i}-steps`).value;
    r.questions = $(`sc-r${i}-q`).checked;
  });
}

// Imaginea se aduce la 4:3 (fundal alb), max. 1600x1200, JPEG: se potriveste peste zona de desen, iar BMP/PNG devin fisiere mici
async function prepareImage(file) {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise((resolve, reject) => {
      const i = new Image();
      i.onload = () => resolve(i);
      i.onerror = () => reject(new Error("Nu pot citi imaginea. Folosește un fișier PNG, JPG sau BMP."));
      i.src = url;
    });
    const W = 1600;
    const H = 1200;
    const c = document.createElement("canvas");
    c.width = W;
    c.height = H;
    const g = c.getContext("2d");
    g.fillStyle = "#ffffff";
    g.fillRect(0, 0, W, H);
    const scale = Math.min(W / img.naturalWidth, H / img.naturalHeight);
    const w = img.naturalWidth * scale;
    const h = img.naturalHeight * scale;
    g.drawImage(img, (W - w) / 2, (H - h) / 2, w, h);
    const blob = await new Promise((resolve) => c.toBlob(resolve, "image/jpeg", 0.9));
    if (!blob) throw new Error("Nu am putut pregăti imaginea.");
    return blob;
  } finally {
    URL.revokeObjectURL(url);
  }
}

async function uploadImage(blob) {
  const slug = user.email.toLowerCase().replace(/[^a-z0-9]+/g, "-");
  const path = `communication/${slug}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.jpg`;
  const { error } = await supabase.storage.from("card-images").upload(path, blob, { contentType: "image/jpeg" });
  if (error) throw new Error("Încărcarea imaginii a eșuat: " + error.message);
  return supabase.storage.from("card-images").getPublicUrl(path).data.publicUrl;
}

async function saveScenario() {
  syncForm();
  const err = $("sc-error");
  err.textContent = "";
  if (!form.title) return (err.textContent = "Dă un nume scenariului.");
  const parsed = form.rounds.map((r) => parseSteps(r.stepsText));
  const empty = parsed.findIndex((s) => !s.length);
  if (empty >= 0) return (err.textContent = `Runda ${empty + 1}: scrie cel puțin o instrucțiune.`);

  $("sc-save").disabled = true;
  try {
    const rounds = [];
    for (let i = 0; i < form.rounds.length; i++) {
      const r = form.rounds[i];
      const image_url = r.blob ? await uploadImage(r.blob) : r.image_url;
      rounds.push({ title: r.title, steps: parsed[i], questions: r.questions, image_url: image_url || null });
    }
    const row = { owner_email: user.email.toLowerCase(), mode: "draw", title: form.title, rounds };
    const q = form.id
      ? supabase.from("communication_scenarios").update(row).eq("id", form.id)
      : supabase.from("communication_scenarios").insert(row);
    const { error } = await q;
    if (error) throw new Error(error.message);
    closeScenarioForm();
    $("scenario-hint").hidden = true;
    await loadScenarios();
  } catch (e) {
    err.textContent = e.message;
  } finally {
    $("sc-save").disabled = false;
  }
}

async function deleteScenario(id) {
  const sc = myScenarios.find((s) => s.id === id);
  if (!sc || !confirm(`Ștergi scenariul „${sc.title}”? Sesiunile deja pornite nu sunt afectate.`)) return;
  const { error } = await supabase.from("communication_scenarios").delete().eq("id", id);
  if (error) return alert(error.message);
  await loadScenarios();
}

$("scenario-new").onclick = () => openScenarioForm();
$("sc-cancel").onclick = closeScenarioForm;
$("sc-save").onclick = saveScenario;
$("sc-add-round").onclick = () => {
  syncForm();
  form.rounds.push(blankRound(1));
  renderFormRounds();
};
$("sc-remove-round").onclick = () => {
  syncForm();
  form.rounds.pop();
  renderFormRounds();
};

init();
