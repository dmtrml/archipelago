# Приёмка: соседи в верхней строке

Дата: 2026-10-04. Спецификация: [neighbors-top.md](../specs/neighbors-top.md).
Ветка `codex/neighbors-top`, база `origin/main` — `0ff9aeb` (PR #2 уже включён).

## Результат

На компьютере соседи находятся между плашкой острова и показателями. Полный, средний и
компактный размеры выбираются по измеренному свободному месту и реальной ширине чипов,
включая текущие имена, проценты и загруженные шрифты. При нехватке места аватары переходят
в плашку. При этом ширина плашки восстанавливается без аватаров и обрезанного текста,
чтобы резервная раскладка не вызывала колебаний режима.

Карточка и новости расположены абсолютно под верхней строкой. Их ширина и положение
ограничены промежутком между `.col-left` и `.col-right`, высота карточки — экраном.
Нажатие на себя не меняет выбор соседа. Повторное нажатие, крестик и Escape закрывают карточку.
Измерение колонок для камеры сохранено. Мобильная геометрия и стили совпадают с базой.

## Проверки

- `npm run typecheck` — движок и веб проходят.
- `npm test` — 140 тестов в 5 файлах проходят.
- `npm run build` — проходит; существующее предупреждение о размере 3D-бандла осталось.
- Отдельной команды линтера в проекте нет; `git diff --check` проходит.
- Headless Microsoft Edge / Playwright: все 10 сочетаний desktop-размера и названия проходят.
  Четыре аватара видимы, переноса и пересечений нет; высота строки во всех случаях 75 px.
- Проверены карточки на всех desktop-размерах, включая fallback: целиком в экране и между колонками.
  Сам игрок не закрывает карточку; повторный клик, крестик и Escape работают.
- После следующей недели новости находятся под строкой; её высота не меняется.
- Сравнение с мобильным снимком геометрии и вычисленных стилей из `main` — полное совпадение.
  База: [mobile-baseline.json](neighbors-top/mobile-baseline.json).
- Ошибок выполнения и консоли браузера — 0. Добавлен favicon на основе существующей эмблемы:
  при первом прогоне обнаружился прежний запрос `/favicon.ico` с ответом 404.
- До реализации браузерный тест падал на сохранённой второй строке `.col-top`.
- Независимый ревьюер проверил дифф и пороги каждого режима ±2 px в обоих направлениях,
  по 15 кадров на ширину. Циклов ResizeObserver и подтверждённых дефектов нет.
- CI в репозитории не настроен (`.github/workflows` отсутствует).
  [PR #4](https://github.com/dmtrml/archipelago/pull/4) опубликован с разрешения владельца;
  коммит реализации — `3b5faa3`.

## Скриншоты

Все снимки сделаны на одной синтетической партии: seed 1, неделя 75. Прогресс Бориса — 210%,
Мии — 114%, игрока — 75%, Тимура — 34%. Свобода у Бориса с 42-й, у Мии с 33-й недели.
Игрок достигал свободы с 57-й недели, мечта ещё не достроена. Сохранение создано только
через `createWorld` / `applyAction`; игровых данных и личных сохранений в Git нет.
Длинное название «Остров Солнечной Свободы» содержит ровно 24 символа.

| Размер | Короткое название | Режим | 24 символа | Режим |
|---|---|---|---|---|
| 1024×768 | [Снимок](neighbors-top/screenshots/short-1024x768.png) | в плашке | [Снимок](neighbors-top/screenshots/long-1024x768.png) | в плашке |
| 1280×720 | [Снимок](neighbors-top/screenshots/short-1280x720.png) | компактный | [Снимок](neighbors-top/screenshots/long-1280x720.png) | компактный |
| 1366×768 | [Снимок](neighbors-top/screenshots/short-1366x768.png) | средний | [Снимок](neighbors-top/screenshots/long-1366x768.png) | компактный |
| 1440×900 | [Снимок](neighbors-top/screenshots/short-1440x900.png) | средний | [Снимок](neighbors-top/screenshots/long-1440x900.png) | средний |
| 1920×1080 | [Снимок](neighbors-top/screenshots/short-1920x1080.png) | полный | [Снимок](neighbors-top/screenshots/long-1920x1080.png) | полный |
| 390×844 | [Снимок](neighbors-top/screenshots/mobile-390x844.png) | прежний mobile | [Снимок](neighbors-top/screenshots/mobile-long-390x844.png) | прежний mobile |

Карточки: [1366×768](neighbors-top/screenshots/short-1366x768-card.png),
[1920×1080](neighbors-top/screenshots/short-1920x1080-card.png),
[fallback 1024×768](neighbors-top/screenshots/long-1024x768-card.png).
[Новости после следующей недели](neighbors-top/screenshots/news-after-next-week.png).

## Повторение проверки

Нужны установленные зависимости проекта, Playwright и браузер. Новые зависимости приложения
не добавлялись. Скрипт использует установленный Microsoft Edge на Windows; на других ОС —
Chromium из Playwright. Браузер можно задать через `--channel`.
Если Playwright находится вне проекта, задайте `PLAYWRIGHT_MODULE` путём к его установленному модулю.

В отдельном терминале: `npm run dev -w @arch/web -- --host 127.0.0.1 --port 5180 --strictPort`.

```powershell
$qa = Join-Path $env:TEMP 'archipelago-neighbors-top'
New-Item -ItemType Directory -Path $qa -Force | Out-Null
$save = & ./node_modules/.bin/tsx.cmd scripts/fixtures/neighbors-top.ts
if ($LASTEXITCODE -ne 0) { throw 'Fixture failed' }
[System.IO.File]::WriteAllText((Join-Path $qa 'save.json'), ($save -join [Environment]::NewLine), [System.Text.UTF8Encoding]::new($false))
node scripts/check-neighbors-top.mjs --fixture (Join-Path $qa 'save.json') --output $qa --baseline-dir docs/qa/neighbors-top
```

Для записи новой базы на исходной версии приложения используйте `--baseline`.
Сравнение мобильных стилей требует тех же браузера и доступных шрифтов.
Проверка создаёт PNG и отчёт в выбранном каталоге; JSON сохранения не нужно коммитить.

## Изменённые файлы

- `apps/web/src/ui/TopBar.tsx` — слот соседей, измерения и ограничения dropdown.
- `apps/web/src/ui/Panels.tsx` — удалена вторая строка соседей.
- `apps/web/src/ui/Neighbors.tsx` — три размера, измерительные чипы, aria/title и no-op для себя.
- `apps/web/src/styles.css` — desktop-раскладка, размеры и абсолютные панели.
- `apps/web/index.html`, `apps/web/public/favicon.svg` — устранён запрос отсутствующей иконки.
- `scripts/fixtures/neighbors-top.ts`, `scripts/check-neighbors-top.mjs` — фикстура и браузерная регрессия.
- `STATUS.md`, `docs/status-history.md`, этот отчёт и его снимки — состояние и материалы приёмки.

Чужое локальное изменение `package-lock.json` сохранено и исключено из коммита.
