// Места на острове для каждого слота. Вместимость обязана совпадать с SLOT_CAPACITY
// из packages/engine/src/slots.ts: pier 4, plot 6, beach 3, plaza 2, sea 2 (finance — один банк).
import type { SlotType } from '@arch/engine';
import {
  BEACH_Y, FACE_CAMERA, GRASS_Y, PIER_A, PIER_START, PLAZA_ANNEX_POS, PLAZA_POS,
  fromScreen, onBeach, type Reserve,
} from './layout';

export interface SlotPlace { x: number; y: number; z: number; rotY: number }

// Лодки у пирса: координаты в системе пирса (x — вдоль настила от берега, z — поперёк)
const pierPlace = (lx: number, lz: number, rot: number): SlotPlace => {
  const c = Math.cos(PIER_A), s = Math.sin(PIER_A);
  return { x: PIER_START.x + lx * c - lz * s, y: 0, z: PIER_START.z + lx * s + lz * c, rotY: -PIER_A + rot };
};

const plotPlace = (sx: number, d: number, rot: number): SlotPlace => {
  const p = fromScreen(sx, d);
  return { x: p.x, y: GRASS_Y, z: p.z, rotY: FACE_CAMERA + rot };
};

// На пляже фасад смотрит в море, немного довёрнут к камере
const beachPlace = (a: number, t: number, toCam = 0.4): SlotPlace => {
  const p = onBeach(a, t);
  const out = Math.PI / 2 - a;
  return { x: p.x, y: BEACH_Y, z: p.z, rotY: out + (FACE_CAMERA - out) * toCam };
};

const seaPlace = (a: number, r: number, rotY: number): SlotPlace => ({ x: Math.cos(a) * r, y: 0, z: Math.sin(a) * r, rotY });

export const SLOTS: Record<Exclude<SlotType, 'finance'>, SlotPlace[]> = {
  // по очереди с двух сторон пирса, сначала дальние
  pier: [pierPlace(7.4, 1.95, 0.05), pierPlace(7.4, -1.95, -0.06), pierPlace(4.5, 1.95, -0.05), pierPlace(4.5, -1.95, 0.07)],
  // участки на траве; первые — ближе к камере
  plot: [
    plotPlace(2.2, 8.0, -0.15),
    plotPlace(-5.2, 7.5, 0.25),
    plotPlace(6.2, 5.6, -0.3),
    plotPlace(7.0, -3.5, -0.2),
    plotPlace(-7.5, 2.0, 0.3),
    plotPlace(6.5, -8.0, -0.1),
  ],
  // два места на широком песке (справа и слева) и одно на узком у пирса — там фасадом строго к морю
  beach: [beachPlace(0.1, 0.45), beachPlace(2.25, 0.42), beachPlace(1.62, 0.55, 0.12)],
  plaza: [
    { x: PLAZA_POS.x, y: GRASS_Y + 0.14, z: PLAZA_POS.z, rotY: FACE_CAMERA },
    { x: PLAZA_ANNEX_POS.x, y: GRASS_Y + 0.1, z: PLAZA_ANNEX_POS.z, rotY: FACE_CAMERA },
  ],
  sea: [seaPlace(0.42, 20.5, 0.75), seaPlace(1.72, 20, 2.1)],
};

/** Банк — один на все финансовые вложения, у подножия холма рядом с домом. */
const bankP = fromScreen(-7, -5);
export const BANK_PLACE: SlotPlace = { x: bankP.x, y: GRASS_Y, z: bankP.z, rotY: FACE_CAMERA + 0.2 };

export function slotPlace(slot: SlotType, index: number): SlotPlace | null {
  if (slot === 'finance') return BANK_PLACE;
  return SLOTS[slot]?.[index] ?? null;
}

/** Круги, свободные от декора (деревья, пальмы, камни, трава). */
export const SLOT_RESERVES: Reserve[] = [
  ...SLOTS.plot.map((p) => ({ x: p.x, z: p.z, r: 2.1, core: 1.8 })),
  ...SLOTS.beach.map((p) => ({ x: p.x, z: p.z, r: 2.5 })),
  { x: BANK_PLACE.x, z: BANK_PLACE.z, r: 2.3 },
];
