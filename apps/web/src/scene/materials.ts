// Общие материалы и геометрии: кэш по цвету/размерам, чтобы не плодить копии.
import {
  BoxGeometry, BufferGeometry, Color, ConeGeometry, CylinderGeometry, DodecahedronGeometry,
  ExtrudeGeometry, IcosahedronGeometry, MeshStandardMaterial, OctahedronGeometry, RingGeometry,
  Shape, SphereGeometry, TorusGeometry, type Side,
} from 'three';
import { PAL } from './palette';

export interface MatOpts {
  emissive?: number;
  emissiveIntensity?: number;
  roughness?: number;
  metalness?: number;
  transparent?: boolean;
  opacity?: number;
  side?: Side;
}

const matCache = new Map<string, MeshStandardMaterial>();
export function mat(color: number, o?: MatOpts): MeshStandardMaterial {
  const key = o ? color + JSON.stringify(o) : String(color);
  let m = matCache.get(key);
  if (!m) {
    m = new MeshStandardMaterial({ color, flatShading: true, roughness: 0.85, metalness: 0, ...o });
    matCache.set(key, m);
  }
  return m;
}

/** Материал для «запечённого» статичного декора: цвет хранится в вершинах. */
export const VERTEX_MAT = new MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.85, metalness: 0 });
export const WINDOW_OPTS: MatOpts = { emissive: PAL.window, emissiveIntensity: 0.35 };

const ca = new Color(), cb = new Color();
/** Смешение двух цветов палитры (k = 0 → a, 1 → b). */
export function shade(a: number, b: number, k: number): number {
  return ca.setHex(a).lerp(cb.setHex(b), k).getHex();
}
/** Цвет повреждённого объекта: темнее и чуть серее. */
export const damagedColor = (c: number) => shade(shade(c, PAL.rock, 0.28), PAL.night, 0.2);

// ───── Геометрии ─────
const geoCache = new Map<string, BufferGeometry>();
export function cached<T extends BufferGeometry>(key: string, make: () => T): T {
  let g = geoCache.get(key) as T | undefined;
  if (!g) { g = make(); geoCache.set(key, g); }
  return g;
}
export const box = (w: number, h: number, d: number) => cached(`b${w},${h},${d}`, () => new BoxGeometry(w, h, d));
export const cyl = (rt: number, rb: number, h: number, s = 8) =>
  cached(`c${rt},${rb},${h},${s}`, () => new CylinderGeometry(rt, rb, h, s));
export const cone = (r: number, h: number, s = 8) => cached(`k${r},${h},${s}`, () => new ConeGeometry(r, h, s));
export const ico = (r: number, d = 0) => cached(`i${r},${d}`, () => new IcosahedronGeometry(r, d));
export const octa = (r: number) => cached(`o${r}`, () => new OctahedronGeometry(r, 0));
export const dodeca = (r: number) => cached(`d${r}`, () => new DodecahedronGeometry(r, 0));
export const sphere = (r: number, w = 8, h = 6) => cached(`s${r},${w},${h}`, () => new SphereGeometry(r, w, h));
export const torus = (R: number, t: number, rs = 6, ts = 16, arc = Math.PI * 2) =>
  cached(`t${R},${t},${rs},${ts},${arc}`, () => new TorusGeometry(R, t, rs, ts, arc));
export const ring = (ri: number, ro: number, s = 48) => cached(`r${ri},${ro},${s}`, () => new RingGeometry(ri, ro, s));

/** Двускатная крыша-призма (как в concept: house()). Начало — у основания по центру. */
export const gableRoof = (w: number, d: number, h: number, o = 0.28) =>
  cached(`roof${w},${d},${h},${o}`, () => {
    const s = new Shape();
    s.moveTo(-w / 2 - o, 0); s.lineTo(w / 2 + o, 0); s.lineTo(0, h); s.closePath();
    const g = new ExtrudeGeometry(s, { depth: d + o * 2, bevelEnabled: false });
    g.translate(0, 0, -(d + o * 2) / 2);
    return g;
  });

/** Корпус лодки: коробка, сужающаяся к носу (+x) и ко дну. */
export const hullGeo = (len: number, h: number, w: number, key: string) =>
  cached(`hull${key}`, () => {
    const g = new BoxGeometry(len, h, w, 4, 1, 1);
    const p = g.attributes.position;
    const half = len / 2, bowStart = half * 0.46;
    for (let i = 0; i < p.count; i++) {
      let x = p.getX(i), z = p.getZ(i);
      const y = p.getY(i);
      if (y < 0) { z *= 0.55; x *= 0.86; }
      if (x > bowStart) {
        z *= 1 - ((x - bowStart) / (half - bowStart)) * 0.88;
        if (y > 0) p.setY(i, y + h * 0.2);
      }
      p.setX(i, x); p.setZ(i, z);
    }
    g.computeVertexNormals();
    return g;
  });
