import { chromium } from '@playwright/test';

const BASE = 'http://127.0.0.1:5173';
const out = 'scripts/_shots';
import fs from 'node:fs';
fs.mkdirSync(out, { recursive: true });

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });

// 1) Landing
await page.goto(BASE, { waitUntil: 'networkidle' });
await page.waitForTimeout(800);
await page.screenshot({ path: `${out}/01-landing.png`, fullPage: false });
console.log('shot 01-landing OK');

// 2) Escribir una pregunta de programacion y enviar
try {
  const box = page.getByRole('textbox').first();
  await box.click();
  await box.fill('En una linea: que es una API REST?');
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${out}/02-escrito.png` });
  console.log('shot 02-escrito OK');

  // enviar con Enter
  await box.press('Enter');
  // esperar a que aparezca respuesta en streaming
  await page.waitForTimeout(9000);
  await page.screenshot({ path: `${out}/03-respuesta.png`, fullPage: true });
  console.log('shot 03-respuesta OK');
} catch (e) {
  console.log('interaccion fallo:', e.message);
}

await browser.close();
console.log('DONE');
