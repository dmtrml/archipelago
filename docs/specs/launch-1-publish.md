# Этап 1. Публикация

Исполнитель: агент-разработчик (Codex). Проверяющий: Claude. Один PR из ветки `codex/launch-1-publish`.
Общие правила, решения владельца и порядок этапов — в [launch.md](launch.md).

Цель: игра открывается по публичной ссылке, ссылка красиво выглядит в соцсетях, вместо белого экрана
при загрузке видна заставка, шрифты не зависят от Google, тексты обращаются к игроку одинаково.

## 1. GitHub Pages и CI

Репозиторий публичный, Pages пока выключены. Адрес после включения: `https://dmtrml.github.io/archipelago/`,
то есть сайт живёт **не в корне домена**, а под путём `/archipelago/`.

**Путь сборки.** В `apps/web/vite.config.ts`: `base: process.env.VITE_BASE || '/'`. Локально всё работает
как раньше (`/`), workflow деплоя собирает с `VITE_BASE=/archipelago/`.

**Все пути к файлам из `public/` — через базовый путь.** Новый файл `apps/web/src/asset.ts`:

```ts
/** Путь к файлу из public/ с учётом базового пути сайта (Pages живёт под /archipelago/). */
export const asset = (path: string) => import.meta.env.BASE_URL + path.replace(/^\//, '');
```

Заменить абсолютные пути в коде (сейчас они сломаются под `/archipelago/`):

- `apps/web/src/audio/cues.ts` — все `files` (`/audio/...`, включая строку, которая собирает пути в цикле);
- `apps/web/src/audio/AudioControls.tsx` — ссылки `/?sound` → `asset('?sound')` и `/audio/CREDITS.md`;
- `apps/web/src/audio/SoundShowcase.tsx` — ссылка «← К игре» `/` → `asset('')`.

Перед заменой найти все остальные такие места: `grep -rnE "['\"\`]/(audio|\?|favicon|og-image)" apps/web/src`.
Список найденного записать в документ приёмки. `href="/favicon.svg"` в `index.html` Vite переписывает сам — не трогать.

**Workflow `.github/workflows/ci.yml`** (имя `CI`): на `push` и `pull_request`; ubuntu-latest; Node 22 с кэшем npm;
шаги `npm ci`, `npm run typecheck`, `npm test`, `npm run build`, `npm run sim`. Симулятор идёт около 2,5 минут
и падает с кодом 1, если цели баланса нарушены. Это и есть проверка баланса из этапа 0 дорожной карты.

**Workflow `.github/workflows/deploy.yml`** (имя `Deploy`): на `push` в `main` и `workflow_dispatch`;
`permissions: { contents: read, pages: write, id-token: write }`; `concurrency: { group: pages, cancel-in-progress: true }`.
Задача `build`: `npm ci`, затем `npm run build` с переменными окружения:

```yaml
VITE_BASE: /archipelago/
VITE_SITE_URL: https://dmtrml.github.io/archipelago/
VITE_GOATCOUNTER_URL: ${{ vars.GOATCOUNTER_URL }}   # пусто — аналитики нет (используется с этапа 2)
VITE_FEEDBACK_URL: ${{ vars.FEEDBACK_URL }}         # пусто — ссылки на отзыв нет (используется с этапа 2)
```

Затем `actions/upload-pages-artifact` с `path: apps/web/dist`. Задача `deploy` (`needs: build`,
`environment: github-pages`): `actions/deploy-pages`. Взять текущие мажорные версии официальных actions
(`actions/checkout`, `actions/setup-node`, `actions/configure-pages`, `actions/upload-pages-artifact`, `actions/deploy-pages`).

Маршруты игры заданы параметрами (`?sound`, `?sandbox`), поэтому запасная страница 404 не нужна.

Включить Pages — шаг владельца (см. [launch.md](launch.md)). Агент Pages не включает.

## 2. Шрифты — в проекте, без Google Fonts

Сейчас шрифты грузятся с `fonts.googleapis.com`. Это лишний запрос к стороннему сервису, задержка на телефоне,
а в изолированной среде шрифт подменяется системным — так было бы и в кадрах ролика.

- Добавить зависимости `@fontsource/manrope` и `@fontsource/unbounded` (5.x).
- В `apps/web/src/main.tsx` **до** `./styles.css` импортировать ровно те начертания, что грузятся сейчас:
  Manrope 500, 600, 700, 800 и Unbounded 500, 700 (`@fontsource/manrope/500.css` и т. д.). Кириллица и латиница
  уже внутри: браузер скачивает нужное подмножество по `unicode-range`.
- Из `apps/web/index.html` убрать оба `preconnect` и ссылку на Google Fonts.
- В `CREDITS.md` добавить раздел «Шрифты»: Manrope и Unbounded — автор, ссылка, SIL Open Font License 1.1.
  Автора и ссылку взять из `package.json` и README пакетов `@fontsource`.

## 3. Превью ссылки в соцсетях

