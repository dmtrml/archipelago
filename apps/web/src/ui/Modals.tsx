import { useEffect, useState } from 'react';
import { HUMAN, useGame } from '../store';
import { fmt, signed } from '../format';
import { Emblem } from './TopBar';

export function WelcomeModal() {
  const newGame = useGame((s) => s.newGame);
  const [island, setIsland] = useState('Тихая Гавань');
  const [name, setName] = useState('');
  return (
    <div className="modal-backdrop">
      <form
        className="modal panel welcome"
        onSubmit={(e) => { e.preventDefault(); newGame(island.trim() || 'Тихая Гавань', name.trim() || 'Вы'); }}
      >
        <Emblem />
        <h2>Архипелаг</h2>
        <p className="lead">У вас есть маленький остров, работа и 600 монет. Соседи по архипелагу начинают с тем же.</p>
        <ul className="rules">
          <li><b className="pos">Активы</b> приносят деньги каждую неделю — даже когда вы не работаете.</li>
          <li><b className="neg">Пассивы</b> красивые, но только забирают деньги на содержание.</li>
          <li><b>Цель</b> — чтобы доход от активов покрыл все расходы. Это и есть финансовая свобода.</li>
        </ul>
        <label className="field">
          <span>Название острова</span>
          <input value={island} maxLength={24} onChange={(e) => setIsland(e.target.value)} />
        </label>
        <label className="field">
          <span>Ваше имя</span>
          <input value={name} maxLength={20} placeholder="Например, Аня" onChange={(e) => setName(e.target.value)} />
        </label>
        <button className="btn primary big" type="submit">Начать игру</button>
      </form>
    </div>
  );
}

function Confetti() {
  const [pieces] = useState(() => Array.from({ length: 70 }, (_, i) => ({
    left: Math.random() * 100,
    color: ['#F5B83D', '#E8735A', '#3E9A9A', '#23935E', '#FFF4E2'][i % 5],
    dx: Math.random() * 200 - 100,
    rot: Math.random() * 900 - 450,
    dur: 2.2 + Math.random() * 1.8,
    delay: Math.random() * 0.6,
  })));
  return (
    <>
      {pieces.map((p, i) => (
        <div
          key={i}
          className="confetti"
          style={{
            left: `${p.left}vw`, background: p.color, animationDuration: `${p.dur}s`, animationDelay: `${p.delay}s`,
            ['--dx' as string]: `${p.dx}px`, ['--rot' as string]: `${p.rot}deg`,
          }}
        />
      ))}
    </>
  );
}

export function WeekModal() {
  const modal = useGame((s) => s.modal);
  const close = useGame((s) => s.closeModal);
  useEffect(() => {
    if (!modal) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Enter' || e.key === 'Escape') close(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [modal, close]);
  if (!modal) return null;

  const mine = modal.report.players[HUMAN];
  const income = mine.salary + mine.assetIncome.reduce((s, a) => s + a.amount, 0);
  const expenses = mine.living + mine.upkeep.reduce((s, a) => s + a.amount, 0) + mine.interest + mine.insurance;

  return (
    <div className="modal-backdrop" onClick={close}>
      {modal.freedom && <Confetti />}
      <div className={`modal panel week ${modal.freedom ? 'freedom-modal' : ''}`} onClick={(e) => e.stopPropagation()}>
        <div className="kicker">Неделя {modal.report.week} · итоги</div>
        {modal.freedom ? (
          <>
            <h2>Финансовая свобода!</h2>
            <p className="lead">
              Ваши активы теперь приносят больше, чем стоит вся ваша жизнь на острове.
              Вы добились этого за {modal.report.week} недель. Можно продолжать расти — или посмотреть, как дела у соседей.
            </p>
          </>
        ) : (
          <h2>{modal.events.some((e) => e.tone === 'bad') ? 'Неспокойная неделя' : 'Интересная неделя'}</h2>
        )}

        <div className="events">
          {modal.events.map((e, i) => (
            <div key={i} className={`event ${e.tone}`}>
              <div className="event-head">
                <b>{e.title}</b>
                {e.cashDelta ? <span className={e.cashDelta > 0 ? 'pos' : 'neg'}>{signed(e.cashDelta)}</span> : null}
              </div>
              <p>{e.text}</p>
            </div>
          ))}
        </div>

        <div className="week-sum">
          <div><span>Доходы</span><b className="pos">+{fmt(income)}</b></div>
          <div><span>Расходы</span><b className="neg">−{fmt(expenses)}</b></div>
          <div><span>Итого</span><b className={mine.net >= 0 ? 'pos' : 'neg'}>{signed(mine.net)}</b></div>
          <div><span>Наличные</span><b>{fmt(mine.cashAfter)}</b></div>
        </div>
        <button className="btn primary big" onClick={close} autoFocus>Дальше</button>
      </div>
    </div>
  );
}

export function ToastView() {
  const toast = useGame((s) => s.toast);
  if (!toast) return null;
  return <div key={toast.id} className={`toast ${toast.tone}`} role="status">{toast.text}</div>;
}
