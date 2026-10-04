// Шхуна мечты. Корпус — лофт по станциям (полосы обшивки одного цвета на полосу), поэтому нос острый,
// а палуба поднимается к баку; шпангоуты и такелаж собираются из брусков. Всё неподвижное «запекается»
// (Baked), качка корпуса, ход парусов и вымпел остаются снаружи.
import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { BufferGeometry, Euler, Float32BufferAttribute, type Group, Quaternion, Vector3 } from 'three';
import { PAL } from '../palette';
import { WINDOW_OPTS, box, cached, cone, cyl, shade } from '../materials';
import { useBus } from '../bus';
import { M, type V3 } from './parts';
import { Baked } from './Baked';

// ───── Обводы корпуса: s — вдоль судна (0 корма … 1 нос), u — по высоте борта (0 киль … 1 палуба) ─────
export const SCH_LEN = 6.6;
const HALF = SCH_LEN / 2;
const BEAM = 0.95;     // полуширина по палубе
const BW = 0.17;       // высота фальшборта
const BT = 0.07;       // его толщина

const sm = (x: number) => { const k = Math.min(1, Math.max(0, x)); return k * k * (3 - 2 * k); };
const deckY = (s: number) => 0.46 + 0.34 * s ** 3 + 0.12 * (1 - s) ** 3;
const keelY = (s: number) => -0.52 + 0.62 * sm((s - 0.6) / 0.4) ** 1.5 + 0.28 * Math.max(0, 1 - s / 0.22) ** 2;
const beamAt = (s: number) =>
  s >= 0.42 ? BEAM * (1 - ((s - 0.42) / 0.58) ** 2.1) + 0.02 : BEAM * (1 - 0.32 * ((0.42 - s) / 0.42) ** 2);
const halfW = (s: number, u: number) => beamAt(s) * (0.3 + 0.7 * Math.min(1, Math.max(0, u)) ** 0.7);
const xAt = (s: number) => -HALF + s * SCH_LEN;
const pt = (s: number, u: number, side: number, lift = 0, inset = 0): V3 => [
  xAt(s),
  keelY(s) + (deckY(s) - keelY(s)) * Math.min(1, u) + lift,
  side * Math.max(0.01, halfW(s, u) - inset),
];
/** Высота палубы над началом координат корпуса в точке x. */
const deckAtX = (x: number) => deckY((x + HALF) / SCH_LEN);
/** Высота днища корпуса над его началом координат в точке x (для упоров на стапеле). */
export const hullBottomAtX = (x: number) => keelY((x + HALF) / SCH_LEN);
/** Полуширина корпуса на уровне u (0..1) в точке x. */
export const hullHalfWidthAtX = (x: number, u: number) => halfW((x + HALF) / SCH_LEN, u);
export const hullHeightAtX = (x: number, u: number) => {
  const s = (x + HALF) / SCH_LEN;
  return keelY(s) + (deckY(s) - keelY(s)) * u;
};

const ST = Array.from({ length: 15 }, (_, i) => i / 14);

// ───── Геометрия из лент ─────
type Out = number[];
function ribbon(out: Out, A: V3[], B: V3[], flip = false) {
  for (let i = 0; i < A.length - 1; i++) {
    const a = A[i], b = A[i + 1], c = B[i + 1], d = B[i];
    if (flip) out.push(...a, ...c, ...b, ...a, ...d, ...c);
    else out.push(...a, ...b, ...c, ...a, ...c, ...d);
  }
}
const quad = (out: Out, a: V3, b: V3, c: V3, d: V3) => out.push(...a, ...b, ...c, ...a, ...c, ...d);
const mesh = (key: string, build: (out: Out) => void) =>
  cached(key, () => {
    const out: Out = [];
    build(out);
    const g = new BufferGeometry();
    g.setAttribute('position', new Float32BufferAttribute(out, 3));
    g.computeVertexNormals();
    return g;
  });

/** Полосы обшивки (снизу вверх). */
const BANDS: [number, number][] = [[0, 0.3], [0.3, 0.56], [0.56, 0.8], [0.8, 1]];
const BAND_COLORS = [PAL.woodDark, PAL.wood, shade(PAL.wood, PAL.sand, 0.28), PAL.roofCoral];
const DECK_COLOR = shade(PAL.wood, PAL.sand, 0.5);
const FRESH = shade(PAL.wood, PAL.sand, 0.35);

