// Бунгало для туристов (порт): домик на сваях, зонтик и шезлонг на песке.
//   2 — терраса вдвое больше (с перилами и лесенкой), гамак между столбами, второй шезлонг;
//   3 — «Пляжный клуб»: две хижины на общем настиле, между ними бар-хижина с табуретами,
//       перила, два зонтика со столиками на террасе, зонтик с шезлонгами на песке.
import { BoxGeometry } from 'three';
import { PAL } from '../palette';
import { box, cached, cone, cyl } from '../materials';
import { Beam, DARK_SMOKE, House, Lounger, M, Smoke, Umbrella, Z, type V3 } from './parts';
import type { ModelProps } from './types';
import { Baked } from './Baked';

const DECK_Y = 1.0;
const ON_DECK = DECK_Y + 0.07;

/** Полотно гамака: провисающая полоса вдоль x длиной len. */
const hammockGeo = (len: number, sag: number) =>
  cached(`hammock${len},${sag}`, () => {
    const g = new BoxGeometry(len, 0.04, 0.5, 10, 1, 1);
    const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const k = (2 * p.getX(i)) / len;
      p.setY(i, p.getY(i) - sag * (1 - k * k));
      // края полотна стянуты к верёвкам
      p.setZ(i, p.getZ(i) * (0.35 + 0.65 * (1 - k * k)));
    }
    g.computeVertexNormals();
    return g;
  });

/** Гамак между двумя столбами вдоль оси z (центр p). */
function Hammock({ p, len = 1.5, damaged }: { p: V3; len?: number; damaged: boolean }) {
  const hz = len / 2 + 0.18;
  return (
    <group position={p}>
      {[-hz, hz].map((z) => (
        <M key={z} g={cyl(0.07, 0.08, 1.4, 6)} c={PAL.woodDark} p={[0, 0.7, z]} r={z > 0 && damaged ? [0.45, 0, 0] : Z} />
      ))}
      {damaged ? (
        <M g={box(0.5, 0.04, len * 0.8)} c={PAL.roofTeal} p={[0, 0.03, 0.1]} r={[0, 0.3, 0]} />
      ) : (
        <>
          <Beam a={[0, 1.22, -hz]} b={[0, 1.02, -len / 2]} t={0.025} c={PAL.woodDark} />
          <Beam a={[0, 1.22, hz]} b={[0, 1.02, len / 2]} t={0.025} c={PAL.woodDark} />
          <M g={hammockGeo(len, 0.34)} c={PAL.roofTeal} p={[0, 1.02, 0]} r={[0, Math.PI / 2, 0]} />
          <M g={box(0.02, 0.05, len * 0.62)} c={PAL.white} p={[0.13, 0.73, 0]} />
          <M g={box(0.02, 0.05, len * 0.62)} c={PAL.white} p={[-0.13, 0.73, 0]} />
        </>
      )}
    </group>
  );
}

/** Перила вдоль x на краю настила (z), от x0 до x1. */
function RailX({ x0, x1, z, y = ON_DECK }: { x0: number; x1: number; z: number; y?: number }) {
  const n = Math.max(2, Math.round((x1 - x0) / 0.45) + 1);
  return (
    <>
      {Array.from({ length: n }, (_, i) => (
        <M key={i} g={box(0.06, 0.42, 0.06)} c={PAL.white} p={[x0 + ((x1 - x0) * i) / (n - 1), y + 0.21, z]} />
      ))}
      <M g={box(x1 - x0 + 0.06, 0.06, 0.07)} c={PAL.white} p={[(x0 + x1) / 2, y + 0.42, z]} />
    </>
  );
}

/** Лесенка с настила на песок вдоль +x, начиная с x0 (по центру z). */
function Steps({ x0, z }: { x0: number; z: number }) {
  return (
    <>
      {[0, 1, 2].map((i) => (
        <M key={i} g={box(0.32, 0.1, 0.72)} c={PAL.wood} p={[x0 + 0.17 + i * 0.3, DECK_Y - 0.24 - i * 0.25, z]} />
      ))}
      {[-1, 1].map((s) => (
        <Beam key={s} a={[x0, DECK_Y, z + s * 0.38]} b={[x0 + 0.95, 0.02, z + s * 0.38]} t={0.06} c={PAL.woodDark} />
      ))}
    </>
  );
}

