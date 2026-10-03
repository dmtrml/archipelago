// Статичный декор острова: пирс, площадь, тропинка, пальмы, деревья, камни, трава и цветы.
// Всё неподвижное «запекается» в одну геометрию (один draw call), кроны пальм качаются отдельно,
// трава и цветы — InstancedMesh. Декор обходит все места слотов (SLOT_RESERVES).
import { useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import {
  type BufferGeometry, Color, Euler, Group, type InstancedMesh, Matrix4, type Mesh, Quaternion, Vector3,
} from 'three';
import { FLOWER_COLORS, PAL } from '../palette';
import { VERTEX_MAT, box, cone, cyl, ico, mat } from '../materials';
import { bake, coneTree, palm, part, rock, roundTree } from '../builders';
import {
  BEACH_Y, GRASS_Y, HILL_POS, LAMP_ANGLES, LIGHT_A, LIGHT_POS, PIER_A, PIER_LANDING, PIER_LEN, PIER_START,
  PLAZA_ANNEX_POS, PLAZA_ANNEX_R, PLAZA_POS, PLAZA_R, type Reserve, isFreeIn, lerp, makeRng, onBeach, onGrass,
} from '../layout';
import { SLOT_RESERVES } from '../slots';
import { useBus } from '../bus';

interface Crown { geo: BufferGeometry; pos: Vector3; rotY: number; local: Vector3; phase: number }

const TUFTS = 160, FLOWERS = 70;
const noRay = () => null;

function buildDecor() {
  const rng = makeRng(20261003);
  const { rr, rand } = rng;

  const reserved: Reserve[] = [
    { x: HILL_POS.x, z: HILL_POS.z, r: 5.2 },
    { x: LIGHT_POS.x, z: LIGHT_POS.z, r: 1.9 },
    { x: PLAZA_POS.x, z: PLAZA_POS.z, r: PLAZA_R + 0.2 },
    { x: PLAZA_ANNEX_POS.x, z: PLAZA_ANNEX_POS.z, r: PLAZA_ANNEX_R + 0.2 },
    { x: PIER_LANDING.x, z: PIER_LANDING.z, r: 1.5 },
    ...SLOT_RESERVES,
  ];
  // коридор пирса на пляже
  for (const d of [0.4, 1.6, 2.8]) {
    reserved.push({ x: PIER_START.x + Math.cos(PIER_A) * d, z: PIER_START.z + Math.sin(PIER_A) * d, r: 1.2 });
  }
  const isFree = (p: Vector3, r: number, coreOnly = false) => isFreeIn(reserved, p.x, p.z, r, coreOnly);
  const reserve = (p: Vector3, r: number) => reserved.push({ x: p.x, z: p.z, r });

  const root = new Group();
  const crowns: Crown[] = [];

  // ───── Пирс ─────
  {
    const pier = new Group();
    pier.position.set(PIER_START.x, 0, PIER_START.z);
    pier.rotation.y = -PIER_A;
    const deck = part(box(PIER_LEN, 0.18, 1.7), PAL.wood);
    deck.position.set(PIER_LEN / 2, 0.82, 0); pier.add(deck);
    for (let x = 0.45; x < PIER_LEN; x += 0.85) {
      const l = part(box(0.06, 0.19, 1.72), PAL.woodDark);
      l.position.set(x, 0.825, 0); pier.add(l);
    }
    for (let x = 1.2; x <= PIER_LEN; x += 1.8) for (const z of [-0.82, 0.82]) {
      const post = part(cyl(0.11, 0.11, 2.8, 6), PAL.woodDark);
      post.position.set(x, -0.35, z); pier.add(post);
    }
    const crate = part(box(0.6, 0.5, 0.6), PAL.wood);
    crate.position.set(PIER_LEN - 0.6, 1.16, -0.4); crate.rotation.y = 0.3; pier.add(crate);
    root.add(pier);
  }

  // ───── Площадь (+ малая площадка) и фонари ─────
  {
    const plaza = part(cyl(PLAZA_R, PLAZA_R + 0.05, 0.14, 18), PAL.stone);
    plaza.position.set(PLAZA_POS.x, GRASS_Y + 0.07, PLAZA_POS.z); root.add(plaza);
    const annex = part(cyl(PLAZA_ANNEX_R, PLAZA_ANNEX_R + 0.05, 0.1, 16), PAL.stone);
    annex.position.set(PLAZA_ANNEX_POS.x, GRASS_Y + 0.05, PLAZA_ANNEX_POS.z); root.add(annex);
    for (const da of LAMP_ANGLES) {
      const lp = new Group();
      lp.position.set(PLAZA_POS.x + Math.cos(da) * 2.0, GRASS_Y + 0.14, PLAZA_POS.z + Math.sin(da) * 2.0);
      const pole = part(cyl(0.05, 0.07, 1.6, 6), PAL.night); pole.position.y = 0.8; lp.add(pole);
      const bulb = part(ico(0.16, 1), PAL.window, true); bulb.position.y = 1.7; lp.add(bulb);
      root.add(lp);
    }
  }

  // ───── Тропинка от площади к пирсу ─────
  {
    const from = PLAZA_POS, to = onGrass(PIER_A, 0.92);
    for (let i = 1; i <= 6; i++) {
      const k = i / 7.5;
      const s = part(cyl(0.42, 0.45, 0.1, 7), PAL.stone);
      s.position.set(lerp(from.x, to.x, k) + rr(-0.25, 0.25), GRASS_Y + 0.05, lerp(from.z, to.z, k) + rr(-0.25, 0.25));
      s.rotation.y = rr(0, 3);
      root.add(s);
      reserve(s.position, 0.6);
    }
  }

  // ───── Камни у маяка ─────
  for (let i = 0; i < 6; i++) {
    const r = rock(rng, rr(0.4, 0.75));
    const p = onBeach(LIGHT_A + rr(-0.35, 0.35), rr(0.4, 1.0));
    r.position.set(p.x, BEACH_Y + rr(-0.2, 0.1), p.z);
    root.add(r);
  }

  const addPalm = (pos: Vector3, h?: number) => {
    const { root: g, crown } = h === undefined ? palm(rng) : palm(rng, h);
    g.position.copy(pos);
    g.remove(crown);
    crown.updateMatrixWorld(true);
    const geo = bake(crown);
    if (geo) crowns.push({ geo, pos: pos.clone(), rotY: g.rotation.y, local: crown.position.clone(), phase: rr(0, 6) });
    root.add(g);
  };

  // ───── Пальмы на пляже (обходят места слотов) ─────
  for (const a0 of [-2.95, -2.1, -1.6, -1.05, 0.05, 0.45, 1.5, 2.65, 3.05]) {
    for (const da of [0, 0.12, -0.12, 0.24, -0.24, 0.36, -0.36]) {
      const p = onBeach(a0 + da + rr(-0.06, 0.06), rr(0.05, 0.35));
      if (!isFree(p, 0.9)) continue;
      addPalm(p);
      reserve(p, 0.9);
      break;
    }
  }

  // ───── Деревья на траве ─────
  let trees = 0;
  for (let k = 0; k < 1500 && trees < 15; k++) {
    const p = onGrass(rr(-Math.PI, Math.PI), rr(0.12, 0.9));
    if (!isFree(p, 1.3)) continue;
    const roll = rand();
    if (roll >= 0.62 && roll < 0.75) addPalm(p, rr(3.0, 3.8));
    else {
      const t = roll < 0.62 ? roundTree(rng) : coneTree(rng);
      t.position.copy(p);
      root.add(t);
    }
    reserve(p, 1.3);
    trees++;
  }

  // ───── Пучки травы и цветы (инстансы) ─────
  const tuftM: Matrix4[] = [], flowerM: Matrix4[] = [], flowerC: Color[] = [];
  {
    const q = new Quaternion(), s = new Vector3(), e = new Euler();
    for (let k = 0; k < 2000 && (tuftM.length < TUFTS || flowerM.length < FLOWERS); k++) {
      const p = onGrass(rr(-Math.PI, Math.PI), Math.sqrt(rand()) * 0.95);
      // трава подходит к пустым участкам ближе, чем деревья (во дворе дома она уместна)
      if (!isFree(p, 0.15, true)) continue;
      if (tuftM.length < TUFTS) {
        q.setFromEuler(e.set(rr(-0.2, 0.2), rr(0, 3), rr(-0.2, 0.2)));
        s.setScalar(rr(0.7, 1.3));
        tuftM.push(new Matrix4().compose(new Vector3(p.x, GRASS_Y + 0.22, p.z), q, s));
      } else {
        flowerM.push(new Matrix4().compose(new Vector3(p.x, GRASS_Y + 0.1, p.z), q.identity(), s.setScalar(1)));
        flowerC.push(new Color(FLOWER_COLORS[flowerC.length % FLOWER_COLORS.length]));
      }
    }
  }

  // ───── Камни у кромки воды ─────
  for (let i = 0; i < 9; i++) {
    const a = rr(-Math.PI, Math.PI);
    const s = rr(0.35, 0.8);
    const p = onBeach(a, rr(0.75, 1.15));
    const y = rr(0.1, 0.5);
    if (Math.abs(a - PIER_A) < 0.35 || !isFree(p, 0.6)) continue;
    const r = rock(rng, s);
    r.position.set(p.x, y, p.z);
    root.add(r);
  }

  return { solid: bake(root)!, glow: bake(root, true), crowns, tuftM, flowerM, flowerC };
}

function Crowns({ crowns }: { crowns: Crown[] }) {
  const bus = useBus();
  const refs = useRef<(Mesh | null)[]>([]);
  useFrame(() => {
    const { waveTime: t, k } = bus.weather;
    const amp = 1 + 2.4 * k;
    for (let i = 0; i < crowns.length; i++) {
      const m = refs.current[i];
      if (!m) continue;
      const ph = crowns[i].phase;
      m.rotation.z = Math.sin(t * 1.1 + ph) * 0.05 * amp - 0.06 * k;
      m.rotation.x = Math.cos(t * 0.8 + ph) * 0.04 * amp;
    }
  });
  return (
    <>
      {crowns.map((c, i) => (
        <group key={i} position={c.pos} rotation={[0, c.rotY, 0]}>
          <mesh
            ref={(el) => { refs.current[i] = el; }}
            geometry={c.geo}
            material={VERTEX_MAT}
            position={c.local}
            castShadow
            receiveShadow
            raycast={noRay}
          />
        </group>
      ))}
    </>
  );
}

export function Decor() {
  const d = useMemo(buildDecor, []);
  const tufts = useRef<InstancedMesh>(null!);
  const flowers = useRef<InstancedMesh>(null!);

  useLayoutEffect(() => {
    d.tuftM.forEach((m, i) => tufts.current.setMatrixAt(i, m));
    tufts.current.count = d.tuftM.length;
    tufts.current.instanceMatrix.needsUpdate = true;
    tufts.current.computeBoundingSphere();
    d.flowerM.forEach((m, i) => {
      flowers.current.setMatrixAt(i, m);
      flowers.current.setColorAt(i, d.flowerC[i]);
    });
    flowers.current.count = d.flowerM.length;
    flowers.current.instanceMatrix.needsUpdate = true;
    if (flowers.current.instanceColor) flowers.current.instanceColor.needsUpdate = true;
    flowers.current.computeBoundingSphere();
  }, [d]);

  useEffect(() => () => {
    d.solid.dispose();
    d.glow?.dispose();
    d.crowns.forEach((c) => c.geo.dispose());
  }, [d]);

  return (
    <group>
      <mesh geometry={d.solid} material={VERTEX_MAT} castShadow receiveShadow raycast={noRay} />
      {d.glow && <mesh geometry={d.glow} material={mat(PAL.window, { emissive: PAL.window, emissiveIntensity: 0.9 })} raycast={noRay} />}
      <Crowns crowns={d.crowns} />
      <instancedMesh ref={tufts} args={[cone(0.13, 0.5, 3), mat(PAL.grassDark), TUFTS]} castShadow receiveShadow raycast={noRay} />
      <instancedMesh ref={flowers} args={[ico(0.1), mat(PAL.white), FLOWERS]} raycast={noRay} />
    </group>
  );
}
