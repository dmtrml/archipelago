import { useFrame, useThree } from '@react-three/fiber';
import { PerspectiveCamera, Vector3 } from 'three';
import type { CameraPose } from './contract';

const target = new Vector3();
const DEG = Math.PI / 180;

export function DirectorCamera({ pose }: { pose: () => CameraPose }) {
  const camera = useThree((state) => state.camera) as PerspectiveCamera;
  useFrame(() => {
    const p = pose();
    const az = p.az * DEG;
    const el = p.el * DEG;
    const cosEl = Math.cos(el);
    target.set(...p.target);
    camera.position.set(
      p.target[0] + p.d * cosEl * Math.sin(az),
      p.target[1] + p.d * Math.sin(el),
      p.target[2] + p.d * cosEl * Math.cos(az),
    );
    camera.zoom = 1;
    camera.clearViewOffset();
    camera.lookAt(target);
    camera.updateProjectionMatrix();
  }, -100);
  return null;
}
