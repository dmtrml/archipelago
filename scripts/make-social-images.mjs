import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { stat } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const args = process.argv.slice(2);
const option = (name, fallback) => {
  const index = args.indexOf(name);
  return index < 0 ? fallback : args[index + 1];
};
if (args.includes('--lang')) throw new Error('--lang пока не поддерживается; английские изображения добавит этап 3.');

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const web = resolve(root, 'apps/web');
const publicDir = resolve(web, 'public');
const viteBin = resolve(root, 'node_modules/vite/bin/vite.js');
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const channel = option('--channel', process.platform === 'win32' ? 'msedge' : undefined);
const host = '127.0.0.1';
const port = Number(option('--port', '4173'));
const baseUrl = `http://${host}:${port}/`;
let previewOutput = '';

const preview = spawn(process.execPath, [viteBin, 'preview', '--host', host, '--port', String(port), '--strictPort'], {
  cwd: web,
  stdio: ['ignore', 'pipe', 'pipe'],
});
preview.stdout.on('data', (chunk) => { previewOutput += chunk; });
preview.stderr.on('data', (chunk) => { previewOutput += chunk; });

async function waitForPreview() {
  for (let attempt = 0; attempt < 100; attempt++) {
    if (preview.exitCode !== null) throw new Error(`vite preview завершился раньше времени (${preview.exitCode}).\n${previewOutput}`);
    try {
      const response = await fetch(baseUrl);
      if (response.ok) return;
    } catch { /* preview ещё запускается */ }
    await new Promise((done) => setTimeout(done, 100));
  }
  throw new Error(`vite preview не запустился.\n${previewOutput}`);
}

let browser;
try {
  await waitForPreview();
  browser = await chromium.launch({ headless: true, ...(channel ? { channel } : {}) });
  const context = await browser.newContext({ viewport: { width: 180, height: 180 }, deviceScaleFactor: 1 });
  const page = await context.newPage();
  const browserErrors = [];
  const missing = [];
  page.on('pageerror', (error) => browserErrors.push(error.message));
  page.on('console', (message) => { if (message.type() === 'error') browserErrors.push(message.text()); });
  page.on('response', (response) => { if (response.status() === 404) missing.push(response.url()); });

  await page.setContent(`<!doctype html><style>html,body{margin:0;width:180px;height:180px}img{display:block;width:180px;height:180px}</style><img src="${baseUrl}favicon.svg">`);
  await page.locator('img').evaluate((image) => image.complete ? undefined : new Promise((resolveImage) => image.addEventListener('load', resolveImage, { once: true })));
  await page.screenshot({ path: resolve(publicDir, 'apple-touch-icon.png'), type: 'png' });

  await page.setViewportSize({ width: 1488, height: 630 });
  await page.goto(`${baseUrl}?sandbox`, { waitUntil: 'networkidle' });
  try {
    await page.getByText('Сцена · sandbox', { exact: true }).waitFor({ timeout: 10000 });
  } catch {
    throw new Error(`Sandbox не загрузился. 404: ${missing.join(', ') || 'нет'}. Ошибки браузера: ${browserErrors.join(' | ') || 'нет'}`);
  }
  await page.getByRole('button', { name: '2', exact: true }).click();
  await page.getByRole('button', { name: 'Заполнить всё', exact: true }).click();
  await page.getByRole('button', { name: 'built 3', exact: true }).click();
  await page.waitForTimeout(2500);
  await page.evaluate(async () => {
    await document.fonts.ready;
    if (!document.fonts.check('700 20px Unbounded')) throw new Error('Unbounded 700 не загрузился');
    const fillButton = [...document.querySelectorAll('button')].find((button) => button.textContent?.trim() === 'Заполнить всё');
    let panel = fillButton?.parentElement ?? null;
    while (panel && getComputedStyle(panel).position !== 'fixed') panel = panel.parentElement;
    if (!panel) throw new Error('Панель sandbox не найдена');
    panel.style.display = 'none';

    const card = document.createElement('div');
    card.id = 'social-card';
    Object.assign(card.style, {
      position: 'fixed', left: '56px', top: '50%', transform: 'translateY(-50%)', width: '470px',
      boxSizing: 'border-box', display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: '14px',
      padding: '36px', background: 'rgba(255,251,243,.9)', backdropFilter: 'blur(10px)', borderRadius: '28px',
      boxShadow: '0 10px 30px rgba(31,42,68,.16), 0 2px 6px rgba(31,42,68,.08)', zIndex: '50', color: '#1F2A44',
    });
    const icon = document.createElement('img');
    icon.src = '/favicon.svg';
    Object.assign(icon.style, { width: '84px', height: '84px', display: 'block' });
    const title = document.createElement('div');
    title.textContent = 'Архипелаг';
    title.style.font = '700 58px/1 Unbounded, system-ui, sans-serif';
    title.style.color = '#1F2A44';
    const subtitle = document.createElement('div');
    subtitle.textContent = 'Уютная игра про деньги и свободу';
    subtitle.style.font = '800 25px/1.25 Manrope, system-ui, sans-serif';
    subtitle.style.color = '#5B6680';
    const cta = document.createElement('div');
    cta.textContent = 'Играть бесплатно в браузере';
    Object.assign(cta.style, {
      font: '800 21px/1.2 Manrope, system-ui, sans-serif', background: '#F5B83D', color: '#3A2600',
      borderBottom: '4px solid #D9931C', borderRadius: '14px', padding: '12px 20px',
    });
    card.append(icon, title, subtitle, cta);
    document.body.append(card);
  });
  await page.locator('#social-card img').evaluate((image) => image.complete ? undefined : new Promise((resolveImage) => image.addEventListener('load', resolveImage, { once: true })));
  const ogPath = resolve(publicDir, 'og-image.jpg');
  await page.screenshot({ path: ogPath, type: 'jpeg', quality: 88, clip: { x: 0, y: 0, width: 1200, height: 630 } });
  const og = await stat(ogPath);
  assert(og.size <= 300 * 1024, `og-image.jpg больше 300 КБ: ${Math.round(og.size / 1024)} КБ`);
  console.log(`Созданы apple-touch-icon.png и og-image.jpg (${Math.round(og.size / 1024)} КБ).`);
} finally {
  await browser?.close();
  preview.kill();
}
