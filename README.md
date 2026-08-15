# Kultura

Aplicație de management pentru evenimente auto: înscrieri, check-in la poartă,
zone de parcare, taskuri de echipă, invitați VIP, SMS/push, votare publică și
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
```

Smoke-testul rulează **ermetic**: taie toate cererile către `*.supabase.co`, ca
rezultatul să nu depindă de accesibilitatea backend-ului și ca testele să nu
lovească producția. Include și o verificare de accesibilitate (WCAG 2 A/AA, prin
axe-core) pe toate paginile livrate; dacă `axe-core` nu e instalat, partea aia
se sare.

Excepția e coada offline: acolo backendul e **simulat**, nu tăiat. Un check-in
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
| `submit` | nu | **Singura** cale publică de scriere (înscrieri + feedback). Rate-limit pe IP |
| `plate-check` | nu | Formularul public: spune doar dacă placa e cunoscută/blocată |
| `vote` | nu | Votare publică + clasament. Max 12 voturi noi/oră/IP |
| `event-info` | nu | Evenimentul curent + agenda, pentru paginile publice |
| `ticket` | nu | Bilet/pass |
| `backup` | nu¹ | Export JSON al tabelelor în bucket-ul `backups` |
| `restore` | da | Restaurare **aditivă** din backup (admin) |
| `gdpr-delete` | da | Ștergerea datelor unei persoane (admin) |
| `photo-sweep` | da | Șterge pozele fără referință în DB (admin) |
| `send-push` | nu¹ | Notificări push |
| `send-sms` | nu¹ | Trimitere SMS |
| `import-participants` | nu¹ | Import din Google Sheets |
| `ai-import` | da | Import asistat |
| `read-plate` | da | OCR plăcuță |
| `admin-list-users`, `admin-delete-user` | da | Administrare conturi |
| `register-participant` | nu | **Dezactivată** (înlocuită de `submit`) |

¹ Fără JWT, dar protejate printr-un secret partajat în antet
(`x-trigger-secret` / `x-import-secret`), pentru că sunt apelate de cron sau de
trigger-e din baza de date.

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

`app_config` conține URL-uri de funcții și **secrete** — nu se citește din
client.

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
   ceea ce e o problemă reală de accesibilitate. Inputurile sunt la 16px tocmai
   ca iOS să nu mai facă zoom automat la focus — dacă le micșorezi sub 16px,
   reapare motivul pentru care fusese pus.
8. **Evită stilurile inline din JS pentru stări vizuale.** Butoanele de limbă au
   avut ani la rând contrast insuficient exact pentru că stilul inline din JS
   bătea foaia de stil și nimeni nu se uita acolo.
9. **Nu transforma sincronizarea incrementală înapoi în „ia tot".** `loadData()`
   cere pentru `cars`/`tasks` doar rândurile cu `updated_at > watermark`.
   Depinde de triggerul `stamp_updated_at` din Postgres — dacă îl scoți,
   aplicația nu mai vede nicio modificare. Ștergerile nu apar niciodată într-un
   delta: le prinde realtime, iar ca plasă de siguranță `reconcileDeletions()`
   compară lista de id-uri o dată pe minut.

## Rămas de făcut manual

**Protecția împotriva parolelor compromise** nu se poate activa din cod:
Supabase Dashboard → Authentication → Passwords → *Leaked password protection*.
