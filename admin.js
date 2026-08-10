import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { SUPABASE_URL, SUPABASE_ANON_KEY, GAME_ID } from "./config.js";

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const $ = (id) => document.getElementById(id);

let currentSession = null; // sesiunea activa curenta a trainerului
let deckCards = [];
let controlPreviewBack = {}; // card_id -> bool, doar local pentru trainer (nu afecteaza cursantii)
let selectedCardIds = new Set(); // pentru stergere in bulk
let editingCard = null; // cardul editat curent (null = card nou)

// ---------- AUTH ----------
async function checkAuth() {
  const { data: { session } } = await supabase.auth.getSession();
  if (session) {
    showAdmin();
  } else {
    $("login-view").style.display = "block";
  }
}

$("login-btn").addEventListener("click", async () => {
  const email = $("login-email").value.trim();
  const password = $("login-password").value;
  $("login-error").textContent = "";
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    $("login-error").textContent = "Autentificare eșuată: " + error.message;
    return;
  }
  showAdmin();
});

[$("login-email"), $("login-password")].forEach((input) => {
  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter") $("login-btn").click();
  });
});

$("logout-btn").addEventListener("click", async () => {
  await supabase.auth.signOut();
  location.reload();
});

async function showAdmin() {
  $("login-view").style.display = "none";
  $("admin-view").style.display = "block";
  await loadDeck();
  await loadActiveSession();
}

// ---------- DECK ----------
async function loadDeck() {
  const { data, error } = await supabase
    .from("cards")
    .select("*")
    .eq("game_id", GAME_ID)
    .order("order_index", { ascending: true });
  if (error) {
    console.error(error);
    return;
  }
  deckCards = data || [];
  renderDeck();
  if (currentSession) renderControlGrid();
}

function renderDeck() {
  const grid = $("deck-grid");
  const locked = !!currentSession;
  grid.style.display = locked ? "none" : "grid";
  $("deck-bulk-bar").style.display = !locked && deckCards.length > 0 ? "flex" : "none";
  if (locked) return;
  grid.innerHTML = "";
  if (deckCards.length === 0) {
    grid.innerHTML = `<p style="color:var(--grey); font-size:14px;">Niciun card încă. Adaugă primul card.</p>`;
    return;
  }
  deckCards.forEach((c) => {
    const tile = document.createElement("div");
    tile.className = "card-tile";
    tile.innerHTML = `
      ${locked ? "" : `<div style="padding:8px 8px 0; text-align:left;"><input type="checkbox" data-select="${c.id}" style="width:auto;" ${selectedCardIds.has(c.id) ? "checked" : ""} /></div>`}
      <div class="mini-flip" data-flip>
        <div class="mini-flip-inner">
          <img class="mini-flip-face front" src="${c.front_image_url}" alt="față" />
          <img class="mini-flip-face back" src="${c.back_image_url}" alt="verso" />
        </div>
      </div>
      <div class="tile-label">${escapeHtml(c.title)}</div>
      <div class="tile-controls">
        <button class="toggle-flip show-back-btn">Vezi verso</button>
        ${locked ? "" : `<button class="toggle-flip" data-edit="${c.id}">Editează</button>`}
        ${locked ? "" : `<button class="toggle-flip" style="border-color:var(--red); color:var(--red);" data-delete="${c.id}">Șterge</button>`}
      </div>
    `;
    const flipEl = tile.querySelector("[data-flip]");
    let showingBack = false;
    flipEl.addEventListener("click", () => openLightbox(showingBack ? c.back_image_url : c.front_image_url));
    tile.querySelector(".show-back-btn").addEventListener("click", (e) => {
      e.stopPropagation();
      showingBack = !showingBack;
      flipEl.classList.toggle("flipped", showingBack);
      e.target.textContent = showingBack ? "Vezi față" : "Vezi verso";
    });
    if (!locked) {
      tile.querySelector("[data-select]").addEventListener("change", (e) => {
        if (e.target.checked) selectedCardIds.add(c.id);
        else selectedCardIds.delete(c.id);
        updateBulkBar();
      });
      tile.querySelector("[data-edit]").addEventListener("click", (e) => {
        e.stopPropagation();
        openCardModal(c);
      });
      tile.querySelector("[data-delete]").addEventListener("click", async (e) => {
        e.stopPropagation();
        if (!confirm(`Ștergi cardul „${c.title}”?`)) return;
        const { error } = await supabase.from("cards").delete().eq("id", c.id);
        if (error) {
          alert("Eroare la ștergere: " + error.message);
          return;
        }
        selectedCardIds.delete(c.id);
        await loadDeck();
      });
    }
    grid.appendChild(tile);
  });
  updateBulkBar();
}

