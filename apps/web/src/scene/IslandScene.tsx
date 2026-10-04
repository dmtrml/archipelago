// 3D-сцена острова — реализация контракта IslandSceneProps (см. contract.ts).
// Полноэкранный Canvas (position: fixed, z-index 0) + DOM-слои: tilt-shift, виньетка, всплывающие суммы.
import { type CSSProperties, useCallback, useEffect, useMemo, useRef } from 'react';
import { Canvas } from '@react-three/fiber';
import { NeutralToneMapping } from 'three';
import type { IslandSceneProps } from './contract';
import { BusContext, createBus } from './bus';
import { CAM_DIR, TARGET, idealDistance } from './layout';
import { Atmosphere } from './world/Atmosphere';
import { Water } from './world/Water';
import { Terrain } from './world/Terrain';
import { Decor } from './world/Decor';
import { Home, Lighthouse } from './world/Landmarks';
import { Clouds, Gulls, Neighbors, Rain } from './world/Ambient';
import { Items } from './Items';
import { Shipyard } from './world/Shipyard';
import { FloatLabels } from './FloatLabels';
import { CameraRig } from './CameraRig';
import './scene.css';

const GL = { antialias: true, toneMapping: NeutralToneMapping, toneMappingExposure: 1.05 };

export function IslandScene({ items, floats, weather, dream, bottomInset = 0, sideInsets, onItemClick }: IslandSceneProps) {
  const storm = weather === 'storm';
  // шина создаётся один раз; погода стартует сразу в нужном состоянии
  const bus = useMemo(() => createBus(weather === 'storm'), []);
  useEffect(() => { bus.weather.target = storm ? 1 : 0; }, [bus, storm]);

  const clickRef = useRef(onItemClick);
  useEffect(() => { clickRef.current = onItemClick; }, [onItemClick]);

  const setFloatLayer = useCallback((el: HTMLDivElement | null) => { bus.floatLayer = el; }, [bus]);

  const { camera, small } = useMemo(() => {
    const w = window.innerWidth, h = Math.max(1, window.innerHeight);
    const p = TARGET.clone().addScaledVector(CAM_DIR, idealDistance(w / h));
    return {
      camera: { fov: 30, near: 0.5, far: 1200, position: [p.x, p.y, p.z] as [number, number, number] },
      small: Math.min(w, h) < 600,
    };
  }, []);

  return (
    <div
      className={storm ? 'isl-root isl-storm' : 'isl-root'}
      style={{ '--isl-inset': Math.min(0.6, Math.max(0, bottomInset || 0)) } as CSSProperties}
    >
      <Canvas shadows="percentage" dpr={[1, 2]} gl={GL} camera={camera}>
        <BusContext.Provider value={bus}>
          <Atmosphere />
          <Water segments={small ? 170 : 230} />
          <Terrain />
          <Decor />
          <Lighthouse />
          <Home />
          <Neighbors />
          <Clouds />
          <Gulls />
          <Rain count={small ? 600 : 900} />
          <Items items={items} clickRef={clickRef} />
          {dream && <Shipyard dream={dream} clickRef={clickRef} />}
          <FloatLabels floats={floats} items={items} />
          <CameraRig bottomInset={bottomInset} sideInsets={sideInsets} />
        </BusContext.Provider>
      </Canvas>
      <div className="isl-tilt isl-tilt-top" />
      <div className="isl-tilt isl-tilt-bottom" />
      <div className="isl-vignette" />
      <div className="isl-storm-veil" />
      <div className="isl-floats" ref={setFloatLayer} />
    </div>
  );
}

export default IslandScene;
