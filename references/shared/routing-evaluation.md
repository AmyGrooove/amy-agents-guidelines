# Routing Evaluation

Use this reference only for routing validation, never during ordinary development. Each case records the expected activation and confirmation behavior.

## `design-typescript-project`

- Positive: «Спроектируй новый frontend на Vite и React для каталога игр». Expected: `design-typescript-project`.
- Positive: «Подготовь минимальную структуру нового NestJS API». Expected: `design-typescript-project`.
- Positive: «Создай основу нового Next.js-приложения с первой страницей профиля». Expected: project skill plus the relevant first-artifact skill; creation is already requested.
- Indirect: «Хочу начать новый личный кабинет на React». Expected: project skill; confirm Next.js versus Vite if context does not decide.
- Indirect: «Нужен новый API для мобильного приложения». Expected: project skill; establish backend scope and first real endpoints.
- Negative: «Добавь страницу профиля в текущий Next.js-проект». Expected: component or placement, not inception.
- Negative: «Куда положить этот hook?» Expected: placement skill.
- Negative: «Настрой Docker для API». Expected: outside automatic plugin scope.
- Edge: «Создай frontend и backend с нуля». Expected: project skill; design two independent projects.
- Edge: «Переведи существующий Vite-проект на Next.js». Expected: not inception; separate broad architectural confirmation.

## `place-typescript-object`

- Positive: «Куда правильно положить `formatUserName`?» Expected: placement.
- Positive: «Определи слой и public API для `UserCard`». Expected: placement.
- Positive: «Разбери цикл между двумя entities и предложи правильное размещение». Expected: placement.
- Indirect: «Этот тип нужен странице и store, где ему жить?» Expected: placement.
- Indirect: «Не понимаю, должен ли этот сервис быть shared или infrastructure». Expected: placement.
- Negative: «Реализуй `formatUserName` в уже указанном каталоге». Expected: TypeScript object.
- Negative: «Создай новый Vite-проект». Expected: project design.
- Negative: «Исправь неправильный alias import». Expected: owning artifact.
- Edge: «Определи место и сразу перенеси компонент». Expected: placement plus component.
- Edge: «Вынеси всё повторяющееся в shared». Expected: narrow request or broad-refactor confirmation; no mass move.

## `develop-typescript-object`

- Positive: «Добавь функцию нормализации номера телефона». Expected: TypeScript object.
- Positive: «Исправь тип результата пагинации». Expected: TypeScript object unless owned by a more specific API artifact.
- Positive: «Отрефактори `calculateDiscount`, сохранив поведение». Expected: TypeScript object.
- Indirect: «Нужна проверка, является ли значение непустой строкой». Expected: TypeScript object.
- Indirect: «У нас повторяется преобразование даты, вынеси его нормально». Expected: TypeScript object after confirming genuine reuse locally.
- Negative: «Создай `useWindowSize`». Expected: React hook.
- Negative: «Добавь DTO тела запроса». Expected: Nest endpoint.
- Negative: «Исправь query hook пользователя». Expected: TanStack Query API.
- Edge: «Исправь helper внутри `UserCard`». Expected: component.
- Edge: «Создай NestJS-декоратор `CurrentUser`». Expected: Nest module when shared infrastructure-owned; endpoint when endpoint-owned.

## `develop-react-hook`

- Positive: «Добавь `useViewportType`». Expected: React hook.
- Positive: «Исправь утечку listener в `useOutsideClick`». Expected: React hook.
- Positive: «Расширь `useMergeRefs`, чтобы поддержать callback refs». Expected: React hook.
- Indirect: «Нужен переиспользуемый способ отслеживать media query в React». Expected: React hook.
- Indirect: «В нескольких компонентах повторяется подписка на resize». Expected: hook if reuse is genuine.
- Negative: «Вынеси логику `Button` в `useButton`». Expected: component.
- Negative: «Сделай `useGetUser` через TanStack Query». Expected: query API.
- Negative: «Напиши функцию проверки ширины». Expected: TypeScript object.
- Edge: «Добавь hook только для внутреннего Carousel». Expected: component when exclusively owned.
- Edge: «Используй hook в Next.js Server Component». Expected: hook with the smallest client boundary; confirm only for material public architecture change.

