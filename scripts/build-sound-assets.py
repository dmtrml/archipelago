"""Rebuild licensed audio adaptations from scripts/audio-sources.json.

Requires Python + numpy, ffmpeg and ffprobe on PATH. Downloads stay in ignored
node_modules/.cache/sound-files/raw; only final MP3s belong in public/audio.
Use --fetch to download verified sources, or --check to inspect existing MP3s.
"""
import argparse
import hashlib
import json
import math
import subprocess
import urllib.request
import zipfile
from pathlib import Path

import numpy as np

ROOT = Path(__file__).resolve().parents[1]
RAW = ROOT / 'node_modules/.cache/sound-files/raw'
PUBLIC = ROOT / 'apps/web/public/audio'
RATE = 44100
PEAK = 10 ** (-4 / 20)  # Leave headroom for lossy MP3 reconstruction.


def run(*args, data=None):
    result = subprocess.run(args, input=data, stdout=subprocess.PIPE,
                            stderr=subprocess.PIPE, check=True)
    return result.stdout


def decode(path, channels=1, start=0, seconds=None):
    args = ['ffmpeg', '-v', 'error', '-ss', str(start), '-i', str(path)]
    if seconds is not None:
        args += ['-t', str(seconds)]
    data = run(*args, '-ac', str(channels), '-ar', str(RATE), '-f', 'f32le', '-')
    return np.frombuffer(data, dtype='<f4').reshape(-1, channels).copy()


def fade(signal, attack=.005, release=.035):
    signal = signal.copy()
    a, r = min(len(signal), int(attack * RATE)), min(len(signal), int(release * RATE))
    if a:
        signal[:a] *= np.linspace(0, 1, a)[:, None]
    if r:
        signal[-r:] *= np.linspace(1, 0, r)[:, None]
    return signal


def normalize(signal, rms_db):
    assert len(signal) and np.isfinite(signal).all(), 'Empty or nonfinite source'
    rms = float(np.sqrt(np.mean(signal.astype(np.float64) ** 2)))
    peak = float(np.abs(signal).max())
    assert rms > 1e-7, 'Silent source'
    return signal * min(10 ** (rms_db / 20) / rms, PEAK / peak)


def fetch(sources):
    for source in sources.values():
        path = RAW / source['raw']
        if not path.exists():
            path.parent.mkdir(parents=True, exist_ok=True)
            request = urllib.request.Request(source['download'], headers={'User-Agent': 'Archipelago audio asset preparation'})
            with urllib.request.urlopen(request, timeout=90) as response:
                path.write_bytes(response.read())
        if source.get('sha256'):
            assert hashlib.sha256(path.read_bytes()).hexdigest() == source['sha256'], f'Changed source: {path}'
        if source.get('extract'):
            target = (RAW / source['extract']).resolve()
            with zipfile.ZipFile(path) as archive:
                for entry in archive.infolist():
                    destination = (target / entry.filename).resolve()
                    assert destination.is_relative_to(target), f'Unsafe archive entry: {entry.filename}'
                archive.extractall(target)


def source_path(sources, part):
    source = sources[part['source']]
    return RAW / (source['extract'] if 'file' in part else source['raw']) / part.get('file', '')