function updateBulkBar() {
  $("bulk-delete-btn").innerHTML = `Șterge selectate (<span id="selected-count">${selectedCardIds.size}</span>)`;
  $("bulk-delete-btn").disabled = selectedCardIds.size === 0;
  $("select-all-btn").textContent = selectedCardIds.size === deckCards.length && deckCards.length > 0 ? "Deselectează tot" : "Selectează tot";
}

$("select-all-btn").addEventListener("click", () => {
  const allSelected = selectedCardIds.size === deckCards.length;
  selectedCardIds.clear();
  if (!allSelected) deckCards.forEach((c) => selectedCardIds.add(c.id));
  renderDeck();
});

$("bulk-delete-btn").addEventListener("click", async () => {
  if (selectedCardIds.size === 0) return;
  if (!confirm(`Ștergi definitiv ${selectedCardIds.size} carduri selectate?`)) return;
  const btn = $("bulk-delete-btn");
  btn.disabled = true;
  btn.textContent = "Se șterge...";
  try {
    const { error } = await supabase.from("cards").delete().in("id", Array.from(selectedCardIds));
    if (error) throw error;
    selectedCardIds.clear();
    await loadDeck();
  } catch (err) {
    alert("Eroare la ștergere: " + err.message);
    updateBulkBar();
  }
});

function syncDeckLockUI() {
  const locked = !!currentSession;
  $("deck-edit-actions").style.display = locked ? "none" : "flex";
  $("deck-locked-note").style.display = locked ? "block" : "none";
  renderDeck();
}

function escapeHtml(str) {
  const d = document.createElement("div");
  d.textContent = str || "";
  return d.innerHTML;
}

function openLightbox(src) {
  $("lightbox-img").src = src;
  $("lightbox").style.display = "flex";
}
$("lightbox").addEventListener("click", () => ($("lightbox").style.display = "none"));

// ---------- ADD / EDIT CARD MODAL ----------
$("add-card-btn").addEventListener("click", () => openCardModal(null));

function openCardModal(card) {
  editingCard = card;
  $("modal-title").textContent = card ? `Editează: ${card.title}` : "Card nou";
  $("f-title").value = card ? card.title : "";
  $("f-explanation").value = card ? (card.explanation || "") : "";
  $("f-initial-face").value = card ? card.initial_face : "front";
  $("f-flippable").checked = card ? card.flippable_default : true;
  $("f-front-file").value = "";
  $("f-back-file").value = "";
  $("label-front").textContent = card ? "Imagine față (lasă gol pentru a păstra actuala)" : "Imagine față";
  $("label-back").textContent = card ? "Imagine verso (lasă gol pentru a păstra actuala)" : "Imagine verso";
  if (card) {
    $("f-front-preview").src = card.front_image_url;
    $("f-front-preview").style.display = "block";
    $("f-back-preview").src = card.back_image_url;
    $("f-back-preview").style.display = "block";
  } else {
    $("f-front-preview").style.display = "none";
    $("f-back-preview").style.display = "none";
  }
  $("modal-error").textContent = "";
  $("modal-save-btn").textContent = "Salvează";
  $("card-modal").style.display = "flex";
}
$("modal-cancel-btn").addEventListener("click", () => ($("card-modal").style.display = "none"));

function wirePreview(fileInputId, previewId) {
  $(fileInputId).addEventListener("change", () => {
    const file = $(fileInputId).files[0];
    if (!file) return;
    const url = URL.createObjectURL(file);
    $(previewId).src = url;
    $(previewId).style.display = "block";
  });
}
wirePreview("f-front-file", "f-front-preview");
wirePreview("f-back-file", "f-back-preview");

