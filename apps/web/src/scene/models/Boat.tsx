// Рыбацкая лодка (порт из концепта) → «Баркас» → «Траулер». Качается у пирса; повреждённая — накренилась и осела.
//   1 — лодка с треугольным парусом;
//   2 — баркас: корпус длиннее и выше, рубка с окнами на корме, большой гафельный парус и кливер;
//   3 — траулер: крупный корпус, двухъярусная рубка с горящими окнами, труба с дымком, мачта с огнём,
//       золотая П-рама на корме с сетью, барабан с сетью, оранжевые буи-кранцы.
// Корпус всегда цвета варианта — четыре лодки у пирса различимы на любом уровне.
import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { ExtrudeGeometry, type Group, Shape } from 'three';
import { PAL } from '../palette';
import { box, cached, cyl, hullGeo, ico, sphere, torus } from '../materials';
import { useBus } from '../bus';
import { Beam, DARK_SMOKE, LIT_OPTS, M, Smoke, Win, useDamageBlend, Z, type V3 } from './parts';
import type { ModelProps } from './types';
import { Baked } from './Baked';

const HULLS = [PAL.roofCoral, PAL.roofTeal, PAL.roofGold, PAL.wood];
/** Крыша рубки — контрастная корпусу. */
const CABIN_ROOFS = [PAL.roofTeal, PAL.roofCoral, PAL.roofTeal, PAL.roofCoral];
/** Большая лодка тяжелее: качается меньше и сидит чуть выше (корпус глубже). */
const SWAY = [1, 0.85, 0.72];
const BASE_Y = [0.12, 0.14, 0.17];

const sailGeo = () =>
  cached('boatSail', () => {
    const s = new Shape();
    s.moveTo(0, 0); s.lineTo(0, 2.0); s.lineTo(-1.25, 0.1); s.closePath();
    return new ExtrudeGeometry(s, { depth: 0.04, bevelEnabled: false });
  });

/** Кливер баркаса: треугольник от мачты к носу (координаты — относительно основания мачты). */
const jibGeo = () =>
  cached('boatJib', () => {
    const s = new Shape();
    s.moveTo(0.06, 0.62); s.lineTo(0.06, 2.62); s.lineTo(0.96, 0.24); s.closePath();
    return new ExtrudeGeometry(s, { depth: 0.04, bevelEnabled: false }).translate(0, 0, -0.02);
  });

function Boat1({ hull, damaged }: { hull: number; damaged: boolean }) {
  return (
    <>
      <M g={hullGeo(2.6, 0.7, 1.15, 'boat')} c={hull} />
      <M g={box(1.9, 0.1, 1.17)} c={PAL.white} p={[-0.3, 0.2, 0]} />
      <M g={box(1.7, 0.08, 0.85)} c={PAL.wood} p={[-0.25, 0.3, 0]} />
      <group position={[0.1, 0.25, 0]} rotation={damaged ? [0.3, 0, 0.22] : Z}>
        <M g={cyl(0.06, 0.07, 2.4, 6)} c={PAL.woodDark} p={[0, 1.2, 0]} />
        <M g={sailGeo()} c={PAL.sail} p={[-0.06, 0.23, -0.02]} s={damaged ? [0.75, 0.5, 1] : 1} />
      </group>
    </>
  );
}

// ───── Баркас ─────
const B2_MAST: V3 = [0.4, 0.42, 0];

