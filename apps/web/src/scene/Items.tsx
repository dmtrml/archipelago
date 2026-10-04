// Объекты игрока: расстановка по слотам, появление «пружинкой» + круг, исчезновение,
// поломка (значок ремонта), наведение и клик. Финансовые вложения — один общий банк.
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type RefObject } from 'react';
import { type ThreeEvent, useFrame, useThree } from '@react-three/fiber';
import { type Group, type Mesh, MeshBasicMaterial, Quaternion } from 'three';
import type { ModelId, SlotType } from '@arch/engine';
import type { PlacedItem } from './contract';
import { PAL } from './palette';
import { box, cyl, mat, ring, torus } from './materials';
import { clamp01, easeOutBack, lerp } from './layout';
import { slotPlace } from './slots';
import { DamageContext, useBus } from './bus';
import { MODELS } from './models';
import { noRay } from './models/parts';
import { Baked } from './models/Baked';

const BANK_KEY = '__bank__';
const POP = 0.8, EXIT = 0.45, STAGGER = 0.08;

interface VisualItem {
  key: string;
  model: ModelId;
  slot: SlotType;
  slotIndex: number;
  damaged: boolean;
  /** uid'ы игровых объектов, которые рисует этот визуальный объект (у банка — все вклады) */
  uids: string[];
}

const warned = new Set<string>();
const warnOnce = (msg: string) => {
  if (warned.has(msg)) return;
  warned.add(msg);
  console.warn('[IslandScene]', msg);
};

function toVisual(items: PlacedItem[]): VisualItem[] {
  const out: VisualItem[] = [];
  const finance: PlacedItem[] = [];
  for (const it of items) {
    if (it.slot === 'finance') { finance.push(it); continue; }
    if (!MODELS[it.model]) { warnOnce(`неизвестная модель ${it.model}`); continue; }
    if (!slotPlace(it.slot, it.slotIndex)) { warnOnce(`нет места ${it.slot}[${it.slotIndex}]`); continue; }
    out.push({ key: it.uid, model: it.model, slot: it.slot, slotIndex: it.slotIndex, damaged: it.damaged, uids: [it.uid] });
  }
  if (finance.length) {
    out.push({
      key: BANK_KEY, model: 'bank', slot: 'finance', slotIndex: 0,
      damaged: finance.some((f) => f.damaged), uids: finance.map((f) => f.uid),
    });
  }
  return out;
}

interface Tracked { v: VisualItem; leaving: boolean; delay: number; instant: boolean }

/** Держит удалённые объекты, пока не доиграет анимация исчезновения. */
function useLifecycle(visual: VisualItem[]) {
  const [st, setSt] = useState(() => ({
    prev: visual,
    list: visual.map((v): Tracked => ({ v, leaving: false, delay: 0, instant: true })),
  }));
  let cur = st;
  if (st.prev !== visual) {
    const byKey = new Map(visual.map((v) => [v.key, v]));
    const list: Tracked[] = [];
    const seen = new Set<string>();
    for (const t of st.list) {
      const nv = byKey.get(t.v.key);
      if (nv) { list.push({ ...t, v: nv, leaving: false }); seen.add(nv.key); }
      else list.push(t.leaving ? t : { ...t, leaving: true });
    }
    let n = 0;
    for (const v of visual) if (!seen.has(v.key)) list.push({ v, leaving: false, delay: n++ * STAGGER, instant: false });
    cur = { prev: visual, list };
    setSt(cur);
  }
  const finish = useCallback(
    (key: string) => setSt((s) => ({ ...s, list: s.list.filter((t) => !(t.leaving && t.v.key === key)) })),
    [],
  );
  return [cur.list, finish] as const;
}

// ───── Круг на воде/земле ─────
export function Ripple({ y, size, delay = 0, dur = 1.3 }: { y: number; size: number; delay?: number; dur?: number }) {
  const ref = useRef<Mesh>(null!);
  const material = useMemo(() => new MeshBasicMaterial({ color: PAL.white, transparent: true, opacity: 0, depthWrite: false }), []);
  useEffect(() => () => material.dispose(), [material]);
  const t0 = useRef(-1);
  useFrame((state) => {
    const t = state.clock.elapsedTime;
    if (t0.current < 0) t0.current = t + delay;
    const k = (t - t0.current) / dur;
    const m = ref.current;
    m.visible = k >= 0 && k < 1;
    if (!m.visible) return;
    m.scale.setScalar(size * (1 + k * 5));
    material.opacity = 1 - k;
  });
  return <mesh ref={ref} geometry={ring(0.85, 1.0, 48)} material={material} position={[0, y, 0]} rotation={[-Math.PI / 2, 0, 0]} visible={false} raycast={noRay} />;
}

// ───── Значок «нужен ремонт»: коралловый кружок с гаечным ключом, всегда лицом к камере ─────
const qTmp = new Quaternion();
function DamageMarker({ y }: { y: number }) {
  const ref = useRef<Group>(null!);
  useFrame((state) => {
    const g = ref.current;
    g.position.y = y + Math.sin(state.clock.elapsedTime * 2.2) * 0.12;
    if (g.parent) {
      g.parent.getWorldQuaternion(qTmp);
      g.quaternion.copy(qTmp.invert().multiply(state.camera.quaternion));
    }
  });
  return (
    <group ref={ref} position={[0, y, 0]}>
      <Baked id="damageMarker" shadow={false}>
      <mesh geometry={cyl(0.5, 0.5, 0.1, 20)} material={mat(PAL.roofCoral, { emissive: PAL.roofCoral, emissiveIntensity: 0.25 })} rotation={[Math.PI / 2, 0, 0]} />
      <mesh geometry={torus(0.5, 0.06, 6, 20)} material={mat(PAL.white)} />
      <group rotation={[0, 0, -Math.PI / 4]} position={[0, 0, 0.08]}>
        <mesh geometry={box(0.12, 0.44, 0.05)} material={mat(PAL.white)} position={[0, -0.09, 0]} />
        <mesh geometry={torus(0.13, 0.05, 5, 10, 4.6)} material={mat(PAL.white)} position={[0, 0.2, 0]} rotation={[0, 0, -3.87]} />
      </group>
      </Baked>
    </group>
  );
}

