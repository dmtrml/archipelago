import { useEffect } from 'react';
import { financeView, getPlayer, leaderboard } from '@arch/engine';
import { HUMAN, useGame, type WeekModal } from '../store';
import { Confetti, ConfirmButton, Meter } from './common';
import { levelTitle, percent } from './text';
import { weeksAcc } from '../format';
import { share } from '../share';
import { track } from '../analytics';

/** «Мия, Борис и Тимур». */
const names = (list: string[]) => (list.length > 1 ? `${list.slice(0, -1).join(', ')} и ${list[list.length - 1]}` : list[0]);

/** Соседи: кто и когда достиг свободы. Без склонений имён — они придумываются ботам заново. */
function neighboursLine(rows: ReturnType<typeof leaderboard>): string {
  const bots = rows.filter((r) => r.isBot);
  if (bots.length === 0) return '';
  const reached = bots
    .filter((r) => r.freedomWeek !== null)
    .sort((a, b) => a.freedomWeek! - b.freedomWeek!);
  const waiting = bots.filter((r) => r.freedomWeek === null).map((r) => r.name);
  if (reached.length === 0) return 'Соседи по архипелагу ещё в пути к свободе — у каждого свой темп.';
  const done = reached.map((r, i) => (i === 0 ? `${r.name} — свобода с ${r.freedomWeek}-й недели` : `${r.name} — с ${r.freedomWeek}-й`)).join(', ');
  const tail = waiting.length > 0 ? `; ${names(waiting)} ещё в пути` : '';
  return `Соседи: ${done}${tail}.`;
}

/** Эпилог: мечта построена. Итог по четырём осям, без единого счёта — разные пути одинаково честные. */
export function EpilogueModal({ modal }: { modal: WeekModal }) {
  const world = useGame((s) => s.world)!;
  const close = useGame((s) => s.closeModal);
  const resetGame = useGame((s) => s.resetGame);
  const me = getPlayer(world, HUMAN);
  const fin = financeView(world, HUMAN);
  const neighbours = neighboursLine(leaderboard(world));

  // Escape тоже «играть дальше»; Enter на кнопке нажимает её саму
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') close(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [close]);

  const dreamWeek = me.dream?.doneWeek ?? modal.report.week;
  const happiness = Math.round(me.happiness);
  const feedbackUrl = import.meta.env.VITE_FEEDBACK_URL?.trim();

  return (
    <div className="modal-backdrop" onClick={close}>
      <Confetti />
      <div className="modal panel week epilogue" onClick={(e) => e.stopPropagation()}>
        <div className="kicker">Эпилог</div>
        <h2>Шхуна уходит в кругосветку</h2>
        <p className="lead">
          Прошли годы. Остров «{me.islandName}» по-прежнему живёт на доходы своих активов, а шхуна, которую вы строили
          этап за этапом, вышла из бухты и взяла курс за горизонт. Дома вас ждёт остров, который прекрасно справляется сам.
        </p>

        <div className="results">
          <div className="result">
            <span>Свобода</span>
            <b>{me.freedomWeek !== null ? `с ${me.freedomWeek}-й недели` : 'впереди'}</b>
          </div>
          <div className="result">
            <span>Мечта</span>
            <b>построена на {dreamWeek}-й неделе</b>
          </div>
          <div className="result">
            <span>Запас</span>
            <b>{levelTitle(fin.level)} · {percent(fin.freedomRatio)}%</b>
          </div>
          <div className="result">
            <span>Счастье</span>
            <b>{happiness}</b>
            <Meter value={me.happiness} />
          </div>
        </div>

        {neighbours && <p className="neighbours">{neighbours}</p>}
        <p className="hint-text">
          Быстрее или спокойнее, с запасом или с радостью — честных путей несколько, и этот был вашим.
        </p>

        <div className="epilogue-actions">
          <button className="btn primary big" onClick={close} autoFocus>Играть дальше</button>
          <ConfirmButton className="btn ghost big" confirmText="Точно? Остров начнётся заново" onConfirm={resetGame}>
            Новая игра
          </ConfirmButton>
          <button className="btn ghost big" type="button" onClick={() => void share(`Архипелаг: свобода за ${weeksAcc(me.freedomWeek ?? modal.report.week)}, шхуна для кругосветки — за ${weeksAcc(dreamWeek)} 🏝 Сможете быстрее?`)}>Поделиться результатом</button>
        </div>
        {feedbackUrl && <a className="secondary-link feedback-link" href={feedbackUrl} target="_blank" rel="noreferrer" onClick={() => track('feedback-open')}>Написать отзыв ↗</a>}
      </div>
    </div>
  );
}
