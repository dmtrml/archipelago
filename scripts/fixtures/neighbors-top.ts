import { applyAction, createWorld, dreamView, financeView, offerViews } from '@arch/engine';
import type { Action, WorldState } from '@arch/engine';
import { pathToFileURL } from 'node:url';

export const ISLAND_NAME_OPTIONS = {
  short: 'Чайка',
  long: 'Остров Солнечной Свободы', // exactly 24 characters
} as const;

const SEED = 1;
const TARGET_WEEK = 75;
const HISTORY_WEEKS = 8;

/** Builds the fixed, naturally simulated save used by the neighbors bar acceptance check. */
export function createNeighborsTopFixture(
  islandName: (typeof ISLAND_NAME_OPTIONS)[keyof typeof ISLAND_NAME_OPTIONS] = ISLAND_NAME_OPTIONS.short,
) {
  let world = createWorld({ seed: SEED, playerName: 'Alex', islandName });
  const reports: NonNullable<WorldState['lastReport']>[] = [];
  const history: Record<string, { week: number; ratio: number }[]> = Object.fromEntries(
    world.players.map((player) => [player.id, []]),
  );

  function dispatch(action: Action): void {
    const result = applyAction(world, action);
    if (result.error) throw new Error(`Fixture action ${action.type} failed: ${result.error}`);
    world = result.world;
  }

  while (world.week < TARGET_WEEK) {
    const player = world.players[0];
    let action: Action | undefined;

    if (
      player.freedomWeek !== null
      && player.dream
      && !player.dream.building
      && player.dream.doneWeek === null
      && dreamView(world, player.id)?.canStart
    ) {
      action = { type: 'buildDream', playerId: player.id };
    }

    if (!action && !player.studiedThisWeek && player.knowledge === 0 && player.cash >= 300) {
      action = { type: 'study', playerId: player.id };
    }

    if (!action) {
      const offer = offerViews(world, player.id)
        .filter((view) => !view.locked && !view.slotFull && !view.warning && view.def.kind !== 'status')
        .filter((view) => view.paybackWeeks !== null && view.paybackWeeks <= 45 && player.cash - view.offer.price >= 40)
        .sort((a, b) => (a.paybackWeeks ?? 0) - (b.paybackWeeks ?? 0))[0];
      if (offer) action = { type: 'buyOffer', playerId: player.id, offerUid: offer.offer.uid };
    }

    if (action) dispatch(action);
    dispatch({ type: 'endWeek' });
    if (world.lastReport) reports.push(world.lastReport);
    for (const player of world.players) {
      history[player.id].push({ week: world.week, ratio: financeView(world, player.id).freedomRatio });
    }
  }

  for (const playerId of Object.keys(history)) history[playerId] = history[playerId].slice(-HISTORY_WEEKS);
  const news = reports.slice(-HISTORY_WEEKS).flatMap((report) => report.news);
  return { world, news, history };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const useLongName = process.argv.includes('--long-name');
  const fixture = createNeighborsTopFixture(useLongName ? ISLAND_NAME_OPTIONS.long : ISLAND_NAME_OPTIONS.short);
  process.stdout.write(`${JSON.stringify(fixture, null, 2)}\n`);
}
