import { spawn, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { createServer } from 'node:net';
import { copyFile, mkdir, readFile, readdir, stat, writeFile } from 'node:fs/promises';
import { dirname, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { measureBeats } from './beats.mjs';
import { renderAudio } from './audio.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const ffmpeg = process.env.FFMPEG_PATH || require('ffmpeg-static') || 'ffmpeg';
const ffprobe = process.env.FFPROBE_PATH || require('ffprobe-static').path || 'ffprobe';
const vite = resolve(dirname(require.resolve('vite')), '../../bin/vite.js');
const npmCli = process.env.npm_execpath;
const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const epoch = Date.parse('2026-10-05T12:00:00Z');
const BEAT = 60 / 99;
const checkVersion = 'trailer-scam-story-v4';
const scamOffer = require(resolve(root, 'apps/web/src/director/fixtures.json')).scamCard.world.offers.find(
  (offer) => offer.defId === 'pearlFarm',
);
if (!scamOffer || !Number.isFinite(scamOffer.price) || !Number.isFinite(scamOffer.income))
  throw new Error('scamCard pearlFarm offer missing price/income');
const expectedMontage = {
  v30: {
    totalBeats: 49.5,
    shots: [
      ['hook', 0, 4], ['asset', 4, 10], ['liability', 10, 15],
      ['scam-card', 15, 19], ['scam-pays', 19, 22], ['scam-collapse', 22, 27],
      ['storm', 27, 31], ['freedom', 31, 38], ['dream', 38, 44], ['end', 44, 49.5],
    ],
  },
  h45: {
    totalBeats: 74.25,
    shots: [
      ['hook', 0, 6], ['asset', 6, 14], ['upgrade', 14, 20], ['liability', 20, 26],
      ['scam-card', 26, 31], ['scam-pays', 31, 35], ['scam-collapse', 35, 41],
      ['storm', 41, 46], ['neighbors', 46, 52], ['freedom', 52, 60],
      ['dream', 60, 66], ['end', 66, 74.25],
    ],
  },
};
function validateMontage(edit) {
  for (const [format, expected] of Object.entries(expectedMontage)) {
    const actual = edit[format];
    if (!actual || actual.totalBeats !== expected.totalBeats ||
        JSON.stringify(actual.shots) !== JSON.stringify(expected.shots))
      throw new Error(`${format} shot boundaries differ from trailer-scam-story.md: ${JSON.stringify(actual)}`);
    for (const fps of [15, 30]) {
      let next = 0;
      for (const [shot, from, to] of actual.shots) {
        const start = Math.round(from * BEAT * fps), end = Math.round(to * BEAT * fps);
        if (start !== next || end <= start) throw new Error(`${format} ${shot} ${fps}fps: gap/overlap`);
        next = end;
      }
      if (next !== cfg[format].duration * fps)
        throw new Error(`${format} ${fps}fps: ${next} frames instead of ${cfg[format].duration * fps}`);
    }
  }
}
const args = process.argv.slice(2);
const value = (name, def) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : def;
};
const has = (name) => args.includes(`--${name}`);
const quality = value('quality', 'draft');
const formatArg = value('format', 'all');
const langArg = value('lang', quality === 'draft' ? 'ru' : 'all');
const channel = value('channel', process.platform === 'win32' ? 'msedge' : undefined);
const shotArg = value('shots', '');
if (!['draft', 'final'].includes(quality)) throw new Error('--quality draft|final');
const targets = (formatArg === 'all' ? ['v30', 'h45'] : [formatArg]).flatMap((format) =>
  (langArg === 'all' ? ['ru', 'en'] : [langArg]).map((lang) => ({ format, lang })),
);
const cfg = {
  v30: {
    viewport: { width: 360, height: 640 },
    dpr: quality === 'final' ? 3 : 1.5,
    fps: quality === 'final' ? 30 : 15,
    width: quality === 'final' ? 1080 : 540,
    height: quality === 'final' ? 1920 : 960,
    duration: 30,
    sheetWidth: 216,
  },
  h45: {
    viewport: { width: 1280, height: 720 },
    dpr: quality === 'final' ? 1.5 : 0.75,
    fps: quality === 'final' ? 30 : 15,
    width: quality === 'final' ? 1920 : 960,
    height: quality === 'final' ? 1080 : 540,
    duration: 45,
    sheetWidth: 384,
  },
};

const sh = (cmd, a, opts = {}) => {
  const r = spawnSync(cmd, a, { cwd: root, encoding: 'utf8', maxBuffer: 128 * 1024 * 1024, ...opts });
  if (r.error) throw r.error;
  if (r.status !== 0) throw new Error(`${cmd} ${a.join(' ')}\n${r.stdout}\n${r.stderr}`);
  return r;
};
const npmRun = (...a) => (npmCli ? sh(process.execPath, [npmCli, ...a]) : sh(npm, a));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function port() {
  return new Promise((ok, bad) => {
    const s = createServer();
    s.on('error', bad);
    s.listen(0, '127.0.0.1', () => {
      const p = s.address().port;
      s.close(() => ok(p));
    });
  });
}
async function hashTree(dir) {
  const h = createHash('sha256');
  async function walk(p) {
    for (const name of (await readdir(p)).sort()) {
      const full = resolve(p, name);
      const info = await stat(full);
      if (info.isDirectory()) await walk(full);
      else {
        h.update(relative(dir, full));
        h.update(await readFile(full));
      }
    }
  }
  await walk(dir);
  return h.digest('hex');
}
function virtualClock(epochMs) {
  let now = 0,
    id = 1;
  const timers = new Map(),
    rafs = new Map();
  const floatAnimationStarts = new WeakMap();
  let seed = 12345;
  const rnd = () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  Date.now = () => epochMs + now;
  try {
    Object.defineProperty(performance, 'now', { configurable: true, value: () => now });
  } catch {}
  Math.random = rnd;
  window.setTimeout = (fn, delay = 0, ...a) => {
    const n = id++;
    timers.set(n, { at: now + Math.max(0, Number(delay)), fn: () => fn(...a), period: 0 });
    return n;
  };
  window.clearTimeout = (n) => timers.delete(n);
  window.setInterval = (fn, delay = 0, ...a) => {
    const n = id++;
    timers.set(n, { at: now + Math.max(1, Number(delay)), fn: () => fn(...a), period: Math.max(1, Number(delay)) });
    return n;
  };
  window.clearInterval = window.clearTimeout;
  window.requestAnimationFrame = (fn) => {
    const n = id++;
    rafs.set(n, fn);
    return n;
  };
  window.cancelAnimationFrame = (n) => rafs.delete(n);
  window.__step = (ms) => {
    const end = now + ms;
    let guard = 0;
    while (guard++ < 10000) {
      const due = [...timers.entries()].filter(([, t]) => t.at <= end).sort((a, b) => a[1].at - b[1].at || a[0] - b[0]);
      if (!due.length) break;
      const [n, t] = due[0];
      now = Math.max(now, t.at);
      if (t.period) t.at += t.period;
      else timers.delete(n);
      try {
        t.fn();
      } catch (e) {
        queueMicrotask(() => {
          throw e;
        });
      }
    }
    now = end;
    const list = [...rafs.entries()];
    rafs.clear();
    for (const [, fn] of list)
      try {
        fn(now);
      } catch (e) {
        console.error(e);
      }
    const isScamScene = !!document.querySelector(
      '.director-root[data-shot="scam-pays"], .director-root[data-shot="scam-collapse"]',
    );
    for (const a of document.getAnimations()) {
      try {
        if (isScamScene && a.effect?.target?.classList?.contains('isl-float-inner')) {
          if (!floatAnimationStarts.has(a)) floatAnimationStarts.set(a, now);
          // Newly created payouts start at zero, not at the virtual page's elapsed time.
          a.currentTime = now - floatAnimationStarts.get(a);
        } else {
          a.currentTime = now;
        }
      } catch {}
    }
    return now;
  };
}

async function startPreview() {
  if (!has('no-build')) npmRun('run', 'build');
  const p = await port();
  const child = spawn(process.execPath, [vite, 'preview', '--host', '127.0.0.1', '--port', String(p), '--strictPort'], {
    cwd: resolve(root, 'apps/web'),
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
  });
  const url = `http://127.0.0.1:${p}/`;
  for (let i = 0; i < 100; i++) {
    try {
      const r = await fetch(url);
      if (r.ok) return { child, url };
    } catch {}
    await sleep(50);
  }
  child.kill();
  throw new Error('Vite preview did not start');
}

async function loadEdit(browser, url) {
  const p = await browser.newPage();
  await p.goto(`${url}?director&edit`, { waitUntil: 'networkidle' });
  const edit = await p.evaluate(() => window.__director.edit);
  await p.close();
  return edit;
}

async function newShotPage(browser, url, shot, format, lang, conf) {
  const context = await browser.newContext({
    viewport: conf.viewport,
    deviceScaleFactor: conf.dpr,
    locale: lang === 'ru' ? 'ru-RU' : 'en-US',
  });
  await context.addInitScript(virtualClock, epoch);
  const page = await context.newPage();
  const errs = [];
  page.on('pageerror', (e) => errs.push(e.message));
  page.on('console', (m) => {
    if (m.type() === 'error') errs.push(`console: ${m.text()}`);
  });
  await page.goto(`${url}?director&shot=${shot}&format=${format === 'v30' ? 'v' : 'h'}&lang=${lang}`, {
    waitUntil: 'commit',
  });
  let ready = false;
  for (let i = 0; i < 600; i++) {
    await page.evaluate(() => window.__step?.(16));
    await sleep(20);
    ready = await page.evaluate(() => !!window.__director?.ready);
    if (ready) break;
  }
  if (!ready)
    throw new Error(
      `${shot}: director not ready: ${JSON.stringify(await page.evaluate(() => window.__director?.errors))}`,
    );
  for (let i = 0; i < 30; i++) await page.evaluate(() => window.__step(1000 / 30));
  const directorErrors = await page.evaluate(() => window.__director.errors);
  if (directorErrors.length || errs.length) throw new Error(`${shot}: ${[...directorErrors, ...errs].join('; ')}`);
  if (lang === 'en') {
    const txt = await page.evaluate(() => document.body.innerText);
    if (/[А-Яа-яЁё]/.test(txt)) throw new Error(`${shot}: Cyrillic in EN start: ${txt.match(/[А-Яа-яЁё][^\n]*/)?.[0]}`);
  }
  return { context, page, errs };
}

function pngSize(buffer) {
  if (buffer.toString('ascii', 1, 4) !== 'PNG') return null;
  return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) };
}
function checkScamFrames(shot, frames, captionLog, conf, durationBeats, lang) {
  if (!['scam-card', 'scam-pays', 'scam-collapse'].includes(shot)) return null;
  const fail = (problem) => { throw new Error(`${shot}: ${problem}`); };
  if (!frames.length) fail('no captured check frames');
  const farmPresent = (x) => x.items?.some((item) => item.uid === 'director-pearl');
  const labelCount = (x, tone, amount) => x.floats.filter(
    (f) => f.tone === tone && f.opacity >= 0.6 && f.onScreen && f.unobstructed &&
      f.text.includes(`${tone === 'neg' ? '−' : '+'}${amount}`),
  ).length;
  if (shot === 'scam-card') {
    if (frames.at(-1).zoom < 1.15 - 0.0005)
      fail(`last frame zoom ${frames.at(-1).zoom} < 1.15`);
    const clickBeat = durationBeats - 0.75;
    let ringChecked = 0;
    for (const x of frames) {
      const h = x.headline;
      if (!h || h.width <= 0 || h.height <= 0 || h.left < -0.5 || h.top < -0.5 ||
          h.right > conf.viewport.width + 0.5 || h.bottom > conf.viewport.height + 0.5)
        fail(`pearlFarm headline clipped at frame ${x.frame}: ${JSON.stringify(h)}`);
      if (x.beat >= 0.5 + 0.08 && x.beat < clickBeat - 0.08) {
        const r = x.ring;
        if (!r?.visible || !r.bounds || r.borderWidth !== '3px' ||
            r.borderColor !== 'rgb(245, 184, 61)' || r.opacity < 0.58)
          fail(`golden ring missing/incorrect at frame ${x.frame}: ${JSON.stringify(r)}`);
        if (r.bounds.left > h.left - 5 || r.bounds.right < h.right + 5 ||
            r.bounds.top > h.top - 5 || r.bounds.bottom < h.bottom + 5)
          fail(`golden ring does not track headline at frame ${x.frame}`);
        ringChecked++;
      }
    }
    if (!ringChecked) fail('golden ring interval not sampled');
    return { lastZoom: frames.at(-1).zoom, checkedHeadlineFrames: frames.length, checkedRingFrames: ringChecked };
  }
  if (frames.some((x) => !Array.isArray(x.items)))
    fail('window.__director.sceneItems() is required to verify farm state');
  if (!farmPresent(frames[0])) fail('farm missing from initial scene items');
  if (shot === 'scam-pays') {
    if (frames.some((x) => !farmPresent(x))) fail('farm disappears during paying weeks');
    const firstFrames = frames.filter((x) => x.beat >= 0.5 && x.beat < 1.9 && labelCount(x, 'pos', scamOffer.income) >= 1).length;
    const secondFrames = frames.filter((x) => x.beat >= 2 && labelCount(x, 'pos', scamOffer.income) >= 2).length;
    const first = firstFrames / conf.fps >= 0.25;
    const second = secondFrames / conf.fps >= 0.2;
    if (!first || !second) fail(`two +${scamOffer.income} labels not visible at beats 0.5 and 2.0`);
    return { farm: 'present throughout', firstIncomeSeconds: firstFrames / conf.fps,
      secondIncomeSeconds: secondFrames / conf.fps, income: scamOffer.income };
  }
  if (frames.some((x) => x.beat < 0.5 - 0.08 && !farmPresent(x)))
    fail('farm disappears before beat 0.5');
  if (frames.some((x) => x.beat >= 0.5 + 0.16 && farmPresent(x)))
    fail('farm still present after beat 0.5');
  let visibleNegFrames = 0, maxVisibleNegFrames = 0;
  for (const x of frames) {
    visibleNegFrames = labelCount(x, 'neg', scamOffer.price) ? visibleNegFrames + 1 : 0;
    maxVisibleNegFrames = Math.max(maxVisibleNegFrames, visibleNegFrames);
  }
  if (maxVisibleNegFrames / conf.fps < 1)
    fail(`−${scamOffer.price} label visible for only ${(maxVisibleNegFrames / conf.fps).toFixed(2)}s`);
  const expected = lang === 'ru' ? 'Это пирамида' : "It's a pyramid scheme";
  if (frames.some((x) => x.beat < 1.5 - 0.08 && x.second?.visible && x.second.opacity > 0.05))
    fail('second caption line appears before beat 1.5');
  const secondStart = frames.find((x) => x.second?.visible && x.second.opacity > 0.05);
  if (!secondStart || secondStart.beat < 1.5 - 0.08 || secondStart.beat > 1.5 + 0.2 ||
      secondStart.second.text !== expected)
    fail(`second caption line missing/late/wrong: ${JSON.stringify(secondStart)}`);
  if (!frames.at(-1).second?.visible) fail('second caption line does not remain through end of shot');
  const recordedHeights = captionLog.map((x) => x.height);
  if (recordedHeights.some((height) => !Number.isFinite(height) || height <= 0))
    fail('captionLog must record constant positive caption height on every frame');
  if (Math.max(...recordedHeights) - Math.min(...recordedHeights) > 0.5)
    fail(`captionLog height changes: ${Math.min(...recordedHeights)}..${Math.max(...recordedHeights)}px`);
  const reservedHeights = frames.map((x) => x.reservedHeight);
  if (reservedHeights.some((height) => !Number.isFinite(height) || height <= 0) ||
      Math.max(...reservedHeights) - Math.min(...reservedHeights) > 0.5)
    fail('two-line caption measuring box changes height during the shot');
  return {
    farm: 'present at first; gone after beat 0.5',
    lost: scamOffer.price,
    negativeLabelSeconds: maxVisibleNegFrames / conf.fps,
    secondLineStartBeat: secondStart.beat,
    captionHeight: recordedHeights[0],
  };
}
function checkTimedCues(shot, log, frameOffset) {
  const expected = {
    liability: [
      [0.5, 'coins.pay'], [2, 'coins.pay'], [3.5, 'week.next'],
      [3.75, 'coin.minus'], [4, 'coin.minus'],
    ],
    'scam-pays': [
      [0, 'week.next'], [0.5, 'coin.tick', 0],
      [1.5, 'week.next'], [2, 'coin.tick', 2],
    ],
    'scam-collapse': [[0.25, 'scam.collapse']],
  }[shot];
  if (!expected) return;
  for (const [beat, cue, pitch] of expected) {
    if (!log.some((entry) => entry.cue === cue && Math.abs((entry.t - frameOffset) / BEAT - beat) < 0.01 &&
      (pitch === undefined || entry.pitchStep === pitch)))
      throw new Error(`${shot}: missing ${cue} at ${beat} beats${pitch === undefined ? '' : ` (pitch ${pitch})`}`);
  }
  if (shot === 'liability') {
    for (const beat of [0.5, 2]) {
      for (const [delay, cue] of [[0.07, 'build.pop'], [0.16, 'status.joy']]) {
        if (!log.some((entry) => entry.cue === cue &&
          Math.abs(entry.t - frameOffset - beat * BEAT - delay) < 0.01))
          throw new Error(`${shot}: missing ${cue} at ${beat} beats + ${delay}s`);
      }
    }
  }
}
async function renderShot(
  browser,
  url,
  { shot, format, lang, conf, frames, frameDir, cacheKey, globalStart, frameOffset, durationBeats },
) {
  await mkdir(frameDir, { recursive: true });
  const donePath = resolve(frameDir, 'done.json');
  try {
    const old = JSON.parse(await readFile(donePath, 'utf8'));
    if (old.cacheKey === cacheKey && old.frames === frames) return old;
  } catch {}
  const { context, page, errs } = await newShotPage(browser, url, shot, format, lang, conf);
  await page.evaluate((offset) => {
    window.__director.frameOffset = offset;
  }, frameOffset);
  await page.evaluate(() => window.__director.start());
  let captionBounds = null;
  const subjectSamples = [];
  const scamCardChecks = [];
  const scamFrames = [];
  const freedomChecks = [];
  let neighborVisibleFrames = 0;
  let endVisibleFrames = 0;
  const subjectFrames = new Set([0, Math.floor(frames / 2), frames - 1]);
  const clickFrame = Math.max(
    0,
    Math.min(frames - 1, Math.round(((durationBeats - 0.75) * (60 / 99) + frameOffset) * conf.fps) - 1),
  );
  for (let i = 0; i < frames; i++) {
    await page.evaluate((ms) => window.__step(ms), 1000 / conf.fps);
    await page.evaluate(() => Promise.resolve());
    const captionFrame = await page.evaluate(() => window.__director.captureCaption());
    if (captionFrame.modalOverlap) throw new Error(`${shot}: caption overlaps .modal at frame ${i}`);
    if (shot === 'freedom') {
      const check = await page.evaluate(() => {
        const modal = document.querySelector('.modal.freedom-modal');
        if (!modal) return { modal: false };
        const title = modal.querySelector('h2');
        const rect = title?.getBoundingClientRect();
        const windowRect = modal.getBoundingClientRect();
        const caption = document.querySelector('.director-caption:not([data-director-measure])');
        const captionVisible = !!caption && getComputedStyle(caption).display !== 'none' &&
          getComputedStyle(caption).visibility !== 'hidden' && caption.getBoundingClientRect().width > 0;
        return {
          modal: true,
          title: title?.textContent,
          titleBounds: rect ? { left: rect.left, top: rect.top, right: rect.right, bottom: rect.bottom } : null,
          modalBounds: { left: windowRect.left, top: windowRect.top, right: windowRect.right, bottom: windowRect.bottom },
          captionVisible,
          scrollTop: modal.scrollTop,
          viewport: { width: innerWidth, height: innerHeight },
        };
      });
      freedomChecks.push({ frame: i, ...check });
      if (check.modal) {
        const t = check.titleBounds;
        const m = check.modalBounds;
        if (!t || t.left < -0.5 || t.top < -0.5 || t.right > check.viewport.width + 0.5 ||
            t.bottom > check.viewport.height + 0.5 || t.top < m.top - 0.5 || t.bottom > m.bottom + 0.5)
          throw new Error(`${shot}: modal title not fully visible at frame ${i}: ${JSON.stringify(check)}`);
        if (check.captionVisible) throw new Error(`${shot}: caption visible after modal at frame ${i}`);
      }
    }
    if (shot === 'neighbors' || shot === 'end') {
      const visible = await page.evaluate((id) => {
        const el = document.querySelector(id === 'neighbors' ? '.neighbor-card[role="dialog"]' : '.director-end-card');
        if (!el) return false;
        const s = getComputedStyle(el), r = el.getBoundingClientRect();
        return s.display !== 'none' && s.visibility !== 'hidden' && Number(s.opacity) > 0.1 &&
          r.width > 0 && r.height > 0 && r.bottom > 0 && r.top < innerHeight;
      }, shot);
      if (visible) {
        if (shot === 'neighbors') neighborVisibleFrames++;
        else endVisibleFrames++;
      }
    }
    if (i === Math.floor(frames / 2))
      captionBounds = await page.evaluate(() => {
        const r = document.querySelector('.director-caption:not([data-director-measure])')?.getBoundingClientRect();
        return r ? { x: r.x, y: r.y, width: r.width, height: r.height } : null;
      });
    if (subjectFrames.has(i)) {
      const sample = await page.evaluate(() => {
        const caption = document
          .querySelector('.director-caption:not([data-director-measure])')
          ?.getBoundingClientRect();
        return {
          subjects: window.__director.subjects(),
          caption: caption
            ? { left: caption.left, top: caption.top, right: caption.right, bottom: caption.bottom }
            : null,
        };
      });
      subjectSamples.push({ frame: i, ...sample });
    }
    if (shot === 'scam-card' || shot === 'scam-pays' || shot === 'scam-collapse') {
      const check = await page.evaluate(() => {
        const bounds = (el) => {
          const r = el?.getBoundingClientRect();
          return r ? { left: r.left, top: r.top, right: r.right, bottom: r.bottom, width: r.width, height: r.height } : null;
        };
        const visible = (el) => {
          if (!el) return false;
          const s = getComputedStyle(el), r = el.getBoundingClientRect();
          return s.display !== 'none' && s.visibility !== 'hidden' && Number(s.opacity) > 0.05 &&
            r.width > 0 && r.height > 0 && r.bottom > 0 && r.top < innerHeight &&
            r.right > 0 && r.left < innerWidth;
        };
        const headline = document.querySelector('[data-offer="pearlFarm"] h3');
        const card = document.querySelector('[data-offer="pearlFarm"]');
        const ring = document.querySelector('.director-scam-ring, [data-director-scam-ring]');
        const stage = document.querySelector('#director-stage');
        const zoom = stage ? new DOMMatrixReadOnly(getComputedStyle(stage).transform).a : null;
        const second = document.querySelector('.director-caption:not([data-director-measure]) .director-caption-second, .director-caption:not([data-director-measure]) [data-director-second-line]');
        const caption = document.querySelector('.director-caption:not([data-director-measure])');
        return {
          headline: bounds(headline),
          card: bounds(card),
          list: bounds(document.querySelector('.tab-scroll')),
          zoom,
          ring: ring ? {
            bounds: bounds(ring), visible: visible(ring),
            opacity: Number(getComputedStyle(ring).opacity),
            borderWidth: getComputedStyle(ring).borderTopWidth,
            borderColor: getComputedStyle(ring).borderTopColor,
          } : null,
          items: typeof window.__director.sceneItems === 'function' ? window.__director.sceneItems() : null,
          floats: [...document.querySelectorAll('.isl-float')].filter(visible).map((el) => {
            const inner = el.querySelector('.isl-float-inner');
            const floatBounds = bounds(inner);
            const captionBounds = bounds(caption);
            const unobstructed = !captionBounds || !floatBounds ||
              floatBounds.right <= captionBounds.left || floatBounds.left >= captionBounds.right ||
              floatBounds.bottom <= captionBounds.top || floatBounds.top >= captionBounds.bottom;
            return {
              text: el.textContent?.trim() ?? '',
              tone: el.classList.contains('neg') ? 'neg' : 'pos',
              opacity: inner ? Number(getComputedStyle(inner).opacity) : 0,
              onScreen: visible(inner),
              unobstructed,
              bounds: floatBounds,
            };
          }),
          second: second ? { text: second.textContent?.trim(), visible: visible(second), opacity: Number(getComputedStyle(second).opacity) } : null,
          captionHeight: bounds(caption)?.height ?? null,
          reservedHeight: bounds(document.querySelector('.director-caption[data-director-measure]'))?.height ?? null,
        };
      });
      const localBeat = ((i + 1) / conf.fps - frameOffset) / BEAT;
      scamFrames.push({ frame: i, beat: localBeat, ...check });
      if (shot === 'scam-card' && (i === 0 || i === clickFrame))
        scamCardChecks.push({ frame: i, card: check.card, list: check.list });
    }
    const path = resolve(frameDir, `${String(i).padStart(5, '0')}.png`);
    const image = await page.screenshot({ path, type: 'png', timeout: 0 });
    if (i === 0) {
      const size = pngSize(image);
      if (size?.width !== conf.width || size?.height !== conf.height)
        throw new Error(
          `${format} ${quality}: got ${size?.width}x${size?.height}, expected ${conf.width}x${conf.height}`,
        );
    }
  }
  if (lang === 'en') {
    const txt = await page.evaluate(() => document.body.innerText);
    if (/[А-Яа-яЁё]/.test(txt)) throw new Error(`${shot}: Cyrillic in EN end`);
  }
  const log = await page.evaluate(() => window.__director.cueLog);
  checkTimedCues(shot, log, frameOffset);
  const captionLog = await page.evaluate(() => window.__director.captionLog);
  let visibilityChanges = 0;
  for (let i = 1; i < captionLog.length; i++)
    if (captionLog[i].visible !== captionLog[i - 1].visible) visibilityChanges++;
  if (visibilityChanges > 2) throw new Error(`${shot}: caption visibility changed ${visibilityChanges} times`);
  if (shot === 'scam-collapse') {
    const visible = captionLog.map((x, i) => (x.visible ? i : -1)).filter((i) => i >= 0);
    if (!visible.length) throw new Error(`${shot}: caption never becomes visible`);
    const first = visible[0],
      last = visible.at(-1);
    for (let i = first; i <= last; i++)
      if (!captionLog[i].visible) throw new Error(`${shot}: caption visibility interrupted at frame ${i}`);
  }
  if (shot === 'freedom' && !freedomChecks.some((x) => x.modal))
    throw new Error(`${shot}: freedom modal never appears`);
  if (shot === 'freedom' && freedomChecks.filter((x) => x.modal).length / conf.fps < 2.5)
    throw new Error(`${shot}: freedom modal held under 2.5s`);
  if (shot === 'neighbors' && neighborVisibleFrames / conf.fps < 1.5)
    throw new Error(`${shot}: neighbor card held ${(neighborVisibleFrames / conf.fps).toFixed(2)}s < 1.5s`);
  if (shot === 'end' && endVisibleFrames / conf.fps < 2.8)
    throw new Error(`${shot}: end card held ${(endVisibleFrames / conf.fps).toFixed(2)}s < 2.8s`);
  for (const check of scamCardChecks) {
    if (!check.card || !check.list) throw new Error(`${shot}: pearlFarm card/list missing at frame ${check.frame}`);
    if (
      check.card.left < check.list.left - 0.5 ||
      check.card.right > check.list.right + 0.5 ||
      check.card.top < check.list.top - 0.5 ||
      check.card.bottom > check.list.bottom + 0.5
    )
      throw new Error(`${shot}: pearlFarm card outside visible list at frame ${check.frame}: ${JSON.stringify(check)}`);
  }
  const scamChecks = checkScamFrames(shot, scamFrames, captionLog, conf, durationBeats, lang);
  const dirErrors = await page.evaluate(() => window.__director.errors);
  await context.close();
  if (errs.length || dirErrors.length) throw new Error(`${shot}: ${[...errs, ...dirErrors].join('; ')}`);
  const done = {
    cacheKey,
    frames,
    globalStart,
    frameOffset,
    cueLog: log,
    captionLog,
    captionBounds,
    subjectSamples,
    scamCardChecks,
    scamChecks,
    freedomChecks,
  };
  await writeFile(donePath, JSON.stringify(done, null, 2));
  return done;
}

