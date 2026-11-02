// =====================================================================
//  Nodul comunicării — conținutul activităților
//
//  Cum adaugi o variantă nouă (fără alte modificări în cod):
//   • Desenează după instrucțiuni: copiază un bloc din `ACTIVITIES.draw.variants`
//     și schimbă titlurile și textele (ghidul = ce citește trainerul).
//   • Ce ai înțeles?: copiază un bloc din `ACTIVITIES.client.variants`
//     (mesaj = ce spune clientul, detail = informația ascunsă).
//   • Reconstruiește modelul: nu se adaugă manual, modelele se generează.
//  Desenul de referință (opțional) al unei runde de desen: `svg: fig("Titlu", "<forme SVG>")`.
//   Coordonatele sunt pe un cadru de 800×600 (ca zona de desen); formele se desenează doar cu contur
//   (stroke-ul, grosimea și culoarea vin din `fig`), ex.: <circle cx="400" cy="300" r="80"/>,
//   <rect x="100" y="100" width="200" height="120"/>, <path d="M100 100 L200 100"/>.
//   Dacă o rundă nu are `svg`, trainerul nu vede butonul „Arată modelul”.
//  Fiecare variantă are exact două runde: runda 1 fără întrebări, runda 2 cu clarificări.
//  Ordinea din listă nu contează; variantele noi se adaugă la final.
//  Varianta 0 (prima) păstrează conținutul inițial, pentru sesiunile mai vechi.
// =====================================================================

// desen de referinta: cadru 800x600, doar contur; culoarea vine din CSS (currentColor)
const fig = (title, shapes) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 600" fill="none" stroke="currentColor" stroke-width="5" stroke-linecap="round" stroke-linejoin="round" role="img" aria-label="${title}">${shapes}</svg>`;

const R1_NO_QUESTIONS = "Fără întrebări. Ascultă și desenează doar din instrucțiuni.";
const R2_QUESTIONS = "Poți pune întrebări de clarificare și poți verifica ce ai înțeles.";
const C1_RULE = "Răspunde pe baza mesajului inițial, fără informații suplimentare.";
const C2_RULE = "Înainte de soluție, formulează o întrebare de clarificare și apoi răspunsul tău.";

