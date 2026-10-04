// Коптильня (порт): тёмный сруб, бочки, дымок из трубы. Повреждённая — крыша набекрень, дым тёмный.
//   2 — «Рыбный цех»: пристройка со второй трубой, вешала с вялящейся рыбой;
//   3 — «Консервный заводик»: светлый цех с пилообразной крышей, высокая труба с густым дымом,
//       вывеска с банкой и рыбкой, штабеля ящиков у ворот.
import { PAL } from '../palette';
import { box, cone, cyl, gableRoof, octa } from '../materials';
import { Crate, DARK_SMOKE, House, M, Smoke, Win, chimneyTop, Z, type V3 } from './parts';
import type { ModelProps } from './types';
import { Baked } from './Baked';

const W = 1.9, D = 1.6, H = 1.25, RH = 0.85;
const FISH = [-0.45, -0.24, -0.03, 0.18, 0.39];

function Barrel({ p }: { p: V3 }) {
  return (
    <group position={p}>
      <M g={cyl(0.28, 0.28, 0.6, 8)} c={PAL.woodDark} p={[0, 0.3, 0]} />
      <M g={cyl(0.29, 0.29, 0.06, 8)} c={PAL.rock} p={[0, 0.42, 0]} />
    </group>
  );
}

/** Вешала: две стойки, жердь, связка рыбы. */
function FishRack({ p, rotY = 0, droop = false }: { p: V3; rotY?: number; droop?: boolean }) {
  return (
    <group position={p} rotation={[0, rotY, 0]}>
      {[-0.65, 0.65].map((x) => (
        <M key={x} g={cyl(0.045, 0.055, 1.15, 5)} c={PAL.woodDark} p={[x, 0.575, 0]} />
      ))}
      <M g={box(1.42, 0.06, 0.06)} c={PAL.woodDark} p={[0, 1.12, 0]} r={droop ? [0, 0, 0.12] : Z} />
      {FISH.map((x, i) => (
        <group key={x} position={[x + 0.03, droop ? 1.06 + x * 0.12 : 1.06, 0]}>
          <M g={octa(0.16)} c={i % 2 ? PAL.goldDeep : PAL.roofGold} p={[0, -0.2, 0]} s={[0.42, 1, 0.22]} />
          <M g={cone(0.07, 0.12, 3)} c={PAL.goldDeep} p={[0, -0.4, 0]} r={[Math.PI, 0, 0]} s={[1, 1, 0.4]} />
        </group>
      ))}
    </group>
  );
}

// ───── Рыбный цех ─────
// Пристройка — справа: слева у участков 3 и 5 подходит подножие холма, туда объекты не растут.
const MAIN_X = -0.35;
const ANNEX_X = 1.1, ANNEX_W = 1.0, ANNEX_D = 1.35, ANNEX_H = 0.9;
const L2_SMOKE_MAIN: V3 = [MAIN_X + chimneyTop(W, D, H, RH)[0], chimneyTop(W, D, H, RH)[1], chimneyTop(W, D, H, RH)[2]];
const L2_SMOKE_ANNEX: V3 = [1.3, 1.98, -0.32];

