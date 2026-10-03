import { assetViews, financeView, getPlayer } from '@arch/engine';
import { HUMAN, useGame } from '../store';
import { fmt, signed } from '../format';
import { Meter, Pips } from './common';

export function FreedomBlock() {
  const world = useGame((s) => s.world)!;
  const fin = financeView(world, HUMAN);
  const me = getPlayer(world, HUMAN);
  const covered = fin.freedomRatio >= 1;
  // Свобода засчитывается движком в конце недели и только по настоящим активам
  const free = covered && me.freedomWeek !== null;
  const pct = Math.round(fin.freedomRatio * 100);
  return (
    <div className={`freedom ${free ? 'free' : ''}`}>
      <div className="freedom-head"><span>До финансовой свободы</span><b>{pct}%</b></div>
      <div className="bar"><div className="fill" style={{ width: `${Math.min(100, pct)}%` }} /></div>
      <div className="freedom-foot">
        {free
          ? <>Пассивный доход <b>покрывает все расходы</b>. Работать больше не обязательно</>
          : covered
            ? <>Расходы покрыты! Свобода засчитается, если доход <b>продержится до конца недели</b></>
            : <>Пассивный доход покрывает <b>{fmt(fin.passiveIncome)} из {fmt(fin.expenses.total)}</b> монет расходов в неделю</>}
      </div>
    </div>
  );
}

function Row({ label, value, tone, strong }: { label: string; value: number; tone?: 'pos' | 'neg'; strong?: boolean }) {
  return (
    <div className={`row ${strong ? 'strong' : ''}`}>
      <span>{label}</span>
      <b className={tone}>{tone === 'neg' ? `−${fmt(value)}` : signed(value)}</b>
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
        <Row label={me.extraShift ? 'Зарплата + подработка' : 'Зарплата'} value={fin.salary} tone="pos" />
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
      {me.happiness < 30 && <div className="st-note neg">Счастье на исходе: ниже 20 — выгорание и ползарплаты. Отдохните во вкладке «Действия».</div>}

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
