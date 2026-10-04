// Домик для сдачи (порт дома с коралловой крышей) + белый заборчик и почтовый ящик.
//   2 — «Гостевой дом»: два этажа, балкон над крыльцом, ящики с цветами под окнами;
//   3 — «Мини-отель»: три этажа, полосатый козырёк над входом, золотая вывеска со звёздами,
//       флагшток и флажки над крышей, в окнах горит свет, кадки у входа.
import { FLOWER_COLORS, PAL } from '../palette';
import { box, cyl, gableRoof, ico, octa } from '../materials';
import { Bunting, DARK_SMOKE, House, M, Smoke, Win, chimneyTop, Z, type V3 } from './parts';
import type { ModelProps } from './types';
import { Baked } from './Baked';

const W = 2.4, D = 2.0, H = 1.6, RH = 1.1;
const FZ = D / 2 + 0.8; // линия забора перед фасадом

/** Секция забора от x0 до x1: столбики + две перекладины. */
function Fence({ x0, x1, z = FZ, broken = false }: { x0: number; x1: number; z?: number; broken?: boolean }) {
  const n = Math.max(2, Math.round((x1 - x0) / 0.4) + 1);
  const len = x1 - x0, cx = (x0 + x1) / 2;
  return (
    <group rotation={broken ? [0.5, 0, 0] : Z} position={broken ? [0, 0, 0.05] : Z}>
      {Array.from({ length: n }, (_, i) => (
        <M key={i} g={box(0.08, 0.5, 0.08)} c={PAL.white} p={[x0 + (len * i) / (n - 1), 0.25, z]} />
      ))}
      <M g={box(len, 0.06, 0.04)} c={PAL.white} p={[cx, 0.17, z]} />
      <M g={box(len, 0.06, 0.04)} c={PAL.white} p={[cx, 0.38, z]} />
    </group>
  );
}

function Mailbox({ p, damaged }: { p: V3; damaged: boolean }) {
  return (
    <group position={p}>
      <M g={box(0.08, 0.62, 0.08)} c={PAL.woodDark} p={[0, 0.31, 0]} />
      <M g={box(0.24, 0.2, 0.34)} c={PAL.roofTeal} p={[0, 0.7, 0]} />
      <M g={box(0.03, 0.2, 0.06)} c={PAL.roofCoral} p={[0.135, 0.82, -0.08]} r={damaged ? [0, 0, -1.2] : Z} />
    </group>
  );
}

/** Ящик с цветами под окном. */
function FlowerBox({ p }: { p: V3 }) {
  return (
    <group position={p}>
      <M g={box(0.52, 0.12, 0.16)} c={PAL.wood} />
      {[-0.16, 0, 0.16].map((x, i) => (
        <M key={x} g={ico(0.085)} c={FLOWER_COLORS[(i + (p[0] > 0 ? 1 : 0)) % FLOWER_COLORS.length]} p={[x, 0.1, 0]} />
      ))}
    </group>
  );
}

/** Коробка этажей: цоколь, стены этажей с деревянными поясами между ними. Возвращает высоту верха стен. */
function Storeys({ w, d, hs }: { w: number; d: number; hs: number[] }) {
  let y = 0.26;
  return (
    <>
      <M g={box(w + 0.3, 0.26, d + 0.3)} c={PAL.rock} p={[0, 0.13, 0]} />
      {hs.map((h, i) => {
        const y0 = y;
        y += h;
        return (
          <group key={i}>
            <M g={box(w, h, d)} c={PAL.wall} p={[0, y0 + h / 2, 0]} />
            {i < hs.length - 1 && <M g={box(w + 0.1, 0.09, d + 0.1)} c={PAL.wood} p={[0, y, 0]} />}
          </group>
        );
      })}
    </>
  );
}

