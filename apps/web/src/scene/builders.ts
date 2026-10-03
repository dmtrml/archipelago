// Императивные строители статичного декора (порт функций из concept/index.html)
// и «запекание» групп в одну геометрию с цветами в вершинах — один draw call на группу.
import {
  BufferAttribute, BufferGeometry, Color, CylinderGeometry, Group, Matrix4, Mesh, MeshBasicMaterial,
  type Object3D,
} from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { PAL } from './palette';
import { box, cone, cyl, dodeca, gableRoof, ico, octa } from './materials';
import { shore, type Rng } from './layout';

const DUMMY = new MeshBasicMaterial();

/** Деталь для запекания: цвет хранится в userData, материал не нужен. */
export function part(geo: BufferGeometry, color: number, glow = false): Mesh {
  const m = new Mesh(geo, DUMMY);
  m.userData.c = color;
  if (glow) m.userData.glow = true;
  return m;
}

const tmpColor = new Color();
const rel = new Matrix4();
const inv = new Matrix4();

/** Сливает все детали группы в одну геометрию (в системе координат root). */
export function bake(root: Object3D, glow = false): BufferGeometry | null {
  root.updateMatrixWorld(true);
  inv.copy(root.matrixWorld).invert();
  const geos: BufferGeometry[] = [];
  root.traverse((o) => {
    const m = o as Mesh;
    if (!m.isMesh || m.userData.c === undefined || !!m.userData.glow !== glow) return;
    const g = m.geometry.index ? m.geometry.toNonIndexed() : m.geometry.clone();
    for (const name of Object.keys(g.attributes)) if (name !== 'position' && name !== 'normal') g.deleteAttribute(name);
    g.applyMatrix4(rel.multiplyMatrices(inv, m.matrixWorld));
    const n = g.attributes.position.count;
    const col = new Float32Array(n * 3);
    tmpColor.setHex(m.userData.c as number);
    for (let i = 0; i < n; i++) { col[i * 3] = tmpColor.r; col[i * 3 + 1] = tmpColor.g; col[i * 3 + 2] = tmpColor.b; }
    g.setAttribute('color', new BufferAttribute(col, 3));
    geos.push(g);
  });
  if (!geos.length) return null;
  const merged = mergeGeometries(geos, false);
  for (const g of geos) g.dispose();
  merged.computeBoundingSphere();
  return merged;
}

// ───── Остров ─────

/** Неровный «блин» по береговой линии (beach/grass/hill). */
export function blobGeometry(rTop: number, rBot: number, h: number, amp = 1, segs = 40, seed = 0) {
  const g = new CylinderGeometry(rTop, rBot, h, segs, 2);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    if (x === 0 && z === 0) continue;
    const a = Math.atan2(z, x);
    let f = 1 + (shore(a, seed) - 1) * amp;
    if (Math.abs(y) < 1e-4) f *= 1 + 0.025 * Math.sin(13 * a + seed) + 0.02 * Math.sin(23 * a + 1 + seed);
    p.setX(i, x * f); p.setZ(i, z * f);
  }
  g.computeVertexNormals();
  return g;
}

// ───── Растительность ─────

export interface PalmParts { root: Group; crown: Group }
export function palm(rng: Rng, h = rng.rr(3.6, 4.8), lean = rng.rr(0.15, 0.4)): PalmParts {
  const { rr } = rng;
  const g = new Group();
  const segs = 6, sh = h / segs;
  for (let i = 0; i < segs; i++) {
    const k = (i + 0.5) / segs;
    const seg = part(new CylinderGeometry(0.17 - 0.03 * k, 0.21 - 0.03 * k, sh * 1.05, 6), i % 2 ? PAL.wood : PAL.woodDark);
    seg.position.set(lean * k * k * h * 0.6, sh * (i + 0.5), 0);
    seg.rotation.z = -lean * k * 1.2;
    g.add(seg);
  }
  const crown = new Group();
  crown.position.set(lean * h * 0.6, h, 0);
  const n = 7;
  for (let i = 0; i < n; i++) {
    const pivot = new Group();
    pivot.rotation.y = (i / n) * Math.PI * 2 + rr(-0.2, 0.2);
    const tilt = new Group();
    tilt.rotation.z = -rr(0.25, 0.6);
    const leaf = part(octa(1), i % 2 ? PAL.leaf : PAL.leafDark);
    leaf.scale.set(1.45, 0.1, 0.42);
    leaf.position.x = 1.3;
    tilt.add(leaf); pivot.add(tilt); crown.add(pivot);
  }
  for (let i = 0; i < 3; i++) {
    const nut = part(ico(0.17), PAL.nut);
    nut.position.set(Math.cos(i * 2.1) * 0.22, -0.18, Math.sin(i * 2.1) * 0.22);
    crown.add(nut);
  }
  g.add(crown);
  g.rotation.y = rr(0, Math.PI * 2);
  return { root: g, crown };
}

