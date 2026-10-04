// Мечта игрока — шхуна, которая строится на стапеле у берега (см. DreamProgress в contract.ts).
//   стройка (building)   — рядом лежат доски, козлы, ведро смолы и стоит ручной кран;
//   built ≥ 1            — стапель на сваях + киль и шпангоуты будущего судна;
//   built ≥ 2            — обшитый корпус с палубой на кильблоках;
//   built ≥ stages       — шхуна спущена на воду, качается у морского конца стапеля.
// Каждая новая часть появляется «пружинкой» + круг (как объекты в Items.tsx); при первом показе (загрузка
// сохранения) текущее состояние рисуется сразу. Над сценой регистрируется якорь подписей 'dream'.
import { type RefObject, type ReactNode, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { type ThreeEvent, useFrame, useThree } from '@react-three/fiber';
import type { Group } from 'three';
import type { DreamProgress } from '../contract';
import { PAL } from '../palette';
import { box, cyl, shade } from '../materials';
import { BEACH_Y, clamp01, easeOutBack, lerp } from '../layout';
import { DREAM_PLACE, DREAM_PROPS_AT, DREAM_SHIP_AT, DREAM_SLIP_AT } from '../slots';
import { useBus } from '../bus';
import { Baked } from '../models/Baked';
import { M, Smoke, Z, type V3 } from '../models/parts';
import {
  Beam, FloatingSchooner, SchoonerFrame, SchoonerHull, hullBottomAtX, hullHalfWidthAtX, hullHeightAtX,
} from '../models/Schooner';
import { Ripple } from '../Items';

const POP = 0.8, EXIT = 0.35;

// ───── Геометрия стапеля (система «стапель»: +x в море, +z вдоль берега к камере; y = 0 — песок) ─────
const INCL = 0.19;                 // наклон спуска, рад
const SIN = Math.sin(INCL), COS = Math.cos(INCL);
const RAMP_Y0 = 0.75;              // высота верха рельсов над песком в начале спуска
const RAIL_Z = 1.15;               // рельсы по бокам, на ±RAIL_Z
const RAIL_LEN = 10.6;
const SLEEPERS = Array.from({ length: 11 }, (_, k) => 0.35 + k * 0.95);
const HULL_D = 4.0;                // центр корпуса вдоль спуска
const HULL_N = 0.77;               // высота начала координат корпуса над рельсами
const KEELWAY_TOP = -0.07;
const PIVOT_X = 5;                 // вокруг этой точки «дышит» наведение
const HULL_AT: V3 = [HULL_D * COS + HULL_N * SIN, RAMP_Y0 - HULL_D * SIN + HULL_N * COS, 0];
const PROPS_AT: V3 = [DREAM_PROPS_AT.lx, 0, DREAM_PROPS_AT.lz];

/** Точка из системы склона (d вдоль рельсов, n от верха рельсов, z) в систему стапеля. */
const slopePoint = (d: number, n: number): [number, number] => [d * COS + n * SIN, RAMP_Y0 - d * SIN + n * COS];

/** Группа, повёрнутая вдоль спуска: внутри d — вдоль рельсов, n — «вверх» от них. */
function Slope({ children }: { children: ReactNode }) {
  return <group position={[0, RAMP_Y0, 0]} rotation={[0, 0, -INCL]}>{children}</group>;
}

// ───── Стапель: рельсы, шпалы, кильблоки, сваи ─────
function Slipway() {
  const blocks = [-3.0, -2.2, -1.1, 0, 1.1, 2.4].map((hx) => {
    const top = HULL_N + hullBottomAtX(hx) - 0.02;
    const h = top - KEELWAY_TOP;
    return { d: HULL_D + hx, h };
  });
  return (
    <Baked id="dream:1:slip">
      <Slope>
        {[-RAIL_Z, RAIL_Z].map((z) => (
          <M key={z} g={box(RAIL_LEN, 0.2, 0.3)} c={PAL.wood} p={[RAIL_LEN / 2 - 0.3, -0.1, z]} />
        ))}
        <M g={box(9.9, 0.14, 0.42)} c={PAL.woodDark} p={[4.65, KEELWAY_TOP - 0.07, 0]} />
        {SLEEPERS.map((d) => <M key={d} g={box(0.34, 0.14, 3.2)} c={PAL.woodDark} p={[d, -0.27, 0]} />)}
        {blocks.map((b) => <M key={b.d} g={box(0.6, b.h, 0.55)} c={PAL.wood} p={[b.d, KEELWAY_TOP + b.h / 2, 0]} />)}
      </Slope>
      {/* опоры под шпалами: каменные на песке, сваи в воде */}
      {SLEEPERS.flatMap((d) => {
        const [x, y] = slopePoint(d, -0.34);
        return [-1.35, 1.35].map((z) =>
          x < 2.7 ? (
            y > 0.12 ? <M key={`${d}${z}`} g={box(0.46, y + 0.1, 0.46)} c={PAL.rock} p={[x, (y - 0.1) / 2, z]} /> : null
          ) : (
            <M key={`${d}${z}`} g={cyl(0.12, 0.14, y + 2.3, 6)} c={PAL.woodDark} p={[x, (y - 2.3) / 2, z]} />
          ),
        );
      })}
    </Baked>
  );
}

/** Упоры по бокам корпуса: приставлены от концов шпал к обшивке. */
function Shores() {
  const items = [1, 3, 5].map((k) => SLEEPERS[k]);
  return (
    <Baked id="dream:2:shores">
      <Slope>
        {items.flatMap((d) => {
          const hx = d - HULL_D;
          const n = HULL_N + hullHeightAtX(hx, 0.45);
          const w = hullHalfWidthAtX(hx, 0.45) - 0.03;
          return [-1, 1].map((side) => (
            <Beam key={`${d}${side}`} a={[d, -0.2, side * 1.5]} b={[d, n, side * w]} t={0.12} c={PAL.wood} />
          ));
        })}
      </Slope>
    </Baked>
  );
}

// ───── Стройплощадка: доски, козлы, ведро со смолой, ручной кран ─────
const FRESH = shade(PAL.wood, PAL.sand, 0.35);

function YardProps() {
  const hook = useRef<Group>(null!);
  useFrame((state) => {
    const t = state.clock.elapsedTime;
    hook.current.rotation.z = Math.sin(t * 0.9) * 0.07;
    hook.current.rotation.x = Math.cos(t * 0.7) * 0.05;
  });
  const armTip: V3 = [0.2, 1.8, -1.35];
  return (
    <>
      <Baked id="dream:0:props">
        {/* стопка досок на двух брусьях */}
        <group position={[-0.55, 0, 0.15]} rotation={[0, 0.14, 0]}>
          {[-0.5, 0.5].map((x) => <M key={x} g={box(0.12, 0.1, 0.95)} c={PAL.woodDark} p={[x, 0.05, 0]} />)}
          {[0, 1, 2, 3].flatMap((j) =>
            [-1, 0, 1].map((i) => (
              <M key={`${j}${i}`} g={box(1.5, 0.09, 0.27)} c={(i + j) % 2 ? PAL.wood : FRESH} p={[j % 2 ? 0.06 : 0, 0.15 + j * 0.095, i * 0.29]} />
            )),
          )}
        </group>
        {/* козлы с недопиленной доской */}
        <group position={[0.75, 0, -0.35]} rotation={[0, -0.2, 0]}>
          {[-0.5, 0.5].flatMap((x) => [-0.3, 0.3].map((z) => (
            <Beam key={`${x}${z}`} a={[x, 0, z]} b={[x, 0.72, 0]} t={0.09} c={PAL.woodDark} />
          )))}
          <M g={box(1.3, 0.1, 0.12)} c={PAL.woodDark} p={[0, 0.74, 0]} />
          <M g={box(1.7, 0.06, 0.3)} c={FRESH} p={[0.1, 0.82, 0]} r={[0, 0.06, 0]} />
        </group>
        {/* ведро со смолой */}
        <group position={[0.35, 0, 0.8]}>
          <M g={cyl(0.22, 0.17, 0.36, 8)} c={PAL.woodDark} p={[0, 0.18, 0]} />
          <M g={cyl(0.2, 0.2, 0.03, 8)} c={PAL.night} p={[0, 0.37, 0]} />
          <M g={cyl(0.235, 0.235, 0.04, 8)} c={PAL.rock} p={[0, 0.09, 0]} />
        </group>
        {/* ручной кран: стойка, стрела, подкос и каменное основание */}
        <M g={box(0.55, 0.12, 0.55)} c={PAL.rock} p={[0.2, 0.06, -0.95]} />
        <Beam a={[0.2, 0.1, -0.95]} b={[0.2, 2.15, -0.95]} t={0.15} c={PAL.woodDark} />
        <Beam a={[0.2, 2.15, -0.95]} b={armTip} t={0.11} c={PAL.woodDark} />
        <Beam a={[0.2, 0.55, -0.95]} b={[0.2, 1.5, -1.2]} t={0.09} c={PAL.wood} />
        <M g={box(0.3, 0.1, 0.3)} c={PAL.gold} p={[0.2, 2.22, -0.95]} />
      </Baked>
      {/* груз на тросе слегка раскачивается */}
      <group ref={hook} position={armTip}>
        <Baked id="dream:0:hook">
          <Beam a={[0, 0, 0]} b={[0, -0.85, 0]} t={0.03} c={PAL.woodDark} />
          <M g={box(0.14, 0.14, 0.14)} c={PAL.gold} p={[0, -0.9, 0]} />
          <M g={box(1.0, 0.07, 0.2)} c={FRESH} p={[0, -1.04, 0]} />
          <M g={box(1.0, 0.07, 0.2)} c={PAL.wood} p={[0, -1.12, 0]} />
        </Baked>
      </group>
      <Smoke origin={[0.35, 0.45, 0.8]} count={3} size={0.18} rise={1.8} drift={0.4} speed={0.22} />
    </>
  );
}

// ───── Появление/исчезновение части «пружинкой» + круг ─────
interface PopProps {
  show: boolean;
  /** точка (в системе родителя), вокруг которой растёт часть */
  origin?: V3;
  delay?: number;
  ripple?: { pos: V3; size: number };
  children: ReactNode;
}

function Pop({ show, origin = Z, delay = 0, ripple, children }: PopProps) {
  const [mounted, setMounted] = useState(show);
  const [ripKey, setRipKey] = useState(0);
  const [initial] = useState(show ? 1 : 0.001);
  const g = useRef<Group>(null!);
  const s = useRef({ v: initial, phase: 'idle' as 'idle' | 'in' | 'out', t0: -1, from: 0 });
  const prev = useRef(show);

  useEffect(() => {
    if (prev.current === show) return;
    prev.current = show;
    const st = s.current;
    st.phase = show ? 'in' : 'out';
    st.t0 = -1;
    st.from = st.v;
    if (show) { setMounted(true); setRipKey((k) => k + 1); }
  }, [show]);

  useFrame((state) => {
    const st = s.current;
    if (st.phase === 'idle') return;
    const t = state.clock.elapsedTime;
    if (st.t0 < 0) st.t0 = t + (st.phase === 'in' ? delay : 0);
    if (st.phase === 'in') {
      const k = clamp01((t - st.t0) / POP);
      st.v = lerp(st.from, 1, easeOutBack(k));
      if (k >= 1) { st.v = 1; st.phase = 'idle'; }
    } else {
      const k = clamp01((t - st.t0) / EXIT);
      st.v = st.from * (k < 0.25 ? 1 + 0.5 * k : 1.125 * (1 - ((k - 0.25) / 0.75) ** 2));
      if (k >= 1) { st.v = 0.001; st.phase = 'idle'; setMounted(false); }
    }
    g.current.scale.setScalar(Math.max(0.001, st.v));
  });

  return (
    <>
      <group position={origin}>
        <group ref={g} scale={initial}>
          <group position={[-origin[0], -origin[1], -origin[2]]}>{(mounted || show) && children}</group>
        </group>
      </group>
      {ripKey > 0 && ripple && (
        <group position={ripple.pos}>
          <Ripple key={ripKey} y={0} size={ripple.size} delay={delay} />
        </group>
      )}
    </>
  );
}

// ───── Верфь целиком ─────
interface Props {
  dream: DreamProgress;
  clickRef: RefObject<((uid: string) => void) | undefined>;
}

export function Shipyard({ dream, clickRef }: Props) {
  const { built, building } = dream;
  const stages = Math.max(1, dream.stages);
  const done = built >= stages;
  const slip = built >= 1;
  const frame = !done && built === 1;
  const hull = !done && built >= 2;
  const shores = slip && !done;

  const bus = useBus();
  const gl = useThree((st) => st.gl);
  const hov = useRef<Group>(null!);
  const hover = useRef({ v: 0, on: false });
  const anchor = useRef<Group>(null!);

  // якорь подписей: над тем, что сейчас видно
  const anchorH = done ? 6.4 : hull ? 3.3 : frame ? 2.7 : 3.0;
  const anchorAt: V3 = done ? [DREAM_SHIP_AT.lx, 0, DREAM_SHIP_AT.lz] : slip ? [HULL_AT[0], BEACH_Y, 0] : [PROPS_AT[0], BEACH_Y, PROPS_AT[2]];
  useLayoutEffect(() => {
    const a = { obj: anchor.current, h: anchorH };
    bus.anchors.set('dream', a);
    return () => { if (bus.anchors.get('dream') === a) bus.anchors.delete('dream'); };
  }, [bus, anchorH]);

  useEffect(() => () => { if (hover.current.on) gl.domElement.style.cursor = ''; }, [gl]);

  useFrame((_, dt) => {
    const h = hover.current;
    h.v += ((h.on ? 1 : 0) - h.v) * Math.min(1, dt * 12);
    hov.current.scale.setScalar(1 + 0.04 * h.v);
  });

  const onOver = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation();
    hover.current.on = true;
    gl.domElement.style.cursor = 'pointer';
  };
  const onOut = () => {
    hover.current.on = false;
    gl.domElement.style.cursor = '';
  };
  const onClick = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    if (e.delta > 6) return;
    clickRef.current?.('dream');
  };

  return (
    <group
      position={[DREAM_PLACE.x, 0, DREAM_PLACE.z]}
      rotation={[0, DREAM_PLACE.rotY, 0]}
      onPointerOver={onOver}
      onPointerOut={onOut}
      onClick={onClick}
    >
      <group ref={hov} position={[PIVOT_X, 0, 0]}>
        <group position={[-PIVOT_X, 0, 0]}>
          <group position={[0, BEACH_Y, 0]}>
            <Pop show={slip} origin={[DREAM_SLIP_AT.lx, 0, DREAM_SLIP_AT.lz]} ripple={{ pos: [3.6, 0.15, 0], size: 1.7 }}>
              <Slipway />
            </Pop>
            <Pop show={shores} origin={HULL_AT} delay={0.1}>
              <Shores />
            </Pop>
            <Pop show={frame} origin={HULL_AT} delay={0.2}>
              <Slope>
                <group position={[HULL_D, HULL_N, 0]}><SchoonerFrame /></group>
              </Slope>
            </Pop>
            <Pop show={hull} origin={HULL_AT} ripple={{ pos: [HULL_AT[0], 0.15, 0], size: 1.5 }}>
              <Slope>
                <group position={[HULL_D, HULL_N, 0]}><SchoonerHull /></group>
              </Slope>
            </Pop>
            <Pop show={building} origin={PROPS_AT} ripple={{ pos: [PROPS_AT[0], 0.15, PROPS_AT[2]], size: 0.9 }}>
              <group position={PROPS_AT} scale={1.1}><YardProps /></group>
            </Pop>
          </group>
          <Pop
            show={done}
            origin={[DREAM_SHIP_AT.lx, 0.3, DREAM_SHIP_AT.lz]}
            ripple={{ pos: [DREAM_SHIP_AT.lx, 0.15, DREAM_SHIP_AT.lz], size: 1.8 }}
          >
            <group position={[DREAM_SHIP_AT.lx, 0, DREAM_SHIP_AT.lz]} rotation={[0, DREAM_SHIP_AT.yaw, 0]}>
              <FloatingSchooner />
            </group>
          </Pop>
          <group ref={anchor} position={anchorAt} />
        </group>
      </group>
    </group>
  );
}
