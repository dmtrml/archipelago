import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const require = createRequire(import.meta.url);
const ffmpeg = process.env.FFMPEG_PATH || require('ffmpeg-static') || 'ffmpeg';
const music = resolve(root, 'apps/web/public/audio/music/island-ukulele.mp3');

export function measureBeats(input = music) {
  const rate = 22050, hop = 256, win = 512;
  const run = spawnSync(ffmpeg, ['-v','error','-i',input,'-ac','1','-ar',String(rate),'-f','f32le','pipe:1'], { maxBuffer: 128 * 1024 * 1024 });
  if (run.status !== 0) throw new Error(run.stderr.toString());
  const pcm = new Float32Array(run.stdout.buffer, run.stdout.byteOffset, Math.floor(run.stdout.byteLength / 4));
  const energy = [];
  for (let start = 0; start + win <= pcm.length; start += hop) {
    let sum = 0; for (let i = 0; i < win; i++) sum += pcm[start+i] * pcm[start+i];
    energy.push(Math.log(1e-9 + Math.sqrt(sum / win)));
  }
  const flux = energy.map((v,i)=>i ? Math.max(0,v-energy[i-1]) : 0);
  let bpm = 99, best = -Infinity, phase = 0;
  const limit = Math.min(flux.length, 45 * rate / hop);
  for (let candidate=90; candidate<=110.0001; candidate+=0.05) {
    const period = 60 * rate / (candidate * hop);
    for (let p=0; p<Math.ceil(period); p++) {
      let score=0, count=0;
      for(let k=0;p+k*period<limit;k++) { const at=Math.round(p+k*period); score += flux[at] * (1/(1+k*.006)); count++; }
      score /= Math.sqrt(Math.max(1,count));
      if(score>best){best=score;bpm=+candidate.toFixed(2);phase=p;}
    }
  }
  return { bpm, firstBeat: +(phase * hop / rate).toFixed(3), beatSeconds: 60 / bpm };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const result = measureBeats(process.argv[2] ? resolve(process.argv[2]) : music);
  console.log(JSON.stringify(result,null,2));
  if (Math.abs(result.bpm - 99) > 0.05 || Math.abs(result.firstBeat - 0.023) > 0.02) process.exitCode=1;
}
