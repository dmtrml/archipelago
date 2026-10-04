import { create } from 'zustand';
import {
  applyAction, assetViews, createWorld, financeView, getPlayer, migrateWorld, ASSET_DEFS, DREAMS, DREAM_UPKEEP_UID,
  type Action, type GameEvent, type WeekReport, type WorldState,
} from '@arch/engine';
import type { DreamProgress, FloatLabel, PlacedItem, Weather } from './scene/contract';
import { fmt, signed } from './format';
import { onAction, onWeek, onWeather, startGameSounds, stopGameSounds } from './audio/gameSounds';

export const HUMAN = 'p1';
const SAVE_KEY = 'archipelago.save.v1';

export type Tab = 'deals' | 'island' | 'actions' | 'report';

export interface Toast { id: number; text: string; tone: 'good' | 'bad' | 'neutral' }
/** `epilogue` — на этой неделе достроена мечта: вместо обычных итогов недели показываем эпилог. */
export interface WeekModal { report: WeekReport; events: GameEvent[]; freedom: boolean; epilogue: boolean }
/** playerId нет у новостей из сохранений до экрана соседей. */
export interface NewsItem { week: number; text: string; playerId?: string }
/** Доля свободы каждого игрока по неделям — для графиков на карточках соседей. */
export type FreedomHistory = Record<string, { week: number; ratio: number }[]>;

const HISTORY_LIMIT = 160;

interface Saved { world: WorldState; news: NewsItem[]; history: FreedomHistory }

/** Сохранение любой поддерживаемой версии мира → текущая версия. Непонятное сохранение игнорируем. */
function load(): Saved | null {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const saved = JSON.parse(raw) as { world?: unknown; news?: NewsItem[]; history?: FreedomHistory } | null;
    const world = migrateWorld(saved?.world);
    if (!world) return null;
    const history = saved?.history && typeof saved.history === 'object' ? saved.history : {};
    return { world, news: Array.isArray(saved?.news) ? saved.news : [], history };
  } catch {
    return null;
  }
}

/** Добавить в историю точку текущей недели для всех игроков. */
function recordHistory(history: FreedomHistory, world: WorldState): FreedomHistory {
  const next: FreedomHistory = { ...history };
  for (const p of world.players) {
    const ratio = Math.round(financeView(world, p.id).freedomRatio * 1000) / 1000;
    const line = (next[p.id] ?? []).filter((pt) => pt.week < world.week);
    next[p.id] = [...line, { week: world.week, ratio }].slice(-HISTORY_LIMIT);
  }
  return next;
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
  history: FreedomHistory;
  /** Чья карточка соседа открыта; null — ничья. */
  neighborId: string | null;
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
  showNeighbor(playerId: string | null): void;
  showToast(text: string, tone?: Toast['tone']): void;
}

const saved = load();
if (saved) save(saved); // старое сохранение переписываем в текущей версии — ключ тот же
let toastSeq = 0;
let floatSeq = 0;

