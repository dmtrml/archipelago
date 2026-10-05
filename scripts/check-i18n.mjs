import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { tmpdir } from 'node:os';

const args = process.argv.slice(2);
const option = (name, fallback) => { const i = args.indexOf(name); return i < 0 ? fallback : args[i + 1]; };
const url = option('--url', 'http://127.0.0.1:5187/');
const baselineUrl = option('--baseline-url', 'http://127.0.0.1:5186/');
const output = resolve(option('--output', resolve(tmpdir(), 'archipelago-launch-3-i18n')));
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const channel = option('--channel', process.platform === 'win32' ? 'msedge' : undefined);
const browser = await chromium.launch({ headless: true, ...(channel ? { channel } : {}) });
await mkdir(output, { recursive: true });
const screenshotDir = resolve(output, 'screenshots');
await mkdir(screenshotDir, { recursive: true });

const screenshots = [];
const errors = [];
const CYRILLIC = /[А-Яа-яЁё]/;

function normalizeRu(text) {
  return text.split(/\r?\n/)
    .map((line) => line.trimEnd())
    .filter((line) => !['RU', 'EN', 'Язык'].includes(line.trim()))
    .join('\n').replace(/\n{3,}/g, '\n\n').trim();
}

async function newPage(base, { lang = 'ru', locale = 'ru-RU', width = 1366, height = 768 } = {}) {
  const context = await browser.newContext({ locale, viewport: { width, height } });
  const page = await context.newPage();
  page.on('pageerror', (error) => errors.push(`${base}: ${error.message}`));
  await page.addInitScript(({ forcedLang }) => {
    Math.random = () => 0.123456789;
    try {
      localStorage.clear();
      localStorage.setItem('archipelago.coach.v1', 'done');
      if (forcedLang) localStorage.setItem('archipelago.lang.v1', forcedLang);
    } catch {}
  }, { forcedLang: lang || null });
  await page.goto(base, { waitUntil: 'networkidle' });
  return { context, page };
}

async function startGame(page, lang = 'ru', values = {}) {
  const islandLabel = lang === 'ru' ? 'Название острова' : 'Island name';
  const nameLabel = lang === 'ru' ? 'Ваше имя' : 'Your name';
  const start = lang === 'ru' ? 'Начать игру' : 'Start game';
  await page.getByLabel(islandLabel).fill(values.island ?? (lang === 'ru' ? 'Чайка' : 'Lagoon'));
  await page.getByLabel(nameLabel).fill(values.name ?? (lang === 'ru' ? 'Аня' : 'Alex'));
  await page.getByRole('button', { name: start, exact: true }).click();
  await page.locator('.hud').waitFor();
  await page.waitForTimeout(80);
}

async function text(page) { return (await page.locator('body').innerText()).trim(); }

async function assertEnglish(page, label) {
  const body = await text(page);
  assert(!CYRILLIC.test(body), `${label}: Cyrillic remains in EN UI:\n${body.match(/.{0,40}[А-Яа-яЁё].{0,80}/)?.[0] ?? body}`);
  const overflow = await page.evaluate(() => {
    const roots = [...document.querySelectorAll('.hud, .modal, .sheet')];
    const bad = [];
    for (const root of roots) {
      for (const el of [root, ...root.querySelectorAll('*')]) {
        if (!(el instanceof HTMLElement) || !el.getClientRects().length || !(el.textContent?.trim())) continue;
        const css = getComputedStyle(el);
        if (css.textOverflow === 'ellipsis') continue;
        if (el.scrollWidth > el.clientWidth + 1) bad.push({ tag: el.tagName, cls: el.className, text: el.textContent.trim().slice(0, 80), scroll: el.scrollWidth, client: el.clientWidth });
      }
    }
    return bad.slice(0, 20);
  });
  assert.deepEqual(overflow, [], `${label}: text overflow: ${JSON.stringify(overflow)}`);
}

async function shot(page, name) {
  const path = resolve(screenshotDir, `${name}.jpg`);
  await page.screenshot({ path, type: 'jpeg', quality: 82, fullPage: false });
  screenshots.push(path);
}