const Stilt = ({ x, z, h = DECK_Y }: { x: number; z: number; h?: number }) => (
  <M g={cyl(0.09, 0.09, h, 6)} c={PAL.woodDark} p={[x, h / 2, z]} />
);

function Level1({ damaged }: { damaged: boolean }) {
  return (
    <>
      {[-1, 1].flatMap((x) => [-0.8, 0.8].map((z) => <Stilt key={`${x}${z}`} x={x} z={z} />))}
      {/* настил с домиком; повреждённый — перекошен на сломанной свае */}
      <group rotation={damaged ? [0.05, 0, 0.08] : Z}>
        <M g={box(2.8, 0.14, 2.4)} c={PAL.wood} p={[0, DECK_Y, 0]} />
        <group position={[-0.2, ON_DECK, -0.2]}>
          <House w={2.0} d={1.6} h={1.25} roof={PAL.roofGold} roofH={1.1} chimney={false} crooked={damaged} />
        </group>
      </group>
      {/* зонтик: у повреждённого лежит на песке */}
      <group position={[2.2, 0, 0.65]} rotation={damaged ? [0.15, 0, -0.55] : Z}>
        <M g={cyl(0.04, 0.04, 1.8, 6)} c={PAL.white} p={[0, 0.9, 0]} />
        <M g={cone(1.0, 0.45, 8)} c={PAL.roofCoral} p={[0, 1.85, 0]} />
      </group>
      <M g={box(1.2, 0.16, 0.5)} c={PAL.white} p={[2.05, 0.2, -0.25]} r={[0, 0.4, 0]} />
    </>
  );
}

// ───── Уровень 2: большая терраса, гамак, два шезлонга ─────
function Level2({ damaged }: { damaged: boolean }) {
  return (
    <>
      {[-1, 1].flatMap((x) => [-0.8, 0.8, 1.85].map((z) => <Stilt key={`${x}${z}`} x={x} z={z} />))}
      <group rotation={damaged ? [0.05, 0, 0.08] : Z}>
        <M g={box(2.8, 0.14, 3.3)} c={PAL.wood} p={[0, DECK_Y, 0.45]} />
        <group position={[-0.2, ON_DECK, -0.2]}>
          <House w={2.0} d={1.6} h={1.25} roof={PAL.roofGold} roofH={1.1} chimney={false} crooked={damaged} />
        </group>
        <RailX x0={-1.35} x1={1.35} z={2.05} />
        <group rotation={[0, Math.PI / 2, 0]}>
          <RailX x0={-2.05} x1={0.75} z={-1.35} />
        </group>
      </group>
      <Steps x0={1.4} z={1.55} />
      <Hammock p={[-2.15, 0, 0.35]} damaged={damaged} />
      <Umbrella p={[2.2, 0, 0.05]} color={PAL.roofCoral} tilt={damaged ? [0.15, 0, -0.55] : undefined} />
      <Lounger p={[2.2, 0, 0.5]} rotY={0.3} />
      <Lounger p={[2.25, 0, -0.55]} rotY={0.3} />
    </>
  );
}

// ───── Уровень 3: пляжный клуб ─────
const CLUB_X0 = -2.6, CLUB_X1 = 1.6, CLUB_Z0 = -1.25, CLUB_Z1 = 1.35;
const HUT = { w: 1.4, d: 1.3, h: 1.1, roofH: 0.95 };
const HUT_Z = -0.45;
const BAR_X = -0.5;
const BOTTLES = [PAL.roofTeal, PAL.roofCoral, PAL.roofGold, PAL.leafDark];

