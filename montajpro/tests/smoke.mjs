/**
 * Test de fum pentru MontajPro.
 *
 * Pornește un browser mobil (viewport de iPhone), parcurge fluxul real —
 * client nou, lucrare nouă, cronometru, plată, măsurătoare, ofertă — și verifică
 * ce vede utilizatorul. Rulează pe build-ul de producție.
 *
 *   node tests/smoke.mjs            # presupune serverul pe :3100
 *   BASE_URL=http://localhost:3000 node tests/smoke.mjs
 */
import { chromium, devices } from "playwright";

const BASE = process.env.BASE_URL ?? "http://localhost:3100";

let passed = 0;
const failures = [];
const consoleErrors = [];

function check(name, condition, detail = "") {
  if (condition) {
    passed++;
    console.log(`  ✓ ${name}`);
  } else {
    failures.push(`${name}${detail ? ` — ${detail}` : ""}`);
    console.log(`  ✗ ${name}${detail ? ` — ${detail}` : ""}`);
  }
}

function section(title) {
  console.log(`\n${title}`);
}

// Mediile CI/agent au un Chromium preinstalat care poate să nu corespundă
// versiunii din node_modules; CHROMIUM_PATH îl indică explicit.
const browser = await chromium.launch(
  process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {},
);
const context = await browser.newContext({
  ...devices["iPhone 13"],
  locale: "ro-RO",
});
const page = await context.newPage();

page.on("console", (message) => {
  if (message.type() === "error") consoleErrors.push(message.text());
});
page.on("pageerror", (error) => consoleErrors.push(`pageerror: ${error.message}`));

