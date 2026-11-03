// =====================================================================
//  Nodul comunicării — conținutul activităților
//
//  • Desenează după instrucțiuni: scenariile le creează fiecare trainer, din pagina trainerului
//    („Scenariile mele”): titlu, instrucțiuni (listă numerotată) și, opțional, o imagine de referință,
//    pentru una sau două runde. Scenariul ales se copiază în sesiune (communication_sessions.scenario).
//  • Ce ai înțeles?: scenariile de bază sunt aici, în `ACTIVITIES.client.variants` (mesaj = ce spune clientul,
//    detail = informația ascunsă), ca puncte de pornire; fiecare trainer le poate copia în „Scenariile mele”
//    și le poate edita, sau își poate crea scenarii proprii (1 sau 2 runde), salvate în baza de date.
//  • Reconstruiește modelul: nu se adaugă manual, modelele se generează.
// =====================================================================

const R1_NO_QUESTIONS = "Fără întrebări. Ascultă și desenează doar din instrucțiuni.";
const R2_QUESTIONS = "Poți pune întrebări de clarificare și poți verifica ce ai înțeles.";
const C1_RULE = "Răspunde pe baza mesajului inițial, fără informații suplimentare.";
const C2_RULE = "Înainte de soluție, formulează o întrebare de clarificare și apoi răspunsul tău.";

export const ACTIVITIES = {
  draw: {
    name: "Desenează după instrucțiuni",
    // fără scenarii în cod: fiecare trainer își creează propriile scenarii
  },

  model: {
    name: "Reconstruiește modelul",
    // variantele se generează din număr (vezi getRounds); aici nu există listă
  },

  client: {
    name: "Ce ai înțeles?",
    variants: [
      {
        rounds: [
          { title: "Plata", message: "Am făcut plata ieri și încă nu apare. Nu înțeleg de ce trebuie să verific eu mereu lucrurile astea.", detail: "Plata apare în contul clientului. Beneficiarul spune că nu a primit banii.", rule: C1_RULE },
          { title: "Cardul", message: "Mi-ați blocat cardul exact când aveam nevoie de el.", detail: "Cardul este activ. Tranzacția a fost refuzată doar la un comerciant online.", rule: C2_RULE },
        ],
      },
      {
        rounds: [
          { title: "Transferul", message: "Am trimis banii azi-dimineață și destinatarul zice că nu i-au ajuns. Vreau să rezolvați imediat, nu e prima dată.", detail: "Transferul a fost inițiat către un cont din altă bancă și este încă în procesare; banii nu au fost încă debitați din contul clientului.", rule: C1_RULE },
          { title: "Aplicația", message: "Nu mai merge aplicația, ce-mi faceți?!", detail: "Aplicația funcționează. Clientul nu se poate autentifica după ce și-a schimbat telefonul, pentru că dispozitivul nou nu a fost înregistrat.", rule: C2_RULE },
        ],
      },
      {
        rounds: [
          { title: "Comisionul", message: "Mi-ați luat un comision din nou și nimeni nu mi-a zis nimic despre asta.", detail: "Este comisionul lunar de administrare a contului, aplicat după ce soldul clientului a coborât sub nivelul cerut de pachetul lui.", rule: C1_RULE },
          { title: "Rambursarea", message: "Am returnat produsul acum două săptămâni și încă n-am primit banii.", detail: "Comerciantul a inițiat rambursarea, dar aceasta este încă în procesare. Clientul a numărat și zilele de weekend și crede că a trecut mult mai mult timp.", rule: C2_RULE },
        ],
      },
      {
        rounds: [
          { title: "La ghișeu", message: "Am așteptat o oră la ghișeu și tot nu s-a rezolvat nimic. Data viitoare nu mai vin.", detail: "Clientul a venit fără un act de identitate valabil, deci operațiunea nu se putea face. Nu i s-a explicat clar de ce.", rule: C1_RULE },
          { title: "Creditul", message: "Mi-ați respins cererea și nici nu mi-ați spus de ce. Ce rost mai are să aplic?", detail: "Cererea nu a fost respinsă definitiv: lipsește un document de venit. Clientul a primit un SMS automat pe care nu l-a citit.", rule: C2_RULE },
        ],
      },
    ],
  },
};