const bandGeo = (i: number) =>
  mesh(`schBand${i}`, (out) => {
    const [u0, u1] = BANDS[i];
    for (const side of [1, -1]) ribbon(out, ST.map((s) => pt(s, u0, side)), ST.map((s) => pt(s, u1, side)), side < 0);
    quad(out, pt(0, u0, -1), pt(0, u0, 1), pt(0, u1, 1), pt(0, u1, -1)); // транец
    if (i === 0) ribbon(out, ST.map((s) => pt(s, 0, -1)), ST.map((s) => pt(s, 0, 1))); // днище
  });

const deckGeo = () =>
  mesh('schDeck', (out) => ribbon(out, ST.map((s) => pt(s, 1, -1, 0, BT)), ST.map((s) => pt(s, 1, 1, 0, BT)), true));

const bulwarkGeo = () =>
  mesh('schBulwark', (out) => {
    for (const side of [1, -1]) {
      const lo = ST.map((s) => pt(s, 1, side)), hi = ST.map((s) => pt(s, 1, side, BW));
      const loI = ST.map((s) => pt(s, 1, side, 0, BT)), hiI = ST.map((s) => pt(s, 1, side, BW, BT));
      ribbon(out, lo, hi, side < 0);   // снаружи
      ribbon(out, loI, hiI, side > 0); // изнутри
      ribbon(out, hi, hiI, side < 0);  // верхний срез
    }
    // кормовой фальшборт
    const sh = (p: V3): V3 => [p[0] + BT, p[1], p[2]];
    const a = pt(0, 1, -1), b = pt(0, 1, 1), c = pt(0, 1, 1, BW), d = pt(0, 1, -1, BW);
    quad(out, a, b, c, d);
    quad(out, sh(a), sh(d), sh(c), sh(b));
    quad(out, d, c, sh(c), sh(d));
  });

// ───── Бруски ─────
const UNIT = box(1, 1, 1);
const X = new Vector3(1, 0, 0);
const qa = new Quaternion(), ea = new Euler(), va = new Vector3();

