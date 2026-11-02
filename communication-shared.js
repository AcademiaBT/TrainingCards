// Funcții comune pentru „Reconstruiește modelul” (pagina participantului și pagina trainerului)

const key = (p) => `${p.x},${p.y}`;

// Compară ce a așezat participantul cu modelul-țintă. O piesă e corectă dacă are același simbol în același pătrat.
export function compareModel(target, own = []) {
  const marks = {};
  let correct = 0;
  own.forEach((p) => {
    const hit = target.some((t) => t.s === p.s && t.x === p.x && t.y === p.y);
    marks[key(p)] = hit ? "ok" : "bad";
    if (hit) correct++;
  });
  return { correct, total: target.length, wrong: own.length - correct, marks };
}

// Grila 4×4; `marks` (opțional) colorează pătratele: „ok” = verde, „bad” = roșu
export function gridHtml(items = [], marks = {}) {
  const cells = Array.from({ length: 16 }, () => ({ s: "", cls: "" }));
  items.forEach((p) => {
    cells[p.y * 4 + p.x] = { s: p.s, cls: marks[key(p)] || "" };
  });
  return `<div class="mini-model">${cells.map((c) => `<span class="${c.cls}">${c.s}</span>`).join("")}</div>`;
}

export function scoreText(cmp) {
  const base = `${cmp.correct} din ${cmp.total} piese la locul lor`;
  return cmp.wrong > 0 ? `${base} · ${cmp.wrong} ${cmp.wrong === 1 ? "piesă greșită" : "piese greșite"}` : base;
}