function encodeSegment(frameDir, out, fps, frames) {
  sh(ffmpeg, [
    '-y',
    '-v',
    'error',
    '-framerate',
    String(fps),
    '-i',
    resolve(frameDir, '%05d.png'),
    '-frames:v',
    String(frames),
    '-c:v',
    'libx264',
    '-preset',
    'slow',
    '-crf',
    quality === 'final' ? '18' : '28',
    '-profile:v',
    'high',
    '-pix_fmt',
    'yuv420p',
    '-r',
    String(fps),
    out,
  ]);
}
function probe(file) {
  return JSON.parse(sh(ffprobe, ['-v', 'error', '-show_streams', '-show_format', '-of', 'json', file]).stdout);
}
function audioStats(file) {
  const r = spawnSync(
    ffmpeg,
    ['-hide_banner', '-nostats', '-i', file, '-filter_complex', 'ebur128=peak=true', '-f', 'null', '-'],
    { encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 },
  );
  if (r.status !== 0) throw new Error(r.stderr || `ebur128 failed for ${file}`);
  const text = r.stderr;
  const Is = [...text.matchAll(/I:\s+(-?\d+(?:\.\d+)?) LUFS/g)].map((m) => Number(m[1]));
  const Ps = [...text.matchAll(/Peak:\s+(-?\d+(?:\.\d+)?) dBFS/g)].map((m) => Number(m[1]));
  return { integrated: Is.at(-1), peak: Ps.at(-1) };
}
function faststart(file) {
  const b = readFile(file);
  return b.then((x) => ({ moov: x.indexOf(Buffer.from('moov')), mdat: x.indexOf(Buffer.from('mdat')) }));
}