async function captureRu(base) {
  const { context, page } = await newPage(base, { lang: 'ru' });
  const captures = {};
  captures.welcome = normalizeRu(await text(page));
  await startGame(page, 'ru');
  captures.game = normalizeRu(await text(page));
  for (const tab of ['Отчёт', 'Сделки', 'Остров', 'Действия']) {
    const button = page.getByRole('button', { name: tab, exact: true }).last();
    if (await button.count()) await button.click();
    await page.waitForTimeout(20);
    captures[`tab:${tab}`] = normalizeRu(await text(page));
  }
  const buy = page.locator('[data-offer-uid] .btn.primary:not([disabled])').first();
  if (await buy.count()) {
    await buy.click(); await page.waitForTimeout(80);
    captures.purchase = normalizeRu(await text(page));
  }
  const sound = page.locator('.audio-button').first();
  if (await sound.count()) {
    await sound.click(); await page.locator('.audio-panel').waitFor();
    captures.sound = normalizeRu(await text(page));
    await page.keyboard.press('Escape');
  }
  const next = page.locator('[data-coach="next-week"]:visible');
  if (await next.count()) {
    await next.click(); await page.waitForTimeout(1250);
    captures.week = normalizeRu(await text(page));
  }
  const save = await page.evaluate(() => localStorage.getItem('archipelago.save.v1'));
  await context.close();
  return { captures, save };
}