def render(asset, sources):
    channels = asset.get('channels', 1)
    if asset['kind'] == 'effect':
        layers, length = [], 0
        for part in asset['parts']:
            signal = decode(source_path(sources, part), channels, part.get('start', 0), part.get('seconds'))
            speed = 2 ** (part.get('semitones', 0) / 12)
            if speed != 1:
                positions = np.arange(0, len(signal) - 1, speed)
                signal = np.stack([np.interp(positions, np.arange(len(signal)), signal[:, c]) for c in range(channels)], axis=1)
            signal = fade(signal, part.get('attack', .005), part.get('release', .04)) * part.get('gain', 1)
            offset = int(part.get('at', 0) * RATE)
            layers.append((offset, signal))
            length = max(length, offset + len(signal))
        result = np.zeros((length, channels), dtype=np.float32)
        for offset, signal in layers:
            result[offset:offset + len(signal)] += signal
        return normalize(fade(result), asset.get('rmsDb', -22))
    part = asset['parts'][0]
    if asset['kind'] == 'loop':
        seconds, overlap = asset['seconds'], asset.get('crossfade', 5)
        signal = decode(source_path(sources, part), channels, part.get('start', 0), seconds + overlap)
        needed = round((seconds + overlap) * RATE)
        if len(signal) < needed:
            # Source rain loops may be shorter than 35s; repeat before circularizing.
            signal = np.tile(signal, (math.ceil(needed / len(signal)), 1))
        signal = signal[:needed]
        n = round(overlap * RATE)
        phase = np.linspace(0, math.pi / 2, n)[:, None]
        seam = signal[-n:] * np.cos(phase) + signal[:n] * np.sin(phase)
        return normalize(np.concatenate([signal[n:-n], seam]), asset.get('rmsDb', -27))
    segments = []
    for part in asset['parts']:
        signal = decode(source_path(sources, part), channels, part.get('start', 0), part.get('seconds'))
        if part.get('repeat', 1) > 1:
            signal = np.tile(signal, (part['repeat'], 1))
        segments.append(signal)
    return normalize(fade(np.concatenate(segments), .05, asset.get('release', 1.5)), asset.get('rmsDb', -26))


def inspect(asset):
    path = PUBLIC / asset['path']
    probe = json.loads(run('ffprobe', '-v', 'error', '-show_streams', '-show_format', '-of', 'json', str(path)))
    stream = probe['streams'][0]
    signal = decode(path, int(stream['channels']))
    peak = float(np.abs(signal).max())
    rms = float(np.sqrt(np.mean(signal.astype(np.float64) ** 2)))
    result = {'file': asset['path'], 'bytes': path.stat().st_size,
              'sampleRate': int(stream['sample_rate']), 'channels': int(stream['channels']),
              'duration': len(signal) / RATE, 'peakDbfs': 20 * math.log10(max(peak, 1e-12)),
              'rmsDbfs': 20 * math.log10(max(rms, 1e-12)),
              'sha256': hashlib.sha256(path.read_bytes()).hexdigest()}
    assert stream['codec_name'] == 'mp3' and result['sampleRate'] == RATE, result
    assert result['peakDbfs'] <= -3, result
    if asset['path'].startswith('sfx/'):
        assert result['channels'] == 1 and result['bytes'] <= 60000, result
    if asset['kind'] == 'loop':
        assert 30 <= result['duration'] <= 60, result
        differences = np.abs(np.diff(signal[:, 0]))
        result['seamJump'] = float(abs(signal[0, 0] - signal[-1, 0]))
        result['adjacentDifference99'] = float(np.quantile(differences, .99))
        assert result['seamJump'] <= max(.002, result['adjacentDifference99']), result
    if asset['path'].startswith('music/'):
        assert int(stream['bit_rate']) == 128000, result
    return result


