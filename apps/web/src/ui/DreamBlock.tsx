import { useEffect, useRef } from 'react';
import {
  dreamView, financeView, getPlayer, DREAM_WORK_EMPLOYED, DREAM_WORK_FREE, type DreamView,
} from '@arch/engine';
import { HUMAN, useGame } from '../store';
import { fmt, plural } from '../format';
import { daysText, firstSentence, lowerFirst, percent, speedUpText } from './text';

function LockIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 14 14" fill="none" aria-hidden>
      <rect x="2.5" y="6" width="9" height="6.5" rx="1.8" fill="currentColor" />
      <path d="M4.6 6V4.5a2.4 2.4 0 0 1 4.8 0V6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

/** Три маленьких этапа: готов / строится / ещё впереди. С названиями — для описания цели до свободы. */
function Steps({ view, named }: { view: DreamView; named?: boolean }) {
  const { built, building } = view.state;
  return (
    <ol className={`dream-steps ${named ? 'named' : ''}`}>
      {view.def.stages.map((st, i) => {
        const status = i < built ? 'done' : i === built && building ? 'now' : i === built ? 'next' : 'locked';
        return (
          <li key={st.title} className={`step ${status}`} title={st.title}>
            <i aria-hidden>{status === 'done' ? '✓' : i + 1}</i>
            {named ? <span>{st.title}</span> : <span className="sr">{st.title}</span>}
          </li>
        );
      })}
    </ol>
  );
}

/**
 * Мечта игрока. Видна всегда, с первой недели: до свободы это цель, после — проект с этапами.
 * `panel` — на компьютере блок сам стоит панелью в левой колонке, на телефоне — карточка во вкладке «Отчёт».
 */
export function DreamBlock({ panel }: { panel?: boolean }) {
  const world = useGame((s) => s.world)!;
  const act = useGame((s) => s.act);
  const flash = useGame((s) => s.highlightUid) === 'dream';
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (flash) ref.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [flash]);

  const view = dreamView(world, HUMAN);
  if (!view) return null;
  const me = getPlayer(world, HUMAN);
  const fin = financeView(world, HUMAN);
  const { def, state, stage } = view;
  const stages = def.stages;
  const unlocked = me.freedomWeek !== null;
  const done = state.doneWeek !== null;
  const totalCost = stages.reduce((sum, st) => sum + st.cost, 0);
  const cls = `dream ${panel ? 'panel pad' : 'card'} ${flash ? 'flash' : ''}`;

  let body;
  if (!unlocked) {
    // Цель видна с первой недели — игрок знает, ради чего копит
    body = (
      <>
        <h4 className="dream-title">Мечта: {lowerFirst(def.title)}</h4>
        <p className="dream-desc">{firstSentence(def.description)}</p>
        <Steps view={view} named />
        <div className="dream-meta">
          <span>Три этапа</span>
          <b>{fmt(totalCost)} <small>{plural(totalCost, ['монета', 'монеты', 'монет'])}</small></b>
        </div>
        <div className="dream-lock"><LockIcon /> Откроется после финансовой свободы</div>
      </>
    );
  } else if (done) {
    body = (
      <>
        <div className="dream-top"><span className="kicker">Мечта</span><Steps view={view} /></div>
        <h5 className="dream-stage">Шхуна готова с {state.doneWeek}-й недели</h5>
        <div className="nums two">
          <div className="num"><span>Содержание</span><b className="neg">−{fmt(def.upkeep)}<small>/нед</small></b></div>
          <div className="num"><span>Счастье</span><b className="pos">+{fmt(def.joy)}<small>/нед</small></b></div>
        </div>
        <p className="dream-hint">Шхуна — красивый пассив: она тянет деньги, но каждую неделю радует.</p>
      </>
    );
  } else if (stage && state.building) {
    const share = Math.min(1, state.progress / stage.work);
    body = (
      <>
        <div className="dream-top">
          <span className="kicker">Мечта · этап {view.stageIndex + 1} из {stages.length}</span>
          <Steps view={view} />
        </div>
        <h5 className="dream-stage">{stage.title}</h5>
        <div className="bar" role="progressbar" aria-valuenow={state.progress} aria-valuemax={stage.work}>
          <div className="fill" style={{ width: `${share * 100}%` }} />
        </div>
        <div className="dream-prog">
          <span>{state.progress} из {daysText(stage.work)}</span>
          <b>осталось ≈ {view.weeksLeft} нед.</b>
        </div>
        <p className="dream-hint">
          {me.employed
            ? <>Сейчас вы строите {daysText(view.workPerWeek)} в неделю. Без работы стройка идёт <b>{speedUpText()}</b>: {daysText(DREAM_WORK_FREE)} в неделю.</>
            : <>Вы не работаете, поэтому на стройку уходит {daysText(view.workPerWeek)} в неделю.</>}
        </p>
      </>
    );
  } else if (stage) {
    const last = view.stageIndex === stages.length - 1;
    const before = percent(fin.freedomRatio);
    const after = percent(view.freedomAfterDone);
    body = (
      <>
        <div className="dream-top">
          <span className="kicker">Мечта · этап {view.stageIndex + 1} из {stages.length}</span>
          <Steps view={view} />
        </div>
        <h5 className="dream-stage">{stage.title}</h5>
        <p className="dream-desc">{stage.description}</p>
        <div className="nums two">
          <div className="num"><span>Цена</span><b>{fmt(stage.cost)}</b></div>
          <div className="num"><span>Работа</span><b>{stage.work} <small>{plural(stage.work, ['день', 'дня', 'дней'])}</small></b></div>
        </div>
        <p className="dream-hint">
          <b>≈ {view.weeksLeft} нед.</b> — работая, вы строите {daysText(DREAM_WORK_EMPLOYED)} в неделю, без работы — {DREAM_WORK_FREE}
        </p>
        {last && (
          <div className={`dream-after ${after < 100 ? 'neg' : ''}`}>
            <span>Свобода после постройки</span>
            <b>{before}% → {after}%</b>
            <small>Готовая шхуна — пассив: −{fmt(def.upkeep)} в неделю, зато +{fmt(def.joy)} счастья</small>
          </div>
        )}
        <button
          className="btn primary"
          disabled={!view.canStart}
          onClick={() => act({ type: 'buildDream', playerId: HUMAN }, `Начали этап: ${stage.title}`)}
        >
          {view.canStart ? `Начать этап за ${fmt(stage.cost)}` : view.reason}
        </button>
      </>
    );
  }

  return (
    <div ref={ref} className={cls}>
      {body}
    </div>
  );
}
