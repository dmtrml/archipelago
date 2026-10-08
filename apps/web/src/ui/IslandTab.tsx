import { useEffect, useRef } from 'react';
import { assetViews, financeView, SLOT_CAPACITY, type AssetView, type SlotType } from '@arch/engine';
import { HUMAN, useGame } from '../store';
import { assetCopy, errorText, useI18n } from '../i18n';
import { ConfirmButton, FreedomLine, Pips } from './common';

/** Места на острове, которые видны игроку (вклады и доли живут в банке без мест). */
const SLOTS: SlotType[] = ['pier', 'plot', 'beach', 'plaza', 'sea'];

/** Места под доходные активы: если они кончились, расти дальше можно только улучшениями. */
const INCOME_SLOTS: SlotType[] = ['pier', 'plot', 'beach'];

export function IslandTab() {
  const { t, fmt, signed } = useI18n();
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
          {t.ui.island.empty}
          <button className="btn primary" onClick={() => setTab('deals')}>{t.ui.island.seeDeals}</button>
        </div>
      </div>
    );
  }

  const used = (slot: SlotType) => views.filter((v) => v.def.slot === slot).length;
  const crowded = INCOME_SLOTS.some((slot) => used(slot) >= SLOT_CAPACITY[slot]);

  const row = (v: AssetView) => {
    const isStatus = v.def.kind === 'status';
    const up = v.upgrade;
    const copy = assetCopy(v.def.id, v.level);
    const upCopy = up ? assetCopy(v.def.id, up.toLevel) : null;
    return (
      <div key={v.asset.uid} data-uid={v.asset.uid} className={`asset-row ${highlight === v.asset.uid ? 'flash' : ''} ${v.asset.damaged ? 'damaged' : ''}`}>
        <span className={`dot ${isStatus ? 'liability' : 'asset'}`} />
        <div className="asset-main">
          <div className="asset-title">
            {copy.title}
            {v.maxLevel > 1 && <Pips value={v.level} max={v.maxLevel} />}
          </div>
          <div className="asset-sub">
            {v.asset.damaged
              ? <span className="neg">{t.ui.island.damaged}</span>
              : <>
                  {v.currentIncome > 0 && <span className="pos">+{fmt(v.currentIncome)}</span>}
                  {v.upkeep > 0 && <span className="neg">−{fmt(v.upkeep)}</span>}
                  <span className="muted">{t.ui.inWeek}</span>
                </>}
          </div>
        </div>
        <div className="asset-actions">
          {v.asset.damaged && (
            <button className="btn primary sm" onClick={() => act({ type: 'repairAsset', playerId: HUMAN, assetUid: v.asset.uid }, t.ui.island.repaired)}>
              {t.ui.island.repair(fmt(v.repairCost))}
            </button>
          )}
          <ConfirmButton
            confirmText={t.ui.island.confirmSale(fmt(v.saleValue))}
            onConfirm={() => act({ type: 'sellAsset', playerId: HUMAN, assetUid: v.asset.uid }, t.ui.island.sold(fmt(v.saleValue)))}
          >
            {t.ui.island.sell}
          </ConfirmButton>
        </div>

        {up && (
          <div className="upgrade">
            <div className="upgrade-text">
              <b><span aria-hidden>↑</span> {upCopy?.title}</b>
              <span>
                <span className="pos">{signed(up.incomeGain)}</span>
                {up.upkeepGain > 0 && <> · <span className="neg">−{fmt(up.upkeepGain)}</span> {t.ui.island.upgradeUpkeep}</>}
                {up.paybackWeeks ? <> · {t.ui.island.upgradePays(up.paybackWeeks)}</> : null}
              </span>
              <FreedomLine before={fin.freedomRatio} after={up.freedomAfter} />
            </div>
            <button
              className="btn primary sm"
              disabled={!up.canUpgrade}
              onClick={() => act({ type: 'upgradeAsset', playerId: HUMAN, assetUid: v.asset.uid }, t.ui.island.upgraded(upCopy?.title ?? v.def.id))}
            >
              {up.canUpgrade ? t.ui.island.upgrade(fmt(up.cost)) : up.reason ? errorText(up.reason) : ''}
            </button>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="tab-body" ref={listRef}>
      <div className="capital-mini">
        <div><span>{t.ui.island.earns}</span><b className="pos">+{fmt(fin.passiveIncome)}{t.ui.perWeek}</b></div>
        <div><span>{t.ui.island.netWorth}</span><b>{fmt(fin.netWorth)}</b></div>
      </div>
      <div className="slots">
        {SLOTS.map((slot) => {
          const n = used(slot), cap = SLOT_CAPACITY[slot];
          return <span key={slot} className={`chip ${n >= cap ? 'full' : ''}`}>{t.ui.island.slots[slot as keyof typeof t.ui.island.slots]} {n}/{cap}</span>;
        })}
      </div>
      {crowded && (
        <div className="hint-text">
          {t.ui.island.crowded}
        </div>
      )}
      {assets.length > 0 && <div className="list-title">{t.ui.island.assets}</div>}
      {assets.map(row)}
      {status.length > 0 && <div className="list-title">{t.ui.island.liabilities}</div>}
      {status.map(row)}
    </div>
  );
}
