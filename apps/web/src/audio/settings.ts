import { CUES, CUE_IDS, type CueId } from './cues';

export type AudioSource = 'file' | 'synth';
export interface AudioSettings {
  enabled: boolean; music: number; sfx: number; ambience: number;
  sources: Readonly<Partial<Record<CueId, AudioSource>>>;
}
export const AUDIO_SETTINGS_KEY = 'archipelago.audio.v1';
export const DEFAULT_AUDIO_SETTINGS: Readonly<AudioSettings> = Object.freeze({ enabled: true, music: 0.35, sfx: 0.8, ambience: 0.5, sources: Object.freeze({}) });
const listeners = new Set<() => void>();
// The milestone and its musical scene use the same recording and preference.
const sourceCue = (cue: CueId): CueId => cue === 'epilogue' ? 'music.epilogue' : cue;
export function getCueSource(cue: CueId, state = settings): AudioSource {
  return state.sources[sourceCue(cue)] ?? (CUES[cue].bus === 'sfx' ? 'synth' : 'file');
}

function sanitize(raw: unknown): AudioSettings {
  const result = { ...DEFAULT_AUDIO_SETTINGS };
  if (!raw || typeof raw !== 'object') return result;
  const input = raw as Partial<AudioSettings>;
  if (typeof input.enabled === 'boolean') result.enabled = input.enabled;
  for (const bus of ['music', 'sfx', 'ambience'] as const) {
    const value = input[bus];
    if (typeof value === 'number' && Number.isFinite(value)) result[bus] = Math.max(0, Math.min(1, value));
  }
  const sources: Partial<Record<CueId, AudioSource>> = {};
  if (input.sources && typeof input.sources === 'object') {
    for (const cue of CUE_IDS) {
      const key = sourceCue(cue);
      const value = input.sources[key] ?? input.sources[cue];
      if (value === 'file' || value === 'synth') sources[key] = value;
    }
  }
  result.sources = Object.freeze(sources);
  return result;
}
function read(): AudioSettings {
  try { return sanitize(JSON.parse(localStorage.getItem(AUDIO_SETTINGS_KEY) ?? 'null')); }
  catch { return { ...DEFAULT_AUDIO_SETTINGS }; }
}
let settings: Readonly<AudioSettings> = Object.freeze(read());
export function getAudioSettings() { return settings; }
export function subscribeAudioSettings(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener); }; }
function publish(next: AudioSettings) {
  if (next.enabled === settings.enabled && next.music === settings.music && next.sfx === settings.sfx && next.ambience === settings.ambience
    && CUE_IDS.every((cue) => getCueSource(cue, next) === getCueSource(cue, settings))) return;
  settings = Object.freeze(next);
  listeners.forEach((listener) => listener());
}
export function updateCueSource(cue: CueId, source: AudioSource) {
  updateAudioSettings({ sources: { ...settings.sources, [sourceCue(cue)]: source } });
}
export function updateAudioSettings(patch: Partial<AudioSettings>) {
  const next = sanitize({ ...settings, ...patch });
  publish(next);
  try { localStorage.setItem(AUDIO_SETTINGS_KEY, JSON.stringify(next)); } catch { /* Volatile settings still work. */ }
}
if (typeof window !== 'undefined') window.addEventListener('storage', (event) => {
  if (event.key === AUDIO_SETTINGS_KEY || event.key === null) publish(read());
});
