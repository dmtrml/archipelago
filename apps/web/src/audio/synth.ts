export interface SynthRecipe {
  kind: 'effect' | 'ambience' | 'music';
  name: string;
  /** Seconds, including the release. Loop recipes repeat until explicitly stopped. */
  duration: number;
  loop?: boolean;
}

export interface SynthVoice {
  duration: number;
  stop(): void;
}

type NoiseColor = 'white' | 'pink';
const noiseCache = new WeakMap<BaseAudioContext, Partial<Record<NoiseColor, AudioBuffer>>>();

/** A small reusable noise cycle; music is always scheduled notes, never a decoded track. */
function noiseBuffer(context: BaseAudioContext, color: NoiseColor): AudioBuffer {
  let cache = noiseCache.get(context);
  if (!cache) { cache = {}; noiseCache.set(context, cache); }
  if (cache[color]) return cache[color]!;
  const buffer = context.createBuffer(1, Math.ceil(context.sampleRate * 4), context.sampleRate);
  const data = buffer.getChannelData(0);
  let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
  for (let i = 0; i < data.length; i++) {
    const white = Math.random() * 2 - 1;
    if (color === 'white') { data[i] = white; continue; }
    b0 = 0.99886 * b0 + white * 0.0555179;
    b1 = 0.99332 * b1 + white * 0.0750759;
    b2 = 0.969 * b2 + white * 0.153852;
    b3 = 0.8665 * b3 + white * 0.3104856;
    b4 = 0.55 * b4 + white * 0.5329522;
    b5 = -0.7616 * b5 - white * 0.016898;
    data[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.11;
    b6 = white * 0.115926;
  }
  cache[color] = buffer;
  return buffer;
}

/** All sound scheduling uses the audio clock. Every source and control node has an owner. */
export function synthesize(context: BaseAudioContext, destination: AudioNode, recipe: SynthRecipe,
  pitch = 1, variant = 0): SynthVoice {
  const start = context.currentTime;
  const end = start + recipe.duration;
  const nodes = new Set<AudioNode>();
  const sources = new Set<AudioScheduledSourceNode>();
  let stopped = false;
  const keep = <T extends AudioNode>(node: T): T => { nodes.add(node); return node; };
  const output = keep(context.createGain());
  output.connect(destination);

  function disconnect(node: AudioNode) {
    try { node.disconnect(); } catch { /* Already disconnected or context closed. */ }
    nodes.delete(node);
  }

  function stop() {
    if (stopped) return;
    stopped = true;
    for (const source of sources) {
      source.onended = null;
      try { source.stop(); } catch { /* A naturally ended source can no longer be stopped. */ }
    }
    sources.clear();
    for (const node of nodes) disconnect(node);
  }

  function track(source: AudioScheduledSourceNode, owned: AudioNode[]) {
    sources.add(source);
    source.onended = () => {
      sources.delete(source);
      for (const node of [source, ...owned]) disconnect(node);
      if (!sources.size) stop();
    };
  }

  function envelope(param: AudioParam, at: number, length: number, peak: number, attack = 0.006) {
    // A future start can straddle sample rounding; never expose GainNode's default gain of 1.
    param.value = 0;
    param.setValueAtTime(0, at);
    param.linearRampToValueAtTime(peak, at + Math.min(attack, length * 0.2));
    param.exponentialRampToValueAtTime(0.0001, at + length);
  }

  function tone(frequency: number, offset: number, length: number, level: number,
    type: OscillatorType = 'sine', slide?: number) {
    const at = start + offset;
    const oscillator = keep(context.createOscillator());
    const gain = keep(context.createGain());
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(Math.max(20, frequency * pitch), at);
    if (slide) oscillator.frequency.exponentialRampToValueAtTime(Math.max(20, slide * pitch), at + length * 0.8);
    if (level > 0) envelope(gain.gain, at, length, level);
    else gain.gain.value = 0;
    oscillator.connect(gain); gain.connect(output);
    track(oscillator, [gain]);
    oscillator.start(at); oscillator.stop(at + length);
  }

  function bell(frequency: number, offset = 0, length = 0.5, level = 0.18) {
    tone(frequency, offset, length, level);
    tone(frequency * 2.01, offset, length * 0.6, level * 0.26);
    tone(frequency * 2.76, offset, length * 0.35, level * 0.1);
  }

  function pluck(frequency: number, offset: number, length = 0.65, level = 0.12) {
    tone(frequency, offset, length, level, 'triangle');
    tone(frequency * 2, offset, length * 0.25, level * 0.22);
  }

  function chord(frequencies: number[], offset: number, length: number, level = 0.08) {
    frequencies.forEach((frequency, i) => pluck(frequency, offset + i * 0.025, length, level));
  }

  function noise(offset: number, length: number, level: number, frequency = 1400,
    filterType: BiquadFilterType = 'lowpass', color: NoiseColor = 'white', attack = 0.015) {
    const at = start + offset;
    const source = keep(context.createBufferSource());
    const filter = keep(context.createBiquadFilter());
    const gain = keep(context.createGain());
    source.buffer = noiseBuffer(context, color); source.loop = true;
    filter.type = filterType; filter.frequency.setValueAtTime(frequency * pitch, at); filter.Q.value = 0.6;
    envelope(gain.gain, at, length, level, attack);
    source.connect(filter); filter.connect(gain); gain.connect(output);
    track(source, [filter, gain]);
    source.start(at, Math.random() * 3); source.stop(at + length);
  }

  function knock(offset = 0, frequency = 180, level = 0.2) {
    tone(frequency, offset, 0.11, level, 'sine', frequency * 0.6);
    noise(offset, 0.055, level * 0.4, 1250, 'bandpass');
  }

  function gull(offset = 0) {
    tone(920, offset, 0.32, 0.085, 'sine', 1580);
    tone(1500, offset + 0.3, 0.45, 0.08, 'sine', 780);
    tone(940, offset + 0.8, 0.4, 0.06, 'sine', 680);
  }

  function thunder(length: number) {
    noise(0, length, 0.32, 220, 'lowpass', 'pink', 0.18);
    noise(0.24, Math.max(0.1, length - 0.3), 0.13, 410, 'lowpass', 'pink', 0.1);
  }

  function loopNature() {
    const rain = recipe.name === 'amb.rain';
    const wind = recipe.name === 'amb.wind';
    const source = keep(context.createBufferSource());
    const filter = keep(context.createBiquadFilter());
    const highpass = keep(context.createBiquadFilter());
    const gain = keep(context.createGain());
    source.buffer = noiseBuffer(context, rain ? 'white' : 'pink'); source.loop = true;
    filter.type = 'lowpass'; filter.frequency.value = rain ? 6000 : wind ? 1100 : 650;
    highpass.type = 'highpass'; highpass.frequency.value = rain ? 700 : wind ? 160 : 40;
    gain.gain.setValueAtTime(rain ? 0.16 : wind ? 0.12 : 0.19, start);
    source.connect(highpass); highpass.connect(filter); filter.connect(gain); gain.connect(output);
    track(source, [highpass, filter, gain]);

    const lfo = keep(context.createOscillator());
    const modulation = keep(context.createGain());
    lfo.frequency.value = rain ? 0.27 : wind ? 0.18 : 0.11;
    modulation.gain.value = rain ? 0.018 : wind ? 0.045 : 0.1;
    lfo.connect(modulation); modulation.connect(gain.gain);
    track(lfo, [modulation]);
    const filterLfo = keep(context.createOscillator());
    const filterMod = keep(context.createGain());
    filterLfo.frequency.value = wind ? 0.07 : 0.05;
    filterMod.gain.value = rain ? 350 : wind ? 420 : 220;
    filterLfo.connect(filterMod); filterMod.connect(filter.frequency);
    track(filterLfo, [filterMod]);
    source.start(start); lfo.start(start); filterLfo.start(start);
    if (!recipe.loop) { source.stop(end); lfo.stop(end); filterLfo.stop(end); }
  }

  function music() {
    const epilogue = recipe.name === 'music.epilogue';
    const free = recipe.name === 'music.free';
    const alternate = Math.abs(Math.floor(variant)) % 2 === 1;
    const bpm = free ? 88 : alternate ? 82 : 86;
    const beat = 60 / bpm;
    // C major pentatonic; free uses the same sunny harmony an octave higher.
    const scale = [261.63, 293.66, 329.63, 392, 440, 523.25, 587.33, 659.25];
    const melody = epilogue ? [0, 2, 3, 4, 5, 4, 3, 2, 0]
      : alternate ? [2, 0, 3, 4, 2, 1, 0, 3, 5, 4, 3, 1, 2, 4, 3, 0]
        : [0, 2, 3, 2, 4, 3, 1, 0, 2, 3, 5, 4, 3, 2, 1, 0];
    const total = epilogue ? melody.length : 32;
    for (let i = 0; i < total; i++) {
      const offset = i * beat;
      if (offset + 1.2 > recipe.duration) break;
      const note = scale[melody[i % melody.length]] * (free ? 2 : 1);
      const level = i % 4 === 0 ? 0.13 : 0.095;
      // A sine fundamental and quickly fading harmonic read as a soft marimba.
      tone(note, offset, 0.65, level);
      tone(note * 2, offset, 0.14, level * 0.3, 'triangle');
      if (i % 4 === 0) {
        tone([130.81, 110, 87.31, 98][Math.floor(i / 4) % 4], offset, 1.3, 0.095, 'triangle');
        if (!epilogue) chord([261.63, 329.63, 392], offset + beat * 0.5, 0.6, 0.025);
      }
      if (!epilogue && i % 2 === 1) noise(offset + beat * 0.5, 0.055, 0.022, 2200, 'highpass');
    }
    if (epilogue) chord([261.63, 329.63, 392, 523.25], 6.05, 1.3, 0.07);
    // A silent clock source keeps voice completion aligned with the declared release.
    tone(20, recipe.duration - 0.01, 0.01, 0);
  }

  function effect() {
    switch (recipe.name) {
      case 'ui.click': knock(0, 240, 0.16); break;
      case 'ui.toggle': knock(0, 410, 0.1); tone(680, 0.045, 0.065, 0.065); break;
      case 'ui.error': knock(0, 130, 0.15); knock(0.17, 105, 0.13); break;
      case 'ui.open': noise(0, 0.26, 0.12, 2600, 'bandpass', 'white', 0.035); break;
      case 'coins.pay': [1000, 840, 700].forEach((f, i) => bell(f, i * 0.09, 0.28, 0.12)); break;
      case 'coins.get': [660, 820, 1040].forEach((f, i) => bell(f, i * 0.1, 0.33, 0.12)); break;
      case 'coin.tick': bell(880, 0, 0.28, 0.13); break;
      case 'coin.minus': bell(440, 0, 0.25, 0.11); break;
      case 'build.pop': tone(180, 0, 0.3, 0.16, 'sine', 480); knock(0.28, 230, 0.16); break;
      case 'status.joy': chord([392, 493.88, 587.33], 0, 0.72, 0.07); break;
      case 'build.remove': noise(0, 0.27, 0.15, 700, 'bandpass'); tone(400, 0, 0.27, 0.075, 'sine', 120); break;
      case 'upgrade': [0, 0.16, 0.32].forEach(t => knock(t, 260, 0.15)); [523.25, 659.25, 783.99].forEach((f, i) => bell(f, 0.45 + i * 0.12, 0.38, 0.1)); break;
      case 'repair': knock(0, 210); knock(0.24, 240, 0.16); break;
      case 'loan.take': noise(0, 0.25, 0.12, 2000, 'bandpass'); knock(0.29, 125, 0.18); break;
      case 'loan.repay': knock(0, 150, 0.16); bell(659.25, 0.22, 0.62, 0.14); break;
      case 'study': noise(0, 0.3, 0.12, 3200, 'bandpass'); bell(740, 0.3, 0.45, 0.1); break;
      case 'rest': [261.63, 329.63, 392, 523.25, 659.25].forEach((f, i) => pluck(f, i * 0.11, 0.65, 0.07)); break;
      case 'shift.on': knock(0, 620, 0.1); knock(0.2, 730, 0.08); break;
      case 'job.quit': chord([329.63, 392, 523.25], 0, 0.85, 0.085); break;
      case 'job.return': pluck(329.63, 0, 0.42); pluck(261.63, 0.32, 0.45); break;
      case 'dream.start': noise(0, 0.37, 0.13, 1150, 'bandpass'); knock(0.46, 240, 0.18); knock(0.66, 260, 0.13); break;
      case 'week.next': bell(660, 0, 0.86, 0.18); break;
      case 'event.good': bell(659.25, 0, 0.55, 0.12); bell(880, 0.24, 0.6, 0.12); break;
      case 'event.bad': tone(125, 0, 0.55, 0.18, 'sine', 85); noise(0, 0.18, 0.09, 320, 'lowpass', 'pink'); break;
      case 'storm': thunder(2.35); break;
      case 'scam.collapse': [380, 290, 210].forEach((f, i) => { tone(f, i * 0.1, 0.16, 0.08, 'sine', f * 1.8); pluck([392, 329.63, 261.63][i], 0.35 + i * 0.23, 0.4, 0.1); }); break;
      case 'loan.emergency': bell(174.61, 0, 1.05, 0.16); break;
      case 'threat': [0, 0.3, 0.6, 0.9].forEach((t, i) => knock(t, i % 2 ? 260 : 310, 0.08)); break;
      case 'neighbor.free': bell(784, 0, 0.7, 0.09); bell(1046.5, 0.45, 0.8, 0.065); break;
      case 'freedom': chord([261.63, 329.63, 392, 523.25], 0, 1.3, 0.09); chord([349.23, 440, 523.25], 0.75, 1.2, 0.075); chord([392, 523.25, 659.25], 1.5, 1.1, 0.08); [523.25, 659.25, 784].forEach((f, i) => bell(f, 0.25 + i * 0.35, 0.75, 0.08)); break;
      case 'freedom.level': [523.25, 659.25, 784].forEach((f, i) => bell(f, i * 0.22, 0.58, 0.11)); break;
      case 'dream.stage': knock(0, 240); bell(784, 0.28, 0.82, 0.13); break;
      case 'dream.launch': bell(660, 0, 1.2, 0.16); bell(880, 0.6, 1.2, 0.14); noise(0.9, 0.9, 0.2, 1700, 'lowpass', 'pink', 0.08); gull(1.55); break;
      default: knock();
    }
  }

  try {
    if (recipe.kind === 'music') music();
    else if (recipe.kind === 'ambience') {
      if (recipe.name === 'amb.gulls') gull();
      else if (recipe.name === 'amb.thunder') thunder(recipe.duration - 0.05);
      else loopNature();
    } else effect();
  } catch (error) { stop(); throw error; }
  return { duration: recipe.duration, stop };
}