function compositionCheck(target, result) {
  const conf = cfg[target.format];
  const checks = [];
  const failures = [];
  if (target.format === 'v30') {
    const rightLimit = conf.viewport.width * 0.88,
      bottomLimit = conf.viewport.height * 0.8;
    for (const item of result.timeline) {
      const b = item.captionBounds;
      if (!b) continue;
      const right = b.x + b.width,
        bottom = b.y + b.height;
      checks.push({ shot: item.shot, right, bottom, rightLimit, bottomLimit });
      if (right > rightLimit + 0.5)
        failures.push(
          `${item.shot} caption enters right 12% safe zone: ${right.toFixed(1)} > ${rightLimit.toFixed(1)}`,
        );
      if (bottom > bottomLimit + 0.5)
        failures.push(
          `${item.shot} caption enters lower 20% safe zone: ${bottom.toFixed(1)} > ${bottomLimit.toFixed(1)}`,
        );
    }
  }
  const zone =
    target.format === 'v30' ? { x0: 0.08, x1: 0.88, y0: 0.3, y1: 0.78 } : { x0: 0.1, x1: 0.9, y0: 0.12, y1: 0.76 };
  const general = new Set(['hook', 'storm', 'end']);
  for (const item of result.timeline) {
    if (item.shot === 'scam-pays' || item.shot === 'scam-collapse') {
      const samples = item.subjectSamples || [];
      if (samples.length !== 3 || samples.some((sample) =>
        !(sample.subjects || []).some((subject) => /pearl|farm/i.test(subject.name))))
        failures.push(`${item.shot} has no farm projection for each first/middle/last frame`);
    }
    for (const sample of item.subjectSamples || []) {
      for (const subject of sample.subjects || []) {
        const minX = conf.viewport.width * (general.has(item.shot) ? 0.4 : zone.x0),
          maxX = conf.viewport.width * (general.has(item.shot) ? 0.6 : zone.x1);
        const minY = conf.viewport.height * (general.has(item.shot) ? 0.4 : zone.y0),
          maxY = conf.viewport.height * (general.has(item.shot) ? 0.62 : zone.y1);
        checks.push({
          shot: item.shot,
          frame: sample.frame,
          subject: subject.name,
          x: subject.x,
          y: subject.y,
          minX,
          maxX,
          minY,
          maxY,
        });
        if (subject.x < minX || subject.x > maxX || subject.y < minY || subject.y > maxY)
          failures.push(
            `${item.shot} frame ${sample.frame} ${subject.name} at ${subject.x.toFixed(1)},${subject.y.toFixed(1)} outside ${minX.toFixed(1)}..${maxX.toFixed(1)},${minY.toFixed(1)}..${maxY.toFixed(1)}`,
          );
        const c = sample.caption;
        if (
          c &&
          subject.x >= c.left - 12 &&
          subject.x <= c.right + 12 &&
          subject.y >= c.top - 12 &&
          subject.y <= c.bottom + 12
        )
          failures.push(`${item.shot} frame ${sample.frame} ${subject.name} is within 12px of caption`);
      }
    }
  }
  if (failures.length) throw new Error(`${target.format}-${target.lang} composition failed: ${failures.join('; ')}`);
  return { checkedCaptionBounds: result.timeline.filter((x) => x.captionBounds).length, checks };
}

