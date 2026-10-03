import { useEffect, useRef, useState, type ReactNode } from 'react';

export function Coin({ size = 'md' }: { size?: 'sm' | 'md' }) {
  return <span className={`coin ${size === 'sm' ? 'sm' : ''}`} aria-hidden />;
}

export function Meter({ value, max = 100, tone }: { value: number; max?: number; tone?: 'good' | 'warn' | 'bad' }) {
  const t = tone ?? (value / max > 0.5 ? 'good' : value / max > 0.25 ? 'warn' : 'bad');
  return (
    <div className="meter" role="meter" aria-valuenow={value} aria-valuemax={max}>
      <div className={`meter-fill ${t}`} style={{ width: `${Math.max(0, Math.min(100, (value / max) * 100))}%` }} />
    </div>
  );
}

export function Pips({ value, max }: { value: number; max: number }) {
  return (
    <span className="pips" aria-label={`${value} из ${max}`}>
      {Array.from({ length: max }, (_, i) => <span key={i} className={i < value ? 'on' : ''} />)}
    </span>
  );
}

/** Кнопка с подтверждением вторым нажатием — для необратимых действий вроде продажи. */
export function ConfirmButton({ children, confirmText, onConfirm, className = 'btn ghost sm', disabled }: {
  children: ReactNode; confirmText: ReactNode; onConfirm: () => void; className?: string; disabled?: boolean;
}) {
  const [armed, setArmed] = useState(false);
  const timer = useRef<number>(undefined);
  useEffect(() => () => window.clearTimeout(timer.current), []);
  return (
    <button
      className={`${className} ${armed ? 'armed' : ''}`}
      disabled={disabled}
      onClick={() => {
        if (armed) { setArmed(false); onConfirm(); return; }
        setArmed(true);
        timer.current = window.setTimeout(() => setArmed(false), 3000);
      }}
    >
      {armed ? confirmText : children}
    </button>
  );
}

export function Section({ title, aside, children }: { title: string; aside?: ReactNode; children: ReactNode }) {
  return (
    <section className="section">
      <div className="section-head"><h4>{title}</h4>{aside}</div>
      {children}
    </section>
  );
}
