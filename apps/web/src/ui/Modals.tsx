import { useEffect, useState } from 'react';
import { DREAMS, DREAM_WORK_EMPLOYED, getPlayer } from '@arch/engine';
import { HUMAN, useGame, type WeekModal as WeekModalData } from '../store';
import { fmt, signed, weeks } from '../format';
import { Confetti } from './common';
import { EpilogueModal } from './Epilogue';
import { daysText, lowerFirst, speedUpText } from './text';
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
          <li><b>Мечта</b> — шхуна для кругосветки. Строить её можно после свободы.</li>
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

/** Развилка в момент свободы: остаться на работе или уйти. Решение можно поменять во вкладке «Действия». */
function FreedomChoice({ onStay, onQuit }: { onStay: () => void; onQuit: () => void }) {
  return (
    <div className="choice">
      <div className="choice-title">Что дальше?</div>
      <div className="choice-cards">
        <div className="choice-card">
          <h3>Остаться на работе</h3>
          <p>Зарплата и дальше ускоряет рост, а мечта строится по выходным: {daysText(DREAM_WORK_EMPLOYED)} в неделю.</p>
          <button className="btn primary" onClick={onStay} autoFocus>Остаться</button>
        </div>
        <div className="choice-card">
          <h3>Уйти с работы</h3>
          <p>Будни не отнимают счастье, мечта строится {speedUpText()}, но без запаса свобода хрупкая.</p>
          <button className="btn ghost" onClick={onQuit}>Уйти с работы</button>
        </div>
      </div>
      <p className="hint-text">Выбор можно поменять в любой момент во вкладке «Действия».</p>
    </div>
  );
}

function WeekSummary({ modal }: { modal: WeekModalData }) {
  const mine = modal.report.players[HUMAN];
  const income = mine.salary + mine.assetIncome.reduce((s, a) => s + a.amount, 0);
  const expenses = mine.living + mine.upkeep.reduce((s, a) => s + a.amount, 0) + mine.interest + mine.insurance;
  return (
    <div className="week-sum">
      <div><span>Доходы</span><b className="pos">+{fmt(income)}</b></div>
      <div><span>Расходы</span><b className="neg">−{fmt(expenses)}</b></div>
      <div><span>Итого</span><b className={mine.net >= 0 ? 'pos' : 'neg'}>{signed(mine.net)}</b></div>
      <div><span>Наличные</span><b>{fmt(mine.cashAfter)}</b></div>
    </div>
  );
}

export function WeekModal() {
  const modal = useGame((s) => s.modal);
  const close = useGame((s) => s.closeModal);
  const act = useGame((s) => s.act);
  useEffect(() => {
    if (!modal) return;
    const onKey = (e: KeyboardEvent) => {
      // Enter на сфокусированной кнопке нажимает именно её; окно закрываем только по Enter «в пустоту»
      if (e.key === 'Enter' && (e.target as HTMLElement | null)?.closest('button')) return;
      if (e.key === 'Enter' || e.key === 'Escape') close();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [modal, close]);
  const world = useGame((s) => s.world);
  if (!modal || !world) return null;
  if (modal.epilogue) return <EpilogueModal modal={modal} />;

  const dream = getPlayer(world, HUMAN).dream;
  const dreamTitle = dream ? lowerFirst(DREAMS[dream.id].title) : null;
  const quit = () => {
    if (act({ type: 'quitJob', playerId: HUMAN }, 'Вы больше не работаете')) close();
  };

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
              Вы добились этого за {weeks(modal.report.week)}.
            </p>
            {dreamTitle && <div className="dream-unlocked">Мечта открыта: {dreamTitle}. Теперь её можно строить.</div>}
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

        <WeekSummary modal={modal} />
        {modal.freedom
          ? <FreedomChoice onStay={close} onQuit={quit} />
          : <button className="btn primary big" onClick={close} autoFocus>Дальше</button>}
      </div>
    </div>
  );
}

export function ToastView() {
  const toast = useGame((s) => s.toast);
  if (!toast) return null;
  return <div key={toast.id} className={`toast ${toast.tone}`} role="status">{toast.text}</div>;
}
