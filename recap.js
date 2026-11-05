import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "./config.js";
import { TEAMS, MAX_LEN, COOLDOWN_S, otherTeam, createArena, renderLists, createStore } from "./recap-shared.js";

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
const $ = (id) => document.getElementById(id);
const code = new URLSearchParams(location.search).get("s");

let session = null;
let me = null;
let store = null;
let arena = null;
let poll = null;
let busy = false;
let myCount = 0; // cate intrebari am aruncat eu in aceasta sesiune (pentru limita stabilita de trainer)
let cooldownUntil = 0;
let cooldownTimer = null;
let newIds = new Set();
let baseAlias = "";
let suggestedAlias = "";

const norm = (s) => s.trim().toLowerCase();

// pe telefon, ecranul de joc ocupa exact inaltimea ramasa sub antet: sus campul de lupta (deruleaza), jos campul de intrebare
function fitLayout() {
  const layout = document.querySelector(".recap-layout");
  if (!layout) return;
  if (window.matchMedia("(max-width: 800px)").matches && !$("game").hidden && session?.status === "play") {
    const top = layout.getBoundingClientRect().top + window.scrollY;
    layout.style.height = `${Math.max(320, window.innerHeight - top - 8)}px`;
  } else {
    layout.style.height = "";
  }
}
window.addEventListener("resize", fitLayout);

function show(id) {
  ["error", "join", "waiting", "game"].forEach((s) => ($(s).hidden = s !== id));
  document.body.classList.toggle("recap-playing", id === "game" && session?.status === "play" && window.matchMedia("(max-width: 800px)").matches);
  fitLayout();
}
function fail(msg) {
  $("error").textContent = msg;
  show("error");
}

// ---------------------------------------------------------------------
async function init() {
  if (!code) return fail("Link invalid.");
  const { data, error } = await supabase.from("recap_sessions").select("*").eq("session_code", code).maybeSingle();
  if (error) {
    console.error(error);
    return fail("Nu pot citi sesiunea: " + error.message);
  }
  if (!data) return fail("Sesiunea nu există.");
  session = data;
  const saved = localStorage.getItem(`recap_${session.id}`);
  if (saved) {
    const { data: p } = await supabase.from("recap_participants").select("*").eq("id", saved).maybeSingle();
    me = p;
  }
  render();
  window.__recapReady = true;
  poll = setInterval(refresh, 2000);
}

function render() {
  $("join-topic").textContent = session.topic ? `Tema: ${session.topic}` : "";
  if (session.status === "ended") {
    buildGame(); // doar citire: se vad intrebarile si campul de lupta
    return;
  }
  if (!me) return show("join");
  $("my-alias").textContent = me.alias;
  if (session.status === "lobby") {
    $("waiting-text").textContent = "Așteaptă ca trainerul să împartă echipele și să pornească recapitularea.";
    return show("waiting");
  }
  if (!me.team) {
    $("waiting-text").textContent = "Recapitularea a început. Se alocă echipa ta…";
    return show("waiting");
  }
  buildGame();
}

// ---------------------------------------------------------------------
//  Ecranul de joc
// ---------------------------------------------------------------------
async function buildGame() {
  const ended = session.status === "ended";
  $("game").classList.toggle("ended", ended);
  show("game");
  $("topic-line").innerHTML = "";
  if (session.topic) {
    const b = document.createElement("b");
    b.textContent = session.topic;
    $("topic-line").append("Tema: ", b);
  }
  if (!arena) {
    arena = createArena($("arena"));
    store = createStore(supabase, session.id);
  }
  const t = me?.team;
  const banner = $("team-banner");
  banner.hidden = ended || !t;
  if (t) {
    banner.className = `team-banner team-${t}`;
    banner.textContent = `Ești în echipa ${TEAMS[t].name}`;
    $("q-label").textContent = `Întrebare pentru echipa ${TEAMS[otherTeam(t)].name}`;
  }
  await loadMyCount();
  updateThrowButton();
  await syncQuestions();
}

async function loadMyCount() {
  if (!me?.team) return;
  const { data } = await supabase.from("recap_questions").select("id").eq("session_id", session.id).eq("participant_id", me.id);
  myCount = (data || []).length;
}

async function syncQuestions() {
  if (!store || busy) return;
  busy = true;
  try {
    const r = await store.sync();
    r.added.filter((q) => !q.hidden).forEach((q) => {
      arena.fly(q.team); // intrebare noua a altcuiva: bulgare in zbor
      newIds.add(q.id);
    });
    drawAll();
    setTimeout(() => {
      newIds = new Set();
    }, 2300);
  } catch (e) {
    console.error(e);
  } finally {
    busy = false;
  }
}

function drawAll() {
  const all = store.all();
  const c = store.visibleCounts();
  arena.setTotals(c[1], c[2]);
  renderLists($("qlists"), all.filter((q) => !q.hidden), { newIds });
}

// ---------------------------------------------------------------------
//  Aruncarea întrebării
// ---------------------------------------------------------------------
function updateThrowButton() {
  const text = $("q-text").value;
  $("q-count").textContent = `${text.length}/${MAX_LEN}`;
  const limit = session?.max_questions || 0; // 0 = fara limita
  const reached = limit > 0 && myCount >= limit;
  const left = Math.ceil((cooldownUntil - Date.now()) / 1000);
  const playing = session?.status === "play" && !!me?.team;
  $("q-text").disabled = reached;
  $("q-left").textContent = limit > 0 ? (reached ? `Ai folosit toate întrebările (${myCount}/${limit}).` : `Întrebări rămase: ${limit - myCount} din ${limit}`) : "";
  $("throw-btn").disabled = !playing || reached || !text.trim() || left > 0;
  $("throw-btn").textContent = reached ? "Limita de întrebări atinsă" : left > 0 ? `Aruncă întrebarea (${left})` : "Aruncă întrebarea";
}

