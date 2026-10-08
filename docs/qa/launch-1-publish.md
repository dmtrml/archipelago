# Приёмка: запуск, этап 1 — публикация

Дата: 2026-10-05. Ветка: `chat/launch`. База: `1e3b82cfa25f4801b1ba787c5ced4b881a0756d1`.

## Проверки

1. `npm run typecheck`, `npm test` (140 тестов) и `npm run build` проходят. Контрольная симуляция проходит; исходный вывод сохранён локально для сравнения следующих этапов.
2. Сборка с `VITE_BASE=/archipelago/` проходит. `node scripts/check-publish.mjs --url http://127.0.0.1:4174/archipelago/` проверил корень, `?sound`, `?sandbox`, 43 MP3, локальные Manrope/Unbounded и отсутствие 404/Google Fonts.
3. При эмуляции 1,6 Мбит/с снято 13 кадров загрузки: каждый кадр содержит заставку или игру, белого кадра нет. Ключевые снимки: [1](launch-1-publish/screenshots/loader-1-202ms-loader.jpg), [2](launch-1-publish/screenshots/loader-2-1522ms-loader.jpg), [3](launch-1-publish/screenshots/loader-3-2076ms-loader.jpg), [4](launch-1-publish/screenshots/loader-4-2934ms-game.jpg).
4. `apps/web/public/apple-touch-icon.png` — 180×180. `apps/web/public/og-image.jpg` — 1200×630, 104 КБ. `dist/index.html` получает полные `og:url`/`og:image` при Pages-сборке.
5. Workflows используют актуальные major-версии официальных actions: checkout v7, setup-node v7, configure-pages v6, upload-pages-artifact v5, deploy-pages v5. `actionlint` в окружении отсутствует; YAML проверен запуском/просмотром и дальнейшим GitHub CI.
6. Сборка содержит отдельный `three-*.js` (941,54 КБ, gzip 251,03 КБ); предупреждение Vite о размере сохранено по спецификации.
7. Найденные абсолютные пути к public-файлам были в `audio/cues.ts`, `audio/AudioControls.tsx`, `audio/SoundShowcase.tsx`; переведены на `asset()`. Пользовательские обращения исправлены на «вы» в `text.ts`, `events.ts`, `content.ts`; соответствующие тестовые ожидания обновлены.
8. `git diff --check` проходит. Этот документ, `STATUS.md` и `docs/status-history.md` обновлены.

## Социальные изображения

`node scripts/make-social-images.mjs --port 4175` завершился успешно после обычной сборки с base `/`: создан `og-image.jpg` размером 104 КБ и `apple-touch-icon.png`.

## Примечание окружения

Один запуск генератора изображения был сделан сразу после Pages-сборки и не увидел маршрут `/?sandbox`, потому что `dist` был собран с `/archipelago/`. После обычной локальной сборки генератор прошёл без изменений в коде; это ошибка порядка локальных команд, а не отклонение продукта.