function Workshop({ damaged }: { damaged: boolean }) {
  return (
    <>
      <group position={[MAIN_X, 0, 0]}>
        <House w={W} d={D} h={H} wall={PAL.smokeWall} roof={PAL.smokeRoof} roofH={RH} crooked={damaged} />
      </group>
      {/* пристройка со своей трубой */}
      <M g={box(ANNEX_W + 0.2, 0.26, ANNEX_D + 0.2)} c={PAL.rock} p={[ANNEX_X, 0.13, -0.05]} />
      <M g={box(ANNEX_W, ANNEX_H, ANNEX_D)} c={PAL.smokeWall} p={[ANNEX_X, 0.26 + ANNEX_H / 2, -0.05]} />
      <M
        g={gableRoof(ANNEX_W, ANNEX_D, 0.55, 0.15)}
        c={PAL.smokeRoof}
        p={[ANNEX_X, 0.26 + ANNEX_H + (damaged ? 0.04 : 0), -0.05]}
        r={damaged ? [0.05, 0, 0.12] : Z}
      />
      <M g={box(0.28, 0.75, 0.28)} c={PAL.rock} p={[L2_SMOKE_ANNEX[0], 1.5, L2_SMOKE_ANNEX[2]]} />
      <Win p={[ANNEX_X, 0.78, -0.05 + ANNEX_D / 2 + 0.03]} w={0.55} h={0.36} />
      {/* вешала с рыбой перед фасадом, бочки у пристройки */}
      <FishRack p={[-0.1, 0, 1.4]} droop={damaged} />
      <Barrel p={[0.92, 0, 1.12]} />
      <Barrel p={[1.42, 0, 1.0]} />
    </>
  );
}

// ───── Консервный заводик ─────
const HALL_X = -0.1, HALL_Z = -0.05, HALL_W = 2.6, HALL_D = 1.9, HALL_H = 1.5;
const HALL_TOP = 0.26 + HALL_H;
const FRONT = HALL_Z + HALL_D / 2;
const TEETH = 3, TOOTH_W = HALL_W / TEETH;
const STACK: V3 = [0.8, 0, -0.68];
const STACK_H = 3.3;
const L3_SMOKE: V3 = [STACK[0], STACK_H + 0.15, STACK[2]];

function Cannery({ damaged }: { damaged: boolean }) {
  return (
    <>
      <M g={box(HALL_W + 0.3, 0.26, HALL_D + 0.3)} c={PAL.rock} p={[HALL_X, 0.13, HALL_Z]} />
      <M g={box(HALL_W, HALL_H, HALL_D)} c={PAL.wall} p={[HALL_X, 0.26 + HALL_H / 2, HALL_Z]} />
      {/* пилообразная крыша: три ската; у повреждённого средний сполз */}
      {Array.from({ length: TEETH }, (_, i) => {
        const broken = damaged && i === 1;
        return (
          <M
            key={i}
            g={gableRoof(TOOTH_W, HALL_D, 0.62, 0.06)}
            c={PAL.roofTeal}
            p={[HALL_X - HALL_W / 2 + TOOTH_W * (i + 0.5), HALL_TOP + (broken ? 0.06 : 0), HALL_Z]}
            r={broken ? [0.06, 0, -0.16] : Z}
          />
        );
      })}
      {/* ворота с погрузочной площадкой, светлые окна */}
      <M g={box(0.82, 1.05, 0.06)} c={PAL.woodDark} p={[-0.95, 0.26 + 0.525, FRONT + 0.03]} />
      <M g={box(0.86, 0.06, 0.08)} c={PAL.wood} p={[-0.95, 0.26 + 0.525, FRONT + 0.06]} />
      <M g={box(1.3, 0.2, 0.55)} c={PAL.stone} p={[-0.95, 0.1, FRONT + 0.4]} />
      {[-0.02, 0.62].map((x) => <Win key={x} p={[x, 1.02, FRONT + 0.03]} w={0.44} h={0.52} lit />)}
      <Win p={[HALL_X + HALL_W / 2 + 0.03, 1.02, HALL_Z + 0.3]} r={[0, Math.PI / 2, 0]} w={0.44} h={0.52} lit />
      <Win p={[HALL_X + HALL_W / 2 + 0.03, 1.02, HALL_Z - 0.5]} r={[0, Math.PI / 2, 0]} w={0.44} h={0.52} lit />
      {[-0.75, 0.0].map((x) => <Win key={x} p={[x, 1.02, HALL_Z - HALL_D / 2 - 0.03]} w={0.44} h={0.52} lit />)}
      {/* вывеска на фронтоне: коралловая доска, золотой кант, белые банка и рыбка */}
      <group position={[HALL_X, HALL_TOP + 0.36, FRONT + 0.14]} rotation={damaged ? [0, 0, 0.18] : Z}>
        <M g={box(1.36, 0.48, 0.08)} c={PAL.roofCoral} />
        <M g={box(1.44, 0.07, 0.1)} c={PAL.roofGold} p={[0, 0.27, 0]} />
        <M g={box(1.44, 0.07, 0.1)} c={PAL.roofGold} p={[0, -0.27, 0]} />
        <M g={cyl(0.11, 0.11, 0.28, 8)} c={PAL.white} p={[-0.36, 0, 0.06]} />
        <M g={cyl(0.115, 0.115, 0.08, 8)} c={PAL.roofGold} p={[-0.36, 0, 0.06]} />
        <M g={octa(0.16)} c={PAL.white} p={[0.12, 0, 0.06]} s={[1.5, 0.75, 0.4]} />
        <M g={cone(0.11, 0.18, 3)} c={PAL.white} p={[0.42, 0, 0.06]} r={[0, 0, Math.PI / 2]} s={[1, 1, 0.4]} />
      </group>
      {/* высокая труба: камень, коралловый и белый пояски */}
      <M g={cyl(0.2, 0.28, STACK_H, 8)} c={PAL.rock} p={[STACK[0], STACK_H / 2, STACK[2]]} />
      <M g={cyl(0.215, 0.215, 0.18, 8)} c={PAL.roofCoral} p={[STACK[0], STACK_H - 0.3, STACK[2]]} />
      <M g={cyl(0.22, 0.22, 0.1, 8)} c={PAL.white} p={[STACK[0], STACK_H - 0.12, STACK[2]]} />
      {/* штабеля ящиков у правого угла */}
      <Crate p={[1.6, 0, 0.5]} rotY={0.1} />
      <Crate p={[1.58, 0.42, 0.52]} s={0.44} rotY={-0.25} c={PAL.roofGold} />
      <Crate p={[1.62, 0, -0.1]} s={0.46} rotY={-0.15} />
      <Crate p={[0.95, 0, 1.3]} s={0.44} rotY={0.35} />
    </>
  );
}

