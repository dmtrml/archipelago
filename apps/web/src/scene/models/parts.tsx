// Общие детали моделей: меш с кэшированным материалом, дом из концепта, дымок.
import { useContext, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { type BufferGeometry, Euler, ExtrudeGeometry, type InstancedMesh, Object3D, Quaternion, Shape, Vector3 } from 'three';
import { PAL } from '../palette';
import { DamageContext, useBus } from '../bus';
import { WINDOW_OPTS, box, cached, cone, cyl, damagedColor, gableRoof, ico, mat, shade, type MatOpts } from '../materials';

export type V3 = [number, number, number];
/** Нулевой вектор: условные rotation/position всегда задаём явно (R3F не сбрасывает убранные пропсы). */
export const Z: V3 = [0, 0, 0];
export const noRay = () => null;

/** Цвет дыма над повреждённым объектом. */
export const DARK_SMOKE = shade(PAL.night, PAL.rock, 0.35);

interface MProps {
  g: BufferGeometry;
  c: number;
  o?: MatOpts;
  p?: V3;
  r?: V3;
  s?: number | V3;
  shadow?: boolean;
}

/** Меш с материалом из кэша. Внутри повреждённого объекта цвет темнеет, окна гаснут. */
export function M({ g, c, o, p, r, s, shadow = true }: MProps) {
  const dmg = useContext(DamageContext);
  let material;
  if (dmg) {
    const rest = o ? { ...o } : undefined;
    if (rest) { delete rest.emissive; delete rest.emissiveIntensity; }
    material = mat(damagedColor(c), rest && Object.keys(rest).length ? rest : undefined);
  } else material = mat(c, o);
  return <mesh geometry={g} material={material} position={p ?? Z} rotation={r ?? Z} scale={s ?? 1} castShadow={shadow} receiveShadow />;
}

/** Окна, в которых «горит свет» (улучшенные объекты): ярче обычных. */
export const LIT_OPTS: MatOpts = { emissive: PAL.window, emissiveIntensity: 0.85 };

export function Win({ p, r, w = 0.44, h = 0.44, lit = false }: { p: V3; r?: V3; w?: number; h?: number; lit?: boolean }) {
  return <M g={box(w, h, 0.08)} c={PAL.window} o={lit ? LIT_OPTS : WINDOW_OPTS} p={p} r={r} shadow={false} />;
}

// ───── Бруски, гирлянды, флажки ─────
const UNIT = box(1, 1, 1);
const AX = new Vector3(1, 0, 0);
const qa = new Quaternion(), ea = new Euler(), va = new Vector3();

/** Брусок между двумя точками (сечение t×t). */
export function Beam({ a, b, t = 0.1, c }: { a: V3; b: V3; t?: number; c: number }) {
  va.set(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
  const len = va.length();
  ea.setFromQuaternion(qa.setFromUnitVectors(AX, va.divideScalar(len || 1)));
  return (
    <M
      g={UNIT}
      c={c}
      p={[(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2]}
      r={[ea.x, ea.y, ea.z]}
      s={[len || 0.001, t, t]}
    />
  );
}

/** Точка на провисающей нити от a до b (k = 0..1). */
const sagPoint = (a: V3, b: V3, k: number, sag: number): V3 => [
  a[0] + (b[0] - a[0]) * k,
  a[1] + (b[1] - a[1]) * k - sag * 4 * k * (1 - k),
  a[2] + (b[2] - a[2]) * k,
];

/** Гирлянда: тёплые лампочки на провисающей нити (светятся, как окна). */
export function Garland({ a, b, n = 7, sag = 0.22 }: { a: V3; b: V3; n?: number; sag?: number }) {
  return (
    <>
      {Array.from({ length: n }, (_, i) => (
        <M key={i} g={ico(0.065)} c={PAL.window} o={LIT_OPTS} p={sagPoint(a, b, (i + 0.5) / n, sag)} shadow={false} />
      ))}
    </>
  );
}

const pennantGeo = () =>
  cached('pennant', () => {
    const s = new Shape();
    s.moveTo(-0.1, 0); s.lineTo(0.1, 0); s.lineTo(0, -0.24); s.closePath();
    return new ExtrudeGeometry(s, { depth: 0.02, bevelEnabled: false }).translate(0, 0, -0.01);
  });
const PENNANTS = [PAL.roofCoral, PAL.roofGold, PAL.white, PAL.roofTeal];

/** Флажки-треугольники на провисающей верёвке от a до b. */
export function Bunting({ a, b, n = 6, sag = 0.18 }: { a: V3; b: V3; n?: number; sag?: number }) {
  const rotY = -Math.atan2(b[2] - a[2], b[0] - a[0]);
  return (
    <>
      {Array.from({ length: n }, (_, i) => (
        <M key={i} g={pennantGeo()} c={PENNANTS[i % PENNANTS.length]} p={sagPoint(a, b, (i + 0.5) / n, sag)} r={[0, rotY, 0]} shadow={false} />
      ))}
    </>
  );
}

/** Пляжный зонтик (основание на песке/настиле). r — радиус купола; tilt — упавший зонтик. */
export function Umbrella({ p, color, r = 1.0, h = 1.8, tilt }: { p: V3; color: number; r?: number; h?: number; tilt?: V3 }) {
  return (
    <group position={p} rotation={tilt ?? Z}>
      <M g={cyl(0.04, 0.04, h, 6)} c={PAL.white} p={[0, h / 2, 0]} />
      <M g={cone(r, r * 0.45, 8)} c={color} p={[0, h + 0.05, 0]} />
    </group>
  );
}

/** Шезлонг: лежак со спинкой. */
export function Lounger({ p, rotY = 0 }: { p: V3; rotY?: number }) {
  return (
    <group position={p} rotation={[0, rotY, 0]}>
      <M g={box(1.0, 0.12, 0.48)} c={PAL.white} p={[0.1, 0.2, 0]} />
      <M g={box(0.42, 0.1, 0.48)} c={PAL.white} p={[-0.52, 0.33, 0]} r={[0, 0, -0.55]} />
      <M g={box(0.08, 0.16, 0.42)} c={PAL.woodDark} p={[0.5, 0.08, 0]} />
      <M g={box(0.08, 0.16, 0.42)} c={PAL.woodDark} p={[-0.3, 0.08, 0]} />
    </group>
  );
}

/** Ящик с рейками (на пирсе, у цеха). */
export function Crate({ p, s = 0.5, rotY = 0, c = PAL.wood }: { p: V3; s?: number; rotY?: number; c?: number }) {
  return (
    <group position={p} rotation={[0, rotY, 0]}>
      <M g={box(s, s * 0.84, s)} c={c} p={[0, s * 0.42, 0]} />
      <M g={box(s + 0.02, s * 0.1, s + 0.02)} c={PAL.woodDark} p={[0, s * 0.72, 0]} />
      <M g={box(s + 0.02, s * 0.1, s + 0.02)} c={PAL.woodDark} p={[0, s * 0.14, 0]} />
    </group>
  );
}

export interface HouseProps {
  w?: number; d?: number; h?: number;
  wall?: number; roof?: number; roofH?: number;
  chimney?: boolean;
  /** перекошенная крыша — для повреждённых домов */
  crooked?: boolean;
}

/** Дом из концепта: цоколь, стены, крыша-призма, дверь, два окна, труба. */
export function House({ w = 2.4, d = 2.0, h = 1.6, wall = PAL.wall, roof = PAL.roofCoral, roofH = 1.1, chimney = true, crooked = false }: HouseProps) {
  return (
    <group>
      <M g={box(w + 0.3, 0.26, d + 0.3)} c={PAL.rock} p={[0, 0.13, 0]} />
      <M g={box(w, h, d)} c={wall} p={[0, 0.26 + h / 2, 0]} />
      <M
        g={gableRoof(w, d, roofH)}
        c={roof}
        p={crooked ? [0.1, 0.26 + h + 0.05, 0] : [0, 0.26 + h, 0]}
        r={crooked ? [0.06, 0, -0.14] : Z}
      />
      <M g={box(0.52, 0.9, 0.08)} c={PAL.woodDark} p={[-w * 0.2, 0.71, d / 2 + 0.03]} />
      <Win p={[w * 0.22, 0.26 + h * 0.58, d / 2 + 0.03]} />
      <Win p={[w / 2 + 0.03, 0.26 + h * 0.58, 0]} r={[0, Math.PI / 2, 0]} />
      {chimney && <M g={box(0.34, 0.9, 0.34)} c={PAL.rock} p={[w * 0.24, 0.26 + h + roofH * 0.55, -d * 0.18]} />}
    </group>
  );
}
export const chimneyTop = (w: number, d: number, h: number, roofH: number): V3 => [w * 0.24, 0.26 + h + roofH * 0.55 + 0.5, -d * 0.18];

interface SmokeProps {
  origin: V3;
  count?: number;
  color?: number;
  size?: number;
  rise?: number;
  drift?: number;
  speed?: number;
}

/** Дымок из трубы: клубы поднимаются, растут и тают (один InstancedMesh). */
export function Smoke({ origin, count = 7, color = PAL.puff, size = 0.32, rise = 3.2, drift = 0.9, speed = 0.32 }: SmokeProps) {
  const ref = useRef<InstancedMesh>(null!);
  const bus = useBus();
  const tmp = useMemo(() => new Object3D(), []);
  useFrame((state) => {
    const t = state.clock.elapsedTime;
    const wind = 1 + 1.5 * bus.weather.k;
    const m = ref.current;
    for (let i = 0; i < count; i++) {
      const f = (t * speed + i / count) % 1;
      tmp.position.set(origin[0] + f * drift * wind, origin[1] + f * rise, origin[2] + Math.sin(f * 6 + i) * 0.2);
      tmp.scale.setScalar(Math.max(0.001, Math.sin(f * Math.PI) * (0.5 + f)));
      tmp.updateMatrix();
      m.setMatrixAt(i, tmp.matrix);
    }
    m.instanceMatrix.needsUpdate = true;
  });
  return (
    <instancedMesh
      key={`${color}-${count}`}
      ref={ref}
      args={[ico(size), mat(color, { roughness: 1 }), count]}
      frustumCulled={false}
      raycast={noRay}
    />
  );
}

/** Плавное «оседание» при повреждении: 0 → 1 за ~0.5 с. */
export function useDamageBlend(damaged: boolean) {
  const v = useRef(damaged ? 1 : 0);
  return (dt: number) => {
    v.current += ((damaged ? 1 : 0) - v.current) * Math.min(1, dt * 2.5);
    return v.current;
  };
}