async function validateDraftArtifacts(target, result) {
  if (quality !== 'draft' || result.partial) return;
  const videoBytes = (await stat(result.out)).size,
    sheetBytes = (await stat(result.sheet)).size;
  const failures = [];
  if (videoBytes > 5 * 1024 * 1024) failures.push(`video ${videoBytes} bytes > 5 MiB`);
  if (sheetBytes > 400 * 1024) failures.push(`sheet ${sheetBytes} bytes > 400 KiB`);
  if (failures.length)
    throw new Error(`${target.format}-${target.lang} draft artifact limits failed: ${failures.join('; ')}`);
}

function validateFinalResult(target, result) {
  if (quality !== 'final' || result.partial) return;
  const conf = cfg[target.format];
  const video = result.probe.streams.find((s) => s.codec_type === 'video');
  const audio = result.probe.streams.find((s) => s.codec_type === 'audio');
  const duration = Number(result.probe.format.duration);
  const failures = [];
  if (video?.codec_name !== 'h264' || video?.profile !== 'High')
    failures.push(`video codec/profile ${video?.codec_name}/${video?.profile}`);
  if (video?.width !== conf.width || video?.height !== conf.height)
    failures.push(`size ${video?.width}x${video?.height}`);
  if (video?.pix_fmt !== 'yuv420p') failures.push(`pix_fmt ${video?.pix_fmt}`);
  if (video?.r_frame_rate !== '30/1') failures.push(`fps ${video?.r_frame_rate}`);
  if (!Number.isFinite(duration) || Math.abs(duration - conf.duration) > 0.04) failures.push(`duration ${duration}`);
  if (audio?.codec_name !== 'aac' || audio?.sample_rate !== '48000' || audio?.channels !== 2)
    failures.push(`audio ${audio?.codec_name}/${audio?.sample_rate}/${audio?.channels}`);
  if (!Number.isFinite(result.audio.integrated) || Math.abs(result.audio.integrated + 14) > 1)
    failures.push(`loudness ${result.audio.integrated}`);
  if (!Number.isFinite(result.audio.peak) || result.audio.peak > -1) failures.push(`true peak ${result.audio.peak}`);
  if (result.faststart.moov < 0 || result.faststart.mdat < 0 || result.faststart.moov >= result.faststart.mdat)
    failures.push(`faststart moov=${result.faststart.moov} mdat=${result.faststart.mdat}`);
  if (failures.length)
    throw new Error(`${target.format}-${target.lang} final acceptance failed: ${failures.join('; ')}`);
}

