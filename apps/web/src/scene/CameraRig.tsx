// Камера как в концепте: FOV 30, взгляд из (1, 0.62, 1), медленное автовращение до первого касания.
// bottomInset: остров плавно сдвигается вверх (setViewOffset) и при высокой шторке чуть отдаляется (zoom).
import { useEffect, useRef, useState } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import { type PerspectiveCamera, Vector3 } from 'three';
import { TARGET, idealDistance } from './layout';

const dir = new Vector3();

export function CameraRig({ bottomInset, sideInsets = [0, 0] }: { bottomInset: number; sideInsets?: [number, number] }) {
  const camera = useThree((s) => s.camera) as PerspectiveCamera;
  const size = useThree((s) => s.size);
  const [autoRotate, setAutoRotate] = useState(true);
  const st = useRef({ inset: Math.min(0.6, Math.max(0, bottomInset)), applied: -1, side: '' });
  const [left, right] = sideInsets;

  // смена размера окна: расстояние как в концепте, вид пересчитать
  useEffect(() => {
    const aspect = size.width / Math.max(1, size.height);
    dir.copy(camera.position).sub(TARGET).normalize();
    camera.position.copy(TARGET).addScaledVector(dir, idealDistance(aspect));
    st.current.applied = -1;
  }, [size.width, size.height, camera]);

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
      onStart={() => setAutoRotate(false)}
    />
  );
}
