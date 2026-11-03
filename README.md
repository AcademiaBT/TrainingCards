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
- **Desenează după instrucțiuni** — canvas individual 4:3 (responsive, funcționează la rotirea telefonului) cu creion, **forme (dreptunghi, triunghi, cerc) care rămân selectate până le fixezi: se rotesc liber la orice unghi, se mută, se recolorează sau se șterg**, paletă de culori (plus culoare la alegere), radieră și „Șterge tot”, plus instrucțiuni pe ecran. **Scenariile le creează fiecare trainer** („Scenariile mele”, private): nume și **una sau mai multe runde (până la 10)**, fiecare cu instrucțiuni ca **listă numerotată** (o instrucțiune pe rând; prefixele „1.”, „-” se curăță automat), opțional o **imagine de referință** (PNG, JPG sau BMP; se aduce la 4:3, max. 1600×1200, JPEG) și bifa „participanții pot pune întrebări”. Trainerul vede instrucțiunile numerotate („de rostit”), butonul „Arată modelul” (ascuns în timpul rundei, vizibil la Reveal) și comutatorul „Suprapune modelul” (liniile imaginii, în roșu, peste desenele participanților). La Reveal, fiecare participant poate comuta între „Desenul meu”, „Modelul” și „Suprapus”. **După fiecare Reveal urmează pasul „Desenele tuturor”**: fiecare participant vede modelul (dacă runda are imagine de referință), apoi **desenul propriu primul**, apoi desenele celorlalți, **anonim** (fără aliasuri), cu opțiunea „Suprapune modelul” peste toate; desenul de pe canvas se trimite automat la trecerea la pasul următor, dacă are ceva desenat. Etape: Lobby → pentru fiecare rundă N: Runda N → Reveal N → Desenele tuturor · runda N → Debrief (un scenariu cu o singură rundă are doar Runda 1, un scenariu cu 5 runde le parcurge pe toate cinci). Scenariul ales se copiază în sesiune. Pentru mai mult de 2 runde (și pentru pașii „Desenele/Răspunsurile tuturor”) rulează o dată `supabase/add-communication-more-rounds.sql` (înlocuiește `add-communication-results-stages.sql`).
- **Reconstruiește modelul** — piese geometrice pe o grilă 4×4, în 4 pași: (1) poziționare (facilitatorul explică, trainerul primește o descriere text; ce au participanții pe grilă se trimite automat la pasul următor), (2) reveal individual (fiecare vede modelul și ce a realizat, cu piesele corecte în verde, cele greșite în roșu și scorul), (3) rezultatele tuturor (fiecare participant vede modelul, rezultatul propriu primul și rezultatele celorlalți anonim, fără aliasuri; trainerul vede aliasurile), (4) debrief. Modelele se generează (practic nelimitat). În baza de date, pasul 3 se salvează ca `round2_reveal` (nu cere SQL nou).
- **Ce ai înțeles?** — mesaje ambigue de la client, presupunere (runda 1) / întrebare de clarificare (runda 2) și răspuns. Fluxul: Lobby → Runda 1 → Reveal 1 (informația care lipsea + răspunsul propriu) → **Răspunsurile tuturor · runda 1** (fiecare participant vede răspunsurile tuturor colegilor, anonim, cu al lui primul, fără informația lipsă) → Runda 2 → Reveal 2 → **Răspunsurile tuturor · runda 2** → Debrief. Ce a scris participantul și nu a trimis se salvează automat la trecerea la pasul următor. Cere o migrare unică în Supabase (`supabase/add-communication-results-stages.sql`).
- **Scenarii:** la „Desenează după instrucțiuni” și la „Ce ai înțeles?” fiecare trainer își creează și își editează scenariile în panoul **„Scenariile mele”** (două file; private; tabelul `communication_scenarios`; scenariul ales se copiază în `communication_sessions.scenario`). La „Ce ai înțeles?” un scenariu are 1 sau 2 runde, fiecare cu **mesajul clientului** și **informația lipsă** (o vede doar trainerul); cele 4 scenarii din cod (`github/communication-data.js`) rămân **scenarii de bază**, comune, doar pentru citire, cu butonul „Copiază în scenariile mele”. În lobby, la „Ce ai înțeles?”, un selector cu două grupuri („Scenariile mele” / „Scenarii de bază”); implicit se folosește ultimul scenariu ales. La „Reconstruiește modelul” modelele se generează (în lobby: „🎲 Altă variantă”, salvat în `communication_sessions.prompt_index`).
- Trainerul intră din `communication-admin.html` sau din butonul **Nodul comunicării** din admin. Link participanți + cod QR (cu descărcare PNG/JPG).
- Participanții intră fără cont, prin linkul generat, în `communication.html`. Alias deja folosit în sesiune: participantul este întrebat dacă vrea sufixul „(2)”, „(3)” etc. sau alege altul.
- „Încheie” cere confirmare; după încheiere rămân vizibile rezultatele tuturor rundelor.
- Instalare nouă: schema (inclusiv drepturile și indexul pentru alias) este inclusă în `supabase/install-complete.sql`.
- Upgrade pe un proiect existent: rulează `supabase/add-communication-modes.sql` (idempotent). Dacă în proiect existau deja tabele `communication_*` dintr-o versiune veche (coloane `trainer_id`, `participant_token_hash`) sau apar erori 401 la deschiderea linkului participantului, rulează `supabase/fix-communication-prod.sql`.
- Pentru scenariile proprii (desen) rulează o dată `supabase/add-communication-scenarios.sql` (idempotent; este inclus și în `install-complete.sql` pentru instalări noi). Imaginile se încarcă în bucket-ul existent `card-images`, folderul `communication/`.
- **Navigare între etape (toate modurile):** deasupra butoanelor „← Etapa anterioară” și „Etapa următoare →” apare un hint cu numele etapei la care se ajunge cu click pe butonul de dedesubt (de ex. „Urmează: Reveal runda 2”; la ultimul pas: „Urmează: Încheiată (sesiunea se închide)”).