async function renderTarget(browser, url, edit, sourceHash, target) {
  const conf = cfg[target.format];
  const key = target.format;
  const montage = edit[key];
  const montageHash = createHash('sha256').update(JSON.stringify(montage)).digest('hex');
  const selected = shotArg ? new Set(shotArg.split(',')) : null;
  const work = resolve(root, `.trailer/frames/${quality}/${key}-${target.lang}`);
  const segDir = resolve(root, `.trailer/segments/${quality}/${key}-${target.lang}`);
  await mkdir(segDir, { recursive: true });
  let cues = [];
  let timeline = [];
  let selectedCount = 0;
  for (let si = 0; si < montage.shots.length; si++) {
    const [shot, b0, b1] = montage.shots[si];
    if (selected && !selected.has(shot)) continue;
    selectedCount++;
    const start = Math.round(b0 * (60 / 99) * conf.fps);
    const end = Math.round(b1 * (60 / 99) * conf.fps);
    const expected = expectedMontage[key].shots[si];
    if (JSON.stringify([shot, b0, b1]) !== JSON.stringify(expected))
      throw new Error(`${key} timeline differs at shot ${si}`);
    const frames = end - start;
    const frameOffset = b0 * (60 / 99) - start / conf.fps;
    const frameDir = resolve(work, shot);
    const cacheKey = createHash('sha256')
      .update(
        JSON.stringify({ shot, b0, b1, montageHash, quality, lang: target.lang, format: key, sourceHash, frameOffset, checkVersion }),
      )
      .digest('hex');
    const done = await renderShot(browser, url, {
      shot,
      format: key,
      lang: target.lang,
      conf,
      frames,
      frameDir,
      cacheKey,
      globalStart: start,
      frameOffset,
      durationBeats: b1 - b0,
    });
    for (const c of done.cueLog || []) cues.push({ ...c, t: (c.t ?? 0) + start / conf.fps });
    if (shot === 'storm') cues.push({ t: end / conf.fps, weather: 'clear' });
    const segment = resolve(segDir, `${String(si).padStart(2, '0')}-${shot}.mp4`);
    encodeSegment(frameDir, segment, conf.fps, frames);
    timeline.push({
      shot,
      b0,
      b1,
      start,
      end: end - 1,
      frames,
      segment,
      captionLog: done.captionLog,
      captionBounds: done.captionBounds,
      subjectSamples: done.subjectSamples,
      scamCardChecks: done.scamCardChecks,
      scamChecks: done.scamChecks,
      freedomChecks: done.freedomChecks,
    });
  }
  if (selected) return { partial: true, timeline, cues };
  if (selectedCount !== montage.shots.length) throw new Error('Incomplete montage');
  const concat = resolve(segDir, 'concat.txt');
  await writeFile(concat, timeline.map((x) => `file '${x.segment.replaceAll("'", "'\\''")}'`).join('\n'));
  const silent = resolve(segDir, 'video.mp4');
  sh(ffmpeg, ['-y', '-v', 'error', '-f', 'concat', '-safe', '0', '-i', concat, '-c', 'copy', silent]);
  const cuePath = resolve(segDir, 'cue-log.json');
  await writeFile(cuePath, JSON.stringify(cues, null, 2));
  const audio = resolve(segDir, 'audio.wav');
  const trackDir = resolve(root, `.trailer/audio/${key}-${target.lang}`);
  await renderAudio({
    url,
    cueLog: cues,
    duration: conf.duration,
    output: audio,
    tempDir: resolve(root, '.trailer/audio/cues'),
    trackDir,
    channel,
  });
  const outDir = resolve(root, `.trailer/out/${quality}`);
  await mkdir(outDir, { recursive: true });
  const out = resolve(outDir, `archipelago-${key}-${target.lang}.mp4`);
  sh(ffmpeg, [
    '-y',
    '-v',
    'error',
    '-i',
    silent,
    '-i',
    audio,
    '-c:v',
    'copy',
    '-c:a',
    'aac',
    '-b:a',
    '192k',
    '-ar',
    '48000',
    '-ac',
    '2',
    '-t',
    String(conf.duration),
    '-movflags',
    '+faststart',
    out,
  ]);
  const endShot = montage.shots.find((x) => x[0] === 'end');
  const coverTime = endShot[1] * (60 / 99) + 3 * (60 / 99);
  const cover = resolve(outDir, `cover-${key}-${target.lang}.jpg`);
  sh(ffmpeg, ['-y', '-v', 'error', '-ss', String(coverTime), '-i', out, '-frames:v', '1', '-q:v', '2', cover]);
  const sheet = resolve(outDir, `sheet-${key}-${target.lang}.jpg`);
  const cols = 10,
    rows = Math.ceil(montage.totalBeats / cols);
  sh(ffmpeg, [
    '-y',
    '-v',
    'error',
    '-i',
    out,
    '-vf',
    `fps=99/60,scale=${conf.sheetWidth}:-2,tile=${cols}x${rows}`,
    '-frames:v',
    '1',
    '-q:v',
    '18',
    sheet,
  ]);
  return {
    out,
    cover,
    sheet,
    timeline,
    cues,
    probe: probe(out),
    audio: audioStats(out),
    faststart: await faststart(out),
  };
}

