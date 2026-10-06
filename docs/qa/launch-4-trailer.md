# Приёмка запуска — этап 4: рекламный ролик

Дата: 2026-10-05. Ветка: `chat/launch`. База этапа 4: `54b521b` (этап 3).
Спецификация: `docs/specs/launch-4-trailer.md`; режим одного прохода — `docs/specs/launch.md`.

## Результат

Этап 4 выполнен: детерминированные миры, `?director`, виртуальное время, камера, покадровый рендер,
офлайн-звук, монтаж по долям, два RU-черновика и четыре финальных ролика. Финальные MP4 остаются в
`.trailer/out/final/` и не входят в Git; актуальные файлы опубликованы ассетами prerelease `trailer-chat`.

Closure one-pass: prerelease `trailer-chat` указывает на `e3a9de0`; единственный draft PR — #8
`Запуск: этапы 1-4 (chat)` (`main` ← `chat/launch`), CI для push и PR зелёный.

## Окружение

- Windows; Node `v22.22.0`; npm `10.9.4`; Git `2.51.2.windows.1`.
- Microsoft Edge / Playwright `1.63.0`. Playwright использовался локально как extraneous dependency и не добавлен в `package.json`.
- PATH: ffmpeg/ffprobe `8.1.1-full_build-www.gyan.dev`.
- Воспроизводимый pipeline: `ffmpeg-static 5.3.0` → ffmpeg `6.1.1`; `ffprobe-static 3.1.0` → ffprobe `4.0.2`.
- WebGL renderer финального прогона: `ANGLE (NVIDIA, NVIDIA GeForce RTX 3060 (0x00002504) Direct3D11 vs_5_0 ps_5_0, D3D11)`.

## Критерии приёмки

| № | Результат | Доказательство |
|---|---|---|
| 1 | выполнен | `npm run typecheck`; `npm test` — 141/141; `npm run build`; `git diff --check`. Stage-3 build на `54b521b`: `main` +0,24 КБ, `App` +0,12, `IslandScene` +0,52, `engine` +0,16, `three` без изменения; split-группа прежнего `analytics` (`analytics+selectors+store`) +0,96 КБ raw. `Director` — отдельный lazy chunk 122,98 КБ raw / 12,19 КБ gzip. |
| 2 | выполнен | Два `npm run trailer:fixtures`: SHA-256 `10F03584691DB6DBF9470B96259BC8E7879C7ABAF7835A74AA3E601F38565108`; seed `2`, `F=30`, `S=23`, `N=8`. Компактный JSON — 121996 байт; pretty-файл — 245544 байт (<400 KiB). |
| 3 | выполнен | `node scripts/trailer/beats.mjs`: BPM `99`, первая доля `0.023`, длина доли `0.6060606060606061` с. |
| 4 | выполнен | Все четыре финала: H.264 High, `yuv420p`, 30 fps, AAC LC 48 кГц stereo, точные 30.000/45.000 с; `moov` перед `mdat`. См. таблицу ниже. |
| 5 | выполнен | `ebur128`: v30 RU/EN `-14.3 LUFS`, h45 RU/EN `-14.4 LUFS`; peak всех финалов `-1.2 dBFS`, то есть не выше -1 dB. |
| 6 | выполнен | Финальный `.trailer/out/final/timeline.md` и `render-report.json`: границы v30 0/73/182/291/345/436/509/655/764, h45 0/109/255/364/473/564/673/764/909/1055/1164 совпадают со спецификацией. |
| 7 | выполнен | Двойной финальный render `asset`: PSNR average `70.562647 dB`, minimum `61.97 dB`, 109 кадров; minimum > 50 dB. |
| 8 | выполнен | Render driver завершил all-target pass без console/page errors; EN проверяется на отсутствие кириллицы; готовность включает локальные Unbounded/Manrope. `sourceHash` отчёта: `e5ef9e798d9a1800da9716e87d11b55ccb5630cba2d9ef7413e3ce7fc91a1118`. |
| 9 | выполнен | Визуально просмотрены 4 final storyboard sheets и 4 covers. Клиппинга, неверного языка, перекрытия модалок, пустых переходов и нечитаемого end card нет. Автопроверка v30 safe zones прошла для 6 caption shots каждого языка. |
| 10 | выполнен | Этот документ, `docs/qa/launch-report.md`, `STATUS.md` и `docs/status-history.md` обновлены. |

## Финальные файлы

| Версия | Размер | Кадры | Длительность | Размер файла | LUFS / peak |
|---|---:|---:|---:|---:|---:|
| `v30-ru` | 1080×1920 | 900 | 30.000 с | 15 602 299 | -14.3 / -1.2 |
| `v30-en` | 1080×1920 | 900 | 30.000 с | 15 866 536 | -14.3 / -1.2 |
| `h45-ru` | 1920×1080 | 1350 | 45.000 с | 25 356 524 | -14.4 / -1.2 |
| `h45-en` | 1920×1080 | 1350 | 45.000 с | 25 232 748 | -14.4 / -1.2 |