async function uploadImage(file) {
  const ext = file.name.split(".").pop();
  const path = `${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage.from("card-images").upload(path, file);
  if (error) throw error;
  const { data } = supabase.storage.from("card-images").getPublicUrl(path);
  return data.publicUrl;
}

$("modal-save-btn").addEventListener("click", async () => {
  const title = $("f-title").value.trim();
  const frontFile = $("f-front-file").files[0];
  const backFile = $("f-back-file").files[0];
  $("modal-error").textContent = "";

  if (!title || (!editingCard && (!frontFile || !backFile))) {
    $("modal-error").textContent = "Titlul este obligatoriu" + (editingCard ? "." : ", iar la un card nou, ambele imagini (față + verso) sunt obligatorii.");
    return;
  }

  $("modal-save-btn").disabled = true;
  $("modal-save-btn").textContent = "Se salvează...";
  try {
    const frontUrl = frontFile ? await uploadImage(frontFile) : editingCard.front_image_url;
    const backUrl = backFile ? await uploadImage(backFile) : editingCard.back_image_url;
    const payload = {
      title,
      front_image_url: frontUrl,
      back_image_url: backUrl,
      initial_face: $("f-initial-face").value,
      flippable_default: $("f-flippable").checked,
      explanation: $("f-explanation").value.trim(),
    };
    let error;
    if (editingCard) {
      ({ error } = await supabase.from("cards").update(payload).eq("id", editingCard.id));
    } else {
      ({ error } = await supabase.from("cards").insert({ ...payload, game_id: GAME_ID, order_index: deckCards.length }));
    }
    if (error) throw error;
    $("card-modal").style.display = "none";
    await loadDeck();
  } catch (err) {
    $("modal-error").textContent = "Eroare: " + err.message;
  } finally {
    $("modal-save-btn").disabled = false;
    $("modal-save-btn").textContent = "Salvează";
  }
});

// ---------- BULK UPLOAD ----------
let bulkPairs = []; // { key, order, title, frontFile, backFile }

$("bulk-upload-btn").addEventListener("click", () => {
  bulkPairs = [];
  $("bulk-file-input").value = "";
  $("bulk-preview").innerHTML = "";
  $("bulk-error").textContent = "";
  $("bulk-progress").textContent = "";
  $("bulk-save-btn").disabled = true;
  $("bulk-modal").style.display = "flex";
});
$("bulk-cancel-btn").addEventListener("click", () => ($("bulk-modal").style.display = "none"));

function titleFromSlug(slug) {
  const clean = slug.replace(/^\d+_?/, "").replace(/_+/g, " ").trim();
  return clean.charAt(0).toUpperCase() + clean.slice(1);
}

$("bulk-file-input").addEventListener("change", () => {
  const files = Array.from($("bulk-file-input").files);
  const groups = {}; // key (fara -fata/-verso si extensie) -> {front, back, order}

  files.forEach((file) => {
    const name = file.name.replace(/\.[^.]+$/, ""); // fara extensie
    const m = name.match(/^(.*)_(fata|verso|front|back)$/i);
    if (!m) return; // fisier care nu respecta formatul, il ignoram
    const key = m[1];
    const side = m[2].toLowerCase();
    if (!groups[key]) {
      const orderMatch = key.match(/^(\d+)/);
      groups[key] = { key, order: orderMatch ? parseInt(orderMatch[1], 10) : 999, title: titleFromSlug(key) };
    }
    if (side === "fata" || side === "front") groups[key].frontFile = file;
    else groups[key].backFile = file;
  });

  bulkPairs = Object.values(groups).sort((a, b) => a.order - b.order);
  renderBulkPreview();
});

function renderBulkPreview() {
  const box = $("bulk-preview");
  box.innerHTML = "";
  if (bulkPairs.length === 0) {
    box.innerHTML = `<p style="font-size:13px; color:var(--grey);">Niciun fișier recunoscut. Verifică denumirile (ex: 01-titlu-fata.jpg).</p>`;
    $("bulk-save-btn").disabled = true;
    return;
  }
  let allComplete = true;
  bulkPairs.forEach((p) => {
    const complete = !!p.frontFile && !!p.backFile;
    if (!complete) allComplete = false;
    const row = document.createElement("div");
    row.className = "bulk-pair-row" + (complete ? "" : " incomplete");
    row.innerHTML = `
      <img src="${p.frontFile ? URL.createObjectURL(p.frontFile) : ""}" />
      <img src="${p.backFile ? URL.createObjectURL(p.backFile) : ""}" />
      <input data-key="${p.key}" value="${escapeHtml(p.title)}" />
      ${complete ? "" : `<span class="pair-warning">lipsește ${p.frontFile ? "verso" : "față"}</span>`}
    `;
    row.querySelector("input").addEventListener("input", (e) => {
      p.title = e.target.value;
    });
    box.appendChild(row);
  });
  $("bulk-save-btn").disabled = !allComplete;
  $("bulk-error").textContent = allComplete ? "" : "Completează perechile lipsă sau elimină fișierele orfane înainte de a încărca.";
}

$("bulk-save-btn").addEventListener("click", async () => {
  $("bulk-save-btn").disabled = true;
  $("bulk-error").textContent = "";
  let done = 0;
  try {
    for (const p of bulkPairs) {
      $("bulk-progress").textContent = `Se încarcă ${done + 1}/${bulkPairs.length}: ${p.title}...`;
      const frontUrl = await uploadImage(p.frontFile);
      const backUrl = await uploadImage(p.backFile);
      const { error } = await supabase.from("cards").insert({
        title: p.title,
        front_image_url: frontUrl,
        back_image_url: backUrl,
        initial_face: "front",
        flippable_default: true,
        explanation: "",
        game_id: GAME_ID,
        order_index: p.order,
      });
      if (error) throw error;
      done++;
    }
    $("bulk-progress").textContent = `Gata! ${done} carduri încărcate.`;
    await loadDeck();
    setTimeout(() => ($("bulk-modal").style.display = "none"), 1200);
  } catch (err) {
    $("bulk-error").textContent = `Eroare la cardul ${done + 1}: ${err.message}`;
    $("bulk-save-btn").disabled = false;
  }
});

// ---------- SESSION + GRUPE ----------
let groups = [];        // session_groups pentru sesiunea curenta
let currentGroupId = null; // grupa selectata in panoul de control

function randomCode(len = 6) {
  const chars = "abcdefghjkmnpqrstuvwxyz23456789";
  let out = "";
  for (let i = 0; i < len; i++) out += chars[Math.floor(Math.random() * chars.length)];
  return out;
}

function shuffle(arr) {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function assignCardsToGroups(deck, numGroups, cardsPerGroup, allowRepeat) {
  const result = Array.from({ length: numGroups }, () => []);
  if (allowRepeat) {
    if (cardsPerGroup > deck.length) {
      return {
        assignments: null,
        error: `Deck-ul are doar ${deck.length} carduri, dar ai cerut ${cardsPerGroup} per grupă. Redu numărul de carduri per grupă.`,
      };
    }
    for (let g = 0; g < numGroups; g++) result[g] = shuffle(deck).slice(0, cardsPerGroup).map((c) => c.id);
    return { assignments: result, error: null };
  }
  const needed = cardsPerGroup * numGroups;
  if (needed > deck.length) {
    return {
      assignments: null,
      error: `Ai nevoie de ${needed} carduri unice (${cardsPerGroup} × ${numGroups} grupe), dar deck-ul are doar ${deck.length}. Redu numărul per grupă, activează extragerea „dintr-un deck nou”, sau adaugă mai multe carduri.`,
    };
  }
  const shuffled = shuffle(deck);
  for (let g = 0; g < numGroups; g++) result[g] = shuffled.slice(g * cardsPerGroup, (g + 1) * cardsPerGroup).map((c) => c.id);
  return { assignments: result, error: null };
}

async function loadActiveSession() {
  const { data: { user } } = await supabase.auth.getUser();
  const { data, error } = await supabase
    .from("training_sessions")
    .select("*")
    .eq("admin_email", user.email)
    .eq("status", "active")
    .order("created_at", { ascending: false })
    .limit(1);
  if (error) {
    console.error(error);
    return;
  }
  currentSession = (data && data[0]) || null;
  if (currentSession) await loadGroups();
  else {
    groups = [];
    currentGroupId = null;
  }
  renderSessionPanel();
}

async function loadGroups() {
  const { data: groupRows } = await supabase
    .from("session_groups")
    .select("*")
    .eq("session_id", currentSession.id)
    .order("created_at", { ascending: true });
  groups = groupRows || [];
  if (!currentGroupId || !groups.find((g) => g.id === currentGroupId)) currentGroupId = groups[0]?.id || null;
}

document.querySelectorAll('input[name="draw-mode"]').forEach((r) => {
  r.addEventListener("change", () => {
    const isManual = document.querySelector('input[name="draw-mode"]:checked').value === "manual";
    $("cards-per-group").style.display = isManual ? "none" : "inline-block";
    $("cards-per-group-label").style.display = isManual ? "none" : "block";
  });
});

$("create-session-btn").addEventListener("click", async () => {
  $("groups-error").textContent = "";
  if (deckCards.length === 0) {
    $("groups-error").textContent = "Adaugă cel puțin un card în deck înainte de a crea o sesiune.";
    return;
  }

  const numGroups = Math.max(1, parseInt($("num-groups").value, 10) || 1);
  const drawMode = document.querySelector('input[name="draw-mode"]:checked').value;
  const isManual = drawMode === "manual";

  let assignments = Array.from({ length: numGroups }, () => []); // implicit gol, pt modul manual
  if (!isManual) {
    const cardsPerGroup = Math.max(1, parseInt($("cards-per-group").value, 10) || 1);
    const allowRepeat = drawMode === "repeat";
    const result = assignCardsToGroups(deckCards, numGroups, cardsPerGroup, allowRepeat);
    if (result.error) {
      $("groups-error").textContent = result.error;
      return;
    }
    assignments = result.assignments;
  }

  $("create-session-btn").disabled = true;
  $("create-session-btn").textContent = "Se creează...";
  try {
    const { data: { user } } = await supabase.auth.getUser();
    const code = randomCode();
    const { data: sessionRow, error: sessErr } = await supabase
      .from("training_sessions")
      .insert({ session_code: code, game_id: GAME_ID, admin_email: user.email, status: "active" })
      .select()
      .single();
    if (sessErr) throw sessErr;

    const groupInserts = Array.from({ length: numGroups }, (_, i) => ({
      session_id: sessionRow.id,
      name: `Grupa ${i + 1}`,
      group_code: randomCode(8),
    }));
    const { data: groupRows, error: groupErr } = await supabase.from("session_groups").insert(groupInserts).select();
    if (groupErr) throw groupErr;

    const cardRows = [];
    groupRows.forEach((g, i) => {
      assignments[i].forEach((cardId) => cardRows.push({ session_id: sessionRow.id, group_id: g.id, card_id: cardId, is_flippable: false }));
    });
    if (cardRows.length > 0) {
      const { error: cardErr } = await supabase.from("session_group_cards").insert(cardRows);
      if (cardErr) throw cardErr;
    }

    currentSession = sessionRow;
    groups = groupRows;
    currentGroupId = groups[0]?.id || null;
    renderSessionPanel();
    if (isManual) $("card-picker-panel").style.display = "block"; // deschide direct gestionarea manuala
  } catch (err) {
    $("groups-error").textContent = "Eroare: " + err.message;
  } finally {
    $("create-session-btn").disabled = false;
    $("create-session-btn").textContent = "Creează sesiune și generează grupe";
  }
});

$("end-session-btn").addEventListener("click", async () => {
  if (!currentSession) return;
  if (!confirm("Închei sesiunea curentă pentru toate grupele?")) return;
  await supabase.from("training_sessions").update({ status: "ended" }).eq("id", currentSession.id);
  currentSession = null;
  groups = [];
  currentGroupId = null;
  renderSessionPanel();
});

function groupLink(code) {
  // functioneaza indiferent daca adresa curenta contine "admin.html" sau doar "admin" (URL curat, fara extensie)
  const path = location.pathname.replace(/admin(\.html)?$/, "index.html");
  return `${location.origin}${path}?g=${code}`;
}

async function downloadQr(link, filename, format, triggerBtn) {
  const original = triggerBtn.textContent;
  triggerBtn.textContent = "Se descarcă...";
  triggerBtn.disabled = true;
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=600x600&format=${format}&data=${encodeURIComponent(link)}`;
  try {
    const res = await fetch(qrUrl);
    if (!res.ok) throw new Error("Serviciul de QR nu a răspuns");
    const blob = await res.blob();
    const objUrl = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = objUrl;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(objUrl);
  } catch (err) {
    // fallback: deschide imaginea intr-un tab nou, ca sa poata fi salvata manual
    window.open(qrUrl, "_blank");
  } finally {
    triggerBtn.textContent = original;
    triggerBtn.disabled = false;
  }
}