function timelineMarkdown(results, edit) {
  let md = '# Trailer timeline\n\nBeat: `60/99 = 0.6060606061 s`. Cuts are `round(beat × B × fps)`.\n\n';
  for (const [name, r] of Object.entries(results)) {
    const lang = name.endsWith('-en') ? 'en' : 'ru';
    md += `## ${name}\n\n| Shot | Beats | Seconds | Frames | Frame range | Caption | Sound / weather |\n|---|---:|---:|---:|---:|---|---|\n`;
    for (const x of r.timeline) {
      const from = (x.b0 * 60) / 99,
        to = (x.b1 * 60) / 99;
      const caption = (edit.shotSpecs?.[x.shot]?.caption?.[lang] ?? '—').replaceAll('|', '\\|');
      const sounds =
        (r.cues ?? [])
          .filter((c) => (c.t ?? 0) >= from && (c.t ?? 0) < to)
          .map((c) => c.cue ?? `weather:${c.weather}`)
          .join(', ') || '—';
      md += `| ${x.shot} | ${x.b0}–${x.b1} | ${from.toFixed(3)}–${to.toFixed(3)} | ${x.frames} | ${x.start}–${x.end} | ${caption} | ${sounds} |\n`;
    }
    md += '\n';
  }
  return md;
}