/** Брусок между двумя точками (сечение t×t). */
export function Beam({ a, b, t = 0.1, c }: { a: V3; b: V3; t?: number; c: number }) {
  va.set(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
  const len = va.length();
  ea.setFromQuaternion(qa.setFromUnitVectors(X, va.divideScalar(len || 1)));
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

// ───── Стадия 1: киль и шпангоуты ─────
const RIBS = [0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9];
const RIB_U = [0, 0.34, 0.67, 1];

export function SchoonerFrame() {
  const keel = Array.from({ length: 10 }, (_, i) => i / 10);
  return (
    <Baked id="dream:1:frame">
      {keel.map((s, i) => (
        <Beam key={`k${i}`} a={pt(s, 0, 0, -0.04)} b={pt(s + 0.1, 0, 0, -0.04)} t={0.24} c={PAL.woodDark} />
      ))}
      <Beam a={[HALF, keelY(1) - 0.04, 0]} b={[HALF + 0.14, deckY(1) + 0.1, 0]} t={0.2} c={PAL.woodDark} />
      <Beam a={[-HALF, keelY(0) - 0.04, 0]} b={[-HALF - 0.06, deckY(0) + 0.08, 0]} t={0.2} c={PAL.woodDark} />
      {RIBS.map((s) => (
        <group key={`r${s}`}>
          <Beam a={pt(s, 0, -1)} b={pt(s, 0, 1)} t={0.14} c={FRESH} />
          {[1, -1].flatMap((side) =>
            RIB_U.slice(0, -1).map((u, j) => (
              <Beam key={`${side}${j}`} a={pt(s, u, side)} b={pt(s, RIB_U[j + 1], side)} t={0.14} c={FRESH} />
            )),
          )}
        </group>
      ))}
      {/* продольные связи по бортам */}
      {[0.34, 0.67, 1].flatMap((u) =>
        [1, -1].flatMap((side) =>
          RIBS.slice(0, -1).map((s, j) => (
            <Beam key={`${u}${side}${j}`} a={pt(s, u, side)} b={pt(RIBS[j + 1], u, side)} t={0.11} c={PAL.wood} />
          )),
        ),
      )}
    </Baked>
  );
}

// ───── Стадия 2: обшитый корпус с палубой, фальшбортом и рубкой ─────
export function SchoonerHull() {
  const cabinX = -2.15;
  const cabinY = deckAtX(cabinX);
  return (
    <Baked id="dream:hull">
      {BANDS.map((_, i) => <M key={i} g={bandGeo(i)} c={BAND_COLORS[i]} />)}
      <M g={deckGeo()} c={DECK_COLOR} />
      <M g={bulwarkGeo()} c={PAL.woodDark} />
      {/* форштевень и ахтерштевень */}
      <Beam a={[HALF - 0.02, keelY(1) - 0.02, 0]} b={[HALF + 0.14, deckY(1) + BW + 0.06, 0]} t={0.14} c={PAL.woodDark} />
      <Beam a={[-HALF + 0.02, keelY(0) - 0.02, 0]} b={[-HALF - 0.04, deckY(0) + 0.1, 0]} t={0.12} c={PAL.woodDark} />
      {/* рубка с окошками */}
      <M g={box(1.3, 0.5, 0.95)} c={PAL.wall} p={[cabinX, cabinY + 0.25, 0]} />
      <M g={box(1.5, 0.08, 1.1)} c={PAL.woodDark} p={[cabinX, cabinY + 0.54, 0]} />
      {[1, -1].map((side) => (
        <M key={side} g={box(0.7, 0.2, 0.04)} c={PAL.window} o={WINDOW_OPTS} p={[cabinX, cabinY + 0.3, side * 0.49]} shadow={false} />
      ))}
      <M g={box(0.08, 0.26, 0.5)} c={PAL.window} o={WINDOW_OPTS} p={[cabinX + 0.66, cabinY + 0.32, 0]} shadow={false} />
      {/* люк на баке и бочонок у рубки */}
      <M g={box(0.55, 0.16, 0.5)} c={PAL.woodDark} p={[2.0, deckAtX(2.0) + 0.08, 0]} />
      <M g={cyl(0.17, 0.17, 0.3, 8)} c={PAL.wood} p={[-1.0, deckAtX(-1.0) + 0.15, 0.55]} />
    </Baked>
  );
}

// ───── Стадия 3: рангоут, паруса, вымпел ─────
const MAIN = { x: -0.95, h: 5.0, boom: 2.5, head: 3.7 };
const FORE = { x: 1.1, h: 4.35, boom: 1.75, head: 3.2 };
const SPRIT_TIP: V3 = [4.45, 1.12, 0];

/**
 * Парус по четырём углам (шкотовый, нижний передний, верхний передний, верхний задний/задний) — сетка 4×4
 * с лёгким «пузом» по z, видна с обеих сторон. u: от передней шкаторины назад, v: от нижней кромки вверх.
 */
type Q = [number, number];
const sailMesh = (key: string, q: [Q, Q, Q, Q], belly = 0.3) =>
  cached(key, () => {
    const N = 4;
    const P = (u: number, v: number): V3 => {
      const ax = q[0][0] + (q[3][0] - q[0][0]) * u, ay = q[0][1] + (q[3][1] - q[0][1]) * u;
      const bx = q[1][0] + (q[2][0] - q[1][0]) * u, by = q[1][1] + (q[2][1] - q[1][1]) * u;
      return [ax + (bx - ax) * v, ay + (by - ay) * v, belly * 4 * u * (1 - u) * Math.sin(Math.PI * (0.15 + 0.7 * v))];
    };
    const out: Out = [];
    for (let i = 0; i < N; i++) {
      for (let j = 0; j < N; j++) {
        const a = P(i / N, j / N), b = P((i + 1) / N, j / N), c = P((i + 1) / N, (j + 1) / N), d = P(i / N, (j + 1) / N);
        out.push(...a, ...b, ...c, ...a, ...c, ...d, ...a, ...c, ...b, ...a, ...d, ...c);
      }
    }
    const g = new BufferGeometry();
    g.setAttribute('position', new Float32BufferAttribute(out, 3));
    g.computeVertexNormals();
    return g;
  });

const gaffPeak = (m: typeof MAIN): V3 => [-m.boom * 0.55, m.head + 0.7, 0];
const gaffSail = (key: string, m: typeof MAIN, rise: number) =>
  sailMesh(key, [[0.05, 0.62], [0.05, m.head], [-m.boom * 0.55, m.head + rise], [-m.boom, 0.68]]);
const mainSail = () => gaffSail('schMainSail', MAIN, 0.7);
const foreSail = () => gaffSail('schForeSail', FORE, 0.65);
const jibShape = () => {
  const dy = deckAtX(FORE.x);
  const head: Q = [FORE.x + 0.1, dy + FORE.h - 0.55];
  return sailMesh('schJib', [[SPRIT_TIP[0] - 0.12, SPRIT_TIP[1] - 0.08], head, head, [FORE.x + 0.55, dy + 0.85]], 0.22);
};
const flagShape = () => sailMesh('schFlag', [[0, -0.17], [0, 0.17], [-0.95, 0], [-0.95, 0]], 0);

function Rig() {
  const dm = deckAtX(MAIN.x), df = deckAtX(FORE.x);
  const topM: V3 = [MAIN.x, dm + MAIN.h, 0], topF: V3 = [FORE.x, df + FORE.h, 0];
  return (
    <Baked id="dream:3:rig">
      <M g={cyl(0.045, 0.08, MAIN.h, 6)} c={PAL.woodDark} p={[MAIN.x, dm + MAIN.h / 2, 0]} />
      <M g={cyl(0.045, 0.08, FORE.h, 6)} c={PAL.woodDark} p={[FORE.x, df + FORE.h / 2, 0]} />
      <M g={cone(0.1, 0.22, 6)} c={PAL.gold} p={[FORE.x, df + FORE.h + 0.1, 0]} />
      <M g={cyl(0.02, 0.025, 0.5, 5)} c={PAL.woodDark} p={[MAIN.x, dm + MAIN.h + 0.25, 0]} />
      {/* бушприт и стаксели */}
      <Beam a={[xAt(0.93), deckY(0.93) - 0.05, 0]} b={SPRIT_TIP} t={0.1} c={PAL.woodDark} />
      <M g={jibShape()} c={PAL.white} />
      {/* снасти */}
      <Beam a={topF} b={SPRIT_TIP} t={0.03} c={PAL.woodDark} />
      <Beam a={topM} b={[-HALF + 0.12, deckAtX(-HALF + 0.12) + BW, 0]} t={0.03} c={PAL.woodDark} />
      <Beam a={topM} b={[FORE.x, df + FORE.h * 0.86, 0]} t={0.025} c={PAL.woodDark} />
    </Baked>
  );
}

/** Гафельный парус с гиком и гафелем; начало координат — на палубе у мачты. */
function GaffSail({ spec, shape, id }: { spec: typeof MAIN; shape: () => BufferGeometry; id: string }) {
  return (
    <Baked id={id}>
      <M g={cyl(0.04, 0.04, spec.boom + 0.05, 5)} c={PAL.woodDark} p={[-spec.boom / 2, 0.58, 0]} r={[0, 0, Math.PI / 2]} />
      <Beam a={[0, spec.head, 0]} b={gaffPeak(spec)} t={0.06} c={PAL.woodDark} />
      <M g={shape()} c={PAL.white} />
    </Baked>
  );
}

/** Достроенная шхуна на плаву: качается, паруса и вымпел живут. Начало координат — на ватерлинии по центру. */
export function FloatingSchooner({ phase = 0.7 }: { phase?: number }) {
  const bus = useBus();
  const bob = useRef<Group>(null!);
  const main = useRef<Group>(null!);
  const fore = useRef<Group>(null!);
  const flag = useRef<Group>(null!);
  const dm = deckAtX(MAIN.x), df = deckAtX(FORE.x);

  useFrame((state) => {
    const t = state.clock.elapsedTime;
    const k = bus.weather.k;
    const amp = 1 + 1.4 * k;
    const g = bob.current;
    g.position.y = 0.3 + Math.sin(t * 1.0 + phase) * 0.07 * amp;
    g.rotation.x = Math.sin(t * 0.8 + phase) * 0.04 * amp - 0.06; // небольшой крен под ветром (мачты от камеры)
    g.rotation.z = Math.cos(t * 0.7 + phase) * 0.025 * amp;
    const sway = 0.05 * (1 + 1.2 * k);
    main.current.rotation.y = Math.sin(t * 0.55 + phase) * sway;
    fore.current.rotation.y = Math.sin(t * 0.6 + phase + 1.1) * sway;
    flag.current.rotation.y = Math.sin(t * 2.4 + phase) * (0.25 + 0.2 * k);
  });

  return (
    <group ref={bob}>
      <SchoonerHull />
      <Rig />
      <group ref={main} position={[MAIN.x, dm, 0]}>
        <GaffSail spec={MAIN} shape={mainSail} id="dream:3:main" />
      </group>
      <group ref={fore} position={[FORE.x, df, 0]}>
        <GaffSail spec={FORE} shape={foreSail} id="dream:3:fore" />
      </group>
      <group ref={flag} position={[MAIN.x, dm + MAIN.h + 0.32, 0]}>
        <M g={flagShape()} c={PAL.roofCoral} shadow={false} />
      </group>
    </group>
  );
}
