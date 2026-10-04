// Пляжное кафе: домик с полосатым навесом, вывеска с чашкой на коньке, столики под зонтиками.
//   2 — «Ресторан у моря»: на крыше открытая терраса с перилами, павильон с вывеской,
//       гирлянды лампочек на столбиках, столик под золотым зонтом наверху;
//   3 — «Ресторан на сваях»: вдобавок настил уходит к воде на высоких сваях — столики, перила, фонари.
import { PAL } from '../palette';
import { box, cone, cyl, gableRoof, ico, torus } from '../materials';
import { DARK_SMOKE, Garland, LIT_OPTS, M, Smoke, Win, Z, type V3 } from './parts';
import type { ModelProps } from './types';
import { Baked } from './Baked';

const BW = 2.8, BD = 1.5, BH = 1.5; // корпус
const BZ = -0.75;                    // корпус сдвинут назад, впереди — терраса
const FLOOR = 0.16;
const STRIPES = 7;
const FRONT = BZ + BD / 2;           // фасад корпуса (z = 0)

function Table({ x, y = FLOOR, z, color }: { x: number; y?: number; z: number; color?: number }) {
  return (
    <group position={[x, y, z]}>
      <M g={cyl(0.04, 0.05, 0.55, 6)} c={PAL.woodDark} p={[0, 0.27, 0]} />
      <M g={cyl(0.34, 0.34, 0.06, 10)} c={PAL.white} p={[0, 0.57, 0]} />
      <M g={cyl(0.13, 0.13, 0.32, 8)} c={PAL.woodDark} p={[-0.52, 0.16, 0.1]} />
      <M g={cyl(0.13, 0.13, 0.32, 8)} c={PAL.woodDark} p={[0.52, 0.16, -0.05]} />
      {color !== undefined ? (
        <>
          <M g={cyl(0.03, 0.03, 1.55, 6)} c={PAL.white} p={[0, 0.78, 0]} />
          <M g={cone(0.62, 0.3, 8)} c={color} p={[0, 1.6, 0]} />
        </>
      ) : (
        // вечерний столик: свеча-фонарик вместо зонта
        <M g={box(0.08, 0.1, 0.08)} c={PAL.window} o={LIT_OPTS} p={[0, 0.65, 0]} shadow={false} />
      )}
    </group>
  );
}

/** Фонарь на столбике: светящийся короб под золотой крышечкой. */
function Lantern({ p, h = 1.0 }: { p: V3; h?: number }) {
  return (
    <group position={p}>
      <M g={cyl(0.035, 0.045, h, 5)} c={PAL.woodDark} p={[0, h / 2, 0]} />
      <M g={box(0.17, 0.2, 0.17)} c={PAL.window} o={LIT_OPTS} p={[0, h + 0.1, 0]} shadow={false} />
      <M g={cone(0.15, 0.13, 4)} c={PAL.roofGold} p={[0, h + 0.265, 0]} r={[0, Math.PI / 4, 0]} />
    </group>
  );
}

/** Перила вдоль x от x0 до x1 на высоте y (z — линия). */
function Rail({ x0, x1, z, y }: { x0: number; x1: number; z: number; y: number }) {
  const n = Math.max(2, Math.round((x1 - x0) / 0.45) + 1);
  return (
    <>
      {Array.from({ length: n }, (_, i) => (
        <M key={i} g={box(0.05, 0.4, 0.05)} c={PAL.white} p={[x0 + ((x1 - x0) * i) / (n - 1), y + 0.2, z]} />
      ))}
      <M g={box(x1 - x0 + 0.05, 0.05, 0.06)} c={PAL.white} p={[(x0 + x1) / 2, y + 0.4, z]} />
    </>
  );
}
/** Те же перила вдоль z (x — линия). */
const RailZ = ({ z0, z1, x, y }: { z0: number; z1: number; x: number; y: number }) => (
  <group rotation={[0, Math.PI / 2, 0]}>
    <Rail x0={-z1} x1={-z0} z={x} y={y} />
  </group>
);

