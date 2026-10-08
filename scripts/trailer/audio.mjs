import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { copyFile, mkdir, readFile, unlink, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const require = createRequire(import.meta.url);
const ffmpeg = process.env.FFMPEG_PATH || require('ffmpeg-static') || 'ffmpeg';
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');

function run(args, options = {}) {
  const result = spawnSync(ffmpeg, args, { encoding: options.encoding ?? null, maxBuffer: 128 * 1024 * 1024 });
  if (result.status !== 0) throw new Error(Buffer.isBuffer(result.stderr) ? result.stderr.toString() : result.stderr);
  return result;
}

function wavFloat32(left, right, rate = 48000) {
  const frames = Math.min(left.length, right.length);
  const buffer = Buffer.alloc(44 + frames * 8);
  buffer.write('RIFF', 0);
  buffer.writeUInt32LE(36 + frames * 8, 4);
  buffer.write('WAVEfmt ', 8);
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(3, 20);
  buffer.writeUInt16LE(2, 22);
  buffer.writeUInt32LE(rate, 24);
  buffer.writeUInt32LE(rate * 8, 28);
  buffer.writeUInt16LE(8, 32);
  buffer.writeUInt16LE(32, 34);
  buffer.write('data', 36);
  buffer.writeUInt32LE(frames * 8, 40);
  for (let i = 0; i < frames; i++) {
    buffer.writeFloatLE(left[i] ?? 0, 44 + i * 8);
    buffer.writeFloatLE(right[i] ?? 0, 48 + i * 8);
  }
  return buffer;
}

async function renderSynthFiles(url, entries, tempDir, channel = process.platform === 'win32' ? 'msedge' : undefined) {
  await mkdir(tempDir, { recursive: true });
  const browser = await chromium.launch({ headless: true, ...(channel ? { channel } : {}) });
  const page = await browser.newPage();
  await page.addInitScript(() => {
    let a = 12345;
    Math.random = () => {
      a |= 0;
      a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  });
  await page.goto(`${url}?director&audio`, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => window.__director?.ready && window.__director?.renderCue);
  const unique = new Map();
  for (const entry of entries) unique.set(`${entry.cue}:${entry.pitchStep ?? 0}:${entry.variant ?? 0}`, entry);
  const files = new Map();
  for (const [key, entry] of unique) {
    const data = await page.evaluate(
      async ({ cue, pitchStep, variant }) => window.__director.renderCue(cue, pitchStep, variant),
      entry,
    );
    const path = resolve(tempDir, `${key.replaceAll(':', '-').replaceAll('.', '-')}.wav`);
    await writeFile(path, wavFloat32(data[0], data[1]));
    files.set(key, path);
  }
  await browser.close();
  return files;
}

function makeMusic(duration, duckTimes, output) {
  const music = resolve(root, 'apps/web/public/audio/music/island-ukulele.mp3');
  const fade = Math.max(0, duration - (2.5 * 60) / 99);
  const filters = [`atrim=start=0.023:end=${duration + 0.023}`, 'asetpts=PTS-STARTPTS'];
  for (const at of duckTimes) {
    const a = at,
      down = Math.min(duration, a + 0.15),
      up0 = Math.min(duration, a + 2.85),
      up1 = Math.min(duration, a + 3);
    const floor = 0.398107;
    filters.push(
      `volume='if(lt(t,${a.toFixed(6)}),1,if(lt(t,${down.toFixed(6)}),1-(1-${floor})*(t-${a.toFixed(6)})/.15,if(lt(t,${up0.toFixed(6)}),${floor},if(lt(t,${up1.toFixed(6)}),${floor}+(1-${floor})*(t-${up0.toFixed(6)})/.15,1))))':eval=frame`,
    );
  }
  filters.push(`afade=t=out:st=${fade}:d=${duration - fade}`, 'loudnorm=I=-20:TP=-3:LRA=11');
  run([
    '-y',
    '-v',
    'error',
    '-stream_loop',
    '-1',
    '-i',
    music,
    '-af',
    filters.join(','),
    '-ar',
    '48000',
    '-ac',
    '2',
    '-c:a',
    'pcm_s16le',
    output,
  ]);
}

function maxShortTerm(file) {
  const result = spawnSync(
    ffmpeg,
    [
      '-hide_banner',
      '-nostats',
      '-loglevel',
      'verbose',
      '-i',
      file,
      '-filter_complex',
      'ebur128=peak=true',
      '-f',
      'null',
      '-',
    ],
    { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 },
  );
  if (result.status !== 0) throw new Error(result.stderr || 'ebur128 failed');
  const values = [...(result.stderr ?? '').matchAll(/\bS:\s+(-?\d+(?:\.\d+)?)/g)]
    .map((match) => Number(match[1]))
    .filter(Number.isFinite);
  return values.length ? Math.max(...values) : null;
}

function makeEffects(entries, files, duration, output) {
  if (!entries.length) {
    run([
      '-y',
      '-v',
      'error',
      '-f',
      'lavfi',
      '-i',
      'anullsrc=r=48000:cl=stereo',
      '-t',
      String(duration),
      '-c:a',
      'pcm_s16le',
      output,
    ]);
    return;
  }
  const args = ['-y', '-v', 'error'];
  const filters = [];
  const mix = [];
  let index = 0;
  for (const entry of entries) {
    const key = `${entry.cue}:${entry.pitchStep ?? 0}:${entry.variant ?? 0}`;
    args.push('-i', files.get(key));
    const delay = Math.max(0, Math.round(entry.t * 1000));
    filters.push(`[${index}:a]adelay=${delay}|${delay},apad,atrim=0:${duration}[e${index}]`);
    mix.push(`[e${index}]`);
    index++;
  }
  const raw = `${output}.raw.wav`;
  filters.push(`${mix.join('')}amix=inputs=${mix.length}:normalize=0,atrim=0:${duration}[out]`);
  args.push(
    '-filter_complex',
    filters.join(';'),
    '-map',
    '[out]',
    '-ar',
    '48000',
    '-ac',
    '2',
    '-c:a',
    'pcm_f32le',
    raw,
  );
  run(args);
  const loudest = maxShortTerm(raw);
  const gain = loudest === null ? 0 : -14 - loudest;
  run([
    '-y',
    '-v',
    'error',
    '-i',
    raw,
    '-af',
    `volume=${gain.toFixed(3)}dB`,
    '-ar',
    '48000',
    '-ac',
    '2',
    '-c:a',
    'pcm_f32le',
    output,
  ]);
  void unlink(raw).catch(() => {});
}

function stormWindows(cueLog, duration) {
  const out = [];
  let start = null;
  for (const entry of cueLog.filter((x) => x.weather).sort((a, b) => a.t - b.t)) {
    if (entry.weather === 'storm' && start === null) start = entry.t;
    if (entry.weather === 'clear' && start !== null) {
      out.push([start, Math.min(duration, entry.t)]);
      start = null;
    }
  }
  if (start !== null) out.push([start, duration]);
  return out;
}

function makeNature(files, cueLog, duration, output) {
  const sea = files.get('amb.sea:0:0'),
    wind = files.get('amb.wind:0:0');
  const rain = resolve(root, 'apps/web/public/audio/ambience/amb-rain.mp3');
  const thunder = resolve(root, 'apps/web/public/audio/ambience/amb-thunder.mp3');
  const windows = stormWindows(cueLog, duration);
  const args = ['-y', '-v', 'error', '-stream_loop', '-1', '-i', sea, '-stream_loop', '-1', '-i', wind];
  const filters = [`[0:a]atrim=0:${duration},asetpts=PTS-STARTPTS[sea]`];
  const windFilters = ['atrim=0:' + duration, 'asetpts=PTS-STARTPTS'];
  for (const [start, end] of windows) {
    const len = end - start,
      ramp = Math.min(0.3, len / 2),
      inEnd = start + ramp,
      outStart = end - ramp;
    windFilters.push(
      `volume='if(lt(t,${start.toFixed(6)}),1,if(lt(t,${inEnd.toFixed(6)}),1+1.4*(t-${start.toFixed(6)})/${ramp.toFixed(6)},if(lt(t,${outStart.toFixed(6)}),2.4,if(lt(t,${end.toFixed(6)}),2.4-1.4*(t-${outStart.toFixed(6)})/${ramp.toFixed(6)},1))))':eval=frame`,
    );
  }
  filters.push(`[1:a]${windFilters.join(',')}[wind]`);
  const mix = ['[sea]', '[wind]'];
  let input = 2;
  let label = 0;
  let thunderSeed = 12345;
  const random = () => {
    thunderSeed |= 0;
    thunderSeed = (thunderSeed + 0x6d2b79f5) | 0;
    let t = Math.imul(thunderSeed ^ (thunderSeed >>> 15), 1 | thunderSeed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  for (const [start, end] of windows) {
    const len = Math.max(0.01, end - start);
    const delay = Math.round(start * 1000);
    const fade = Math.min(0.3, len / 2);
    args.push('-stream_loop', '-1', '-i', rain);
    filters.push(
      `[${input}:a]atrim=0:${len},asetpts=PTS-STARTPTS,volume=.45,afade=t=in:st=0:d=${fade},afade=t=out:st=${Math.max(0, len - fade)}:d=${fade},adelay=${delay}|${delay},apad,atrim=0:${duration}[rain${label}]`,
    );
    mix.push(`[rain${label}]`);
    input++;
    label++;
    for (let at = start + 3 + random() * 3; at < end; at += 3 + random() * 3) {
      args.push('-i', thunder);
      const td = Math.round(at * 1000);
      filters.push(`[${input}:a]volume=.65,adelay=${td}|${td},apad,atrim=0:${duration}[th${label}]`);
      mix.push(`[th${label}]`);
      input++;
      label++;
    }
  }
  filters.push(
    `${mix.join('')}amix=inputs=${mix.length}:normalize=0,atrim=0:${duration},loudnorm=I=-32:TP=-8:LRA=11[out]`,
  );
  args.push(
    '-filter_complex',
    filters.join(';'),
    '-map',
    '[out]',
    '-ar',
    '48000',
    '-ac',
    '2',
    '-c:a',
    'pcm_s16le',
    output,
  );
  run(args);
}

function twoPassLoudnorm(input, output) {
  const first = run(
    [
      '-hide_banner',
      '-nostats',
      '-i',
      input,
      '-af',
      'loudnorm=I=-14:TP=-1.5:LRA=11:print_format=json',
      '-f',
      'null',
      '-',
    ],
    { encoding: 'utf8' },
  );
  const stderr = first.stderr ?? '';
  const blocks = [...stderr.matchAll(/\{\s*"input_i"[\s\S]*?\}/g)];
  if (!blocks.length) throw new Error('loudnorm measurement JSON missing');
  const measured = JSON.parse(blocks.at(-1)[0]);
  const filter = `loudnorm=I=-14:TP=-1.5:LRA=11:measured_I=${measured.input_i}:measured_TP=${measured.input_tp}:measured_LRA=${measured.input_lra}:measured_thresh=${measured.input_thresh}:offset=${measured.target_offset}:linear=true:print_format=summary`;
  run(['-y', '-v', 'error', '-i', input, '-af', filter, '-ar', '48000', '-ac', '2', '-c:a', 'pcm_s16le', output]);
}

export async function renderAudio({
  url,
  cueLog,
  duration,
  output,
  tempDir,
  trackDir = resolve(dirname(output), 'tracks'),
  channel,
}) {
  await mkdir(trackDir, { recursive: true });
  const effects = cueLog.filter((x) => x.cue);
  const synthEntries = [...effects, { cue: 'amb.sea' }, { cue: 'amb.wind' }];
  const files = await renderSynthFiles(url, synthEntries, tempDir, channel);
  const music = resolve(trackDir, 'music.wav'),
    nature = resolve(trackDir, 'nature.wav'),
    effect = resolve(trackDir, 'effects.wav'),
    premix = resolve(trackDir, 'premix.wav');
  const duckTimes = effects.filter((x) => x.cue === 'freedom' || x.cue === 'dream.launch').map((x) => x.t);
  makeMusic(duration, duckTimes, music);
  makeEffects(effects, files, duration, effect);
  makeNature(files, cueLog, duration, nature);
  run([
    '-y',
    '-v',
    'error',
    '-i',
    music,
    '-i',
    nature,
    '-i',
    effect,
    '-filter_complex',
    `[0:a][1:a][2:a]amix=inputs=3:normalize=0,atrim=0:${duration}[mix]`,
    '-map',
    '[mix]',
    '-ar',
    '48000',
    '-ac',
    '2',
    '-c:a',
    'pcm_f32le',
    premix,
  ]);
  twoPassLoudnorm(premix, output);
  await copyFile(output, resolve(trackDir, 'final.wav'));
  return output;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const cuePath = process.argv[2],
    duration = Number(process.argv[3]),
    output = process.argv[4],
    url = process.argv[5] || 'http://127.0.0.1:4190/';
  if (!cuePath || !duration || !output) throw new Error('audio.mjs cue-log.json duration output.wav [url]');
  const log = JSON.parse(await readFile(cuePath, 'utf8'));
  await renderAudio({
    url,
    cueLog: log,
    duration,
    output: resolve(output),
    tempDir: resolve(root, '.trailer/audio/cues'),
  });
}
