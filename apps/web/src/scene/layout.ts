// Геометрия острова: береговая линия, ключевые точки, ГПСЧ. Всё как в concept/index.html.
import { Vector3 } from 'three';

export function mulberry32(seed: number) {
  let a = seed;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface Rng { rand: () => number; rr: (a: number, b: number) => number }
export function makeRng(seed: number): Rng {
  const rand = mulberry32(seed);
  return { rand, rr: (a, b) => a + (b - a) * rand() };
}

export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x);
export const easeOutBack = (x: number) => {
  const c1 = 1.70158, c3 = c1 + 1;
  return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2);
};

// Береговая линия: неровный круг, одинаковый для всех слоёв острова
export const shore = (a: number, s = 0) =>
  1 + 0.1 * Math.sin(3 * a + 0.7 + s) + 0.06 * Math.sin(5 * a + 2.1 + s * 1.3) + 0.04 * Math.sin(9 * a + s * 2.0);

export const GRASS_R = 12.5, BEACH_R = 15.5, GRASS_Y = 1.4, BEACH_Y = 0.6;

export const onGrass = (a: number, frac: number) => {
  const r = frac * GRASS_R * shore(a);
  return new Vector3(Math.cos(a) * r, GRASS_Y, Math.sin(a) * r);
};
export const onBeach = (a: number, t: number) => {
  const f = shore(a);
  const r = lerp(GRASS_R * f + 0.6, BEACH_R * f - 0.3, t);
  return new Vector3(Math.cos(a) * r, BEACH_Y, Math.sin(a) * r);
};
/** Точка по «экранным» координатам кадра по умолчанию: sx — вправо, d — к камере. */
export const fromScreen = (sx: number, d: number, y = GRASS_Y) =>
  new Vector3(Math.SQRT1_2 * (sx + d), y, Math.SQRT1_2 * (d - sx));

/** Поворот, при котором фасад (+z) смотрит в камеру по умолчанию. */
export const FACE_CAMERA = Math.PI / 4;

// ───── Камера ─────
export const TARGET = new Vector3(0, -1.2, 0);
export const CAM_DIR = new Vector3(1, 0.62, 1).normalize();
export const idealDistance = (aspect: number) => (aspect < 1 ? 68 * Math.min(1.6, 0.85 / aspect) : 68);

// ───── Ключевые точки ─────
export const HILL_A = -2.35;
export const HILL_POS = onGrass(HILL_A, 0.4);
export const HILL_TOP = GRASS_Y + 2.2;

export const LIGHT_A = -0.55;
export const LIGHT_POS = onGrass(LIGHT_A, 0.8);

export const PLAZA_POS = onGrass(1.1, 0.16);
export const PLAZA_R = 2.3;
/** Вторая, малая площадка рядом с площадью — место для второго «статусного» объекта. */
export const PLAZA_ANNEX_POS = fromScreen(3.0, 1.8);
export const PLAZA_ANNEX_R = 1.75;
export const LAMP_ANGLES = [0.9, -2.2];

export const PIER_A = 1.0;
export const PIER_START = onBeach(PIER_A, 0.15);
export const PIER_LEN = 8.5;
export const PIER_LANDING = onGrass(PIER_A, 0.95);

/** Резерв места: декор не ставится внутри этих кругов. */
export interface Reserve {
  x: number; z: number; r: number;
  /** радиус «ядра» — ближе него не растёт даже трава (по умолчанию = r) */
  core?: number;
}
export const isFreeIn = (list: Reserve[], x: number, z: number, r: number, coreOnly = false) =>
  list.every((o) => Math.hypot(o.x - x, o.z - z) > (coreOnly ? o.core ?? o.r : o.r) + r);
