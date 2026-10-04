import { financeView, getPlayer } from '@arch/engine';
import { HUMAN, useGame } from '../store';
import { fmt } from '../format';
import { Coin, ConfirmButton, Meter } from './common';

export function Emblem() {
  return (
    <div className="emblem">
      <svg width="26" height="26" viewBox="0 0 26 26" fill="none" aria-hidden>
        <circle cx="17" cy="9" r="4.5" fill="#F5B83D" />
        <path d="M3 17c2.5 0 2.5-2 5-2s2.5 2 5 2 2.5-2 5-2 2.5 2 5 2" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" />
        <path d="M3 21.5c2.5 0 2.5-2 5-2s2.5 2 5 2 2.5-2 5-2 2.5 2 5 2" stroke="#fff" strokeOpacity=".55" strokeWidth="2.4" strokeLinecap="round" />
      </svg>
    </div>
  );
}

export function TopBar() {
  const world = useGame((s) => s.world)!;
  const resetGame = useGame((s) => s.resetGame);
  const me = getPlayer(world, HUMAN);
  const fin = financeView(world, HUMAN);

  return (
    <header className="top">
      <div className="panel badge">
        <Emblem />
        <div className="badge-text">
          <div className="title">{me.islandName}</div>
          <div className="sub">Неделя {world.week}{me.freedomWeek ? ` · свобода с ${me.freedomWeek}-й недели` : ''}{me.employed ? '' : ' · без работы'}</div>
        </div>
        <ConfirmButton className="icon-btn" confirmText="Начать заново?" onConfirm={resetGame}>
          <span aria-label="Новая игра">↺</span>
        </ConfirmButton>
      </div>

      <div className="stats">
        <div className="panel stat">
          <Coin />
          <div><div className="label">Наличные</div><div className="value">{fmt(me.cash)}</div></div>
        </div>
        <div className="panel stat">
          <div>
            <div className="label"><span className="long">Пассивный доход</span><span className="short">Доход</span></div>
            <div className="value pos">+{fmt(fin.passiveIncome)} <small>/нед</small></div>
          </div>
        </div>
        <div className="panel stat">
          <div><div className="label">Расходы</div><div className="value neg">−{fmt(fin.expenses.total)} <small>/нед</small></div></div>
        </div>
        <div className="panel stat happiness">
          <div>
            <div className="label">Счастье</div>
            <div className="value">{Math.round(me.happiness)}</div>
            <Meter value={me.happiness} />
          </div>
        </div>
      </div>
    </header>
  );
}
