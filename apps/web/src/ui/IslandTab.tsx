import { useEffect, useRef } from 'react';
import { assetViews, financeView } from '@arch/engine';
import { HUMAN, useGame } from '../store';
import { fmt } from '../format';
import { ConfirmButton } from './common';

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

  const row = (v: (typeof views)[number]) => {
    const isStatus = v.def.kind === 'status';
    return (
      <div key={v.asset.uid} data-uid={v.asset.uid} className={`asset-row ${highlight === v.asset.uid ? 'flash' : ''} ${v.asset.damaged ? 'damaged' : ''}`}>
        <span className={`dot ${isStatus ? 'liability' : 'asset'}`} />
        <div className="asset-main">
          <div className="asset-title">{v.def.title}</div>
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
      </div>
    );
  };

  return (
    <div className="tab-body" ref={listRef}>
      <div className="capital-mini">
        <div><span>Приносит</span><b className="pos">+{fmt(fin.passiveIncome)}/нед</b></div>
        <div><span>Капитал</span><b>{fmt(fin.netWorth)}</b></div>
      </div>
      {assets.length > 0 && <div className="list-title">Активы — кладут деньги в карман</div>}
      {assets.map(row)}
      {status.length > 0 && <div className="list-title">Пассивы — забирают деньги из кармана</div>}
      {status.map(row)}
    </div>
  );
}
