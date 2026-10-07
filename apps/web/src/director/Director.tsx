import { lazy, Suspense, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { ASSET_DEFS, financeView, offerViews, type WorldState } from '@arch/engine';
import { asset } from '../asset';
import { audio } from '../audio/engine';
import type { CueId } from '../audio/cues';
import { getI18n, useLanguage } from '../i18n';
import { IslandScene } from '../scene/IslandScene';
import type { DreamProgress, FloatLabel, PlacedItem } from '../scene/contract';
import fixturesData from './fixtures.json';
import { BEAT, EDIT, SHOTS, cameraAt, type ShotId, type TrailerFormat, type TrailerLang } from './shots';
import './director.css';

const App = lazy(() => import('../App'));
type CueEntry = { t: number; cue: CueId; pitchStep?: number; variant?: number } | { t: number; weather: 'clear' | 'storm' };
type CaptionFrame = { visible: boolean; top: number | null; modalOverlap: boolean };
type Save = { world: WorldState; news: unknown[]; history: Record<string, unknown[]> };
type Fixtures = { seed:number; F:number; S:number; N:number; heroItemsByWeek:PlacedItem[][]; scamCard:Save; scamCollapse:Save; neighbors:Save; freedom:Save };
const fixtures = fixturesData as unknown as Fixtures;
const DIRECTOR_EDIT = { ...EDIT, shotSpecs: SHOTS };

const hookChanges = (() => {
  const changes: PlacedItem[][] = [];
  let working = structuredClone(fixtures.heroItemsByWeek[0] ?? []) as PlacedItem[];
  for (let week = 1; week <= 100; week++) {
    const target = fixtures.heroItemsByWeek[week] ?? [];
    const targetIds = new Set(target.map((item) => item.uid));
    // Исчезновения идут в прежнем порядке данных, затем появления/уровни — в новом.
    for (const old of [...working]) {
      if (targetIds.has(old.uid)) continue;
      working = working.filter((item) => item.uid !== old.uid);
      changes.push(structuredClone(working));
    }
    for (const item of target) {
      const index = working.findIndex((old) => old.uid === item.uid);
      if (index < 0) {
        working.push(structuredClone(item));
        changes.push(structuredClone(working));
      } else if (working[index].level !== item.level) {
        working[index] = { ...working[index], level: item.level };
        changes.push(structuredClone(working));
      }
    }
  }
  return changes;
})();

declare global {
  interface Window {
    __director: { ready:boolean; shotReady:boolean; start():void; cueLog:CueEntry[]; captionLog:CaptionFrame[]; captureCaption():CaptionFrame; edit:typeof DIRECTOR_EDIT; errors:string[]; frameOffset:number; renderCue?: (cue:CueId,pitchStep?:number,variant?:number)=>Promise<number[][]> };
  }
}

const director: Window['__director'] = window.__director = {
  ready: false,
  shotReady: false,
  start() {},
  cueLog: [],
  captionLog: [],
  captureCaption() {
    const caption = document.querySelector<HTMLElement>('.director-caption:not([data-director-measure])');
    const modal = document.querySelector<HTMLElement>('.modal');
    const rect = caption?.getBoundingClientRect();
    const modalRect = modal?.getBoundingClientRect();
    const modalOverlap = !!(rect && modalRect
      && rect.right > modalRect.left && rect.left < modalRect.right
      && rect.bottom > modalRect.top && rect.top < modalRect.bottom);
    const frame = { visible: !!rect, top: rect?.top ?? null, modalOverlap };
    director.captionLog.push(frame);
    return frame;
  },
  edit: DIRECTOR_EDIT,
  errors: [],
  frameOffset: 0,
};
let directorSeconds = 0;
let started = false;
let startAt = 0;
const startHandlers = new Set<() => void>();
const directorNow = () => started ? (performance.now() - startAt) / 1000 : directorSeconds;
audio.getScene = (() => null) as typeof audio.getScene;
audio.subscribeScene = (() => () => {}) as typeof audio.subscribeScene;
audio.unlock = (() => {}) as typeof audio.unlock;
audio.audition = (async () => false) as typeof audio.audition;
audio.play = ((cue: CueId, options: { delayMs?:number; pitchStep?:number; variant?:number } = {}) => {
  director.cueLog.push({ t: directorNow() + (options.delayMs ?? 0) / 1000, cue, ...(options.pitchStep === undefined ? {} : { pitchStep: options.pitchStep }), ...(options.variant === undefined ? {} : { variant: options.variant }) });
  return true;
}) as typeof audio.play;
audio.setWeather = ((weather:'clear'|'storm') => { director.cueLog.push({ t:directorNow(), weather }); }) as typeof audio.setWeather;
audio.setScene = (() => {}) as typeof audio.setScene; audio.setAmbience = (() => {}) as typeof audio.setAmbience; audio.duck = (() => {}) as typeof audio.duck; audio.stop = (() => {}) as typeof audio.stop; audio.unlock = (() => {}) as typeof audio.unlock;
audio.snapshot = (() => ({
  contextState: 'locked', scene: null, weather: 'clear', ambience: false, voices: [],
  pending: 0, master: 0, buses: null,
})) as typeof audio.snapshot;

window.addEventListener('error', (e) => director.errors.push(String(e.error?.message ?? e.message)));
window.addEventListener('unhandledrejection', (e) => director.errors.push(String(e.reason?.message ?? e.reason)));

function setFixture(save: Save, lang: TrailerLang) {
  const copy = structuredClone(save) as Save;
  copy.world.players[0].name = lang === 'ru' ? 'Вы' : 'You';
  copy.world.players[0].islandName = lang === 'ru' ? 'Лагуна' : 'Lagoon';
  localStorage.setItem('archipelago.director.save', JSON.stringify(copy));
  localStorage.setItem('archipelago.coach.v1', 'done');
  localStorage.setItem('archipelago.lang.v1', lang);
  useLanguage.getState().setLang(lang);
}

function captionHtml(text:string) {
  return { __html: text.replace(/\*\*(.+?)\*\*/g, (_, word) => `<span class="${/Пассив|Liabil/.test(word) ? 'liability' : 'asset'}">${word}</span>`) };
}

const clamp01 = (value:number) => Math.max(0, Math.min(1, value));
function cubicBezierEase(t:number) {
  const x1=.2, y1=.9, x2=.3, y2=1.2;
  const sample=(u:number,a:number,b:number)=>3*(1-u)*(1-u)*u*a+3*(1-u)*u*u*b+u*u*u;
  let lo=0, hi=1;
  for(let i=0;i<12;i++){const mid=(lo+hi)/2;if(sample(mid,x1,x2)<t)lo=mid;else hi=mid;}
  return sample((lo+hi)/2,y1,y2);
}

function captionStyle(format:TrailerFormat, kind:'scene'|'game', sec:number, startSec:number, endSec:number):CSSProperties|null {
  if(sec<startSec||sec>endSec)return null;
  const enter=cubicBezierEase(clamp01((sec-startSec)/.28));
  const leave=clamp01((endSec-sec)/.18);
  const opacity=Math.min(1,Math.max(0,Math.min(enter,leave)));
  const progress=Math.min(1,Math.max(0,enter));
  const style:CSSProperties={opacity,transform:`translateX(-50%) translateY(${12*(1-progress)}px) scale(${.96+.04*progress})`};
  const headerBottom=document.querySelector('.top')?.getBoundingClientRect().bottom??0;
  const defaultTop=format==='v'?(kind==='scene'?innerHeight*.13:headerBottom+14):null;
  if(defaultTop!==null)style.top=defaultTop;
  else style.bottom='9%';
  const modal=document.querySelector('.modal')?.getBoundingClientRect();
  const measure=document.querySelector<HTMLElement>('.director-caption[data-director-measure]')?.getBoundingClientRect();
  if(modal&&measure&&measure.width>0&&measure.height>0) {
    const top=defaultTop??innerHeight*.91-measure.height;
    const left=(innerWidth-measure.width)/2;
    const right=left+measure.width;
    const bottom=top+measure.height;
    const overlap=right>modal.left&&left<modal.right&&bottom>modal.top&&top<modal.bottom;
    if(overlap) {
      const minTop=format==='v'?headerBottom+14:16;
      const maxBottom=format==='v'?innerHeight*.8:innerHeight-16;
      const aboveSpace=modal.top-16-minTop;
      const belowSpace=maxBottom-(modal.bottom+16);
      if(Math.max(aboveSpace,belowSpace)<measure.height)return null;
      delete style.bottom;
      style.top=aboveSpace>=belowSpace?modal.top-16-measure.height:modal.bottom+16;
    }
  }
  return style;
}

function useClock() {
  const [, bump] = useState(0);
  useEffect(() => {
    let id=0; const tick=(now:number)=>{ if (started) directorSeconds=(now-startAt)/1000; bump((v)=>v+1); id=requestAnimationFrame(tick); }; id=requestAnimationFrame(tick); return()=>cancelAnimationFrame(id);
  }, []);
  return directorSeconds;
}

function useDirectorStart(handler: () => void, deps: readonly unknown[]) {
  useEffect(() => {
    startHandlers.add(handler);
    return () => { startHandlers.delete(handler); };
    // The caller provides the values that define the scheduled shot.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}

function hookTimeline(durationBeats: number) {
  const last = Math.max(1, hookChanges.length - 1);
  return hookChanges.map((items, index) => ({
    items,
    beat: .5 + (durationBeats - 1) * (index / last),
  }));
}

function sceneState(id:ShotId, beats:number, durationBeats:number) {
  const boat:PlacedItem={uid:'director-boat',model:'boat',slot:'pier',slotIndex:0,damaged:false,level:1};
  let items:PlacedItem[]=[]; let floats:FloatLabel[]=[]; let weather:'clear'|'storm'='clear'; let dream:DreamProgress|null=null;
  if (id==='hook') {
    const timeline = hookTimeline(durationBeats);
    const current = [...timeline].reverse().find((entry) => beats >= entry.beat);
    items = current?.items ?? (fixtures.heroItemsByWeek[0] ?? []);
  }
  if (id==='asset') { if(beats>=.5)items=[boat]; if(beats>=1.25&&beats<2.8)floats=[{id:'a1',anchor:boat.uid,text:`+20 ${getI18n().t.ui.store.perWeek}`,tone:'pos'}]; if(beats>=3.5)floats=[{id:'a2',anchor:boat.uid,text:'+20',tone:'pos'}]; }
  if (id==='upgrade') { items=[{...boat,level:beats>=3.5?3:beats>=1?2:1}]; if(beats>=1.8&&beats<3.4)floats=[{id:'u1',anchor:boat.uid,text:`+12 ${getI18n().t.ui.store.perWeek}`,tone:'pos'}]; if(beats>=4.3)floats=[{id:'u2',anchor:boat.uid,text:`+8 ${getI18n().t.ui.store.perWeek}`,tone:'pos'}]; }
  if (id==='liability') { items=[...(fixtures.heroItemsByWeek[12]??[])]; if(beats>=.5)items.push({uid:'director-statue',model:'statue',slot:'plaza',slotIndex:0,damaged:false,level:1}); if(beats>=2.5)items.push({uid:'director-yacht',model:'yacht',slot:'sea',slotIndex:0,damaged:false,level:1}); if(beats>=1.25&&beats<2.4)floats=[{id:'l1',anchor:'director-statue',text:`−${ASSET_DEFS.statue.upkeep} ${getI18n().t.ui.store.perWeek}`,tone:'neg'}]; if(beats>=3.25&&beats<4.4)floats=[{id:'l2',anchor:'director-yacht',text:`−${ASSET_DEFS.yacht.upkeep} ${getI18n().t.ui.store.perWeek}`,tone:'neg'}]; if(beats>=4.75)floats=[{id:'l3',anchor:'director-statue',text:`−${ASSET_DEFS.statue.upkeep}`,tone:'neg'},{id:'l4',anchor:'director-yacht',text:`−${ASSET_DEFS.yacht.upkeep}`,tone:'neg'}]; }
  if (id==='storm') { items=(fixtures.heroItemsByWeek[fixtures.F]??[]).map((x)=>({...x,damaged:beats>=.5&&x.model==='boat'?true:x.damaged})); weather='storm'; }
  if (id==='dream'||id==='end') { items=fixtures.heroItemsByWeek[id==='end'?100:fixtures.F]??[]; if(id==='end'||beats>=3.5)dream={built:3,building:false,stages:3}; else if(beats>=2)dream={built:2,building:true,stages:3}; else if(beats>=.5)dream={built:1,building:true,stages:3}; else dream={built:0,building:true,stages:3}; }
  return {items,floats,weather,dream};
}

function SceneShot({id,format,durationBeats}:{id:ShotId;format:TrailerFormat;durationBeats:number}) {
  const rawSec=useClock(), sec=rawSec-director.frameOffset, beats=sec/BEAT; const spec=SHOTS[id]; const state=sceneState(id,beats,durationBeats); const progress=Math.min(1,Math.max(0,sec/(durationBeats*BEAT)));
  useDirectorStart(() => {
    const cue=(beat:number,name:CueId,pitchStep?:number)=>audio.play(name,{pitchStep,delayMs:(beat*BEAT+director.frameOffset)*1000});
    if(id==='hook'){
      const halves = new Map<number, number>();
      for (const change of hookTimeline(durationBeats)) {
        const half = Math.max(0, Math.floor((change.beat - .5) * 2 + 1e-6));
        if (!halves.has(half)) halves.set(half, change.beat);
      }
      for (const [half, beat] of halves) cue(beat, 'build.pop', Math.min(7, half));
    }
    if(id==='asset'){cue(.5,'coins.pay');cue(.5+.07/BEAT,'build.pop');cue(3,'week.next');cue(3.5,'coin.tick',0)}
    if(id==='upgrade'){cue(1,'coins.pay');cue(1+.2/BEAT,'upgrade');cue(3.5,'coins.pay');cue(3.5+.2/BEAT,'upgrade')}
    if(id==='liability'){for(const b of [.5,2.5]){cue(b,'coins.pay');cue(b+.07/BEAT,'build.pop');cue(b+.16/BEAT,'status.joy')}cue(4.5,'week.next');cue(4.75,'coin.minus');cue(5,'coin.minus')}
    if(id==='storm'){cue(0,'storm');director.cueLog.push({t:director.frameOffset,weather:'storm'})}
    if(id==='dream'){cue(.5,'dream.stage');cue(2,'dream.stage');cue(3.5,'dream.launch')}
  }, [id,durationBeats]);
  return <div id="director-stage"><IslandScene {...state} cameraPose={()=>cameraAt(spec,progress,format)} dpr={window.devicePixelRatio}/><SceneReady/></div>;
}

function EndCard({lang,format,durationBeats}:{lang:TrailerLang;format:TrailerFormat;durationBeats:number}) {
  const rawSec=useClock(); const sec=rawSec-director.frameOffset; const beats=sec/BEAT;
  useDirectorStart(() => { audio.play('freedom.level',{delayMs:(.25*BEAT+director.frameOffset)*1000}); }, [durationBeats]);
  const cardStart=.25*BEAT;
  const cardEase=cubicBezierEase(clamp01((sec-cardStart)/.4));
  const cardStyle:CSSProperties={
    opacity:clamp01(cardEase),
    transform:`translate(-50%,-50%) translateY(${14*(1-cardEase)}px) scale(${.98+.02*cardEase})`,
  };
  return <><SceneShot id="end" format={format} durationBeats={durationBeats}/><div className="director-dim" style={{opacity:Math.min(1,beats/.5)}}/><div className="director-end-card" style={cardStyle}><img src={asset('favicon.svg')}/><div className="director-end-title">{lang==='ru'?'Архипелаг':'Archipelago'}</div><div className="director-end-sub">{lang==='ru'?'Уютная игра про деньги и свободу':'A cozy game about money and freedom'}</div><div className="director-end-cta">{lang==='ru'?'Играйте бесплатно в браузере':'Play free in your browser'}</div><div className="director-end-url">dmtrml.github.io/archipelago{lang==='en'?'/en':''}</div><div className="director-end-bio">{lang==='ru'?'Ссылка — в профиле':'Link in bio'}</div></div></>;
}

function GameShot({id,lang,durationBeats}:{id:ShotId;lang:TrailerLang;durationBeats:number}) {
  const save=id==='scam-card'?fixtures.scamCard:id==='scam-collapse'?fixtures.scamCollapse:id==='neighbors'?fixtures.neighbors:fixtures.freedom;
  useMemo(()=>setFixture(save,lang),[save,lang]);
  const rawSec=useClock(), sec=rawSec-director.frameOffset;
  const storeRef=useRef<Awaited<typeof import('../store')>['useGame']|null>(null);
  const timers=useRef<number[]>([]);
  const [storeReady,setStoreReady]=useState(false);
  useEffect(()=>{ let cancelled=false;setStoreReady(false); void import('../store').then(({useGame})=>{if(cancelled)return;storeRef.current=useGame;const s=useGame.getState();s.setTab('deals');s.setSheetOpen(id==='scam-card');setStoreReady(true)}); return()=>{cancelled=true;storeRef.current=null;timers.current.forEach(clearTimeout);timers.current=[]};},[id]);
  useDirectorStart(() => {
    const useGame=storeRef.current;if(!useGame){director.errors.push(`${id}: game store not ready at start`);return}
    const schedule=(beat:number,run:()=>void)=>{const at=beat*BEAT+director.frameOffset;const timer=window.setTimeout(run,Math.max(0,at*1000));timers.current.push(timer)};
    if(id==='scam-card'){
      const clickBeat=durationBeats-.75,buyBeat=clickBeat+.1/BEAT;
      schedule(clickBeat,()=>audio.play('ui.click'));
      schedule(buyBeat,()=>{const current=useGame.getState();const v=offerViews(current.world!,'p1').find(x=>x.def.id==='pearlFarm');if(v)current.act({type:'buyOffer',playerId:'p1',offerUid:v.offer.uid},getI18n().t.ui.deals.bought(getI18n().t.assets.pearlFarm.title))});
    }
    if(id==='scam-collapse'||id==='neighbors'||id==='freedom')schedule(id==='neighbors'?.5:.25,()=>useGame.getState().endWeek());
    if(id==='neighbors')schedule(3,()=>{const current=useGame.getState();const bots=current.world!.players.filter(p=>p.isBot).sort((a,b)=>financeView(current.world!,b.id).freedomRatio-financeView(current.world!,a.id).freedomRatio);current.showNeighbor(bots[0]?.id??null)});
  }, [id,durationBeats]);
  useEffect(()=>{if(id!=='scam-card')return;let cancelled=false;const center=()=>{if(cancelled)return;const el=document.querySelector('[data-offer="pearlFarm"]');if(el){el.scrollIntoView({block:'center'});return;}requestAnimationFrame(center);};requestAnimationFrame(center);return()=>{cancelled=true};},[id]);
  const originRef=useRef<string|null>(null);
  if(id==='scam-card'&&!originRef.current){const card=document.querySelector('[data-offer="pearlFarm"]')?.getBoundingClientRect();if(card)originRef.current=`${card.left+card.width/2}px ${card.top+card.height/2}px`;}
  const zoom=id==='scam-card'?1+.08*Math.max(0,Math.min(1,sec/(durationBeats*BEAT))):1; const origin=originRef.current??'center';
  return <div id="director-stage" style={{transform:`scale(${zoom})`,transformOrigin:origin}}><Suspense fallback={null}><App/>{storeReady&&<ShotReady/>}</Suspense></div>;
}

function ShotReady() {
  useEffect(() => {
    const frame=requestAnimationFrame(()=>{director.shotReady=true});
    return()=>cancelAnimationFrame(frame);
  }, []);
  return null;
}

function SceneReady() {
  useEffect(() => {
    let second = 0;
    const first = requestAnimationFrame(() => {
      second = requestAnimationFrame(() => { director.shotReady = true; });
    });
    return () => {
      cancelAnimationFrame(first);
      if (second) cancelAnimationFrame(second);
    };
  }, []);
  return null;
}

function ClickIndicator({durationBeats}:{durationBeats:number}) { const sec=useClock()-director.frameOffset, beats=sec/BEAT; if(beats<durationBeats-.75||beats>durationBeats-.75+.35/BEAT)return null; const button=document.querySelector('[data-offer="pearlFarm"] .btn.primary')?.getBoundingClientRect(); if(!button)return null; const p=(beats-(durationBeats-.75))/(.35/BEAT); return <div className="director-click" style={{left:button.left+button.width/2,top:button.top+button.height/2,transform:`scale(${1+1.4*p})`,opacity:.9*(1-p)}}/> }

function AudioPage(){ useEffect(()=>{director.ready=true; director.renderCue=async(cue,pitchStep=0,variant=0)=>{const [{CUES},{DEFAULT_AUDIO_SOURCES},{synthesize}]=await Promise.all([import('../audio/cues'),import('../audio/defaultSources'),import('../audio/synth')]);const def=CUES[cue];const pitch=2**(pitchStep/12);const useFile=DEFAULT_AUDIO_SOURCES[cue]==='file'&&!!def.files?.length;const seconds=useFile?5:Math.max(def.synth.duration+0.35,.5);const ctx=new OfflineAudioContext(2,Math.ceil(48000*seconds),48000);const gain=ctx.createGain();gain.gain.value=def.volume;gain.connect(ctx.destination);if(useFile){const file=def.files![Math.abs(Math.floor(variant))%def.files!.length];const response=await fetch(file);if(!response.ok)throw new Error(`director audio ${cue}: ${response.status}`);const decoded=await ctx.decodeAudioData(await response.arrayBuffer());const source=ctx.createBufferSource();source.buffer=decoded;source.playbackRate.value=pitch;source.connect(gain);source.start(0);}else{synthesize(ctx,gain,def.synth,pitch,variant);}const out=await ctx.startRendering();return [Array.from(out.getChannelData(0)),Array.from(out.getChannelData(1))];};},[]);return <div className="director-audio">director audio</div>}

export default function Director(){
  const params=new URLSearchParams(location.search); const editOnly=params.has('edit'),audioOnly=params.has('audio'); const id=(params.get('shot')||'hook') as ShotId; const format=(params.get('format')==='h'?'h':'v') as TrailerFormat; const lang=(params.get('lang')==='en'?'en':'ru') as TrailerLang;
  const entry=(format==='v'?EDIT.v30:EDIT.h45).shots.find(([shot])=>shot===id); const durationBeats=entry?entry[2]-entry[1]:4;
  useMemo(()=>{localStorage.setItem('archipelago.lang.v1',lang);useLanguage.getState().setLang(lang);},[lang]);
  const sec=useClock()-director.frameOffset;
  useEffect(()=>{director.ready=false;director.shotReady=false;director.errors.length=0;director.cueLog.length=0;director.captionLog.length=0;started=false;directorSeconds=0;director.frameOffset=0;director.start=()=>{started=true;startAt=performance.now();directorSeconds=0;director.captionLog.length=0;for(const handler of startHandlers)handler()}; if(editOnly||audioOnly){director.ready=true;return;} let cancelled=false;(async()=>{await Promise.all([document.fonts.load('700 20px Unbounded'),document.fonts.load('800 16px Manrope')]);await document.fonts.ready;if(cancelled)return; if(!document.fonts.check('700 20px Unbounded'))director.errors.push('Unbounded 700 unavailable');if(!document.fonts.check('800 16px Manrope'))director.errors.push('Manrope 800 unavailable');for(let i=0;i<180&&!director.shotReady&&!cancelled;i++)await new Promise<void>(r=>requestAnimationFrame(()=>r()));if(!cancelled&&!director.shotReady)director.errors.push(`${id}: first frame not ready`);if(!cancelled)director.ready=director.errors.length===0;})();return()=>{cancelled=true};},[id,editOnly,audioOnly]);
  if(editOnly)return <div className="director-audio">edit ready</div>; if(audioOnly)return <AudioPage/>;
  const spec=SHOTS[id]; const showCaption=spec.caption&&id!=='end'; const captionStartSec=id==='scam-collapse'?.25*BEAT+1.2:(id==='asset'||id==='liability'?.5:.25)*BEAT; const captionEndSec=(durationBeats-.25)*BEAT; const modalOpen=id==='freedom'&&!!document.querySelector('.modal'); const capStyle=showCaption&&!modalOpen?captionStyle(format,spec.kind,sec,captionStartSec,captionEndSec):null;
  return <div className={`director-root ${format==='v'?'vertical':'horizontal'} ${spec.kind}`}>{id==='end'?<EndCard lang={lang} format={format} durationBeats={durationBeats}/>:spec.kind==='scene'?<SceneShot id={id} format={format} durationBeats={durationBeats}/>:<GameShot id={id} lang={lang} durationBeats={durationBeats}/>} {showCaption&&<div className="director-caption" data-director-measure aria-hidden="true" style={{visibility:'hidden',top:0,pointerEvents:'none'}} dangerouslySetInnerHTML={captionHtml(spec.caption![lang])}/>} {capStyle&&<div className="director-caption" style={capStyle} dangerouslySetInnerHTML={captionHtml(spec.caption![lang])}/>} {id==='scam-card'&&<ClickIndicator durationBeats={durationBeats}/>}</div>;
}