try {
  /* ----------------------------- pornire --------------------------- */
  section("Pornire și mod local");

  // Ecranul de autentificare trebuie să existe și să ofere modul local.
  await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
  check(
    "ecranul de autentificare oferă modul local",
    await page.getByRole("button", { name: /Continuă în mod local/i }).isVisible(),
  );
  await page.getByRole("button", { name: /Continuă în mod local/i }).click();

  await page.waitForURL(`${BASE}/`, { timeout: 15000 });
  await page.getByRole("heading", { name: /Salut/i }).waitFor({ timeout: 15000 });
  check("dashboard-ul se încarcă", true);
  check(
    "bara de jos are butonul Adaugă",
    await page.getByRole("button", { name: "Adaugă", exact: true }).first().isVisible(),
  );

  /* ----------------------------- client ---------------------------- */
  section("Client nou");
  await page.goto(`${BASE}/clienti`, { waitUntil: "networkidle" });
  await page.getByRole("button", { name: /Client nou/i }).first().click();
  await page.getByPlaceholder("Ion Popescu").fill("Ion Popescu (test)");
  await page.getByPlaceholder("+373 69 123 456").fill("+37369123456");
  await page.getByPlaceholder("str. Ismail 45, Chișinău").fill("str. Ismail 45, Chișinău");
  await page.getByRole("button", { name: /Adaugă client/i }).click();
  await page.getByText("Ion Popescu (test)").first().waitFor({ timeout: 10000 });
  check("clientul apare în listă", true);

  /* ----------------------------- lucrare --------------------------- */
  section("Lucrare nouă");
  await page.goto(`${BASE}/lucrari/nou`, { waitUntil: "networkidle" });
  await page.getByPlaceholder("Montaj scară stejar").fill("Montaj scară stejar (test)");

  // Client din select (Radix).
  await page.getByRole("combobox").first().click();
  await page.getByRole("option", { name: /Ion Popescu \(test\)/ }).click();

  await page.locator("#job-price").fill("12000");
  await page.locator("#job-advance").fill("5000");
  await page.getByRole("button", { name: /Creează lucrarea/i }).click();
  await page.waitForURL(/\/lucrari\/[0-9a-f-]{36}/, { timeout: 15000 });
  const jobUrl = page.url();
  check("lucrarea s-a creat și s-a deschis", true);
  check(
    "prețul apare pe pagina lucrării",
    (await page.getByText(/12\.000 MDL/).count()) > 0,
  );
  check(
    "avansul introdus devine plată și scade restul",
    (await page.getByText(/rest 7\.000 MDL/).count()) > 0,
  );

  /* ----------------------------- cronometru ------------------------ */
  section("Start / stop lucrare");
  await page.getByRole("button", { name: /START LUCRARE/i }).click();
  await page.getByRole("button", { name: /FINALIZEAZ/i }).waitFor({ timeout: 10000 });
  check("cronometrul pornește", true);
  await page.getByRole("button", { name: /FINALIZEAZ/i }).click();
  await page.getByRole("button", { name: /START LUCRARE/i }).waitFor({ timeout: 10000 });
  check("cronometrul se oprește și salvează durata", true);

  /* ----------------------------- măsurători ------------------------ */
  section("Măsurători cu calcule automate");
  await page.goto(`${jobUrl}?tab=masuratori`, { waitUntil: "networkidle" });
  await page.getByRole("tab", { name: /Măsurători/i }).click();
  await page.getByRole("button", { name: /Adaugă măsurătoare/i }).first().click();
  await page.locator("#m-steps").fill("15");
  await page.locator("#m-width").fill("100");
  await page.locator("#m-depth").fill("30");
  await page.locator("#m-height").fill("18");
  check(
    "suprafața treptelor se calculează automat",
    await page.getByText("Suprafață trepte").isVisible(),
  );
  check(
    "unghiul se calculează automat",
    await page.getByText("Unghi calculat").isVisible(),
  );
  await page.getByRole("button", { name: /^Salvează$/ }).click();
  await page.getByText(/15 trepte|Suprafață trepte/).first().waitFor({ timeout: 10000 });
  check("măsurătoarea s-a salvat", true);

  /* ----------------------------- materiale ------------------------- */
  section("Materiale pe lucrare");
  await page.getByRole("tab", { name: /Materiale/i }).click();
  await page.getByRole("button", { name: /Adaugă material/i }).first().click();
  await page.getByPlaceholder("Adeziv parchet").fill("Lac poliuretanic");
  const materialNumbers = page.locator('input[inputmode="decimal"]');
  await materialNumbers.nth(0).fill("3");
  await materialNumbers.nth(1).fill("450");
  await page.getByRole("button", { name: /^Salvează$/ }).click();
  await page.getByText("Lac poliuretanic").first().waitFor({ timeout: 10000 });
  check("materialul apare pe lucrare", true);
  check(
    "totalul materialelor se calculează",
    (await page.getByText(/1\.350 MDL/).count()) > 0,
  );

  /* ----------------------------- finanțe --------------------------- */
  section("Finanțe pe lucrare");
  await page.getByRole("tab", { name: /Finanțe/i }).click();
  await page.getByRole("button", { name: /Plată/i }).first().click();
  await page.locator("#payment-amount").fill("3000");
  await page.getByRole("button", { name: /^Salvează$/ }).click();
  await page.getByText(/3\.000 MDL/).first().waitFor({ timeout: 10000 });
  check("plata s-a înregistrat", true);
  check(
    "restul de plată se recalculează (12.000 − 5.000 − 3.000)",
    (await page.getByText(/4\.000 MDL/).count()) > 0,
  );

  /* ----------------------------- calculator ------------------------ */
  section("Calculator preț");
  await page.goto(`${BASE}/calculator`, { waitUntil: "networkidle" });
  const calcInputs = page.locator('input[inputmode="decimal"]');
  await calcInputs.nth(0).fill("15"); // trepte
  await calcInputs.nth(1).fill("500"); // preț treaptă
  check(
    "totalul liniei se calculează",
    (await page.getByText(/7\.500 MDL/).count()) > 0,
  );

  /* ----------------------------- ofertă ---------------------------- */
  section("Ofertă");
  await page.goto(`${BASE}/oferte/nou`, { waitUntil: "networkidle" });
  await page.getByPlaceholder("Montaj scară stejar").fill("Ofertă montaj scară (test)");
  await page.getByPlaceholder("Descriere linie").first().fill("Montaj trepte");
  const quoteNumbers = page.locator('input[inputmode="decimal"]');
  await quoteNumbers.nth(0).fill("15");
  await quoteNumbers.nth(1).fill("500");
  await page.getByRole("button", { name: /Creează oferta/i }).click();
  await page.waitForURL(/\/oferte\/[0-9a-f-]{36}/, { timeout: 15000 });
  check("oferta s-a creat", true);
  check("oferta are număr", (await page.getByText(/OFERTĂ #00001/).count()) > 0);
  check("oferta are total", (await page.getByText(/7\.500 MDL/).count()) > 0);

  /* ----------------------------- navigare -------------------------- */
  section("Navigare în toate paginile");
  for (const [path, heading] of [
    ["/lucrari", /Lucrări/],
    ["/calendar", /Calendar/],
    ["/clienti", /Clienți/],
    ["/masuratori", /Măsurători/],
    ["/finante", /Finanțe/],
    ["/materiale", /Materiale/],
    ["/scule", /Scule/],
    ["/portofoliu", /Portofoliu/],
    ["/notificari", /Notificări/],
    ["/setari", /Setări/],
  ]) {
    await page.goto(`${BASE}${path}`, { waitUntil: "networkidle" });
    const visible = await page
      .getByRole("heading", { name: heading })
      .first()
      .isVisible()
      .catch(() => false);
    check(`pagina ${path} se încarcă`, visible);
  }

  /* ----------------------------- persistență ----------------------- */
  section("Persistența datelor");
  await page.reload({ waitUntil: "networkidle" });
  await page.goto(`${BASE}/lucrari`, { waitUntil: "networkidle" });
  await page.getByText("Montaj scară stejar (test)").first().waitFor({ timeout: 10000 });
  check("lucrarea supraviețuiește reîncărcării (IndexedDB)", true);

  /* ----------------------------- setări ---------------------------- */
  section("Schimbarea monedei");
  await page.goto(`${BASE}/setari`, { waitUntil: "networkidle" });
  // Așteptăm ca setările să fie încărcate (altfel selectul încă nu are valoare).
  const currencySelect = page.getByRole("combobox").first();
  await currencySelect.filter({ hasText: /MDL/ }).waitFor({ timeout: 10000 });
  await currencySelect.click();
  await page.getByRole("option", { name: /Euro/ }).click();
  await page.getByRole("combobox").first().filter({ hasText: /EUR/ }).waitFor({ timeout: 10000 });
  await page.goto(`${BASE}/finante`, { waitUntil: "networkidle" });
  await page.getByText(/EUR/).first().waitFor({ timeout: 10000 });
  check(
    "moneda se schimbă în toată aplicația",
    (await page.getByText(/EUR/).count()) > 0,
  );
  // înapoi la MDL, ca rularea următoare să pornească din aceleași condiții
  await page.goto(`${BASE}/setari`, { waitUntil: "networkidle" });
  const backToMDL = page.getByRole("combobox").first();
  await backToMDL.filter({ hasText: /EUR/ }).waitFor({ timeout: 10000 });
  await backToMDL.click();
  await page.getByRole("option", { name: /Leu moldovenesc/ }).click();

  /* ----------------------------- PWA ------------------------------- */
  section("PWA");
  const manifest = await page.request.get(`${BASE}/manifest.webmanifest`);
  check("manifestul este servit", manifest.ok());
  const manifestJson = await manifest.json();
  check("manifestul are iconițe", (manifestJson.icons ?? []).length >= 2);
  check("manifestul pornește standalone", manifestJson.display === "standalone");
  const sw = await page.request.get(`${BASE}/sw.js`);
  check("service worker-ul este servit", sw.ok());
  const offline = await page.request.get(`${BASE}/offline.html`);
  check("pagina offline există", offline.ok());

  /* ----------------------------- erori în consolă ------------------ */
  section("Consola");
  const realErrors = consoleErrors.filter(
    (error) =>
      !error.includes("favicon") &&
      !error.includes("Failed to load resource: the server responded with a status of 404"),
  );
  check("fără erori în consolă", realErrors.length === 0, realErrors.slice(0, 3).join(" | "));
} catch (error) {
  failures.push(`excepție: ${error.message}`);
  console.log(`\n✗ Excepție: ${error.message}`);
  await page.screenshot({ path: "tests/failure.png" }).catch(() => {});
} finally {
  await browser.close();
}

console.log(`\n${passed} verificări trecute, ${failures.length} eșecuri`);
if (failures.length) {
  console.log("\nEșecuri:");
  for (const failure of failures) console.log(`  - ${failure}`);
  process.exit(1);
}
