import { useEffect, useState } from 'react';
import { useCoach } from './coach';

const TEXT = {
  1: 'Купите первый актив — он будет приносить деньги каждую неделю.',
  2: 'Теперь завершите неделю: придут зарплата и доход от активов.',
  3: 'Главная цель: когда доход от активов покроет все расходы, шкала дойдёт до 100%. Это и есть финансовая свобода.',
} as const;

interface Placement { target: DOMRect; bubbleTop: number; bubbleLeft: number; above: boolean }

export function Coach() {
  const step = useCoach((s) => s.step);
  const targetUid = useCoach((s) => s.targetUid);
  const skip = useCoach((s) => s.skip);
  const finish = useCoach((s) => s.finish);
  const [placement, setPlacement] = useState<Placement | null>(null);

  useEffect(() => {
    if (!step) { setPlacement(null); return; }
    let frame = 0;
    const update = () => {
      const selector = step === 1 && targetUid
        ? `[data-offer-uid="${targetUid}"] .btn.primary`
        : step === 2 ? '[data-coach="next-week"]:not([hidden])' : '[data-coach="freedom"]';
      const candidates = [...document.querySelectorAll<HTMLElement>(selector)];
      let target = candidates.find((el) => {
        const r = el.getBoundingClientRect();
        return r.width > 0 && r.height > 0 && r.bottom > 0 && r.top < innerHeight;
      });
      if (!target && candidates[0]) {
        candidates[0].scrollIntoView({ block: 'center', inline: 'nearest' });
        target = candidates[0];
      }
      if (!target) setPlacement(null);
      else {
        const rect = target.getBoundingClientRect();
        const width = Math.min(300, innerWidth - 24);
        const above = rect.top >= 150;
        const bubbleTop = above ? Math.max(12, rect.top - 128) : Math.min(innerHeight - 120, rect.bottom + 18);
        const bubbleLeft = Math.max(12, Math.min(innerWidth - width - 12, rect.left + rect.width / 2 - width / 2));
        setPlacement({ target: rect, bubbleTop, bubbleLeft, above });
      }
      frame = requestAnimationFrame(update);
    };
    frame = requestAnimationFrame(update);
    return () => cancelAnimationFrame(frame);
  }, [step, targetUid]);

  useEffect(() => {
    if (!step) return;
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') skip(); };
    addEventListener('keydown', onKey);
    return () => removeEventListener('keydown', onKey);
  }, [step, skip]);

  if (!step || !placement) return null;
  const r = placement.target;
  return (
    <div className="coach" role="dialog" aria-live="polite">
      <div className="coach-ring" style={{ left: r.left - 6, top: r.top - 6, width: r.width + 12, height: r.height + 12, borderRadius: 18 }} />
      <div className={`coach-bubble ${placement.above ? 'above' : 'below'}`} style={{ left: placement.bubbleLeft, top: placement.bubbleTop }}>
        <div className="coach-kicker">Шаг {step} из 3</div>
        <p>{TEXT[step]}</p>
        {step === 3
          ? <button className="btn primary" type="button" onClick={finish}>Понятно</button>
          : <button className="coach-skip" type="button" onClick={skip}>Пропустить обучение</button>}
      </div>
    </div>
  );
}