export function Smokehouse({ damaged, level }: ModelProps) {
  const lv = Math.min(3, Math.max(1, level));
  return (
    <group>
      <Baked id={`smokehouse:${lv}:${+damaged}`}>
        {lv === 1 && (
          <>
            <House w={W} d={D} h={H} wall={PAL.smokeWall} roof={PAL.smokeRoof} roofH={RH} crooked={damaged} />
            <M g={cyl(0.28, 0.28, 0.6, 8)} c={PAL.woodDark} p={[1.4, 0.3, 0.6]} />
            <M g={cyl(0.28, 0.28, 0.6, 8)} c={PAL.woodDark} p={[1.4, 0.3, -0.05]} />
          </>
        )}
        {lv === 2 && <Workshop damaged={damaged} />}
        {lv === 3 && <Cannery damaged={damaged} />}
      </Baked>
      {lv === 1 && (damaged
        ? <Smoke origin={chimneyTop(W, D, H, RH)} color={DARK_SMOKE} count={4} size={0.24} speed={0.2} rise={2.2} />
        : <Smoke origin={chimneyTop(W, D, H, RH)} />)}
      {lv === 2 && (damaged
        ? <Smoke origin={L2_SMOKE_MAIN} color={DARK_SMOKE} count={4} size={0.24} speed={0.2} rise={2.2} />
        : (
          <>
            <Smoke origin={L2_SMOKE_MAIN} />
            <Smoke origin={L2_SMOKE_ANNEX} count={5} size={0.26} speed={0.28} rise={2.6} />
          </>
        ))}
      {lv === 3 && (damaged
        ? <Smoke origin={L3_SMOKE} color={DARK_SMOKE} count={5} size={0.28} speed={0.2} rise={2.6} />
        : <Smoke origin={L3_SMOKE} count={9} size={0.36} speed={0.3} rise={3.8} drift={1.2} />)}
    </group>
  );
}