function renderGroupsList() {
  const box = $("groups-list");
  box.innerHTML = "";
  groups.forEach((g) => {
    const link = groupLink(g.group_code);
    const card = document.createElement("div");
    card.className = "panel";
    card.style.padding = "14px";
    card.style.margin = "0";
    card.innerHTML = `
      <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:8px;">
        <strong class="serif">${escapeHtml(g.name)}</strong>
      </div>
      <div class="session-link-box" style="margin-top:8px;">
        <span>${link}</span>
        <button class="btn outline" data-copy style="padding:4px 10px; font-size:12px;">Copiază</button>
      </div>
      <button class="btn outline" data-qr style="margin-top:8px; font-size:12px; padding:5px 10px;">Arată codul QR</button>
      <div style="display:flex; gap:8px; margin-top:8px;">
        <button class="btn outline" data-dl-png style="font-size:12px; padding:5px 10px;">⬇ Descarcă PNG</button>
        <button class="btn outline" data-dl-jpg style="font-size:12px; padding:5px 10px;">⬇ Descarcă JPG</button>
      </div>
      <img data-qr-img style="display:none; margin-top:8px; width:160px; height:160px; border-radius:8px; border:1px solid var(--parchment-dark); background:#fff;" />
    `;
    card.querySelector("[data-copy]").addEventListener("click", (e) => {
      navigator.clipboard.writeText(link);
      e.target.textContent = "Copiat!";
      setTimeout(() => (e.target.textContent = "Copiază"), 1500);
    });
    const qrBtn = card.querySelector("[data-qr]");
    const qrImg = card.querySelector("[data-qr-img]");
    qrBtn.addEventListener("click", () => {
      if (qrImg.style.display === "none") {
        qrImg.src = `https://api.qrserver.com/v1/create-qr-code/?size=160x160&data=${encodeURIComponent(link)}`;
        qrImg.style.display = "block";
        qrBtn.textContent = "Ascunde codul QR";
      } else {
        qrImg.style.display = "none";
        qrBtn.textContent = "Arată codul QR";
      }
    });
    const safeSlug = g.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
    card.querySelector("[data-dl-png]").addEventListener("click", (e) =>
      downloadQr(link, `qr-${safeSlug}.png`, "png", e.target)
    );
    card.querySelector("[data-dl-jpg]").addEventListener("click", (e) =>
      downloadQr(link, `qr-${safeSlug}.jpg`, "jpg", e.target)
    );
    box.appendChild(card);
  });
}

