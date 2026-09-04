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
| `plan.html` | Editor de plan al terenului. **De sine stătător** — vezi mai jos |
| `plan-render.js` | Geometria și desenul unui plan. Importat și de editor, și de `app.js` |
| `plans/*.json` | Planuri gata făcute, deschise cu `plan.html?load=plans/x.json` |

### Pagini publice (se dau prin QR/link, nu necesită cont)

| Pagină | Ce face |
|---|---|
| `register.html` | Formular de înscriere a mașinii |
| `vote.html` | Votare „Best Car" + clasament live |
| `agenda.html` | Programul evenimentului |
| `feedback.html` | Feedback post-eveniment (stele + comentariu) |
| `confirm.html` | „Vii la eveniment?" — link personal semnat, trimis în memento |
| `ticket.html` | Biletul participantului (QR de check-in) **și** butonul de conectare la Telegram |

### `plan.html` — planul desenat al terenului

Pagină separată (`/plan.html`), care nu vorbește cu aplicația: aici se *desenează*
un plan, iar aplicația îl poate lua ca hartă mai târziu, la cerere (vezi „Planul
ca hartă a aplicației"). Harta din `index.html` a fost dintotdeauna o **poză**
peste care se pun pini; asta e un **desen**: zone ca poligoane, rânduri de locuri
descrise prin cele două capete și numărul de locuri, alei, repere și text —
totul în **metri**, nu în procente dintr-o imagine.

Poza intră doar ca machetă sub desen: o pui, o calibrezi cu unealta 📏 („bucata
asta are 12 m"), trasezi peste ea, apoi o scoți. Nu intră în plan și nu se
exportă. Acceptă și PDF — planul unui teren vine de la arhitect ca PDF, nu ca
fotografie — randat cu `vendor/pdf.min.js`, încărcat abia când chiar alegi un PDF.

Un plan gata făcut se deschide dintr-un link: `plan.html?load=plans/plan-06.json`.
Calea trebuie să fie relativă și să se termine în `.json`; dacă pe dispozitiv
există deja un desen, pagina întreabă înainte să-l înlocuiască.

### `plans/plan-06.json` — terenul Kultura Fest

Extras din PDF-ul de execuție al evenimentului, nu desenat de mână. **2 628 de
obiecte**: tot desenul — asfalt, clădiri, alei, standuri, rândurile de parcare
ale vizitatorilor — plus **258 de locuri**, fiecare exact acolo unde e desenată
o mașină în plan, cu unghiul ei, grupate în 15 zone (STANCE, MODERN CARS, JDM,
AUTOSPORT, AMERICA, EURO, RETRO, GREEN ZONE, EXPO, VIP, DRIFT, Technical,
тех. парковка, FOOD COURT, CHILL). Culorile sunt cele din PDF.

Ce **nu** intră: liniile mai scurte de 1,4 m (detaliul interior al simbolurilor
și hașurile — 58 450 de trasee aruncate din 60 800) și conturul mașinilor, care
e deja reprezentat de locuri. Fără filtrul ăsta planul ar avea 60 de mii de
forme și n-ar mai fi editabil.

Scara nu e ghicită: PDF-ul își poartă propriile etichete de suprafață
(1 843,37 m², 1 091,66 m², 869,18 m², 262,70 m²), iar toate patru dau aceeași
valoare — **0,7094 m/pt**. La scara aia simbolul mașinii măsoară 4,72 × 1,90 m,
adică o mașină. Verificarea a fost vizuală: PDF-ul pus ca machetă la scara
calculată, iar locurile cad peste mașinile desenate.

Cele 20 de locuri fără zonă sunt mașini desenate în afara oricărei zone
colorate din PDF; sunt păstrate ca locuri și numărate separat, nu inventate o
zonă pentru ele.

Ce se desenează: **zone** (poligoane cu suprafața în m²), **rânduri** de locuri
descrise prin cele două capete și numărul de locuri, **locuri** singulare,
**alei**, **repere** și **text**. La import mai apar două tipuri pe care nu le
desenezi de mână, ci vin dintr-un plan: **suprafețe** (`area`) și **linii**
(`line`) — fondul desenului.

Fondul stă pe stratul lui (`#scenery`), din două motive care se văd imediat pe
un plan de câteva mii de forme: e **blocat** (apeși prin el, deci muți planul și
desenezi peste fără să-l agăți — se deblochează dintr-un buton), și se
redesenează doar când se schimbă sau când se schimbă zoom-ul. O deplasare nu-l
atinge. Grosimile de linie sunt în pixeli de ecran (`non-scaling-stroke`), ca un
plan CAD: firul rămâne fir la orice mărire.

**Fundalul** are două stări: întunecat (ca restul aplicației) și **hârtie** —
alb, cu etichetele în tuș, ca planul de la arhitect. Alegerea stă în plan, deci
se exportă cu el.

Geometria și desenul nu stau în pagină, ci în [`plan-render.js`](plan-render.js),
importat și de editor, și de `app.js`. Dacă fiecare ar desena în felul lui,
s-ar despărți în timp, iar un loc ar ajunge în două locuri diferite în cele două
— singurul lucru pe care un plan de parcare n-are voie să-l facă.

Ce trebuie știut înainte de a o atinge:

- **Nu vorbește cu Supabase.** Planul stă în `localStorage`
  (`kultura.plan.v1`), macheta separat (`kultura.plan.underlay.v1`, best-effort:
  o poză prea mare depășește cota și atunci se pierde doar macheta, nu planul).
  Se mută între dispozitive prin export/import JSON.
- **Nu scrie în `zone_map_url` / `zone_spots`.** Legătura cu harta există, dar se
  face în cealaltă direcție și explicit: aplicația citește JSON-ul planului
  atunci când i se cere. Editorul nu știe nimic despre ea.
- **Un singur fișier**, ca `vote.html` și `agenda.html`: HTML + CSS + JS inline.
  Sintaxa lui nu e prinsă de `node --check` din CI (verifică doar `*.js`), dar
  pagina e acoperită de `tests/smoke.mjs` (secțiunea `4r`) și de sweep-ul de
  accesibilitate.

### Planul ca hartă a aplicației

În secțiunea **Hartă**, un staff are butonul **„Planuri"**. Modalul lui ține
biblioteca (`zone_plans`) și trei drumuri către un plan: **„Desenează un plan
nou"** deschide editorul `plan.html` în fila lui, **„Adu un plan din fișier"**
urcă JSON-ul exportat de acolo, iar **„Planul din aplicație"** ia
`plans/plan-06.json`, cel care vine cu aplicația. Planul ales se scrie pe
eveniment (`events.plan_id`). Aplicația citește desenul la pornire și îl
**desenează în pagină ca SVG** — nu se face nicio poză din el.

Harta nu mai primește poze. Butonul „Înlocuiește" urca o imagine în bucket-ul
`maps` și-i scria adresa într-o cheie pe care aplicația n-o mai citește, deci
poza dispărea la prima reîncărcare; a fost scos împreună cu decupatorul și cu
cititorul de PDF pe care numai el îi folosea (regula 53).

#### Aceeași hartă ajunge și la șofer

Mini-harta exista de la început în aplicație — cardul de la scanarea de la
poartă desenează toate locurile ca puncte și îl mărește pe al mașinii. Numai că
o vedea staff-ul, nu omul care are nevoie de ea. Din v153 botul o trimite:
notificarea „locul tău a fost atribuit" pleacă drept **poză cu text în
caption**, nu ca text singur.

Din v154 poza aia e **chiar harta din aplicație** — desenul de arhitect, cu
zonele colorate, clădirile, drumurile și etichetele — cu un cerc roz peste locul
șoferului.

**Cine desenează ce.** Nu funcția edge. Planul are peste două mii de forme, iar
textul („GREEN ZONE", „4056 m²") și markerele emoji ar cere un font împachetat
în funcție și un rasterizator care să-l așeze. Browserul are și randorul, și
fonturile. Deci:

1. aplicația desenează planul o singură dată — la import, sau prima dată când un
   staff deschide o hartă care n-are încă poză — printr-un `<canvas>`, la 1280 px
   (cât servește Telegram o poză), și urcă PNG-ul în bucket-ul `maps`. Importul
   **nu așteaptă**: poza îi trebuie botului abia când cineva atribuie un loc,
   iar prima variantă ținea importul deschis cât desena canvasul — pe o mașină
   lentă planul părea neterminat și notele de la final apăreau în urma unui
   „se pregătește" pe care nu-l aștepta nimeni;
2. adresa lui se scrie în `zone_plans.render_path`;
3. botul descarcă PNG-ul, îl **decodează**, pune cercul și îl re-encodează.

`render_path` e un fișier **derivat**: se poate șterge oricând, aplicația îl face
la loc. Merge în `maps`, nu în `plans`, fiindcă `plans` acceptă doar
`application/json`.

**Și se vede.** Prima variantă desena poza numai în fundal și înghițea orice
eroare, deci un plan fără poză arăta exact ca unul care nici n-a fost încercat —
iar botul trimitea schema simplă fără ca cineva să poată afla de ce. Acum fiecare
rând din modalul **Planuri** spune „harta pentru bot: gata / lipsește", planul
fără poză are butonul **„Desenează pentru bot"**, iar `ensurePlanRender` întoarce
motivul (`draw:` / `upload:` / `save:`) în loc de `null` și îl trece prin
`client_errors`, unde se poate citi fără să întrebi omul.

**Trei niveluri, în ordine.** Harta reală dacă există poza; harta schematică
(dreptunghiuri pe hârtie albă, direct din `spots`) dacă planul n-a fost deschis
încă de nimeni; **text** dacă nici aia nu se poate desena. Poza nu poate face
notificarea să se piardă. Răspunsul funcției spune `map: "plan" | "spots" |
false` și separat `photo` (dacă Telegram a acceptat-o), ca să se poată deosebi
un plan nedesenat de un chat care a dispărut.

**În poză nu există text**, deliberat: zona și numărul stau în caption, unde pot
fi copiate, citite de un cititor de ecran și traduse.

**Decodorul PNG.** E partea care putea să iasă prost, deci e verificată direct:
aceleași octeți decodați de `map-png.ts` și de browser dau **exact aceiași
pixeli**, pe planul real de 1280×1410. Suportă doar ce scrie un `<canvas>` — 8
biți pe canal, neîntrețesut, culoare cu sau fără alfa; orice altceva întoarce
null și se cade pe harta schematică. La encodare, filtrul se alege pe fiecare
linie: fără el, desenul ieșea de trei ori mai mare decât îl făcuse browserul.

`zone_plans.spots` ține fiecare loc ca **procent din view box-ul desenului**, iar
view box-ul nu era scris nicăieri — aplicația îl recalcula din desen la fiecare
deschidere a hărții, ceea ce nimic din afara unui browser nu poate face. De aceea
planurile au și `view_w` / `view_h`: 1,5% din lățime și 1,5% din înălțime sunt
aceeași distanță pe teren doar dacă știi forma terenului. Ele încadrează harta
schematică; pentru cea reală, PNG-ul acoperă exact view box-ul, deci procentul
cade direct pe pixel.

**De ce nu o poză.** Harta se mărește de 8× la poartă, iar o imagine are o
rezoluție: prima variantă rasteriza planul la 4800 px și tot se făcea pastă la
capătul măririi. A doua încercare — SVG urcat ca fișier — pica în producție cu
„mime type image/svg+xml is not supported", fiindcă bucket-ul `maps` acceptă
doar `image/jpeg`, `image/png`, `image/webp`, `image/gif` și maximum 5 MB.
Răspunsul n-a fost un format mai bun, ci să nu se mai facă niciun fișier: un
desen randat în pagină n-are rezoluție și nu trece prin bucket.

**Grosimile sunt în metri**, nu în pixeli de ecran. Un bordur de doi metri arată
de doi metri la orice mărire — dar atunci linia cea mai subțire dispare când te
depărtezi, așa că `itemsSvg(plan, s, { metric: true })` îi pune un prag de vreun
pixel *la scara pentru care desenează*. De-aia SVG-ul se regenerează când
mărirea trece de o octavă (1×, 2×, 4×, 8×) și nu la fiecare pas: `view box`-ul nu
se schimbă niciodată, deci procentele pinilor înseamnă același lucru la orice
mărire.

**Zoom-ul e o dimensiune, nu un `transform`.** Asta e reparația de fond, și a
venit dintr-un raport de pe iPhone: desen vectorial, imagine pastă. `transform:
scale()` pe înveliș arăta corect în Chromium, care re-rasterizează desenul la
scara la care ajunge afișat; WebKit nu — un strat promovat păstrează bitmap-ul cu
care a fost pictat prima dată și îl întinde. Așa că înveliul se **așază** la
lățimea mărită (`width: 759%`), iar `transform` doar deplasează. Nimic nu mai e
scalat, deci n-are ce să se întindă, în niciun motor.

Trei lucruri vin la pachet cu asta:

- **Frame-ul are `aspect-ratio`.** Învelișul a ieșit din flux (altfel ar fi
  împins rama să crească odată cu zoom-ul și rama n-ar mai fi ramă), deci nu mai
  poate să-i dea o înălțime. Raportul vine din `view box`-ul planului, sau din
  mărimea pozei când se încarcă. Lățimea e fixată la `100%`, fiindcă altfel
  `min-height`-ul de la `is-zoomed` se întorcea ca o ramă mai lată decât ecranul.
- **Dimensiunea se fixează la 140 ms după ce zoom-ul se oprește.** Un deget pe
  „+" e o rafală de apăsări, un pinch e o rafală de cadre, iar fiecare
  dimensiune fixată reașază câteva mii de forme. `transform` arată schimbarea pe
  loc, dimensiunea vine când rafala se termină — deci răspunde imediat și e clar
  acolo unde te oprești. Ridicatul degetelor de pe sticlă o fixează fără să mai
  aștepte.
- **Fără `will-change: transform`, în nicio direcție.** Lăsat permanent, e
  instrucțiunea „refolosește bitmap-ul pe care îl ai" — cealaltă jumătate a
  motivului pentru care planul ieșea neclar. Pornit doar cât ține gestul, în
  schimb, schimbă stratul elementului în mijlocul unei secvențe de atingere,
  ceea ce e un mod bun de a pierde secvența. Deplasarea e o translație acum;
  motoarele o compozitează fără să fie rugate — și a ieșit chiar mai ieftină
  (471 ms pe gest față de 750, cu jumătate din `HitTest`).

Redesenarea SVG-ului la schimbarea de octavă merge tot cu dimensiunea fixată,
niciodată cu gestul: era singurul lucru scump de pe apăsare — 124 ms din cele
146 pe care le lua un pas de zoom pe un telefon lent, față de 4 când octava nu
se schimba. Acum un pas costă ~5 ms în handler și ~60 ms până pe ecran, măsurat
cu procesorul încetinit de patru ori.

**Gesturile nu se calcă pe dimensiune.** Două lucruri care nu se văd, dar care
se simt ca „harta nu se mai mișcă":

- Un `pointerdown` primar **golește setul de degete** înainte să se adauge în el.
  Un ecran tactil nu promite un `pointerup` pentru fiecare `pointerdown` — vine
  un apel, sistemul ia gestul, degetul iese pe margine. Un deget rămas în set
  face ca orice tragere de după să arate a jumătate de pinch: harta se mărește,
  dar nu se mai mută, până la reîncărcarea paginii. `tests/smoke.mjs` are
  `map-pan-survives-a-finger-that-never-lifts` exact pentru asta.
- **Fixarea dimensiunii nu se face cât timp e un deget pe sticlă.** Ea reașază
  tot desenul; făcută în mijlocul unei atingeri e și o smucitură, și o ocazie de
  a pierde gestul. Cronometrul se reprogramează până se ridică degetele.

Fiindcă planul se așază la mărimea lui adevărată, un pin măsurat în pixeli are
deja aceeași mărime pe ecran la orice zoom — de-aia `--pin-s` e acum
`zoom^0,12` (creșterea mică de deasupra) și nu `zoom^-0,88` (contra-scalarea de
care era nevoie cât timp totul era scalat).

**Scara de calitate** (`fitMapBlob`) a rămas, dar acum e doar pentru harta urcată
de om. Se renunță la calitate în ordinea în care doare cel mai puțin:

1. **WebP fără pierderi** — aceiași pixeli ca PNG-ul, cu un sfert mai mic.
2. **PNG** — pentru browserele care nu scriu WebP (`toBlob` cu tip nesuportat
   întoarce PNG, așa spune specificația, deci treapta întâi devine singură a doua).
3. **WebP 0,95**, apoi **JPEG 0,92**, apoi **JPEG 0,82**.
4. **Abia la urmă pixeli**: dacă nimic nu încape, imaginea scade cu un sfert și
   scara se reia. O hartă puțin comprimată la mărime întreagă se citește; una
   clară dar mică nu se poate mări.

Fără scara asta, harta urcată de om pica: o fotografie la 4096 px e ~17 MB ca
PNG fără pierderi — exact ce producea calea aia înainte, și exact ce refuză
bucket-ul. Mock-ul din `tests/smoke.mjs` cunoaște regulile bucket-ului (tipuri și
limita de 5 MB) — pe cele vechi, care acceptau orice, eroarea a trecut până în
producție.

Aici se întâlnesc două feluri de a spune unde stă o mașină: planul e un desen în
**metri**, harta e o suprafață cu pini în **procente** din ea. Conversia și
randarea vin din același `view box` — de-aia cad pinii pe locuri. Restul
aplicației nu se schimbă: check-in, „umple automat", zoom, toate merg mai
departe pe locurile aduse.

### Pinii sunt mașini

Un loc adus de pe un desen nu știe doar *unde* e boxa lui, ci și **cât e** și
**cum e întoarsă**: `zone_spots` primește `w`, `h` (procente din `view box`) și
`r` (grade). Cu ele, pinul poate fi boxa — aceeași mărime, același unghi — iar
pe ea se desenează o mașină văzută de sus. Un loc pus cu degetul pe o poză n-are
nimic din astea și rămâne bulină, ca înainte.

- **`planSpots` dă unghiul dreptunghiului**, nu direcția mașinii. Cele două sunt
  la 90° distanță și le citesc două fișiere diferite, deci nimic nu se plânge
  când se despart — o versiune de dinainte punea fiecare mașină de-a curmezișul
  liniilor între care era parcată. `tests/unit.mjs` compară acum unghiul raportat
  cu cel din desenul propriu-zis.
- **Boxa liberă e goală.** Conturul mașinii care ar încăpea în ea, atât cât să
  se vadă numărul boxei prin el. Plină, ar zice că e cineva acolo — pe două sute
  de boxe deodată.
- **Boxa ocupată e o mașină**, vopsită în culoarea zonei ei (vezi mai jos).
- **Desenul e poza, vectorizată.** Patru încercări desenate de mână s-au
  apropiat și niciuna n-a ajuns, așa că referința (`docs/car-top.jpg`) e sursa
  de adevăr: `scripts/trace-car.py` îi separă pixelii în trei — linia neagră,
  stâlpii gri, stopurile roșii — le urmărește conturul ca poligoane închise, le
  simplifică (Douglas-Peucker) și le scrie ca patru trasee. Silueta se ia din
  desen, nu se desenează a doua oară: umple golurile din cerneală și păstrează
  conturul exterior, deci nu se poate despărți de el.
  Sunt **date generate** — se editează scriptul sau poza, niciodată numerele.
- **O singură definiție, folosită de 238 de ori.** Traseele au 17 KB. Scrise în
  fiecare mașină, sunt patru megaocteți de markup pentru același desen; ca o
  intrare în `<defs>` sunt 17 KB o dată, iar fiecare mașină e un `<use>`. Puntea
  a scăzut de la 450 KB la 75 KB — mai mică decât cu desenul de mână pe care
  l-a înlocuit, deși are de zece ori mai multă linie.
  Costul e ~460 ms pe gest de deplasare față de 383, cu procesorul încetinit de
  patru ori: `Layerize` nu se mișcă (ține de numărul de straturi, nu de
  trasee), `HitTest` urcă de la 52 la 86 ms.
- **Vopseaua trece granița `<use>`-ului, selectorul nu.** `.taken .cp-body` nu
  se potrivește niciodată înăuntrul unui shadow tree. Proprietățile
  personalizate se moștenesc prin el, deci culoarea e o pereche `--paint` /
  `--paint-op` pusă pe grupul mașinii și citită de un `style` inline din
  definiție. Boxa liberă nu poartă nimic și ia albul punții; în modul de
  așezare nicio mașină nu poartă vopsea, ca regula unică de pe
  `.map-cars.is-editing` să le facă gri pe toate.
- **Stopurile își păstrează roșul** peste orice culoare de zonă. La distanță
  sunt două puncte; de aproape sunt diferența dintre o mașină cu botul spre alee
  și una cu botul în gard — întrebarea pe care și-o pune cineva de pe asfalt.
- **Numărul se scrie pe portbagaj**, nu peste mijloc: peste cabină ar acoperi
  exact detaliul de mai sus. Are `textLength` cât lățimea mașinii, fiindcă un
  număr de înmatriculare e mai lung decât un număr de intrare și altfel iese
  peste ambii vecini. Se scrie **la scara mașinii**, nu la mărime fixă pe ecran:
  ținut fix, ajungea mai lat decât toată boxa.
- **Toate mașinile pe o singură pânză.** `#mapCars` e un singur SVG sub pini, nu
  câte unul în fiecare pin. Două sute treizeci și opt de documente mici costau
  dublu la compozitor — 314 ms de `Layerize` pe un gest de deplasare față de
  167 ms — și mai erau și testate la coliziune în drum spre butonul de deasupra
  lor. Pânza n-are `pointer-events`; pinii de deasupra iau fiecare atingere.

**Pinii pe un plan dens.** Harta a fost desenată pentru câteva zeci de locuri;
planul are 238. Sub pragul la care un număr are loc, mașinile rămân mașini —
sunt deja de mărimea boxei — dar își pierd numărul, care acolo e doar o pată de
gri peste mașina pe care e scris. Pragul depinde de câte locuri sunt pe plan, nu
de o cifră fixă: `1,8 × √(n/26)`, plafonat la 6×.

**De ce n-au pinii sticlă mată.** `backdrop-filter` cere o suprafață de
randare per element. Cu două sute de pini, compozitorul refăcea straturile la
fiecare cadru de deplasare: 155 ms de `Layerize` pe un gest, față de 78 ms fără
— măsurat pe un telefon simulat cu procesorul încetinit de patru ori. Fundalul
puțin mai opac ține aceeași lizibilitate pe gratis. Nimic din felul cum arată
nu spune asta, de-aia are o verificare, nu un comentariu.

O idee care a picat la măsurătoare: oprirea testării de coliziune pe pini în
timpul deplasării. Economisea 25 ms de `HitTest`, dar selectorul descendent de
care avea nevoie invalida stilul tuturor pinilor de două ori pe gest — plus
50 ms. A fost scoasă.

Trei lucruri pe care le spune explicit, în loc să le înghită:

- **numele zonelor.** Desenul zice `MODERN CARS`, aplicația zice `Modern`.
  `PLAN_ZONE_ALIASES` le împacă; altfel o mașină din `Modern` n-ar prinde niciun
  pin. Potrivirea e altfel după literă, fără majuscule (`STANCE` = `Stance`).
- **locurile fără zonă.** Din cele 258 desenate, 20 sunt în afara oricărei zone
  colorate. Un loc fără zonă nu poate primi o mașină, deci nu e adus — și scrie
  câte au fost.
- **mașinile rămase fără loc.** Dacă o mașină stătea pe un loc care nu există în
  planul nou, `spot_no` i se pune pe `null` și numărul lor apare în interfață.
  Un număr de loc care nu duce nicăieri e mai rău decât niciun număr.

### Mașinile de pe hartă

Un loc desenat poartă și culoarea zonei lui (`c` în `zone_spots`, luată din
poligonul zonei din plan). Cu ea:

- **Boxa liberă e desenul unei mașini și atât** — caroserie albă, linii închise,
  cum se desenează o mașină de sus pe o fișă tehnică. Vopsită, ar zice că stă
  cineva acolo, pe două sute de boxe deodată.
- **Boxa ocupată e vopsită în culoarea zonei ei** — aceeași culoare cu care e
  desenată zona dedesubt, deci harta spune ce clasă unde stă, fără legendă.
  Așteptată e culoarea la jumătate, sosită e culoarea plină: diferența se vede
  dintr-o privire și nu costă a doua nuanță.
- `here` e **un fel de** `taken`, niciodată o alternativă la el. Scrise ca una
  sau alta, mașinile sosite ieșeau nevopsite ca boxele goale.
- Numărul se scrie cu cerneală închisă și halou alb, fiindcă o culoare de zonă
  poate fi orice de la `#ff0000` la `#96e1e1`, iar textul alb dispare pe
  jumătate dintre ele.

**Rama e cât coloana pe lățime și cât un ecran pe înălțime.** Un plan de teren e
cam la fel de înalt pe cât e de lat, deci lăsată liberă rama umplea fereastra și
încă puțin — puteai citi harta sau butoanele de sub ea, niciodată amândouă.
Înălțimea e plafonată la `min(72vh, 800px)`, cel mai mare plafon care ține
marginea de jos a ramei deasupra pliului la 1280×800, cea mai strâmtă fereastră
de laptop pe care merită socotit.

Lățimea **nu** e plafonată. Tăiată pe forma desenului arăta ordonat și nu dădea
nimic înapoi; la lățime întreagă surplusul e loc de mișcare după ce te apropii,
adică jumătatea hărții care chiar se folosește. Desenul încape întreg înăuntru și
stă centrat, iar rama primește hârtia desenului — altfel planul plutește ca o
insulă palidă într-o cutie întunecată, iar benzile de lângă el arată a ceva care
n-a reușit să se încarce. Pe telefon plafonul nu prinde deloc: planul e mai scund
decât el, deci rama rămâne exact cum era.

**Un tap lângă o boxă o alege pe ea.** La lățime întreagă o boxă are patru
pixeli pe un laptop și sub trei pe telefon: desenată exact, și imposibil de
nimerit. Dacă atingerea n-a căzut pe niciun pin, se ia pinul cu centrul cel mai
apropiat, în limita a 22px — „cel mai aproape" e un răspuns fără ambiguitate,
unde „elementul de deasupra" nu e. Nu se aplică în modul de așezare, unde un tap
pe plan pune un loc nou — și acolo doar cu unealta armată (vezi mai jos).

### Redactarea locurilor e un mod

Butonul **Redactează** stă sus, cu celelalte acțiuni ale hărții, nu în mijlocul
barei de sub ea. Apăsat, devine „Gata" și se colorează, iar uneltele modului
apar dedesubt: **„Adaugă un loc"**, „Rând întreg", „Golește zona" și selectorul
de zonă. În afara modului nu se văd — sunt controale fără nimic pe care să
acționeze.

Ordinea contează și în teste: **întâi modul, apoi zona.** Selectorul de zonă e
una dintre uneltele modului, deci nu e pe ecran până nu e modul.

**Un loc nou se adaugă cu butonul, nu cu un tap.** Așezarea era un tap gol pe
hartă, cu o zonă aleasă dintr-un `<select>` — două lucruri pe care nu le vedea
nimeni, și un tap rătăcit în timp ce trăgeai planul lăsa o boxă în urmă. Acum
„Adaugă un loc" e și lucrul pe care îl cauți, și armarea: întreabă o dată zona
(aceeași listă căutabilă ca la parcare, cu câte locuri are fiecare), apoi bara
scrie unde să apeși și fiecare tap lasă o boxă, până apeși „Gata cu adăugatul".
Zona se cere o singură dată — reînarmarea n-o mai întreabă, selectorul de lângă
buton o schimbă. „Rând întreg" și „Adaugă un loc" nu stau armate odată: un
singur tap, un singur înțeles.

**O apăsare ia boxa în mână, nu o șterge.** Înainte, orice atingere deschidea
„sigur ștergi?", deci ca s-o muți sau s-o întorci începeai prin a închide un
dialog. Acum apăsarea o alege — se conturează, bara scrie ce e și la câte grade
stă — iar ștergerea e butonul **„Șterge locul"** de sus, mort până alegi ceva.
Apeși din nou boxa, sau planul pe lângă ea, și o pui jos.

Ștergerea nu întreabă decât când merită: o boxă goală e o corectură de desen, pe
când una cu cineva pe ea îi ia locul — atunci se cere confirmarea și se spune
cine stă acolo, iar mașinii i se pune `spot_no` pe `null`. Fără asta, numărul
locului rămânea pe fișa ei, arătând spre o boxă care nu mai există.

**Inelul care rotește.** În jurul boxei alese apare un cadru cu două săgeți,
măsurat în procentele boxei și nu în pixeli: un cerc de mărime fixă înghite boxa
la lățime întreagă și dispare în ea la 8×. Cadrul e semn, nu țintă — doar cele
două săgeți primesc pointer-ul, fiindcă plin, acoperea exact boxa pe care o
încadra și tragerea de mutat o rotea în loc s-o mute.

Unghiul se ia ca **diferență** față de locul de unde ai apucat, nu ca „arată
spre degetul meu": altfel boxa sărea într-o poziție nouă la prima atingere.

Și un lucru care se vede doar când lipsește: **o tragere se termină cu un
click.** Nelăsat în urmă, el conta drept apăsare pe plan și punea boxa jos exact
când terminai de rotit-o. E înghițit în faza de captură pe `#mapContainer`, deci
niciunul dintre cele două handler-e de apăsare nu-l vede.

Boxa nouă **moștenește de la vecina ei**: culoarea zonei (`c`, altfel o mașină
parcată pe ea ieșea albastrul implicit într-o zonă galbenă) și unghiul boxei
celei mai apropiate din aceeași zonă — un rând desenat pe diagonală n-are ce
face cu o boxă pusă drept. Distanța se măsoară pe desen, nu pe procente: un
procent pe orizontală și unul pe verticală nu sunt aceeași lungime.

Stilul butonului stă în CSS (`.add-btn.quiet`), nu într-un atribut `style`: un
fundal inline bate orice clasă, iar starea apăsată ieșise cerneală închisă pe
buton închis. O hartă ștearsă stinge modul — un cursor de cruce peste o ramă
goală n-are ce să însemne.

### Parcarea unei mașini

Apeși o boxă liberă, alegi mașina. O linie sub hartă spune că boxele se pot
apăsa — fără ea nimeni n-o găsea, pentru că la lățime întreagă o boxă are patru
pixeli. Un tap pe lângă boxă contează tot ca tap pe ea.

Drumul celălalt — un buton „Parchează o mașină" care alegea întâi mașina, apoi
aștepta apăsarea locului — a fost scos împreună cu „Umple automat": locul se
alege de fiecare dată cu mâna, de la boxă.

### „Cine stă pe locul ăsta?"

Apasă un loc liber și dialogul întreabă care mașină merge acolo. Era un `select`
nativ: pe telefon, o rotiță derulată orbește peste o sută de nume. Acum e o
listă pe care o cauți și o atingi (`uiChoose` → `.ui-pick`):

- **Atingerea unui rând e răspunsul.** Butonul de confirmare e ascuns pentru
  forma asta de dialog — după ce ai ales un nume, ar pune aceeași întrebare de
  două ori. Rămâne doar „Anulează".
- **Două rânduri, nu unul.** Sus mașina (`#200 · VW Golf`), dedesubt cine e și
  cu ce număr (`Ana Pop · B100XYZ · Stance`). Primul e ce vezi pe asfalt, al
  doilea e cum verifici că e chiar aia.
- **Căutarea prinde și ce nu e pe ecran.** Numărul de înmatriculare e cel mai
  rapid de tastat când mașina e în fața ta și cel mai greu de citit dintr-o
  listă, deci intră în `search` fără să fie linia principală.
- **Se desenează cel mult 40 de rânduri**, iar nota de dedesubt spune câte au
  mai rămas. Patru sute de rânduri sunt un dialog lent și oricum necitibil, iar
  nota e și îndemnul de a mai scrie o literă.
- **Câmpul de căutare nu primește focus la deschidere.** Pe telefon, tastatura
  ar acoperi exact lista pentru care ai deschis dialogul. E la o atingere
  distanță, adică fix atunci când lista e prea lungă ca s-o citești.

## Ce se ține minte despre o mașină

### Locul intră în jurnal

`log_activity` urmărea statusul, zona și responsabilul unui task. Nu și
`spot_no` — iar locul e câmpul pe care îl citesc harta, cardul de la poartă și
botul. Măsurat pe producție: **303** schimbări de status înregistrate, **131**
de zonă, **zero** de loc.

A contat o dată: un plan legat de evenimentul greșit a lăsat 53 de mașini fără
locul primit, într-o singură instrucțiune, fără să rămână nimic — cine, când,
sau ce era înainte. Numărul era pe un dialog pe care nimeni n-avea motiv să-l
recitească.

Acum se scrie ca „Zonă Loc", nu ca număr gol: „12" singur e unul din unsprezece
locuri diferite pe planul ăsta. Iar un loc luat se scrie **gol**, nu ca zona
rămasă — altfel jurnalul ar spune că mașina a fost mutată în „Autosport" exact
când i s-a luat locul din Autosport.

### Dacă botul a ajuns sau nu

Telegram e **singurul** canal: n-a existat niciodată un furnizor de SMS. Deci un
mesaj pe care Telegram îl refuză — botul blocat, chatul șters — e un șofer care
ajunge la eveniment fără să știe unde parchează, iar tu afli abia la poartă.

Funcția știa deja (`ok` din `sendMessage`/`sendPhoto`), dar răspunsul se ducea în
`net._http_response` și nu-l citea nimic. Acum se scrie pe mașină
(`telegram_notify_ok`, `telegram_notify_kind`, `telegram_notified_at`) și cardul
arată „🔕 n-a primit".

Scrierea urmei nu poate strica livrarea: mesajul a plecat sau nu a plecat deja
când se ajunge acolo, iar `remember` înghite orice eroare. Nu declanșează nici
notificarea din nou — trigger-ul e `after update of spot_no`, iar aici se scriu
alte coloane.

### Restaurare în masă din coș

Ștergerea a 55 de mașini a fost o acțiune. Readucerea lor era 55 de apăsări,
fiindcă singura cale înăuntru era `restore_car(id)`, una câte una.

Coșul grupează acum după **momentul ștergerii** — ce s-a șters în aceeași
secundă s-a șters împreună — și fiecare grup are un buton. Regula de renumerotare
nu se repetă nicăieri: `restore_cars(ids)` trece fiecare mașină tot prin
`restore_car_unchecked`, care întoarce numărul vechi sau primul liber dacă
între timp l-a luat altcineva. Un grup e o singură tranzacție: ori intră tot, ori
nimic. Plafon 500 într-un apel.

Un grup de una singură nu primește antet — ar fi zgomot peste un singur rând.

## Fundalul care se mișcă

Fiecare pagină avea deja două pete estompate în colțuri — mov și albastru, fixe.
Din v158 se mișcă, și li s-a adăugat a treia, în magenta din logo.

**Ce se animează, și de ce doar atât.** Numai `transform`. Blur-ul de 130–150 px
se calculează o dată, iar ce se mișcă e o textură pe care compozitorul o
alunecă — fără repaint, fără layout. De asta merge fără cost pe telefonul care
în același timp desenează harta sau ține camera deschisă la poartă. O animație
de `top`/`left` ar fi făcut exact invers.

Deplasarea e în `vw`/`vh`, ca să fie proporțională: o pată care rătăcește 16% pe
un laptop rătăcește tot 16% pe telefon.

**Cele trei durate — 30s, 38s, 46s — nu se împart una în alta**, deci compoziția
nu se repetă vizibil. Prima variantă avea 54/68/82s: corect, dar în zece secunde
nu se schimba nimic perceptibil, adică toată treaba nu se vedea. Ciclurile de
acum se citesc la o privire de câteva secunde fără să tragă ochiul de pe conținut.

**A treia pată stă pe `html::before`**, fiindcă `body::before` și `body::after`
erau deja luate, iar un `<div>` nou ar fi însemnat șapte pagini modificate
pentru un lucru pur decorativ.

**`prefers-reduced-motion: reduce` oprește tot.** Petele rămân exact unde sunt —
pagina își păstrează adâncimea, doar încetează să se miște. Asta nu e gust, e o
setare reală de accesibilitate, iar o animație decorativă care o ignoră e un
defect. Două teste o păzesc, în ambele sensuri: unul cere să stea pe loc când
setarea e pornită, celălalt cere să se miște când nu e — fiindcă o regulă care
ar întoarce mereu `none` ar trece primul test livrând nimic.

**Unde nu se aplică:** `ticket.html` (biletul se ține în mână la poartă, în timp
ce cineva scanează un QR — nu e locul pentru mișcare) și `plan.html` (editorul de
plan e o unealtă de desen, nu o vitrină). Regula e duplicată în fiecare pagină
publică, ca tot restul stilului lor: paginile alea se deschid de pe un QR, pe
date mobile, și sunt de sine stătătoare dinadins — un fișier CSS comun ar fi
însemnat încă o cerere care blochează randarea.

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
| `telegram` | nu² | Webhook-ul botului (`/start <id>-<token>` leagă chat-ul de mașină), configurarea de către admin, **linkurile de invitație** (`action:'invite'`, staff) și mesajele pe care sistemul le trimite singur (`action:'notify'`). Are **două fișiere**: `index.ts` și `map-png.ts` — decodor + encoder PNG, care pune cercul peste harta desenată de aplicație |
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

`pg_net` e asincron: `net.http_post` întoarce un id, nu un răspuns. Un job care
aruncă acel id nu poate afla niciodată dacă a reușit — `kultura-sheet-sync` a
trimis așa 288 de cereri pe zi și toate s-au întors 404, fiindcă scriptul Apps
Script de la capătul linkului salvat nu mai există. Nimic, nicăieri, n-a spus-o.

De aceea `sync_cars_from_sheet()` întâi *închide* cererea precedentă
(`settle_integration_run`), apoi trimite și ține noul id
(`remember_integration_run`). Rezultatul stă în `integration_runs`, o linie per
job, iar aplicația îl arată ca a patra pastilă în „Starea canalelor".


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
| `sms_welcome_enabled` / `_template` | Mesaj automat la sosire. Pleacă prin Telegram, SMS ca rezervă |
| `sms_approved_enabled` / `_template` | Mesaj automat la aprobarea înscrierii |
| `sms_reminder_enabled` / `_template` | Remindere înainte de eveniment. **Numele minte: oprește mesajul, nu canalul** |
| `zone_map_url` | Harta zonelor, ca poză urcată |
| `zone_plan_url` | Planul desenat care ține loc de hartă (`plans/*.json`). Are prioritate față de poză |
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
    de pe mașină, chipul „VIP" din Mașini și marcajul de la poartă.
    **Corectură:** aici scria că steagul de pe mașină „e singurul VIP folosit
    vreodată". Nu e adevărat. `is_vip` n-a fost niciodată `true`, pe niciun
    rând, nici în coșul de gunoi — la fel de mort ca modulul scos. A fost
    păstrat pe baza unei afirmații neverificate. Rămâne deocamdată, dar ca
    steag nefolosit, nu ca funcție dovedită.
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

38. **Ce nu se folosește se scoate, dar întâi se numără.** Trei funcții au
    ieșit odată, fiecare cu cifra ei din producție:
    * **Check-out la poartă** — `left_at` null pe toate cele 54 de rânduri care
      au existat vreodată. 18 mașini au sosit, 0 au plecat.
    * **Numele porții** — `checked_in_gate` gol la toate cele 18 sosiri, deși
      RUNBOOK-ul îl cerea la pasul 2 al pregătirii tabletelor.
    * **Ramura `vip_guests` din `send-sms`** — rămasă după ce modulul a fost
      scos din interfață; clientul nu mai trimite acele audiențe, deci putea
      doar să nu găsească nimic.
    Coloanele rămân în bază: scoaterea din interfață nu șterge date.
    `statusKey` încă recunoaște cuvântul „plecat", ca un backup restaurat să se
    randeze în loc să cadă.
39. **Un raport de succes trebuie să poată fi citit fără cifrele de lângă el.**
    O campanie care ajungea la 1 din 52 se salva ca `sent` — verde în istoric,
    identică cu una care chiar a plecat. Acum: `partial` când o parte a ajuns,
    `error` când n-a ajuns nimic, plus un avertisment **înainte** de trimitere
    care spune câți pot primi. Un număr de telefon nu e un canal cât timp nu
    există furnizor SMS.
40. **O stare tranzitorie are nevoie de cineva care s-o închidă.** Anularea unei
    campanii scria `cancelling` și se baza pe bucla de trimitere s-o observe
    între loturi — dar bucla se terminase deja, ceea ce e cazul obișnuit, o
    campanie durând secunde. Rândul rămânea așa la nesfârșit (#3, din 20
    august). `reconcile_stuck_sms()` rulează pe minut, lângă expeditorul
    programat, și închide orice campanie rămasă în `sending`/`cancelling` de
    peste 30 de minute, lăsând urma în `delivery_report`.

41. **O poziție pe o imagine se ține în procente, nu în pixeli.** Locurile de
    parcare sunt puncte pe fotografia locației, iar aceeași hartă se citește pe
    telefon, pe laptop și pe proiector. Pixelii ar muta planul de pe asfalt la
    prima schimbare de lățime. Valorile se limitează la 0–100 și la citire, nu
    doar la scriere: un rând stricat în tabel n-are voie să scoată un pin în
    afara imaginii, unde nimeni nu-l mai poate apuca.
42. **Unicitatea locului e treaba bazei, nu a interfeței.** Două mașini pe
    același loc înseamnă doi șoferi trimiși pe aceeași bucată de asfalt.
    `cars_one_car_per_spot` e un index unic parțial pe
    `(event_id, lower(zone), spot_no)`, doar pentru rândurile vii cu loc setat —
    deci majoritatea neașezată nu e afectată, iar planul de luna trecută nu
    blochează luna asta. Clientul doar traduce eroarea 23505 într-un mesaj.
43. **Ce nu s-a făcut, deliberat: atribuirea automată la poartă.** Ar fi firească
    — scanezi, primește locul următor — dar check-in-ul trece prin coada
    offline, deci locul ar trebui pus și el în coadă, iar indexul de unicitate
    s-ar aplica abia la golire, când e prea târziu ca operatorul să afle. Se
    face separat, cu rezolvarea conflictelor la flush.
44. **Un plan se desenează pe rânduri, nu punct cu punct.** Planurile reale au
    ranguri de patruzeci de locuri pe o linie. Apăsat unul câte unul nu mai e
    planificare, e introducere de date, așa că un rând se descrie prin cele două
    capete ale lui și prin câte locuri intră între ele. Iar orice unealtă care
    scrie patruzeci de rânduri dintr-un gest are nevoie de o anulare de aceeași
    mărime — de aici „Golește zona".
45. **Fără zoom, harta se poate privi, dar nu se poate folosi.** Scalată pe un
    telefon, o celulă de parcare are câțiva pixeli: nu se poate apăsa, nu se
    poate citi. Zoom-ul nu e un adaos peste locurile numerotate, e condiția ca
    ele să existe. Pinii se contra-scalează, ca mărirea să-i depărteze între ei
    în loc să-i umfle unul peste altul, iar sub o mărire utilă planul dens arată
    puncte colorate: ocuparea se citește dintr-o privire, mașinile revin când e
    loc pentru ele. Deplasarea se oprește la marginea imaginii — un plan care
    poate fi tras în afara ramei lasă cititorul cu ecranul gol.
46. **Numărul locului nu călătorește cu mașina.** Locul aparține zonei în care a
    fost dat. Mutată în altă zonă, mașina și-l pierde: păstrat, ar arăta fie
    către un loc care nu există în zona nouă, fie către unul deja ocupat, iar
    indexul de unicitate ar refuza toată mutarea cu o eroare de cheie duplicată.
47. **`cars.zone` e NOT NULL cu implicit `''`.** „Fără zonă" se scrie cu șir gol,
    nu cu null — altfel baza refuză scrierea, iar opțiunea goală din selectorul
    de zonă devine un mesaj de eroare. Verificat pe producție: `23502`.

48. **Planul e o înregistrare, nu o constantă.** Desenul terenului era numit de
    o constantă în `app.js`, iar boxele stăteau într-un singur rând din
    `ui_settings`. Din asta ieșeau două limite care nu se vedeau ca limite: un
    teren avea exact un aranjament, deci pregătirea evenimentului următor îl
    ștergea pe cel dinainte, iar un desen nou cerea un deploy. Acum un plan e un
    rând în `zone_plans` — nume, desen, boxe — și se aduce dintr-un fișier.
49. **Ce plan folosește un eveniment se scrie pe eveniment.** `events.plan_id`,
    nu `zone_plans.event_id`: un plan e un obiect de bibliotecă, se dublează și
    poate sta nefolosit. Ținut invers, un aranjament l-ar urma pe cel care l-a
    deschis ultimul. `on delete set null` — ștergerea unui plan lasă evenimentul
    fără hartă, nu fără rând. Și `plan_id` intră în amprenta evenimentelor:
    fără el, un plan pus de pe alt dispozitiv n-ar redesena harta aici.
50. **Adresa de unde se aduce un desen e o listă albă.** Aplicația face `fetch`
    la ea, iar rândul e editabil de oricine are drepturi de staff. Două surse
    sunt ale noastre — bucket-ul `plans` și fișierul din aplicație — și nimic
    altceva; `..` se refuză înaintea ambelor ramuri, fiindcă un URL de bucket e
    tot un URL. Regula stă în `utils.js`, ca să poată fi testată singură.
51. **Bucket-ul `maps` primește doar imagini.** De aceea un plan SVG trebuia
    rasterizat înainte de urcare. Un desen e JSON, deci are bucket-ul lui
    (`plans`, `application/json`), cu aceleași politici de staff.

52. **O referință luată înaintea unui `await` nu mai e rândul.** Sincronizarea
    periodică înlocuiește obiectele din `state`, nu le modifică. Între un dialog
    de confirmare și scrierea care-i urmează încap două aşteptări, iar un
    `refresh` care aterizează între ele lasă în mână un obiect desprins:
    modificat, baza iese corectă și ecranul greșit, până la următoarea
    reîncărcare. După orice scriere, rândul se caută din nou după `id`
    (`setEventPlanLocally`). Găsit exact așa: comutarea planului scria
    `events.plan_id` în bază, dar harta rămânea pe planul dinainte.

53. **Poza de fundal a hărții scria acolo unde nimeni nu mai citea.**
    „Înlocuiește" urca imaginea în bucket-ul `maps` și-i punea adresa în
    `ui_settings.zone_map_url` — o cheie pe care aplicația n-o mai citește de
    când planul e o înregistrare cu `map_url`-ul lui. Poza se vedea până la
    prima reîncărcare, apoi dispărea. Când o cheie iese din citire, drumurile
    care mai scriu în ea sunt moarte, nu doar tăcute.

54. **Un lucru care se aduce trebuie și să se poată face.** Modalul de planuri
    aducea un plan din fișier și spunea că fișierul e „JSON-ul exportat din
    editorul de plan", dar la editorul acela (`plan.html`) nu ducea niciun
    buton din aplicație. Primul plan se putea face doar știind adresa pe
    dinafară. Butonul „Desenează un plan nou" deschide editorul în fila lui, ca
    biblioteca de planuri să nu se reîncarce și să uite evenimentul.

55. **Zonele sunt o listă care se mișcă, nu o constantă.** Cele nouă clase ale
    aplicației sunt scrise în cod, dar terenul își aduce propriile nume odată cu
    desenul — EXPO ZONE, GREEN ZONE, VIP ZONE — și mașini chiar stau în ele: 8
    din 54 la ultimul eveniment. Construite doar din constantă, toate listele de
    zone nu puteau spune unde stau acele 8 mașini, iar o boxă nici nu se putea
    desena într-o astfel de zonă. `allZones()` le unește: întâi clasele
    aplicației, apoi ce aduce planul, fără dubluri.

56. **Ce se poate da trebuie să se poată și lua înapoi.** `stamp_car_arrival`
    punea `arrived_at` la sosire și nimic nu-l ștergea vreodată. O apăsare
    greșită la poartă, „reparată" punând statusul înapoi pe Invitat, lăsa ora
    acolo — iar aplicația numără o sosire ca `status = 'sosit' SAU arrived_at
    not null`, deci mașina rămânea sosită pentru totdeauna. Producția avea 18
    rânduri cu oră și 16 cu status. Ieșirea din starea „sosit" șterge acum ora
    și cine a lăsat mașina să intre; trecerea la „plecat" e singura excepție.
    Trigger-ul se verifică singur în migrație: patru aserțiuni într-un bloc
    `do`, iar un eșec ar fi anulat migrația.

57. **O audiență numită „confirmați" trebuie să însemne confirmare.** Filtrele
    de campanie citeau statusul „Sosit" în loc de `rsvp`. Înainte de eveniment
    n-a sosit nimeni, deci „confirmați" era mereu goală; în ziua evenimentului
    „neconfirmați" pierdea pe toți cei care veniseră fără să răspundă.

58. **Lista de pregătire trebuie să vadă și ce nu e pe ecran.** Se uita doar la
    evenimentul activ — și exact așa două evenimente create într-o săptămână au
    stat la două zile distanță fără nicio mașină, fără plan și fără capacitate,
    în timp ce Acasă spunea că totul e în regulă. Acum orice eveniment care
    începe în următoarele 7 zile își spune lipsurile, oricare ar fi evenimentul
    din focus.

59. **Canalul se leagă când omul e în fața ta.** Invitația spre bot se putea
    doar trimite — prin WhatsApp — iar canalul e tocmai ce lipsea: 51 din 54 de
    șoferi n-au putut fi atinși deloc, și confirmarea pe care n-a primit-o
    nimeni a strâns zero răspunsuri. La poartă problema dispare: omul stă în
    fața ta cu telefonul în mână. După ce mașina e trecută, rândul din poartă
    oferă codul QR al invitației lui — o dată, doar cât timp nimic altceva nu-l
    poate ajunge, și doar dacă botul chiar e viu.

60. **Scanarea trebuie să spună unde se merge.** Poarta identifica mașina și se
    oprea acolo: cartonașul dădea numele, proprietarul și statusul. Singurul
    lucru pe care șoferul îl aștepta — unde să tragă — era în alt ecran, deci
    operatorul citea numărul cu voce tare și pleca să-l caute. Cartonașul spune
    acum numărul de concurs, zona și locul, cu literele cele mai mari de pe el,
    sau spune limpede că nimeni n-a alocat încă un loc și oferă drumul spre
    hartă. Locul se aprinde pe plan, fără să miște panorama sub degetul nimănui.

61. **Culoarea e primul lucru pe care-l vede un om la poartă.** Aplicația purta
    marca, modelul și numărul; culoarea, singura care se potrivește dintr-o
    privire peste un rând de mașini, nu era cerută nicăieri. Acum se întreabă la
    înscriere și se citește pe cartonașul de la scanare.

62. **O boxă are trei stări, nu două.** Liber și ocupat erau singurele, deci o
    boxă ținută pentru cineva se putea doar ține minte. `res` pe boxă o pune
    deoparte: se desenează chihlimbariu, se numără între cele de pe plan, și
    când cineva vrea totuși să pună o mașină acolo e întrebat o dată — o
    rezervare e o notă de la cine a făcut-o, nu un lacăt.

65. **Canalul se cere când omul e sigur acolo.** Invitațiile împărțite după
    eveniment au ajuns la 3 șoferi din 54; formularul de înscriere e singurul
    moment în care participantul e cu siguranță în fața ecranului. De aceea
    conectarea la Telegram e acum obligatorie ca să se poată trimite înscrierea.

    Fluxul: pagina cere o sesiune (`registration_sessions`), primește un token
    de 128 de biți valabil 15 minute, îl duce pe om la bot ca `?start=r<token>`,
    apoi întreabă serverul la fiecare 3 secunde dacă a venit chat-ul. Nimeni nu
    dă refresh. La trimitere, tokenul merge cu formularul și **e verificat din
    nou pe server**: butonul dezactivat e o politețe, endpoint-ul e public.
    Fără sesiune conectată → `403 telegram_required`, fără niciun rând scris.

    Tokenul se cheltuie o dată, și abia după ce rândul chiar a fost scris — dacă
    inserarea eșuează, omul rămâne cu un token viu, nu cu unul mort și un
    formular pe care nu-l mai poate trimite.

    `telegram_user_id` e identitatea, nu username-ul: un username se schimbă sau
    lipsește. La acceptarea înscrierii, chat-ul trece pe mașină, deci o mașină
    aprobată e de contactat din primul minut.

    Sesiunea n-are `user_id`: participanții n-au conturi în aplicație, iar o
    coloană care n-are niciodată valoare e mai rea decât una absentă.

    Tabela are RLS pornit **fără nicio politică**, ca `app_config`: tokenul e
    credențialul, deci o tabelă citibilă ar da toate sesiunile oricui are cheia
    anonimă. Din același motiv verificarea se face prin polling la o edge
    function, nu prin Realtime — cheia anonimă n-are ce să asculte.

66. **Un canal obligatoriu care nu spune nimic e o formalitate.** Am cerut
    conectarea la Telegram ca să se poată trimite înscrierea, dar singurul mesaj
    automat era cel care confirma chiar conectarea. Acceptarea și primirea
    locului — cele două lucruri pe care participantul chiar le așteaptă —
    ajungeau la el doar dacă un operator deschidea WhatsApp și scria de mână.

    Acum botul spune singur trei lucruri: înscrierea a ajuns (din `submit`,
    fiindcă atunci nu există încă o mașină), a fost acceptată (INSERT pe `cars`
    — în aplicația asta o înscriere *devine* o mașină, deci inserarea E
    acceptarea), și locul a fost atribuit (`spot_no` trece din nimic în ceva).
    Ultimele două vin dintr-un trigger, pe același drum pe care merge deja
    `notify_push`.

    Funcția recitește mașina din bază în loc să se încreadă în `NEW`: un mesaj
    nu trebuie să descrie o stare pe care baza n-o are. Iar o mașină fără chat
    nu e o eroare — sunt toate cele importate înainte ca asta să existe.

67. **Un `case` din PL/pgSQL nu te scapă de o coloană care nu există.** Prima
    versiune a trigger-ului comun pentru `cars` și `car_registrations` citea
    `new.telegram_user_id` într-o ramură și `new.telegram_chat_id` în cealaltă.
    PL/pgSQL rezolvă câmpul unei înregistrări când compilează expresia, nu când
    execută ramura — deci pe `cars`, care n-are `telegram_user_id`, orice
    inserare cădea. Prin `to_jsonb(new)` întrebi rândul de o cheie, nu de o
    coloană: aceeași întrebare la care ambele tabele pot răspunde.

79. **Un element scos afară fără scrollbar e invizibil și pentru teste.**
    Header-ul își așeza cele două grupuri la lățimea lor naturală și lăsa rândul
    să crească peste ecran: pe 390px marginea dreaptă a avatarului cădea la
    **429px** — în afară, invizibil și neapăsabil, pe fiecare secțiune. Nimic
    n-a prins-o, din două motive care merită ținute minte: body-ul taie, deci
    pagina nu derulează lateral și `documentElement.scrollWidth` rămâne 390; iar
    `mobile-no-horizontal-overflow` încarcă paginile **nelogat**, unde header-ul
    ăsta nici nu se randează. Verificarea nouă se uită la elementul concret, nu
    la simptomul lui.

78. **O bară a cărei lățime depinde de unde stai.** Bara de jos are opt taburi,
    iar cel activ își arată eticheta. Pe „Evenimente" rândul ajungea la 390px
    într-un container de 372 și roata dințată de Setări ieșea din raza degetului
    — pe celelalte taburi era în regulă. Patru pixeli luați de la fiecare tab
    inactiv fac loc celei mai late etichete.

77. **Densitatea nu se plătește cu o funcție.** Cardul de mașină ajunsese la
    154px, adică 5852px pentru 38 de mașini. Cele două butoane „Invitat/Sosit"
    par candidatul evident la tăiere — dar modalul de detaliu **n-are** control
    de status, deci în afara ecranului de poartă rândul ăla e singurul loc unde
    poți muta o mașină între stări. Au rămas; s-au strâns paddingurile,
    iconița și rândul de acțiuni. 154 → 144.

76. **Un card care răspunde de două ori la aceeași întrebare trebuie să fie de
    acord cu el însuși.** Data de sub iconița de calendar venea din `date` —
    text liber, scris de mână — iar numărătoarea din dreapta venea din
    `starts_at`. Un eveniment cu dată reală dar fără una tastată scria „—"
    lângă „9 zile". Aceeași familie cu statusul învechit (regula despre eveniment
    și eticheta lui). Acum `date` are prioritate, dar când lipsește se
    formatează `starts_at`.
    (Tot pe rândul de task: prioritatea era scrisă de **două ori** pe același
    card — un chip în cap și un badge în meta — iar copia din cap fura jumătate
    din lățimea titlului pe telefon. Sub 560px își păstrează culoarea și
    punctul și renunță la cuvânt. Iar scadența, care stătea doar în panoul
    extins, se vede acum pe rând: „mâine" și „în N zile", nu doar „ÎNTÂRZIAT"
    când e prea târziu.)

75. **Un job oprit n-are ce raporta — și verdictul lui vechi nu e starea de
    acum.** Linkul Apps Script a fost golit, deci sincronizarea din Sheets nu
    mai rulează. Dar ultimul ei verdict — 404, 453 eșecuri la rând — rămăsese
    în `integration_runs` fără nimic care să-l mai actualizeze vreodată, deci
    „Starea canalelor" ar fi arătat o pastilă roșie permanentă despre un job
    care nu mai există. Aceeași greșeală ca la 70, în altă haină. Fără link,
    fără rând.

74. **Un steag numit după canal, care de fapt oprește mesajul.** Cele trei
    setări `sms_*_enabled` par să spună „trimite SMS". În realitate ele
    păzesc `send-sms`, care încearcă **Telegram primul** și cade pe SMS doar
    dacă nu există chat legat — comentariul funcției o spune direct. Deci
    oprindu-le, s-au oprit și mesajul de bun venit la poartă, și cel de
    aprobare, și reminderele de 24h/2h, **pe ambele canale**. Verificarea
    „nicio cerere HTTP la sosire" arăta ca o reușită și era exact dovada
    problemei: cererea aia era expeditorul care încearcă Telegram.
    Regula: numește steagul după ce oprește, nu după canalul din care s-a
    născut. Interfața zice acum „Mesaje automate", cu un rând care spune prin
    ce pleacă, iar roșul din „Starea canalelor" apare doar când **nimic** nu
    poate livra — nici furnizor SMS, nici bot cu chat-uri legate.

73. **O fereastră care se uită doar înainte pierde definitiv ce a scăpat.**
    Reminderul de eveniment se trimitea pentru `starts_at between now() and
    now()+24h`. Odată ce ziua a trecut, evenimentul nu se mai potrivește
    niciodată, nimic nu reîncearcă și nimic nu spune că s-a ratat: toate cele
    trei evenimente cu dată au trecut cu `reminder_24h_sent = false`. În plus,
    steagul se scria `true` indiferent dacă apelul a plecat, deci un eșec era
    definitiv. Acum se scrie doar când cererea chiar a intrat în coadă, iar
    lista de pregătire spune „a trecut acum N zile și reminderul n-a plecat
    niciodată" — dar numai cât timp reminderele sunt pornite, altfel ar fi
    zgomot despre o setare.
    (Tot acolo: fereastra de 24h o conținea pe cea de 2h, deci un eveniment
    adăugat cu o oră înainte primea două mesaje din același șablon.)

72. **Un badge care constată nu ajunge; trebuie să și poți face ceva.**
    Cardul spunea „🔕 n-a primit" și oferea nimic — era un `<span>`. Retrimiterea
    nu se poate face din browser: `notify` din funcția Telegram cere
    `x-import-secret`, iar `app_config` e intenționat inaccesibil clientului.
    Deci retrimiterea stă în bază, ca `resend_car_notification(bigint)`, păzită
    de `is_staff_or_admin()` și cu EXECUTE revocat de la `public`/`anon`.

71. **Numele omului stă în `profiles`, nu în `user_metadata`.**
    `user_metadata` e completat de formularul nostru de înregistrare și de
    nimic altceva, deci un cont invitat din dashboard n-are niciunul — și
    salutul îi zicea adresa de mail brută, în timp ce fiecare alt ecran citea
    `profiles`. Mai rău: upsert-ul de la fiecare login scria
    `full_name: meta.full_name || email.split('@')[0]`, adică suprascria un
    nume real cu prefixul adresei. Acum câmpul se trimite doar când chiar
    avem ce trimite.

70. **„Oprit" și „stricat" nu sunt aceeași culoare.** SMS-ul e închis aici cu
    intenție — nu există și n-a existat vreodată un furnizor, iar totul pleacă
    prin Telegram. Pastila zicea totuși chihlimbariu „SMS: neconfigurat", adică
    exact ce zice despre un lucru lăsat pe jumătate. Acum are trei stări: verde
    când există furnizor, **gri** când e oprit (și scrie că merge prin Telegram),
    **roșu** doar când o automatizare e bifată și **nimic** nu poate livra.
    Prima versiune a acestei reguli punea roșu pe „bifat fără furnizor SMS",
    ceea ce era la fel de nedrept: fără furnizor mesajul totuși ajunge, prin
    Telegram (vezi 74). Aceeași distincție e scrisă și sus în SMS Center, și la
    salvarea automatizărilor, unde se face bifa.
    (Nota de sus purta clasa `.conn-banner`, care e `position:fixed` și parcată
    în afara ecranului până alunecă în jos — deci n-ar fi putut fi citită nici
    dacă cineva o afișa. Are clasa ei acum.)

69. **Un job programat care sună în afară trebuie să-și citească răspunsul.**
    `pg_net` e asincron: `net.http_post` întoarce un id de cerere, nu un
    rezultat. `perform net.http_post(...)` aruncă acel id, și odată aruncat
    nimeni nu mai poate afla ce s-a întâmplat. `kultura-sheet-sync` a trimis așa
    288 de cereri pe zi; toate cele 72 din ultimele șase ore s-au întors 404,
    fiindcă scriptul Apps Script de la capătul linkului salvat nu mai există.
    Aplicația arăta „totul e în regulă" fiindcă nu întreba pe nimeni.
    Regula: ține id-ul (`remember_integration_run`) și închide-l la rularea
    următoare (`settle_integration_run`). Răspunsul ajunge în
    `integration_runs`, iar „Starea canalelor" îl arată ca a patra pastilă —
    verde, chihlimbariu la o singură ratare, roșu la un șir.
    Regula se aplică **fiecărei** funcții care sună în afară, nu doar
    sincronizării: `send_task_reminders`, `process_scheduled_sms`,
    `send_event_reminders`, `run_backup`, `car_welcome_sms` și
    `send_approval_sms` aveau exact aceeași orbire și o au reparată la fel.
    Singura excepție e `notify_telegram_car`, fiindcă răspunsul ei e deja citit
    înapoi — se scrie pe mașină, ca `telegram_notify_ok`.

68. **Un loc se spune cu un deget, nu cu un număr.** „Zona Retro, locul 38" e
    exact și nu-i spune șoferului încotro s-o ia. Fiecare boxă își poartă deja
    poziția ca procent din plan, deci o casetă de o sută de pixeli cu puncte
    răspunde la „acolo" fără să încarce desenul și fără să calculeze vreo scară.

64. **Un dialog care schimbă ceva trebuie să spună ce anume schimbă.** Un plan
    se aduce peste evenimentul selectat sus în ecran, iar numele desenului nu
    spune nimic despre asta. Un plan numit după evenimentul de luna viitoare a
    intrat peste cel de peste trei zile, iar 53 din cele 54 de mașini au rămas
    fără boxa care le fusese dată. Numărul era pe dialog; numele evenimentului
    nu, deci n-avea ce să sară în ochi. Schimbarea unui plan salvat numea de la
    început evenimentul; importul face acum la fel.

63. **Numerele parcării stăteau doar în hartă.** Câte boxe are planul, câte sunt
    date și — cea care decide dacă poarta va funcționa — câte mașini vin fără
    niciun loc: toate existau, dar numai înăuntrul hărții. Un număr pentru care
    trebuie deschis un ecran e un număr pe care nu-l citește nimeni. Acum stau
    pe Acasă, sub plăcile de statistici.

## Rămas de făcut manual

**Protecția împotriva parolelor compromise** nu se poate activa din cod:
Supabase Dashboard → Authentication → Passwords → *Leaked password protection*.
