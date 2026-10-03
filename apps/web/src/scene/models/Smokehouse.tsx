// Коптильня (порт): тёмный сруб, бочки, дымок из трубы. Повреждённая — крыша набекрень, дым тёмный.
import { PAL } from '../palette';
import { cyl } from '../materials';
import { DARK_SMOKE, House, M, Smoke, chimneyTop } from './parts';
import type { ModelProps } from './types';
import { Baked } from './Baked';

const W = 1.9, D = 1.6, H = 1.25, RH = 0.85;

export function Smokehouse({ damaged }: ModelProps) {
  return (
    <group>
      <Baked id={`smokehouse:${+damaged}`}>
        <House w={W} d={D} h={H} wall={PAL.smokeWall} roof={PAL.smokeRoof} roofH={RH} crooked={damaged} />
        <M g={cyl(0.28, 0.28, 0.6, 8)} c={PAL.woodDark} p={[1.4, 0.3, 0.6]} />
        <M g={cyl(0.28, 0.28, 0.6, 8)} c={PAL.woodDark} p={[1.4, 0.3, -0.05]} />
      </Baked>
      {damaged
        ? <Smoke origin={chimneyTop(W, D, H, RH)} color={DARK_SMOKE} count={4} size={0.24} speed={0.2} rise={2.2} />
        : <Smoke origin={chimneyTop(W, D, H, RH)} />}
    </group>
  );
}
