export interface AudioSettings { enabled: boolean; music: number; sfx: number; ambience: number }
export const AUDIO_SETTINGS_KEY = 'archipelago.audio.v1';
export const DEFAULT_AUDIO_SETTINGS: Readonly<AudioSettings> = Object.freeze({ enabled: true, music: 0.35, sfx: 0.8, ambience: 0.5 });
const listeners = new Set<() => void>();

function sanitize(raw: unknown): AudioSettings {
  const result = { ...DEFAULT_AUDIO_SETTINGS };
  if (!raw || typeof raw !== 'object') return result;
  const input = raw as Partial<AudioSettings>;
  if (typeof input.enabled === 'boolean') result.enabled = input.enabled;
  for (const bus of ['music', 'sfx', 'ambience'] as const) {
    const value = input[bus];
    if (typeof value === 'number' && Number.isFinite(value)) result[bus] = Math.max(0, Math.min(1, value));
  }
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
  if (Object.keys(next).every((key) => next[key as keyof AudioSettings] === settings[key as keyof AudioSettings])) return;
  settings = Object.freeze(next);
  listeners.forEach((listener) => listener());
}
export function updateAudioSettings(patch: Partial<AudioSettings>) {
  const next = sanitize({ ...settings, ...patch });
  publish(next);
  try { localStorage.setItem(AUDIO_SETTINGS_KEY, JSON.stringify(next)); } catch { /* Volatile settings still work. */ }
}
if (typeof window !== 'undefined') window.addEventListener('storage', (event) => {
  if (event.key === AUDIO_SETTINGS_KEY || event.key === null) publish(read());
});
