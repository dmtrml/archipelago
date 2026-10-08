import { asset } from '../asset';
import type { SynthRecipe } from './synth';

export type AudioBus = 'music' | 'sfx' | 'ambience';

export interface CueDefinition {
  bus: AudioBus;
  synth: SynthRecipe;
  volume: number;
  files?: string[];
  pitchJitter?: number;
  cooldownMs?: number;
  maxVoices?: number;
  label: string;
  group: string;
}

const effect = (name: string, label: string, group: string, duration = 0.7,
  volume = 0.7, cooldownMs = 80, maxVoices = 3): CueDefinition => ({
  bus: 'sfx', synth: { kind: 'effect', name, duration }, label, group,
  volume, cooldownMs, maxVoices, pitchJitter: 0.035,
});

const ambience = (name: string, label: string, loop = true,
  duration = 4, volume = 0.5): CueDefinition => ({
  bus: 'ambience', synth: { kind: 'ambience', name, duration, loop },
  label, group: 'Природа', volume, maxVoices: 2,
  cooldownMs: loop ? 0 : 1500, pitchJitter: loop ? 0 : 0.04,
});

const music = (name: string, label: string, group = 'Музыка', duration = 24): CueDefinition => ({
  bus: 'music', synth: { kind: 'music', name, duration }, label, group,
  volume: 0.55, maxVoices: 2, cooldownMs: 300,
});

/** Every file has a licensed source in CREDITS.md; recipes remain the offline fallback. */
const catalog = {
  'ui.click': effect('ui.click', 'Кнопка — деревянный тук', 'Интерфейс', 0.13, 0.65, 60),
  'ui.toggle': effect('ui.toggle', 'Переключатель — щелчок', 'Интерфейс', 0.14, 0.6),
  'ui.error': effect('ui.error', 'Отказ — два низких тука', 'Интерфейс', 0.35, 0.6),
  'ui.open': effect('ui.open', 'Окно — шелест бумаги', 'Интерфейс', 0.3, 0.5),

  'coins.pay': effect('coins.pay', 'Покупка — монетки вниз', 'Действия', 0.55, 0.65),
  'coins.get': effect('coins.get', 'Доход — монетки вверх', 'Действия', 0.65, 0.65),
  'build.pop': effect('build.pop', 'Постройка — пружинка и стук', 'Действия', 0.55),
  'status.joy': effect('status.joy', 'Статусная вещь — уютный аккорд', 'Действия', 0.85, 0.55),
  'build.remove': effect('build.remove', 'Продажа — вжух вниз', 'Действия', 0.35, 0.6),
  upgrade: effect('upgrade', 'Улучшение — молоточки и звон', 'Действия', 1.1),
  repair: effect('repair', 'Ремонт — два удара молотка', 'Действия', 0.55),
  'loan.take': effect('loan.take', 'Кредит — бумага и штамп', 'Действия', 0.55, 0.6),
  'loan.repay': effect('loan.repay', 'Погашение — штамп и облегчение', 'Действия', 0.9, 0.6),
  study: effect('study', 'Учёба — страница и звон', 'Действия', 0.8, 0.55),
  rest: effect('rest', 'Отдых', 'Действия', 1.15, 0.5),
  'shift.on': effect('shift.on', 'Подработка — два тика часов', 'Действия', 0.4, 0.6),
  'job.quit': effect('job.quit', 'Уход с работы — светлый аккорд', 'Действия', 1, 0.6),
  'job.return': effect('job.return', 'На работу — две ноты вниз', 'Действия', 0.85, 0.6),
  'dream.start': effect('dream.start', 'Мечта — пила и молоток', 'Действия', 0.85, 0.6),

  'week.next': effect('week.next', 'Следующая неделя — корабельный колокол', 'Неделя', 0.9, 0.6),
  'coin.tick': { ...effect('coin.tick', 'Доход недели — монетка', 'Неделя', 0.3, 0.45, 0, 8), pitchJitter: 0 },
  'coin.minus': { ...effect('coin.minus', 'Расход недели — низкая монетка', 'Неделя', 0.28, 0.35, 0, 8), pitchJitter: 0 },

  'event.good': effect('event.good', 'Хорошая новость — светлый звон', 'События', 0.9, 0.6),
  'event.bad': effect('event.bad', 'Плохая новость — мягкий удар', 'События', 0.65, 0.6),
  storm: effect('storm', 'Шторм — далёкий раскат', 'События', 2.4, 0.65, 1200, 1),
  'scam.collapse': effect('scam.collapse', 'Афера — пузыри и ноты вниз', 'События', 1.25, 0.65),
  'loan.emergency': effect('loan.emergency', 'Экстренный кредит — низкий колокол', 'События', 1.1, 0.65),
  threat: effect('threat', 'Угроза свободе — четыре мягких тика', 'События', 1.3, 0.6),
  'neighbor.free': effect('neighbor.free', 'Свобода соседа — далёкий звон', 'События', 1.3, 0.45),

  freedom: effect('freedom', 'Свобода — тёплая фанфара', 'Вехи', 2.7, 0.75, 1000, 1),
  'freedom.level': effect('freedom.level', 'Уровень свободы — ступенька вверх', 'Вехи', 1.1, 0.65),
  'dream.stage': effect('dream.stage', 'Этап мечты — молоток и колокольчик', 'Вехи', 1.2, 0.65),
  'dream.launch': effect('dream.launch', 'Шхуна — колокола, всплеск и чайки', 'Вехи', 2.9, 0.7, 1000, 1),
  epilogue: music('music.epilogue', 'Эпилог — короткая тема', 'Вехи', 7.5),

  'amb.sea': ambience('amb.sea', 'Волны — тихий прибой'),
  'amb.wind': ambience('amb.wind', 'Ветер — шелест пальм', true, 4, 0.35),
  'amb.gulls': ambience('amb.gulls', 'Чайки — короткий крик', false, 1.45, 0.35),
  'amb.rain': ambience('amb.rain', 'Шторм — дождь', true, 4, 0.45),
  'amb.thunder': ambience('amb.thunder', 'Шторм — мягкий гром', false, 2.8, 0.65),

  'music.island': music('music.island', 'Остров — уютная тема'),
  'music.free': music('music.free', 'Свобода — светлая тема'),
  'music.epilogue': music('music.epilogue', 'Эпилог — завершение', 'Музыка', 7.5),
} satisfies Record<string, CueDefinition>;

export type CueId = keyof typeof catalog;
export const CUES: Record<CueId, CueDefinition> = catalog;
export const CUE_IDS = Object.keys(CUES) as CueId[];

for (const cue of CUE_IDS) {
  if (CUES[cue].bus !== 'music') {
    const directory = CUES[cue].bus === 'sfx' ? 'sfx' : 'ambience';
    CUES[cue].files = [asset(`audio/${directory}/${cue.replaceAll('.', '-')}.mp3`)];
  }
}
CUES['ui.click'].files!.push(asset('audio/sfx/ui-click-2.mp3'));
CUES['music.island'].files = [asset('audio/music/island-ukulele.mp3'), asset('audio/music/island-sicilian.mp3')];
CUES['music.free'].files = [asset('audio/music/free-apple-cider.mp3')];
CUES['music.epilogue'].files = CUES.epilogue.files = [asset('audio/music/epilogue-forest.mp3')];