Создать `apps/web/.env` с одной строкой `VITE_SITE_URL=https://dmtrml.github.io/archipelago/` — значение по умолчанию
для локальных сборок; переменная окружения в workflow деплоя его перекрывает. Vite подставляет `%VITE_SITE_URL%`
в `index.html`. Существующий `<title>Архипелаг</title>` заменить, в `<head>` добавить:

```html
<title>Архипелаг — уютная игра про деньги и свободу</title>
<meta name="description" content="Свой остров, 600 монет и одна цель — финансовая свобода. Покупайте активы, обходите аферы и обгоните соседей. Бесплатно в браузере." />
<link rel="apple-touch-icon" href="/apple-touch-icon.png" />
<meta property="og:type" content="website" />
<meta property="og:site_name" content="Архипелаг" />
<meta property="og:locale" content="ru_RU" />
<meta property="og:url" content="%VITE_SITE_URL%" />
<meta property="og:title" content="Архипелаг — уютная игра про деньги и свободу" />
<meta property="og:description" content="Свой остров, 600 монет и одна цель — финансовая свобода. Покупайте активы, обходите аферы и обгоните соседей. Бесплатно в браузере." />
<meta property="og:image" content="%VITE_SITE_URL%og-image.jpg" />
<meta property="og:image:width" content="1200" />
<meta property="og:image:height" content="630" />
<meta property="og:image:alt" content="Уютный low-poly остров с лодками, домиками и маяком" />
<meta name="twitter:card" content="summary_large_image" />
```

`twitter:title`, `twitter:description` и `twitter:image` не нужны: X берёт их из `og:*`.

**Картинки** делает новый скрипт `scripts/make-social-images.mjs` (запуск: `node scripts/make-social-images.mjs`,
на собранной игре через `vite preview`). Он кладёт результаты в `apps/web/public/`, и они коммитятся.

- `apple-touch-icon.png`, 180×180: страница с одним `<img src="favicon.svg">` на весь вьюпорт 180×180, скриншот PNG.
- `og-image.jpg`, 1200×630, JPEG качества 88, не больше 300 КБ:
  1. Открыть `/?sandbox` во вьюпорте **1488×630** (dpr 1). При такой ширине остров в центре вьюпорта
     оказывается на 62% ширины итоговой картинки.
  2. Нажать уровень «2», «Заполнить всё», мечта «built 3». Панель песочницы скрыть целиком: `display: none`
     через `page.evaluate`.
  3. Подождать 2,5 с (вода, тени, анимации появления), добавить через `page.evaluate` плашку с текстом
     (ниже) и снять скриншот с `clip: { x: 0, y: 0, width: 1200, height: 630 }`.
  4. Плашка: `position: fixed; left: 56px; top: 50%; transform: translateY(-50%)`; ширина 470px;
     фон `rgba(255,251,243,.9)`, `backdrop-filter: blur(10px)`, радиус 28px, отступы 36px, тень как у `.panel`.
     Внутри сверху вниз: иконка `favicon.svg` 84px; «Архипелаг» — Unbounded 700, 58px, `#1F2A44`;
     «Уютная игра про деньги и свободу» — Manrope 800, 25px, `#5B6680`; кнопка-плашка
     «Играть бесплатно в браузере» — Manrope 800, 21px, фон `#F5B83D`, текст `#3A2600`, нижняя грань 4px `#D9931C`,
     радиус 14px, отступы 12px 20px. Промежутки 14px.
- Перед снимком дождаться `document.fonts.ready` и проверить `document.fonts.check('700 20px Unbounded')`.
  Если `false`, скрипт падает с ошибкой.
- Параметр `--lang en` скрипт пока не поддерживает — его добавит этап 3.

## 4. Заставка загрузки вместо белого экрана

Сейчас `main.tsx` рендерит `<Suspense fallback={null}>`. Пока грузится 3D-сцена (~1 МБ, 272 КБ gzip),
экран белый — на телефоне по 4G это несколько секунд.

- В `apps/web/index.html` внутри `<div id="root">` — разметка заставки, в `<head>` — её стили во встроенном
  `<style>`, чтобы она появилась до загрузки JS и CSS:
  - фон — вертикальный градиент `#7FBFE6` → `#FBE3C8` (небо → горизонт из арт-дирекшна);
  - по центру иконка — `favicon.svg` вставлен строкой (inline SVG), 88px;
  - под ней «Архипелаг»: `font: 700 28px Unbounded, system-ui, sans-serif`, цвет `#1F2A44`. Шрифт ещё не загружен,
    сработает запасной — это нормально;
  - под ним полоска 160×6px, радиус 3px, фон `rgba(31,42,68,.12)`; внутри бегунок 40% ширины цвета `#F5B83D`,
    бесконечно ездит слева направо (CSS-анимация 1,2 с, `ease-in-out`);
  - `prefers-reduced-motion: reduce` — бегунок стоит по центру, без анимации.