function Boat2({ hull, roof, damaged }: { hull: number; roof: number; damaged: boolean }) {
  return (
    <>
      <M g={hullGeo(2.85, 0.78, 1.28, 'boat2')} c={hull} />
      <M g={box(2.0, 0.1, 1.3)} c={PAL.white} p={[-0.35, 0.24, 0]} />
      <M g={box(2.05, 0.06, 1.02)} c={PAL.wood} p={[-0.38, 0.41, 0]} />
      {/* рубка на корме */}
      <M g={box(0.78, 0.6, 0.86)} c={PAL.wall} p={[-0.8, 0.74, 0]} />
      <M g={box(0.92, 0.07, 1.0)} c={roof} p={[-0.8, 1.075, 0]} />
      <Win p={[-0.38, 0.82, 0]} r={[0, Math.PI / 2, 0]} w={0.56} h={0.22} />
      <Win p={[-0.66, 0.82, 0.44]} w={0.26} h={0.2} />
      <Win p={[-0.66, 0.82, -0.44]} w={0.26} h={0.2} />
      <M g={torus(0.12, 0.045, 5, 10)} c={PAL.roofCoral} p={[-1.0, 0.74, 0.45]} />
      {/* мачта, гафельный парус с гиком, кливер; у повреждённой мачта завалилась, кливер сорван */}
      <group position={B2_MAST} rotation={damaged ? [0.3, 0, 0.22] : Z}>
        <M g={cyl(0.06, 0.075, 2.95, 6)} c={PAL.woodDark} p={[0, 1.475, 0]} />
        <M g={sailGeo()} c={PAL.sail} p={[-0.06, 0.78, -0.02]} s={damaged ? [0.8, 0.55, 1] : [1.15, 1.08, 1]} />
        <Beam a={[-0.02, 0.8, 0]} b={[-1.5, 0.9, 0]} t={0.06} c={PAL.woodDark} />
        <M g={box(0.34, 0.12, 0.02)} c={PAL.roofCoral} p={[0.19, 2.86, 0]} />
        {!damaged && (
          <>
            <M g={jibGeo()} c={PAL.sail} />
            <Beam a={[0, 2.9, 0]} b={[1.0, 0.2, 0]} t={0.025} c={PAL.woodDark} />
          </>
        )}
      </group>
    </>
  );
}

// ───── Траулер ─────
const T3_FUNNEL_TOP: V3 = [-0.55, 1.3, 0];

