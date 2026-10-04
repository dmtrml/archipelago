// The only translation from game rules into sound. No audio code belongs in the rules or scene.
import { ASSET_DEFS, type Action, type WeekReport, type WorldState } from '@arch/engine';
import type { FloatLabel } from '../scene/contract';
import { audio } from './engine';
import type { CueId } from './cues';

const HUMAN = 'p1';

export function startGameSounds(world: WorldState) {
  audio.setWeather('clear');
  audio.setScene(world.players[0].freedomWeek === null ? 'island' : 'free');
  audio.setAmbience(true);
}

export function stopGameSounds() { audio.stop(); }

export function onAction(action: Action, before: WorldState, after: WorldState, error?: string) {
  if ('playerId' in action && action.playerId !== HUMAN) return;
  if (error) { audio.play('ui.error'); return; }
  const pay = () => audio.play('coins.pay');
  switch (action.type) {
    case 'buyOffer': {
      const bought = after.players[0].owned.find((asset) => !before.players[0].owned.some((old) => old.uid === asset.uid));
      if (!bought) return;
      pay();
      audio.play('build.pop', { delayMs: 70 });
      if (ASSET_DEFS[bought.defId].kind === 'status') audio.play('status.joy', { delayMs: 160 });
      break;
    }
    case 'sellAsset': audio.play('coins.get'); audio.play('build.remove', { delayMs: 70 }); break;
    case 'upgradeAsset': pay(); audio.play('upgrade', { delayMs: 200 }); break;
    case 'repairAsset': pay(); audio.play('repair', { delayMs: 70 }); break;
    case 'takeLoan': audio.play('coins.get'); audio.play('loan.take', { delayMs: 70 }); break;
    case 'repayLoan': audio.play('loan.repay'); break;
    case 'study': pay(); audio.play('study', { delayMs: 70 }); break;
    case 'rest': pay(); audio.play('rest', { delayMs: 70 }); break;
    case 'buildDream': pay(); audio.play('dream.start', { delayMs: 70 }); break;
    case 'setExtraShift': if (action.on && !before.players[0].extraShift) audio.play('shift.on'); break;
    case 'quitJob': audio.play('job.quit'); break;
    case 'returnToWork': audio.play('job.return'); break;
  }
}

const EVENT_CUES: Record<string, CueId> = {
  gift: 'event.good', raise: 'event.good', fishShoal: 'event.good', touristBoom: 'event.good',
  stormInsured: 'event.good', threatOver: 'event.good',
  illness: 'event.bad', breakdown: 'event.bad', crisis: 'event.bad', stormDamage: 'event.bad', burnout: 'event.bad',
  storm: 'storm', scamCollapse: 'scam.collapse', emergencyLoan: 'loan.emergency',
  freedomThreat: 'threat', backToWork: 'job.return', freedom: 'freedom',
  freedomLevel: 'freedom.level', dreamStage: 'dream.stage',
};
const PRIORITY: Partial<Record<CueId, number>> = {
  'dream.launch': 10, epilogue: 10, freedom: 9, 'freedom.level': 8, 'dream.stage': 7,
  storm: 6, 'scam.collapse': 5, 'loan.emergency': 4, threat: 3, 'job.return': 3,
  'event.bad': 2, 'event.good': 1, 'neighbor.free': 1,
};

/** Coin callbacks run in the very same task that inserts a float into the scene. */
export function onWeek(report: WeekReport, before: WorldState, after: WorldState) {
  audio.play('week.next');
  const mine = report.players[HUMAN];
  const candidates: CueId[] = [];
  if (mine.events.some((event) => event.id === 'dreamDone')) candidates.push('dream.launch', 'epilogue');
  for (const event of [...report.worldEvents, ...mine.events]) {
    const cue = EVENT_CUES[event.id];
    if (cue) candidates.push(cue);
  }
  // Use structured player state, never parse the localized news text.
  if (after.players.some((player) => player.isBot && player.freedomWeek !== null
    && before.players.find((old) => old.id === player.id)?.freedomWeek === null)) candidates.push('neighbor.free');
  const selected = [...new Set(candidates)].sort((a, b) => (PRIORITY[b] ?? 0) - (PRIORITY[a] ?? 0)).slice(0, 2);
  let positive = 0;
  let launched = false;
  const playMilestone = (cue: CueId) => { audio.play(cue); };
  return {
    hasNotice: selected.length > 0,
    onFloat(label: Pick<FloatLabel, 'tone'>) {
      if (label.tone === 'neg') audio.play('coin.minus');
      else if (positive < 12) audio.play('coin.tick', { pitchStep: Math.min(positive++, 7) });
      // The camera begins its turn on the world update, before the week modal appears.
      if (!launched && selected.includes('dream.launch')) {
        launched = true;
        playMilestone('dream.launch');
      }
    },
    onModal(open = true) {
      if (open) audio.play('ui.open');
      if (mine.freedomReached) audio.setScene('free');
      selected.filter((cue) => cue !== 'dream.launch').forEach(playMilestone);
    },
  };
}

export function onWeather(weather: 'clear' | 'storm') { audio.setWeather(weather); }