- Новый компонент `apps/web/src/Loader.tsx` с той же разметкой и классами. `main.tsx`: `<Suspense fallback={<Loader />}>`.
  Переход от HTML-заставки к React-заставке незаметен: React заменяет содержимое `#root` тем же самым.
- Заставка исчезает, когда загрузился `App` — так же, как сейчас появляется игра.

## 5. Разделение сборки

Почти весь вес чанка сцены — сама three.js; drei добавляет лишь ~5 КБ gzip (проверено), поэтому выкидывать
drei незачем. Делаем одно: выносим `three` и `@react-three/*` в отдельный вендорный чанк `three`. Тогда после
обновления кода игры браузер берёт three.js из кэша. Использовать опцию разделения чанков, которую советует
предупреждение сборки Vite 8 / Rolldown (`build.rolldownOptions.output…`). Порог предупреждения не поднимать:
если вендорный чанк больше 500 КБ, предупреждение остаётся, и это нормально.

## 6. Обращение к игроку — везде на «вы»

Интерфейс говорит «вы» («Ваши активы…», «Вы больше не работаете»), а часть ошибок движка — «ты».
Исправить в `packages/engine/src/text.ts`:

- «Такого объекта у тебя нет» → «Такого объекта у вас нет»;
- «Укажи сумму больше нуля» → «Укажите сумму больше нуля»;
- «Ты уже знаешь всё, чему здесь учат» → «Вы уже знаете всё, чему здесь учат».

Затем найти остальные места на «ты» во всех пользовательских строках `packages/engine/src` и `apps/web/src`:
`ты`, `тебя`, `тебе`, `тобой`, `твой`/`твоя`/`твоё`/`твои`, повелительное наклонение единственного числа
(«купи», «нажми», «укажи», «добавь», «убери»). Одно такое место уже известно — событие «Свобода под угрозой»
в `events.ts`: «Добавь доходных активов или убери лишние траты» → «Добавьте доходных активов или уберите лишние траты».
Исправить на «вы» и перечислить все правки в документе приёмки.
Комментарии в коде не трогать. Числа и логику не трогать. Тесты движка, которые сравнивают эти строки
(`test/actions.test.ts`: «Такого объекта у тебя нет», «Ты уже знаешь всё…», «Укажи сумму…»), обновить
на новые формулировки — только эти строки.

## 7. README

В начало `README.md`, сразу под заголовком: `**Играть:** https://dmtrml.github.io/archipelago/`.
В раздел «Запуск» — абзац «Публикация»: каждый push в `main` собирает игру и выкладывает её на GitHub Pages
(`.github/workflows/deploy.yml`); проверки — в `.github/workflows/ci.yml`.

## Что не входит

Лицензия кода (решение владельца), аналитика и отзывы (этап 2), английский (этап 3), PWA и офлайн-режим, свой домен.

## Критерии приёмки (по ним проверяет Claude)

1. `npm run typecheck`, `npm test`, `npm run build` проходят. `npm run sim` — тот же вывод, что на `main`.
2. Сборка с `VITE_BASE=/archipelago/`, `vite preview --base /archipelago/`. Скрипт `scripts/check-publish.mjs`
   (Playwright) открывает `/archipelago/`, начинает игру, включает звук и открывает `/archipelago/?sound`
   и `/archipelago/?sandbox`. Ни одного ответа 404 и ни одного запроса к `fonts.googleapis.com` / `fonts.gstatic.com`.
   Все 43 MP3 из `public/audio` отдаются с кодом 200: скрипт запрашивает их по путям из `cues.ts`.
   `document.fonts.check` истинно для `700 20px Unbounded` и `800 16px Manrope`.
3. Заставка: в том же скрипте эмуляция медленной сети через CDP (`Network.emulateNetworkConditions`:
   задержка 150 мс, 1,6 Мбит/с вниз, 0,75 Мбит/с вверх). Скриншот каждые 100 мс с начала загрузки до
   появления окна приветствия. На каждом кадре — либо заставка, либо игра, ни одного пустого белого кадра.
   Первый кадр с заставкой — не позже 1 с. 3–4 кадра — в документ приёмки.
4. `og-image.jpg` (1200×630, ≤ 300 КБ) и `apple-touch-icon.png` (180×180) лежат в `apps/web/public/`;
   картинка — в документе приёмки. В собранном `dist/index.html` `og:image` и `og:url` содержат полный адрес.
5. Workflows проходят `actionlint` (если установлен; иначе — проверить синтаксис вручную и записать это).
   CI в PR зелёный — это видно на самом PR.
6. Чанки после сборки перечислены в документе приёмки: есть отдельный `three-*.js`. Если поменять комментарий
   в `apps/web/src/ui/TopBar.tsx` и пересобрать, хеш `three-*.js` не меняется (правку потом откатить).
7. Список правок «ты → вы» и список найденных абсолютных путей — в документе приёмки.
8. Документ приёмки `docs/qa/launch-1-publish.md`, обновлены `STATUS.md` и `docs/status-history.md`.