function renderGroupTabs() {
  const box = $("group-tabs");
  box.innerHTML = "";
  groups.forEach((g) => {
    const btn = document.createElement("button");
    btn.className = "btn " + (g.id === currentGroupId ? "gold" : "outline");
    btn.textContent = g.name;
    btn.addEventListener("click", () => {
      currentGroupId = g.id;
      renderGroupTabs();
      renderControlGrid();
    });
    box.appendChild(btn);
  });
}

// ---------- CRONOMETRU SESIUNE ----------
let timerInterval = null;

function liveRemaining(session) {
  if (!session) return 0;
  if (session.timer_status === "running" && session.timer_started_at) {
    const elapsed = (Date.now() - new Date(session.timer_started_at).getTime()) / 1000;
    return Math.max(0, (session.timer_remaining_seconds || 0) - elapsed);
  }
  return session.timer_remaining_seconds || 0;
}

function secondsToHMS(total) {
  total = Math.max(0, Math.round(total));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return [h, m, s].map((n) => String(n).padStart(2, "0")).join(":");
}

function renderTimerPanel() {
  if (!currentSession) return;
  const status = currentSession.timer_status || "not_started";
  $("timer-setup-box").style.display = status === "not_started" ? "block" : "none";
  $("timer-running-box").style.display = status === "not_started" ? "none" : "block";

  if (status !== "not_started") {
    $("timer-display").textContent = secondsToHMS(liveRemaining(currentSession));
    const labels = { running: "Cronometru pornit — vizibil live la cursanți", paused: "Pauză — cursanții văd timpul înghețat", expired: "⏰ Timpul a expirat" };
    $("timer-status-label").textContent = labels[status] || "";
    $("timer-status-label").style.color = status === "expired" ? "var(--red)" : "var(--grey)";
    $("timer-pause-btn").textContent = status === "paused" ? "Reia" : "Pauză";
    $("timer-pause-btn").style.display = status === "expired" ? "none" : "inline-block";
  }
}

