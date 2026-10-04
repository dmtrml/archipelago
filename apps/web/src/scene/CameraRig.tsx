// Камера как в концепте: FOV 30, взгляд из (1, 0.62, 1), медленное автовращение до первого касания.
// bottomInset: остров плавно сдвигается вверх (setViewOffset) и при высокой шторке чуть отдаляется (zoom).
// focus: когда ключ меняется (не при первом показе), камера плавно облетает остров так, чтобы точка (x, z)
// оказалась спереди-справа от центра острова — внутри свободной полосы между панелями (а не у края или под панелью).
// Автовращение после этого не возвращается.
import { useEffect, useRef, useState } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import { PerspectiveCamera, Vector3 } from 'three';
import { TARGET, clamp01, easeInOut, idealDistance } from './layout';

const dir = new Vector3();
const probe = new PerspectiveCamera();
const pt = new Vector3();

/** Куда повернуть камеру: key меняется — значит, пора; (x, z) — точка на острове. */
export interface CameraFocus { key: string; x: number; z: number }

const TURN_TIME = 1.6;   // секунды на облёт
const FOCUS_AT = 0.3;    // на какой доле полуширины свободной полосы правее её центра окажется точка
const TWO_PI = Math.PI * 2;

/** Азимут камеры (от TARGET) — как у OrbitControls: atan2(x, z) вектора от цели к камере. */
const azimuth = (x: number, z: number) => Math.atan2(x - TARGET.x, z - TARGET.z);
/** Угол в диапазон (−π, π]: так облёт всегда идёт кратчайшим путём. */
const wrapAngle = (a: number) => a - TWO_PI * Math.round(a / TWO_PI);

/**
 * Азимут камеры, при котором точка (x, z) окажется спереди-справа от центра острова: на экране — правее середины
 * свободной полосы между панелями (left/right — их доли ширины). Расстояние и наклон остаются прежними;
 * подбор по пробной камере с теми же zoom и viewOffset, поэтому учитывает и боковые панели, и узкий экран.
 */
function focusAzimuth(camera: PerspectiveCamera, x: number, z: number, left: number, right: number) {
  const want = left - right + FOCUS_AT * (1 - left - right);   // NDC по x: центр полосы + доля полуширины
  const base = azimuth(x, z);                                   // на этом азимуте точка прямо перед камерой
  const r = Math.hypot(camera.position.x - TARGET.x, camera.position.z - TARGET.z);
  probe.copy(camera);
  const ndcX = (off: number) => {
    probe.position.set(TARGET.x + Math.sin(base - off) * r, camera.position.y, TARGET.z + Math.cos(base - off) * r);
    probe.lookAt(TARGET);
    probe.updateMatrixWorld();
    return pt.set(x, 0, z).project(probe).x;
  };
  let lo = 0.05, hi = 1.0;   // чем больше доворот, тем правее точка на экране
  for (let i = 0; i < 12; i++) {
    const mid = (lo + hi) / 2;
    if (ndcX(mid) < want) lo = mid; else hi = mid;
  }
  return base - (lo + hi) / 2;
}

interface Turn { from: number; delta: number; t: number }

interface Props {
  bottomInset: number;
  sideInsets?: [number, number];
  focus?: CameraFocus | null;
}

export function CameraRig({ bottomInset, sideInsets = [0, 0], focus = null }: Props) {
  const camera = useThree((s) => s.camera) as PerspectiveCamera;
  const size = useThree((s) => s.size);
  const [autoRotate, setAutoRotate] = useState(true);
  const st = useRef({ inset: Math.min(0.6, Math.max(0, bottomInset)), applied: -1, side: '', turn: null as Turn | null });
  const [left, right] = sideInsets;

  // облёт к новой точке; первый показ (загрузка сохранения) только запоминается — камера стоит где стоит
  const lastKey = useRef(focus?.key);
  const fx = focus?.x, fz = focus?.z;
  useEffect(() => {
    const key = focus?.key;
    if (key === lastKey.current) return;
    lastKey.current = key;
    if (key === undefined || fx === undefined || fz === undefined) return;
    setAutoRotate(false);   // камера теперь наведена на мечту — автовращение её не уведёт
    const from = azimuth(camera.position.x, camera.position.z);
    const delta = wrapAngle(focusAzimuth(camera, fx, fz, left, right) - from);
    if (Math.abs(delta) > 0.02) st.current.turn = { from, delta, t: 0 };
  }, [focus?.key, fx, fz, camera, left, right]);

  // смена размера окна: расстояние как в концепте, вид пересчитать
  useEffect(() => {
    const aspect = size.width / Math.max(1, size.height);
    dir.copy(camera.position).sub(TARGET).normalize();
    camera.position.copy(TARGET).addScaledVector(dir, idealDistance(aspect));
    st.current.applied = -1;
  }, [size.width, size.height, camera]);

  // облёт идёт до OrbitControls (приоритет −1): тот сам довернёт взгляд на цель.
  // Время копится по кадрам с потолком на шаг: подвисание в первом кадре (новые модели) не «съедает» часть облёта.
  useFrame((_, dt) => {
    const turn = st.current.turn;
    if (!turn) return;
    turn.t += Math.min(dt, 0.05);
    const k = clamp01(turn.t / TURN_TIME);
    const az = turn.from + turn.delta * easeInOut(k);
    const r = Math.hypot(camera.position.x - TARGET.x, camera.position.z - TARGET.z);
    camera.position.x = TARGET.x + Math.sin(az) * r;
    camera.position.z = TARGET.z + Math.cos(az) * r;
    if (k >= 1) st.current.turn = null;
  }, -2);

  useFrame((_, dt) => {
    const s = st.current;
    const target = Math.min(0.6, Math.max(0, bottomInset || 0));
    s.inset += (target - s.inset) * Math.min(1, dt * 5);
    if (Math.abs(target - s.inset) < 1e-4) s.inset = target;
    // центр кадра — чуть ниже середины свободной от интерфейса части экрана (сверху тоже есть панель)
    const off = s.inset * 0.45;
    const side = `${left}:${right}`;
    if (Math.abs(off - s.applied) > 1e-5 || side !== s.side) {
      // при высокой шторке и боковых панелях остров отодвигается (zoom, а не дистанция — не мешаем OrbitControls)
      const sideZoom = 1 - Math.min(0.3, (left + right) * 0.35);
      camera.zoom = sideZoom / (1 + Math.max(0, s.inset - 0.25));
      // сдвиг по X: центр свободной полосы между панелями
      const offX = ((right - left) / 2) * size.width;
      if (off > 0 || offX !== 0) camera.setViewOffset(size.width, size.height, offX, off * size.height, size.width, size.height);
      else camera.clearViewOffset();
      s.applied = off;
      s.side = side;
    }
  });

  return (
    <OrbitControls
      target={[TARGET.x, TARGET.y, TARGET.z]}
      enableDamping
      enablePan={false}
      minDistance={30}
      maxDistance={130}
      minPolarAngle={0.45}
      maxPolarAngle={1.22}
      autoRotate={autoRotate}
      autoRotateSpeed={0.35}
      onStart={() => { st.current.turn = null; setAutoRotate(false); }}
    />
  );
}