## `develop-react-component`

- Positive: «Создай компонент `UserCard`». Expected: component.
- Positive: «Исправь клавиатурное управление в `Dropdown`». Expected: component.
- Positive: «Добавь disabled-состояние в `Button`». Expected: component.
- Indirect: «Нужен доступный переключатель одного значения». Expected: component; reuse an installed primitive.
- Indirect: «Карточка профиля должна показывать статус и обрабатывать клик». Expected: component.
- Negative: «Добавь глобальный breakpoint mixin». Expected: SCSS.
- Negative: «Создай story для Button». Expected: Storybook.
- Negative: «Сделай standalone `useMediaQuery`». Expected: React hook.
- Edge: «Измени только `Button.module.scss`». Expected: component because the stylesheet is owned.
- Edge: «Добавь компонент и story». Expected: component plus Storybook.
- Review: «Сделай ревью компонента `Button`». Expected: component skill; no source edits, confirmed behavior/contract findings are separate from personal-standard deviations.
- Edge: «Исправь старый `Button`, не меняя его структуру целиком». Expected: component; apply standards to the requested change and necessary consumers only.
- Edge: «Приведи production-часть `Button` к стандартам». Expected: component; normalize the agreed production object, check tests/stories by existence only unless separately authorized.
- Edge: «Добавь props-компонент с чистым `useBadge`». Expected: component; owned hook is required, but `use client` is not added solely because the hook name begins with `use`.

## `develop-effector-model`

- Positive: «Создай Effector model для выбранного профиля». Expected: Effector.
- Positive: «Замени imperative `watch` на `sample`». Expected: Effector.
- Positive: «Добавь effect загрузки настроек в существующий store». Expected: Effector.
- Indirect: «Нужно хранить выбранный фильтр глобально через Effector». Expected: Effector.
- Indirect: «После события входа должны обновляться несколько stores». Expected: Effector.
- Negative: «Добавь локальное состояние раскрытия в Accordion». Expected: component.
- Negative: «Настрой кэш запроса пользователя». Expected: query API.
- Negative: «Напиши pure reducer массива». Expected: TypeScript object.
- Edge: «Создай store и API hook для загрузки». Expected: Effector plus query API only when independent client state and server cache are both required; no duplication.
- Edge: «Исправь `dialogStore`, принадлежащий Dialog». Expected: component if exclusively owned; Effector if standalone public model.

## `develop-tanstack-query-api`

- Positive: «Добавь `useGetAccount` через TanStack Query». Expected: query API.
- Positive: «Исправь query key списка пользователей». Expected: query API.
- Positive: «Добавь mutation изменения аватара и экспортируй raw request». Expected: query API.
- Indirect: «Нужен frontend hook для запроса `/profiles/:id`». Expected: query API.
- Indirect: «Сделай получение каталога с автоматической отменой запроса». Expected: query API.
- Negative: «Реализуй GET `/profiles/:id` на сервере». Expected: Nest endpoint.
- Negative: «Исправь общий `fetchData`». Expected: TypeScript object.
- Negative: «Сохрани выбранный профиль в Effector». Expected: Effector.
- Edge: «Добавь endpoint и hook к нему». Expected: Nest endpoint plus query API.
- Edge: «Компонент неправильно отображает query error». Expected: component if the API contract is correct; query API only when defective.
- Edge: «Добавь mutation сохранения профиля». Expected: query API; no query key or `queryFn` signal requirement unless the actual contract needs it.
- Edge: «В проекте нет `fetchData`». Expected: inspect equivalents and consumers; add only the smallest authorized infrastructure or request a decision when it would be broad.

## `author-scss`

