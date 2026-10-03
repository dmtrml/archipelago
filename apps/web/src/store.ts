import { create } from 'zustand';
import {
  applyAction, createWorld, ASSET_DEFS,
  type Action, type GameEvent, type WeekReport, type WorldState,
} from '@arch/engine';
import type { FloatLabel, PlacedItem, Weather } from './scene/contract';
import { fmt, signed } from './format';

export const HUMAN = 'p1';
const SAVE_KEY = 'archipelago.save.v1';

export type Tab = 'deals' | 'island' | 'actions' | 'neighbors' | 'report';

export interface Toast { id: number; text: string; tone: 'good' | 'bad' | 'neutral' }
export interface WeekModal { report: WeekReport; events: GameEvent[]; freedom: boolean }
export interface NewsItem { week: number; text: string }

interface Saved { world: WorldState; news: NewsItem[] }

function load(): Saved | null {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const saved = JSON.parse(raw) as Saved;
    return saved?.world?.version === 1 ? saved : null;
  } catch {
    return null;
  }
}

function save(data: Saved | null) {
  try {
    if (data) localStorage.setItem(SAVE_KEY, JSON.stringify(data));
    else localStorage.removeItem(SAVE_KEY);
  } catch {
    // приватный режим или запрет хранилища — игра работает без сохранения
  }
}

interface GameStore {
  world: WorldState | null;
  news: NewsItem[];
  floats: FloatLabel[];
  weather: Weather;
  toast: Toast | null;
  modal: WeekModal | null;
  tab: Tab;
  sheetOpen: boolean;
  highlightUid: string | null;
  busy: boolean;

  newGame(islandName: string, playerName: string): void;
  resetGame(): void;
  act(action: Exclude<Action, { type: 'endWeek' }>, success?: string): boolean;
  endWeek(): void;
  closeModal(): void;
  setTab(tab: Tab): void;
  setSheetOpen(open: boolean): void;
  focusItem(uid: string): void;
  showToast(text: string, tone?: Toast['tone']): void;
}

const saved = load();
let toastSeq = 0;
let floatSeq = 0;

export const useGame = create<GameStore>((set, get) => {
  const pushFloats = (labels: Omit<FloatLabel, 'id'>[], stagger = 170) => {
    labels.forEach((label, i) => {
      setTimeout(() => {
        const f: FloatLabel = { ...label, id: `f${++floatSeq}` };
        set((s) => ({ floats: [...s.floats, f] }));
        setTimeout(() => set((s) => ({ floats: s.floats.filter((x) => x.id !== f.id) })), 2600);
      }, i * stagger);
    });
  };

  return {
    world: saved?.world ?? null,
    news: saved?.news ?? [],
    floats: [],
    weather: 'clear',
    toast: null,
    modal: null,
    tab: 'deals',
    sheetOpen: false,
    highlightUid: null,
    busy: false,

    newGame(islandName, playerName) {
      const world = createWorld({ seed: Math.floor(Math.random() * 2 ** 31), playerName, islandName });
      set({ world, news: [], modal: null, tab: 'deals', floats: [], weather: 'clear' });
      save({ world, news: [] });
    },

    resetGame() {
      save(null);
      set({ world: null, news: [], modal: null, floats: [], weather: 'clear' });
    },

    act(action, success) {
      const { world } = get();
      if (!world) return false;
      const res = applyAction(world, action);
      if (res.error) {
        get().showToast(res.error, 'bad');
        return false;
      }
      set({ world: res.world });
      save({ world: res.world, news: get().news });

      // Покупка/продажа — сразу видно на острове
      if (action.type === 'buyOffer') {
        const before = new Set(world.players[0].owned.map((a) => a.uid));
        const bought = res.world.players[0].owned.find((a) => !before.has(a.uid));
        if (bought) {
          const def = ASSET_DEFS[bought.defId];
          const tone = def.kind === 'status' ? 'neg' : 'pos';
          const text = def.kind === 'status' ? `−${fmt(bought.upkeep)} в неделю` : `+${fmt(bought.income)} в неделю`;
          setTimeout(() => pushFloats([{ anchor: bought.uid, text, tone }]), 450);
        }
      }
      if (success) get().showToast(success, 'good');
      return true;
    },

    endWeek() {
      const { world, busy } = get();
      if (!world || busy) return;
      const res = applyAction(world, { type: 'endWeek' });
      if (res.error || !res.world.lastReport) {
        if (res.error) get().showToast(res.error, 'bad');
        return;
      }
      const report = res.world.lastReport;
      const mine = report.players[HUMAN];
      const news = [...report.news.map((n) => ({ week: report.week, text: n.text })), ...get().news].slice(0, 40);
      set({ world: res.world, news, busy: true });
      save({ world: res.world, news });

      // Деньги «текут» на острове: зарплата над домом, доход над каждым активом
      const owned = new Map(res.world.players[0].owned.map((a) => [a.uid, a]));
      const labels: Omit<FloatLabel, 'id'>[] = [{ anchor: 'home', text: `+${fmt(mine.salary)}`, tone: 'pos' }];
      for (const a of mine.assetIncome) if (a.amount > 0) labels.push({ anchor: a.assetUid, text: `+${fmt(a.amount)}`, tone: 'pos' });
      for (const u of mine.upkeep) {
        const asset = owned.get(u.assetUid);
        if (asset && u.amount > 0 && ASSET_DEFS[asset.defId].kind === 'status') labels.push({ anchor: u.assetUid, text: `−${fmt(u.amount)}`, tone: 'neg' });
      }
      pushFloats(labels);

      if (report.worldEvents.some((e) => e.id === 'storm')) {
        set({ weather: 'storm' });
        setTimeout(() => set({ weather: 'clear' }), 7000);
      }

      // Событие 'freedom' показываем отдельным праздничным заголовком, а не карточкой
      const events = [...report.worldEvents, ...mine.events.filter((e) => e.id !== 'freedom')];
      setTimeout(() => {
        if (events.length > 0 || mine.freedomReached) {
          set({ modal: { report, events, freedom: mine.freedomReached }, busy: false });
        } else {
          set({ busy: false });
          get().showToast(`Неделя ${report.week}: ${signed(mine.net)} · наличные ${fmt(mine.cashAfter)}`, mine.net >= 0 ? 'good' : 'bad');
        }
      }, events.length > 0 || mine.freedomReached ? 1100 : 500);
    },

    closeModal() { set({ modal: null }); },
    setTab(tab) { set({ tab, sheetOpen: true }); },
    setSheetOpen(open) { set({ sheetOpen: open }); },

    focusItem(uid) {
      set({ tab: 'island', sheetOpen: true, highlightUid: uid });
      setTimeout(() => { if (get().highlightUid === uid) set({ highlightUid: null }); }, 2200);
    },

    showToast(text, tone = 'neutral') {
      const id = ++toastSeq;
      set({ toast: { id, text, tone } });
      setTimeout(() => { if (get().toast?.id === id) set({ toast: null }); }, 3200);
    },
  };
});

/** Что стоит на острове у игрока — в формате сцены. */
export function placedItems(world: WorldState): PlacedItem[] {
  return world.players[0].owned.map((a) => {
    const def = ASSET_DEFS[a.defId];
    return { uid: a.uid, model: def.model, slot: def.slot, slotIndex: a.slotIndex, damaged: a.damaged };
  });
}
