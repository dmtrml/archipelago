import { useEffect, useState, useSyncExternalStore } from 'react';
import { AudioSliders } from './AudioControls';
import { CUES, CUE_IDS, type CueId } from './cues';
import { audio } from './engine';
import { useUiSound } from './useUiSound';

const GROUPS = [...new Set(CUE_IDS.map((cue) => CUES[cue].group))];
const FILE_CUES = CUE_IDS.filter((cue) => CUES[cue].files?.length).length;
const SCENES = [
  { id: 'island', label: 'Остров', description: 'Уютная островная акустика' },
  { id: 'free', label: 'Свобода', description: 'Светлая акустическая тема' },
  { id: 'epilogue', label: 'Эпилог', description: 'Короткая тема → свобода' },
] as const;

/** Отдельный ленивый экран: каждый звук можно послушать без запуска игры. */
export default function SoundShowcase() {
  useUiSound();
  const scene = useSyncExternalStore(audio.subscribeScene, audio.getScene, audio.getScene);
  const [ambience, setAmbience] = useState(false);
  const [storm, setStorm] = useState(false);
  const [lastCue, setLastCue] = useState<CueId | null>(null);
  useEffect(() => () => audio.stop(), []);

  const preview = (cue: CueId, variant?: number) => {
    audio.unlock();
    void audio.audition(cue, { variant });
    setLastCue(cue);
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
            <p className="sound-intro">Послушайте звуки по отдельности или вместе. Пометка «файл» означает запись; если она недоступна, прозвучит запасной синтез.</p>
          </div>
          <a className="btn ghost sm" href="/" data-ui-sound="none">← К игре</a>
        </header>

        <div className="sound-workbench">
          <section className="panel sound-settings" aria-labelledby="sound-settings-title">
            <h2 id="sound-settings-title">Громкость</h2>
            <AudioSliders quiet />
            <p className="sound-hint">Настройки общие с игрой и сохраняются автоматически.</p>
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
          <div><h2>Каталог</h2><p>{CUE_IDS.length} звука · {FILE_CUES} из файлов · {CUE_IDS.length - FILE_CUES} — синтез</p></div>
          <button
            type="button" className="btn primary sm" data-ui-sound="none"
            onClick={() => {
              audio.unlock();
              for (let step = 0; step < 8; step++) audio.play('coin.tick', { delayMs: step * 170, pitchStep: step });
              setLastCue('coin.tick');
            }}
          >▶ Каскад монет ×8</button>
        </div>
        <p className="sound-preview-status" role="status">{lastCue ? `Последний образец: ${CUES[lastCue].label} · ${lastCue}` : 'Нажмите ▶, чтобы послушать образец. Музыкальные записи звучат целиком; петли природы — фрагментом.'}</p>
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
                          {CUES[cue].files!.map((_, variant) => (
                            <button type="button" key={variant} className="sound-variant" aria-label={`Послушать: ${CUES[cue].label}, вариант ${variant + 1}`} data-ui-sound="none" onClick={() => preview(cue, variant)}>{variant + 1}</button>
                          ))}
                        </div>
                      )}
                    </div>
                    <span className="sound-source">{CUES[cue].files?.length ? 'файл' : 'синтез'}</span>
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