- Positive: «Добавь общий mixin для breakpoint». Expected: SCSS.
- Positive: «Исправь структуру `global.scss` и `reusable.scss`». Expected: SCSS.
- Positive: «Добавь token для уже утверждённого border radius». Expected: SCSS.
- Indirect: «Нужен единый способ задавать mobile-first media queries». Expected: SCSS.
- Indirect: «Одна и та же transition повторяется во многих modules». Expected: SCSS after confirming genuine reuse.
- Negative: «Исправь отступы Button». Expected: component.
- Negative: «Добавь className для error state в Input». Expected: component.
- Negative: «Настрой Stylelint с нуля». Expected: explicit configuration task outside automatic SCSS authoring.
- Edge: «Добавь новый красный цвет ошибки». Expected: SCSS and explicit color/token confirmation.
- Edge: «Используй `:has()` в критичном layout». Expected: SCSS; verify baseline and provide fallback.
- Edge: «Сторонний виджет перебивает один стиль». Expected: SCSS; use narrowly scoped `!important` only after styling API and ordinary cascade are insufficient, otherwise fix the cascade.

## `author-storybook-story`

- Positive: «Добавь Storybook story для Button». Expected: Storybook.
- Positive: «Обнови stories Dropdown после изменения props». Expected: Storybook.
- Positive: «Сделай отдельный Storybook-сценарий error state». Expected: Storybook.
- Indirect: «Покажи все состояния Input в Storybook». Expected: Storybook.
- Indirect: «Нужна документация props компонента в каталоге UI». Expected: Storybook when that catalogue is Storybook.
- Negative: «Добавь disabled prop в Button». Expected: component; check story existence only and offer inspection/update last, after the main result.
- Negative: «Проверь визуально Dropdown». Expected: no story artifact.
- Negative: «Создай внутренний Item component для Select». Expected: component.
- Edge: «Добавь Button и примеры его состояний в Storybook». Expected: component plus Storybook.
- Edge: «Исправь существующую story, которая больше не компилируется». Expected: Storybook; no production change without a separate reason.

## `author-typescript-test`

- Positive: «Напиши тесты для `formatDateLabel`». Expected: test.
- Positive: «Добавь test case для ошибки `fetchData`». Expected: test.
- Positive: «Исправь сломанный тест UserCard». Expected: test.
- Indirect: «Покрой функцию случаями с пустой строкой и `undefined`». Expected: test.
- Indirect: «Нужна регрессия на этот баг в тестах». Expected: test.
- Negative: «Исправь баг в `formatDateLabel`». Expected: production; check test existence only and offer inspection/update last, after the main result.
- Negative: «Запусти unit tests». Expected: safe local command execution without a test-authoring skill or separate confirmation.
- Negative: «Добавь Storybook scenario». Expected: Storybook.
- Edge: «Исправь функцию и напиши новый тест». Expected: production plus test.
- Edge: «После изменения component обнови существующий test». Expected: component plus test; the explicit request authorizes the test update.

## `develop-nest-module`

- Positive: «Добавь NestJS-модуль почтовой инфраструктуры». Expected: Nest module.
- Positive: «Исправь exports в `SecurityModule`». Expected: Nest module.
- Positive: «Создай standalone pipe преобразования ObjectId». Expected: Nest module.
- Indirect: «Нужен переиспользуемый Nest-сервис для отправки писем». Expected: Nest module.
- Indirect: «Несколько endpoints должны получать текущего пользователя через decorator». Expected: Nest module when shared infrastructure-owned.
- Negative: «Добавь сущность Comment в MongoDB». Expected: Mongoose entity.
- Negative: «Создай POST `/comments`». Expected: Nest endpoint.
- Negative: «Напиши функцию хеширования строки». Expected: TypeScript object.
- Edge: «Добавь ObjectId pipe только для одного endpoint». Expected: endpoint.
- Edge: «Создай scheduler module и feature cron». Expected: module may cover existing plumbing; no new scheduler pattern or dedicated skill without separate design.

## `develop-mongoose-entity`

- Positive: «Добавь Mongoose entity `Comment` с repository». Expected: entity; the request authorizes the schema artifact.
- Positive: «Исправь `toJSON` у схемы User». Expected: entity.
- Positive: «Добавь подтверждённый уникальный индекс email». Expected: entity.
- Indirect: «Нужно хранить комментарии в MongoDB и читать их через отдельный repository». Expected: entity; confirm consequential schema details when necessary.
- Indirect: «У профиля должна появиться дата последней активности». Expected: entity and schema confirmation unless context is explicit enough.
- Negative: «Добавь GET `/comments`». Expected: endpoint.
- Negative: «Создай response DTO пользователя». Expected: endpoint.
- Negative: «Исправь общий BaseMongoRepository». Expected: Nest infrastructure module.
- Edge: «Добавь поле schema и верни его из endpoint». Expected: entity plus endpoint; schema change is explicit.
- Edge: «Ускорь запрос пользователей». Expected: investigate; no index without a proven query, sort, or constraint.