Файлы: `.trailer/out/final/archipelago-{v30,h45}-{ru,en}.mp4`, соответствующие `cover-*.jpg`,
`sheet-*.jpg`, `timeline.md`, `render-report.json`. `faststart`: `moov=36`, `mdat=34389/34397/50929/50937`.

## Черновик

Текущие source-compatible материалы в `docs/qa/trailer/draft/`:

- `archipelago-v30-ru.mp4` — 2 216 020 байт;
- `archipelago-h45-ru.mp4` — 3 318 068 байт;
- `sheet-v30-ru.jpg` — 257 208 байт;
- `sheet-h45-ru.jpg` — 391 905 байт;
- `timeline.md`.

Оба MP4 <5 MiB, обе раскадровки <400 KiB. В one-pass отдельный owner feedback loop пропущен по master-spec: draft сразу продолжен final.

## Камеры и композиция

`d` ниже — для 16:9; в 9:16 умножается на `1.511`.

| Shot | target | az | el | d |
|---|---|---|---:|---|
| hook | `(0,-1.2,0)` | 30→60 | 24 | 68→64 |
| asset | `(9.85,0.6,18.94)` | 35→50 | 26 | 30→26 |
| upgrade | `(9.85,0.6,18.94)` | 50→62 | 24 | 24→22 |
| liability | `(9.8,0.8,5)` | 35→50 | **22** | 50→45 |
| storm | `(2,-1.2,4)` | 65→55 | 18 | 64→60 |
| dream | `(18,0.5,-5.2)` | 80→95 | 22 | 36→32 |
| end | `(0,-1.2,0)` | 45→70 | 26 | 72 |

`liability` откалиброван с исходных 28° до 22°: предметы полностью входят в безопасную область и не спорят с подписью.
Storyboard review подтвердил обе ориентации; covers имеют правильный RU/EN CTA и URL.

## Регрессии и детерминизм

- Свежие 500×100 sim на checkpoint Stage 2 `40b2a41` и текущем Stage 4 после нормализации **только** elapsed-time поля идентичны; SHA-256 обоих `9F77B95342F5965543C2208ABE7593268DF7595B3709DF17582C1BDC4695EA19`.
- `scripts/check-i18n.mjs`: 18/18 RU parity, 6 EN screenshots, runtime errors 0. Однократный `week:scam` mismatch не воспроизвёлся ни diagnostic, ни официальным повтором; copy не менялся.
- `scripts/check-first-minutes.mjs`: pass на configured/plain серверах; feedback/GoatCounter env проверены.
- `scripts/check-sound.mjs`: 37 checks, catalog 42, maximum voices 16, errors 0.
- `scripts/check-neighbors-top.mjs`: 10 сценариев, runtime/console errors 0.
- `vite-node scripts/check-sound-music.mjs`: 11 checks; `vite-node scripts/check-sound-files.mjs`: 29 checks. Raw Node для этих двух модулей не является корректным runner из-за Vite `import.meta.env`.
- Owner source profile сохранён: 5 file recordings и 37 synth. Offline trailer audio использует `DEFAULT_AUDIO_SOURCES`, deterministic variant/pitch/volume и двухпроходный `loudnorm`.

## Найденное при финальной проверке

- Первый targeted `v30-en` rerender однажды превысил стандартный 30-секундный Playwright screenshot timeout. В render harness установлен `timeout: 0`; capture остаётся синхронным и завершился штатно.
- В первом all-target storyboard review был обнаружен transient пустой WebGL capture только у закэшированного `v30-en/hook`. `done.json` этого одного shot удалён, shot переснят; три raw frames и новый sheet подтвердили остров с первого кадра. После этого выполнен новый full all-target pass, из которого получены финальные MP4/report выше.

## Отклонения one-pass

- Standalone-spec предлагает отдельную ветку/PR и prerelease `trailer-v1`; master one-pass и прямое указание пользователя заменяют это одной веткой `chat/launch`, одним финальным draft PR и prerelease `trailer-chat`.
- Standalone allowed-file list называет `package.json`, но пользователь прямо потребовал сохранить уже начатые Stage4 изменения и в `package-lock.json`; lockfile поэтому входит в этап 4.
- Playwright намеренно не закреплён в permanent dependencies: standalone разрешает в `package.json` только trailer scripts и ffmpeg/ffprobe, а в рабочем окружении `playwright@1.63.0` использовался как extraneous package. После чистого `npm ci` его нужно установить локально без изменения manifest/lock командой из раздела «Воспроизведение».
- Owner-only просмотр draft/playtest не блокирует one-pass. Реальные Pages settings, GoatCounter, feedback URL и ручной playtest остаются действиями владельца; локальные/test-env acceptance проверки выполнены.

## Воспроизведение

```text
npm ci
npm install --no-save --package-lock=false playwright@1.63.0
npm run trailer:fixtures
npm run trailer -- --quality final
```

Финальные MP4 намеренно игнорируются через `.gitignore`; committed evidence — этот документ и `docs/qa/trailer/draft/`.