// ───── Гостевой дом ─────
const W2 = 2.5, D2 = 2.0, HS2 = [1.3, 1.15], RH2 = 1.1;
const TOP2 = 0.26 + HS2[0] + HS2[1];
const F2 = 0.26 + HS2[0]; // пол второго этажа
const L2_CHIMNEY: V3 = [0.62, TOP2 + RH2 * 0.55 + 0.5, -0.36];

function GuestHouse({ damaged }: { damaged: boolean }) {
  const fz = D2 / 2 + 0.03;
  return (
    <>
      <Storeys w={W2} d={D2} hs={HS2} />
      <M
        g={gableRoof(W2, D2, RH2)}
        c={PAL.roofCoral}
        p={damaged ? [0.1, TOP2 + 0.05, 0] : [0, TOP2, 0]}
        r={damaged ? [0.06, 0, -0.14] : Z}
      />
      <M g={box(0.34, 0.9, 0.34)} c={PAL.rock} p={[L2_CHIMNEY[0], TOP2 + RH2 * 0.55, L2_CHIMNEY[2]]} />
      {/* первый этаж: дверь под балконом, окно */}
      <M g={box(0.52, 0.9, 0.08)} c={PAL.woodDark} p={[-0.45, 0.71, fz]} />
      <Win p={[0.68, 0.95, fz]} />
      {/* балкон на двух столбах — заодно навес над крыльцом */}
      <M g={box(1.6, 0.1, 0.62)} c={PAL.wood} p={[-0.2, F2 + 0.02, D2 / 2 + 0.31]} r={damaged ? [0, 0, 0.05] : Z} />
      {[-0.92, 0.52].map((x) => (
        <M key={x} g={cyl(0.05, 0.05, F2 - 0.26, 6)} c={PAL.woodDark} p={[x, 0.26 + (F2 - 0.26) / 2, D2 / 2 + 0.55]} />
      ))}
      <group position={[-0.2, F2 + 0.07, 0]} rotation={damaged ? [0, 0, 0.05] : Z}>
        {[-0.76, -0.38, 0, 0.38, 0.76].map((x) => (
          <M key={x} g={box(0.05, 0.4, 0.05)} c={PAL.white} p={[x, 0.2, D2 / 2 + 0.6]} />
        ))}
        <M g={box(1.58, 0.06, 0.06)} c={PAL.white} p={[0, 0.4, D2 / 2 + 0.6]} />
        {[-0.76, 0.76].map((x) => (
          <M key={x} g={box(0.05, 0.06, 0.6)} c={PAL.white} p={[x, 0.4, D2 / 2 + 0.3]} />
        ))}
      </group>
      {/* второй этаж: балконная дверь, окна с цветами */}
      <M g={box(0.46, 0.82, 0.08)} c={PAL.woodDark} p={[-0.2, F2 + 0.48, fz]} />
      <Win p={[0.75, F2 + 0.6, fz]} />
      <FlowerBox p={[0.75, F2 + 0.3, fz + 0.08]} />
      <Win p={[W2 / 2 + 0.03, 0.95, 0]} r={[0, Math.PI / 2, 0]} />
      <Win p={[W2 / 2 + 0.03, F2 + 0.6, 0]} r={[0, Math.PI / 2, 0]} />
      <FlowerBox p={[W2 / 2 + 0.08, F2 + 0.3, 0]} />
      {/* задняя стена не глухая: по окну на этаж */}
      <Win p={[0.5, 0.95, -D2 / 2 - 0.03]} />
      <Win p={[-0.5, F2 + 0.6, -D2 / 2 - 0.03]} />
      <Win p={[0.5, F2 + 0.6, -D2 / 2 - 0.03]} />
      {/* заборчик и почтовый ящик как у домика */}
      <Fence x0={-1.45} x1={-0.8} />
      <Fence x0={-0.1} x1={1.45} broken={damaged} />
      <Mailbox p={[-1.15, 0, FZ + 0.4]} damaged={damaged} />
    </>
  );
}