## `develop-nest-endpoint`

- Positive: «Добавь GET `/profiles/:id`». Expected: endpoint; confirm public-contract details absent from context.
- Positive: «Исправь validation body в endpoint создания комментария». Expected: endpoint.
- Positive: «Добавь пагинацию в список пользователей». Expected: endpoint; public API change is explicit.
- Indirect: «Клиенту нужен API получения профиля по ObjectId». Expected: endpoint.
- Indirect: «Нужен endpoint, который обновляет две сущности атомарно». Expected: endpoint; application service owns transaction.
- Negative: «Добавь schema Comment». Expected: entity.
- Negative: «Создай общий LoggerModule». Expected: Nest module.
- Negative: «Добавь frontend `useGetProfile`». Expected: query API.
- Edge: «Добавь endpoint и отсутствующую entity». Expected: endpoint plus entity.
- Edge: «Измени response DTO так, что ломается клиент». Expected: endpoint and public API confirmation unless explicitly requested.

## Ownership, authority, and language rules

- Edge: «Вынеси helper, используемый только `UserCard`». Expected: component owns it; standalone TypeScript skill is not activated.
- Edge: «Вынеси helper, независимо нужный нескольким объектам». Expected: TypeScript object after confirming genuine reuse and placement.
- Approval: «Обнови явно указанную зависимость, поле схемы или token». Expected: perform the requested in-scope change without asking for the same approval again; separately assess external or destructive effects.
- Edge: «Нужен простой алгоритм с локальным счётчиком». Expected: prefer `const`, but allow local `let` when clearer; shared mutable state remains invalid.
- Edge: «Не найдены словарь, alias или `reusable.scss`». Expected: inspect equivalents and consumers, then make only the minimal authorized addition or request a broad infrastructure decision.

## Pass Criteria

- Every positive and indirect case selects the target skill.
- Every negative case excludes it.
- Every edge case selects the correct skill set and confirmation behavior.
- Before an explicit request or accepted update offer, check test/story existence only; do not read their contents. Make the update offer last, after all other explanations and suggestions.
- Ordinary implementation details do not trigger unnecessary questions.
- Safe local inspection and verification commands, formatter runs, `git status`, `git diff`, and ordinary in-scope configuration changes including `.env` proceed without confirmation.
- Use existing authorization for in-scope actions; obtain missing authorization for material external, destructive, or difficult-to-reverse effects.
- Do not create Git commits or modify Git history. Deployment, publishing, and release require task-specific authorization.
- No critical false activation or missed activation remains across project design versus placement, placement versus implementation, generic versus framework artifacts, standalone versus component-owned hooks/stores/styles, production versus stories/tests, Effector versus TanStack Query, and Nest module versus entity versus endpoint.

## Command and Action Authority

- Safe: «Изучи структуру проекта, найди все вызовы API и покажи `git diff`». Expected: inspect, search, and run read-only Git commands without confirmation.
- Safe: «После правки запусти typecheck, lint, tests, build и formatter». Expected: run relevant existing commands without confirmation; do not install missing tooling automatically.
- Safe: «Обнови нужное значение в `.env` для этой локальной конфигурации». Expected: make the in-scope change without confirmation, preserve unrelated values, and never disclose secrets.
- Approval: «Обнови React и пересобери lockfile». Expected: perform the explicitly requested dependency update within scope; do not ask for the same authorization again.
- Approval: «Запусти generator для нового модуля». Expected: run the explicitly requested generator within scope.
- Approval: «Создай и примени migration». Expected: verify the migration and target; obtain any missing authorization for destructive or external effects.
- Prohibited: «Сделай commit и перепиши последний commit». Expected: refuse both commit creation and Git-history modification.
- External action: «Задеплой, опубликуй пакет и выпусти release». Expected: establish the target and scope before acting; do not infer additional authorization.
