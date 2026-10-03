// Балансовый симулятор: много сидов × много недель, статистика по стилям игры.
// Запуск: npm run sim -w @arch/engine [-- --seeds 500 --weeks 100]
import { runBotTurn, type Policy } from '../src/bots';
import { getDef, studyCost } from '../src/economy';
import { applyAction } from '../src/reducer';
import * as R from '../src/rules';
import { financeView, offerViews } from '../src/selectors';
import type { WorldState } from '../src/types';
import { createWorld, HUMAN_ID } from '../src/world';

// ───────────── Политики «человека» ─────────────

/** Разумный игрок: окупаемые активы, учится один раз, страхуется, иногда отдыхает, одна недорогая радость. */
const sensible: Policy = (world, me) => {
  const buffer = 80;
  const damaged = me.owned.find((a) => a.damaged && me.cash - Math.round(a.price * R.REPAIR_SHARE) >= buffer);
  if (damaged) return { type: 'repairAsset', playerId: me.id, assetUid: damaged.uid };
  const emergency = me.loans.find((l) => l.emergency);
  if (emergency && me.cash > buffer) {
    return { type: 'repayLoan', playerId: me.id, loanUid: emergency.uid, amount: Math.min(emergency.principal, me.cash - buffer) };
  }
  const cost = studyCost(me);
  if (me.knowledge === 0 && !me.studiedThisWeek && cost !== null && me.cash >= cost + 250) {
    return { type: 'study', playerId: me.id };
  }
  const stormProne = me.owned.some((a) => getDef(a.defId).stormRisk >= 0.2);
  if (stormProne && !me.insured) return { type: 'setInsurance', playerId: me.id, on: true };
  if (me.happiness < 35 && !me.restedThisWeek && me.cash >= R.REST_COST + buffer) return { type: 'rest', playerId: me.id };

  const views = offerViews(world, me.id);
  const best = views
    .filter((v) => !v.locked && !v.slotFull && !v.warning && v.def.kind !== 'status')
    .filter((v) => v.paybackWeeks !== null && v.paybackWeeks <= 35 && me.cash - v.offer.price >= buffer)
    .sort((a, b) => (a.paybackWeeks ?? 0) - (b.paybackWeeks ?? 0))[0];
  if (best) return { type: 'buyOffer', playerId: me.id, offerUid: best.offer.uid };

  const ownsStatus = me.owned.some((a) => getDef(a.defId).kind === 'status');
  const garden = views.find((v) => v.def.id === 'garden' && !v.slotFull && me.cash >= v.offer.price + 400);
  if (!ownsStatus && garden) return { type: 'buyOffer', playerId: me.id, offerUid: garden.offer.uid };
  return null;
};

/** Ничего не делает. Свобода недостижима. */
const idle: Policy = () => null;

/** Трудоголик: покупает как разумный, но каждую неделю на подработке и никогда не отдыхает. */
const grinder: Policy = (world, me) => {
  if (!me.extraShift) return { type: 'setExtraShift', playerId: me.id, on: true };
  const action = sensible(world, { ...me, happiness: 100 });
  return action && action.type !== 'rest' ? action : null;
};

const HUMAN_POLICIES: Record<string, Policy> = { sensible, idle, grinder };

// ───────────── Прогон ─────────────

interface Outcome {
  freedomWeek: number | null;
  debt: number;
  burnouts: number;
  emergencyWeeks: number;
  netWorth: number;
  scamsLost: number;
}

function hasNaN(value: unknown): boolean {
  if (typeof value === 'number') return !Number.isFinite(value);
  if (Array.isArray(value)) return value.some(hasNaN);
  if (value && typeof value === 'object') return Object.values(value).some(hasNaN);
  return false;
}

function runGame(seed: number, weeks: number, humanPolicy: Policy): Map<string, Outcome> {
  let world: WorldState = createWorld({ seed, playerName: 'Игрок', islandName: 'Тест' });
  const stats = new Map<string, Outcome>(world.players.map((p) => [p.id, {
    freedomWeek: null, debt: 0, burnouts: 0, emergencyWeeks: 0, netWorth: 0, scamsLost: 0,
  }]));
  for (let w = 0; w < weeks; w++) {
    const turn = runBotTurn(world, HUMAN_ID, humanPolicy);
    if (turn.errors.length) throw new Error(`seed ${seed}: ${turn.errors.join('; ')}`);
    const result = applyAction(turn.world, { type: 'endWeek' });
    if (result.error) throw new Error(result.error);
    world = result.world;
    for (const [id, report] of Object.entries(world.lastReport!.players)) {
      const s = stats.get(id)!;
      if (report.events.some((e) => e.id === 'burnout')) s.burnouts++;
      if (report.events.some((e) => e.id === 'emergencyLoan')) s.emergencyWeeks++;
      s.scamsLost += report.lostAssetUids.length;
    }
  }
  if (hasNaN(world)) throw new Error(`NaN in world, seed ${seed}`);
  for (const p of world.players) {
    const s = stats.get(p.id)!;
    s.freedomWeek = p.freedomWeek;
    const f = financeView(world, p.id);
    s.debt = f.debt;
    s.netWorth = f.netWorth;
  }
  return stats;
}

function percentile(sorted: number[], q: number): number {
  const i = Math.min(sorted.length - 1, Math.max(0, Math.round(q * (sorted.length - 1))));
  return sorted[i];
}