async function deterministicProbe(browser, url, edit, sourceHash) {
  const conf = { ...cfg.v30, dpr: 3, fps: 30, width: 1080, height: 1920 };
  const asset = edit.v30.shots.find(([shot]) => shot === 'asset');
  if (!asset) throw new Error('asset shot missing from edit');
  const [, b0, b1] = asset;
  const start = Math.round(b0 * (60 / 99) * conf.fps);
  const end = Math.round(b1 * (60 / 99) * conf.fps);
  const frames = end - start;
  const dirs = [];
  const frameOffset = b0 * (60 / 99) - start / conf.fps;
  for (let run = 0; run < 2; run++) {
    const frameDir = resolve(root, `.trailer/probe/asset-${run}`);
    const cacheKey = createHash('sha256')
      .update(JSON.stringify({ probe: 'asset', run, sourceHash, frames, quality: 'final', frameOffset }))
      .digest('hex');
    await renderShot(browser, url, {
      shot: 'asset',
      format: 'v30',
      lang: 'ru',
      conf,
      frames,
      frameDir,
      cacheKey,
      globalStart: start,
      frameOffset,
    });
    dirs.push(frameDir);
  }
  const r = sh(ffmpeg, [
    '-v',
    'info',
    '-framerate',
    '30',
    '-i',
    resolve(dirs[0], '%05d.png'),
    '-framerate',
    '30',
    '-i',
    resolve(dirs[1], '%05d.png'),
    '-lavfi',
    'psnr=stats_file=-',
    '-f',
    'null',
    '-',
  ]);
  const values = [...(r.stdout || '').matchAll(/psnr_avg:([\d.]+|inf)/g)].map((m) =>
    m[1] === 'inf' ? Infinity : Number(m[1]),
  );
  if (values.length !== frames) throw new Error(`asset deterministic PSNR reported ${values.length}/${frames} frames`);
  const finite = values.filter(Number.isFinite);
  const min = finite.length ? Math.min(...finite) : Infinity;
  const summary = (r.stderr || '').match(/average:([\d.]+|inf)/);
  const average = !summary ? null : summary[1] === 'inf' ? Infinity : Number(summary[1]);
  if (min < 50) throw new Error(`asset deterministic per-frame PSNR ${min} dB < 50 dB`);
  return { average, min, frames };
}

