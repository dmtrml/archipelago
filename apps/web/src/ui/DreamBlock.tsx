import { useEffect, useRef } from 'react';
import {
  dreamView, financeView, getPlayer, DREAM_WORK_EMPLOYED, DREAM_WORK_FREE, type DreamView,
} from '@arch/engine';
import { HUMAN, useGame } from '../store';
import { dreamCopy, useI18n } from '../i18n';
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
  const { t } = useI18n();
  return (
    <ol className={`dream-steps ${named ? 'named' : ''}`}>
      {view.def.stages.map((_, i) => {
        const copy = t.dream.stages[i];
        const status = i < built ? 'done' : i === built && building ? 'now' : i === built ? 'next' : 'locked';
        return (
          <li key={i} className={`step ${status}`} title={copy.title}>
            <i aria-hidden>{status === 'done' ? '✓' : i + 1}</i>
            {named ? <span>{copy.title}</span> : <span className="sr">{copy.title}</span>}
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
  const { t, fmt, plural } = useI18n();
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
  const dream = dreamCopy();
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
        <h4 className="dream-title">{t.ui.dreamBlock.dream}: {lowerFirst(dream.title)}</h4>
        <p className="dream-desc">{firstSentence(dream.description)}</p>
        <Steps view={view} named />
        <div className="dream-meta">
          <span>{t.ui.dreamBlock.threeStages}</span>
          <b>{fmt(totalCost)} <small>{plural(totalCost, t.units.coin)}</small></b>
        </div>
        <div className="dream-lock"><LockIcon /> {t.ui.dreamBlock.unlock}</div>
      </>
    );
  } else if (done) {
    body = (
      <>
        <div className="dream-top"><span className="kicker">{t.ui.dreamBlock.dream}</span><Steps view={view} /></div>
        <h5 className="dream-stage">{t.ui.dreamBlock.ready(state.doneWeek!)}</h5>
        <div className="nums two">
          <div className="num"><span>{t.ui.dreamBlock.upkeep}</span><b className="neg">−{fmt(def.upkeep)}<small>{t.ui.perWeek}</small></b></div>
          <div className="num"><span>{t.ui.dreamBlock.happiness}</span><b className="pos">+{fmt(def.joy)}<small>{t.ui.perWeek}</small></b></div>
        </div>
        <p className="dream-hint">{t.ui.dreamBlock.readyHint}</p>
      </>
    );
  } else if (stage && state.building) {
    const stageCopy = dreamCopy(view.stageIndex);
    const share = Math.min(1, state.progress / stage.work);
    body = (
      <>
        <div className="dream-top">
          <span className="kicker">{t.ui.dreamBlock.stage(view.stageIndex + 1, stages.length)}</span>
          <Steps view={view} />
        </div>
        <h5 className="dream-stage">{stageCopy.title}</h5>
        <div className="bar" role="progressbar" aria-valuenow={state.progress} aria-valuemax={stage.work}>
          <div className="fill" style={{ width: `${share * 100}%` }} />
        </div>
        <div className="dream-prog">
          <span>{t.ui.dreamBlock.progress(state.progress, daysText(stage.work))}</span>
          <b>{t.ui.dreamBlock.left(view.weeksLeft)}</b>
        </div>
        <p className="dream-hint">
          {me.employed
            ? <>{t.ui.dreamBlock.working(daysText(view.workPerWeek), speedUpText(), daysText(DREAM_WORK_FREE))}</>
            : <>{t.ui.dreamBlock.notWorking(daysText(view.workPerWeek))}</>}
        </p>
      </>
    );
  } else if (stage) {
    const stageCopy = dreamCopy(view.stageIndex);
    const last = view.stageIndex === stages.length - 1;
    const before = percent(fin.freedomRatio);
    const after = percent(view.freedomAfterDone);
    body = (
      <>
        <div className="dream-top">
          <span className="kicker">{t.ui.dreamBlock.stage(view.stageIndex + 1, stages.length)}</span>
          <Steps view={view} />
        </div>
        <h5 className="dream-stage">{stageCopy.title}</h5>
        <p className="dream-desc">{stageCopy.description}</p>
        <div className="nums two">
          <div className="num"><span>{t.ui.dreamBlock.price}</span><b>{fmt(stage.cost)}</b></div>
          <div className="num"><span>{t.ui.dreamBlock.work}</span><b>{daysText(stage.work)}</b></div>
        </div>
        <p className="dream-hint">{t.ui.dreamBlock.estimate(view.weeksLeft, daysText(DREAM_WORK_EMPLOYED), DREAM_WORK_FREE)}</p>
        {last && (
          <div className={`dream-after ${after < 100 ? 'neg' : ''}`}>
            <span>{t.ui.dreamBlock.freedomAfter}</span>
            <b>{before}% → {after}%</b>
            <small>{t.ui.dreamBlock.finalHint(fmt(def.upkeep), fmt(def.joy))}</small>
          </div>
        )}
        <button
          className="btn primary"
          disabled={!view.canStart}
          onClick={() => act({ type: 'buildDream', playerId: HUMAN }, t.ui.dreamBlock.started(stageCopy.title))}
        >
          {view.canStart
            ? t.ui.dreamBlock.start(fmt(stage.cost))
            : view.missingCash !== undefined
              ? t.ui.deals.missing(fmt(view.missingCash))
              : view.reason === 'beforeFreedom' ? t.errors.dreamBeforeFreedom
                : view.reason === 'building' ? t.errors.dreamBusy : t.errors.dreamDone}
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
