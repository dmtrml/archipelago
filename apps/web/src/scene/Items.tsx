// Объекты игрока: расстановка по слотам, появление «пружинкой» + круг, исчезновение,
// поломка (значок ремонта), улучшение (праздничный прыжок, золотой круг, монетки), наведение и клик.
// Финансовые вложения — один общий банк.
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type RefObject } from 'react';
import { type ThreeEvent, useFrame, useThree } from '@react-three/fiber';
import { type Group, type InstancedMesh, type Mesh, MeshBasicMaterial, MeshStandardMaterial, Object3D, Quaternion } from 'three';
import type { ModelId, SlotType } from '@arch/engine';
import type { PlacedItem } from './contract';
import { PAL } from './palette';
import { box, cyl, mat, octa, ring, torus } from './materials';
import { clamp01, easeInOut, easeOutBack, lerp, makeRng } from './layout';
import { slotPlace } from './slots';
import { DamageContext, useBus } from './bus';
import { MODELS, heightAt, levelFor, rippleAt } from './models';
import { noRay } from './models/parts';
import { Baked } from './models/Baked';

const BANK_KEY = '__bank__';
const POP = 0.8, EXIT = 0.45, STAGGER = 0.08;
/** Улучшение: «приседание» старой модели, затем смена на новую и пружинистый прыжок. */
const UP_SQUASH = 0.2, UP_SPRING = 1.0;

