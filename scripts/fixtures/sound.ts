// Acceptance saves are produced exclusively by the public deterministic game API.
import { writeFileSync } from 'node:fs';
import { ASSET_DEFS, applyAction, assetViews, createWorld, dreamView, financeView, offerViews, type Action, type WorldState } from '@arch/engine';

interface Scenario { world: WorldState; action?: Action; events?: string[] }
const scenarios: Record<string, Scenario> = {};
const remember = (name: string, world: WorldState, action?: Action, events?: string[]) => {
  scenarios[name] ??= { world, ...(action ? { action } : {}), ...(events ? { events } : {}) };
};
const actionOf = (type: 'study' | 'rest' | 'quitJob' | 'returnToWork' | 'buildDream'): Action => ({ type, playerId: 'p1' });
function collectActions(world: WorldState) {
  for (const action of [actionOf('study'), actionOf('rest'), actionOf('quitJob'), actionOf('returnToWork'), actionOf('buildDream'),
    { type: 'setExtraShift', playerId: 'p1', on: true }, { type: 'setInsurance', playerId: 'p1', on: true }] as Action[]) {
    if (!scenarios[action.type] && !applyAction(world, action).error) remember(action.type, world, action);
  }
  for (const offer of world.offers) {
    const kind = ASSET_DEFS[offer.defId].kind;
    const name = kind === 'status' ? 'buyStatus' : kind === 'scam' ? 'buyScam' : 'buyAsset';
    if (scenarios[name] && scenarios.buyNoCash && (kind !== 'status' || scenarios.coinWeek || world.players[0].owned.length < 5)
      && (kind !== 'scam' || scenarios.scamCollapse)) continue;
    const action: Action = { type: 'buyOffer', playerId: 'p1', offerUid: offer.uid };
    const result = applyAction(world, action);
    if (!result.error) {
      remember(name, world, action);
      if (kind === 'status' && world.players[0].owned.length >= 5) remember('coinWeek', result.world);
      if (kind === 'scam' && !scenarios.scamCollapse) {
        let branch = result.world;
        for (let i = 0; i < 5; i++) {
          const next = applyAction(branch, { type: 'endWeek' }).world;
          if (next.lastReport?.players.p1.events.some((event) => event.id === 'scamCollapse')) {
            remember('scamCollapse', branch, undefined, next.lastReport.players.p1.events.map((event) => event.id)); break;
          }
          branch = next;
        }
      }
    } else if (result.error.startsWith('Не хватает')) remember('buyNoCash', world, action);
  }
  for (const asset of world.players[0].owned) {
    for (const type of ['sellAsset', 'upgradeAsset', 'repairAsset'] as const) {
      const action: Action = { type, playerId: 'p1', assetUid: asset.uid };
      if (!scenarios[type] && !applyAction(world, action).error) remember(type, world, action);
    }
  }
  if (scenarios.takeLoan && scenarios.repayLoan) return;
  const loan: Action = { type: 'takeLoan', playerId: 'p1', amount: 100 };
  const borrowed = applyAction(world, loan);
  if (!borrowed.error) {
    remember('takeLoan', world, loan);
    const repay: Action = { type: 'repayLoan', playerId: 'p1', loanUid: borrowed.world.players[0].loans.at(-1)!.uid, amount: 100 };
    if (!applyAction(borrowed.world, repay).error) remember('repayLoan', borrowed.world, repay);
  }
}

const required = ['buyAsset', 'buyStatus', 'buyScam', 'buyNoCash', 'sellAsset', 'upgradeAsset', 'repairAsset', 'takeLoan', 'repayLoan',
  'study', 'rest', 'setExtraShift', 'setInsurance', 'quitJob', 'returnToWork', 'buildDream', 'storm', 'freedom', 'dreamStage', 'dreamDone', 'neighborFree', 'coinWeek', 'scamCollapse'];
for (let seed = 1; seed <= 40 && !required.every((name) => scenarios[name]); seed++) {
  let world = createWorld({ seed, playerName: 'Аня', islandName: 'Чайка' });
  remember('initial', world);
  for (let week = 0; week < 180; week++) {
    if (required.every((name) => scenarios[name])) break;
    collectActions(world);
    const me = world.players[0];
    const dispatch = (action: Action) => {
      const result = applyAction(world, action);
      if (!result.error) world = result.world;
    };
    if (me.freedomWeek !== null && me.employed) dispatch(actionOf('quitJob'));
    if (dreamView(world, 'p1')?.canStart) dispatch(actionOf('buildDream'));
    for (const asset of assetViews(world, 'p1')) if (asset.asset.damaged && world.players[0].cash >= asset.repairCost) {
      dispatch({ type: 'repairAsset', playerId: 'p1', assetUid: asset.asset.uid });
    }
    if (world.players[0].knowledge < 2 && world.players[0].cash > 1000) dispatch(actionOf('study'));
    const offer = offerViews(world, 'p1')
      .filter((view) => !view.locked && !view.slotFull && !view.warning && view.def.kind === 'asset')
      .filter((view) => world.players[0].cash - view.offer.price >= 100 && (view.paybackWeeks ?? Infinity) <= 45)
      .sort((a, b) => (a.paybackWeeks ?? Infinity) - (b.paybackWeeks ?? Infinity))[0];
    if (offer) dispatch({ type: 'buyOffer', playerId: 'p1', offerUid: offer.offer.uid });
    else if (world.players[0].cash > 1500) {
      const upgrade = assetViews(world, 'p1').find((view) => view.upgrade?.canUpgrade);
      if (upgrade) dispatch({ type: 'upgradeAsset', playerId: 'p1', assetUid: upgrade.asset.uid });
    }
    if (world.players[0].happiness < 55 && world.players[0].cash >= 100) dispatch(actionOf('rest'));
    const before = world;
    world = applyAction(world, { type: 'endWeek' }).world;
    const report = world.lastReport!;
    const ids = [...report.worldEvents, ...report.players.p1.events].map((event) => event.id);
    for (const event of ['storm', 'freedom', 'freedomLevel', 'dreamStage', 'dreamDone', 'freedomThreat', 'backToWork', 'emergencyLoan']) {
      if (ids.includes(event)) remember(event, before, undefined, ids);
    }
    if (world.players.some((player) => player.isBot && player.freedomWeek !== null
      && before.players.find((old) => old.id === player.id)?.freedomWeek === null)) remember('neighborFree', before);
    if (financeView(world, 'p1').freedomRatio > 1 && world.players[0].owned.length >= 5) remember('developed', world);
  }
}
const missing = required.filter((name) => !scenarios[name]);
if (missing.length) throw new Error(`Missing sound acceptance fixtures: ${missing.join(', ')}`);
const output = process.argv[2];
if (!output) throw new Error('Pass output JSON path');
writeFileSync(output, JSON.stringify(scenarios));
console.log(JSON.stringify(Object.fromEntries(Object.entries(scenarios).map(([name, scenario]) => [name, { seed: scenario.world.seed, week: scenario.world.week, events: scenario.events }])) , null, 2));