export const ACTIVITIES = {
  draw: {
    name: "Desenează după instrucțiuni",
    variants: [
      {
        rounds: [
          { title: "Casa", guide: "O casă cu acoperiș triunghiular, două ferestre, o ușă, un copac în stânga și un soare în dreapta sus.", svg: fig("Casa", '<path d="M300 300 H520 V480 H300 Z"/><path d="M280 300 L410 190 L540 300 Z"/><path d="M385 480 V395 H435 V480"/><rect x="320" y="330" width="45" height="45"/><rect x="455" y="330" width="45" height="45"/><path d="M60 480 H740"/><circle cx="170" cy="325" r="68"/><path d="M155 480 V391 M185 480 V391"/><circle cx="660" cy="110" r="45"/><path d="M719 110 L741 110 M701.7 151.7 L717.3 167.3 M660 169 L660 191 M618.3 151.7 L602.7 167.3 M601 110 L579 110 M618.3 68.3 L602.7 52.7 M660 51 L660 29 M701.7 68.3 L717.3 52.7"/>'), rule: R1_NO_QUESTIONS },
          { title: "Peisaj geometric", guide: "Un pătrat mare în centru. În interior: un cerc mic sus-stânga și un triunghi jos-dreapta. O săgeată pornește din pătrat spre o stea aflată în dreapta.", svg: fig("Peisaj geometric", '<rect x="180" y="170" width="260" height="260"/><circle cx="245" cy="235" r="30"/><path d="M330 405 L420 405 L375 332 Z"/><path d="M440 300 L592 300 M569.2 312.5 L592 300 L569.2 287.5"/><polygon points="675,242 689.3,280.3 730.2,282.1 698.2,307.5 709.1,346.9 675,324.4 640.9,346.9 651.8,307.5 619.8,282.1 660.7,280.3"/>'), rule: R2_QUESTIONS },
        ],
      },
      {
        rounds: [
          { title: "Barca pe lac", guide: "O linie ondulată orizontală la mijlocul paginii (apa). Pe ea, o barcă mică: un trapez jos și o pânză triunghiulară deasupra. Un soare sus-dreapta și doi nori mici sus-stânga.", svg: fig("Barca pe lac", '<path d="M40 360 Q60.0 336 80 360 T120 360 T160 360 T200 360 T240 360 T280 360 T320 360 T360 360 T400 360 T440 360 T480 360 T520 360 T560 360 T600 360 T640 360 T680 360 T720 360 T760 360"/><path d="M300 305 H500 L465 345 H335 Z"/><path d="M400 305 V160 M400 170 V292 H485 Z"/><circle cx="670" cy="110" r="42"/><path d="M726 110 L748 110 M709.6 149.6 L725.2 165.2 M670 166 L670 188 M630.4 149.6 L614.8 165.2 M614 110 L592 110 M630.4 70.4 L614.8 54.8 M670 54 L670 32 M709.6 70.4 L725.2 54.8"/><path d="M60 130 H150 A21.6 21.6 0 0 0 150 86.8 A30.6 30.6 0 0 0 94.2 83.2 A27 27 0 0 0 60 130 Z"/><path d="M220 190 H290 A16.8 16.8 0 0 0 290 156.4 A23.8 23.8 0 0 0 246.6 153.6 A21 21 0 0 0 220 190 Z"/>'), rule: R1_NO_QUESTIONS },
          { title: "Formele legate", guide: "Un cerc mare în stânga. În interior, un pătrat mic. Lipit de cerc, în dreapta lui, un dreptunghi culcat cu o linie verticală prin mijloc. De sus din dreptunghi pornește o săgeată spre un triunghi aflat deasupra.", svg: fig("Formele legate", '<circle cx="230" cy="330" r="150"/><rect x="200" y="300" width="60" height="60"/><rect x="380" y="290" width="260" height="80"/><path d="M510 290 V370"/><path d="M510 290 L510 158 M523.4 182.6 L510 158 L496.6 182.6"/><path d="M450 140 L510 50 L570 140 Z"/>'), rule: R2_QUESTIONS },
        ],
      },
      {
        rounds: [
          { title: "Orașul", guide: "Trei clădiri dreptunghiulare una lângă alta; cea din mijloc e cea mai înaltă. Fiecare are trei ferestre pătrate, una sub alta. Un drum orizontal sub clădiri și o lună în colțul din stânga sus.", svg: fig("Orașul", '<path d="M170 480 V300 H330 V480 M330 170 H490 V480 M490 300 H650 V480"/><path d="M330 300 V170"/><rect x="232" y="318" width="36" height="36"/><rect x="552" y="318" width="36" height="36"/><rect x="232" y="368" width="36" height="36"/><rect x="552" y="368" width="36" height="36"/><rect x="232" y="418" width="36" height="36"/><rect x="552" y="418" width="36" height="36"/><rect x="392" y="200" width="36" height="36"/><rect x="392" y="270" width="36" height="36"/><rect x="392" y="340" width="36" height="36"/><path d="M60 480 H740 M60 535 H740"/><path d="M130 66 A45 45 0 1 0 130 154 A36 36 0 1 1 130 66 Z"/>'), rule: R1_NO_QUESTIONS },
          { title: "Stea și săgeată", guide: "O stea sus, în centru. Dedesubt, două cercuri de aceeași mărime, unul lângă altul. Sub ele, un dreptunghi lat. Din colțul din dreapta al dreptunghiului pornește o săgeată spre un romb aflat în dreapta-jos.", svg: fig("Stea și săgeată", '<polygon points="400,38 415.3,78.9 459,80.8 424.8,108 436.4,150.2 400,126 363.6,150.2 375.2,108 341,80.8 384.7,78.9"/><circle cx="343" cy="250" r="55"/><circle cx="457" cy="250" r="55"/><rect x="250" y="345" width="300" height="80"/><path d="M550 425 L636 476 M610 475.1 L636 476 L622.7 453.6"/><path d="M670 450 L725 505 L670 560 L615 505 Z"/>'), rule: R2_QUESTIONS },
        ],
      },
      {
        rounds: [
          { title: "Grădina", guide: "Jos, un gard făcut din cinci linii verticale, pe toată lățimea. În spatele gardului, două flori: una mare în stânga, una mică în dreapta, fiecare cu tulpină și patru petale. Deasupra florii mici, un fluture (două triunghiuri unite într-un punct).", svg: fig("Grădina", '<path d="M80 420 V560"/><path d="M240 420 V560"/><path d="M400 420 V560"/><path d="M560 420 V560"/><path d="M720 420 V560"/><circle cx="170" cy="230" r="26"/><circle cx="170" cy="168" r="36"/><circle cx="170" cy="292" r="36"/><circle cx="108" cy="230" r="36"/><circle cx="232" cy="230" r="36"/><path d="M170 328 V420"/><circle cx="630" cy="330" r="14"/><circle cx="630" cy="296" r="20"/><circle cx="630" cy="364" r="20"/><circle cx="596" cy="330" r="20"/><circle cx="664" cy="330" r="20"/><path d="M630 384 V420"/><path d="M630 200 L580 170 V230 Z M630 200 L680 170 V230 Z"/>'), rule: R1_NO_QUESTIONS },
          { title: "Legături", guide: "Un triunghi mare sus, cu un pătrat mic în interior. Sub triunghi, două cercuri mici, unul în stânga și unul în dreapta. Între cercuri, o săgeată cu vârf la ambele capete.", svg: fig("Legături", '<path d="M220 300 L400 50 L580 300 Z"/><rect x="370" y="200" width="60" height="60"/><circle cx="250" cy="450" r="45"/><circle cx="550" cy="450" r="45"/><path d="M305 450 H495 M332 428 L305 450 L332 472 M468 428 L495 450 L468 472"/>'), rule: R2_QUESTIONS },
        ],
      },
    ],
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

const sameTarget = (a, b) =>
  a.length === b.length && a.every((p) => b.some((q) => q.s === p.s && q.x === p.x && q.y === p.y));

function modelRounds(seed) {
  if (!seed) {
    return CLASSIC_MODEL_TARGETS.map((target, i) => ({
      title: `Model ${i + 1}`,
      rule: i === 0 ? "Fără întrebări. Așază piesele numai după descrierea ghidului." : "Poți clarifica și reformula înainte să fixezi piesele.",
      target,
      guide: describeTarget(target),
    }));
  }
  const rand = rng(seed);
  const first = generateTarget(rand);
  let second = generateTarget(rand);
  for (let i = 0; i < 20 && sameTarget(first, second); i++) second = generateTarget(rand);
  return [first, second].map((target, i) => ({
    title: `Model ${i + 1}`,
    rule: i === 0 ? "Fără întrebări. Așază piesele numai după descrierea ghidului." : "Poți clarifica și reformula înainte să fixezi piesele.",
    target,
    guide: describeTarget(target),
  }));
}

// ---------------------------------------------------------------------
//  API folosit de paginile participantului și trainerului
//  `index` = valoarea salvată în communication_sessions.prompt_index
//  (desen / mesaje: numărul variantei; model: numărul din care se generează modelele)
// ---------------------------------------------------------------------
export function getRounds(mode, index = 0) {
  if (mode === "model") return modelRounds(Number(index) || 0);
  const list = ACTIVITIES[mode].variants;
  return list[(Number(index) || 0) % list.length].rounds;
}

export function randomVariant(mode, current = -1) {
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

export function variantLabel(mode, index = 0) {
  if (mode === "model") return Number(index) ? `Model aleatoriu #${index}` : "Modelele clasice";
  return getRounds(mode, index).map((r) => r.title).join(" → ");
}
