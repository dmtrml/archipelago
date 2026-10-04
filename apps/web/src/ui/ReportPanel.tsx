import { assetViews, financeView, getPlayer, FREEDOM_LEVEL_RATIOS, FREEDOM_LEVEL_TITLES, THREAT_WEEKS } from '@arch/engine';
import { HUMAN, useGame } from '../store';
import { fmt, signed, weeks } from '../format';
import { Meter, Pips } from './common';
import { genitive, levelTitle, lowerFirst, percent } from './text';

/** До свободы шкала 0–100%; после — шкала запаса до последнего уровня, с отметками уровней. */
export function FreedomBlock() {
  const world = useGame((s) => s.world)!;
  const fin = financeView(world, HUMAN);
  const me = getPlayer(world, HUMAN);
  const pct = percent(fin.freedomRatio);

  // Свобода засчитывается движком в конце недели и только по настоящим активам
  if (me.freedomWeek === null) {
    const covered = fin.freedomRatio >= 1;
    return (
      <div className="freedom">
        <div className="freedom-head"><span>До финансовой свободы</span><b>{pct}%</b></div>
        <div className="bar"><div className="fill" style={{ width: `${Math.min(100, pct)}%` }} /></div>
        <div className="freedom-foot">
          {covered
            ? <>Расходы покрыты! Свобода засчитается, если доход <b>продержится до конца недели</b></>
            : <>Пассивный доход покрывает <b>{fmt(fin.passiveIncome)} из {fmt(fin.expenses.total)}</b> монет расходов в неделю</>}
        </div>
      </div>
    );
  }

  const level = fin.level;
  const free = level >= 1;
  const ticks = FREEDOM_LEVEL_RATIOS.slice(0, -1);
  const top = FREEDOM_LEVEL_RATIOS[FREEDOM_LEVEL_RATIOS.length - 1];
  const at = (ratio: number) => `${(ratio / top) * 100}%`;
  const weeksToReturn = Math.max(0, THREAT_WEEKS - me.threatWeeks);
  const shortfall = !free && fin.freedomRatio < 1;

  return (
    <div className={`freedom after ${free ? 'free' : ''}`}>
      <div className="freedom-head"><span>{levelTitle(level)}</span><b>{pct}%</b></div>
      <div className="bar scaled">
        <div className="fill" style={{ width: `${Math.min(100, (fin.freedomRatio / top) * 100)}%` }} />
        {ticks.map((r) => <i key={r} className="tick" style={{ left: at(r) }} />)}
      </div>
      <div className="scale" aria-hidden>
        {[...ticks, top].map((r) => <span key={r} style={{ left: at(r) }}>{percent(r)}%</span>)}
      </div>
      <div className="freedom-foot">
        {level < FREEDOM_LEVEL_RATIOS.length
          ? <>До «{genitive(FREEDOM_LEVEL_TITLES[level])}» — <b>{percent(FREEDOM_LEVEL_RATIOS[level])}%</b></>
          : <>Высший уровень: <b>{lowerFirst(levelTitle(level))}</b></>}
      </div>
      {!me.employed && me.threatWeeks > 0 && (
        <div className="warning freedom-warn">
          <span className="long">
            Свобода под угрозой: пассивный доход ниже расходов. Через {weeksToReturn} нед. придётся вернуться на работу
          </span>
          <span className="short">Свобода под угрозой · через {weeksToReturn} нед. на работу</span>
        </div>
      )}
      {!me.employed && me.threatWeeks === 0 && shortfall && (
        <div className="freedom-note warn">
          Пассивный доход ниже расходов. Если так будет в конце недели, начнётся отсчёт: {weeks(THREAT_WEEKS)} до возвращения на работу
        </div>
      )}
      {me.employed && shortfall && (
        <div className="freedom-note">
          Пассивный доход снова ниже расходов. Пока вы на работе, это не страшно — но уходить с неё рано.
        </div>
      )}
    </div>
  );
}

function Row({ label, value, tone, strong, muted }: {
  label: string; value: number; tone?: 'pos' | 'neg'; strong?: boolean; muted?: boolean;
}) {
  return (
    <div className={`row ${strong ? 'strong' : ''} ${muted ? 'muted-row' : ''}`}>
      <span>{label}</span>
      <b className={muted ? undefined : tone}>{muted ? fmt(value) : tone === 'neg' && value >= 0 ? `−${fmt(value)}` : signed(value)}</b>
    </div>
  );
}

/** Финансовый отчёт недели — главный обучающий инструмент, всегда на виду. */
export function Statement() {
  const world = useGame((s) => s.world)!;
  const me = getPlayer(world, HUMAN);
  const fin = financeView(world, HUMAN);
  const assets = assetViews(world, HUMAN);
  const assetsValue = assets.reduce((s, a) => s + a.saleValue, 0);
  const incomeCount = assets.filter((a) => a.currentIncome > 0).length;

  return (
    <div className="statement">
      <div className="st-group">
        <div className="st-title">Доходы за неделю</div>
        {me.employed
          ? <Row label={me.extraShift ? 'Зарплата + подработка' : 'Зарплата'} value={fin.salary} tone="pos" />
          : <Row label="Зарплата · не работаете" value={0} muted />}
        <Row label={`Активы${incomeCount ? ` (${incomeCount})` : ''}`} value={fin.passiveIncome} tone="pos" />
      </div>
      <div className="st-group">
        <div className="st-title">Расходы за неделю</div>
        <Row label="Жизнь" value={fin.expenses.living} tone="neg" />
        {fin.expenses.upkeep > 0 && <Row label="Содержание имущества" value={fin.expenses.upkeep} tone="neg" />}
        {fin.expenses.interest > 0 && <Row label="Проценты по долгам" value={fin.expenses.interest} tone="neg" />}
        {fin.expenses.insurance > 0 && <Row label="Страховка" value={fin.expenses.insurance} tone="neg" />}
      </div>
      <Row label="Итого за неделю" value={fin.net} tone={fin.net >= 0 ? 'pos' : 'neg'} strong />
      {fin.net < 0 && <div className="st-note neg">Расходы больше доходов — наличные тают.</div>}
      {me.employed && me.happiness < 30 && <div className="st-note neg">Счастье на исходе: ниже 20 — выгорание и ползарплаты. Отдохните во вкладке «Действия».</div>}

      <div className="capital">
        <div><span>Наличные</span><b>{fmt(me.cash)}</b></div>
        <div><span>Имущество</span><b>{fmt(assetsValue)}</b></div>
        <div><span>Долги</span><b className={fin.debt > 0 ? 'neg' : ''}>{fin.debt > 0 ? `−${fmt(fin.debt)}` : '0'}</b></div>
        <div className="total"><span>Капитал</span><b>{fmt(fin.netWorth)}</b></div>
      </div>

      <div className="traits">
        <div>
          <span>Счастье</span>
          <Meter value={me.happiness} />
        </div>
        <div>
          <span>Знания</span>
          <Pips value={me.knowledge} max={3} />
        </div>
      </div>
    </div>
  );
}