def credits(manifest):
    sources = manifest['sources']
    rows = ['# Авторы звуков Архипелага', '',
            'Предварительный комплект реальных записей для прослушивания в `/?sound`.',
            'Источники проверены 2026-10-04. Адаптации: монтаж фрагментов, изменение высоты',
            'отдельных эффектов, моно/стерео, 44,1 кГц, нормализация и MP3.',
            'Музыка — 128 кбит/с; её темп и высота сохранены. Синтез остаётся запасным вариантом.', '',
            '## Источники', '', '| Запись / набор | Автор | Лицензия |', '|---|---|---|']
    credited_pages = set()
    for source in sources.values():
        if source['page'] in credited_pages:
            continue
        credited_pages.add(source['page'])
        author = source['author']
        if source.get('authorUrl'):
            author = f"[{author}]({source['authorUrl']})"
        rows.append(f"| [{source['title']}]({source['page']}) | {author} | [{source['license']}]({source['licenseUrl']}) |")
    rows += ['', '## Файлы и адаптации', '',
             'Пути относительно `apps/web/public/audio/`. Точные исходные файлы, фрагменты,',
             'смещения, высоты, SHA-256 и ссылки загрузки перечислены в `scripts/audio-sources.json`.', '',
             '| Файл | Автор и источник | Изменения |', '|---|---|---|']
    for asset in manifest['assets']:
        used = list(dict.fromkeys(part['source'] for part in asset['parts']))
        credited = dict.fromkeys(sources[key]['page'] for key in used)
        unique = [next(sources[key] for key in used if sources[key]['page'] == page) for page in credited]
        names = '; '.join(f"[{source['author']} — {source['title']}]({source['page']})" for source in unique)
        changes = 'Фрагменты, монтаж, нормализация, MP3'
        if asset['kind'] == 'loop':
            changes = f"Фрагмент, круговой кроссфейд {asset['crossfade']} с, петля {asset['seconds']} с, нормализация, MP3"
        elif asset['kind'] == 'track':
            changes = 'Нормализация, начальное/конечное затухание, MP3'
            if len(asset['parts']) > 1:
                changes = 'Соединение авторского вступления и окончания; ' + changes
            if any(part.get('repeat', 1) > 1 for part in asset['parts']):
                changes = 'Авторская петля повторена 8 раз; ' + changes
        rows.append(f"| `{asset['path']}` | {names} | {changes} |")
    rows += ['', '## Примечания', '',
             '- Freesound: использованы общедоступные HQ-превью CC0; исходные загрузки требуют аккаунта.',
             '- Ветер содержит естественный фон дневных насекомых; у чаек выбран короткий фрагмент до вороны в конце записи.',
             '- Happy Ukelele Island Surfing Theme — Tarush Singhal: 99 BPM в метаданных оригинала; источник также указывает 8-bit drums.',
             '- Sicilian sun — Konrad "FeniX" Gadzina: CC-BY 3.0; [страница автора](http://enklawa-tworcza.blogspot.com/). Оценка темпа около 83 BPM, не авторские метаданные.',
             '- Apple Cider — Zane Little: акустические и цифровые инструменты по описанию; оценка темпа около 99 BPM, не авторские метаданные.',
             '- Ukulele Forest — [StarNinjas](https://opengameart.org/users/starninjas): вступление и окончание используются для эпилога и коротких эффектов.',
             '- Все CC0 записи указаны добровольно; обязательная атрибуция Sicilian sun сохранена вместе со ссылкой на лицензию и описанием изменений.', '']
    content = '\n'.join(rows)
    (ROOT / 'CREDITS.md').write_text(content, encoding='utf-8')
    (PUBLIC / 'CREDITS.md').write_text(content, encoding='utf-8')


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--fetch', action='store_true')
    parser.add_argument('--check', action='store_true')
    parser.add_argument('--report', default='node_modules/.cache/sound-files/assets-report.json')
    args = parser.parse_args()
    manifest = json.loads((ROOT / 'scripts/audio-sources.json').read_text(encoding='utf-8'))
    if args.fetch:
        fetch(manifest['sources'])
    results = []
    for asset in manifest['assets']:
        if not args.check:
            signal = render(asset, manifest['sources'])
            path = PUBLIC / asset['path']
            path.parent.mkdir(parents=True, exist_ok=True)
            run('ffmpeg', '-v', 'error', '-y', '-f', 'f32le', '-ar', str(RATE),
                '-ac', str(signal.shape[1]), '-i', '-', '-map_metadata', '-1',
                '-c:a', 'libmp3lame', '-b:a', str(asset.get('bitrate', 96)) + 'k',
                '-write_xing', '1', str(path), data=signal.astype('<f4').tobytes())
        results.append(inspect(asset))
    sfx_bytes = sum(item['bytes'] for item in results if item['file'].startswith('sfx/'))
    assert sfx_bytes <= 600000, sfx_bytes
    credits(manifest)
    report = ROOT / args.report
    report.parent.mkdir(parents=True, exist_ok=True)
    report.write_text(json.dumps({'files': results, 'sfxBytes': sfx_bytes, 'totalBytes': sum(item['bytes'] for item in results)}, indent=2) + '\n', encoding='utf-8')
    print(json.dumps({'files': len(results), 'sfxBytes': sfx_bytes, 'report': str(report)}))


if __name__ == '__main__':
    main()