// ───── Мини-отель ─────
const W3 = 2.9, D3 = 2.2, HS3 = [1.15, 0.95, 0.95], RH3 = 1.1, RO3 = 0.28;
const TOP3 = 0.26 + HS3[0] + HS3[1] + HS3[2];
const FY3 = [0.26, 0.26 + HS3[0], 0.26 + HS3[0] + HS3[1]]; // полы этажей
const FZ3 = D3 / 2 + 0.95;
const STRIPES = 5, AW = 1.3;
const L3_CHIMNEY: V3 = [0.78, TOP3 + RH3 * 0.55 + 0.5, -0.42];
const POLE_BASE: V3 = [0, TOP3 + RH3 - 0.2, D3 / 2 + 0.12];
const POLE_H = 1.15;

function MiniHotel({ damaged }: { damaged: boolean }) {
  const fz = D3 / 2 + 0.03;
  const sw = AW / STRIPES;
  const tilt = damaged ? 0.95 : 0.42;
  // флажки крепятся к столбикам на углах карниза, чтобы не ложиться на скаты
  const eaveY = TOP3 + 0.38, eaveX = W3 / 2 + RO3 - 0.08, eaveZ = D3 / 2 + RO3 - 0.06;
  return (
    <>
      <Storeys w={W3} d={D3} hs={HS3} />
      <M
        g={gableRoof(W3, D3, RH3, RO3)}
        c={PAL.roofCoral}
        p={damaged ? [0.1, TOP3 + 0.05, 0] : [0, TOP3, 0]}
        r={damaged ? [0.06, 0, -0.14] : Z}
      />
      <M g={box(0.36, 0.9, 0.36)} c={PAL.rock} p={[L3_CHIMNEY[0], TOP3 + RH3 * 0.55, L3_CHIMNEY[2]]} />
      {/* вход: двустворчатая дверь, ступенька, полосатый козырёк */}
      <M g={box(0.82, 0.92, 0.08)} c={PAL.woodDark} p={[0, 0.26 + 0.46, fz]} />
      <M g={box(0.04, 0.9, 0.1)} c={PAL.wood} p={[0, 0.26 + 0.46, fz + 0.01]} />
      <M g={box(1.1, 0.12, 0.36)} c={PAL.stone} p={[0, 0.06, D3 / 2 + 0.33]} />
      <group position={[0, 0.26 + 1.08, D3 / 2]} rotation={[tilt, 0, 0]}>
        {Array.from({ length: STRIPES }, (_, i) => {
          const c = i % 2 ? PAL.white : PAL.roofCoral;
          const x = -AW / 2 + sw * (i + 0.5);
          return (
            <group key={i}>
              <M g={box(sw, 0.05, 0.72)} c={c} p={[x, 0, 0.36]} />
              <M g={box(sw, 0.14, 0.04)} c={c} p={[x, -0.07, 0.72]} r={[-tilt, 0, 0]} />
            </group>
          );
        })}
      </group>
      {/* окна: внизу по бокам от входа, на втором — вывеска со звёздами посередине */}
      {[-1.0, 1.0].map((x) => <Win key={x} p={[x, 0.86, fz]} w={0.5} h={0.5} lit />)}
      {[-1.0, 1.0].map((x) => <Win key={x} p={[x, FY3[1] + 0.5, fz]} w={0.46} h={0.46} lit />)}
      {[-1.0, 0, 1.0].map((x) => <Win key={x} p={[x, FY3[2] + 0.5, fz]} w={0.46} h={0.46} lit />)}
      {FY3.map((y, i) => (
        <group key={y}>
          <Win p={[W3 / 2 + 0.03, y + (i ? 0.5 : 0.6), 0.45]} r={[0, Math.PI / 2, 0]} w={0.44} h={0.44} lit />
          <Win p={[W3 / 2 + 0.03, y + (i ? 0.5 : 0.6), -0.45]} r={[0, Math.PI / 2, 0]} w={0.44} h={0.44} lit />
        </group>
      ))}
      {/* задняя стена: по два окна на этаж */}
      {FY3.flatMap((y, i) => [-0.7, 0.7].map((x) => (
        <Win key={`b${y}${x}`} p={[x, y + (i ? 0.5 : 0.6), -D3 / 2 - 0.03]} w={0.46} h={0.46} lit />
      )))}
      <group position={[0, FY3[1] + 0.5, fz + 0.03]} rotation={damaged ? [0, 0, -0.2] : Z}>
        <M g={box(0.92, 0.4, 0.06)} c={PAL.roofGold} />
        <M g={box(0.98, 0.05, 0.08)} c={PAL.goldDeep} p={[0, -0.22, 0]} />
        {[-0.26, 0, 0.26].map((x) => (
          <M key={x} g={octa(0.085)} c={PAL.white} p={[x, 0.01, 0.05]} s={[1, 1, 0.4]} />
        ))}
      </group>
      {/* кадки с кустами у входа */}
      {[-0.82, 0.82].map((x) => (
        <group key={x} position={[x, 0, D3 / 2 + 0.5]}>
          <M g={box(0.38, 0.3, 0.38)} c={PAL.wood} p={[0, 0.15, 0]} />
          <M g={ico(0.26)} c={PAL.leaf} p={[0, 0.44, 0]} s={damaged ? [1, 0.7, 1] : 1} />
        </group>
      ))}
      {/* флагшток на коньке и две гирлянды флажков к углам крыши; у повреждённого шток завалился */}
      <group position={POLE_BASE} rotation={damaged ? [0.3, 0, 0.35] : Z}>
        <M g={cyl(0.035, 0.04, POLE_H, 5)} c={PAL.night} p={[0, POLE_H / 2, 0]} />
        <M g={box(0.62, 0.36, 0.03)} c={PAL.roofGold} p={[0.33, POLE_H - 0.2, 0]} />
        {!damaged && [-1, 1].map((side) => (
          <Bunting
            key={side}
            a={[0, POLE_H - 0.1, 0]}
            b={[side * eaveX, eaveY - POLE_BASE[1], eaveZ - POLE_BASE[2]]}
            n={6}
            sag={0.14}
          />
        ))}
      </group>
      {!damaged && [-1, 1].map((side) => (
        <M key={side} g={cyl(0.03, 0.03, 0.4, 5)} c={PAL.night} p={[side * eaveX, eaveY - 0.18, eaveZ]} />
      ))}
      {/* заборчик с калиткой напротив входа */}
      <Fence x0={-1.3} x1={-0.5} z={FZ3} broken={damaged} />
      <Fence x0={0.5} x1={1.4} z={FZ3} />
    </>
  );
}