// ───── Один объект ─────
interface NodeProps {
  t: Tracked;
  onExited: (key: string) => void;
  clickRef: RefObject<((uid: string) => void) | undefined>;
}

function ItemNode({ t, onExited, clickRef }: NodeProps) {
  const { v, leaving, delay, instant } = t;
  const info = MODELS[v.model];
  const place = slotPlace(v.slot, v.slotIndex)!;
  const bus = useBus();
  const gl = useThree((s) => s.gl);
  const outer = useRef<Group>(null!);
  const inner = useRef<Group>(null!);
  // банк чуть подрастает с числом вкладов
  const targetMul = v.slot === 'finance' ? 1 + Math.min(v.uids.length - 1, 5) * 0.06 : 1;
  const a = useRef({ t0: -1, exitT0: -1, exitFrom: 1, popFrom: 0, scale: instant ? 1 : 0, hover: 0, hovered: false, mul: targetMul, bumpT0: -10, bumpPending: false, done: false });

  // якоря для всплывающих подписей
  const uidsKey = v.uids.join('|');
  useLayoutEffect(() => {
    const anchor = { obj: outer.current, h: info.h * targetMul };
    const uids = uidsKey.split('|');
    for (const uid of uids) bus.anchors.set(uid, anchor);
    return () => { for (const uid of uids) if (bus.anchors.get(uid) === anchor) bus.anchors.delete(uid); };
  }, [bus, uidsKey, info.h, targetMul]);

  // «подпрыгнуть» при поломке/ремонте
  const first = useRef(true);
  useEffect(() => {
    if (first.current) { first.current = false; return; }
    a.current.bumpPending = true;
  }, [v.damaged]);

  useEffect(() => () => {
    if (a.current.hovered) gl.domElement.style.cursor = '';
  }, [gl]);

  useFrame((state, dt) => {
    const s = a.current;
    const time = state.clock.elapsedTime;
    if (s.t0 < 0) s.t0 = instant ? time - 10 : time + delay;
    let base: number;
    if (leaving) {
      if (s.exitT0 < 0) { s.exitT0 = time; s.exitFrom = s.scale; }
      const k = Math.min(1, (time - s.exitT0) / EXIT);
      base = s.exitFrom * (k < 0.25 ? 1 + 0.5 * k : 1.125 * (1 - ((k - 0.25) / 0.75) ** 2));
      if (k >= 1 && !s.done) { s.done = true; onExited(v.key); }
    } else {
      if (s.exitT0 >= 0) { s.exitT0 = -1; s.t0 = time; s.popFrom = s.scale; s.done = false; }
      base = time < s.t0 ? 0 : lerp(s.popFrom, 1, easeOutBack(clamp01((time - s.t0) / POP)));
    }
    s.scale = base;
    s.hover += ((s.hovered && !leaving ? 1 : 0) - s.hover) * Math.min(1, dt * 12);
    s.mul += (targetMul - s.mul) * Math.min(1, dt * 4);
    if (s.bumpPending) { s.bumpPending = false; s.bumpT0 = time; }
    const bk = (time - s.bumpT0) / 0.5;
    const bump = bk >= 0 && bk < 1 ? Math.sin(bk * Math.PI) * 0.12 * (1 - bk) : 0;
    inner.current.scale.setScalar(Math.max(0.001, base * s.mul * (1 + 0.06 * s.hover + bump)));
  });

  const onOver = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation();
    if (leaving) return;
    a.current.hovered = true;
    gl.domElement.style.cursor = 'pointer';
  };
  const onOut = () => {
    a.current.hovered = false;
    gl.domElement.style.cursor = '';
  };
  const onClick = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    if (leaving || e.delta > 6) return;
    clickRef.current?.(v.uids[0]);
  };

  const rippleY = Math.max(place.y, 0.2) + 0.15 - place.y;
  const Model = info.C;

  return (
    <group ref={outer} position={[place.x, place.y, place.z]} rotation={[0, place.rotY, 0]}>
      <group ref={inner} scale={instant ? 1 : 0.001} onPointerOver={onOver} onPointerOut={onOut} onClick={onClick}>
        <DamageContext.Provider value={v.damaged}>
          <Model damaged={v.damaged} variant={v.slotIndex} />
        </DamageContext.Provider>
        {v.damaged && <DamageMarker y={info.h - 0.55} />}
      </group>
      {!instant && <Ripple y={rippleY} size={info.ripple} delay={delay} />}
      {leaving && <Ripple y={rippleY} size={info.ripple * 0.7} dur={0.8} />}
    </group>
  );
}

export function Items({ items, clickRef }: { items: PlacedItem[]; clickRef: NodeProps['clickRef'] }) {
  const visual = useMemo(() => toVisual(items), [items]);
  const [list, finish] = useLifecycle(visual);
  return (
    <>
      {list.map((t) => (
        <ItemNode key={t.v.key} t={t} onExited={finish} clickRef={clickRef} />
      ))}
    </>
  );
}
