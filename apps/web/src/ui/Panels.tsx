import { useEffect, useState, type ReactNode } from 'react';
import { financeView, offerViews } from '@arch/engine';
import { HUMAN, useGame, type Tab } from '../store';
import { signed } from '../format';
import { DealsTab } from './DealsTab';
import { IslandTab } from './IslandTab';
import { ActionsTab } from './ActionsTab';
import { DreamBlock } from './DreamBlock';
import { FreedomBlock, Statement } from './ReportPanel';

export function useMediaQuery(query: string) {
  const [match, setMatch] = useState(() => window.matchMedia(query).matches);
  useEffect(() => {
    const mq = window.matchMedia(query);
    const on = () => setMatch(mq.matches);
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, [query]);
  return match;
}

const TAB_LABEL: Record<Tab, string> = {
  report: 'Отчёт',
  deals: 'Сделки',
  island: 'Остров',
  actions: 'Действия',
};

function TabContent({ tab }: { tab: Tab }) {
  switch (tab) {
    case 'deals': return <DealsTab />;
    case 'island': return <IslandTab />;
    case 'actions': return <ActionsTab />;
    case 'report': return <div className="tab-body"><FreedomBlock /><DreamBlock /><Statement /></div>;
  }
}

function Tabs({ tabs, extra }: { tabs: Tab[]; extra?: ReactNode }) {
  const world = useGame((s) => s.world)!;
  const tab = useGame((s) => s.tab);
  const setTab = useGame((s) => s.setTab);
  const affordable = offerViews(world, HUMAN).filter((v) => v.canAfford && !v.locked && !v.slotFull).length;
  const tired = world.players[0].employed && world.players[0].happiness < 30;
  return (
    <nav className="tabs" role="tablist">
      {tabs.map((t) => (
        <button key={t} role="tab" aria-selected={tab === t} className={`tab ${tab === t ? 'active' : ''}`} onClick={() => setTab(t)}>
          {TAB_LABEL[t]}
          {t === 'deals' && affordable > 0 && <span className="badge-count">{affordable}</span>}
          {t === 'actions' && tired && <span className="badge-count alert" title="Пора отдохнуть">!</span>}
        </button>
      ))}
      {extra}
    </nav>
  );
}

export function NextWeekButton({ compact }: { compact?: boolean }) {
  const world = useGame((s) => s.world)!;
  const endWeek = useGame((s) => s.endWeek);
  const busy = useGame((s) => s.busy);
  const fin = financeView(world, HUMAN);
  return (
    <button className={`btn next ${compact ? 'compact' : ''}`} onClick={endWeek} disabled={busy}>
      <span className="next-main">Следующая неделя <span aria-hidden>→</span></span>
      {!compact && <span className="next-sub">≈ {signed(fin.net)} к наличным</span>}
    </button>
  );
}

/** Компьютер: отчёт слева, вкладки справа, кнопка хода внизу по центру. */
export function DesktopLayout() {
  const tab = useGame((s) => s.tab);
  const current = tab === 'report' ? 'deals' : tab;
  return (
    <>
      <aside className="col-left">
        <div className="panel pad"><FreedomBlock /></div>
        <DreamBlock panel />
        <div className="panel pad scroll"><Statement /></div>
      </aside>
      <aside className="col-right panel">
        <Tabs tabs={['deals', 'island', 'actions']} />
        <div className="tab-scroll"><TabContent tab={current} /></div>
      </aside>
      <div className="col-center"><NextWeekButton /></div>
    </>
  );
}

/** Телефон: компактная полоса свободы и выдвижная шторка со вкладками. */
export function MobileLayout() {
  const tab = useGame((s) => s.tab);
  const open = useGame((s) => s.sheetOpen);
  const setOpen = useGame((s) => s.setSheetOpen);
  return (
    <div className={`sheet panel ${open ? 'open' : ''}`}>
      <button className="sheet-handle" onClick={() => setOpen(!open)} aria-label={open ? 'Свернуть' : 'Развернуть'}>
        <span />
      </button>
      {!open && <div className="sheet-freedom"><FreedomBlock /></div>}
      <Tabs tabs={['report', 'deals', 'island', 'actions']} />
      {open && <div className="tab-scroll"><TabContent tab={tab} /></div>}
      <div className="sheet-cta"><NextWeekButton compact /></div>
    </div>
  );
}
