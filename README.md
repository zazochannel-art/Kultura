# Kultura

Aplicație de management pentru evenimente auto: înscrieri, check-in la poartă,
zone de parcare, taskuri de echipă, mesaje pe Telegram/SMS, votare publică și
rapoarte.

PWA fără build step — HTML/CSS/JS servite static, cu Supabase ca backend.
Rulează în browser, instalabilă pe telefon, și împachetată într-un WebView
Android.

> **Operatori de eveniment:** vezi [`docs/RUNBOOK.md`](docs/RUNBOOK.md) — ce
> apeși și în ce ordine. Documentul de față e pentru cine atinge codul.

---

## Cuprins

- [Cum pornești local](#cum-pornești-local)
- [Verificări înainte de commit](#verificări-înainte-de-commit)
- [Structura fișierelor](#structura-fișierelor)
- [Roluri și permisiuni](#roluri-și-permisiuni)
- [Modelul de securitate](#modelul-de-securitate)
- [Edge functions](#edge-functions)
- [Joburi programate (cron)](#joburi-programate-cron)
- [Storage](#storage)
- [Setări în baza de date](#setări-în-baza-de-date)
- [Ce e periculos să atingi](#ce-e-periculos-să-atingi)

---

## Cum pornești local

```bash
node server.js          # server static pe :8080 (sau PORT=…)
```

Nu există `npm install` și nici bundler — fișierele sunt încărcate direct ca
module ES. Backend-ul (Supabase) e cel de producție, deci **atenție ce
modifici** când testezi local.

## Verificări înainte de commit

Aceleași lucruri le rulează și CI la fiecare PR
([`.github/workflows/ci.yml`](.github/workflows/ci.yml)):

```bash
# sintaxă pe tot codul propriu
for f in $(git ls-files '*.js' '*.mjs' | grep -v '^vendor/'); do node --check "$f"; done

node scripts/check-i18n.mjs      # simetrie ro/en/ru
node --test tests/unit.mjs       # teste unitare (fără dependențe)
node tests/smoke.mjs             # necesită playwright (+ axe-core pentru accesibilitate)
node tests/contract.mjs          # lovește backendul real (vezi mai jos)
```

**Cele două niveluri de test, și de ce sunt două.** Smoke-testul e *ermetic*:
taie tot ce merge spre Supabase și răspunde cu date inventate. E rapid, stabil
și nu atinge producția — dar validează o lume pe care noi am scris-o. Patru
defecte au ajuns la utilizator exact așa: codul salva un secret într-un tabel
inaccesibil, îl citea de acolo, lăsa o funcție SQL deschisă pentru `anon`, și
livra o funcție fără nicio cale de acces — iar mock-ul spunea că totul e bine.

`tests/contract.mjs` verifică fix ce un mock nu poate ști: granturi pe funcții,
ce poate citi și scrie rolul `anon`, ce întorc de fapt funcțiile edge. Rulează
pe **producție**, deci fiecare aserțiune e ori o citire publică prin design, ori
o operație care **trebuie refuzată**. Nu adăuga acolo un test care scrie.

Fișierul refuză să raporteze ceva dacă nu a ajuns la Supabase: prima lui rulare
a dat 27 de verificări verzi printr-un proxy care răspundea 403 la tot. În CI
merge cu `CONTRACT_REQUIRE=1`, deci „n-am ajuns la backend" pică în loc să
treacă în tăcere.

Smoke-testul include și o verificare de accesibilitate (WCAG 2 A/AA, prin
axe-core) pe toate paginile livrate; dacă `axe-core` nu e instalat, partea aia
se sare.

Excepția de la „ermetic" e coada offline: acolo backendul e **simulat**, nu tăiat. Un check-in
făcut fără semnal trebuie nu doar să *intre* în coadă, ci și să *iasă* din ea —
exact o dată — când revine conexiunea, iar asta se poate verifica doar dacă
cineva răspunde la scriere. Verificările `gate-flush-*` acoperă drumul ăsta.

CI pică și dacă modifici asset-uri livrate **fără să bumpezi versiunea service
worker-ului** (`CACHE` din `sw.js`) — altfel utilizatorii rămân cu aplicația
veche în cache.

## Structura fișierelor

| Fișier | Rol |
|---|---|
| `index.html` | Toată interfața aplicației (o singură pagină, secțiuni comutate) |
| `app.js` | Logica aplicației. Mare (~9k linii) și cu scope partajat |
| `i18n.js` | Registrul de limbi. Importă `ro` static, aduce `en`/`ru` la cerere |
| `i18n/{ro,en,ru}.js` | Pachetele de traduceri. Toate trei trebuie să aibă exact aceleași chei |
| `guide.js` + `guide/{ro,en,ru}.js` | Ghidul „cum funcționează aplicația" din Setări. Text, nu chei — încărcat abia când se deschide |
| `utils.js` | Helperi puri (fără state/DOM/DB) — acoperiți de teste unitare |
| `effects.js` | Efecte vizuale + haptic, independente de state |
| `styles.css` | Stiluri |
| `sw.js` | Service worker (cache stale-while-revalidate) |
| `server.js` | Server static pentru dezvoltare |

### Pagini publice (se dau prin QR/link, nu necesită cont)

| Pagină | Ce face |
|---|---|
| `register.html` | Formular de înscriere a mașinii |
| `vote.html` | Votare „Best Car" + clasament live |
| `agenda.html` | Programul evenimentului |
| `feedback.html` | Feedback post-eveniment (stele + comentariu) |
| `confirm.html` | „Vii la eveniment?" — link personal semnat, trimis în memento |
| `ticket.html` | Biletul participantului (QR de check-in) **și** butonul de conectare la Telegram |

## Roluri și permisiuni

Rolul e în `profiles.role`. Ierarhia din `app.js`:

```js
const ROLE_RANK = { gate: 0, member: 0, staff: 1, admin: 2 };
```

- **member** — vede datele, fără acțiuni de administrare.
- **gate** — cont dedicat pentru poartă. Aplicația pornește **blocată** pe
  ecranul porții; nu poate ieși în restul aplicației (doar logout).
- **staff** — check-in, zone, aprobare înscrieri, listă neagră, anunțuri,
  feedback, jurnal de erori.
- **admin** — tot, plus SMS Center, backup/restaurare, GDPR, votare, jurnal de
  activitate, ștergeri în masă.

## Modelul de securitate

Regula de bază: **clientul nu are voie să facă nimic privilegiat.** Tot ce e
sensibil trece prin RLS sau printr-o edge function cu service role.

- Cheia din pagină (`sb_publishable_…`) e **publică prin design**. Orice
  protecție care se bazează doar pe cod din client e decorativă — oricine poate
  trimite direct la API.
- Scrierile publice (înscriere, feedback) merg **exclusiv** prin funcția
  `submit`, care aplică honeypot și rate-limit pe IP. Politicile de INSERT
  pentru `anon` au fost eliminate intenționat.
- Rate-limit-ul folosește `rate_limit_hit()`, care rezervă slotul **atomic**
  (advisory lock). O verificare „numără apoi inserează" în JS **nu** e sigură:
  un val de cereri simultane trece în întregime.
- Secretele (SMS, push) stau în `app_config` și sunt citite doar server-side.

### Despre avertismentele Supabase advisor

Funcțiile `is_team_member()`, `is_staff_or_admin()`, `is_admin_user()` și
`current_email()` apar ca „SECURITY DEFINER executabile public". **Este
intenționat** — sunt folosite *în interiorul politicilor RLS*, deci trebuie să
rămână executabile de `anon`/`authenticated`. Revocarea lor strică toate
interogările protejate (s-a încercat o dată, a stricat aplicația).

Funcțiile `run_backup()`, `resync_sequences()`, `send_approval_sms()` apar la
fel, dar **își verifică singure apelantul** înăuntru (`is_admin_user()` /
`is_staff_or_admin()`). Avertismentul se referă la grant, nu la lipsa gărzii.

`rate_limits` are RLS activ fără politici — corect: scrie doar service role.

## Edge functions

| Funcție | JWT | Cine o folosește |
|---|---|---|
| `submit` | nu | **Singura** cale publică de scriere (înscrieri + feedback). Rate-limit pe IP. Decide tot aici dacă înscrierea intră `pending` sau `waitlist`, comparând `reg_capacity` cu numărul de locuri deja ocupate |
| `plate-check` | nu | Formularul public: spune doar dacă placa e cunoscută/blocată |
| `vote` | nu | Votare publică + clasament. Max 12 voturi noi/oră/IP. Întoarce și `entry_no` + clasa |
| `event-info` | nu | Evenimentul curent + agenda, pentru paginile publice. Întoarce și `waiver_text` și `spots_left` |
| `ticket` | nu | Bilet/pass |
| `rsvp` | nu | „Vii la eveniment?" pentru `confirm.html`. Token HMAC pe id-ul mașinii; un „nu" eliberează locul și promovează prima înscriere de pe lista de așteptare |
| `telegram` | nu² | Webhook-ul botului (`/start <id>-<token>` leagă chat-ul de mașină), configurarea de către admin și **linkurile de invitație** (`action:'invite'`, staff) |
| `health` | da | Starea canalelor pentru admin: Telegram (conectat? webhook viu? câți legați?), SMS (configurat?), adresa publică. Booleeni și numere, niciodată secretele |
| `backup` | nu¹ | Export JSON a 15 tabele în bucket-ul `backups`. Lista `TABLES` **trebuie să rămână în pas cu `PK` din `restore`** — un tabel salvat dar absent acolo se sare în tăcere la restaurare |
| `restore` | da | Restaurare **aditivă** din backup (admin) |
| `gdpr-delete` | da | Ștergerea datelor unei persoane (admin) |
| `photo-sweep` | da | Șterge pozele fără referință în DB (admin) |
| `send-push` | nu¹ | Notificări push |
| `send-sms` | nu¹ | Trimitere mesaje. **Două canale**, în ciuda numelui: Telegram unde participantul e conectat, SMS în rest |
| `import-participants` | nu¹ | Import din Google Sheets. Fiecare rulare are un `batch` și fiecare rând creat îl poartă, ca importul să poată fi anulat în bloc |
| `ai-import` | da | Import asistat |
| `read-plate` | da | OCR plăcuță |
| `admin-list-users`, `admin-delete-user` | da | Administrare conturi |
| `register-participant` | nu | **Dezactivată** (înlocuită de `submit`) |

¹ Fără JWT, dar protejate printr-un secret partajat în antet
(`x-trigger-secret` / `x-import-secret`), pentru că sunt apelate de cron sau de
trigger-e din baza de date.

² Telegram nu trimite JWT. Funcția verifică singură cine sună: antetul
`x-telegram-bot-api-secret-token` pentru Telegram, sau tokenul unui admin
verificat în `profiles` pentru configurare.

## Joburi programate (cron)

| Job | Când | Ce face |
|---|---|---|
| `kultura-scheduled-sms` | în fiecare minut | Trimite SMS-urile programate |
| `kultura-sheet-sync` | la 5 min | Sincronizare din Google Sheets |
| `kultura-task-reminders` | la 15 min | Remindere taskuri |
| `kultura-event-reminders` | la 15 min | Remindere eveniment (24h/2h înainte) |
| `kultura-daily-backup` | 03:17 UTC | Backup complet |
| `kultura-prune-rate-limits` | 04:23 UTC | Curăță contoarele mai vechi de o zi |
| `kultura-prune-client-errors` | 04:41 UTC | Curăță erorile mai vechi de 14 zile |
| `kultura-prune-activity-log` | 04:52 UTC | Curăță jurnalul de activitate mai vechi de un an |
| `kultura-prune-deleted-cars` | 04:35 UTC | Șterge definitiv mașinile din coș mai vechi de 30 de zile |

## Storage

| Bucket | Public | Conținut |
|---|---|---|
| `car-photos` | da | Pozele mașinilor |
| `registration-photos` | da | Pozele de la înscriere |
| `event-covers`, `maps`, `avatars` | da | Imagini de interfață |
| `backups` | **nu** | Backup-uri JSON; citire doar admin, prin signed URL |

Pozele rămase fără referință în DB se curăță cu **Setări → Curăță poze orfane**
(rulează întâi în gol). Fișierele mai noi de o oră sunt cruțate — o poză se
încarcă înainte să existe rândul care o referă.

## Setări în baza de date

`ui_settings` (chei relevante):

| Cheie | Efect |
|---|---|
| `voting_event_id` | Evenimentul deschis la vot. **Gol = votarea închisă** |
| `public_event_id` | Evenimentul fixat pentru paginile publice (gol = cel mai apropiat de azi) |
| `sms_welcome_enabled` / `_template` | SMS automat la sosire |
| `sms_approved_enabled` / `_template` | SMS automat la aprobarea înscrierii |
| `sms_reminder_enabled` / `_template` | Remindere înainte de eveniment |
| `zone_map_url` | Harta zonelor |
| `public_base_url` | Adresa publică a aplicației. Fără ea, `{{confirmare}}` din mesaje rămâne gol |
| `notify_prefer_telegram` | `1` = încearcă întâi Telegram, apoi SMS |

`app_config` conține URL-uri de funcții și **secrete** — nu se citește din
client. De aici: `link_secret` (semnează linkurile de confirmare și de Telegram),
`telegram_bot_token` și `telegram_webhook_secret`.

## Ce e periculos să atingi

1. **Nu revoca EXECUTE** pe `is_team_member` / `is_staff_or_admin` /
   `is_admin_user` / `current_email`. Sunt folosite în politicile RLS. Se strică
   tot.
2. **Nu muta rate-limit-ul înapoi în JS.** Verificarea trebuie să rămână atomică
   (`rate_limit_hit`), altfel o rafală concurentă trece integral.
3. **Nu repune politici de INSERT pentru `anon`** pe `car_registrations` /
   `event_feedback` — ar redeschide calea directă, ocolind rate-limit-ul.
4. **Restaurarea e aditivă** (upsert după cheie primară), nu „wipe & replace".
   Nu o transforma în ștergere fără o discuție serioasă: e ireversibilă și
   trebuie testată întâi pe un eveniment de test.
5. **Bumpează `CACHE` în `sw.js`** la orice modificare de asset livrat. CI te
   oprește dacă uiți.
6. **Pachetele `i18n/*.js` trebuie să rămână simetrice** pe ro/en/ru, inclusiv
   `{placeholder}`-ele. Garda din CI verifică. O limbă nouă înseamnă patru
   lucruri, nu unul: fișierul `i18n/<cod>.js`, pachetul `guide/<cod>.js`,
   intrarea în `SUPPORTED_LANGS` + `LOADERS` din `i18n.js` și în `LOADERS` din
   `guide.js`, plus adăugarea ambelor în lista de precache din `sw.js`. Garda
   pică dacă lipsește vreunul.
   Ghidul nu are chei, ci proză, deci garda îi verifică **forma**: același
   număr de faze, de pași per fază, de roluri și de intrări în depanare, în
   toate limbile — și că niciun pas nu rămâne fără titlu sau text.
7. **Nu pune `user-scalable=no` înapoi în viewport.** Blochează pinch-zoom-ul,
   ceea ce e o problemă reală de accesibilitate. Pe telefon există un prag de
   **16px pe toate câmpurile** (`@media (max-width: 768px)`, cu `!important` ca
   să bată declarațiile mai specifice) — tocmai ca iOS să nu mai mărească
   pagina la focus. Ăla e motivul pentru care `user-scalable=no` nu e necesar;
   dacă scazi câmpurile sub 16px, reapare. Verificat de `mobile-no-input-below-16px`.
   (Excepția de la `ticket.html` a fost eliminată; verificată de
   `ticket-allows-pinch-zoom`.)
8. **Evită stilurile inline din JS pentru stări vizuale.** Butoanele de limbă au
   avut ani la rând contrast insuficient exact pentru că stilul inline din JS
   bătea foaia de stil și nimeni nu se uita acolo.
9. **Nu transforma sincronizarea incrementală înapoi în „ia tot".** `loadData()`
   cere pentru `cars`/`tasks` doar rândurile cu `updated_at > watermark`.
   Depinde de triggerul `stamp_updated_at` din Postgres — dacă îl scoți,
   aplicația nu mai vede nicio modificare. Ștergerile nu apar niciodată într-un
   delta: le prinde realtime, iar ca plasă de siguranță `reconcileDeletions()`
   compară lista de id-uri o dată pe minut.
10. **Backupul acoperă și `event_feedback` și `car_votes`.** Lipseau până la
    v108 — sunt singurele două lucruri pe care le *produce* un eveniment
    încheiat, deci pierderea lor înseamnă pierderea rezultatului fără
    întoarcere. Când adaugi un tabel în `TABLES` din funcția `backup`, adaugă-l
    și în `PK` din `restore`, altfel se salvează dar nu se mai restaurează.
    `app_config` rămâne exclus intenționat: conține secrete.
11. **`run_backup()` nu citește răspunsul** funcției edge, deci cron-ul
    raportează „succeeded" și când backupul a eșuat. Singura dovadă reală e un
    fișier recent — de aia există banda de stare din **Setări → Copii de
    siguranță**. Nu o scoate fără să pui altceva în loc.
12. **Toată aplicația e scopată pe un eveniment.** `matchesActiveEvent()`
    filtrează listele, iar formularele preselectează evenimentul în lucru, deci
    ce se creează se leagă singur de el. Implicit: evenimentul „Activ", altfel
    cel mai recent neterminat, altfel toate. Două reguli nu se ating:
    rândurile cu `event_id` **null rămân vizibile sub orice eveniment** (sunt
    de dinaintea scopării — ascunderea lor ar arăta ca pierdere de date), iar
    un eveniment finalizat **rămâne accesibil** din selector. Nu transforma
    filtrarea în ștergere.
13. **Înscrierile publice primesc `event_id` în funcția `submit`**, nu din
    client: endpointul e public, deci un `event_id` trimis de apelant nu e de
    încredere. Se rezolvă server-side din evenimentul marcat „Activ".
14. **Numărul de concurs (`cars.entry_no`) se atribuie de trigger**, nu din
    client. `assign_entry_no()` rulează BEFORE INSERT și ia un
    `pg_advisory_xact_lock` pe eveniment, exact ca rate-limit-ul: două mașini
    înscrise în aceeași secundă ar primi altfel același număr. Unicitatea e
    per eveniment (index unic pe `event_id, entry_no`), deci numerele reîncep
    de la 1 la fiecare eveniment. Nu calcula `max(entry_no)+1` în JS și nu
    scrie câmpul la INSERT — triggerul respectă o valoare dată explicit, deci
    o valoare greșită din client rămâne greșită.
15. **Jurnalul de jurizare e per jurat, nu per mașină.** `judge_scores` are
    cheie unică pe `(car_id, judge_email)` și se scrie prin upsert, deci un
    jurat care se răzgândește își corectează nota în loc să adauge una nouă.
    Media afișată e media juraților, iar egalitățile se arată **ca egalități**
    (toți cu media maximă primesc 🏆) — nu le rezolva din ordinea sortării,
    decizia e a panelului. Tabelul e vizibil doar pentru `is_staff_or_admin()`.
16. **Capacitatea nu închide înscrierile.** Când `events.reg_capacity` e atinsă,
    `submit` marchează înscrierea `waitlist`, nu o respinge — formularul rămâne
    deschis, iar echipa promovează manual din coadă. Numărătoarea se face
    **server-side** (mașini + înscrieri neprocesate), pentru că `spots_left`
    din `event-info` e doar informativ și poate fi vechi în client. `0` sau gol
    în formular înseamnă *fără limită*, nu *zero locuri* — de aia se salvează
    ca `null`.
17. **Acordul de participare se afișează doar dacă `events.waiver_text` există.**
    Când există, semnătura (`waiver_name` + `waiver_at`) e obligatorie și se
    stochează pe înscriere — e singura urmă că omul a citit textul. Nu muta
    validarea exclusiv în client: câmpul se scrie în `submit`, iar textul vine
    din eveniment prin `event-info`.
18. **Ștergerea unei mașini e „soft".** Se pune `deleted_at`; rândul rămâne 30
    de zile și abia apoi îl șterge `prune_deleted_cars()`. Motivul e în date:
    jurnalul de activitate arată **1.670 de mașini șterse manual** de o singură
    persoană în două zile, în cicluri import → nu-mi place → șterg tot →
    reimport. Consecințele de care trebuie să ții cont oriunde citești `cars`:
    - orice interogare publică filtrează `deleted_at is null` (`ticket`, `vote`,
      `plate-check`, numărătoarea de capacitate din `submit`);
    - sincronizarea incrementală **nu** filtrează rândurile șterse, pentru că
      acel UPDATE *este* modul în care clientul află de ștergere — filtrarea se
      face după merge (`isTrashed`). Dacă o muți în interogarea delta, mașina
      ștearsă rămâne pe ecran până la următoarea măturare;
    - indexul unic pe `(event_id, entry_no)` e parțial (`deleted_at is null`).
      Un rând din coș își **păstrează** numărul scris pe el, dar nu blochează un
      alt rând viu să-l aibă.
    Singura ștergere definitivă rămasă e „Golește definitiv" din coș.
19. **Reimportul readuce mașina, nu o duplică.** `import-participants` compară
    și cu rândurile din coș; o potrivire aflată acolo e restaurată prin
    `restore_car_unchecked()`. Asta e ceea ce face ca un ciclu ștergere →
    reimport să nu renumeroteze lista de start. `restore_car()` e același lucru
    cu verificarea de permisiune deasupra — nu duplica logica în client.
20. **Lista de start înghețată e o garanție, nu o etichetă.** Cu
    `events.entries_frozen`, triggerul `guard_frozen_entry_no` **refuză** orice
    schimbare de `entry_no` pentru o mașină vie din acel eveniment. Mașinile noi
    primesc numere în continuare (cineva ajunge mereu târziu), iar o mașină
    scoasă din coș poate fi renumerotată — nu era pe lista printată oricum.
21. **Tokenurile din linkuri sunt HMAC, nu plăci.** `confirm.html` și invitația
    de Telegram folosesc `HMAC(link_secret, '<scop>:<car_id>')`, trunchiat la 24
    de caractere hex, comparat în timp constant. Placa e scrisă pe mașină: cu ea
    ca „cheie" (cum face `ticket`), un trecător ar putea anula participarea
    cuiva. **Construcția trebuie să rămână identică** în `rsvp`, `telegram` și
    `send-sms` — dacă diverge, toate linkurile aflate în circulație mor.
22. **Un „nu vin" mișcă lista de așteptare o singură dată.** Promovarea se face
    doar la trecerea în `no`, nu la fiecare apăsare, altfel un participant
    indecis ar plimba toată coada înainte. Promovarea duce în `pending`, nu în
    aprobat: echipa tot decide, doar că nu mai trebuie să observe locul liber.
23. **Nu citi și nu scrie `app_config` din client.** Tabelul are RLS activ
    **fără nicio politică**, intenționat: conține secrete. Din browser nu
    întorci nici măcar o eroare — primești o listă goală, deci codul pare că
    merge și tace. Exact așa s-a stricat prima versiune a panoului de Telegram:
    salva tokenul într-un tabel inaccesibil și apoi nu găsea niciun token.
    Orice secret trece printr-o edge function care verifică apelantul și scrie
    cu service role. Setările **ne**-secrete stau în `ui_settings`, unde staff
    are voie să scrie.
    Corolarul pentru teste: un mock care întoarce rânduri din `app_config`
    ascunde defectul. Verificarea `telegram-state-comes-from-function` întoarce
    listă goală de acolo, tocmai ca panoul să fie obligat să afle totul din
    funcție.
24. **Un bot de Telegram nu poate scrie primul.** Poate răspunde doar într-un
    chat pe care persoana l-a deschis ea. Deci canalul nu există până când
    participanții **își deschid linkul personal** — iar prima versiune livrată
    n-avea nicio cale de a împărți acele linkuri: botul era conectat, zero
    chaturi legate, niciun mesaj nu ajungea nicăieri. Linkul se obține din
    `ticket.html` (unde duce deja QR-ul de pe pass, deci nu cere distribuție
    separată) sau din `telegram` cu `action:'invite'`. Nu-l construi în client:
    e semnat cu `link_secret`, care stă în `app_config`.
    Când adaugi funcții de mesagerie, întreabă-te întâi *cum ajunge omul în
    canal*, nu doar *cum trimitem*.
25. **Un eveniment de probă nu are voie să ajungă în paginile publice.**
    `events.is_sandbox` e exclus în `submit` și `event-info` *înainte* de orice
    rezolvare — inclusiv înaintea unui `?event=<id>` din URL. Altfel un QR de pe
    un afiș, cu id-ul schimbat, ar depune înscrieri reale în evenimentul pe care
    cineva îl folosește ca să încerce lucruri. `wipe_sandbox_event()` refuză să
    atingă un eveniment care nu e marcat sandbox.
26. **Ce nu se poate pune în coada offline.** Coada rejoacă un `update` mai
    târziu, deci merge doar pentru scrieri care rămân corecte peste timp:
    starea unei mașini, zona, câmpuri de pe un rând existent. **Nu** merge
    pentru aprobarea unei înscrieri (baza atribuie numărul de concurs — rejucat
    mai târziu ar da un număr deja tipărit pe un pass), nici pentru
    restaurarea din coș (e un RPC), nici pentru revendicarea unui task (doi
    oameni pot lua același task; decizia asta e mai veche și rămâne). Astea
    spun clar „ai nevoie de conexiune" prin `requireOnline()`.
27. **O funcție SQL nouă e publică până o închizi tu.** Postgres acordă implicit
    EXECUTE lui `public`, iar în Supabase asta înseamnă că oricine are cheia din
    pagină o poate apela prin `/rest/v1/rpc/<nume>`. `prune_deleted_cars()` a
    fost livrată așa: **un vizitator nelogat putea goli definitiv coșul de
    gunoi**, adică exact plasa de siguranță pentru care există. Celelalte trei
    joburi `prune_*` erau deja închise — al meu era excepția.
    Regula: la orice funcție nouă care nu e chemată din client,
    `revoke all ... from public, anon, authenticated`. Excepțiile sunt tot cele
    din regula 1 (helperii de RLS) plus ce apelezi explicit prin `rpc()`.
    Verifică după fiecare migrare cu advisor-ul Supabase — el a prins-o, nu eu.
28. **Orice cale de mesaj trebuie să ducă un `car_id`.** Telegram-ul se
    rezolvă din el: fără car_id, `send-sms` n-are cum să găsească chatul și
    mesajul poate pleca doar ca SMS. Trei căi au fost livrate așa — campania
    din SMS Center, SMS-ul la aprobare și cel de bun venit — deci treceau
    automat pe un canal fără furnizor, adică nicăieri.
    A doua parte a aceleiași greșeli: toate trei ieșeau devreme dacă lipsea
    telefonul. Un participant conectat pe Telegram e de contactat chiar fără
    număr; condiția corectă e „telefon **sau** chat", nu „telefon".
29. **`send-sms` trimite pe două canale.** Numele a rămas pentru că îl apelează
    clientul, două joburi cron și două funcții din bază. Nu-l face să pice cu
    `no_provider` când există bot de Telegram: aici **nu a existat niciodată** un
    furnizor SMS configurat, deci Telegram e adesea singurul canal care chiar
    livrează.
30. **O secțiune goală nu e gratis.** Modulul „Invitați VIP" (tabel `vip_guests`,
    două taburi, două modale, listă proprie) a trăit cu **zero rânduri** de la
    început. Nu deranja pe nimeni în cod, dar ocupa un loc în meniul pe care îl
    vede și un voluntar de la poartă, plus un `select` și un abonament realtime
    la fiecare pornire. A fost scos din interfață.
    Ce **nu** s-a scos, și nu se confundă cu el: steagul `cars.is_vip` — badge-ul
    de pe mașină, chipul „VIP" din Mașini și marcajul de la poartă. E singurul
    „VIP" care a fost folosit vreodată.
    Tabelul `vip_guests` a rămas în bază și în backup: scoaterea din meniu nu
    șterge date. Coloanele `cars.vip_arrived` / `vip_arrived_at` erau citite doar
    de modulul scos, deci nu se mai cer la fiecare încărcare de mașini.
31. **Dacă o stare se poate seta din UI, trebuie și citită înapoi la pornire.**
    Coada de înscrieri are trei stări — `pending`, `hold`, `waitlist` — dar
    `loadData()` cerea doar primele două. „Pe lista de așteptare" scria în bază,
    dădea toast, desena tabul… și înscrierea dispărea la următoarea pornire.
    Handlerul de realtime o scotea din `state` la fel, deci pe alt dispozitiv
    cardul dispărea pe loc. Când adaugi o stare nouă, caută **toate** locurile
    care enumeră stările, nu doar cel care scrie.
    A doua parte: în română cele două butoane vecine se citeau aproape la fel
    („În așteptare" / „Listă de așteptare"), iar badge-urile de pe carduri erau
    **identice** — `reg.hold` și `reg.waitlist` aveau amândouă textul „În
    așteptare". În engleză și rusă erau distincte de la început, deci gardă de
    i18n nu avea ce prinde: cheile existau și erau traduse, doar că în română
    însemnau același lucru. Acum: „Amână" (amânată, decizi mai târziu) vs
    „Pe lista de așteptare" (evenimentul e plin).

32. **Funcțiile edge nu sunt în repo.** Trăiesc doar în Supabase; `git` nu le
    vede. Când modifici una, singura urmă rămâne aici, în README, și în
    versiunea funcției din dashboard. Înainte s-o rescrii, citește-o cu
    `get_edge_function` — altfel suprascrii o schimbare pe care n-o vezi în
    diff.
33. **Meniul botului e o promisiune.** `setMyCommands` afișează comenzile în
    butonul albastru „Menu"; Telegram nu verifică dacă botul le și
    implementează. O comandă listată dar netratată cădea până acum pe ramura
    „orice alt mesaj" și răspundea cu fișa mașinii, ca și cum ar fi mers.
    Regula: o intrare din `COMMANDS` are un handler, iar o comandă necunoscută
    spune că e necunoscută.
    Meniul se înregistrează în `action:'setup'`, adică la „Conectează botul".
    E deliberat tolerant la eșec: dacă `setMyCommands` pică, setup-ul nu pică
    — un bot care livrează fără meniu tot livrează.

34. **Un câmp obligatoriu se cere unde omul e deja acolo.** Zona era editabilă
    în fișa mașinii, dar nimic n-o cerea vreodată — rezultatul măsurat: 47 din
    52 de mașini fără zonă și 17 atribuiri de zonă în toată viața aplicației.
    Acum aprobarea unei înscrieri o cere, fiindcă ăsta e singurul moment în
    care cineva se uită oricum la mașina aceea.
    Ce **nu** s-a făcut: completare automată din categorie. Zonele se numesc ca
    și categoriile, dar potrivirea exactă acoperă doar 18 din 52 (JDM, Stance,
    Retro); pentru Performance, Drift, Supercar, German ar însemna să ghicim
    planul de parcare al organizatorului. O hartă categorie→zonă se poate face,
    dar o alege el, nu noi.
35. **`events.date` e text, `events.starts_at` e adevărul.** `date` e scris de
    om („23 - 24 August 2025"), `starts_at` e ce citesc reminderele,
    numărătoarea inversă și fereastra de confirmare. Poate fi null — și atunci
    toate trei sar peste eveniment **în tăcere**, ceea ce arată exact ca „n-a
    fost nimic de trimis". Lista de pregătire o spune acum pe față.
36. **Randează după ce ai pus toată starea, nu după prima felie.**
    `renderReadyList()` era chemat imediat după `state.cars`, înainte de
    `state.events` și `state.profiles` — deși citește evenimentul activ din
    primul și rolul din al doilea. La pornire la rece răspundea din nimic.
    Mutat după toate atribuirile, împreună cu `renderTgFunnel()`.

37. **Ce se poate verifica la Telegram fără să deranjezi pe cineva.** Marcajul
    HTML e validat de API **înainte** de căutarea chatului: trimite mesajul
    către un `chat_id` inexistent și citește descrierea erorii —
    `can't parse entities` înseamnă marcaj stricat, `chat not found` înseamnă
    că a trecut de parser. Așa se testează formatarea fără să ajungă nimic la
    un om real. (Toate cele trei formate — fișă, program, bun venit — au fost
    verificate așa.)

## Rămas de făcut manual

**Protecția împotriva parolelor compromise** nu se poate activa din cod:
Supabase Dashboard → Authentication → Passwords → *Leaked password protection*.
