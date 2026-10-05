import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join, relative, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';

const args = process.argv.slice(2);
const option = (name, fallback) => {
  const index = args.indexOf(name);
  return index < 0 ? fallback : args[index + 1];
};
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const output = resolve(option('--output', join(tmpdir(), 'archipelago-launch-1-publish')));
const baseUrl = new URL(option('--url', 'http://127.0.0.1:4173/archipelago/'));
if (!baseUrl.pathname.endsWith('/')) baseUrl.pathname += '/';
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const channel = option('--channel', process.platform === 'win32' ? 'msedge' : undefined);
const browser = await chromium.launch({ headless: true, ...(channel ? { channel } : {}) });
await mkdir(output, { recursive: true });

const badResponses = [];
const googleFontRequests = [];
const watch = (page) => {
  page.on('response', (response) => {
    if (response.status() === 404) badResponses.push(response.url());
  });
  page.on('request', (request) => {
    const host = new URL(request.url()).hostname;
    if (host === 'fonts.googleapis.com' || host === 'fonts.gstatic.com') googleFontRequests.push(request.url());
  });
};

async function mp3Files(directory) {
  const found = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) found.push(...await mp3Files(path));
    else if (entry.name.endsWith('.mp3')) found.push(path);
  }
  return found.sort();
}

try {
  const context = await browser.newContext({ viewport: { width: 1366, height: 768 }, deviceScaleFactor: 1 });
  const page = await context.newPage();
  watch(page);
  await page.goto(baseUrl.href, { waitUntil: 'networkidle' });
  await page.getByRole('button', { name: 'Начать игру', exact: true }).click();
  await page.locator('.hud').waitFor();
  await page.locator('button[aria-label^="Звук:"]').click();
  const soundSwitch = page.getByRole('switch', { name: 'Звук включён' });
  if (!(await soundSwitch.isChecked())) await soundSwitch.check();
  await page.evaluate(() => document.fonts.ready);
  assert(await page.evaluate(() => document.fonts.check('700 20px Unbounded')), 'Unbounded 700 не загружен');
  assert(await page.evaluate(() => document.fonts.check('800 16px Manrope')), 'Manrope 800 не загружен');

  await page.goto(new URL('?sound', baseUrl).href, { waitUntil: 'networkidle' });
  await page.getByRole('heading', { name: 'Звуки острова', exact: true }).waitFor();
  await page.goto(new URL('?sandbox', baseUrl).href, { waitUntil: 'networkidle' });
  await page.getByText('Сцена · sandbox', { exact: true }).waitFor();

  const audioRoot = resolve(root, 'apps/web/public/audio');
  const audioFiles = await mp3Files(audioRoot);
  assert.equal(audioFiles.length, 43, `Ожидалось 43 MP3, найдено ${audioFiles.length}`);
  const cuesSource = await readFile(resolve(root, 'apps/web/src/audio/cues.ts'), 'utf8');
  assert(cuesSource.includes("asset(`audio/${directory}/${cue.replaceAll('.', '-')}.mp3`)"), 'cues.ts должен строить base-aware пути MP3');
  for (const file of audioFiles) {
    const rel = relative(resolve(root, 'apps/web/public'), file).replaceAll('\\', '/');
    const response = await context.request.get(new URL(rel, baseUrl).href);
    assert.equal(response.status(), 200, `${rel}: HTTP ${response.status()}`);
  }
  await context.close();

  const slow = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 });
  const slowPage = await slow.newPage();
  watch(slowPage);
  const cdp = await slow.newCDPSession(slowPage);
  await cdp.send('Network.enable');
  await cdp.send('Network.setCacheDisabled', { cacheDisabled: true });
  await cdp.send('Network.emulateNetworkConditions', {
    offline: false,
    latency: 150,
    downloadThroughput: 1.6 * 1024 * 1024 / 8,
    uploadThroughput: 0.75 * 1024 * 1024 / 8,
  });
  const started = Date.now();
  await slowPage.goto(baseUrl.href, { waitUntil: 'commit' });
  const frames = [];
  while (Date.now() - started < 20000) {
    const state = await slowPage.evaluate(() => {
      const visible = (element) => !!element && getComputedStyle(element).display !== 'none' && element.getBoundingClientRect().width > 0;
      if (visible(document.querySelector('.app-loader'))) return 'loader';
      if (visible(document.querySelector('.welcome'))) return 'game';
      return 'blank';
    });
    const at = Date.now() - started;
    const image = await slowPage.screenshot({ type: 'jpeg', quality: 80 });
    frames.push({ state, at, image });
    if (state === 'game') break;
    await slowPage.waitForTimeout(100);
  }
  assert(frames.length > 0, 'Нет кадров загрузки');
  assert(frames.every((frame) => frame.state === 'loader' || frame.state === 'game'), `Обнаружен пустой кадр: ${JSON.stringify(frames.map(({ state, at }) => ({ state, at })))}`);
  const firstLoader = frames.find((frame) => frame.state === 'loader');
  assert(firstLoader && firstLoader.at <= 1000, `Первый кадр заставки через ${firstLoader?.at ?? '∞'} мс`);
  assert(frames.at(-1)?.state === 'game', 'Окно приветствия не появилось за 20 секунд');
  const indices = [...new Set([0, Math.floor((frames.length - 1) / 3), Math.floor((frames.length - 1) * 2 / 3), frames.length - 1])];
  for (let i = 0; i < indices.length; i++) {
    const frame = frames[indices[i]];
    await writeFile(resolve(output, `loader-${i + 1}-${frame.at}ms-${frame.state}.jpg`), frame.image);
  }
  await slow.close();

  assert.deepEqual(badResponses, [], `404 ответы: ${badResponses.join(', ')}`);
  assert.deepEqual(googleFontRequests, [], `Запросы к Google Fonts: ${googleFontRequests.join(', ')}`);
  console.log(`Publish check passed: 43 MP3, base ${baseUrl.pathname}, fonts local, loader ${frames.length} frames; screenshots: ${output}`);
} finally {
  await browser.close();
}