function BarHut({ damaged }: { damaged: boolean }) {
  return (
    <group position={[BAR_X, ON_DECK, 0]}>
      {[-0.33, 0.33].flatMap((x) => [-0.95, 0.3].map((z) => (
        <M key={`${x}${z}`} g={cyl(0.04, 0.04, 1.3, 5)} c={PAL.woodDark} p={[x, 0.65, z]} />
      )))}
      <M
        g={cone(0.78, 0.55, 4)}
        c={PAL.roofTeal}
        p={[damaged ? 0.08 : 0, 1.55, -0.32]}
        r={damaged ? [0.1, Math.PI / 4, -0.2] : [0, Math.PI / 4, 0]}
        s={[1, 1, 1.25]}
      />
      {/* стойка, полка с бутылками, табуреты */}
      <M g={box(0.7, 0.55, 0.28)} c={PAL.wood} p={[0, 0.275, 0.22]} />
      <M g={box(0.76, 0.06, 0.36)} c={PAL.woodDark} p={[0, 0.58, 0.22]} />
      <M g={box(0.62, 0.06, 0.18)} c={PAL.woodDark} p={[0, 0.72, -0.82]} />
      {BOTTLES.map((c, i) => (
        <M key={i} g={cyl(0.04, 0.045, 0.2, 5)} c={c} p={[-0.21 + i * 0.14, 0.85, -0.82]} />
      ))}
      {[-0.2, 0.2].map((x) => (
        <group key={x} position={[x, 0, 0.62]}>
          <M g={cyl(0.03, 0.03, 0.4, 5)} c={PAL.woodDark} p={[0, 0.2, 0]} />
          <M g={cyl(0.12, 0.12, 0.06, 8)} c={PAL.roofCoral} p={[0, 0.42, 0]} />
        </group>
      ))}
    </group>
  );
}

function Level3({ damaged }: { damaged: boolean }) {
  const cx = (CLUB_X0 + CLUB_X1) / 2, cz = (CLUB_Z0 + CLUB_Z1) / 2;
  return (
    <>
      {[-2.4, -0.5, 1.4].flatMap((x) => [-1.05, 1.15].map((z) => <Stilt key={`${x}${z}`} x={x} z={z} />))}
      <group rotation={damaged ? [0.04, 0, 0.06] : Z}>
        <M g={box(CLUB_X1 - CLUB_X0, 0.14, CLUB_Z1 - CLUB_Z0)} c={PAL.wood} p={[cx, DECK_Y, cz]} />
        {[-1.75, 0.75].map((x, i) => (
          <group key={x} position={[x, ON_DECK, HUT_Z]}>
            <House {...HUT} roof={PAL.roofGold} chimney={false} crooked={damaged && i === 0} />
          </group>
        ))}
        <BarHut damaged={damaged} />
        <RailX x0={CLUB_X0 + 0.05} x1={CLUB_X1 - 0.05} z={CLUB_Z1 - 0.05} />
        <group rotation={[0, Math.PI / 2, 0]}>
          <RailX x0={-(CLUB_Z1 - 0.05)} x1={0.3} z={CLUB_X0 + 0.05} />
        </group>
        {/* маленький зонтик со столиком на террасе */}
        <Umbrella p={[-1.85, ON_DECK, 0.95]} color={PAL.roofCoral} r={0.48} h={1.05} tilt={damaged ? [0.5, 0, 0.3] : undefined} />
        <M g={cyl(0.26, 0.26, 0.05, 8)} c={PAL.white} p={[-1.85, ON_DECK + 0.5, 0.95]} />
        <Umbrella p={[1.0, ON_DECK, 0.95]} color={PAL.roofGold} r={0.48} h={1.05} tilt={damaged ? [-0.4, 0, 0.5] : undefined} />
        <M g={cyl(0.26, 0.26, 0.05, 8)} c={PAL.white} p={[1.0, ON_DECK + 0.5, 0.95]} />
      </group>
      <Steps x0={CLUB_X1} z={0.95} />
      {/* зонтики с шезлонгами на песке */}
      <Umbrella p={[2.35, 0, -0.45]} color={PAL.roofTeal} r={0.9} tilt={damaged ? [0.15, 0, -0.55] : undefined} />
      <Lounger p={[2.25, 0, 0.15]} rotY={0.25} />
      <Lounger p={[2.3, 0, -1.0]} rotY={0.25} />
    </>
  );
}

const SMOKE_AT: V3[] = [[-0.2, 3.6, -0.2], [-0.2, 3.6, -0.2], [-1.75, 3.3, -0.5]];

export function Bungalow({ damaged, level }: ModelProps) {
  const lv = Math.min(3, Math.max(1, level));
  return (
    <group>
      <Baked id={`bungalow:${lv}:${+damaged}`}>
        {lv === 1 && <Level1 damaged={damaged} />}
        {lv === 2 && <Level2 damaged={damaged} />}
        {lv === 3 && <Level3 damaged={damaged} />}
      </Baked>
      {damaged && <Smoke origin={SMOKE_AT[lv - 1]} color={DARK_SMOKE} count={4} size={0.22} speed={0.2} rise={2} />}
    </group>
  );
}