function tickTimer() {
  if (!currentSession || currentSession.timer_status !== "running") return;
  const remaining = liveRemaining(currentSession);
  $("timer-display").textContent = secondsToHMS(remaining);
  if (remaining <= 0) expireTimer();
}

async function expireTimer() {
  if (!currentSession) return;
  currentSession.timer_status = "expired";
  currentSession.timer_remaining_seconds = 0;
  currentSession.timer_started_at = null;
  renderTimerPanel();
  await supabase.from("training_sessions").update({ timer_status: "expired", timer_remaining_seconds: 0, timer_started_at: null }).eq("id", currentSession.id);
}

$("timer-start-btn").addEventListener("click", async () => {
  const h = parseInt($("timer-h").value, 10) || 0;
  const m = parseInt($("timer-m").value, 10) || 0;
  const s = parseInt($("timer-s").value, 10) || 0;
  const total = h * 3600 + m * 60 + s;
  if (total <= 0) {
    alert("Setează o durată mai mare de 0.");
    return;
  }
  const startedAt = new Date().toISOString();
  const { error } = await supabase
    .from("training_sessions")
    .update({ timer_total_seconds: total, timer_remaining_seconds: total, timer_status: "running", timer_started_at: startedAt })
    .eq("id", currentSession.id);
  if (error) {
    alert("Eroare: " + error.message);
    return;
  }
  Object.assign(currentSession, { timer_total_seconds: total, timer_remaining_seconds: total, timer_status: "running", timer_started_at: startedAt });
  renderTimerPanel();
});

$("timer-pause-btn").addEventListener("click", async () => {
  const isPaused = currentSession.timer_status === "paused";
  let update;
  if (isPaused) {
    update = { timer_status: "running", timer_started_at: new Date().toISOString() };
  } else {
    update = { timer_status: "paused", timer_remaining_seconds: Math.round(liveRemaining(currentSession)), timer_started_at: null };
  }
  const { error } = await supabase.from("training_sessions").update(update).eq("id", currentSession.id);
  if (error) {
    alert("Eroare: " + error.message);
    return;
  }
  Object.assign(currentSession, update);
  renderTimerPanel();
});

$("timer-extend-btn").addEventListener("click", async () => {
  const extraMin = Math.max(1, parseInt($("timer-extend-min").value, 10) || 0);
  const extraSeconds = extraMin * 60;
  let update;
  if (currentSession.timer_status === "running") {
    const newRemaining = Math.round(liveRemaining(currentSession)) + extraSeconds;
    update = {
      timer_remaining_seconds: newRemaining,
      timer_started_at: new Date().toISOString(),
      timer_total_seconds: (currentSession.timer_total_seconds || 0) + extraSeconds,
    };
  } else {
    // paused sau expired: reporneste cronometrul cu timpul adaugat
    const newRemaining = (currentSession.timer_remaining_seconds || 0) + extraSeconds;
    update = {
      timer_remaining_seconds: newRemaining,
      timer_status: "running",
      timer_started_at: new Date().toISOString(),
      timer_total_seconds: (currentSession.timer_total_seconds || 0) + extraSeconds,
    };
  }
  const { error } = await supabase.from("training_sessions").update(update).eq("id", currentSession.id);
  if (error) {
    alert("Eroare: " + error.message);
    return;
  }
  Object.assign(currentSession, update);
  renderTimerPanel();
});

