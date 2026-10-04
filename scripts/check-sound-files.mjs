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
globalThis.localStorage = { getItem: (key) => key === 'archipelago.audio.debug' ? '1' : null, setItem() {} };
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
  responses.set('/qa/sea.mp3', { duration: 45 });
  let releaseClick;
  responses.set('/qa/click.mp3', new Promise((resolve) => { releaseClick = resolve; }));
  ({ audio } = await import(pathToFileURL(resolve('apps/web/src/audio/engine.ts')).href));
  audio.setScene('island');
  assert.equal(contexts.length, 0); assert.equal(mediaElements.length, 0); assert.equal(fetches.length, 0);
  record('Before first gesture: no context, media element or file request');

  audio.unlock(); await flush(); audio.stop(); window.__audioLog = [];
  const audition = audio.audition('ui.click'); await flush();
  assert.equal(window.__audioLog.length, 0);
  releaseClick({ duration: 0.2 }); assert.equal(await audition, true);
  assert.equal(window.__audioLog.at(-1).source, 'file');
  assert.equal(fetches.filter((url) => url === '/qa/click.mp3').length, 1);
  record('First catalogue effect waits for decode and uses file; fetch shared with preload', { fetchCount: 1 });

  const reset = () => { audio.stop(); window.__audioLog = []; rejectMedia = failMediaSource = failBufferStart = false; };
  reset(); CUES['ui.toggle'].files = ['/qa/toggle-a.mp3', '/qa/toggle-b.mp3'];
  responses.set('/qa/toggle-a.mp3', { duration: 0.1, url: '/qa/toggle-a.mp3' });
  responses.set('/qa/toggle-b.mp3', { duration: 0.4, url: '/qa/toggle-b.mp3' });
  assert.equal(await audio.audition('ui.toggle', { variant: 1 }), true);
  assert.equal(contexts[0].nodes.findLast((node) => node.type === 'buffer-source').buffer.file, '/qa/toggle-b.mp3');
  record('Explicit second catalogue effect variant uses the selected decoded URL');

  reset(); CUES['ui.open'].files = ['/qa/late.mp3'];
  let releaseLate; responses.set('/qa/late.mp3', new Promise((resolve) => { releaseLate = resolve; }));
  const cancelled = audio.audition('ui.open'); await flush(); audio.stop(); releaseLate({ duration: 0.3 });
  assert.equal(await cancelled, false); assert.equal(window.__audioLog.length, 0);
  record('Stop invalidates a pending catalogue decode');

  reset(); CUES['ui.error'].files = ['/qa/bad.mp3']; responses.set('/qa/bad.mp3', { fail: true });
  assert.equal(await audio.audition('ui.error'), true);
  assert.equal(window.__audioLog.at(-1).source, 'synth');
  record('Decode failure auditions synth fallback');

  reset(); failBufferStart = true; assert.equal(audio.play('ui.click'), true);
  assert.deepEqual(window.__audioLog.map((entry) => entry.source), ['synth']);
  record('Runtime decoded-source failure falls back without a false file log');

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
  assert.equal(audio.voices[0].role, 'effect');
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

  reset(); CUES['amb.wind'].files = ['/qa/wind-late.mp3'];
  let releaseWind; responses.set('/qa/wind-late.mp3', new Promise((resolve) => { releaseWind = resolve; }));
  const loadingWind = audio.load('/qa/wind-late.mp3').then(() => audio.reconcile());
  audio.setAmbience(true); assert.equal(audio.voices.find((voice) => voice.cue === 'amb.wind').source, 'synth');
  releaseWind({ duration: 40 }); await loadingWind; await flush();
  assert.equal(audio.voices.findLast((voice) => voice.cue === 'amb.wind').source, 'file');
  await advance(1530);
  assert.equal(audio.voices.filter((voice) => voice.cue === 'amb.wind').length, 1);
  record('Nature crossfades from initial fallback to decoded file loop');

  assert.equal(fetches.filter((url) => /island|free|epilogue/.test(url)).length, 0);
  evidence.passed = true;
} catch (error) { evidence.passed = false; evidence.error = error.stack; process.exitCode = 1; }
finally {
  audio?.stop();
  await mkdir(dirname(reportPath), { recursive: true });
  await writeFile(reportPath, JSON.stringify(evidence, null, 2) + '\n');
  console.log(JSON.stringify(evidence, null, 2));
}
