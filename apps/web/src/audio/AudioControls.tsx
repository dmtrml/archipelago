import { useId, useLayoutEffect, useRef, useState, useSyncExternalStore, type CSSProperties } from 'react';
import { createPortal } from 'react-dom';
import { asset } from '../asset';
import { useI18n } from '../i18n';
import { audio } from './engine';
import { getAudioSettings, subscribeAudioSettings, updateAudioSettings, type AudioSettings } from './settings';
import './audio.css';

export function useAudioSettings() {
  return useSyncExternalStore(subscribeAudioSettings, getAudioSettings, getAudioSettings);
}

const VOLUMES = [
  { key: 'music', label: 'Музыка' },
  { key: 'sfx', label: 'Эффекты' },
  { key: 'ambience', label: 'Природа' },
] as const;

/** Одни настройки шин для игры и витрины; ползунки работают и при выключенном звуке. */
export function AudioSliders({ quiet = false, localized = true }: { quiet?: boolean; localized?: boolean }) {
  const settings = useAudioSettings();
  const { t } = useI18n();
  const id = useId();
  const labels = localized ? [t.ui.music, t.ui.effects, t.ui.nature] : ['Музыка', 'Эффекты', 'Природа'];
  const change = (patch: Partial<AudioSettings>) => {
    audio.unlock();
    updateAudioSettings(patch);
  };
  return (
    <div className="audio-sliders">
      <label className="audio-switch">
        <span>{localized ? t.ui.soundOn : 'Звук включён'}</span>
        <input
          type="checkbox" role="switch" checked={settings.enabled}
          data-ui-sound={quiet ? 'none' : 'ui.toggle'}
          onChange={(event) => change({ enabled: event.target.checked })}
        />
      </label>
      {VOLUMES.map(({ key }, i) => (
        <div className="audio-volume" key={key}>
          <label htmlFor={`${id}-${key}`}>{labels[i]}</label>
          <output htmlFor={`${id}-${key}`}>{Math.round(settings[key] * 100)}%</output>
          <input
            id={`${id}-${key}`} type="range" min="0" max="1" step="0.01"
            value={settings[key]} aria-valuetext={`${Math.round(settings[key] * 100)}%`}
            onChange={(event) => change({ [key]: Number(event.target.value) })}
          />
        </div>
      ))}
    </div>
  );
}

function Speaker({ enabled }: { enabled: boolean }) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M11 5 6 9H3v6h3l5 4V5Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
      {enabled ? (
        <>
          <path d="M15 8a6 6 0 0 1 0 8M18 5a10 10 0 0 1 0 14" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        </>
      ) : <path d="m16 9 5 6m0-6-5 6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />}
    </svg>
  );
}

export function AudioControls() {
  const { t, lang, setLang } = useI18n();
  const settings = useAudioSettings();
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState<CSSProperties>({ visibility: 'hidden' });
  const button = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const id = useId();
  const close = (restoreFocus: boolean) => {
    setOpen(false);
    if (restoreFocus) button.current?.focus();
  };

  useLayoutEffect(() => {
    if (!open || !button.current || !panel.current) return;
    const trigger = button.current;
    const popup = panel.current;
    const measure = () => {
      const rect = trigger.getBoundingClientRect();
      const width = Math.min(300, window.innerWidth - 24);
      setPosition({
        width,
        left: Math.max(12, Math.min(window.innerWidth - width - 12, rect.right - width)),
        top: Math.max(12, Math.min(window.innerHeight - popup.offsetHeight - 12, rect.bottom + 10)),
      });
    };
    measure();
    const outside = (event: PointerEvent) => {
      if (!(event.target instanceof Node) || trigger.contains(event.target) || popup.contains(event.target)) return;
      setOpen(false);
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      event.stopPropagation();
      setOpen(false);
      trigger.focus({ preventScroll: true });
    };
    const observer = new ResizeObserver(measure);
    observer.observe(trigger);
    observer.observe(popup);
    const badge = trigger.closest('.badge');
    if (badge) observer.observe(badge);
    document.addEventListener('pointerdown', outside);
    document.addEventListener('keydown', escape);
    window.addEventListener('resize', measure);
    window.addEventListener('scroll', measure, true);
    return () => {
      observer.disconnect();
      document.removeEventListener('pointerdown', outside);
      document.removeEventListener('keydown', escape);
      window.removeEventListener('resize', measure);
      window.removeEventListener('scroll', measure, true);
    };
  }, [open]);

  useLayoutEffect(() => {
    // Первая разметка скрыта до измерения: фокусируем уже видимую панель.
    if (open && position.visibility !== 'hidden') {
      panel.current?.querySelector<HTMLInputElement>('input')?.focus({ preventScroll: true });
    }
  }, [open, position.visibility]);

  return (
    <>
      <button
        ref={button} type="button" className={`icon-btn audio-button ${open ? 'active' : ''}`}
        aria-label={`${t.ui.sound}: ${settings.enabled ? t.ui.soundEnabled : t.ui.soundDisabled}`} title={t.ui.soundSettings}
        aria-haspopup="dialog" aria-expanded={open} aria-controls={open ? `${id}-panel` : undefined}
        data-ui-sound={open ? 'ui.click' : 'ui.open'}
        onClick={() => { audio.unlock(); setOpen(!open); }}
      >
        <Speaker enabled={settings.enabled} />
      </button>
      {open && createPortal(
        <div ref={panel} id={`${id}-panel`} className="panel audio-panel" role="dialog" aria-labelledby={`${id}-title`} style={position}>
          <div className="audio-panel-head">
            <h2 id={`${id}-title`}>{t.ui.sound}</h2>
            <button type="button" className="icon-btn" aria-label={t.ui.closeSound} onClick={() => close(true)}>×</button>
          </div>
          <AudioSliders />
          <div className="language-row"><span>{t.ui.language}</span><div className="language-switch"><button type="button" className={lang === 'ru' ? 'active' : ''} onClick={() => setLang('ru')}>RU</button><button type="button" className={lang === 'en' ? 'active' : ''} onClick={() => setLang('en')}>EN</button></div></div>
          <a className="audio-catalog-link" href={asset('?sound')} data-ui-sound="none">{t.ui.audioCatalog}</a>
          <a className="audio-credits" href={asset('audio/CREDITS.md')} target="_blank" rel="noreferrer">{t.ui.audioCredits}</a>
        </div>,
        document.body,
      )}
    </>
  );
}
