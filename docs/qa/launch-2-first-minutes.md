# Приёмка: запуск, этап 2 — первые минуты и распространение

Дата: 2026-10-05. База этапа: `fb9931e`.

## Проверки

1. `npm run typecheck`, `npm test` (140/140), `npm run build` проходят. `packages/engine/**` и `apps/web/src/store.ts` в этапе не изменялись.
2. `scripts/check-first-minutes.mjs` проходит на 390×844 и 1366×768. Скрипт через `offerViews` вычисляет лучший доступный актив, сверяет `data-offer-uid`, проходит покупку → следующую неделю → шкалу свободы, проверяет `archipelago.coach.v1 = "done"`, повторный запуск, skip, Escape и загруженное сохранение.
3. Сценарий «нет доступного актива» проверен синтетическим миром из текущего состояния: предложения временно ограничены статусными вещами/аферой; обучение начинает со шага 2. Реального начального seed с таким состоянием при предварительном поиске до 49 999 не найдено.
4. Web Share API проверен для свободы и эпилога, включая `?ref=share` и отсутствие имени/острова. Fallback без `navigator.share` пишет полный текст в clipboard и показывает тост «Скопировано — вставьте в сообщение или пост».
5. GoatCounter проверен с `VITE_GOATCOUNTER_URL=https://example.goatcounter.com/count`: запрос `gc.zgo.at/count.js` перехвачен, `game-start` и `week-5` доставлены в mock `window.goatcounter.count`, пользовательские тексты отсутствуют. Без переменной запросов нет.
6. Ссылка «Написать отзыв ↗» присутствует с `VITE_FEEDBACK_URL` и отсутствует без него; клики отправляют только событие `feedback-open`.
7. `scripts/check-sound.mjs`: 37 проверок, каталог 42, `maximumVoices=16`, `errors=0`, 6 скриншотов. `scripts/check-neighbors-top.mjs`: 10 desktop-сценариев, `runtimeErrors=0`, `consoleErrors=0`, exit 0.

## Скриншоты обучения

- [Шаг 1, 390 px](launch-2-first-minutes/screenshots/coach-1-390.jpg)
- [Шаг 2, 390 px](launch-2-first-minutes/screenshots/coach-2-390.jpg)
- [Шаг 3, 390 px](launch-2-first-minutes/screenshots/coach-3-390.jpg)
- [Шаг 1, 1366 px](launch-2-first-minutes/screenshots/coach-1-1366.jpg)
- [Шаг 2, 1366 px](launch-2-first-minutes/screenshots/coach-2-1366.jpg)
- [Шаг 3, 1366 px](launch-2-first-minutes/screenshots/coach-3-1366.jpg)

## Отклонения

Начальный мир без доступного актива не найден в диапазоне seed 0…49 999. По таблице запасных вариантов сценарий проверен синтетически: используется настоящий мир, но до срабатывания 600-мс таймера список предложений ограничивается заведомо неподходящими типами. Игровой код для этого не менялся.
