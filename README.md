# Carduri de training

Aplicație web fără build (HTML + JS simplu), conectată la Supabase.

## Structură
- `index.html` + `learner.js` — pagina cursanților (link/QR primit de la trainer)
- `admin.html` + `admin.js` — panoul trainerului (login, jocuri/seturi, management carduri, sesiuni și grupe, control live, cronometru)
- `manual.html` — manualul de utilizare, cu cuprins, accesibil din admin
- `config.js` — cheile Supabase (URL + anon key)
- `style.css` — identitate vizuală comună

## Cum pui aplicația pe GitHub Pages

1. Creează un repository nou pe GitHub (public sau privat, ambele merg cu GitHub Pages dacă ai cont Pro; pentru cont gratuit trebuie public)
2. Încarcă toate fișierele din acest folder în repository (root, nu într-un subfolder)
3. Mergi la **Settings → Pages** din repository
4. La **Source**, alege **Deploy from a branch** → branch `main`, folder `/ (root)` → **Save**
5. După 1-2 minute, aplicația va fi live la:
   `https://<username-ul-tau>.github.io/<numele-repo-ului>/`

## Cum se folosește, pe scurt

1. **Tu (trainer):** intri pe `.../admin.html`, te loghezi cu email + parola contului creat în Supabase Authentication
2. Din selectorul de sus, creezi un **joc** și un **set de cărți** (butoanele „+ Nou”)
3. Adaugi carduri (individual sau în bulk) — rămân salvate pentru toate sesiunile viitoare din acel set
4. În tab-ul „Sesiuni & Control live”, alegi numărul de grupe și modul de distribuire a cărților → **„Creează sesiune și generează grupe”**
5. Distribui link-ul/codul QR fiecărei grupe (Teams, Zoom, sau afișat pe ecranul partajat)
6. Cursanții intră pe linkul lor (fără cont) și așteaptă până pornești cronometrul (sau alegi „fără cronometru”)
7. Din panoul de control, selectezi tab-ul grupei, dai click pe un card ca să-l evidențiezi live, apeși „Permite răsturnarea” ca să-i lași să-l întoarcă
8. La final, apeși **„Încheie sesiunea”**

Instrucțiuni complete, pas cu pas, sunt disponibile în `manual.html` (buton „📖 Manual” din header-ul paginii de admin).

## Notă despre securitate

Cheia `anon` din `config.js` este publică prin design — accesul e controlat de politicile RLS din Supabase (scrierea e permisă doar userilor autentificați, adică ție ca trainer).


### Nodul comunicării — 3 activități online (v36–v39)
- **Desenează după instrucțiuni** — canvas individual 4:3 (responsive, funcționează la rotirea telefonului) cu creion, paletă de culori (plus culoare la alegere), radieră și „Șterge tot”, plus instrucțiuni pe ecran; două runde, fără clarificări / cu clarificări și reveal.
  - **Desen de referință pentru trainer** (SVG, câte unul pe rundă): buton „Arată modelul” (ascuns în timpul rundei, vizibil la Reveal) și comutator „Suprapune modelul” peste desenele participanților. La Reveal, fiecare participant poate comuta pe pagina lui între „Desenul meu”, „Modelul” și „Suprapus”. Pentru scenarii noi, desenul se scrie în `communication-data.js` cu `svg: fig("Titlu", "<forme SVG>")`.
- **Reconstruiește modelul** — piese geometrice pe o grilă 4×4, în 4 pași: (1) poziționare (facilitatorul explică, trainerul primește o descriere text; ce au participanții pe grilă se trimite automat la pasul următor), (2) reveal individual (fiecare vede modelul și ce a realizat, cu piesele corecte în verde, cele greșite în roșu și scorul), (3) rezultatele tuturor (fiecare participant vede modelul, rezultatul propriu primul și rezultatele celorlalți anonim, fără aliasuri; trainerul vede aliasurile), (4) debrief. Modelele se generează (practic nelimitat). În baza de date, pasul 3 se salvează ca `round2_reveal` (nu cere SQL nou).
- **Ce ai înțeles?** — mesaje ambigue de la client, presupunere, întrebare de clarificare, informație lipsă și răspuns.
- **Variante:** desen (4 scenarii) și mesaje ambigue (4 scenarii); varianta se alege aleatoriu la crearea sesiunii, iar în lobby trainerul poate apăsa „🎲 Altă variantă”. Se salvează în `communication_sessions.prompt_index`. Scenarii noi se adaugă în `github/communication-data.js` (lista `variants`, instrucțiuni în comentariul de la începutul fișierului).
- Trainerul intră din `communication-admin.html` sau din butonul **Nodul comunicării** din admin. Link participanți + cod QR (cu descărcare PNG/JPG).
- Participanții intră fără cont, prin linkul generat, în `communication.html`. Alias deja folosit în sesiune: participantul este întrebat dacă vrea sufixul „(2)”, „(3)” etc. sau alege altul.
- „Încheie” cere confirmare; după încheiere rămân vizibile rezultatele ambelor runde.
- Instalare nouă: schema (inclusiv drepturile și indexul pentru alias) este inclusă în `supabase/install-complete.sql`.
- Upgrade pe un proiect existent: rulează `supabase/add-communication-modes.sql` (idempotent). Dacă în proiect existau deja tabele `communication_*` dintr-o versiune veche (coloane `trainer_id`, `participant_token_hash`) sau apar erori 401 la deschiderea linkului participantului, rulează `supabase/fix-communication-prod.sql`.
