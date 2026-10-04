// node --import tsx scripts/check-sound-files.mjs [output.json]
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

let now = 0, nextTimer = 0, rejectMedia = false, failMediaSource = false, failBufferStart = false;
let deferNextMedia = false, rejectPendingMedia, deferNextResume = false, releaseResume;
const timers = new Map(), events = new Map(), contexts = [], mediaElements = [], fetches = [], responses = new Map();
globalThis.setTimeout = (fn, delay = 0) => {
  const id = ++nextTimer; timers.set(id, { at: now + delay, fn }); return id;
};
globalThis.clearTimeout = (id) => timers.delete(id);
globalThis.performance = { now: () => now };
Math.random = () => 0.5;
console.debug = () => {};
globalThis.document = { hidden: false, addEventListener: (type, fn) => events.set(type, fn) };
const storedSettings = new Map([['archipelago.audio.debug', '1']]);
globalThis.localStorage = { getItem: (key) => storedSettings.get(key) ?? null, setItem: (key, value) => storedSettings.set(key, value) };
globalThis.fetch = async (file) => {
  fetches.push(file);
  return { ok: true, arrayBuffer: async () => responses.get(file) ?? { duration: 0.2 } };
};
class Param {
  value = 1;
  setValueAtTime(value) { this.value = value; return this; }
  linearRampToValueAtTime() { return this; }
  exponentialRampToValueAtTime() { return this; }
  cancelScheduledValues() { return this; }
  cancelAndHoldAtTime() { return this; }
}
class Node {
  disconnected = false; starts = []; stops = []; connections = [];
  constructor(type) {
    this.type = type;
    for (const key of ['gain', 'frequency', 'Q', 'playbackRate', 'threshold', 'knee', 'ratio', 'attack', 'release']) this[key] = new Param();
  }
  connect(destination) { this.connections.push(destination); }
  disconnect() { this.disconnected = true; this.connections = []; }
  start(time = now / 1000) {
    if (failBufferStart && this.buffer?.file) throw new Error('Decoded file source failed at runtime');
    this.starts.push(time);
  }
  stop(time = now / 1000) { this.stops.push(time); }
}
class Context {
  state = 'running'; sampleRate = 24000; nodes = []; destination = new Node('destination'); decodeCalls = 0;
  constructor() { contexts.push(this); }
  get currentTime() { return now / 1000; }
  node(type) { const node = new Node(type); this.nodes.push(node); return node; }
  createGain() { return this.node('gain'); }
  createOscillator() { return this.node('oscillator'); }
  createBufferSource() { return this.node('buffer-source'); }
  createBiquadFilter() { return this.node('filter'); }
  createDynamicsCompressor() { return this.node('compressor'); }
  createBuffer(_, length) { const data = new Float32Array(length); return { getChannelData: () => data }; }
  createMediaElementSource(media) {
    if (failMediaSource) throw new Error('Media source construction failed');
    return media.node = this.node('media-source');
  }
  async decodeAudioData(data) {
    this.decodeCalls++;
    if (data.fail) throw new Error('Decode failed');
    return { duration: data.duration, file: data.url || true };
  }
  resume() {
    if (deferNextResume) { deferNextResume = false; return new Promise((resolve) => { releaseResume = resolve; }); }
    this.state = 'running'; return Promise.resolve();
  }
  suspend() { this.state = 'suspended'; return Promise.resolve(); }
}
class Media {
  pauses = 0; loads = 0; removedSource = false; paused = true; plays = 0;
  constructor() { mediaElements.push(this); }
  play() {
    this.plays++;
    if (rejectMedia) return Promise.reject(new Error('Unavailable file'));
    this.paused = false;
    if (deferNextMedia) {
      deferNextMedia = false;
      return new Promise((_, reject) => { rejectPendingMedia = reject; });
    }
    return Promise.resolve();
  }
  pause() { this.pauses++; this.paused = true; }
  removeAttribute(name) { if (name === 'src') { this.src = ''; this.removedSource = true; } }
  load() { this.loads++; }
}
globalThis.Audio = Media;
globalThis.window = { AudioContext: Context, addEventListener() {} };
const flush = async () => { for (let i = 0; i < 12; i++) await Promise.resolve(); };
async function advance(milliseconds) {
  const target = now + milliseconds;
  for (;;) {
    const due = [...timers].filter(([, timer]) => timer.at <= target).sort((a, b) => a[1].at - b[1].at)[0];
    if (!due) break;
    now = due[1].at; timers.delete(due[0]); due[1].fn(); await flush();
  }
  now = target; await flush();
}
const evidence = { runner: 'Actual engine modules through tsx, controlled AudioContext, decoded files, HTMLAudioElement and timers', checks: [] };
const reportPath = resolve(process.argv[2] ?? 'node_modules/.cache/sound-files/integration-checks.json');
const record = (name, details = {}) => evidence.checks.push({ name, passed: true, ...details });
let audio;
try {
  const { CUES, CUE_IDS } = await import(pathToFileURL(resolve('apps/web/src/audio/cues.ts')).href);
  for (const cue of CUE_IDS) delete CUES[cue].files;
  CUES['ui.click'].files = ['/qa/click.mp3'];
  CUES['amb.sea'].files = ['/qa/sea.mp3'];
  CUES['music.island'].files = ['/qa/island-a.mp3', '/qa/island-b.mp3'];
  CUES['music.free'].files = ['/qa/free.mp3'];
  CUES['music.epilogue'].files = ['/qa/epilogue.mp3'];
  const { getCueSource, getAudioSettings, updateCueSource, updateAudioSettings, AUDIO_SETTINGS_KEY } = await import(pathToFileURL(resolve('apps/web/src/audio/settings.ts')).href);
  const ownerRecordings = new Set(['ui.error', 'amb.rain', 'amb.thunder', 'music.island', 'music.free']);
  for (const cue of CUE_IDS) assert.equal(getCueSource(cue), ownerRecordings.has(cue) ? 'file' : 'synth');
  record('Defaults match all 42 owner selections: five recordings and 37 synthesized sounds');
  updateCueSource('ui.click', 'file'); updateCueSource('music.epilogue', 'file');
  updateAudioSettings({ sources: {} });
  for (const cue of CUE_IDS) assert.equal(getCueSource(cue), ownerRecordings.has(cue) ? 'file' : 'synth');
  record('Resetting personal choices restores the exact owner-selected default profile');
  responses.set('/qa/sea.mp3', { duration: 45 });
  let releaseClick;
  responses.set('/qa/click.mp3', new Promise((resolve) => { releaseClick = resolve; }));
  ({ audio } = await import(pathToFileURL(resolve('apps/web/src/audio/engine.ts')).href));
  audio.setScene('island');
  assert.equal(contexts.length, 0); assert.equal(mediaElements.length, 0); assert.equal(fetches.length, 0);
  record('Before first gesture: no context, media element or file request');

  audio.unlock(); await flush(); audio.stop(); window.__audioLog = [];
  assert.equal(fetches.includes('/qa/click.mp3'), false);
  assert.equal(await audio.audition('ui.click'), true);
  assert.equal(window.__audioLog.at(-1).source, 'synth');
  assert.equal(fetches.includes('/qa/click.mp3'), false);
  record('Selected synth effect neither preloads nor fetches its recording');
  audio.stop(); window.__audioLog = [];
  const audition = audio.audition('ui.click', { source: 'file' }); await flush();
  assert.equal(window.__audioLog.length, 0);
  releaseClick({ duration: 0.2 }); assert.equal(await audition, true);
  assert.equal(window.__audioLog.at(-1).source, 'file');
  assert.equal(fetches.filter((url) => url === '/qa/click.mp3').length, 1);
  assert.equal(getCueSource('ui.click'), 'synth');
  record('Explicit recording audition waits for decode and leaves the game choice unchanged', { fetchCount: 1 });

  const reset = () => { audio.stop(); window.__audioLog = []; rejectMedia = failMediaSource = failBufferStart = false; };
  reset(); updateCueSource('ui.click', 'file'); assert.equal(audio.play('ui.click'), true);
  assert.equal(window.__audioLog.at(-1).source, 'file');
  assert.equal(JSON.parse(storedSettings.get(AUDIO_SETTINGS_KEY)).sources['ui.click'], 'file');
  reset(); updateCueSource('ui.click', 'synth'); assert.equal(audio.play('ui.click'), true);
  assert.equal(window.__audioLog.at(-1).source, 'synth');
  record('Saved per-effect source controls normal game playback in both directions');

  reset(); updateCueSource('epilogue', 'synth');
  assert.equal(getCueSource('music.epilogue'), 'synth');
  audio.play('epilogue'); await flush();
  assert.deepEqual(window.__audioLog.map((entry) => [entry.cue, entry.source]), [['music.epilogue', 'synth'], ['epilogue', 'synth']]);
  updateCueSource('music.epilogue', 'file'); assert.equal(getCueSource('epilogue'), 'file');
  assert.equal(getAudioSettings().enabled, true);
  record('Epilogue event and theme share one saved choice and report their actual source');

  reset(); CUES['ui.toggle'].files = ['/qa/toggle-a.mp3', '/qa/toggle-b.mp3'];
  responses.set('/qa/toggle-a.mp3', { duration: 0.1, url: '/qa/toggle-a.mp3' });
  responses.set('/qa/toggle-b.mp3', { duration: 0.4, url: '/qa/toggle-b.mp3' });
  assert.equal(await audio.audition('ui.toggle', { variant: 1, source: 'file' }), true);
  assert.equal(contexts[0].nodes.findLast((node) => node.type === 'buffer-source').buffer.file, '/qa/toggle-b.mp3');
  record('Explicit second catalogue effect variant uses the selected decoded URL');

  reset(); CUES['ui.open'].files = ['/qa/late.mp3'];
  let releaseLate; responses.set('/qa/late.mp3', new Promise((resolve) => { releaseLate = resolve; }));
  const cancelled = audio.audition('ui.open', { source: 'file' }); await flush(); audio.stop(); releaseLate({ duration: 0.3 });
  assert.equal(await cancelled, false); assert.equal(window.__audioLog.length, 0);
  record('Stop invalidates a pending catalogue decode');

  reset(); CUES['ui.open'].files = ['/qa/superseded.mp3'];
  let releaseSuperseded; responses.set('/qa/superseded.mp3', new Promise((resolve) => { releaseSuperseded = resolve; }));
  const superseded = audio.audition('ui.open', { source: 'file' }); await flush();
  assert.equal(await audio.audition('music.island', { source: 'synth' }), true);
  const replacingSample = audio.voices.find((voice) => voice.role === 'sample');
  releaseSuperseded({ duration: 0.3 }); assert.equal(await superseded, false);
  assert.equal(audio.voices.find((voice) => voice.role === 'sample'), replacingSample);
  assert.equal(window.__audioLog.some((entry) => entry.cue === 'ui.open'), false);
  record('A newer comparison cancels an older recording still decoding');

  reset(); audio.setScene('free'); audio.setAmbience(true); await flush();
  const sceneVoice = audio.musicVoice;
  assert.equal(await audio.audition('music.island', { source: 'file' }), true); await flush();
  const fileComparison = audio.voices.find((voice) => voice.role === 'sample');
  assert.equal(fileComparison.source, 'file');
  assert.equal(await audio.audition('music.island', { source: 'synth' }), true);
  const synthComparison = audio.voices.find((voice) => voice.role === 'sample');
  assert.equal(synthComparison.source, 'synth');
  assert.equal(audio.voices.filter((voice) => voice.role === 'sample').length, 1);
  assert.ok(fileComparison.media.removedSource && fileComparison.media.node.disconnected);
  assert.equal(audio.musicVoice, sceneVoice); assert.equal(audio.scene, 'free'); assert.equal(audio.ambience, true);
  record('A/B comparison replaces the previous full track while preserving music and nature layers');

  reset(); CUES['ui.error'].files = ['/qa/bad.mp3']; responses.set('/qa/bad.mp3', { fail: true });
  assert.equal(await audio.audition('ui.error', { source: 'file' }), true);
  assert.equal(window.__audioLog.at(-1).source, 'synth');
  record('Decode failure auditions synth fallback');

  reset(); failBufferStart = true; assert.equal(audio.play('ui.click', { source: 'file' }), true);
  assert.deepEqual(window.__audioLog.map((entry) => entry.source), ['synth']);
  record('Runtime decoded-source failure falls back without a false file log');

  reset(); updateCueSource('amb.sea', 'file'); await flush(); audio.setScene('island'); audio.setAmbience(true); audio.setWeather('storm'); await flush();
  const originalStream = audio.musicVoice;
  assert.equal(originalStream.source, 'file');
  assert.equal(audio.voices.findLast((voice) => voice.cue === 'amb.sea').source, 'file');
  updateCueSource('music.island', 'synth'); updateCueSource('amb.sea', 'synth'); await flush();
  assert.equal(audio.scene, 'island'); assert.equal(audio.weather, 'storm'); assert.equal(audio.ambience, true);
  assert.equal(audio.musicVoice.source, 'synth'); assert.equal(audio.musicVoice.choice, 'synth');
  assert.equal(audio.voices.findLast((voice) => voice.cue === 'amb.sea').source, 'synth');
  await advance(2600); assert.ok(originalStream.media.removedSource);
  assert.equal(audio.voices.filter((voice) => voice.role === 'music').length, 1);
  assert.equal(audio.voices.filter((voice) => voice.cue === 'amb.sea').length, 1);
  updateCueSource('music.island', 'file'); updateCueSource('amb.sea', 'file'); await flush();
  assert.equal(audio.scene, 'island'); assert.equal(audio.weather, 'storm');
  assert.equal(audio.musicVoice.source, 'file'); assert.equal(audio.musicVoice.choice, 'file');
  assert.equal(audio.voices.findLast((voice) => voice.cue === 'amb.sea').source, 'file');
  await advance(2600);
  assert.equal(audio.voices.filter((voice) => voice.role === 'music').length, 1);
  assert.equal(audio.voices.filter((voice) => voice.cue === 'amb.sea').length, 1);
  record('Active music and nature crossfade file to synth and back without resetting scene or weather');

  reset(); assert.equal(await audio.audition('amb.sea'), true);
  assert.equal(audio.voices[0].handle.duration, 6);
  const seaNode = contexts[0].nodes.findLast((node) => node.type === 'buffer-source');
  assert.equal(seaNode.loop, false); assert.equal(seaNode.stops[0], now / 1000 + 6);
  await advance(6030); assert.equal(audio.voices.length, 0);
  record('45-second ambience loop catalogue sample is six seconds', { fileDurationSeconds: 45, sampleSeconds: 6 });

  reset(); const decodedBeforeMusic = contexts[0].decodeCalls;
  assert.equal(await audio.audition('music.island', { variant: 1 }), true); await flush();
  const musicSample = mediaElements.at(-1);
  assert.equal(musicSample.src, '/qa/island-b.mp3');
  assert.equal(window.__audioLog.at(-1).source, 'file'); assert.equal(window.__audioLog.at(-1).variant, 1);
  assert.equal(audio.voices[0].role, 'sample');
  await advance(7000); assert.equal(audio.voices.length, 1);
  musicSample.onended(); await advance(50); assert.equal(audio.voices.length, 0);
  assert.equal(audio.musicTimer, undefined); assert.equal(contexts[0].decodeCalls, decodedBeforeMusic);
  assert.ok(musicSample.removedSource && musicSample.node.disconnected);
  record('Selected music catalogue variant streams in full and cleans on natural end', { variant: 1, prematureStopAtSixSeconds: false, musicDecodeCalls: 0 });

  reset(); audio.play('epilogue'); await flush();
  assert.deepEqual(window.__audioLog.map((entry) => [entry.cue, entry.source]), [['music.epilogue', 'file'], ['epilogue', 'file']]);
  const ending = mediaElements.at(-1); ending.onended(); await advance(50);
  assert.equal(audio.scene, 'free'); assert.equal(audio.musicVoice.cue, 'music.free');
  record('Virtual epilogue reports actual streamed theme and returns to free');

  reset(); rejectMedia = true; audio.play('epilogue'); await flush();
  assert.deepEqual(window.__audioLog.map((entry) => [entry.cue, entry.source]), [['music.epilogue', 'synth'], ['epilogue', 'synth']]);
  assert.equal(audio.voices.length, 1); assert.ok(mediaElements.at(-1).removedSource);
  record('Rejected epilogue reports exactly one synth fallback, including virtual event');

  reset(); audio.setScene('island'); await flush(); const old = mediaElements.at(-1);
  audio.setScene('free'); await flush(); const current = audio.musicVoice;
  old.onerror(); assert.equal(audio.musicVoice, current); assert.equal(audio.voices.length, 1);
  record('Failure in outgoing crossfade track cannot replace current scene');

  const beforeVisibilityLogs = window.__audioLog.length, playing = current.media;
  document.hidden = true; events.get('visibilitychange')(); await flush();
  assert.equal(contexts[0].state, 'suspended'); assert.equal(playing.paused, true);
  document.hidden = false; events.get('visibilitychange')(); await flush();
  assert.equal(contexts[0].state, 'running'); assert.equal(playing.paused, false); assert.equal(playing.plays, 2);
  assert.equal(window.__audioLog.length, beforeVisibilityLogs);
  record('Visibility pauses and resumes stream without duplicate source logs');

  reset(); deferNextMedia = true; audio.setScene('island'); await flush();
  const pendingStream = audio.musicVoice;
  document.hidden = true; events.get('visibilitychange')(); await flush();
  document.hidden = false; events.get('visibilitychange')(); await flush();
  assert.equal(pendingStream.source, 'file');
  rejectPendingMedia(new Error('Old play was interrupted by visibility pause')); await flush();
  assert.equal(audio.musicVoice, pendingStream);
  assert.deepEqual(window.__audioLog.map((entry) => entry.source), ['file']);
  record('Late rejection from a pre-hide play attempt cannot replace the resumed file stream');

  contexts[0].state = 'suspended'; deferNextResume = true; audio.unlock();
  document.hidden = true; events.get('visibilitychange')(); await flush();
  document.hidden = false; events.get('visibilitychange')(); await flush();
  releaseResume(); await flush();
  assert.equal(contexts[0].state, 'running'); assert.equal(pendingStream.media.paused, false);
  record('A visibility hide/show during pending context resume recovers both context and stream');

  reset(); failMediaSource = true; audio.setScene('island'); await flush();
  assert.equal(window.__audioLog.at(-1).source, 'synth');
  assert.ok(mediaElements.at(-1).removedSource); assert.equal(audio.voices.length, 1);
  record('Media source construction failure releases URL and synthesizes');
  const fallbackVoice = audio.musicVoice, fallbackLogs = window.__audioLog.length, attempts = mediaElements.length;
  assert.equal(fallbackVoice.choice, 'file');
  for (let i = 0; i < 4; i++) { audio.reconcile(); await advance(300); }
  assert.equal(audio.musicVoice, fallbackVoice);
  assert.equal(window.__audioLog.length, fallbackLogs); assert.equal(mediaElements.length, attempts);
  record('Recorded music fallback retains its requested choice and does not restart on reconciliation');

  reset(); CUES['amb.rain'].files = ['/qa/rain-bad.mp3']; responses.set('/qa/rain-bad.mp3', { fail: true });
  await audio.load('/qa/rain-bad.mp3'); audio.setAmbience(true); audio.setWeather('storm'); await flush();
  const rainFallback = audio.voices.findLast((voice) => voice.cue === 'amb.rain');
  assert.equal(rainFallback.source, 'synth'); assert.equal(rainFallback.choice, 'file');
  const beforeRainLogs = window.__audioLog.filter((entry) => entry.cue === 'amb.rain').length;
  for (let i = 0; i < 4; i++) { audio.reconcile(); await advance(300); }
  assert.equal(audio.voices.findLast((voice) => voice.cue === 'amb.rain'), rainFallback);
  assert.equal(window.__audioLog.filter((entry) => entry.cue === 'amb.rain').length, beforeRainLogs);
  record('Undecodable nature fallback retains file choice without repeated crossfades');

  reset(); failBufferStart = true; audio.setAmbience(true); await flush();
  const seaFallback = audio.voices.findLast((voice) => voice.cue === 'amb.sea');
  assert.equal(seaFallback.source, 'synth'); assert.equal(seaFallback.choice, 'file');
  const beforeSeaLogs = window.__audioLog.filter((entry) => entry.cue === 'amb.sea').length;
  for (let i = 0; i < 4; i++) { audio.reconcile(); await advance(300); }
  assert.equal(audio.voices.findLast((voice) => voice.cue === 'amb.sea'), seaFallback);
  assert.equal(window.__audioLog.filter((entry) => entry.cue === 'amb.sea').length, beforeSeaLogs);
  record('Decoded nature source failing at playback retains one fallback instead of restarting');

  reset(); CUES['amb.wind'].files = ['/qa/wind-late.mp3'];
  let releaseWind; responses.set('/qa/wind-late.mp3', new Promise((resolve) => { releaseWind = resolve; }));
  updateCueSource('amb.wind', 'file');
  const loadingWind = audio.load('/qa/wind-late.mp3').then(() => audio.reconcile());
  audio.setAmbience(true); assert.equal(audio.voices.find((voice) => voice.cue === 'amb.wind').source, 'synth');
  releaseWind({ duration: 40 }); await loadingWind; await flush();
  assert.equal(audio.voices.findLast((voice) => voice.cue === 'amb.wind').source, 'file');
  await advance(1530);
  assert.equal(audio.voices.filter((voice) => voice.cue === 'amb.wind').length, 1);
  record('Nature crossfades from initial fallback to decoded file loop');

  assert.equal(fetches.filter((url) => /island|free|epilogue/.test(url)).length, 0);
  const originalSettings = storedSettings.get(AUDIO_SETTINGS_KEY);
  storedSettings.set(AUDIO_SETTINGS_KEY, JSON.stringify({ enabled: false, music: 0.17, sfx: 0.66, ambience: 0.44 }));
  const legacySettings = await import(pathToFileURL(resolve('apps/web/src/audio/settings.ts')).href + '?qa=legacy');
  assert.deepEqual(legacySettings.getAudioSettings(), { enabled: false, music: 0.17, sfx: 0.66, ambience: 0.44, sources: {} });
  for (const cue of CUE_IDS) assert.equal(legacySettings.getCueSource(cue), ownerRecordings.has(cue) ? 'file' : 'synth');
  record('Existing volume-only storage preserves volumes and receives the preferred default source profile');

  storedSettings.set(AUDIO_SETTINGS_KEY, JSON.stringify({ sources: { 'ui.click': 'file', 'coins.pay': 'invalid', 'music.island': true, 'epilogue': 'synth', unknown: 'file' } }));
  const malformedSettings = await import(pathToFileURL(resolve('apps/web/src/audio/settings.ts')).href + '?qa=malformed');
  assert.deepEqual(malformedSettings.getAudioSettings().sources, { 'ui.click': 'file', 'music.epilogue': 'synth' });
  assert.equal(malformedSettings.getCueSource('coins.pay'), 'synth'); assert.equal(malformedSettings.getCueSource('music.island'), 'file');
  assert.equal(malformedSettings.getCueSource('epilogue'), 'synth');
  assert.ok(Object.isFrozen(malformedSettings.getAudioSettings().sources));
  storedSettings.set(AUDIO_SETTINGS_KEY, originalSettings);
  record('Malformed source preferences discard invalid values and unknown cues while retaining valid choices');
  evidence.passed = true;
} catch (error) { evidence.passed = false; evidence.error = error.stack; process.exitCode = 1; }
finally {
  audio?.stop();
  await mkdir(dirname(reportPath), { recursive: true });
  await writeFile(reportPath, JSON.stringify(evidence, null, 2) + '\n');
  console.log(JSON.stringify(evidence, null, 2));
}