// ---------------------------------------------------------------------
//  Etapele sesiunii. Desenul și mesajele ambigue au 2 runde; „Reconstruiește modelul” are 4 pași:
//   1 poziționare (facilitatorul explică) → 2 reveal individual (model + ce a făcut fiecare)
//   → 3 rezultatele tuturor → 4 debrief.
//  Valorile salvate în baza de date sunt cele permise de constrângerea existentă (nu cere SQL nou):
//  la model, pasul 3 se salvează ca „round2_reveal”.
// ---------------------------------------------------------------------
const STAGES_DEFAULT = ["lobby", "round1", "round1_reveal", "round2", "round2_reveal", "debrief", "ended"];
const STAGES_MODEL = ["lobby", "round1", "round1_reveal", "round2_reveal", "debrief", "ended"];
const LABELS_DEFAULT = {
  lobby: "Lobby",
  round1: "Runda 1 · fără clarificări",
  round1_reveal: "Reveal runda 1",
  round2: "Runda 2 · cu clarificări",
  round2_reveal: "Reveal runda 2",
  debrief: "Debrief",
  ended: "Încheiată",
};
const LABELS_MODEL = {
  lobby: "Lobby",
  round1: "Pasul 1 · Poziționare",
  round1_reveal: "Pasul 2 · Reveal individual",
  round2_reveal: "Pasul 3 · Rezultatele tuturor",
  debrief: "Pasul 4 · Debrief",
  ended: "Încheiată",
};
// „Ce ai înțeles?”: după fiecare reveal urmează un pas în care participanții văd răspunsurile tuturor (anonim)
const STAGES_CLIENT = ["lobby", "round1", "round1_reveal", "round1_results", "round2", "round2_reveal", "round2_results", "debrief", "ended"];
const LABELS_CLIENT = {
  lobby: "Lobby",
  round1: "Runda 1 · fără clarificări",
  round1_reveal: "Reveal runda 1",
  round1_results: "Răspunsurile tuturor · runda 1",
  round2: "Runda 2 · cu clarificări",
  round2_reveal: "Reveal runda 2",
  round2_results: "Răspunsurile tuturor · runda 2",
  debrief: "Debrief",
  ended: "Încheiată",
};
const STAGES_CLIENT_ONE = ["lobby", "round1", "round1_reveal", "round1_results", "debrief", "ended"];
const STAGES_ONE_ROUND = ["lobby", "round1", "round1_reveal", "debrief", "ended"];

// Rundele unui scenariu de desen (1 sau 2), cu regula rundei dedusă din „permite întrebări”
export function scenarioRounds(scenario) {
  const list = Array.isArray(scenario?.rounds) && scenario.rounds.length ? scenario.rounds : [{ steps: [], questions: false }];
  return list.slice(0, 2).map((r, i) => ({
    title: r.title || scenario?.title || `Runda ${i + 1}`,
    steps: Array.isArray(r.steps) ? r.steps : [],
    image: r.image_url || null,
    questions: !!r.questions,
    rule: r.questions ? R2_QUESTIONS : R1_NO_QUESTIONS,
  }));
}

export function stagesFor(mode, session) {
  if (mode === "model") return STAGES_MODEL;
  if (mode === "client") return session?.scenario?.rounds?.length === 1 ? STAGES_CLIENT_ONE : STAGES_CLIENT; // scenariu propriu cu o singura runda: fara runda 2
  if (mode === "draw" && scenarioRounds(session?.scenario).length === 1) return STAGES_ONE_ROUND;
  return STAGES_DEFAULT;
}

export function stageLabel(mode, status, session) {
  if (mode === "model") return LABELS_MODEL[status] || status;
  if (mode === "client") return LABELS_CLIENT[status] || status;
  if (mode === "draw" && ["round1", "round1_reveal", "round2", "round2_reveal"].includes(status)) {
    const n = status.includes("2") ? 2 : 1;
    const r = scenarioRounds(session?.scenario)[n - 1];
    return status.includes("reveal") ? `Reveal runda ${n}` : `Runda ${n} · ${r?.questions ? "cu" : "fără"} clarificări`;
  }
  return LABELS_DEFAULT[status] || status;
}