interface VisualItem {
  key: string;
  model: ModelId;
  slot: SlotType;
  slotIndex: number;
  damaged: boolean;
  /** уровень улучшения, уже приведённый к тому, что модель умеет показать (у банка всегда 1) */
  level: number;
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
    const info = MODELS[it.model];
    if (!info) { warnOnce(`неизвестная модель ${it.model}`); continue; }
    if (!slotPlace(it.slot, it.slotIndex)) { warnOnce(`нет места ${it.slot}[${it.slotIndex}]`); continue; }
    out.push({
      key: it.uid, model: it.model, slot: it.slot, slotIndex: it.slotIndex, damaged: it.damaged,
      level: levelFor(info, it.level), uids: [it.uid],
    });
  }
  if (finance.length) {
    out.push({
      key: BANK_KEY, model: 'bank', slot: 'finance', slotIndex: 0,
      damaged: finance.some((f) => f.damaged), level: 1, uids: finance.map((f) => f.uid),
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
interface RippleProps { y: number; size: number; delay?: number; dur?: number; color?: number; grow?: number }
export function Ripple({ y, size, delay = 0, dur = 1.3, color = PAL.white, grow = 5 }: RippleProps) {
  const ref = useRef<Mesh>(null!);
  const material = useMemo(() => new MeshBasicMaterial({ color, transparent: true, opacity: 0, depthWrite: false }), [color]);
  useEffect(() => () => material.dispose(), [material]);
  const t0 = useRef(-1);
  useFrame((state) => {
    const t = state.clock.elapsedTime;
    if (t0.current < 0) t0.current = t + delay;
    const k = (t - t0.current) / dur;
    const m = ref.current;
    m.visible = k >= 0 && k < 1;
    if (!m.visible) return;
    m.scale.setScalar(size * (1 + k * grow));
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

// ───── Праздник улучшения: золотые монетки и искры взлетают и тают ─────
const COINS = 12, SPARKS = 14, BURST = 1.5;
const tmpObj = new Object3D();

interface Flyer { a: number; r: number; vy: number; spin: number; delay: number; size: number }
function makeFlyers(n: number, seed: number, vy: [number, number], r: [number, number]): Flyer[] {
  const { rr } = makeRng(seed);
  return Array.from({ length: n }, (_, i) => ({
    a: (i / n) * Math.PI * 2 + rr(-0.25, 0.25),
    r: rr(r[0], r[1]),
    vy: rr(vy[0], vy[1]),
    spin: rr(5, 9) * (i % 2 ? 1 : -1),
    delay: rr(0, 0.22),
    size: rr(0.75, 1.15),
  }));
}
const COIN_FLY = makeFlyers(COINS, 77, [1.8, 3.0], [0.45, 1.15]);
const SPARK_FLY = makeFlyers(SPARKS, 78, [2.4, 3.6], [0.55, 1.45]);

/**
 * Монетки (крутятся «ребром») и искры поднимаются от середины объекта, расходятся и тают.
 * Два InstancedMesh, матрицы пишутся в общий tmpObj — без аллокаций в кадре и без React-состояния.
 */
function CoinBurst({ y0, spread, delay }: { y0: number; spread: number; delay: number }) {
  const coins = useRef<InstancedMesh>(null!);
  const sparks = useRef<InstancedMesh>(null!);
  const mats = useMemo(() => ({
    coin: new MeshStandardMaterial({
      color: PAL.gold, emissive: PAL.goldDeep, emissiveIntensity: 0.35, roughness: 0.5, metalness: 0, flatShading: true, transparent: true,
    }),
    spark: new MeshStandardMaterial({
      color: PAL.window, emissive: PAL.window, emissiveIntensity: 1.1, roughness: 0.85, metalness: 0, flatShading: true, transparent: true,
    }),
  }), []);
  useEffect(() => () => { mats.coin.dispose(); mats.spark.dispose(); }, [mats]);
  const t0 = useRef(-1);

  useFrame((state) => {
    const t = state.clock.elapsedTime;
    if (t0.current < 0) t0.current = t + delay;
    const k = (t - t0.current) / BURST;
    const on = k >= 0 && k < 1;
    coins.current.visible = sparks.current.visible = on;
    if (!on) return;
    const fade = k < 0.65 ? 1 : 1 - (k - 0.65) / 0.35;
    mats.coin.opacity = fade;
    mats.spark.opacity = fade;
    const el = t - t0.current;
    for (let pass = 0; pass < 2; pass++) {
      const list = pass ? SPARK_FLY : COIN_FLY;
      const im = pass ? sparks.current : coins.current;
      for (let i = 0; i < list.length; i++) {
        const f = list[i];
        const lt = Math.max(0, el - f.delay);
        const q = clamp01(lt / (BURST - f.delay));
        const out = 1 - (1 - q) * (1 - q);            // разлёт быстро, потом замирает
        const r = f.r * spread * out;
        tmpObj.position.set(Math.cos(f.a) * r, y0 + f.vy * q * (1.6 - q), Math.sin(f.a) * r);
        const grow = q < 0.12 ? q / 0.12 : q > 0.75 ? Math.max(0, (1 - q) / 0.25) : 1;
        if (pass) {
          tmpObj.rotation.set(lt * 3, lt * 4 + f.a, 0);
          tmpObj.scale.setScalar(Math.max(0.001, grow * f.size * (0.7 + 0.3 * Math.sin(lt * 18 + f.a * 5))));
        } else {
          tmpObj.rotation.set(Math.PI / 2, f.a + lt * f.spin, 0, 'YXZ');
          tmpObj.scale.setScalar(Math.max(0.001, grow * f.size));
        }
        tmpObj.updateMatrix();
        im.setMatrixAt(i, tmpObj.matrix);
      }
      im.instanceMatrix.needsUpdate = true;
    }
  });

  return (
    <>
      <instancedMesh ref={coins} args={[cyl(0.24, 0.24, 0.07, 10), mats.coin, COINS]} frustumCulled={false} visible={false} raycast={noRay} />
      <instancedMesh ref={sparks} args={[octa(0.12), mats.spark, SPARKS]} frustumCulled={false} visible={false} raycast={noRay} />
    </>
  );
}

/** Всё праздничное, что не трогает саму модель: два золотых круга и монетки. Монтируется заново на каждое улучшение. */
function UpgradeFx({ y, size, h }: { y: number; size: number; h: number }) {
  return (
    <>
      <Ripple y={y} size={size * 0.8} delay={UP_SQUASH} dur={1.1} color={PAL.gold} grow={4} />
      <Ripple y={y} size={size * 0.6} delay={UP_SQUASH + 0.25} dur={1.1} color={PAL.gold} grow={3.5} />
      <CoinBurst y0={h * 0.6} spread={size} delay={UP_SQUASH} />
    </>
  );
}

// ───── Один объект ─────
interface NodeProps {
  t: Tracked;
  onExited: (key: string) => void;
  clickRef: RefObject<((uid: string) => void) | undefined>;
}

/** Уровень на экране: при росте модель сменяется не сразу, а на дне «приседания» (shown отстаёт от target). */
interface LevelState { shown: number; target: number; ups: number }

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
  const a = useRef({
    t0: -1, exitT0: -1, exitFrom: 1, popFrom: 0, scale: instant ? 1 : 0, hover: 0, hovered: false, mul: targetMul,
    bumpT0: -10, bumpPending: false, done: false, upT0: -10, upPending: false, swapped: true,
  });

  // уровень: рост — праздник (ups++), понижение (не должно случаться) или уход — сразу
  const [lv, setLv] = useState<LevelState>(() => ({ shown: v.level, target: v.level, ups: 0 }));
  let level = lv;
  if (lv.target !== v.level) {
    level = v.level > lv.target && !leaving
      ? { shown: lv.shown, target: v.level, ups: lv.ups + 1 }
      : { shown: v.level, target: v.level, ups: lv.ups };
    setLv(level);
  }
  const swap = useCallback(() => setLv((s) => (s.shown === s.target ? s : { ...s, shown: s.target })), []);
  useEffect(() => {
    if (level.ups > 0) a.current.upPending = true;
  }, [level.ups]);

  const h = heightAt(info, level.shown);

  // якоря для всплывающих подписей
  const uidsKey = v.uids.join('|');
  useLayoutEffect(() => {
    const anchor = { obj: outer.current, h: h * targetMul };
    const uids = uidsKey.split('|');
    for (const uid of uids) bus.anchors.set(uid, anchor);
    return () => { for (const uid of uids) if (bus.anchors.get(uid) === anchor) bus.anchors.delete(uid); };
  }, [bus, uidsKey, h, targetMul]);

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

    // улучшение: присесть (сплющиться) → смена модели → прыжок с пружинистым «желе»
    if (s.upPending) { s.upPending = false; s.upT0 = time; s.swapped = false; }
    const uk = time - s.upT0;
    let sy = 1, sxz = 1, hop = 0;
    if (uk >= 0 && uk < UP_SQUASH) {
      const e = easeInOut(uk / UP_SQUASH);
      sy = 1 - 0.24 * e;
      sxz = 1 + 0.12 * e;
    } else if (uk >= UP_SQUASH && uk < UP_SQUASH + UP_SPRING) {
      if (!s.swapped) { s.swapped = true; swap(); }
      const k = (uk - UP_SQUASH) / UP_SPRING;
      const jelly = Math.cos(k * Math.PI * 5) * Math.exp(-2.2 * k) * (1 - k);
      sy = 1 - 0.24 * jelly;
      sxz = 1 + 0.12 * jelly;
      hop = k < 0.4 ? Math.sin((k / 0.4) * Math.PI) * 0.45 : 0;
    } else if (!s.swapped) { s.swapped = true; swap(); }

    const u = Math.max(0.001, base * s.mul * (1 + 0.06 * s.hover + bump));
    inner.current.scale.set(u * sxz, u * sy, u * sxz);
    inner.current.position.y = hop;
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
  const ripple = rippleAt(info, level.shown);
  const Model = info.C;

  return (
    <group ref={outer} position={[place.x, place.y, place.z]} rotation={[0, place.rotY, 0]}>
      <group ref={inner} scale={instant ? 1 : 0.001} onPointerOver={onOver} onPointerOut={onOut} onClick={onClick}>
        <DamageContext.Provider value={v.damaged}>
          <Model damaged={v.damaged} variant={v.slotIndex} level={level.shown} />
        </DamageContext.Provider>
        {v.damaged && <DamageMarker y={h - 0.55} />}
      </group>
      {!instant && <Ripple y={rippleY} size={ripple} delay={delay} />}
      {leaving && <Ripple y={rippleY} size={ripple * 0.7} dur={0.8} />}
      {level.ups > 0 && !leaving && (
        <UpgradeFx key={level.ups} y={rippleY} size={rippleAt(info, level.target)} h={heightAt(info, level.target)} />
      )}
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