export function roundTree(rng: Rng) {
  const { rr, rand } = rng;
  const g = new Group();
  const trunk = part(cyl(0.14, 0.2, 1.1, 6), PAL.woodDark);
  trunk.position.y = 0.55; g.add(trunk);
  const s = rr(0.9, 1.25);
  const c1 = part(ico(1), rand() < 0.5 ? PAL.leaf : PAL.leafDark);
  c1.scale.setScalar(s);
  c1.position.y = 1.2 + s * 0.8; c1.rotation.set(rr(0, 3), rr(0, 3), 0); g.add(c1);
  const c2 = part(ico(0.6), PAL.leaf);
  c2.scale.setScalar(s);
  c2.position.set(s * 0.55, 1.2 + s * 1.25, rr(-0.3, 0.3)); g.add(c2);
  return g;
}

export function coneTree(rng: Rng) {
  const { rr } = rng;
  const g = new Group();
  const trunk = part(cyl(0.12, 0.16, 0.7, 6), PAL.woodDark);
  trunk.position.y = 0.35; g.add(trunk);
  const s = rr(0.85, 1.15);
  for (let i = 0; i < 3; i++) {
    const c = part(cone(0.95 * (1 - i * 0.22), 1.3, 7), PAL.leafDark);
    c.scale.setScalar(s);
    c.position.y = 0.9 + i * 0.7 * s; c.rotation.y = rr(0, 1); g.add(c);
  }
  return g;
}

export function rock(rng: Rng, s = 1) {
  const { rr } = rng;
  const r = part(dodeca(1), PAL.rock);
  r.scale.set(s * rr(0.8, 1.3), s * rr(0.5, 0.85), s * rr(0.8, 1.2));
  r.rotation.set(rr(0, 3), rr(0, 3), rr(0, 3));
  return r;
}

/** Дом для запекания (соседние острова). Для живых объектов есть JSX-версия в models/House.tsx. */
export function houseObj(o: { w?: number; d?: number; h?: number; wall?: number; roof?: number; roofH?: number } = {}) {
  const { w = 2.4, d = 2.0, h = 1.6, wall = PAL.wall, roof = PAL.roofCoral, roofH = 1.1 } = o;
  const g = new Group();
  const base = part(box(w + 0.3, 0.26, d + 0.3), PAL.rock); base.position.y = 0.13; g.add(base);
  const body = part(box(w, h, d), wall); body.position.y = 0.26 + h / 2; g.add(body);
  const r = part(gableRoof(w, d, roofH), roof); r.position.y = 0.26 + h; g.add(r);
  const door = part(box(0.52, 0.9, 0.08), PAL.woodDark); door.position.set(-w * 0.2, 0.71, d / 2 + 0.03); g.add(door);
  const w1 = part(box(0.44, 0.44, 0.08), PAL.window, true); w1.position.set(w * 0.22, 0.26 + h * 0.58, d / 2 + 0.03); g.add(w1);
  const w2 = part(box(0.44, 0.44, 0.08), PAL.window, true); w2.rotation.y = Math.PI / 2; w2.position.set(w / 2 + 0.03, 0.26 + h * 0.58, 0); g.add(w2);
  const c = part(box(0.34, 0.9, 0.34), PAL.rock); c.position.set(w * 0.24, 0.26 + h + roofH * 0.55, -d * 0.18); g.add(c);
  return g;
}