export const DEBRIEF = [
  "Ce presupuneri ai făcut fără să îți dai seama?",
  "Ce s-a schimbat când ai putut clarifica și verifica înțelegerea?",
  "Ce întrebare ai putea folosi într-o conversație cu un client dificil pentru a preveni escaladarea?",
];

// ---------------------------------------------------------------------
//  Modelul clasic (varianta 0) — exact cele două modele inițiale
// ---------------------------------------------------------------------
const CLASSIC_MODEL_TARGETS = [
  [{ s: "●", x: 2, y: 0 }, { s: "▲", x: 1, y: 1 }, { s: "■", x: 2, y: 1 }, { s: "▬", x: 2, y: 2 }, { s: "➜", x: 3, y: 2 }],
  [{ s: "★", x: 0, y: 0 }, { s: "●", x: 1, y: 1 }, { s: "■", x: 2, y: 1 }, { s: "▲", x: 3, y: 2 }, { s: "➜", x: 2, y: 3 }],
];

// n = fără articol (după „sub”, „față de”), d = cu articol (început de propoziție), g = genitiv (după „deasupra”, „la dreapta”)
const SHAPES = [
  { s: "●", n: "cerc", d: "cercul", g: "cercului" },
  { s: "▲", n: "triunghi", d: "triunghiul", g: "triunghiului" },
  { s: "■", n: "pătrat", d: "pătratul", g: "pătratului" },
  { s: "▬", n: "dreptunghi", d: "dreptunghiul", g: "dreptunghiului" },
  { s: "➜", n: "săgeată", d: "săgeata", g: "săgeții" },
  { s: "★", n: "stea", d: "steaua", g: "stelei" },
];
const SHAPE_BY_SYMBOL = Object.fromEntries(SHAPES.map((x) => [x.s, x]));
const cap = (t) => t.charAt(0).toUpperCase() + t.slice(1);