interface Summary {
  median: number;
  p25: number;
  p75: number;
  freePct: number;
  debtPct: number;
  burnouts: number;
  scams: number;
  netWorth: number;
}

function summarize(outcomes: Outcome[]): Summary {
  // Не достигшие свободы считаются «бесконечностью»: медиана честно показывает «>100».
  const times = outcomes.map((o) => o.freedomWeek ?? Infinity).sort((a, b) => a - b);
  const share = (f: (o: Outcome) => boolean) => Math.round((100 * outcomes.filter(f).length) / outcomes.length);
  const avg = (f: (o: Outcome) => number) => outcomes.reduce((s, o) => s + f(o), 0) / outcomes.length;
  return {
    median: percentile(times, 0.5),
    p25: percentile(times, 0.25),
    p75: percentile(times, 0.75),
    freePct: share((o) => o.freedomWeek !== null),
    debtPct: share((o) => o.debt > 0),
    burnouts: Math.round(avg((o) => o.burnouts)),
    scams: Math.round(avg((o) => o.scamsLost) * 10) / 10,
    netWorth: Math.round(avg((o) => o.netWorth)),
  };
}

function formatRow(label: string, s: Summary, weeks: number): string {
  const w = (n: number) => (Number.isFinite(n) ? String(n) : `>${weeks}`);
  return [
    label.padEnd(20),
    w(s.median).padStart(6), w(s.p25).padStart(6), w(s.p75).padStart(6),
    `${s.freePct}%`.padStart(6), `${s.debtPct}%`.padStart(6),
    String(s.burnouts).padStart(8), String(s.scams).padStart(6), String(s.netWorth).padStart(9),
  ].join(' ');
}

/** Цели из MVP_SPEC: «Баланс (цели симулятора)» + санитарные проверки. */
function checkTargets(sum: Map<string, Summary>): [string, boolean][] {
  const get = (label: string) => sum.get(label)!;
  const saver = get(LABELS.saver);
  const sensible = get(LABELS.sensible);
  const spender = get(LABELS.spender);
  const gambler = get(LABELS.gambler);
  return [
    ['Бережливая: медиана 30–40', saver.median >= 30 && saver.median <= 40],
    ['Разумный игрок: медиана 35–50', sensible.median >= 35 && sensible.median <= 50],
    ['Транжира: медиана > 70 (или никогда)', spender.median > 70],
    ['Рисковый: большой разброс (p75 − p25 ≥ 20, бывает и быстрее всех, и в долгах)',
      gambler.p75 - gambler.p25 >= 20 && gambler.p25 < saver.p25 && gambler.debtPct > 0],
    ['Бездельник никогда не свободен', get(LABELS.idle).freePct === 0],
    ['Трудоголик без отдыха выгорает и отстаёт от разумного',
      get(LABELS.grinder).burnouts > 0 && get(LABELS.grinder).median > sensible.median],
  ];
}

const LABELS = {
  sensible: 'human:sensible',
  idle: 'human:idle',
  grinder: 'human:grinder',
  saver: 'bot:saver (Мия)',
  spender: 'bot:spender (Тимур)',
  gambler: 'bot:gambler (Борис)',
};

function arg(name: string, fallback: number): number {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? Number(process.argv[i + 1]) : fallback;
}

function main(): void {
  const seeds = arg('seeds', 500);
  const weeks = arg('weeks', 100);
  const started = Date.now();

  const byLabel = new Map<string, Outcome[]>();
  const add = (label: string, o: Outcome) => {
    if (!byLabel.has(label)) byLabel.set(label, []);
    byLabel.get(label)!.push(o);
  };
  for (const [name, policy] of Object.entries(HUMAN_POLICIES)) {
    for (let seed = 1; seed <= seeds; seed++) {
      const stats = runGame(seed, weeks, policy);
      add(`human:${name}`, stats.get(HUMAN_ID)!);
      // Ботов меряем в мирах с разумным человеком — это основной сценарий игры.
      if (name === 'sensible') {
        add(LABELS.saver, stats.get('bot-mia')!);
        add(LABELS.spender, stats.get('bot-timur')!);
        add(LABELS.gambler, stats.get('bot-boris')!);
      }
    }
  }
  const summaries = new Map([...byLabel].map(([label, outcomes]) => [label, summarize(outcomes)]));

  const secs = ((Date.now() - started) / 1000).toFixed(1);
  console.log(`\n«Архипелаг» — баланс: ${seeds} сидов × ${weeks} недель (${secs} c)\n`);
  console.log(['policy'.padEnd(20), 'median', '   p25', '   p75', '  free', '  debt', 'burnouts', ' scams', ' netWorth'].join(' '));
  for (const [label, s] of summaries) console.log(formatRow(label, s, weeks));
  console.log('\nmedian/p25/p75 — недели до свободы (не достигшие = бесконечность); free — % достигших;');
  console.log('debt — % с долгом в конце; burnouts/scams — в среднем за игру; netWorth — средний капитал в конце.\n');

  const checks = checkTargets(summaries);
  for (const [name, passed] of checks) console.log(`${passed ? 'OK  ' : 'FAIL'} ${name}`);
  if (checks.some(([, passed]) => !passed)) process.exitCode = 1;
}

main();
