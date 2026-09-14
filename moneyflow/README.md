# MONEYFLOW

Personal finance that answers the question people actually ask:

> **Cât pot cheltui astăzi?** — *How much can I spend today?*

Most money apps are very good at telling you where your money went. MONEYFLOW is
built around telling you what you can do with the money you still have. The
daily allowance on the dashboard is the product; transactions, budgets and goals
are the inputs that make it true.

---

## What it does

| | |
|---|---|
| **Poți cheltui azi** | One number, recomputed from the live balance: what today's spending can be without breaking the month or the savings plan. Shows its working. |
| **Îmi permit?** | Price in, verdict out — yes / careful / not recommended — with the reason, the daily budget that survives the purchase, and which goal it delays. |
| **Money Score** | 0–100 from savings rate, budget adherence, emergency fund, debt, spending consistency, goal progress and recurring load, plus the one change that would raise it most. |
| **Asistent AI** | Ask about your own money. Answers come from your real transactions, budgets and goals — never invented. Works with or without an API key. |
| Transactions | Income, expense, transfer. Filters and pagination in the URL. |
| Accounts | Cash, bank, card, savings. Balances maintained by database triggers. |
| Budgets | Monthly, per category, with safe / near-limit / over status. |
| Goals | Targets, deadlines, contributions, and an honest forecast. |
| Recurring | Rent, subscriptions, bills — posted automatically when they fall due, and subtracted from today's allowance before they do. |
| Debts | Both directions, with due dates and a net position. |
| Analytics | Income vs expenses, category breakdown, balance trend, savings, budget vs actual, over 7d → 1y. |
| Monthly reports | Income, expenses, savings rate, top category, and how the month compared to the last one. |
| Notifications | Bills due, budgets breached, savings hit, payday approaching — derived from the data, deduplicated. |
| PWA | Installable, offline fallback, home-screen shortcuts. |
| i18n | Română (default), Русский, English. |

---

## Stack

Next.js 16 (App Router, Server Components, Server Actions) · React 19 ·
TypeScript · Tailwind CSS v4 · shadcn/ui-style components on Radix ·
Supabase (Auth + PostgreSQL + RLS) · Recharts · Lucide · deployed on Vercel.

---

## Setup

### 1. Create a Supabase project

[supabase.com/dashboard](https://supabase.com/dashboard) → **New project**. Note
the project URL and the anon/publishable key from **Project Settings → API**.

### 2. Apply the schema

Either paste each file from `supabase/migrations/` into the Supabase **SQL
Editor** in filename order, or use the CLI:

```bash
supabase link --project-ref <your-project-ref>
supabase db push
```

The migrations are re-runnable, so applying them twice is harmless.

### 3. Configure the app

```bash
cp .env.example .env.local
```

```bash
NEXT_PUBLIC_SUPABASE_URL=https://<project-ref>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon key>
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

### 4. Run it

```bash
npm install
npm run dev
```

Register an account at `/register`, answer the four onboarding questions, and
the dashboard is live. **Settings → Date demo → Încarcă date demo** fills the
account with three months of realistic history if you want to see it full.

### Optional

- **Email confirmation.** On by default in Supabase. For local development,
  turn it off under **Authentication → Providers → Email** so sign-up lands
  straight on onboarding. Add `http://localhost:3000/auth/callback` to
  **Authentication → URL Configuration → Redirect URLs** either way.
- **Google OAuth.** The callback route already handles the code exchange —
  enable the provider in Supabase and add a button; no app changes needed.
- **AI assistant.** Set `ANTHROPIC_API_KEY` to have Claude write the answers.
  Without it the assistant still answers from your real data using the built-in
  deterministic engine.
- **Exchange rates.** `EXCHANGE_RATES_PROVIDER=frankfurter` (default, free, no
  key) or `static`. New providers implement one interface in
  `src/lib/currency/index.ts`.

### Deploy to Vercel

Import the repository, set **Root Directory** to `moneyflow`, add the three
`NEXT_PUBLIC_*` variables (and `ANTHROPIC_API_KEY` if you want it), deploy. Set
`NEXT_PUBLIC_SITE_URL` to the production URL so password-reset links point at
the right place.

---

## The daily budget

```
availableMoney = currentBalance
               − reservedMoney            (debts due this month)
               − remainingFixedExpenses   (recurring charges still to come)
               − savingsTargetRemaining   (what is still owed to savings)
               + upcomingIncome           (recurring income still to arrive)

dailyBudget    = availableMoney / remainingDaysInMonth
```

Two deliberate choices, both visible in the breakdown on the card:

- **Upcoming recurring income counts.** Leaving it out makes anyone paid late in
  the month look broke for three weeks.
- **Category budgets cap the result.** Where the user has set budgets, the
  allowance is the smaller of the cash-flow figure and what the budgets still
  permit — a limit someone set for themselves should not be quietly overridden
  by available cash.

A negative result is never shown as a negative allowance: the allowance floors
at zero and the card switches to a warning that says by how much planned
spending exceeds available money.

---

## Security

Every table has Row Level Security enabled **and forced**, with policies keyed on
`user_id = auth.uid()` for select, insert, update and delete. There is no
service-role key in the application and no admin path: the browser and the
server both talk to Supabase as the signed-in user, so the database — not
application code — is what keeps one account out of another.
`supabase/tests/01_schema_checks.sql` asserts this in both directions.

Passwords are handled entirely by Supabase Auth and never touch these tables.
Every mutation is validated twice: in the browser for feedback, and again with
Zod inside the Server Action, which is the boundary that actually counts.

---

## Development

```bash
npm run dev          # dev server
npm run build        # production build
npm run check        # typecheck + lint + unit tests
npm test             # unit tests only
npm run icons        # regenerate the app icons
scripts/verify-schema.sh   # apply migrations to a throwaway PostgreSQL and assert behaviour
```

`scripts/verify-schema.sh` needs a PostgreSQL 15+ (`DATABASE_URL`, or `initdb`
on `PATH` and it starts its own). It applies every migration twice to prove they
are re-runnable, then checks the bootstrap trigger, account-balance bookkeeping,
the transfer guard, goal progress, RLS in both directions, recurring
materialisation, the demo seed and account deletion.

### Layout

```
src/
  app/
    (auth)/          login · register · forgot-password · reset-password
    (app)/           everything behind the session: dashboard, transactions, …
    api/             assistant · export · notifications
    onboarding/      the four-step first run
  components/        ui/ (primitives) · layout/ · feature folders
  lib/
    finance/         daily-budget · money-score · afford · period
    data/            snapshot (one query pass for every intelligent surface)
    assistant/       grounded context + the deterministic answer engine
    supabase/        browser · server · session clients
    i18n/            ro (reference) · ru · en
supabase/
  migrations/        schema · RLS + triggers · RPCs · demo data
  tests/             what the schema is supposed to do
```

### Where the logic lives

`src/lib/data/snapshot.ts` assembles the whole financial picture in one parallel
query pass. The dashboard, Money Score, "can I afford it" and the AI assistant
all read from it, which is what keeps them consistent with each other — two
screens disagreeing about how much money you have is worse than either screen
being slow.

`src/lib/finance/` holds the arithmetic as pure functions with no database and
no React, and `tests/finance.test.ts` pins it down. A wrong number in there is
wrong on every screen at once.
