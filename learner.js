import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "./config.js";

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
const $ = (id) => document.getElementById(id);

const params = new URLSearchParams(location.search);
const groupCode = params.get("g");

let group = null;       // randul din session_groups
let sessionId = null;   // id-ul sesiunii parinte (pentru verificarea statusului)
let cards = [];         // cardurile alocate acestei grupe
let flippableMap = {};  // card_id -> bool, sincronizat de la trainer
let flippedLocal = {};  // card_id -> bool, doar local, la acest user
let lastScrolledHighlight = undefined;
let pollTimer = null; // fallback prin polling, pentru retele care blocheaza WebSocket (Supabase Realtime)

function escapeHtml(str) {
  const d = document.createElement("div");
  d.textContent = str || "";
  return d.innerHTML;
}

async function init() {
  if (!groupCode) {
    $("status-box").innerHTML = `<div class="empty-state">Link invalid. Cere trainerului link-ul grupei tale.</div>`;
    return;
  }

  const { data: groupData, error: groupErr } = await supabase
    .from("session_groups")
    .select("*")
    .eq("group_code", groupCode)
    .maybeSingle();

  if (groupErr || !groupData) {
    $("status-box").innerHTML = `<div class="empty-state">Link invalid sau grupa nu mai există.</div>`;
    return;
  }
  group = groupData;
  sessionId = group.session_id;

  const { data: sessionData } = await supabase
    .from("training_sessions")
    .select("status")
    .eq("id", sessionId)
    .maybeSingle();

  if (!sessionData || sessionData.status !== "active") {
    $("status-box").innerHTML = `<div class="empty-state">Sesiunea nu există sau s-a încheiat. Cere trainerului un link nou.</div>`;
    return;
  }

  const { data: groupCardRows } = await supabase
    .from("session_group_cards")
    .select("*")
    .eq("group_id", group.id);

  const cardIds = (groupCardRows || []).map((r) => r.card_id);
  (groupCardRows || []).forEach((r) => (flippableMap[r.card_id] = r.is_flippable));

  if (cardIds.length > 0) {
    const { data: cardData } = await supabase
      .from("cards")
      .select("*")
      .in("id", cardIds)
      .order("order_index", { ascending: true });
    cards = cardData || [];
  }

  render();
  subscribeRealtime();
  startPolling();
}

// fallback: unele retele (firewall/proxy de firma) blocheaza conexiunile WebSocket folosite de Realtime.
// Verificam periodic prin cereri HTTP normale, ca sesiunea sa ramana sincronizata oricum.
function startPolling() {
  pollTimer = setInterval(pollUpdates, 4000);
}

async function pollUpdates() {
  if (!group) return;
  try {
    const { data: sessionData } = await supabase.from("training_sessions").select("status").eq("id", sessionId).maybeSingle();
    if (!sessionData || sessionData.status !== "active") {
      showSessionEnded();
      return;
    }

    let changed = false;

    const { data: groupData } = await supabase
      .from("session_groups")
      .select("highlighted_card_id, flip_reset_at")
      .eq("id", group.id)
      .maybeSingle();
    if (groupData && groupData.highlighted_card_id !== group.highlighted_card_id) {
      group.highlighted_card_id = groupData.highlighted_card_id;
      changed = true;
    }
    if (groupData && groupData.flip_reset_at !== group.flip_reset_at) {
      group.flip_reset_at = groupData.flip_reset_at;
      flippedLocal = {};
      $("learner-lightbox").style.display = "none";
      changed = true;
    }

    const { data: cardRows } = await supabase.from("session_group_cards").select("card_id, is_flippable").eq("group_id", group.id);
    (cardRows || []).forEach((r) => {
      if (flippableMap[r.card_id] !== r.is_flippable) {
        flippableMap[r.card_id] = r.is_flippable;
        changed = true;
      }
    });

    if (changed) render();
  } catch (err) {
    // eroare temporara de retea - reincercam la urmatorul ciclu, fara sa intrerupem experienta
  }
}

