# MontajPro

Aplicație web/PWA pentru montatori de **scări, parchet și plinte**: clienți,
lucrări, măsurători, fotografii, materiale, oferte, programări și bani — într-un
singur loc, optimizată în primul rând pentru telefon.

Interfața este integral în română. Moneda implicită este **MDL** și se poate
schimba din Setări (MDL, RON, EUR, USD, UAH, GBP).

---

## Ce face

| Modul | Ce rezolvă |
| --- | --- |
| **Dashboard** | Lucrări active, programul de azi, bani de încasat, încasări/cheltuieli/profit pe luna curentă, ore lucrate, materiale de cumpărat |
| **Lucrări** | Listă cu filtre pe status (ofertă, confirmată, materiale, în lucru, finalizată, problemă), preț / avans / rest pe fiecare card |
| **Pagina lucrării** | Tab-uri: General, Măsurători, Poze, Materiale, Finanțe, Activitate; buton mare **START / FINALIZEAZĂ** cu cronometru |
| **Clienți** | CRUD complet, istoric lucrări și plăți, fotografii, acțiuni rapide (sună, WhatsApp, hartă) |
| **Măsurători** | Scară / parchet / plintă / altceva, cu **calcule automate** (suprafețe, unghi, bucăți necesare, pierdere %) |
| **Calculator preț** | Trepte × preț, podest, balustradă, m² parchet, metri plintă + servicii proprii; salvează direct în lucrare sau ofertă |
| **Oferte** | Numerotate automat, cu subtotal/reducere/avans/rest, format printabil și partajare prin WhatsApp/share nativ; se transformă într-o lucrare dintr-o apăsare |
| **Calendar** | Lunar și săptămânal, mutarea lucrării pe altă zi (drag pe desktop, buton pe telefon) |
| **Finanțe** | Încasări, cheltuieli pe categorii, profit, bani de primit, avansuri — pe lună |
| **Materiale** | Inventar + listă de cumpărături generată din lucrările active |
| **Scule** | Evidență cu preț, dată cumpărare, garanție și alertă înainte de expirare |
| **Portofoliu** | Lucrările finalizate cu „înainte / după” |
| **Notificări** | Lucrare azi/mâine, plată restantă, materiale lipsă, garanție care expiră, ofertă neconfirmată |
| **Setări** | Profil, monedă, unități, tarife implicite, categorii, notificări, backup, date demo |

## Stack

- **Next.js 16** (App Router) + **TypeScript**
- **Tailwind CSS v4** + componente în stil **shadcn/ui** (Radix UI)
- **Supabase** — PostgreSQL, autentificare, Storage
- **PWA** — manifest, service worker, instalare pe iPhone/Android
- **Lucide** pentru iconițe

## Arhitectură: local-first

Aplicația se folosește pe șantier, unde semnalul e slab sau lipsește. De aceea
datele nu se citesc direct din rețea:

```
UI (React)  ->  store în memorie  ->  IndexedDB          (instant, offline)
                      |
                      +--> outbox  ->  Supabase (push/pull)   (când există rețea)
```

- Fiecare scriere intră imediat în IndexedDB și în „outbox”.
- Motorul de sincronizare (`src/lib/db/sync.ts`) trimite outbox-ul și aduce
  modificările noi la pornire, la revenirea în aplicație, la recâștigarea
  semnalului și din minut în minut.
- Conflictele se rezolvă „last write wins” pe `updated_at`, iar cursorul de
  sincronizare este `synced_at`, pus de server — un telefon cu ceasul deviat nu
  poate ascunde rânduri.
- Ștergerile sunt logice (`deleted_at`), ca să se propage între dispozitive.
- Fotografiile se comprimă pe telefon, se salvează local și se urcă în Storage
  când se poate.

Fără chei Supabase aplicația pornește în **mod local**: totul funcționează, dar
datele rămân pe dispozitiv.

## Pornire

```bash
npm install
cp .env.example .env.local     # opțional, pentru sincronizare în cloud
npm run dev                    # http://localhost:3000
```

### Supabase (opțional, dar recomandat)

1. Creează un proiect pe [supabase.com](https://supabase.com).
2. Rulează migrațiile din `supabase/migrations/` în ordine (SQL Editor sau
   `supabase db push`):
   - `0001_init.sql` — tabelele, indecșii, triggerele și politicile RLS;
   - `0002_storage.sql` — bucket-ul privat `job-photos` și politicile lui.
3. Pune `NEXT_PUBLIC_SUPABASE_URL` și `NEXT_PUBLIC_SUPABASE_ANON_KEY` în
   `.env.local`.
4. Repornește `npm run dev` — apare ecranul de autentificare.

Row Level Security este activ pe toate tabelele: fiecare cont vede **doar**
propriile rânduri (`user_id = auth.uid()`), iar în Storage fiecare utilizator
scrie doar în folderul său (`<user_id>/...`).

## Verificări

```bash
npm run typecheck      # TypeScript
npm run lint           # ESLint (inclusiv regulile React Compiler)
npm run build          # build de producție
npm run test:smoke     # test de fum în browser (vezi mai jos)
```

Testul de fum pornește un Chromium cu viewport de iPhone și parcurge fluxul
real: mod local → client nou → lucrare nouă → cronometru → măsurătoare cu
calcule → materiale → plată → calculator → ofertă → toate paginile →
persistență după reload → schimbarea monedei → fișierele PWA.

```bash
npm run build && npm run start -- -p 3100   # într-un terminal
BASE_URL=http://localhost:3100 npm run test:smoke
# CHROMIUM_PATH=/cale/spre/chromium  dacă vrei alt binar decât cel din Playwright
```

## Structura

```
src/
  app/
    (app)/            paginile aplicației (dashboard, lucrări, clienți, ...)
    (auth)/login/     autentificare + intrare în mod local
  components/
    ui/               primitive (buton, card, dialog, select, ...)
    layout/           sidebar, bară de jos, FAB, antet, cronometru activ
    forms/            dialoguri de adăugare/editare
    jobs/ quotes/ measurements/ photo/ dashboard/ notifications/
  lib/
    db/               store local, IndexedDB, sincronizare, acțiuni, date demo
    supabase/         clientul de browser
    calc.ts           calcule pentru măsurători, prețuri și finanțe
    format.ts         formatarea sumelor, datelor și duratelor (ro-RO)
    types.ts          modelul de date (oglindește schema Supabase)
supabase/migrations/  schema + RLS + Storage
tests/smoke.mjs       test de fum în browser
```

## Date demo

Setări → **Încarcă date demo** adaugă câțiva clienți, lucrări, plăți și o ofertă
de probă. Toate poartă marcajul `(DEMO)` în nume și se șterg dintr-o apăsare, ca
să nu se amestece niciodată cu datele reale.

## Instalare pe telefon

- **Android/Chrome**: bannerul de instalare sau Setări → *Instalează aplicația*.
- **iPhone/Safari**: *Partajează* → *Adaugă pe ecranul principal*.

## Pregătit pentru mai departe

Structura permite adăugarea fără rescrieri a: trimiterii prin WhatsApp,
sincronizării cu Google Calendar, navigației GPS, facturilor, semnăturii
electronice, generării automate de oferte cu AI, aplicației pentru client,
echipelor cu roluri (Admin / Montator / Ajutor), statisticilor avansate și
exportului Excel/PDF. Tabelele au deja `user_id`, iar stratul de date este
izolat în `src/lib/db/`.