function startCooldown(seconds) {
  cooldownUntil = Date.now() + seconds * 1000;
  clearInterval(cooldownTimer);
  cooldownTimer = setInterval(() => {
    updateThrowButton();
    if (Date.now() >= cooldownUntil) clearInterval(cooldownTimer);
  }, 250);
  updateThrowButton();
}

const THROW_ERRORS = {
  recap_rate_limit: "Așteaptă câteva secunde înainte de următoarea întrebare.",
  recap_not_playing: "Recapitularea nu este activă acum.",
  recap_team_mismatch: "Echipa ta s-a schimbat. Reîncarcă pagina.",
  recap_limit_reached: "Ai folosit toate întrebările permise de trainer.",
};

async function throwQuestion() {
  const body = $("q-text").value.trim().slice(0, MAX_LEN);
  if (!body || $("throw-btn").disabled) return;
  $("throw-btn").disabled = true;
  $("q-msg").textContent = "";
  const { data, error } = await supabase
    .from("recap_questions")
    .insert({ session_id: session.id, participant_id: me.id, team: me.team, body })
    .select("id, team, body, hidden, created_at, updated_at")
    .single();
  if (error) {
    const key = Object.keys(THROW_ERRORS).find((k) => (error.message || "").includes(k));
    $("q-msg").textContent = key ? THROW_ERRORS[key] : error.message;
    if (key === "recap_limit_reached") myCount = Math.max(myCount, session.max_questions || 0);
    startCooldown(key === "recap_rate_limit" ? 3 : 1);
    return;
  }
  myCount++;
  store.remember(data);
  arena.fly(me.team); // bulgarele pleaca imediat, fara sa astepte reimprospatarea
  drawAll();
  $("q-text").value = "";
  startCooldown(COOLDOWN_S);
}

$("q-text").addEventListener("input", updateThrowButton);
$("q-text").addEventListener("keydown", (e) => {
  if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) throwQuestion();
});
$("throw-btn").onclick = throwQuestion;

// ---------------------------------------------------------------------
//  Reîmprospătare periodică (ușoară: doar starea sesiunii, echipa și întrebările schimbate)
// ---------------------------------------------------------------------
let tick = 0;
async function refresh() {
  tick++;
  const { data, error } = await supabase.from("recap_sessions").select("status, topic, max_questions").eq("id", session.id).maybeSingle();
  if (!error && !data) {
    // trainerul a inchis de tot recapitularea (sesiunea a fost stearsa)
    clearInterval(poll);
    clearInterval(cooldownTimer);
    document.body.classList.remove("recap-playing");
    return fail("Recapitularea a fost închisă de trainer. Mulțumim pentru participare!");
  }
  if (!data) return;
  const changed = data.status !== session.status || data.topic !== session.topic;
  const limitChanged = data.max_questions !== session.max_questions;
  session = { ...session, ...data };
  if (limitChanged && !$("game").hidden) updateThrowButton(); // trainerul a schimbat limita
  if (me && !me.team && session.status !== "lobby") {
    const { data: p } = await supabase.from("recap_participants").select("team").eq("id", me.id).maybeSingle();
    if (p?.team) {
      me = { ...me, team: p.team };
      return render();
    }
  }
  // trainerul a reimpartit echipele: echipa participantului se poate schimba
  if (me?.team && session.status === "play" && tick % 4 === 0) { // verificare mai rara: echipa se schimba doar daca trainerul reimparte
    const { data: p } = await supabase.from("recap_participants").select("team").eq("id", me.id).maybeSingle();
    if (p?.team && p.team !== me.team) {
      me = { ...me, team: p.team };
      return render();
    }
  }
  if (changed) return render();
  if (!$("game").hidden) await syncQuestions();
}

// ---------------------------------------------------------------------
//  Înscrierea
// ---------------------------------------------------------------------
async function takenAliases() {
  const { data, error } = await supabase.from("recap_participants").select("alias").eq("session_id", session.id);
  return error ? null : new Set((data || []).map((p) => norm(p.alias)));
}
async function nextFreeAlias(base) {
  const taken = (await takenAliases()) || new Set();
  let n = 2;
  while (taken.has(norm(`${base} (${n})`))) n++;
  return `${base} (${n})`;
}
function hideSuggestion() {
  $("alias-suggest").hidden = true;
}
async function offerSuffix(base) {
  baseAlias = base;
  suggestedAlias = await nextFreeAlias(base);
  $("alias-suggest-text").textContent = `Aliasul „${base}” e deja folosit. Vrei să apari ca „${suggestedAlias}”?`;
  $("alias-yes").textContent = `Da, apar ca „${suggestedAlias}”`;
  $("alias-suggest").hidden = false;
}
async function register(alias, base) {
  const taken = await takenAliases();
  if (taken && taken.has(norm(alias))) return offerSuffix(base);
  const { data, error } = await supabase.from("recap_participants").insert({ session_id: session.id, alias }).select().single();
  if (error) {
    if (error.code === "23505" || /duplicate key|unique/i.test(error.message)) return offerSuffix(base);
    $("join-error").textContent = error.message;
    return;
  }
  me = data;
  localStorage.setItem(`recap_${session.id}`, me.id);
  hideSuggestion();
  render();
}
$("join-btn").onclick = async () => {
  const alias = $("alias").value.trim();
  hideSuggestion();
  $("join-error").textContent = "";
  if (!alias) return ($("join-error").textContent = "Introdu un alias.");
  await register(alias, alias);
};
$("alias-yes").onclick = () => register(suggestedAlias, baseAlias);
$("alias-no").onclick = () => {
  hideSuggestion();
  $("alias").focus();
  $("alias").select();
};

init();