function renderSessionPanel() {
  syncDeckLockUI();
  if (currentSession) {
    $("no-session-box").style.display = "none";
    $("active-session-box").style.display = "block";
    $("control-panel").style.display = "block";
    $("session-code-badge").textContent = currentSession.session_code;
    $("groups-list").style.display = "none";
    $("toggle-groups-list-btn").textContent = `Arată linkurile și codurile QR ale grupelor (${groups.length}) ▾`;
    renderGroupsList();
    renderGroupTabs();
    renderControlGrid();
    renderTimerPanel();
    if (!timerInterval) timerInterval = setInterval(tickTimer, 1000);
  } else {
    $("no-session-box").style.display = "block";
    $("active-session-box").style.display = "none";
    $("control-panel").style.display = "none";
    if (timerInterval) {
      clearInterval(timerInterval);
      timerInterval = null;
    }
  }
}

$("toggle-groups-list-btn").addEventListener("click", () => {
  const box = $("groups-list");
  const open = box.style.display !== "none";
  box.style.display = open ? "none" : "flex";
  $("toggle-groups-list-btn").textContent = `${open ? "Arată" : "Ascunde"} linkurile și codurile QR ale grupelor (${groups.length}) ${open ? "▾" : "▴"}`;
});

let controlGroupCards = []; // cache local pentru grupa curent afisata in panoul de control (evita rebuild complet la fiecare click)

async function renderControlGrid() {
  if (!currentSession || !currentGroupId) return;
  const grid = $("control-grid");

  const { data: rows } = await supabase.from("session_group_cards").select("*").eq("group_id", currentGroupId);
  controlGroupCards = (rows || [])
    .map((r) => {
      const card = deckCards.find((c) => c.id === r.card_id);
      return card ? { ...card, is_flippable: r.is_flippable } : null;
    })
    .filter(Boolean)
    .sort((a, b) => (a.order_index ?? 0) - (b.order_index ?? 0));
  const currentGroup = groups.find((g) => g.id === currentGroupId);
  renderCardPicker();

  grid.innerHTML = "";
  if (controlGroupCards.length === 0) {
    grid.innerHTML = `<p style="color:var(--grey); font-size:14px;">Această grupă nu are carduri alocate.</p>`;
    return;
  }

  controlGroupCards.forEach((c) => {
    const isHighlighted = currentGroup && currentGroup.highlighted_card_id === c.id;
    const isFlippable = c.is_flippable;
    const previewBack = !!controlPreviewBack[c.id];
    const tile = document.createElement("div");
    tile.className = "card-tile" + (isHighlighted ? " highlighted" : "");
    tile.dataset.cardId = c.id;
    tile.innerHTML = `
      <div class="mini-flip${previewBack ? " flipped" : ""}" data-flip>
        <div class="mini-flip-inner">
          <img class="mini-flip-face front" src="${c.front_image_url}" alt="${escapeHtml(c.title)}" />
          <img class="mini-flip-face back" src="${c.back_image_url}" alt="${escapeHtml(c.title)}" />
        </div>
      </div>
      <div class="tile-label">${escapeHtml(c.title)}</div>
      <div class="tile-controls">
        <button class="toggle-flip" data-preview>${previewBack ? "Vezi față" : "Vezi verso"}</button>
        <button class="toggle-flip" data-zoom>🔍</button>
        <button class="toggle-flip ${isFlippable ? "active" : ""}" data-toggle>
          ${isFlippable ? "Flip activat" : "Permite răsturnarea"}
        </button>
      </div>
    `;
    tile.querySelector("[data-flip]").addEventListener("click", () => highlightCard(c.id));
    tile.querySelector(".tile-label").addEventListener("click", () => highlightCard(c.id));
    tile.querySelector("[data-preview]").addEventListener("click", (e) => {
      e.stopPropagation();
      togglePreview(c.id);
    });
    tile.querySelector("[data-zoom]").addEventListener("click", (e) => {
      e.stopPropagation();
      const cur = controlGroupCards.find((x) => x.id === c.id);
      openLightbox(controlPreviewBack[c.id] ? cur.back_image_url : cur.front_image_url);
    });
    tile.querySelector("[data-toggle]").addEventListener("click", (e) => {
      e.stopPropagation();
      toggleFlippable(c.id);
    });
    grid.appendChild(tile);
  });
}

// actualizeaza doar clasa "highlighted" pe tile-urile existente, fara sa recreeze DOM-ul (evita flicker-ul de reincarcare a imaginilor)
function updateHighlightUI(cardId) {
  document.querySelectorAll("#control-grid .card-tile").forEach((tile) => {
    tile.classList.toggle("highlighted", tile.dataset.cardId === cardId);
  });
}

// ---------- CARD PICKER: alegere manuala a cardurilor per grupa ----------
$("toggle-picker-btn").addEventListener("click", () => {
  const panel = $("card-picker-panel");
  panel.style.display = panel.style.display === "none" ? "block" : "none";
});

