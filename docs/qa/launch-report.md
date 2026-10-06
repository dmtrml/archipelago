# Отчёт запуска — режим одного прохода

Ветка `chat/launch`, база `1e3b82cfa25f4801b1ba787c5ced4b881a0756d1`. Отчёт обновляется после каждого этапа.

## Окружение

- Windows, Node 22.22.0, npm 10.9.4, Git 2.51.2.windows.1.
- Браузерные проверки: Playwright Chromium, канал `msedge` на Windows.
- ffmpeg/ffprobe PATH: 8.1.1; pipeline использует `ffmpeg-static 5.3.0` (ffmpeg 6.1.1) и `ffprobe-static 3.1.0` (ffprobe 4.0.2).
- Финальный Stage 4 renderer: ANGLE / NVIDIA GeForce RTX 3060 / D3D11. Playwright 1.63.0 использован локально и не закреплён dependency.
- Контрольная симуляция до изменений баланса: 500 сидов × 100 недель, 134,7 с; SHA-256 сохранённого вывода `839F459749B7143A2F9E079597E418F3CF41C0C063EDA1A8F9B91B9B87C94278`.

## Этап 1 — публикация

| № | Результат | Доказательство |
|---|---|---|
| 1 | выполнен | `npm run typecheck`; `npm test` — 140/140; `npm run build`; `npm run sim` |
| 2 | выполнен | Pages build с `VITE_BASE=/archipelago/`; `scripts/check-publish.mjs`: 43 MP3, маршруты и шрифты без 404 |
| 3 | выполнен | 13 кадров медленной загрузки, белых кадров нет; 4 ключевых JPEG в `docs/qa/launch-1-publish/screenshots/` |
| 4 | выполнен | `og-image.jpg` 1200×630, 104 КБ; `apple-touch-icon.png` 180×180; полные OG URL в Pages build |
| 5 | выполнен | GitHub Actions с актуальными major; `actionlint` отсутствует в окружении, синтаксис проверен вручную |
| 6 | выполнен | отдельный `three-*.js`, gzip 251,03 КБ; предупреждение >500 КБ сохранено |
| 7 | выполнен | абсолютные public-пути переведены на `asset()`; найденные «ты» исправлены на «вы» |
| 8 | выполнен | [приёмка этапа 1](launch-1-publish.md), STATUS и история обновлены |

### Отклонения

- Ручное включение GitHub Pages, GoatCounter и `FEEDBACK_URL` пропущено по таблице режима одного прохода. Pages проверен локальной сборкой/preview; переменные аналитики и отзывов будут проверяться тестовыми значениями на этапе 2.
- `actionlint` не установлен. Workflow YAML проверен вручную; окончательная проверка выполнена CI в draft PR #8.

### Не сделано

- Ручное включение Pages владельцем не выполнялось, как предписано режимом одного прохода.

### Материалы

- [Приёмка этапа 1](launch-1-publish.md)
- `apps/web/public/og-image.jpg`
- `apps/web/public/apple-touch-icon.png`

## Этап 2 — первые минуты и распространение

| № | Результат | Доказательство |
|---|---|---|
| 1 | выполнен | typecheck, 140 тестов, build; engine и store не менялись |
| 2 | выполнен | `scripts/check-first-minutes.mjs`, 390×844 и 1366×768, 6 скриншотов |
| 3 | выполнен | Web Share и clipboard fallback с точными RU-строками и `?ref=share` |
| 4 | выполнен | mock GoatCounter: `game-start`, `week-5`; без env внешних запросов нет |
| 5 | выполнен | feedback link только при `VITE_FEEDBACK_URL` |
| 6 | выполнен | sound: 37 checks/errors 0; neighbors: runtime/console errors 0 |
| 7 | выполнен | [приёмка этапа 2](launch-2-first-minutes.md), STATUS и история обновлены |

### Отклонения этапа 2

- Реальный seed начального мира без доступного актива не найден до 49 999. По таблице режима одного прохода acceptance использует синтетический вариант текущего мира только внутри QA: список предложений ограничивается неподходящими типами, после чего проверяется старт со шага 2.
- Первичный запуск `check-neighbors-top.mjs` без обязательного `--fixture` завершился его штатной проверкой аргументов. После генерации fixture скрипт прошёл с exit 0; это ошибка локальной команды, не продукта.

### Не сделано после этапа 2

- Настройка реальных GoatCounter/feedback URL владельцем по-прежнему не выполнялась по one-pass fallback; обе интеграции проверены тестовыми env.

## Этап 3 — английская версия

