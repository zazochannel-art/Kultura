# Tests

Smoke tests for the Kultura web app (Playwright + headless Chromium).

## Run

```bash
npm i -D playwright            # once, if not already available
node tests/smoke.mjs
```

The script boots `server.js` on port 8199, loads the app, and verifies:

- core surfaces render (login, gate overlay, Kanban toggle, connection banner,
  car-QR modal, zone-capacity block, "what's new" modal);
- fonts are self-hosted (no Google Fonts request);
- the "what's new" panel opens and lists entries;
- the **offline gate queue** works — a check-in performed while offline is
  applied optimistically and enqueued in `localStorage`;
- no uncaught JS errors during the run.

Exit code is non-zero if any check fails, so it can gate CI.

Set `PLAYWRIGHT_CHROMIUM` to point at a specific Chromium binary if needed.
