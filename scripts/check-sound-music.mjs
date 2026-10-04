// Run from the repository: node --import tsx scripts/check-sound-music.mjs
// Actual application modules, controlled audio clock and media nodes; no app source modifications.
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

const reportPath = resolve(process.argv[2] ?? 'node_modules/.cache/sound-qa/music-checks.json');

let now = 0, nextTimer = 0, random = 0.5;
const timers = new Map(), events = new Map(), contexts = [], mediaElements = [];
const saved = { setTimeout, clearTimeout, performance, random: Math.random, debug: console.debug };
globalThis.setTimeout = (fn, delay = 0) => {
  const id = ++nextTimer; timers.set(id, { at: now + delay, fn }); return id;
};
globalThis.clearTimeout = (id) => timers.delete(id);
globalThis.performance = { now: () => now };
Math.random = () => random;
console.debug = () => {};
globalThis.document = { hidden: false, addEventListener: (type, fn) => events.set(type, fn) };
globalThis.localStorage = { getItem: (key) => key === 'archipelago.audio.debug' ? '1' : null, setItem() {} };

class Param {
  initial = 1;
  automation = [];
  get value() { return this.at(now / 1000); }
  set value(value) { this.initial = value; }
  at(time) {
    let previous = { time: 0, value: this.initial };
    for (const event of this.automation) {
      if (event.time <= time) { previous = event; continue; }
      if (event.method === 'linear') return previous.value + (event.value - previous.value)
        * (time - previous.time) / (event.time - previous.time);
      if (event.method === 'exponential' && previous.value > 0) return previous.value
        * (event.value / previous.value) ** ((time - previous.time) / (event.time - previous.time));
      break;
    }
    return previous.value;
  }
  add(method, value, time) {
    this.automation.push({ method, value, time });
    this.automation.sort((a, b) => a.time - b.time); return this;
  }
  setValueAtTime(value, time) { return this.add('set', value, time); }
  linearRampToValueAtTime(value, time) { return this.add('linear', value, time); }
  exponentialRampToValueAtTime(value, time) { return this.add('exponential', value, time); }
  cancelScheduledValues(time) { this.automation = this.automation.filter((event) => event.time < time); return this; }
  cancelAndHoldAtTime(time) { const value = this.at(time); this.cancelScheduledValues(time); return this.setValueAtTime(value, time); }
}
class Node {
  disconnected = false; starts = []; stops = []; connections = [];
  constructor(type) {
    this.type = type;
    for (const key of ['gain', 'frequency', 'Q', 'playbackRate', 'threshold', 'knee', 'ratio', 'attack', 'release']) this[key] = new Param();
  }
  connect(destination) { this.connections.push(destination); }
  disconnect() { this.disconnected = true; this.connections = []; }
  start(time = now / 1000) { this.starts.push(time); }
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
  createMediaElementSource(media) { return media.node = this.node('media-source'); }
  decodeAudioData() { this.decodeCalls++; throw new Error('Music must never be decoded'); }
  resume() { this.state = 'running'; return Promise.resolve(); }
  suspend() { this.state = 'suspended'; return Promise.resolve(); }
}
class Media {
  static reject = false;
  pauses = 0; loads = 0; removedSource = false;
  constructor() { mediaElements.push(this); }
  play() { return Media.reject ? Promise.reject(new Error('Test unavailable file')) : Promise.resolve(); }
  pause() { this.pauses++; }
  removeAttribute(name) { if (name === 'src') { this.src = ''; this.removedSource = true; } }
  load() { this.loads++; }
}
globalThis.Audio = Media;
globalThis.window = { AudioContext: Context, addEventListener() {} };
const flush = async () => { await Promise.resolve(); await Promise.resolve(); };
async function advance(milliseconds) {
  const target = now + milliseconds;
  for (;;) {
    const due = [...timers].filter(([, timer]) => timer.at <= target).sort((a, b) => a[1].at - b[1].at)[0];
    if (!due) break;
    now = due[1].at; timers.delete(due[0]); due[1].fn(); await flush();
  }
  now = target; await flush();
}
const close = (actual, expected, message) => assert.ok(Math.abs(actual - expected) < 1e-9, `${message}: ${actual} != ${expected}`);
const evidence = { runner: 'Actual TypeScript engine via tsx; controlled timers, AudioContext and HTMLAudioElement', checks: [] };
const record = (name, values) => evidence.checks.push({ name, passed: true, ...values });
let audio, CUES, CUE_IDS;
const originalFiles = new Map();
try {
  ({ CUES, CUE_IDS } = await import('../apps/web/src/audio/cues.ts'));
  for (const cue of CUE_IDS) { originalFiles.set(cue, CUES[cue].files); delete CUES[cue].files; }
  ({ audio } = await import('../apps/web/src/audio/engine.ts'));
  audio.unlock(); assert.equal(audio.snapshot().contextState, 'running');
  const reset = () => { audio.stop(); audio.variant = 0; random = 0.5; window.__audioLog = []; };
  reset();
  audio.setScene('island');
  await advance(24030);
  assert.equal(audio.musicVoice, undefined);
  assert.equal(timers.get(audio.musicTimer).at - now, 40000);
  await advance(39999); assert.equal(audio.musicVoice, undefined);
  await advance(1); assert.equal(audio.musicVoice.cue, 'music.island');
  await advance(24030); await advance(40000);
  const starts = window.__audioLog.filter((entry) => entry.cue === 'music.island');
  assert.deepEqual(starts.map((entry) => entry.variant), [0, 1, 0]);
  assert.deepEqual(starts.map((entry) => entry.t), [0, 64030, 128060]);
  record('Synth playlist alternates and stays silent between tracks', {
    variants: starts.map((entry) => entry.variant), startTimesMs: starts.map((entry) => entry.t),
    declaredTrackMs: 24000, cleanupLatencyMs: 30, silenceMs: 40000,
  });
  const bounds = [];
  for (const value of [0, 0.999999]) {
    reset(); audio.setScene('island'); random = value; await advance(24030);
    const silence = timers.get(audio.musicTimer).at - now;
    close(silence, 20000 + 40000 * value, 'Playlist silence range'); bounds.push(silence);
  }
  record('Playlist randomized silence boundaries', { randomInputs: [0, 0.999999], silenceMs: bounds });

  reset(); audio.setScene('island'); await advance(5000);
  const old = audio.musicVoice, transitionAt = now / 1000;
  audio.setScene('free'); const incoming = audio.musicVoice;
  close(old.gain.gain.at(transitionAt + 1.25), 0.275, 'Outgoing midpoint');
  close(incoming.gain.gain.at(transitionAt + 1.25), 0.275, 'Incoming midpoint');
  close(old.gain.gain.at(transitionAt + 2.5), 0, 'Outgoing end');
  close(incoming.gain.gain.at(transitionAt + 2.5), 0.55, 'Incoming end');
  await advance(2499); assert.ok(audio.voices.includes(old));
  await advance(31); assert.ok(!audio.voices.includes(old)); assert.ok(old.gain.disconnected);
  record('Synth scene crossfade', { fadeSeconds: 2.5, midpointGains: [0.275, 0.275], outgoingStoppedAfterMs: 2530 });

  const duckAt = now / 1000;
  audio.play('freedom');
  const duck = audio.musicDuck.gain, quiet = 10 ** (-9 / 20);
  close(duck.at(duckAt + 0.05), quiet, 'Duck attack');
  close(duck.at(duckAt + 2.999), quiet, 'Duck held');
  close(duck.at(duckAt + 3), quiet, 'Duck three seconds');
  close(duck.at(duckAt + 3.4), 1, 'Duck restored');
  record('Freedom automatically ducks music', { attenuationDb: 20 * Math.log10(quiet), gain: quiet, attackSeconds: 0.05, holdUntilSeconds: 3, restoredAtSeconds: 3.4 });

  reset(); audio.setScene('free'); await advance(1000); audio.setScene('epilogue');
  assert.equal(audio.musicVoice.cue, 'music.epilogue');
  close(audio.musicVoice.gain.gain.value, 0.55, 'Immediate epilogue');
  await advance(7530); assert.equal(audio.scene, 'free'); assert.equal(audio.musicVoice.cue, 'music.free');
  record('Epilogue starts immediately and returns to free once', { durationSeconds: 7.5, returnLatencyMs: 30, finalScene: audio.scene });

  CUES['music.island'].files = ['/qa/island-a.mp3', '/qa/island-b.mp3'];
  CUES['music.free'].files = ['/qa/free.mp3'];
  reset(); audio.setScene('island'); await flush();
  const streamed = audio.musicVoice, element = mediaElements.at(-1), streamAt = now / 1000;
  assert.equal(window.__audioLog.at(-1).source, 'file');
  close(streamed.gain.gain.at(streamAt + 1.25), 0.275, 'Stream fade midpoint');
  await advance(3000); audio.setScene('free'); await flush();
  const streamNext = audio.musicVoice;
  assert.equal(audio.voices.filter((voice) => voice.role === 'music').length, 2);
  await advance(2530);
  assert.ok(!audio.voices.includes(streamed)); assert.ok(audio.voices.includes(streamNext));
  assert.ok(element.node.disconnected && streamed.gain.disconnected);
  assert.ok(element.pauses > 0 && element.loads > 0 && element.removedSource);
  assert.equal(element.onended, null); assert.equal(element.onerror, null);
  assert.equal(contexts[0].decodeCalls, 0);
  record('Stream scene crossfade and cleanup', { fadeSeconds: 2.5, sourceDisconnected: true, gainDisconnected: true, paused: true, srcRemoved: true, handlersRemoved: true, loadCalled: true, decodedMusicTracks: 0 });

  reset();
  for (const cue of CUE_IDS.filter((cue) => CUES[cue].bus === 'sfx').slice(0, 16)) assert.ok(audio.play(cue));
  assert.equal(audio.voices.length, 16); const displaced = audio.voices[0];
  audio.setScene('island'); await flush();
  assert.equal(audio.voices.length, 16); assert.ok(!audio.voices.includes(displaced));
  assert.equal(audio.voices.filter((voice) => voice.role === 'music').length, 1);
  record('Stream capacity steals oldest disposable effect', { voiceLimit: 16, voicesAfterStart: audio.voices.length, displacedEffectStopped: displaced.gain.disconnected });
  reset();
  for (let i = 0; i < 16; i++) audio.setScene(i % 2 ? 'free' : 'island');
  assert.equal(audio.voices.length, 16); const beforeAttempt = mediaElements.length;
  audio.setScene('island'); assert.equal(audio.voices.length, 16); assert.equal(mediaElements.length, beforeAttempt);
  await advance(2530); assert.equal(audio.voices.length, 1); assert.equal(audio.musicVoice.cue, 'music.island');
  record('Stream capacity rejects new layer when all 16 are protected, then recovers', { protectedVoices: 16, rejectedWithoutCreatingMedia: true, afterFadeVoices: 1 });

  reset(); audio.setScene('island'); await flush();
  const finishedStream = mediaElements.at(-1); await advance(1000); finishedStream.onended(); await advance(50);
  assert.equal(audio.musicVoice, undefined); assert.ok(finishedStream.removedSource && finishedStream.node.disconnected);
  assert.equal(timers.get(audio.musicTimer).at - now, 40000);
  record('Natural stream completion cleans resources and enters playlist silence', { silenceMs: 40000, srcRemoved: true, sourceDisconnected: true });
  reset(); Media.reject = true; audio.setScene('island'); await flush();
  const failedStream = mediaElements.at(-1);
  assert.equal(audio.voices.length, 1); assert.equal(audio.musicVoice.cue, 'music.island');
  assert.equal(window.__audioLog.at(-1).source, 'synth'); assert.ok(failedStream.node.disconnected && failedStream.removedSource);
  record('Rejected stream starts exactly one synth fallback and releases media', { voices: 1, fallbackSource: 'synth', failedMediaReleased: true });
  Media.reject = false; reset(); audio.setScene('island'); await flush();
  const lateFailure = mediaElements.at(-1).onerror;
  audio.stop(); lateFailure(); await flush(); assert.equal(audio.voices.length, 0); assert.equal(timers.size, 0);
  record('Reset invalidates late media failure and clears timers', { voices: 0, timers: 0 });
  evidence.passed = true;
} catch (error) {
  evidence.passed = false; evidence.error = error.stack; process.exitCode = 1;
} finally {
  audio?.stop();
  if (CUES) for (const [cue, files] of originalFiles) {
    if (files) CUES[cue].files = files; else delete CUES[cue].files;
  }
  Object.assign(globalThis, { setTimeout: saved.setTimeout, clearTimeout: saved.clearTimeout, performance: saved.performance });
  Math.random = saved.random; console.debug = saved.debug;
  await mkdir(dirname(reportPath), { recursive: true });
  await writeFile(reportPath, JSON.stringify(evidence, null, 2) + '\n');
  console.log(JSON.stringify(evidence, null, 2));
}