function Boat3({ hull, roof, damaged }: { hull: number; roof: number; damaged: boolean }) {
  return (
    <>
      <M g={hullGeo(3.1, 0.9, 1.42, 'boat3')} c={hull} />
      <M g={box(2.25, 0.11, 1.44)} c={PAL.white} p={[-0.4, 0.27, 0]} />
      <M g={box(2.2, 0.06, 1.14)} c={PAL.wood} p={[-0.42, 0.47, 0]} />
      {/* кранцы-буи по бортам */}
      {[-0.95, 0.25].flatMap((x, i) => [-1, 1].map((side) => (
        <M key={`${x}${side}`} g={sphere(0.12, 8, 6)} c={i ? PAL.roofGold : PAL.roofCoral} p={[x, 0.2, side * 0.74]} s={[1, 1.25, 1]} />
      )))}
      {/* рубка: нижний ярус с иллюминаторами, мостик с горящими окнами */}
      <M g={box(1.0, 0.55, 1.0)} c={PAL.wall} p={[0.15, 0.775, 0]} />
      {[-0.12, 0.38].flatMap((x) => [-1, 1].map((side) => (
        <Win key={`${x}${side}`} p={[x, 0.8, side * 0.5]} w={0.17} h={0.17} lit />
      )))}
      <M g={box(0.8, 0.45, 0.92)} c={PAL.wall} p={[0.2, 1.275, 0]} />
      <Win p={[0.6, 1.3, 0]} r={[0, Math.PI / 2, 0]} w={0.72} h={0.22} lit />
      <Win p={[0.22, 1.3, 0.46]} w={0.52} h={0.18} lit />
      <Win p={[0.22, 1.3, -0.46]} w={0.52} h={0.18} lit />
      <M g={box(0.98, 0.07, 1.06)} c={roof} p={[0.2, 1.535, 0]} />
      {/* радар и огонь на крыше мостика */}
      <M g={cyl(0.035, 0.035, 0.5, 5)} c={PAL.night} p={[0.32, 1.82, 0]} />
      <M g={box(0.07, 0.05, 0.46)} c={PAL.night} p={[0.32, 2.08, 0]} />
      {/* труба */}
      <M g={cyl(0.13, 0.16, 0.78, 8)} c={roof} p={[T3_FUNNEL_TOP[0], 0.89, 0]} />
      <M g={cyl(0.137, 0.137, 0.12, 8)} c={PAL.night} p={[T3_FUNNEL_TOP[0], 1.22, 0]} />
      {/* мачта на баке с реей и топовым огнём */}
      <group position={[0.98, 0.6, 0]} rotation={damaged ? [0.32, 0, 0.2] : Z}>
        <M g={cyl(0.05, 0.065, 2.75, 6)} c={PAL.woodDark} p={[0, 1.375, 0]} />
        <M g={box(0.06, 0.06, 0.9)} c={PAL.woodDark} p={[0, 2.2, 0]} />
        <M g={ico(0.07)} c={PAL.window} o={LIT_OPTS} p={[0, 2.8, 0]} shadow={false} />
        <M g={box(0.32, 0.12, 0.02)} c={PAL.roofCoral} p={[-0.17, 2.62, 0]} />
        {!damaged && <Beam a={[0, 2.7, 0]} b={[0.5, 0.06, 0]} t={0.025} c={PAL.woodDark} />}
      </group>
      {/* рабочая палуба: барабан с сетью, буи */}
      <group position={[-1.0, 0.74, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <M g={cyl(0.2, 0.2, 0.74, 10)} c={PAL.leafDark} />
        <M g={cyl(0.27, 0.27, 0.05, 10)} c={PAL.woodDark} p={[0, 0.39, 0]} />
        <M g={cyl(0.27, 0.27, 0.05, 10)} c={PAL.woodDark} p={[0, -0.39, 0]} />
      </group>
      {/* П-рама на корме с сетью на тросе */}
      {[-1, 1].map((side) => (
        <Beam key={side} a={[-1.3, 0.48, side * 0.6]} b={[-1.4, 1.86, side * 0.52]} t={0.09} c={PAL.roofGold} />
      ))}
      <Beam a={[-1.4, 1.86, -0.58]} b={[-1.4, 1.86, 0.58]} t={0.1} c={PAL.roofGold} />
      <Beam a={[-1.4, 1.84, 0]} b={[-1.42, 1.35, 0]} t={0.025} c={PAL.night} />
      <M g={ico(0.24)} c={PAL.leafDark} p={[-1.42, 1.14, 0]} s={damaged ? [1.2, 0.7, 1.1] : [1, 1.3, 0.9]} />
      <M g={ico(0.075)} c={PAL.roofCoral} p={[-1.35, 1.22, 0.2]} />
      <M g={ico(0.075)} c={PAL.roofGold} p={[-1.52, 1.0, -0.16]} />
    </>
  );
}

export function Boat({ damaged, variant, level }: ModelProps) {
  const bus = useBus();
  const ref = useRef<Group>(null!);
  const blend = useDamageBlend(damaged);
  const phase = variant * 1.7 + 0.4;
  const li = Math.min(3, Math.max(1, level)) - 1;
  const v = variant % HULLS.length;

  useFrame((state, dt) => {
    const t = state.clock.elapsedTime;
    const amp = (1 + 1.6 * bus.weather.k) * SWAY[li];
    const d = blend(dt);
    const g = ref.current;
    g.position.y = BASE_Y[li] - 0.34 * d + Math.sin(t * 1.3 + phase) * 0.08 * amp;
    g.rotation.x = Math.sin(t * 1.1 + phase) * 0.06 * amp + 0.38 * d;
    g.rotation.z = Math.cos(t * 0.9 + phase) * 0.03 * amp - 0.12 * d;
  });

  return (
    <group ref={ref}>
      <Baked id={`boat:${li + 1}:${v}:${+damaged}`}>
        {li === 0 && <Boat1 hull={HULLS[v]} damaged={damaged} />}
        {li === 1 && <Boat2 hull={HULLS[v]} roof={CABIN_ROOFS[v]} damaged={damaged} />}
        {li === 2 && <Boat3 hull={HULLS[v]} roof={CABIN_ROOFS[v]} damaged={damaged} />}
      </Baked>
      {li === 2 && (damaged
        ? <Smoke origin={T3_FUNNEL_TOP} color={DARK_SMOKE} count={4} size={0.2} speed={0.2} rise={1.8} drift={0.6} />
        : <Smoke origin={T3_FUNNEL_TOP} count={5} size={0.2} speed={0.26} rise={1.9} drift={0.7} />)}
    </group>
  );
}