function render() {
  const grid = $("learner-grid");
  grid.innerHTML = "";
  if (cards.length === 0) {
    grid.innerHTML = `<div class="empty-state">Trainerul nu a alocat încă niciun card pentru grupa ta.</div>`;
    return;
  }

  cards.forEach((c) => {
    const isHighlighted = group.highlighted_card_id === c.id;
    const canFlip = !!flippableMap[c.id];
    const isFlipped = !!flippedLocal[c.id];

    const wrap = document.createElement("div");
    wrap.className = "flip-card-wrap";
    wrap.dataset.cardId = c.id;

    const zoomBtn = document.createElement("button");
    zoomBtn.className = "zoom-btn";
    zoomBtn.textContent = "🔍";
    zoomBtn.title = "Vezi mărit";
    zoomBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      const frontDisplay = c.initial_face === "back" ? c.back_image_url : c.front_image_url;
      const backDisplay = c.initial_face === "back" ? c.front_image_url : c.back_image_url;
      openLightbox(flippedLocal[c.id] ? backDisplay : frontDisplay);
    });

    const flip = document.createElement("div");
    flip.className = "flip-card" + (isHighlighted ? " is-highlighted" : "") + (canFlip ? " can-flip" : "") + (isFlipped ? " flipped" : "");
    flip.innerHTML = `
      <div class="flip-card-inner">
        <div class="flip-face front"><img src="${c.initial_face === "back" ? c.back_image_url : c.front_image_url}" /></div>
        <div class="flip-face back"><img src="${c.initial_face === "back" ? c.front_image_url : c.back_image_url}" /></div>
      </div>
    `;
    if (canFlip) {
      flip.addEventListener("click", () => {
        const newState = !flippedLocal[c.id];
        flippedLocal[c.id] = newState;
        flip.classList.toggle("flipped", newState); // actualizare directa - permite animatiei sa ruleze
        let expEl = wrap.querySelector(".card-explanation");
        if (newState && c.explanation) {
          if (!expEl) {
            expEl = document.createElement("div");
            expEl.className = "card-explanation";
            expEl.style.cssText = "font-size:12px; color:var(--grey); margin-top:6px; text-align:center;";
            expEl.textContent = c.explanation;
            wrap.appendChild(expEl);
          }
        } else if (expEl) {
          expEl.remove();
        }
      });
    }

    const label = document.createElement("div");
    label.className = "card-title";
    label.textContent = c.title;

    wrap.appendChild(zoomBtn);
    wrap.appendChild(flip);
    wrap.appendChild(label);

    if (isFlipped && c.explanation) {
      const exp = document.createElement("div");
      exp.className = "card-explanation";
      exp.style.cssText = "font-size:12px; color:var(--grey); margin-top:6px; text-align:center;";
      exp.textContent = c.explanation;
      wrap.appendChild(exp);
    }

    grid.appendChild(wrap);
  });

  scrollToHighlighted();
}

function scrollToHighlighted() {
  if (!group || !group.highlighted_card_id) return;
  if (group.highlighted_card_id === lastScrolledHighlight) return;
  lastScrolledHighlight = group.highlighted_card_id;
  $("learner-lightbox").style.display = "none";
  const el = document.querySelector(`[data-card-id="${group.highlighted_card_id}"]`);
  if (el) el.scrollIntoView({ behavior: "smooth", block: "center", inline: "center" });
}

function openLightbox(src) {
  $("learner-lightbox-img").src = src;
  $("learner-lightbox").style.display = "flex";
}
$("learner-lightbox").addEventListener("click", () => ($("learner-lightbox").style.display = "none"));

function showSessionEnded() {
  if (pollTimer) clearInterval(pollTimer);
  supabase.removeAllChannels();
  $("learner-grid").innerHTML = "";
  $("learner-lightbox").style.display = "none";
  $("status-box").innerHTML = `<div class="empty-state">Sesiunea nu există sau s-a încheiat. Cere trainerului un link nou.</div>`;
}

function subscribeRealtime() {
  supabase
    .channel(`group-${group.id}`)
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "training_sessions", filter: `id=eq.${sessionId}` },
      (payload) => {
        if (payload.new.status !== "active") showSessionEnded();
      }
    )
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "session_groups", filter: `id=eq.${group.id}` },
      (payload) => {
        const flipWasReset = payload.new.flip_reset_at !== group.flip_reset_at;
        group = { ...group, ...payload.new };
        if (flipWasReset) {
          flippedLocal = {};
          $("learner-lightbox").style.display = "none";
        }
        render();
      }
    )
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "session_group_cards", filter: `group_id=eq.${group.id}` },
      (payload) => {
        flippableMap[payload.new.card_id] = payload.new.is_flippable;
        render();
      }
    )
    .subscribe();
}

init();