| № | Результат | Доказательство |
|---|---|---|
| 1 | выполнен | `npm run typecheck`; `npm test` — 141/141; `npm run build`; world v4 migration tests |
| 2 | выполнен | Проверка строковых литералов `packages/engine/src`: кириллица только в разрешённом `BOT_ROSTER` |
| 3 | выполнен | `scripts/check-i18n.mjs`: 18 RU-состояний (включая upgrade/loan/events/freedom/threat/epilogue/neighbor card) дословно совпали с checkpoint `40b2a41` после удаления только новых language controls; найденный расширенной проверкой регресс «Баркас» исправлен обратно на «баркас» |
| 4 | выполнен | `scripts/check-i18n.mjs`: EN 390×844 + 1366×768; 6 JPEG, кириллица/overflow/runtime errors — 0 |
| 5 | выполнен | `/en/`, navigator ru/de, сохранённый выбор и переключение посреди партии без навигации/изменения мира прошли |
| 6 | выполнен | engine migration test v3 → v4: legacy event/news text сохранён |
| 7 | выполнен | `dist/en/index.html` создан multi-page build с английскими meta; EN social image генерируется `--lang en` |
| 8 | выполнен | `check-i18n`: `breakdown: 3`, `gift: 3` совпадают в engine, RU и EN |
| 9 | выполнен | [приёмка этапа 3](launch-3-english.md), STATUS и история обновляются в этом коммите |

Баланс: Stage 2 — 144,6 с, Stage 3 — 123,1 с. После нормализации только поля времени оба вывода имеют SHA-256 `9F77B95342F5965543C2208ABE7593268DF7595B3709DF17582C1BDC4695EA19`; diff пуст.

### Отклонения этапа 3

- В one-pass `main` не содержит этапы 1–2, поэтому RU baseline — checkpoint `40b2a41`, семантический эквивалент описанного в спецификации `main` после двух предыдущих этапов.
- Полный вывод `npm run sim` содержит недетерминированное время выполнения; баланс дополнительно сравнивается после нормализации только этого поля. Числа и проверки должны совпасть полностью.
- Для `dreamView` нехватка денег хранится числом `missingCash`, так как перечисленный спецификацией `reason` не содержит параметризованного варианта.

### Материалы этапа 3

- [Приёмка этапа 3](launch-3-english.md)
- `apps/web/public/og-image-en.jpg`
- `README.en.md`
- `launch-3-english/results.json` и 6 JPEG в `launch-3-english/screenshots/`

## Этап 4 — рекламный ролик

| № | Результат | Доказательство |
|---|---|---|
| 1 | выполнен | typecheck, 141/141 tests, build, diff-check; Stage3→Stage4 game chunks ≤ +1 KiB raw; `Director` отдельный lazy chunk |
| 2 | выполнен | fixtures ×2: SHA-256 `10F03584691DB6DBF9470B96259BC8E7879C7ABAF7835A74AA3E601F38565108`; seed 2, F30, S23, N8 |
| 3 | выполнен | beats: 99 BPM, первая доля 0.023 с |
| 4 | выполнен | 4 финала: 1080×1920/30 с и 1920×1080/45 с, 30 fps, H.264 High/yuv420p, AAC 48k stereo, faststart |
| 5 | выполнен | -14.3/-14.4 LUFS; peak -1.2 dBFS |
| 6 | выполнен | frame cuts и `timeline.md` совпадают с монтажными таблицами |
| 7 | выполнен | deterministic `asset`: PSNR avg 70.562647, min 61.97 dB, 109 frames |
| 8 | выполнен | final render без console/page errors; EN без кириллицы; локальные шрифты загружены; sourceHash `e5ef9e79…a1118` |
| 9 | выполнен | просмотрены 4 final sheets + 4 covers; v30 safe-zone checks зелёные; пустой transient v30-en hook cache переснят до final pass |
| 10 | выполнен | [приёмка этапа 4](launch-4-trailer.md), STATUS и история обновлены |

Баланс Stage 4: свежие 500×100 sim на Stage-2 checkpoint `40b2a41` и текущем Stage 4 идентичны после нормализации только времени выполнения; SHA-256 `9F77B95342F5965543C2208ABE7593268DF7595B3709DF17582C1BDC4695EA19`.

### Отклонения этапа 4

- One-pass отменяет отдельный draft PR и owner feedback loop: source-current RU draft сразу продолжен final.
- Standalone `trailer-v1` заменён master/user target `trailer-chat`; финальные MP4 не коммитятся и опубликованы в prerelease `trailer-chat` после Stage4 push.
- `package-lock.json` сохранён по прямому указанию пользователя вместе с Stage4 package prep, несмотря на узкий standalone allowed-file list.
- Playwright 1.63.0 использован как локальный extraneous package, в permanent dependencies не добавлен; clean-host reproduction после `npm ci` делает `npm install --no-save --package-lock=false playwright@1.63.0` перед render-командой.

### Не сделано после этапа 4

- Owner-only реальные Pages/GoatCounter/feedback settings и ручной playtest остаются one-pass fallback. Техническая acceptance всех четырёх этапов завершена.

### Материалы этапа 4

- [Приёмка этапа 4](launch-4-trailer.md)
- `docs/qa/trailer/draft/` — 2 RU draft MP4, 2 storyboard JPEG и timeline
- `.trailer/out/final/` — 4 final MP4, 4 covers, 4 sheets, timeline и render-report (ignored; опубликованы как prerelease `trailer-chat` assets)
- draft PR #8 — `Запуск: этапы 1–4 (chat)`, base `main`, head `chat/launch`; push CI и PR CI завершены успешно