// generator pseudo-aleatoriu determinist: același număr => aceleași modele, pe orice ecran
function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffled(list, rand) {
  const a = [...list];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

const NEIGHBORS = [-1, 0, 1].flatMap((dx) => [-1, 0, 1].map((dy) => [dx, dy])).filter(([dx, dy]) => dx || dy);

// 5 piese distincte, pe grila 4×4, legate între ele (vecine pe orizontală, verticală sau diagonală),
// cu un model care ocupă cel puțin 3 rânduri și 3 coloane (ca să merite descris)
function generateTarget(rand) {
  for (let attempt = 0; attempt < 300; attempt++) {
    const symbols = shuffled(SHAPES, rand).slice(0, 5).map((x) => x.s);
    const cells = [{ x: Math.floor(rand() * 4), y: Math.floor(rand() * 4) }];
    while (cells.length < 5) {
      const free = new Map();
      for (const c of cells) {
        for (const [dx, dy] of NEIGHBORS) {
          const x = c.x + dx;
          const y = c.y + dy;
          if (x < 0 || x > 3 || y < 0 || y > 3) continue;
          if (cells.some((q) => q.x === x && q.y === y)) continue;
          free.set(`${x},${y}`, { x, y });
        }
      }
      const options = [...free.values()];
      cells.push(options[Math.floor(rand() * options.length)]);
    }
    const spanX = Math.max(...cells.map((c) => c.x)) - Math.min(...cells.map((c) => c.x)) + 1;
    const spanY = Math.max(...cells.map((c) => c.y)) - Math.min(...cells.map((c) => c.y)) + 1;
    if (spanX >= 3 && spanY >= 3) return cells.map((c, i) => ({ s: symbols[i], x: c.x, y: c.y }));
  }
  return CLASSIC_MODEL_TARGETS[0];
}

const RELATIONS = {
  "0,1": (r) => `imediat sub ${r.n}`,
  "0,-1": (r) => `imediat deasupra ${r.g}`,
  "1,0": (r) => `imediat la dreapta ${r.g}`,
  "-1,0": (r) => `imediat la stânga ${r.g}`,
  "1,1": (r) => `în diagonală, dreapta-jos față de ${r.n}`,
  "-1,1": (r) => `în diagonală, stânga-jos față de ${r.n}`,
  "1,-1": (r) => `în diagonală, dreapta-sus față de ${r.n}`,
  "-1,-1": (r) => `în diagonală, stânga-sus față de ${r.n}`,
};

// Descriere pentru trainer, piesă cu piesă, în ordinea în care se pot așeza
function describeTarget(items) {
  const lines = ["Grila are 4 rânduri și 4 coloane (rândul 1 sus, coloana 1 în stânga)."];
  items.forEach((p, i) => {
    const sh = SHAPE_BY_SYMBOL[p.s];
    const pos = `rând ${p.y + 1}, coloană ${p.x + 1}`;
    if (i === 0) {
      lines.push(`${cap(sh.d)} ${p.s} — ${pos} (punctul de pornire).`);
      return;
    }
    const earlier = items.slice(0, i);
    const orth = earlier.find((q) => Math.abs(q.x - p.x) + Math.abs(q.y - p.y) === 1);
    const ref = orth || earlier.find((q) => Math.abs(q.x - p.x) <= 1 && Math.abs(q.y - p.y) <= 1);
    const rel = RELATIONS[`${p.x - ref.x},${p.y - ref.y}`](SHAPE_BY_SYMBOL[ref.s]);
    lines.push(`${cap(sh.d)} ${p.s} — ${rel} (${pos}).`);
  });
  lines.push("Săgeata ➜, dacă apare, este orientată spre dreapta.");
  return lines.join("\n");
}

function modelRounds(seed) {
  // un singur model pe sesiune (pasul 1 = pozitionare); restul pasilor folosesc acelasi model
  const target = seed ? generateTarget(rng(seed)) : CLASSIC_MODEL_TARGETS[0];
  return [
    {
      title: "Reconstruiește modelul",
      rule: "Ascultă descrierea facilitatorului și așază piesele pe grilă. Ce ai pe grilă se trimite automat când se trece la pasul următor.",
      target,
      guide: describeTarget(target),
    },
  ];
}

// ---------------------------------------------------------------------
//  API folosit de paginile participantului și trainerului
//  `index` = valoarea salvată în communication_sessions.prompt_index
//  (desen / mesaje: numărul variantei; model: numărul din care se generează modelele)
// ---------------------------------------------------------------------
// Scenariu propriu la „Ce ai înțeles?”: 1 sau 2 runde, fiecare cu mesajul clientului și informația lipsă (doar pentru trainer)
export function clientScenarioRounds(scenario) {
  return scenario.rounds.slice(0, 2).map((r, i) => ({
    title: r.title || scenario.title || `Runda ${i + 1}`,
    message: r.message || "",
    detail: r.detail || "",
    rule: i === 0 ? C1_RULE : C2_RULE,
  }));
}

// Scenariile de bază („Ce ai înțeles?”) din cod, ca puncte de pornire: [{ index, title, rounds }]
export function baseClientScenarios() {
  return ACTIVITIES.client.variants.map((v, index) => ({ index, title: v.rounds.map((r) => r.title).join(" → "), rounds: v.rounds }));
}

export function getRounds(mode, index = 0, scenario = null) {
  if (mode === "model") return modelRounds(Number(index) || 0);
  if (mode === "draw") return scenarioRounds(scenario);
  if (mode === "client" && scenario?.rounds?.length) return clientScenarioRounds(scenario);
  const list = ACTIVITIES[mode].variants;
  return list[(Number(index) || 0) % list.length].rounds;
}

export function randomVariant(mode, current = -1) {
  if (mode === "draw") return 0; // scenariul se alege separat (din „Scenariile mele”)
  if (mode === "model") {
    let n;
    do n = 1 + Math.floor(Math.random() * 99999);
    while (n === current);
    return n;
  }
  const count = ACTIVITIES[mode].variants.length;
  if (count < 2) return 0;
  let n;
  do n = Math.floor(Math.random() * count);
  while (n === current);
  return n;
}

export function variantLabel(mode, index = 0, scenario = null) {
  if (mode === "model") return Number(index) ? `Model aleatoriu #${index}` : "Modelele clasice";
  if (mode === "draw") return scenario?.title || "—";
  if (mode === "client" && scenario?.rounds?.length) return scenario.title || "—";
  return getRounds(mode, index).map((r) => r.title).join(" → ");
}
