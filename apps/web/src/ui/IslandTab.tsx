import { useEffect, useRef } from 'react';
import { assetViews, financeView, SLOT_CAPACITY, type AssetView, type SlotType } from '@arch/engine';
import { HUMAN, useGame } from '../store';
import { fmt, signed } from '../format';
import { ConfirmButton, FreedomLine, Pips } from './common';

/** Места на острове, которые видны игроку (вклады и доли живут в банке без мест). */
const SLOTS: { slot: SlotType; name: string }[] = [
  { slot: 'pier', name: 'Пирс' },
  { slot: 'plot', name: 'Участки' },
  { slot: 'beach', name: 'Пляж' },
  { slot: 'plaza', name: 'Площадь' },
  { slot: 'sea', name: 'Бухта' },
];

/** Места под доходные активы: если они кончились, расти дальше можно только улучшениями. */
const INCOME_SLOTS: SlotType[] = ['pier', 'plot', 'beach'];

export function IslandTab() {
  const world = useGame((s) => s.world)!;
  const act = useGame((s) => s.act);
  const setTab = useGame((s) => s.setTab);
  const highlight = useGame((s) => s.highlightUid);
  const views = assetViews(world, HUMAN);
  const fin = financeView(world, HUMAN);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!highlight) return;
    listRef.current?.querySelector(`[data-uid="${highlight}"]`)?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [highlight]);

  const assets = views.filter((v) => v.def.kind !== 'status');
  const status = views.filter((v) => v.def.kind === 'status');

  if (views.length === 0) {
    return (
      <div className="tab-body">
        <div className="empty">
          На острове пока только ваш дом. Активы приносят деньги каждую неделю — даже когда вы отдыхаете.
          <button className="btn primary" onClick={() => setTab('deals')}>Посмотреть сделки</button>
        </div>
      </div>
    );
  }

  const used = (slot: SlotType) => views.filter((v) => v.def.slot === slot).length;
  const crowded = INCOME_SLOTS.some((slot) => used(slot) >= SLOT_CAPACITY[slot]);

  const row = (v: AssetView) => {
    const isStatus = v.def.kind === 'status';
    const up = v.upgrade;
    return (
      <div key={v.asset.uid} data-uid={v.asset.uid} className={`asset-row ${highlight === v.asset.uid ? 'flash' : ''} ${v.asset.damaged ? 'damaged' : ''}`}>
        <span className={`dot ${isStatus ? 'liability' : 'asset'}`} />
        <div className="asset-main">
          <div className="asset-title">
            {v.title}
            {v.maxLevel > 1 && <Pips value={v.level} max={v.maxLevel} />}
          </div>
          <div className="asset-sub">
            {v.asset.damaged
              ? <span className="neg">Повреждено штормом — дохода нет</span>
              : <>
                  {v.currentIncome > 0 && <span className="pos">+{fmt(v.currentIncome)}</span>}
                  {v.upkeep > 0 && <span className="neg">−{fmt(v.upkeep)}</span>}
                  <span className="muted">в неделю</span>
                </>}
          </div>
        </div>
        <div className="asset-actions">
          {v.asset.damaged && (
            <button className="btn primary sm" onClick={() => act({ type: 'repairAsset', playerId: HUMAN, assetUid: v.asset.uid }, 'Починили!')}>
              Починить {fmt(v.repairCost)}
            </button>
          )}
          <ConfirmButton
            confirmText={<>Точно? +{fmt(v.saleValue)}</>}
            onConfirm={() => act({ type: 'sellAsset', playerId: HUMAN, assetUid: v.asset.uid }, `Продано за ${fmt(v.saleValue)}`)}
          >
            Продать
          </ConfirmButton>
        </div>

        {up && (
          <div className="upgrade">
            <div className="upgrade-text">
              <b><span aria-hidden>↑</span> {up.def.title}</b>
              <span>
                <span className="pos">{signed(up.incomeGain)}</span>
                {up.upkeepGain > 0 && <> · <span className="neg">−{fmt(up.upkeepGain)}</span> содерж.</>}
                {up.paybackWeeks ? <> · окупится за {up.paybackWeeks} нед.</> : null}
              </span>
              <FreedomLine before={fin.freedomRatio} after={up.freedomAfter} />
            </div>
            <button
              className="btn primary sm"
              disabled={!up.canUpgrade}
              onClick={() => act({ type: 'upgradeAsset', playerId: HUMAN, assetUid: v.asset.uid }, `Теперь это ${up.def.title.toLowerCase()}!`)}
            >
              {up.canUpgrade ? `Улучшить ${fmt(up.cost)}` : up.reason}
            </button>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="tab-body" ref={listRef}>
      <div className="capital-mini">
        <div><span>Приносит</span><b className="pos">+{fmt(fin.passiveIncome)}/нед</b></div>
        <div><span>Капитал</span><b>{fmt(fin.netWorth)}</b></div>
      </div>
      <div className="slots">
        {SLOTS.map(({ slot, name }) => {
          const n = used(slot), cap = SLOT_CAPACITY[slot];
          return <span key={slot} className={`chip ${n >= cap ? 'full' : ''}`}>{name} {n}/{cap}</span>;
        })}
      </div>
      {crowded && (
        <div className="hint-text">
          Места на острове кончаются. Расти дальше можно улучшениями: то же место — больше дохода.
        </div>
      )}
      {assets.length > 0 && <div className="list-title">Активы — кладут деньги в карман</div>}
      {assets.map(row)}
      {status.length > 0 && <div className="list-title">Пассивы — забирают деньги из кармана</div>}
      {status.map(row)}
    </div>
  );
}