async function main() {
  const beats = measureBeats();
  if (Math.abs(beats.bpm - 99) > 0.05 || Math.abs(beats.firstBeat - 0.023) > 0.02)
    throw new Error(`Music grid mismatch: ${JSON.stringify(beats)}`);
  const preview = await startPreview();
  const browser = await chromium.launch({ headless: true, ...(channel ? { channel } : {}) });
  try {
    const edit = await loadEdit(browser, preview.url);
    validateMontage(edit);
    const sourceHash = await hashTree(resolve(root, 'apps/web/src'));
    const results = {};
    const composition = {};
    for (const target of targets) {
      console.log(`Render ${quality} ${target.format}-${target.lang}…`);
      const result = await renderTarget(browser, preview.url, edit, sourceHash, target);
      validateFinalResult(target, result);
      await validateDraftArtifacts(target, result);
      composition[`${target.format}-${target.lang}`] = compositionCheck(target, result);
      results[`${target.format}-${target.lang}`] = result;
      console.log(`Done ${target.format}-${target.lang}`);
    }
    if (!shotArg) {
      const outDir = resolve(root, `.trailer/out/${quality}`);
      const timeline = timelineMarkdown(results, edit);
      await writeFile(resolve(outDir, 'timeline.md'), timeline);
      if (quality === 'draft') {
        const qa = resolve(root, 'docs/qa/trailer/draft');
        await mkdir(qa, { recursive: true });
        for (const r of Object.values(results)) {
          for (const file of [r.out, r.sheet]) await copyFile(file, resolve(qa, file.split(/[\\/]/).at(-1)));
        }
        await writeFile(resolve(qa, 'timeline.md'), timeline);
      }
      const psnr = quality === 'final' ? await deterministicProbe(browser, preview.url, edit, sourceHash) : null;
      const summary = {
        quality,
        sourceHash,
        beats,
        renderer: await browser.newPage().then(async (p) => {
          await p.goto(preview.url);
          const x = await p.evaluate(() => {
            const c = document.createElement('canvas'),
              g = c.getContext('webgl');
            const e = g?.getExtension('WEBGL_debug_renderer_info');
            return e && g ? g.getParameter(e.UNMASKED_RENDERER_WEBGL) : g?.getParameter(g.RENDERER);
          });
          await p.close();
          return x;
        }),
        psnr,
        composition,
        results: Object.fromEntries(
          Object.entries(results).map(([k, r]) => [
            k,
            { file: r.out, probe: r.probe, audio: r.audio, faststart: r.faststart, timeline: r.timeline },
          ]),
        ),
      };
      await writeFile(resolve(outDir, 'render-report.json'), JSON.stringify(summary, null, 2));
      console.log(JSON.stringify(summary, null, 2));
    }
  } finally {
    await browser.close();
    preview.child.kill();
  }
}

await main();