function renderCardPicker() {
  const box = $("card-picker");
  box.innerHTML = "";
  const assignedIds = new Set(controlGroupCards.map((c) => c.id));
  deckCards.forEach((c) => {
    const checked = assignedIds.has(c.id);
    const row = document.createElement("label");
    row.className = "picker-row";
    row.innerHTML = `
      <input type="checkbox" ${checked ? "checked" : ""} />
      <img src="${c.front_image_url}" alt="" />
      <span>${escapeHtml(c.title)}</span>
    `;
    row.querySelector("input").addEventListener("change", (e) => {
      if (e.target.checked) addCardToGroup(c.id);
      else removeCardFromGroup(c.id);
    });
    box.appendChild(row);
  });
}

async function addCardToGroup(cardId) {
  await supabase.from("session_group_cards").insert({
    session_id: currentSession.id,
    group_id: currentGroupId,
    card_id: cardId,
    is_flippable: false,
  });
  await renderControlGrid();
}

async function removeCardFromGroup(cardId) {
  await supabase.from("session_group_cards").delete().eq("group_id", currentGroupId).eq("card_id", cardId);
  await renderControlGrid();
}

async function highlightCard(cardId) {
  if (!currentGroupId) return;
  const g = groups.find((g) => g.id === currentGroupId);
  if (g) g.highlighted_card_id = cardId;
  updateHighlightUI(cardId); // feedback vizual instant
  await supabase.from("session_groups").update({ highlighted_card_id: cardId }).eq("id", currentGroupId);
}

// actualizeaza doar butonul de flip al unui singur tile, fara rebuild complet
function updateTileFlipButton(cardId, isFlippable) {
  const tile = document.querySelector(`#control-grid .card-tile[data-card-id="${cardId}"]`);
  if (!tile) return;
  const btn = tile.querySelector("[data-toggle]");
  btn.textContent = isFlippable ? "Flip activat" : "Permite răsturnarea";
  btn.classList.toggle("active", isFlippable);
}

async function toggleFlippable(cardId) {
  const cached = controlGroupCards.find((c) => c.id === cardId);
  if (!cached) return;
  const next = !cached.is_flippable;
  cached.is_flippable = next;
  updateTileFlipButton(cardId, next); // feedback vizual instant
  await supabase.from("session_group_cards").update({ is_flippable: next }).eq("group_id", currentGroupId).eq("card_id", cardId);
}

// actualizeaza doar imaginea si butonul de preview ale unui singur tile (fata/verso, doar pentru trainer)
function togglePreview(cardId) {
  const cached = controlGroupCards.find((c) => c.id === cardId);
  if (!cached) return;
  const next = !controlPreviewBack[cardId];
  controlPreviewBack[cardId] = next;
  const tile = document.querySelector(`#control-grid .card-tile[data-card-id="${cardId}"]`);
  if (!tile) return;
  tile.querySelector(".mini-flip").classList.toggle("flipped", next);
  const previewBtn = tile.querySelector("[data-preview]");
  previewBtn.textContent = next ? "Vezi față" : "Vezi verso";
}

async function setAllFlippable(value) {
  if (!currentGroupId) return;
  const btn = value ? $("flip-all-on-btn") : $("flip-all-off-btn");
  btn.disabled = true;
  const original = btn.textContent;
  btn.textContent = "Se aplică...";
  await supabase.from("session_group_cards").update({ is_flippable: value }).eq("group_id", currentGroupId);
  controlGroupCards.forEach((c) => {
    c.is_flippable = value;
    updateTileFlipButton(c.id, value);
  });
  btn.disabled = false;
  btn.textContent = original;
}
$("flip-all-on-btn").addEventListener("click", () => setAllFlippable(true));
$("flip-all-off-btn").addEventListener("click", () => setAllFlippable(false));

async function deactivateAndResetFlip() {
  if (!currentGroupId) return;
  const btn = $("flip-all-reset-btn");
  btn.disabled = true;
  const original = btn.textContent;
  btn.textContent = "Se aplică...";
  try {
    const { error: e1 } = await supabase.from("session_group_cards").update({ is_flippable: false }).eq("group_id", currentGroupId);
    if (e1) throw e1;
    // trimite semnalul de resetare: toti cursantii din aceasta grupa isi intorc cardurile inapoi cu fata
    const { error: e2 } = await supabase.from("session_groups").update({ flip_reset_at: new Date().toISOString() }).eq("id", currentGroupId);
    if (e2) throw e2;
    controlGroupCards.forEach((c) => {
      c.is_flippable = false;
      updateTileFlipButton(c.id, false);
    });
  } catch (err) {
    alert("Eroare: " + err.message);
  } finally {
    btn.disabled = false;
    btn.textContent = original;
  }
}
$("flip-all-reset-btn").addEventListener("click", deactivateAndResetFlip);

checkAuth();
