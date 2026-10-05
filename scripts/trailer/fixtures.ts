import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  ASSET_DEFS, applyAction, createWorld, financeView, loanLimit, offerViews,
  type Action, type WeekNewsItem, type WorldState,
} from '@arch/engine';
import { runBotTurn } from '../../packages/engine/src/bots';
import { makeSensible } from '../../packages/engine/scripts/policies';

type NewsItem = { week: number } & WeekNewsItem;
type History = Record<string, { week: number; ratio: number }[]>;
interface Save { world: WorldState; news: NewsItem[]; history: History }

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const output = resolve(root, 'apps/web/src/director/fixtures.json');
const hero = makeSensible({ study: false, avoidScams: true });

function historyPoint(history: History, world: WorldState): History {
  const next: History = structuredClone(history);
  for (const p of world.players) {
    const line = (next[p.id] ?? []).filter((point) => point.week < world.week);
    const ratio = Math.round(financeView(world, p.id).freedomRatio * 1000) / 1000;
    next[p.id] = [...line, { week: world.week, ratio }].slice(-160);
  }
  return next;
}

function advance(save: Save): Save {
  const result = applyAction(save.world, { type: 'endWeek' });
  if (result.error || !result.world.lastReport) throw new Error(`endWeek failed at ${save.world.week}`);
  const report = result.world.lastReport;
  return {
    world: result.world,
    news: [...report.news.map((item) => ({ week: report.week, ...item })), ...save.news].slice(0, 80),
    history: historyPoint(save.history, result.world),
  };
}

function act(save: Save, action: Exclude<Action, { type: 'endWeek' }>): Save {
  const result = applyAction(save.world, action);
  if (result.error) throw new Error(`${action.type} failed: ${result.error.code}`);
  return { ...save, world: result.world };
}

function placed(world: WorldState) {
  return world.players[0].owned
    .filter((asset) => ASSET_DEFS[asset.defId].slot !== 'finance')
    .map((asset) => ({
      uid: asset.uid,
      model: ASSET_DEFS[asset.defId].model,
      slot: ASSET_DEFS[asset.defId].slot,
      slotIndex: asset.slotIndex,
      damaged: asset.damaged,
      level: asset.level,
    }));
}

function spread(world: WorldState): number {
  const ratios = world.players.map((p) => financeView(world, p.id).freedomRatio);
  return Math.max(...ratios) - Math.min(...ratios);
}

function onlyEvents(world: WorldState, ids: string[]): boolean {
  const report = world.lastReport;
  if (!report) return false;
  return report.worldEvents.length === 0
    && report.players.p1.events.map((e) => e.id).join('|') === ids.join('|');
}

function scamBranch(base: Save): { scamCard: Save; scamCollapse: Save } | null {
  const view = offerViews(base.world, 'p1').find((offer) => offer.def.id === 'pearlFarm');
  if (!view) return null;
  let card = structuredClone(base) as Save;
  const me = card.world.players[0];
  if (me.cash < view.offer.price) {
    const amount = Math.ceil((view.offer.price - me.cash) / 100) * 100;
    if (amount > loanLimit(card.world, 'p1')) return null;
    card = act(card, { type: 'takeLoan', playerId: 'p1', amount });
  }
  const current = offerViews(card.world, 'p1').find((offer) => offer.def.id === 'pearlFarm');
  if (!current) return null;
  let branch = act(card, { type: 'buyOffer', playerId: 'p1', offerUid: current.offer.uid });
  for (let i = 0; i < 8; i++) {
    const before = structuredClone(branch) as Save;
    const after = advance(branch);
    if (after.world.lastReport?.players.p1.events.some((e) => e.id === 'scamCollapse')) {
      if (onlyEvents(after.world, ['scamCollapse'])) return { scamCard: card, scamCollapse: before };
      return null;
    }
    branch = after;
  }
  return null;
}

function build(seed: number) {
  let world = createWorld({ seed, playerName: 'Вы', islandName: 'Лагуна' });
  let save: Save = { world, news: [], history: historyPoint({}, world) };
  const beforeEnd: (Save | undefined)[] = Array(101);
  const afterEnd: (Save | undefined)[] = Array(101);
  const heroItemsByWeek: ReturnType<typeof placed>[] = Array(101);
  heroItemsByWeek[0] = [];

  for (let w = 1; w <= 100; w++) {
    const turn = runBotTurn(save.world, 'p1', hero);
    if (turn.errors.length) throw new Error(`hero seed ${seed}, week ${w}: ${turn.errors.join('; ')}`);
    save = { ...save, world: turn.world };
    beforeEnd[w] = structuredClone(save) as Save;
    heroItemsByWeek[w] = placed(save.world);
    save = advance(save);
    afterEnd[w] = structuredClone(save) as Save;
  }

  let F = 0;
  for (let w = 18; w <= 40; w++) {
    const before = beforeEnd[w]!, after = afterEnd[w]!;
    const mine = after.world.lastReport?.players.p1;
    if (!mine?.freedomReached) continue;
    if (!onlyEvents(after.world, ['freedom'])) continue;
    if (financeView(before.world, 'p1').freedomRatio < 0.85) continue;
    const items = before.world.players[0].owned.filter((asset) => ASSET_DEFS[asset.defId].slot !== 'finance');
    if (items.length < 6 || new Set(items.map((asset) => asset.defId)).size < 4 || !items.some((asset) => asset.defId === 'boat')) continue;
    F = w; break;
  }
  if (!F) return null;

  let S = 0; let scam: ReturnType<typeof scamBranch> = null;
  for (let w = 5; w <= F - 3; w++) {
    const before = beforeEnd[w]!;
    if (placed(before.world).length < 3 || before.world.players[0].knowledge !== 0) continue;
    if (!offerViews(before.world, 'p1').some((offer) => offer.def.id === 'pearlFarm')) continue;
    const candidate = scamBranch(before);
    if (candidate) { S = w; scam = candidate; break; }
  }
  if (!S || !scam) return null;

  let N = 0;
  for (let w = 8; w <= F - 2; w++) {
    const before = beforeEnd[w]!, after = afterEnd[w]!;
    const report = after.world.lastReport;
    if (!report || spread(before.world) < 0.25) continue;
    if (report.worldEvents.length || report.players.p1.events.length) continue;
    if (!report.news.some((item) => item.playerId !== 'p1')) continue;
    N = w; break;
  }
  if (!N) return null;

  return {
    seed, F, S, N, heroItemsByWeek,
    scamCard: scam.scamCard,
    scamCollapse: scam.scamCollapse,
    neighbors: beforeEnd[N]!,
    freedom: beforeEnd[F]!,
  };
}

let fixtures: ReturnType<typeof build> = null;
for (let seed = 1; seed <= 50_000 && !fixtures; seed++) fixtures = build(seed);
if (!fixtures) throw new Error('No trailer seed found up to 50000');
mkdirSync(dirname(output), { recursive: true });
writeFileSync(output, `${JSON.stringify(fixtures, null, 2)}\n`, 'utf8');
const bytes = Buffer.byteLength(JSON.stringify(fixtures));
if (bytes > 400 * 1024) throw new Error(`fixtures.json too large: ${bytes} bytes`);
console.log(JSON.stringify({ output, seed: fixtures.seed, F: fixtures.F, S: fixtures.S, N: fixtures.N, bytes }, null, 2));