/** Вывеска: коралловая доска с белой чашкой на двух столбиках. */
function Sign({ p, s = 1, damaged }: { p: V3; s?: number; damaged: boolean }) {
  return (
    <group position={p} rotation={damaged ? [0, 0, 0.32] : Z} scale={s}>
      <M g={box(0.06, 0.45, 0.06)} c={PAL.woodDark} p={[-0.5, 0.2, 0]} />
      <M g={box(0.06, 0.45, 0.06)} c={PAL.woodDark} p={[0.5, 0.2, 0]} />
      <M g={box(1.5, 0.56, 0.08)} c={PAL.roofCoral} p={[0, 0.66, 0]} />
      <M g={box(1.58, 0.06, 0.1)} c={PAL.roofGold} p={[0, 0.96, 0]} />
      <M g={cyl(0.15, 0.11, 0.26, 8)} c={PAL.white} p={[-0.05, 0.64, 0.1]} />
      <M g={torus(0.08, 0.025, 4, 8)} c={PAL.white} p={[0.12, 0.66, 0.1]} />
      <M g={ico(0.05)} c={PAL.white} p={[-0.08, 0.86, 0.1]} />
      <M g={ico(0.04)} c={PAL.white} p={[0.0, 0.93, 0.1]} />
    </group>
  );
}

/** Первый этаж (как у кафе): терраса на сваях, корпус с дверью и окном-прилавком, навес, два столика. */
function GroundFloor({ damaged }: { damaged: boolean }) {
  const sw = BW / STRIPES;
  const awningTilt = damaged ? 0.95 : 0.42;
  return (
    <>
      {/* терраса на сваях: на узком пляже её край висит над водой */}
      <M g={box(4.0, FLOOR, 3.5)} c={PAL.wood} p={[0, FLOOR / 2, 0.15]} />
      {[-1.85, -0.6, 0.6, 1.85].map((x) => (
        <M key={x} g={cyl(0.07, 0.07, 1.3, 6)} c={PAL.woodDark} p={[x, -0.5, 1.75]} />
      ))}
      <M g={box(BW, BH, BD)} c={PAL.wall} p={[0, FLOOR + BH / 2, BZ]} />
      <M g={box(0.5, 0.9, 0.06)} c={PAL.woodDark} p={[-0.95, FLOOR + 0.45, FRONT + 0.03]} />
      <Win w={1.3} h={0.5} p={[0.45, FLOOR + 0.95, FRONT + 0.03]} />
      {/* прилавок под окном */}
      <M g={box(1.4, 0.08, 0.3)} c={PAL.wood} p={[0.45, FLOOR + 0.66, FRONT + 0.15]} />
      {/* полосатый навес */}
      <group position={[0, FLOOR + 1.42, FRONT]} rotation={[awningTilt, 0, 0]}>
        {Array.from({ length: STRIPES }, (_, i) => {
          const c = i % 2 ? PAL.white : PAL.roofCoral;
          const x = -BW / 2 + sw * (i + 0.5);
          return (
            <group key={i}>
              <M g={box(sw, 0.05, 0.95)} c={c} p={[x, 0, 0.47]} />
              <M g={box(sw, 0.16, 0.04)} c={c} p={[x, -0.08, 0.95]} r={[-awningTilt, 0, 0]} />
            </group>
          );
        })}
      </group>
      <Table x={-1.15} z={1.3} color={PAL.roofGold} />
      <Table x={1.2} z={1.2} color={PAL.roofTeal} />
    </>
  );
}

// ───── Второй этаж: терраса на крыше ─────
const UP = FLOOR + BH + 0.12;              // пол верхней террасы
const UX = BW / 2 + 0.15, UZ0 = BZ - BD / 2 - 0.15, UZ1 = FRONT + 0.15;
const PAV = { x: -0.85, z: -1.1, w: 1.2, d: 0.95, h: 0.9 };
const PAV_TOP = UP + PAV.h;
const POLE_H = 1.05;
const poleTop = (x: number, z: number): V3 => [x, UP + POLE_H, z];