try {
  // RU must remain byte-for-byte in visible text, except the new language controls.
  const baseline = await captureRu(baselineUrl);
  const current = await captureRu(url);
  for (const key of Object.keys(baseline.captures)) {
    assert.equal(current.captures[key], baseline.captures[key], `RU parity differs at ${key}`);
  }

  // Root precedence: browser RU -> RU; non-RU -> EN; saved choice beats browser.
  {
    const ruBrowser = await newPage(url, { lang: null, locale: 'ru-RU' });
    assert.equal(await ruBrowser.page.evaluate(() => document.documentElement.lang), 'ru');
    await ruBrowser.context.close();
    const deBrowser = await newPage(url, { lang: null, locale: 'de-DE' });
    assert.equal(await deBrowser.page.evaluate(() => document.documentElement.lang), 'en');
    assert(!CYRILLIC.test(await text(deBrowser.page)), 'de-DE root should render EN');
    await deBrowser.context.close();
    const savedRu = await newPage(url, { lang: 'ru', locale: 'de-DE' });
    assert.equal(await savedRu.page.evaluate(() => document.documentElement.lang), 'ru');
    await savedRu.context.close();
  }

  // /en/ is always EN even if storage asks for RU.
  {
    const enPath = new URL('en/', url).href;
    const forced = await newPage(enPath, { lang: 'ru', locale: 'ru-RU' });
    assert.equal(await forced.page.evaluate(() => document.documentElement.lang), 'en');
    assert.equal(await forced.page.title(), 'Archipelago — a cozy game about money and freedom');
    assert(!CYRILLIC.test(await text(forced.page)), '/en/ contains Cyrillic before game start');
    await forced.context.close();
  }

  // Full EN smoke on both acceptance viewports, including tabs/week and six screenshots.
  for (const [width, height] of [[390, 844], [1366, 768]]) {
    const { context, page } = await newPage(url, { lang: 'en', locale: 'en-US', width, height });
    await assertEnglish(page, `welcome-${width}`); await shot(page, `en-welcome-${width}`);
    await startGame(page, 'en');
    await assertEnglish(page, `game-${width}`); await shot(page, `en-game-${width}`);
    for (const tab of ['Deals', 'Island', 'Actions', 'Report']) {
      const button = page.getByRole('button', { name: tab, exact: true }).last();
      if (await button.count()) { await button.click(); await page.waitForTimeout(20); await assertEnglish(page, `${tab}-${width}`); }
    }
    const next = page.locator('[data-coach="next-week"]:visible');
    if (await next.count()) { await next.click(); await page.waitForTimeout(1250); await assertEnglish(page, `week-${width}`); }
    await shot(page, `en-after-week-${width}`);
    await context.close();
  }

  // Switch language in place: world identity/week stays unchanged and no navigation occurs.
  {
    const { context, page } = await newPage(url, { lang: 'ru' });
    await startGame(page, 'ru', { island: 'Lagoon', name: 'Alex' });
    const before = await page.evaluate(async () => { const { useGame } = await import('/src/store.ts'); const w = useGame.getState().world; return { seed: w.seed, week: w.week, href: location.href }; });
    await page.locator('.audio-button').click();
    await page.locator('.audio-panel .language-switch button', { hasText: 'EN' }).click();
    await page.waitForFunction(() => document.documentElement.lang === 'en');
    await page.keyboard.press('Escape');
    const after = await page.evaluate(async () => { const { useGame } = await import('/src/store.ts'); const w = useGame.getState().world; return { seed: w.seed, week: w.week, href: location.href }; });
    assert.deepEqual(after, before, 'Language switch changed game or navigated');
    assert.equal(await page.evaluate(() => document.documentElement.lang), 'en');
    assert.equal(await page.title(), 'Archipelago — a cozy game about money and freedom');
    await page.getByRole('button', { name: 'Next week' }).waitFor();
    assert.match(await text(page), /Deals|Island|Actions|Report/, 'System UI did not switch to English');
    await context.close();
  }

  // A v3 save with old rendered text migrates to v4 and preserves legacy event/news text.
  if (baseline.save) {
    const legacy = JSON.parse(baseline.save);
    legacy.world.version = 3;
    if (!legacy.world.lastReport) {
      legacy.world.lastReport = { week: 1, worldEvents: [], players: { p1: { playerId:'p1',salary:0,assetIncome:[],upkeep:[],living:0,interest:0,insurance:0,eventsCash:0,net:0,cashAfter:600,happinessDelta:0,events:[],lostAssetUids:[],freedomReached:false } }, news: [] };
    }
    legacy.world.lastReport.worldEvents.push({ id: 'gift', tone: 'good', title: 'Старый заголовок', text: 'Старый текст', cashDelta: 5 });
    legacy.news = [{ week: legacy.world.lastReport.week, text: 'Старая новость', playerId: 'bot-mia' }];
    const context = await browser.newContext({ locale: 'en-US', viewport: { width: 1366, height: 768 } });
    const page = await context.newPage();
    page.on('pageerror', (error) => errors.push(`${url}: ${error.message}`));
    await page.goto(url, { waitUntil: 'networkidle' });
    await page.evaluate((data) => { localStorage.clear(); localStorage.setItem('archipelago.coach.v1', 'done'); localStorage.setItem('archipelago.save.v1', JSON.stringify(data)); localStorage.setItem('archipelago.lang.v1', 'en'); }, legacy);
    await page.reload({ waitUntil: 'networkidle' });
    await page.locator('.hud').waitFor();
    const migrated = await page.evaluate(async () => { const { useGame } = await import('/src/store.ts'); const s = useGame.getState(); return { version: s.world.version, oldEvent: s.world.lastReport?.worldEvents.at(-1), news: s.news[0] }; });
    assert.equal(migrated.version, 4);
    assert.equal(migrated.oldEvent.legacyTitle, 'Старый заголовок');
    assert.equal(migrated.oldEvent.legacyText, 'Старый текст');
    assert.equal(migrated.news.text, 'Старая новость');
    await context.close();
  }

  // Dictionary variant counts are locked to the engine constants.
  {
    const { context, page } = await newPage(url, { lang: 'en' });
    const counts = await page.evaluate(async () => {
      const [engine, { ru }, { en }] = await Promise.all([import('/@id/@arch/engine'), import('/src/i18n/ru.ts'), import('/src/i18n/en.ts')]);
      return { expected: engine.EVENT_VARIANTS, ru: { breakdown: ru.events.breakdown.variants.length, gift: ru.events.gift.variants.length }, en: { breakdown: en.events.breakdown.variants.length, gift: en.events.gift.variants.length } };
    });
    assert.deepEqual(counts.ru, counts.expected); assert.deepEqual(counts.en, counts.expected);
    await context.close();
  }

  assert.deepEqual(errors, [], `Browser runtime errors: ${errors.join('; ')}`);
  await writeFile(resolve(output, 'results.json'), JSON.stringify({ ruScreens: Object.keys(baseline.captures), screenshots, runtimeErrors: errors }, null, 2));
  console.log(JSON.stringify({ ruParityScreens: Object.keys(baseline.captures).length, enScreenshots: screenshots.length, runtimeErrors: 0, output }, null, 2));
} finally {
  await browser.close();
}
