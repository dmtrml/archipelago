import { offerViews } from '@arch/engine';
import { create } from 'zustand';
import { track } from '../analytics';
import { HUMAN, useGame } from '../store';

export type CoachStep = 1 | 2 | 3 | null;
interface CoachState { step: CoachStep; targetUid: string | null; finish(): void; skip(): void }

const storageDone = () => {
  try { return localStorage.getItem('archipelago.coach.v1') === 'done'; } catch { return false; }
};
const persistDone = () => { try { localStorage.setItem('archipelago.coach.v1', 'done'); } catch { /* unavailable storage */ } };

export const useCoach = create<CoachState>((set) => ({
  step: null,
  targetUid: null,
  finish() { persistDone(); set({ step: null, targetUid: null }); track('coach-done'); },
  skip() { persistDone(); set({ step: null, targetUid: null }); track('coach-skip'); },
}));

let startTimer: ReturnType<typeof setTimeout> | null = null;
let step3Timer: ReturnType<typeof setTimeout> | null = null;
let step3Pending = false;

function begin() {
  if (storageDone()) return;
  if (startTimer) clearTimeout(startTimer);
  startTimer = setTimeout(() => {
    const current = useGame.getState().world;
    if (!current) return;
    const best = offerViews(current, HUMAN)
      .filter((v) => v.def.kind === 'asset' && !v.locked && v.canAfford && !v.slotFull && v.paybackWeeks !== null)
      .sort((a, b) => a.paybackWeeks! - b.paybackWeeks!)[0];
    if (best) {
      if (window.matchMedia('(max-width: 1023px)').matches) useGame.getState().setTab('deals');
      useCoach.setState({ step: 1, targetUid: best.offer.uid });
    } else {
      useCoach.setState({ step: 2, targetUid: null });
    }
  }, 600);
}

useGame.subscribe((state, previous) => {
  if (!previous.world && state.world?.week === 1) begin();
  const coach = useCoach.getState();
  if (state.world && previous.world && coach.step === 1 && state.world.players[0].owned.length > previous.world.players[0].owned.length) {
    useCoach.setState({ step: 2, targetUid: null });
  }
  if (state.world && previous.world && coach.step === 2 && state.world.week > previous.world.week) step3Pending = true;
  if (step3Pending && state.world && !state.modal && !state.toast && !state.busy && !step3Timer) {
    step3Timer = setTimeout(() => {
      step3Timer = null;
      if (!step3Pending) return;
      const latest = useGame.getState();
      if (latest.world && !latest.modal && !latest.toast && !latest.busy) {
        step3Pending = false;
        if (window.matchMedia('(max-width: 1023px)').matches) latest.setSheetOpen(false);
        useCoach.setState({ step: 3, targetUid: null });
      }
    }, 400);
  }
  if (!state.world) {
    if (startTimer) clearTimeout(startTimer);
    if (step3Timer) clearTimeout(step3Timer);
    startTimer = step3Timer = null;
    step3Pending = false;
    useCoach.setState({ step: null, targetUid: null });
  }
});
