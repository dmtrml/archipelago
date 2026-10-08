import type { CameraPose } from '../scene/contract';

export const BPM = 99;
export const FIRST_BEAT = 0.023;
export const BEAT = 60 / BPM;

export type TrailerFormat = 'v' | 'h';
export type TrailerLang = 'ru' | 'en';
export type ShotId =
  | 'hook'
  | 'asset'
  | 'upgrade'
  | 'liability'
  | 'scam-card'
  | 'scam-collapse'
  | 'storm'
  | 'neighbors'
  | 'freedom'
  | 'dream'
  | 'end';

export interface ShotSpec {
  id: ShotId;
  kind: 'scene' | 'game';
  camera?: { from: CameraPose; to: CameraPose };
  caption?: Record<TrailerLang, string>;
}

const pose = (target: [number, number, number], az: number, el: number, fromD: number, toD = fromD, toAz = az) => ({
  from: { target, az, el, d: fromD },
  to: { target, az: toAz, el, d: toD },
});

export const SHOTS: Record<ShotId, ShotSpec> = {
  hook: {
    id: 'hook',
    kind: 'scene',
    camera: pose([0, -1.2, 0], 30, 24, 68, 64, 60),
    caption: { ru: '600 монет и маленький остров', en: '600 coins and a tiny island' },
  },
  asset: {
    id: 'asset',
    kind: 'scene',
    camera: pose([9.85, 0.6, 18.94], 35, 26, 30, 26, 50),
    caption: { ru: '**Активы** приносят деньги каждую неделю', en: '**Assets** pay you every week' },
  },
  upgrade: {
    id: 'upgrade',
    kind: 'scene',
    camera: pose([9.85, 0.6, 18.94], 50, 24, 24, 22, 62),
    caption: { ru: 'Улучшайте то, что уже есть', en: 'Upgrade what you already own' },
  },
  liability: {
    id: 'liability',
    kind: 'scene',
    camera: pose([9.8, 0.8, 5], 35, 22, 50, 45, 50),
    caption: {
      ru: '**Пассивы** красивые — но только забирают деньги',
      en: '**Liabilities** look great — but only take your money',
    },
  },
  'scam-card': { id: 'scam-card', kind: 'game', caption: { ru: 'Купили бы?', en: 'Would you buy it?' } },
  'scam-collapse': { id: 'scam-collapse', kind: 'game', caption: { ru: 'Это была афера', en: 'It was a scam' } },
  storm: {
    id: 'storm',
    kind: 'scene',
    camera: pose([2, -0.8, 4], 65, 18, 64, 60, 55),
    caption: { ru: 'Риски — настоящие', en: 'The risks are real' },
  },
  neighbors: {
    id: 'neighbors',
    kind: 'game',
    caption: {
      ru: 'Соседи идут к той же цели — каждый своим путём',
      en: 'Your neighbors chase the same goal — each their own way',
    },
  },
  freedom: {
    id: 'freedom',
    kind: 'game',
    caption: { ru: 'Когда активы покрывают все расходы…', en: 'When your assets cover all your expenses…' },
  },
  dream: {
    id: 'dream',
    kind: 'scene',
    camera: pose([18, 0.5, -5.2], 80, 22, 36, 32, 95),
    caption: { ru: 'А потом — мечта', en: 'And then — your dream' },
  },
  end: { id: 'end', kind: 'scene', camera: pose([0, -1.2, 0], 45, 26, 72, 72, 70) },
};

export const EDIT = {
  v30: {
    totalBeats: 49.5,
    shots: [
      ['hook', 0, 4],
      ['asset', 4, 10],
      ['liability', 10, 16],
      ['scam-card', 16, 19],
      ['scam-collapse', 19, 24],
      ['storm', 24, 28],
      ['freedom', 28, 36],
      ['dream', 36, 42],
      ['end', 42, 49.5],
    ],
  },
  h45: {
    totalBeats: 74.25,
    shots: [
      ['hook', 0, 6],
      ['asset', 6, 14],
      ['upgrade', 14, 20],
      ['liability', 20, 26],
      ['scam-card', 26, 31],
      ['scam-collapse', 31, 37],
      ['storm', 37, 42],
      ['neighbors', 42, 50],
      ['freedom', 50, 58],
      ['dream', 58, 64],
      ['end', 64, 74.25],
    ],
  },
} as const satisfies Record<string, { totalBeats: number; shots: readonly (readonly [ShotId, number, number])[] }>;

export function cameraAt(spec: ShotSpec, progress: number, format: TrailerFormat): CameraPose {
  const camera = spec.camera!;
  const k = Math.max(0, Math.min(1, progress));
  const narrow = format === 'v' ? 1.511 : 1;
  return {
    target: camera.from.target,
    az: camera.from.az + (camera.to.az - camera.from.az) * k,
    el: camera.from.el + (camera.to.el - camera.from.el) * k,
    d: (camera.from.d + (camera.to.d - camera.from.d) * k) * narrow,
  };
}
