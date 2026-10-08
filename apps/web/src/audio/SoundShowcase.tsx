import { useEffect, useState, useSyncExternalStore } from 'react';
import { asset } from '../asset';
import { AudioSliders, useAudioSettings } from './AudioControls';
import { CUES, CUE_IDS, type CueId } from './cues';
import { audio } from './engine';
import { useUiSound } from './useUiSound';
import { getCueSource, updateCueSource, updateAudioSettings, type AudioSource } from './settings';

const GROUPS = [...new Set(CUE_IDS.map((cue) => CUES[cue].group))];
const SCENES = [
  { id: 'island', label: 'Остров', description: 'Уютная островная тема' },
  { id: 'free', label: 'Свобода', description: 'Светлая тема свободы' },
  { id: 'epilogue', label: 'Эпилог', description: 'Короткая тема → свобода' },
] as const;

/** Отдельный ленивый экран: каждый звук можно послушать без запуска игры. */
export default function SoundShowcase() {
  useUiSound();
  const settings = useAudioSettings();
  const fileCues = CUE_IDS.filter((cue) => getCueSource(cue, settings) === 'file').length;
  const scene = useSyncExternalStore(audio.subscribeScene, audio.getScene, audio.getScene);
  const [ambience, setAmbience] = useState(false);
  const [storm, setStorm] = useState(false);
  const [lastCue, setLastCue] = useState<{ cue: CueId; source: AudioSource } | null>(null);
  useEffect(() => () => audio.stop(), []);

  const preview = (cue: CueId, variant?: number, source?: AudioSource) => {
    audio.unlock();
    void audio.audition(cue, { variant, source });
    setLastCue({ cue, source: source ?? getCueSource(cue) });
  };
  const stop = () => {
    audio.stop();
    setAmbience(false);
    setStorm(false);
  };

  return (
    <main className="sound-showcase">
      <div className="sound-content">
        <header className="sound-header">
          <div>
            <p className="sound-eyebrow">Архипелаг · мастерская</p>
            <h1>Звуки острова</h1>
            <p className="sound-intro">Выберите для каждого звука запись или синтез. Кнопки сравнения позволяют послушать оба варианта. В исходном наборе записи выбраны для отказа, дождя, грома, музыки острова и свободы; остальные звуки — синтез.</p>
          </div>
          <a className="btn ghost sm" href={asset('')} data-ui-sound="none">← К игре</a>
        </header>

        <div className="sound-workbench">
          <section className="panel sound-settings" aria-labelledby="sound-settings-title">
            <h2 id="sound-settings-title">Громкость</h2>
            <AudioSliders quiet localized={false} />
            <p className="sound-hint">Громкость и выбор звуков общие с игрой и сохраняются автоматически. Если запись недоступна, прозвучит запасной синтез.</p>
            <button type="button" className="sound-text-button" data-ui-sound="none" onClick={() => updateAudioSettings({ sources: {} })}>Вернуть исходный выбор звуков</button>
          </section>
          <section className="panel sound-layers" aria-labelledby="sound-layers-title">
            <div className="sound-section-heading">
              <h2 id="sound-layers-title">Остров в сборе</h2>
              <button type="button" className="btn ghost sm" data-ui-sound="none" onClick={stop}>■ Остановить всё</button>
            </div>
            <h3>Музыкальные сцены</h3>
            <div className="sound-scenes">
              {SCENES.map((item) => (
                <button
                  type="button" key={item.id} className={`btn ${scene === item.id ? 'primary' : 'ghost'} sound-scene`}
                  aria-pressed={scene === item.id} data-ui-sound="none"
                  onClick={() => { audio.unlock(); audio.setScene(item.id); }}
                >
                  <span>▶ {item.label}</span><small>{item.description}</small>
                </button>
              ))}
            </div>
            <button type="button" className="sound-text-button" data-ui-sound="none" onClick={() => audio.setScene(null)}>Остановить музыку</button>
            <div className="sound-nature">
              <div><h3>Природа</h3><p>Волны, ветер и редкие чайки</p></div>
              <button
                type="button" className={`btn ${ambience ? 'primary' : 'ghost'} sm`}
                aria-pressed={ambience} data-ui-sound="none"
                onClick={() => { audio.unlock(); audio.setAmbience(!ambience); setAmbience(!ambience); }}
              >{ambience ? '■ Остановить' : '▶ Запустить'}</button>
            </div>
            <label className="audio-switch sound-storm-switch">
              <span>Шторм <small>Дождь, ветер и мягкий гром</small></span>
              <input
                type="checkbox" role="switch" checked={storm} data-ui-sound="none"
                onChange={(event) => { audio.unlock(); setStorm(event.target.checked); audio.setWeather(event.target.checked ? 'storm' : 'clear'); }}
              />
            </label>
          </section>
        </div>

        <div className="sound-catalog-heading">
          <div><h2>Каталог</h2><p>В игре: {fileCues} — запись · {CUE_IDS.length - fileCues} — синтез</p></div>
          <button
            type="button" className="btn primary sm" data-ui-sound="none"
            onClick={() => {
              audio.unlock();
              for (let step = 0; step < 8; step++) audio.play('coin.tick', { delayMs: step * 170, pitchStep: step });
              setLastCue({ cue: 'coin.tick', source: getCueSource('coin.tick') });
            }}
          >▶ Каскад монет ×8</button>
        </div>
        <p className="sound-preview-status" role="status">{lastCue ? `Последний образец: ${CUES[lastCue.cue].label} · ${lastCue.source === 'file' ? 'запись' : 'синтез'}` : 'Нажмите ▶, чтобы послушать выбранный звук, или сравните оба варианта. Музыка звучит целиком; петли природы — фрагментом.'}</p>
        <div className="sound-catalog">
          {GROUPS.map((group) => (
            <section className="panel sound-group" key={group} aria-label={group}>
              <h3>{group}</h3>
              <ul>
                {CUE_IDS.filter((cue) => CUES[cue].group === group).map((cue) => (
                  <li className="sound-cue" key={cue}>
                    <button type="button" className="sound-play" aria-label={`Послушать: ${CUES[cue].label}`} data-ui-sound="none" onClick={() => preview(cue)}>▶</button>
                    <div className="sound-cue-info">
                      <b>{CUES[cue].label}</b><code>{cue}</code>
                      {(CUES[cue].files?.length ?? 0) > 1 && (
                        <div className="sound-variants" aria-label="Варианты записи">
                          <span>Записи:</span>{CUES[cue].files!.map((_, variant) => (
                            <button type="button" key={variant} className="sound-variant" aria-label={`Послушать: ${CUES[cue].label}, вариант ${variant + 1}`} data-ui-sound="none" onClick={() => preview(cue, variant, 'file')}>{variant + 1}</button>
                          ))}
                        </div>
                      )}
                    </div>
                    <label className="sound-source-choice">
                      <span>В игре</span>
                      <select aria-label={`В игре: ${CUES[cue].label}`} value={getCueSource(cue, settings)} data-ui-sound="none" onChange={(event) => { audio.unlock(); updateCueSource(cue, event.target.value as AudioSource); }}>
                        <option value="synth">Синтез</option>
                        <option value="file">Запись</option>
                      </select>
                    </label>
                    <div className="sound-compare" aria-label={`Сравнить: ${CUES[cue].label}`}>
                      <span>Сравнить</span>
                      <button type="button" data-ui-sound="none" aria-label={`Послушать синтез: ${CUES[cue].label}`} onClick={() => preview(cue, undefined, 'synth')}>▶ Синтез</button>
                      <button type="button" data-ui-sound="none" aria-label={`Послушать запись: ${CUES[cue].label}`} onClick={() => preview(cue, undefined, 'file')}>▶ Запись</button>
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      </div>
    </main>
  );
}