export const useGame = create<GameStore>((set, get) => {
  const timers = new Set<ReturnType<typeof setTimeout>>();
  const schedule = (callback: () => void, delay: number) => {
    const timer = setTimeout(() => { timers.delete(timer); callback(); }, delay);
    timers.add(timer);
  };
  const clearTimers = () => { timers.forEach(clearTimeout); timers.clear(); };
  const pushFloats = (labels: Omit<FloatLabel, 'id'>[], stagger = 170, onFloat?: (label: FloatLabel) => void) => {
    labels.forEach((label, i) => {
      schedule(() => {
        const f: FloatLabel = { ...label, id: `f${++floatSeq}` };
        set((s) => ({ floats: [...s.floats, f] }));
        onFloat?.(f);
        schedule(() => set((s) => ({ floats: s.floats.filter((x) => x.id !== f.id) })), 2600);
      }, i * stagger);
    });
  };

  return {
    world: saved?.world ?? null,
    news: saved?.news ?? [],
    history: saved ? recordHistory(saved.history, saved.world) : {},
    neighborId: null,
    floats: [],
    weather: 'clear',
    toast: null,
    modal: null,
    tab: 'deals',
    sheetOpen: false,
    highlightUid: null,
    busy: false,

    newGame(islandName, playerName) {
      clearTimers();
      if (get().world) stopGameSounds();
      const world = createWorld({ seed: Math.floor(Math.random() * 2 ** 31), playerName, islandName });
      const history = recordHistory({}, world);
      set({ world, news: [], history, neighborId: null, modal: null, tab: 'deals', floats: [], weather: 'clear', busy: false, toast: null });
      save({ world, news: [], history });
      startGameSounds(world);
    },

    resetGame() {
      clearTimers();
      stopGameSounds();
      save(null);
      set({ world: null, news: [], history: {}, neighborId: null, modal: null, floats: [], weather: 'clear', busy: false, toast: null });
    },

    act(action, success) {
      const { world } = get();
      if (!world) return false;
      const res = applyAction(world, action);
      if (res.error) {
        onAction(action, world, res.world, res.error);
        get().showToast(res.error, 'bad');
        return false;
      }
      set({ world: res.world });
      save({ world: res.world, news: get().news, history: get().history });
      onAction(action, world, res.world);

      // Улучшение — над объектом всплывает прибавка к доходу
      if (action.type === 'upgradeAsset') {
        const before = world.players[0].owned.find((a) => a.uid === action.assetUid);
        const after = assetViews(res.world, HUMAN).find((v) => v.asset.uid === action.assetUid);
        if (before && after) {
          const gain = after.asset.income - before.income;
          if (gain > 0) schedule(() => pushFloats([{ anchor: action.assetUid, text: `+${fmt(gain)} в неделю`, tone: 'pos' }]), 500);
        }
      }

      // Покупка/продажа — сразу видно на острове
      if (action.type === 'buyOffer') {
        const before = new Set(world.players[0].owned.map((a) => a.uid));
        const bought = res.world.players[0].owned.find((a) => !before.has(a.uid));
        if (bought) {
          const def = ASSET_DEFS[bought.defId];
          const tone = def.kind === 'status' ? 'neg' : 'pos';
          const text = def.kind === 'status' ? `−${fmt(bought.upkeep)} в неделю` : `+${fmt(bought.income)} в неделю`;
          schedule(() => pushFloats([{ anchor: bought.uid, text, tone }]), 450);
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
      const sounds = onWeek(report, world, res.world);
      const mine = report.players[HUMAN];
      const news = [
        ...report.news.map((n) => ({ week: report.week, text: n.text, playerId: n.playerId })),
        ...get().news,
      ].slice(0, 80);
      const history = recordHistory(get().history, res.world);
      set({ world: res.world, news, history, busy: true });
      save({ world: res.world, news, history });

      // Деньги «текут» на острове: зарплата над домом, доход над каждым активом
      const owned = new Map(res.world.players[0].owned.map((a) => [a.uid, a]));
      const labels: Omit<FloatLabel, 'id'>[] = [{ anchor: 'home', text: `+${fmt(mine.salary)}`, tone: 'pos' }];
      for (const a of mine.assetIncome) if (a.amount > 0) labels.push({ anchor: a.assetUid, text: `+${fmt(a.amount)}`, tone: 'pos' });
      for (const u of mine.upkeep) {
        // Готовая шхуна тоже стоит денег каждую неделю — красный минус над стапелем
        if (u.assetUid === DREAM_UPKEEP_UID && u.amount > 0) {
          labels.push({ anchor: 'dream', text: `−${fmt(u.amount)}`, tone: 'neg' });
          continue;
        }
        const asset = owned.get(u.assetUid);
        if (asset && u.amount > 0 && ASSET_DEFS[asset.defId].kind === 'status') labels.push({ anchor: u.assetUid, text: `−${fmt(u.amount)}`, tone: 'neg' });
      }
      pushFloats(labels, 170, sounds.onFloat);

      if (report.worldEvents.some((e) => e.id === 'storm')) {
        set({ weather: 'storm' });
        onWeather('storm');
        schedule(() => { set({ weather: 'clear' }); onWeather('clear'); }, 7000);
      }

      // Событие 'freedom' показываем отдельным праздничным заголовком, а не карточкой;
      // 'dreamDone' открывает эпилог вместо обычного окна недели
      const events = [...report.worldEvents, ...mine.events.filter((e) => e.id !== 'freedom')];
      const epilogue = mine.events.some((e) => e.id === 'dreamDone');
      schedule(() => {
        if (events.length > 0 || mine.freedomReached || epilogue) {
          set({ modal: { report, events, freedom: mine.freedomReached, epilogue }, busy: false });
          sounds.onModal();
        } else {
          set({ busy: false });
          sounds.onModal(false);
          get().showToast(`Неделя ${report.week}: ${signed(mine.net)} · наличные ${fmt(mine.cashAfter)}`, mine.net >= 0 ? 'good' : 'bad');
        }
      }, events.length > 0 || mine.freedomReached || epilogue || sounds.hasNotice ? 1100 : 500);
    },

    closeModal() { set({ modal: null }); },
    setTab(tab) { set({ tab, sheetOpen: true }); },
    setSheetOpen(open) { set({ sheetOpen: open }); },

    focusItem(uid) {
      if (uid === 'dream') {
        // Мечта живёт в блоке «Мечта»: на телефоне — во вкладке «Отчёт», на компьютере он всегда на виду
        const mobile = window.matchMedia('(max-width: 1023px)').matches;
        set(mobile ? { tab: 'report', sheetOpen: true, highlightUid: uid } : { highlightUid: uid });
      } else {
        set({ tab: 'island', sheetOpen: true, highlightUid: uid });
      }
      schedule(() => { if (get().highlightUid === uid) set({ highlightUid: null }); }, 2200);
    },

    showNeighbor(playerId) {
      set((s) => ({ neighborId: playerId !== null && s.neighborId === playerId ? null : playerId }));
    },

    showToast(text, tone = 'neutral') {
      const id = ++toastSeq;
      set({ toast: { id, text, tone } });
      schedule(() => { if (get().toast?.id === id) set({ toast: null }); }, 3200);
    },
  };
});

if (saved) startGameSounds(saved.world);

/** Что стоит на острове у игрока — в формате сцены. */
export function placedItems(world: WorldState): PlacedItem[] {
  return world.players[0].owned.map((a) => {
    const def = ASSET_DEFS[a.defId];
    return { uid: a.uid, model: def.model, slot: def.slot, slotIndex: a.slotIndex, damaged: a.damaged, level: a.level ?? 1 };
  });
}

/** Мечта игрока в формате сцены; null — мечты нет. */
export function dreamProgress(world: WorldState): DreamProgress | null {
  const dream = getPlayer(world, HUMAN).dream;
  if (!dream) return null;
  return { built: dream.built, stages: DREAMS[dream.id].stages.length, building: dream.building };
}
