/**
 * Test end-to-end în browser (Playwright/Chromium) pe platforma pornită complet:
 * API + worker de ingestie + worker Python + PostgreSQL + Redis.
 *
 *   BASE_URL=http://localhost:8080 SHOTS_DIR=/tmp/shots node test/e2e-ui.mjs
 *
 * Parcurge: catalog → login → upload criptat (iCloud/dispozitiv) → generare →
 * previzualizare + paletă → aprobare → lista de comenzi → comandă din catalog.
 * Eșuează la orice eroare JS în consolă sau la orice răspuns HTTP 5xx.
 */
import { createRequire } from 'node:module';
import { mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');

const BASE = process.env.BASE_URL ?? 'http://localhost:8080';
const SHOTS = process.env.SHOTS_DIR ?? fileURLToPath(new URL('../.e2e-shots/', import.meta.url));
const PHOTO = fileURLToPath(new URL('./fixtures/sample.jpg', import.meta.url));
mkdirSync(SHOTS, { recursive: true });

const problems = [];
const step = (name) => console.log(`• ${name}`);

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1280, height: 860 }, deviceScaleFactor: 1 });
const page = await ctx.newPage();
page.on('console', (m) => { if (m.type() === 'error') problems.push(`console: ${m.text()}`); });
page.on('pageerror', (e) => problems.push(`pageerror: ${e.message}`));
page.on('response', (r) => { if (r.status() >= 500) problems.push(`HTTP ${r.status()} ${r.url()}`); });

try {
  step('catalog');
  await page.goto(BASE);
  await page.getByRole('heading', { name: 'Fotografia ta, pictată de mâna ta.' }).waitFor();
  const cards = page.locator('article.design');
  await cards.first().waitFor();
  assert.ok(await cards.count() >= 1, 'catalog shows designs');
  await page.waitForFunction(() => [...document.images].every((i) => i.complete && i.naturalWidth > 0));
  await page.screenshot({ path: `${SHOTS}/01-catalog.png`, fullPage: false });

  step('login (premium)');
  await page.getByRole('button', { name: 'Intră în cont' }).first().click();
  await page.getByLabel('E-mail').fill('client@exemplu.ro');
  await page.getByRole('button', { name: 'Intră în cont' }).last().click();
  await page.locator('#account').getByText('client@exemplu.ro').waitFor();

  step('upload criptat din „telefon/iCloud"');
  await page.goto(`${BASE}/#/create`);
  await page.getByRole('heading', { name: 'Din Google Photos' }).waitFor();
  assert.ok(await page.getByRole('button', { name: 'Conectează Google Photos' }).isVisible(), 'Google connect offered');
  await page.locator('input[type=file]').setInputFiles(PHOTO);
  await page.getByText('Fotografia e pregătită').waitFor({ timeout: 60_000 });
  await page.locator('.colors span', { hasText: /^12$/ }).click();
  await page.getByLabel('Mărimea pânzei').selectOption({ label: '30 × 40 cm' });
  await page.screenshot({ path: `${SHOTS}/02-create.png` });

  step('generare + previzualizare');
  await page.getByRole('button', { name: 'Generează previzualizarea' }).click();
  await page.getByRole('heading', { name: 'Paleta ta' }).waitFor({ timeout: 120_000 });
  const swatches = await page.locator('.palette li').count();
  assert.ok(swatches >= 2 && swatches <= 12, `palette has ${swatches} colors`);
  await page.waitForFunction(() => [...document.images].every((i) => i.complete && i.naturalWidth > 0));
  await page.screenshot({ path: `${SHOTS}/03-preview.png` });
  await page.getByRole('tab', { name: 'Pânza numerotată' }).click();
  await page.waitForFunction(() => { const i = document.querySelector('.stage img'); return i.complete && i.naturalWidth > 0; });
  await page.screenshot({ path: `${SHOTS}/04-numbered.png` });

  step('descărcare PDF de producție');
  const pdfHref = await page.getByRole('link', { name: 'Pânza (PDF)' }).getAttribute('href');
  const pdf = await page.request.get(new URL(pdfHref, BASE).toString());
  assert.equal(pdf.status(), 200);
  assert.equal((await pdf.body()).subarray(0, 4).toString(), '%PDF');

  step('aprobare');
  await page.getByRole('button', { name: 'Aprobă varianta' }).click();
  await page.getByText('Aprobată — urmează plata').first().waitFor();

  step('lista de comenzi');
  await page.goto(`${BASE}/#/orders`);
  await page.locator('table.orders tbody tr').first().waitFor();
  await page.screenshot({ path: `${SHOTS}/05-orders.png` });

  step('comandă din catalog');
  await page.goto(`${BASE}/#/`);
  await page.getByRole('button', { name: 'Comandă acest model' }).first().click();
  await page.getByRole('heading', { name: 'Paleta ta' }).waitFor({ timeout: 30_000 });
  await page.getByText('Aprobată — urmează plata').first().waitFor();

  step('mobil (390 px)');
  const mobile = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await mobile.goto(BASE);
  await mobile.locator('article.design').first().waitFor();
  const overflow = await mobile.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  assert.ok(overflow <= 0, `no horizontal scroll on mobile (overflow ${overflow}px)`);
  await mobile.screenshot({ path: `${SHOTS}/06-mobile.png`, fullPage: false });

  assert.deepEqual(problems, [], 'no console errors or 5xx responses');
  console.log(`\nE2E OK — capturi în ${SHOTS}`);
} catch (err) {
  await page.screenshot({ path: `${SHOTS}/failure.png` }).catch(() => {});
  console.error('\nE2E FAILED:', err.message);
  if (problems.length) console.error(problems.join('\n'));
  process.exitCode = 1;
} finally {
  await browser.close();
}