export function Cottage({ damaged, level }: ModelProps) {
  const lv = Math.min(3, Math.max(1, level));
  const smoke = lv === 1 ? chimneyTop(W, D, H, RH) : lv === 2 ? L2_CHIMNEY : L3_CHIMNEY;
  return (
    <group>
      <Baked id={`cottage:${lv}:${+damaged}`}>
        {lv === 1 && (
          <>
            <House w={W} d={D} h={H} roof={PAL.roofCoral} roofH={RH} crooked={damaged} />
            {/* заборчик с калиткой напротив двери */}
            <Fence x0={-1.45} x1={-0.85} />
            <Fence x0={-0.1} x1={1.45} broken={damaged} />
            {/* почтовый ящик у калитки */}
            <Mailbox p={[-1.15, 0, FZ + 0.4]} damaged={damaged} />
          </>
        )}
        {lv === 2 && <GuestHouse damaged={damaged} />}
        {lv === 3 && <MiniHotel damaged={damaged} />}
      </Baked>
      {damaged
        ? <Smoke origin={smoke} color={DARK_SMOKE} count={4} size={0.22} speed={0.2} rise={2} />
        : lv > 1 && <Smoke origin={smoke} count={4} size={0.22} speed={0.24} rise={2.2} drift={0.6} />}
    </group>
  );
}
