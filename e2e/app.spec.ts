import { expect, test, type Page } from "@playwright/test";

/** Nessuna pagina deve scorrere di lato sul telefono. */
async function noHorizontalScroll(page: Page) {
  const { scroll, width } = await page.evaluate(() => ({ scroll: document.documentElement.scrollWidth, width: window.innerWidth }));
  expect(scroll, "la pagina scorre di lato").toBeLessThanOrEqual(width + 1);
}

/** Errori nella console del browser = test fallito. */
function trackErrors(page: Page) {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
  return errors;
}

const SECTIONS = [
  { name: "Calendario", path: "/calendario" },
  { name: "Coach AI", path: "/coach" },
  { name: "Progressi", path: "/progressi" },
  { name: "Profilo", path: "/profilo" },
  { name: "Oggi", path: "/" },
];

test("si naviga in tutte le sezioni senza errori", async ({ page }) => {
  const errors = trackErrors(page);
  await page.goto("/");
  await expect(page.getByText("Modalità dimostrativa")).toBeVisible();
  for (const s of SECTIONS) {
    await page.getByRole("navigation").filter({ visible: true }).getByRole("link", { name: s.name, exact: true }).first().click();
    await expect(page).toHaveURL(new RegExp(`${s.path === "/" ? "/$" : s.path}`));
    await expect(page.locator("h1").first()).toBeVisible();
    await noHorizontalScroll(page);
  }
  expect(errors).toEqual([]);
});

test("il tasto indietro (Android) torna alla pagina precedente", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("navigation").filter({ visible: true }).getByRole("link", { name: "Calendario", exact: true }).first().click();
  await expect(page).toHaveURL(/\/calendario$/);
  await page.goBack();
  await expect(page).toHaveURL(/\/$/);
});

test("una seduta svolta mostra dati, analisi e intertempi", async ({ page }) => {
  await page.goto("/allenamenti");
  // Le sedute dimostrative passate: si cerca la prima corsa completata degli ultimi giorni.
  for (let i = 1; i <= 14; i++) {
    const d = new Date(Date.now() - i * 864e5).toISOString().slice(0, 10);
    await page.goto(`/allenamenti/w-${d}`);
    if (await page.getByText("Analisi dell'allenamento").isVisible().catch(() => false)) break;
  }
  await expect(page.getByText("Analisi dell'allenamento")).toBeVisible();
  await noHorizontalScroll(page);
});

test("registrare un'attività: il modulo è completo", async ({ page }) => {
  await page.goto("/allenamenti/nuova");
  await page.getByText("Oppure inserisci a mano").click();
  await expect(page.getByLabel("Durata")).toBeVisible();
  await expect(page.getByRole("button", { name: "Salva attività" })).toBeDisabled(); // in demo non si salva
  await noHorizontalScroll(page);
});

test("riprogrammare: la conversazione guidata parte", async ({ page }) => {
  await page.goto("/riprogramma");
  await expect(page.locator("h1").first()).toBeVisible();
  await noHorizontalScroll(page);
});

test("privacy e pagina offline sono raggiungibili", async ({ page }) => {
  await page.goto("/privacy");
  await expect(page.getByRole("heading", { name: "Privacy" })).toBeVisible();
  await expect(page.getByText("dati relativi alla salute")).toBeVisible();
  await page.goto("/offline");
  await expect(page.getByRole("heading", { name: "Sei offline" })).toBeVisible();
});

test("intestazioni di sicurezza", async ({ request }) => {
  const res = await request.get("/");
  const h = res.headers();
  expect(h["content-security-policy"]).toContain("frame-ancestors 'none'");
  expect(h["content-security-policy"]).not.toContain("unsafe-eval");
  expect(h["x-frame-options"]).toBe("DENY");
  expect(h["x-content-type-options"]).toBe("nosniff");
  expect(h["strict-transport-security"]).toContain("max-age");
  expect(h["x-powered-by"]).toBeUndefined();
  expect(h["permissions-policy"]).toContain("microphone=(self)"); // dettatura vocale del coach
  expect(h["permissions-policy"]).toContain("geolocation=()");
});

test("app installabile: manifest e icone", async ({ request, page }) => {
  const m = await (await request.get("/manifest.webmanifest")).json();
  expect(m).toMatchObject({ display: "standalone", start_url: "/", lang: "it" });
  expect(m.icons.some((i: { purpose: string }) => i.purpose === "maskable")).toBe(true);
  for (const src of ["/icon-192.png", "/icon-512.png", "/icon-maskable-512.png", "/apple-touch-icon.png"]) {
    expect((await request.get(src)).status(), src).toBe(200);
  }
  await page.goto("/");
  await expect(page.locator('link[rel="manifest"]')).toHaveAttribute("href", "/manifest.webmanifest");
  await expect(page.locator('link[rel="apple-touch-icon"]')).toHaveAttribute("href", /apple-touch-icon/);
});

