import { getPlayer, offerViews, type OfferView } from '@arch/engine';
import { HUMAN, useGame } from '../store';
import { fmt, marketLine, SECTOR_NAME, signed } from '../format';

function OfferCard({ v, cash }: { v: OfferView; cash: number }) {
  const act = useGame((s) => s.act);
  // Афера выглядит как обычный актив — правду выдаёт только предупреждение от знаний
  const isStatus = v.def.kind === 'status';
  const reason = v.locked
    ? `Нужно знание ${v.def.minKnowledge}`
    : v.slotFull
      ? 'На острове нет места'
      : !v.canAfford
        ? `Не хватает ${fmt(v.offer.price - cash)}`
        : null;

  return (
    <article className={`offer ${v.warning ? 'warned' : ''}`}>
      <div className="offer-top">
        <span className={`tag ${isStatus ? 'liability' : 'asset'}`}>
          {isStatus ? 'Пассив · статус' : `Актив · ${SECTOR_NAME[v.def.sector]}`}
        </span>
        <span className={`expires ${v.weeksLeft === 0 ? 'last' : ''}`}>
          {v.weeksLeft === 0 ? 'Последняя неделя' : `Ещё ${v.weeksLeft} нед.`}
        </span>
      </div>
      <h3>{v.def.title}</h3>
      <p>{v.def.description}</p>
      <div className="nums">
        <div className="num"><span>Цена</span><b>{fmt(v.offer.price)}</b></div>
        <div className="num"><span>Доход</span><b className={v.expectedIncome ? 'pos' : ''}>{v.expectedIncome ? `+${fmt(v.expectedIncome)}` : '0'}<small>/нед</small></b></div>
        <div className="num"><span>Содерж.</span>{v.upkeep > 0 ? <b className="neg">−{fmt(v.upkeep)}<small>/нед</small></b> : <b>0</b>}</div>
      </div>
      <div className={`net ${v.net > 0 ? 'pos' : 'neg'}`}>
        {v.net > 0 && v.paybackWeeks
          ? <>Итого {signed(v.net)}/нед · окупится за {v.paybackWeeks} нед.</>
          : <>Итого {signed(v.net)}/нед — только расходы{v.def.joy > 0 ? `, зато +${v.def.joy} счастья` : ''}</>}
      </div>
      {v.warning && <div className="warning"><span aria-hidden>⚠</span> {v.warning}</div>}
      <button
        className="btn primary"
        disabled={!!reason}
        onClick={() => act({ type: 'buyOffer', playerId: HUMAN, offerUid: v.offer.uid }, `Куплено: ${v.def.title}`)}
      >
        {reason ?? `Купить за ${fmt(v.offer.price)}`}
      </button>
    </article>
  );
}

export function DealsTab() {
  const world = useGame((s) => s.world)!;
  const me = getPlayer(world, HUMAN);
  const views = offerViews(world, HUMAN);
  const fish = marketLine(world.market.fish, 'fish');
  const tourism = marketLine(world.market.tourism, 'tourism');

  return (
    <div className="tab-body">
      <div className="market">
        <span className={`chip ${fish.tone}`}>{fish.text}</span>
        <span className={`chip ${tourism.tone}`}>{tourism.text}</span>
      </div>
      {views.length === 0
        ? <div className="empty">Доска пуста — новые сделки появятся на следующей неделе.</div>
        : views.map((v) => <OfferCard key={v.offer.uid} v={v} cash={me.cash} />)}
      <div className="hint-text">Соседи тоже смотрят на эту доску: что вы не купите, могут забрать они.</div>
    </div>
  );
}