function RoofTerrace({ damaged }: { damaged: boolean }) {
  const fl = UX - 0.06, fz = UZ1 - 0.06, bz = UZ0 + 0.06;
  return (
    <>
      <M g={box(UX * 2, 0.12, UZ1 - UZ0)} c={PAL.wood} p={[0, UP - 0.06, (UZ0 + UZ1) / 2]} />
      <Rail x0={-fl} x1={fl} z={fz} y={UP} />
      <RailZ z0={bz} z1={fz} x={fl} y={UP} />
      <RailZ z0={PAV.z + PAV.d / 2} z1={fz} x={-fl} y={UP} />
      <Rail x0={PAV.x + PAV.w / 2} x1={fl} z={bz} y={UP} />
      {/* павильон с бирюзовой крышей и вывеской на коньке */}
      <M g={box(PAV.w, PAV.h, PAV.d)} c={PAL.wall} p={[PAV.x, UP + PAV.h / 2, PAV.z]} />
      <M
        g={gableRoof(PAV.w, PAV.d, 0.55, 0.15)}
        c={PAL.roofTeal}
        p={[PAV.x + (damaged ? 0.05 : 0), PAV_TOP + (damaged ? 0.04 : 0), PAV.z]}
        r={damaged ? [0.05, 0, -0.15] : Z}
      />
      <M g={box(0.4, 0.7, 0.06)} c={PAL.woodDark} p={[PAV.x + 0.3, UP + 0.35, PAV.z + PAV.d / 2 + 0.03]} />
      <Win p={[PAV.x - 0.25, UP + 0.5, PAV.z + PAV.d / 2 + 0.03]} w={0.38} h={0.34} lit />
      <Sign p={[PAV.x, PAV_TOP + 0.5, PAV.z]} s={0.72} damaged={damaged} />
      <Table x={0.65} y={UP} z={-0.8} color={PAL.roofGold} />
      {/* столбики с гирляндами по краям террасы */}
      {[[-fl, fz], [fl, fz], [fl, bz]].map(([x, z]) => (
        <M key={`${x}${z}`} g={cyl(0.035, 0.04, POLE_H, 5)} c={PAL.woodDark} p={[x, UP + POLE_H / 2, z]} />
      ))}
      <Garland a={poleTop(-fl, fz)} b={poleTop(fl, fz)} n={12} sag={0.3} />
      <Garland a={poleTop(fl, fz)} b={poleTop(fl, bz)} n={8} sag={0.22} />
      <Garland a={poleTop(-fl, fz)} b={[PAV.x - PAV.w / 2, PAV_TOP + 0.02, PAV.z + PAV.d / 2]} n={5} sag={0.12} />
      <Garland a={poleTop(fl, bz)} b={[PAV.x + PAV.w / 2, PAV_TOP + 0.02, PAV.z - PAV.d / 2]} n={8} sag={0.2} />
    </>
  );
}

// ───── Настил на сваях к воде ─────
const PZ0 = 1.9, PZ1 = 3.2, PX = 1.5;

function Pier({ damaged }: { damaged: boolean }) {
  return (
    <group rotation={damaged ? [0.05, 0, 0] : Z}>
      <M g={box(PX * 2, FLOOR, PZ1 - PZ0)} c={PAL.wood} p={[0, FLOOR / 2, (PZ0 + PZ1) / 2]} />
      {[-1.4, -0.45, 0.45, 1.4].flatMap((x) => [2.55, 3.1].map((z) => (
        <M key={`${x}${z}`} g={cyl(0.08, 0.09, 1.9, 6)} c={PAL.woodDark} p={[x, -0.8, z]} />
      )))}
      <Rail x0={-PX + 0.05} x1={PX - 0.05} z={PZ1 - 0.05} y={FLOOR} />
      <RailZ z0={PZ0 + 0.05} z1={PZ1 - 0.05} x={-PX + 0.05} y={FLOOR} />
      <RailZ z0={PZ0 + 0.05} z1={PZ1 - 0.05} x={PX - 0.05} y={FLOOR} />
      <Table x={-0.72} z={2.6} />
      <Table x={0.72} z={2.55} />
      {[-PX + 0.05, PX - 0.05].map((x) => <Lantern key={x} p={[x, FLOOR, PZ1 - 0.05]} h={1.05} />)}
      {[-1.95, 1.95].map((x) => <Lantern key={x} p={[x, FLOOR, 1.82]} h={1.05} />)}
    </group>
  );
}

export function Cafe({ damaged, level }: ModelProps) {
  const lv = Math.min(3, Math.max(1, level));
  return (
    <group>
      <Baked id={`cafe:${lv}:${+damaged}`}>
        <GroundFloor damaged={damaged} />
        {lv === 1 ? (
          <>
            <M g={gableRoof(BW, BD, 0.75, 0.22)} c={PAL.roofTeal} p={[0, FLOOR + BH, BZ]} />
            <Sign p={[0, FLOOR + BH + 0.75, BZ]} damaged={damaged} />
          </>
        ) : (
          <RoofTerrace damaged={damaged} />
        )}
        {lv === 3 && <Pier damaged={damaged} />}
      </Baked>
      {damaged && <Smoke origin={lv === 1 ? [0.6, FLOOR + BH + 0.9, BZ - 0.2] : [0.4, UP + 0.4, -0.9]} color={DARK_SMOKE} count={4} size={0.22} speed={0.2} rise={2} />}
    </group>
  );
}