test("senza connessione compare la pagina offline", async ({ page, context }) => {
  await page.goto("/");
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.reload(); // ora la pagina è controllata dal service worker
  await expect.poll(() => page.evaluate(() => Boolean(navigator.serviceWorker.controller))).toBe(true);
  await context.setOffline(true);
  await page.goto("/calendario").catch(() => {});
  await expect(page.getByRole("heading", { name: "Sei offline" })).toBeVisible();
  await context.setOffline(false);
});

test("profilo: istruzioni per installare l'app", async ({ page }, info) => {
  await page.goto("/profilo");
  await expect(page.getByText("App sul telefono")).toBeVisible();
  if (info.project.name === "iphone") await expect(page.getByText("Aggiungi alla schermata Home")).toBeVisible();
  if (info.project.name === "android") await expect(page.getByText(/Installa app|Installa l'app/)).toBeVisible();
});

test("progressi: previsioni di gara", async ({ page }) => {
  await page.goto("/progressi");
  await expect(page.getByText("Previsioni di gara")).toBeVisible();
  for (const d of ["5 km", "10 km", "Mezza maratona", "Maratona"]) await expect(page.getByText(d, { exact: true }).first()).toBeVisible();
  await expect(page.getByText(/affidabilità (alta|media|bassa)/).first()).toBeVisible();
  await noHorizontalScroll(page);
});

test("scheda di palestra: giorni, gruppi e consigli del coach", async ({ page }) => {
  await page.goto("/profilo/palestra");
  await expect(page.getByRole("heading", { name: "Scheda di palestra" })).toBeVisible();
  await expect(page.getByText("Consigli del coach")).toBeVisible();
  await expect(page.getByText(/Venerdì gambe e sabato/).first()).toBeVisible();
  await expect(page.getByLabel("Esercizio").first()).toHaveValue("Panca piana");
  await page.getByRole("button", { name: "Aggiungi esercizio" }).first().click();
  await expect(page.getByLabel("Esercizio").nth(4)).toBeVisible();
  await expect(page.getByRole("button", { name: "Salva la scheda" })).toBeDisabled();
  await noHorizontalScroll(page);
});

test("palestra: progressione dei carichi dalle sedute registrate", async ({ page }) => {
  await page.goto("/profilo/palestra");
  await expect(page.getByText("Progressione dei carichi")).toBeVisible();
  await expect(page.getByText(/Panca piana/).first()).toBeVisible();
  await noHorizontalScroll(page);
});

test("home: controllo del mattino e consiglio del coach", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByText("Come stai stamattina?")).toBeVisible();
  await page.locator('input[name="sleep"][value="2"]').check({ force: true });
  await page.locator('input[name="fatigue"][value="4"]').check({ force: true });
  await page.getByRole("button", { name: "Invia le risposte" }).click();
  await expect(page.getByText(/dormito male|Non sei al meglio|Via libera|riposo/i).first()).toBeVisible();
  await noHorizontalScroll(page);
});

test("attività di corsa: cuore e passo con grafico e uscite simili", async ({ page }) => {
  for (let i = 1; i <= 14; i++) {
    const d = new Date(Date.now() - i * 864e5).toISOString().slice(0, 10);
    await page.goto(`/allenamenti/w-${d}`);
    if (await page.getByText("Cuore e passo").isVisible().catch(() => false)) break;
  }
  await expect(page.getByText("Cuore e passo")).toBeVisible();
  await expect(page.getByText(/Efficienza/).first()).toBeVisible();
  await noHorizontalScroll(page);
});

test("piano gara: obiettivi, passi, passaggi e checklist", async ({ page }) => {
  await page.goto("/");
  await page.getByText("Piano gara →").click();
  await expect(page.getByRole("heading", { name: /Piano gara/ })).toBeVisible();
  await expect(page.getByText("Tempi di passaggio")).toBeVisible();
  await expect(page.getByRole("link", { name: /Il mio/ })).toBeVisible();
  await expect(page.getByLabel("Il mio obiettivo: ore")).toHaveValue("1");
  await expect(page.getByLabel("Il mio obiettivo: minuti")).toHaveValue("44");
  await page.getByRole("link", { name: /Ambizioso/ }).click();
  await expect(page).toHaveURL(/obiettivo=ambizioso/);
  await expect(page.getByText("La sera prima")).toBeVisible();
  await noHorizontalScroll(page);
});
