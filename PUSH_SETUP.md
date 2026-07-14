# Notificări Push — configurare (o singură dată)

Infrastructura e deja creată: tabela `push_subscriptions`, trigger-ul `notify_push`
(pe `tasks` INSERT și `cars` UPDATE → VIP sosit), Edge Function-ul `send-push` și
service worker-ul care afișează notificarea. Mai rămâne **doar** setarea a 4 secrete
pe Edge Function, pe care nu le putem comite în repo.

## Pas unic: setează secretele Edge Function

Supabase Dashboard → **Edge Functions → send-push → Secrets** (sau CLI
`supabase secrets set …`) și adaugă:

| Secret | Valoare |
| --- | --- |
| `VAPID_PUBLIC_KEY`   | *(cheia publică VAPID — aceeași care e în `app.js`)* |
| `VAPID_PRIVATE_KEY`  | *(cheia privată VAPID — ți-o dau separat, în chat)* |
| `VAPID_SUBJECT`      | `mailto:support@kultura.app` |
| `PUSH_TRIGGER_SECRET`| *(secretul partajat cu trigger-ul — ți-l dau separat)* |

`PUSH_TRIGGER_SECRET` trebuie să fie identic cu `app_config.push_secret` din baza de
date (valoarea generată la migrare) — trigger-ul îl trimite ca header `x-trigger-secret`,
iar funcția îl verifică.

`SUPABASE_URL` și `SUPABASE_SERVICE_ROLE_KEY` sunt injectate automat de Supabase în
Edge Functions — nu trebuie setate.

## Cum funcționează

1. Utilizatorul apasă **Activează** la „Notificări Push" în Setări → browserul creează
   o subscripție push (cu cheia publică VAPID) și o salvează în `push_subscriptions`.
2. Când se creează un task nou sau o mașină VIP trece pe status „Sosit", trigger-ul
   `notify_push` cheamă async (pg_net) funcția `send-push`.
3. `send-push` verifică secretul, semnează mesajul cu cheia privată VAPID și îl trimite
   către toate subscripțiile; subscripțiile expirate (404/410) sunt curățate automat.
4. Service worker-ul (`sw.js`) primește evenimentul `push` și afișează notificarea —
   **chiar dacă aplicația e închisă**.

## Note

- Cheia **publică** VAPID e în `app.js` (e sigur să fie publică). Doar cea **privată**
  și `PUSH_TRIGGER_SECRET` sunt sensibile.
- Ca să rotești secretul trigger-ului: schimbă `app_config.push_secret` în DB **și**
  `PUSH_TRIGGER_SECRET` pe funcție, cu aceeași valoare nouă.
- Notificările push cer HTTPS (GitHub Pages / Vercel îl oferă). Pe iOS funcționează doar
  dacă aplicația e adăugată pe ecranul principal (PWA instalată), din iOS 16.4+.
