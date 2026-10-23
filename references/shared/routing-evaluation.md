# Routing Evaluation

Use this reference only for routing validation, never during ordinary development. Each case records the expected activation and confirmation behavior.

## Evaluation Procedure

Use [the evaluation runner](../../scripts/evaluateRouting.mjs). Node.js and the existing integrity validator require no extra dependencies. The Markdown catalog is the single source of prompts and human-readable expectations; IDs are stable, so retain them when editing wording.

### Script checks

Run from the plugin root:

```powershell
node --check scripts/evaluateRouting.mjs
node scripts/verifyPlugin.mjs .
node scripts/evaluateRouting.mjs check
```

These check syntax, plugin integrity, catalog IDs, damaged text, and positive/negative coverage for every installed skill. They do not evaluate model behavior. The result validator compares recorded skill sets and validates review evidence; it does not infer semantic compliance from strings. New preparations use schemaVersion=2, which requires quality criteria for execution reports. Existing schemaVersion=1 reports remain readable and are reported without execution-quality coverage. Source fingerprints also include the evaluation and integrity scripts.

### Real-agent routing decisions

Prepare a new directory outside any production project and outside the plugin:

```powershell
$runDir = Join-Path $env:TEMP ('amy-routing-' + (Get-Date -Format 'yyyyMMdd-HHmmss'))
node scripts/evaluateRouting.mjs prepare $runDir
$env:CODEX_HOME = 'C:\Users\vanya\.codex'
node scripts/evaluateRouting.mjs run $runDir consumer-and-ownership-boundaries-01
```

Each run starts a fresh, ephemeral `codex exec` in the read-only fixture. The runner saves JSONL events, stderr, final response, exit status, timestamps, source fingerprint, and exact arguments. It has a two-minute timeout and never retries silently. Set `AMY_CODEX_BIN` to an absolute CLI path if needed. A successful process is `needs-review`, never automatically a pass. Failed launch, timeout, or unavailable authentication/network is `blocked`, not a model failure.

Run all catalog cases only after verifying one real launch:

```powershell
$cases = Get-Content -Raw -Encoding utf8 (Join-Path $runDir 'expectations.json') | ConvertFrom-Json
foreach ($case in $cases) {
  node scripts/evaluateRouting.mjs run $runDir $case.id
  if ($LASTEXITCODE -ne 0) { break }
}
```

Use a new preparation for repetitions (at least three for changed routes and nearest negative cases). Keep the model/configuration fixed and record the actual model and effort from runtime metadata; if absent from the transcript, record the configured values with that provenance, never present them as runtime-confirmed. The fixture contains skills and references, with the evaluation catalog replaced by a withheld stub. Expectations stay outside it. Do not give the agent access to the run directory, source plugin, or expected result. Read-only is a write restriction, not read isolation: review events for forbidden reads; accessing the withheld stub alone does not reveal answers. Its prompt includes only skill descriptions and the hypothetical task. Review actual tool events to confirm which skills/references were read; self-reported selection alone is insufficient. Reject unexpected reference loading and unnecessary activations as well as missed skills. Other plugin/process skills are recorded separately; Amy sets include the entry router for writes and exclude it for read-only requests. Artifact expectations below omit that common router unless routing itself is under evaluation.

If automatic launch is unavailable, start a fresh agent session rooted at `$runDir/fixture`, with read-only tools, and paste exactly one generated `prompts/<id>.txt`. Export its complete transcript to `runs/<id>.manual.txt`; record actual model, effort, harness, and timestamps. Do not use the current agent, which has seen expectations. Mark unperformed cases `not-run`; preserve launch errors as `blocked`.

### Actual action boundaries

Routing decisions establish decisions and reference selection only. They do not prove that an implementing agent preserves files or respects permissions while acting. For an execution check, use a fresh disposable fixture with the smallest neighboring production artifacts required by the case, applicable user rules, and pre-existing dirty changes. Supply that fixture and its before-state to the reviewer before launch. Do not use real projects, credentials, databases, external services, commits, or deployment. Under this task's restrictions do not run, create, or modify tests or Storybook: those cases can only receive routing-decision evidence; execution remains unobserved.

For permitted execution cases, change the fixture instruction from hypothetical evaluation to the original task, retain only skill descriptions and required fixture context, and start a separate fresh agent with writes restricted to that fixture. Capture full tool calls, before/after file hashes and diff, and attempted commands including refusals. Review dirty-change preservation, touched consumers, forbidden actions, authorization, and clarification against the expectation. A sandbox refusal alone proves enforcement by the harness, not agent compliance. Missing representative fixtures or evidence means `unobserved`, never pass. The run command executes routing decisions; execute-config is the bounded action check below.

A reproducible permitted execution case is available for the router's configuration request. It creates a disposable fixture, a pre-existing user file, and supplies the concrete parameters root=true, section [*], indent_style=space, indent_size=2:

```powershell
$executionDir = Join-Path $env:TEMP ('amy-routing-execution-' + (Get-Date -Format 'yyyyMMdd-HHmmss'))
$env:CODEX_HOME = 'C:\Users\vanya\.codex'
node scripts/evaluateRouting.mjs execute-config $executionDir
```

This uses UTF-8 stdin directly from Node and a workspace-write agent sandbox. It saves before/after hashes for every fixture file along with raw agent events and the final answer. An independent reviewer must verify that only .editorconfig was added, its settings match, unrelated hashes remain unchanged, the router was actually read, and no unauthorized actions or unnecessary confirmation occurred. Record phase=execution and caseId=route-project-changes-01, with before.json and after.json among evidence paths, then run the results command against executionDir. This one-case fixture variant does not establish action compliance for other artifacts. Routing and execution reports use separate manifests and cannot mix phases.

### Execution Quality Review

For schemaVersion=2 execution records, review the actual diff, before/after artifacts, necessary consumers, and tool events. In addition to activation, scope, and permissions, require these criteria:

| Criterion | Evidence required |
| --- | --- |
| ruleCompliance | Task-relevant requirements with source locations and the code or action satisfying each. Exclude inapplicable conditions; distinguish behavior defects from standard deviations. |
| necessity | Purpose of added helpers, layers, branches, conversions, fallbacks, and catches; compare with a direct implementation under the same standards. Identify removable additions concretely, not by line count. Required file structure is not redundant runtime logic. |
| behaviorPreservation | Requested behavior and affected contracts, including errors and runtime validation. Identify what static inspection establishes and what requires unperformed runtime checks. Preserve unrelated user changes. |

Record criterionNotes with a non-empty explanation for every criterion, citing artifact locations or tool events and unresolved limits. Include before.json and after.json in evidence. Missing evidence or uncertainty about a required property is unobserved, not pass. A confirmed violation is fail. A shorter implementation that removes required behavior fails; a necessary boundary or lifecycle mechanism passes necessity when its purpose is evidenced. Do not reverse a verdict merely because a user challenges it.

The validator enforces the record shape, required criteria, and consistency of the final status; a reviewer must establish semantic correctness. A process exit code, self-reported checklist, or success on a routing/configuration case does not establish TypeScript quality. Select artifact-representative execution cases only when their evaluation is authorized. Do not run or create tests, stories, or agent experiments solely because this rubric exists.

### Recorded results

Append one JSON object per line to `results.jsonl` after independent transcript review. Exact record shape for an observed result:

```json
{
  "caseId": "consumer-and-ownership-boundaries-01",
  "snapshot": "<manifest.json snapshot>",
  "phase": "routing-decision",
  "status": "pass",
  "agent": { "harness": "codex exec", "model": "<observed>", "effort": "<observed or unavailable>" },
  "reviewer": "<reviewer identity>",
  "reviewedAt": "<ISO-8601 UTC>",
  "selectedSkills": ["route-project-changes", "develop-react-component"],
  "expectedSkills": ["route-project-changes", "develop-react-component"],
  "ownership": "UserCard owns the caller option",
  "allowedChanges": ["UserCard caller enabled option"],
  "clarification": [],
  "prohibitedActions": ["API changes", "test/story reads or changes", "commits"],
  "criteria": { "activation": "pass", "scope": "pass", "permissions": "pass" },
  "evidence": ["runs/consumer-and-ownership-boundaries-01.events.jsonl", "runs/consumer-and-ownership-boundaries-01.response.txt"],
  "notes": "<event locations and reasoning for each verdict; only decisions observed>"
}
```

The example is a format, not a recorded pass. Allowed `phase`: `routing-decision` or `execution`; `status`: `pass`, `fail`, `blocked`, `not-run`; criterion: `pass`, `fail`, `unobserved`. Include ownership, allowed changes, clarification, prohibited actions, and notes for every reviewed record. For `blocked`/`not-run`, retain caseId, snapshot, phase, status, reason, and available evidence. Derive expectedSkills independently from the catalog and actual fixture context, document conditional choices before scoring, and include every Amy activation in selectedSkills. Compare exact sets, not substring matches. Review scope and permissions semantically using tool events. For schemaVersion=2 execution, add ruleCompliance, necessity, and behaviorPreservation to criteria, provide criterionNotes for all six criteria, and include before.json and after.json in evidence as described above. The routing-decision example retains three criteria. Do not mix phases in a success total.

```powershell
node scripts/evaluateRouting.mjs results $runDir
```

Exit 0 requires all cases recorded as passing; 2 means incomplete, blocked, or failed; 1 means malformed input. Even a complete routing-decision report does not prove execution behavior. Review uses the saved manifest and evidence even if source guidance later changes; do not combine snapshots. Report case IDs and phases actually run, blocked/not-run cases, and evidence location separately from this expectation catalog.


## Consumer and Ownership Boundaries

- [consumer-and-ownership-boundaries-01] Caller only: «Измени только enabled в вызове useGetUser внутри UserCard; сам API исправен». Expected: `develop-react-component`; no API skill.
- [consumer-and-ownership-boundaries-02] API with caller adaptation: «Измени query key в useGetUser и механически адаптируй его вызов в UserCard без изменения поведения компонента». Expected: `develop-tanstack-query-api`; its consumer update does not separately activate the component skill.
- [consumer-and-ownership-boundaries-03] Two behaviors: «Измени query key в useGetUser и также измени отображение ошибки в UserCard». Expected: `develop-tanstack-query-api` plus `develop-react-component`.
- [consumer-and-ownership-boundaries-04] Owned pure hook: «Исправь вычисление props в чистом useBadge, принадлежащем только Badge». Expected: `develop-react-component`; preserve the required owned hook, no standalone hook skill.
- [consumer-and-ownership-boundaries-05] Standalone request: «Исправь standalone fetchUser, не входящий в query API; TanStack Query лишь установлен в проекте». Expected: `develop-typescript-object`; an installed library alone does not select its skill.
- [consumer-and-ownership-boundaries-06] Extracted reuse: «Вынеси повторяющуюся resize-подписку из двух компонентов в общий useWindowSize и замени их подписки вызовом hook без изменения поведения». Expected: `develop-react-hook`; mechanical consumer adaptation stays in scope, independent component behavior changes require the component skill.

## `design-typescript-project`

- [design-typescript-project-01] Positive: «Спроектируй новый frontend на Vite и React для каталога игр». Expected: `design-typescript-project`.
- [design-typescript-project-02] Positive: «Подготовь минимальную структуру нового NestJS API». Expected: `design-typescript-project`.
- [design-typescript-project-03] Positive: «Создай основу нового Next.js-приложения с первой страницей профиля». Expected: project skill plus the relevant first-artifact skill; creation is already requested.
- [design-typescript-project-04] Indirect: «Хочу начать новый личный кабинет на React». Expected: project skill; confirm Next.js versus Vite if context does not decide.
- [design-typescript-project-05] Indirect: «Нужен новый API для мобильного приложения». Expected: project skill; establish backend scope and first real endpoints.
- [design-typescript-project-06] Negative: «Добавь страницу профиля в текущий Next.js-проект». Expected: component or placement, not inception.
- [design-typescript-project-07] Negative: «Куда положить этот hook?» Expected: placement skill.
- [design-typescript-project-08] Negative: «Настрой Docker для API». Expected: outside automatic plugin scope.
- [design-typescript-project-09] Edge: «Создай frontend и backend с нуля». Expected: project skill; design two independent projects.
- [design-typescript-project-10] Edge: «Переведи существующий Vite-проект на Next.js». Expected: not inception; separate broad architectural confirmation.
- [design-typescript-project-11] Negative: "Design only layers, aliases, and public APIs for a new Vite React project; components, rendering, client boundaries, and styles are outside the task". Expected: design-typescript-project for read-only design; project architecture, no React or SCSS reference, no artifact skills or router.
- [design-typescript-project-12] Positive: "Design a new frontend with components, client boundaries, tokens, and global SCSS infrastructure; do not create files". Expected: design-typescript-project; project architecture plus React and SCSS references; no writing router.
- [design-typescript-project-13] Positive: "Design a minimal NestJS API without persistence; do not create files". Expected: design-typescript-project with NestJS reference; no Mongoose reference or entity skill.
- [design-typescript-project-14] Positive: "Design a new NestJS API with Mongoose persistence; do not create files". Expected: design-typescript-project with NestJS and Mongoose references; no writing router.


## `place-typescript-object`

- [place-typescript-object-01] Positive: «Куда правильно положить `formatUserName`?» Expected: placement.
- [place-typescript-object-02] Positive: «Определи слой и public API для `UserCard`». Expected: placement.
- [place-typescript-object-03] Positive: «Разбери цикл между двумя entities и предложи правильное размещение». Expected: placement.
- [place-typescript-object-04] Indirect: «Этот тип нужен странице и store, где ему жить?» Expected: placement.
- [place-typescript-object-05] Indirect: «Не понимаю, должен ли этот сервис быть shared или infrastructure». Expected: placement.
- [place-typescript-object-06] Negative: «Реализуй `formatUserName` в уже указанном каталоге». Expected: TypeScript object.
- [place-typescript-object-07] Negative: «Создай новый Vite-проект». Expected: project design.
- [place-typescript-object-08] Negative: «Исправь неправильный alias import». Expected: owning artifact.
- [place-typescript-object-09] Edge: «Определи место и сразу перенеси компонент». Expected: placement plus component.
- [place-typescript-object-10] Edge: «Вынеси всё повторяющееся в shared». Expected: narrow request or broad-refactor confirmation; no mass move.
- [place-typescript-object-11] Negative: "Design layers and planned public APIs for a new Vite project, without writing files". Expected: design-typescript-project; no place-typescript-object or router loading.
- [place-typescript-object-12] Positive: "Determine the owning layer and public API for standalone formatUserName in an existing project; do not implement or move it". Expected: place-typescript-object with project architecture reference; no router, project inception, or implementation skill.


## `develop-typescript-object`

- [develop-typescript-object-01] Positive: «Добавь функцию нормализации номера телефона». Expected: TypeScript object.
- [develop-typescript-object-02] Positive: «Исправь тип результата пагинации». Expected: TypeScript object unless owned by a more specific API artifact.
- [develop-typescript-object-03] Positive: «Отрефактори `calculateDiscount`, сохранив поведение». Expected: TypeScript object.
- [develop-typescript-object-04] Indirect: «Нужна проверка, является ли значение непустой строкой». Expected: TypeScript object.
- [develop-typescript-object-05] Indirect: «У нас повторяется преобразование даты, вынеси его нормально». Expected: TypeScript object after confirming genuine reuse locally.
- [develop-typescript-object-06] Negative: «Создай `useWindowSize`». Expected: React hook.
- [develop-typescript-object-07] Negative: «Добавь DTO тела запроса». Expected: Nest endpoint.
- [develop-typescript-object-08] Negative: «Исправь query hook пользователя». Expected: TanStack Query API.
- [develop-typescript-object-09] Edge: «Исправь helper внутри `UserCard`». Expected: component.
- [develop-typescript-object-10] Edge: «Создай NestJS-декоратор `CurrentUser`». Expected: Nest module when shared infrastructure-owned; endpoint when endpoint-owned.
- [develop-typescript-object-11] Edge: «Исправить вычисление внутри существующей функции без изменения её границ и импортов». Expected: TypeScript object; архитектурный reference не обязателен.
- [develop-typescript-object-12] Edge: «Добавить межобъектный импорт в standalone функцию». Expected: TypeScript object plus архитектурный reference; placement skill не обязателен при очевидном размещении.

## `develop-react-hook`

- [develop-react-hook-01] Positive: «Добавь `useViewportType`». Expected: React hook.
- [develop-react-hook-02] Positive: «Исправь утечку listener в `useOutsideClick`». Expected: React hook.
- [develop-react-hook-03] Positive: «Расширь `useMergeRefs`, чтобы поддержать callback refs». Expected: React hook.
- [develop-react-hook-04] Indirect: «Нужен переиспользуемый способ отслеживать media query в React». Expected: React hook.
- [develop-react-hook-05] Indirect: «В нескольких компонентах повторяется подписка на resize». Expected: hook if reuse is genuine.
- [develop-react-hook-06] Negative: «Вынеси логику `Button` в `useButton`». Expected: component.
- [develop-react-hook-07] Negative: «Сделай `useGetUser` через TanStack Query». Expected: query API.
- [develop-react-hook-08] Negative: «Напиши функцию проверки ширины». Expected: TypeScript object.
- [develop-react-hook-09] Edge: «Добавь hook только для внутреннего Carousel». Expected: component when exclusively owned.
- [develop-react-hook-10] Edge: «Используй hook в Next.js Server Component». Expected: hook with the smallest client boundary; confirm only for material public architecture change.

## `develop-react-component`

- [develop-react-component-01] Positive: «Создай компонент `UserCard`». Expected: component.
- [develop-react-component-02] Positive: «Исправь клавиатурное управление в `Dropdown`». Expected: component.
- [develop-react-component-03] Positive: «Добавь disabled-состояние в `Button`». Expected: component.
- [develop-react-component-04] Indirect: «Нужен доступный переключатель одного значения». Expected: component; reuse an installed primitive.
- [develop-react-component-05] Indirect: «Карточка профиля должна показывать статус и обрабатывать клик». Expected: component.
- [develop-react-component-06] Negative: «Добавь глобальный breakpoint mixin». Expected: SCSS.
- [develop-react-component-07] Negative: «Создай story для Button». Expected: Storybook.
- [develop-react-component-08] Negative: «Сделай standalone `useMediaQuery`». Expected: React hook.
- [develop-react-component-09] Edge: «Измени только `Button.module.scss`». Expected: component because the stylesheet is owned.
- [develop-react-component-10] Edge: «Добавь компонент и story». Expected: component plus Storybook.
- [develop-react-component-11] Review: «Сделай ревью компонента `Button`». Expected: component skill; no source edits, confirmed behavior/contract findings are separate from personal-standard deviations.
- [develop-react-component-12] Edge: «Исправь обработчик старого `Button`, не меняя его структуру целиком». Expected: component; change only the handler and necessary consumers, not extract a hook solely for normalization. References: TypeScript and React.
- [develop-react-component-13] Edge: «Создай новый `Button`». Expected: component; apply the full applicable standard to the new object and only necessary artifacts. References: TypeScript, React, and SCSS when styling is required.
- [develop-react-component-14] Edge: «Приведи production-часть `Button` к стандартам». Expected: component; normalize the agreed production object, read relevant tests/stories as needed; do not run or change them unless separately authorized.
- [develop-react-component-15] Edge: «Добавь props-компонент с чистым `useBadge`». Expected: component; owned hook is required, but `use client` is not added solely because the hook name begins with `use`.
- [develop-react-component-16] Edge: «Изменить цвет `.label` внутри disabled-состояния Button». Expected: Component skill; базовая `.label` наверху, вложенное переопределение состояния разрешено.

## `develop-effector-model`

- [develop-effector-model-01] Positive: «Создай Effector model для выбранного профиля». Expected: Effector.
- [develop-effector-model-02] Positive: «Замени imperative `watch` на `sample`». Expected: Effector.
- [develop-effector-model-03] Positive: «Добавь effect загрузки настроек в существующий store». Expected: Effector.
- [develop-effector-model-04] Indirect: «Нужно хранить выбранный фильтр глобально через Effector». Expected: Effector.
- [develop-effector-model-05] Indirect: «После события входа должны обновляться несколько stores». Expected: Effector.
- [develop-effector-model-06] Negative: «Добавь локальное состояние раскрытия в Accordion». Expected: component.
- [develop-effector-model-07] Negative: «Настрой кэш запроса пользователя». Expected: query API.
- [develop-effector-model-08] Negative: «Напиши pure reducer массива». Expected: TypeScript object.
- [develop-effector-model-09] Edge: «Создай store и API hook для загрузки». Expected: Effector plus query API only when independent client state and server cache are both required; no duplication.
- [develop-effector-model-10] Edge: «Исправь `dialogStore`, принадлежащий Dialog». Expected: component if exclusively owned; Effector if standalone public model.
- [develop-effector-model-11] Edge: «Исправь один `sample`, рядом есть не относящаяся к ошибке обёртка». Expected: Effector; repair the requested link without automatically removing the wrapper.

## `develop-tanstack-query-api`

- [develop-tanstack-query-api-01] Positive: «Добавь `useGetAccount` через TanStack Query». Expected: query API.
- [develop-tanstack-query-api-02] Positive: «Исправь query key списка пользователей». Expected: query API.
- [develop-tanstack-query-api-03] Positive: «Добавь mutation изменения аватара и экспортируй raw request». Expected: query API.
- [develop-tanstack-query-api-04] Indirect: «Нужен frontend hook для запроса `/profiles/:id`». Expected: query API.
- [develop-tanstack-query-api-05] Indirect: «Сделай получение каталога с автоматической отменой запроса». Expected: query API.
- [develop-tanstack-query-api-06] Negative: «Реализуй GET `/profiles/:id` на сервере». Expected: Nest endpoint.
- [develop-tanstack-query-api-07] Negative: «Исправь общий `fetchData`». Expected: TypeScript object.
- [develop-tanstack-query-api-08] Negative: «Сохрани выбранный профиль в Effector». Expected: Effector.
- [develop-tanstack-query-api-09] Edge: «Добавь endpoint и hook к нему». Expected: Nest endpoint plus query API.
- [develop-tanstack-query-api-10] Edge: «Компонент неправильно отображает query error». Expected: component if the API contract is correct; query API only when defective.
- [develop-tanstack-query-api-11] Edge: «Добавь mutation сохранения профиля». Expected: query API; no query key or `queryFn` signal requirement unless the actual contract needs it.
- [develop-tanstack-query-api-12] Edge: «В проекте нет `fetchData`». Expected: inspect equivalents and consumers; add only the smallest authorized infrastructure or request a decision when it would be broad.
- [develop-tanstack-query-api-13] Edge: «Создать самостоятельную `loadProfile` без React и TanStack Query». Expected: TypeScript object; query skill не активируется, hook не добавляется.
- [develop-tanstack-query-api-14] Edge: «Исправить только raw request внутри `useGetProfile`». Expected: TanStack Query API skill, несмотря на отсутствие изменений hook.
- [develop-tanstack-query-api-15] Negative: "Change only the query key in useGetProfile; HTTP request, response, error, and transport semantics remain unchanged". Expected: router plus develop-tanstack-query-api; TypeScript and TanStack Query references, no backend contracts reference or backend skill.
- [develop-tanstack-query-api-16] Positive: "Fix HTTP error mapping in the raw request of useGetProfile according to the backend contract". Expected: router plus develop-tanstack-query-api with backend contracts reference; no endpoint skill unless server behavior also changes.


## `author-scss`

- [author-scss-01] Positive: «Добавь общий mixin для breakpoint». Expected: SCSS.
- [author-scss-02] Positive: «Исправь структуру `global.scss` и `reusable.scss`». Expected: SCSS.
- [author-scss-03] Positive: «Добавь token для уже утверждённого border radius». Expected: SCSS.
- [author-scss-04] Indirect: «Нужен единый способ задавать mobile-first media queries». Expected: SCSS.
- [author-scss-05] Indirect: «Одна и та же transition повторяется во многих modules». Expected: SCSS after confirming genuine reuse.
- [author-scss-06] Negative: «Исправь отступы Button». Expected: component.
- [author-scss-07] Negative: «Добавь className для error state в Input». Expected: component.
- [author-scss-08] Negative: «Настрой Stylelint с нуля». Expected: explicit configuration task outside automatic SCSS authoring.
- [author-scss-09] Edge: «Добавь token ошибки со значением `#D92D20` в известную палитру». Expected: SCSS; add the authorized value without asking again.
- [author-scss-10] Edge: «Добавь новый цвет ошибки». Expected: SCSS; if the palette and request do not determine the value, ask for the value or visual decision, not permission to add a color.
- [author-scss-11] Edge: «Используй `:has()` в критичном layout». Expected: SCSS; verify baseline and provide fallback.
- [author-scss-12] Edge: «Сторонний виджет перебивает один стиль». Expected: SCSS; use narrowly scoped `!important` only after styling API and ordinary cascade are insufficient, otherwise fix the cascade.

## `author-storybook-story`

- [author-storybook-story-01] Positive: «Добавь Storybook story для Button». Expected: Storybook.
- [author-storybook-story-02] Positive: «Обнови stories Dropdown после изменения props». Expected: Storybook.
- [author-storybook-story-03] Positive: «Сделай отдельный Storybook-сценарий error state». Expected: Storybook.
- [author-storybook-story-04] Indirect: «Покажи все состояния Input в Storybook». Expected: Storybook.
- [author-storybook-story-05] Indirect: «Нужна документация props компонента в каталоге UI». Expected: Storybook when that catalogue is Storybook.
- [author-storybook-story-06] Negative: «Добавь disabled prop в Button». Expected: component; read relevant stories as needed and offer updates last, after the main result.
- [author-storybook-story-07] Negative: «Проверь визуально Dropdown». Expected: no story artifact.
- [author-storybook-story-08] Negative: «Создай внутренний Item component для Select». Expected: component.
- [author-storybook-story-09] Edge: «Добавь Button и примеры его состояний в Storybook». Expected: component plus Storybook.
- [author-storybook-story-10] Edge: «Исправь существующую story, которая больше не компилируется». Expected: Storybook; no production change without a separate reason.

## `author-typescript-test`

- [author-typescript-test-01] Positive: «Напиши тесты для `formatDateLabel`». Expected: test.
- [author-typescript-test-02] Positive: «Добавь test case для ошибки `fetchData`». Expected: test.
- [author-typescript-test-03] Positive: «Исправь сломанный тест UserCard». Expected: test.
- [author-typescript-test-04] Indirect: «Покрой функцию случаями с пустой строкой и `undefined`». Expected: test.
- [author-typescript-test-05] Indirect: «Нужна регрессия на этот баг в тестах». Expected: test.
- [author-typescript-test-06] Negative: «Исправь баг в `formatDateLabel`». Expected: production; read relevant tests as needed and offer updates last, after the main result.
- [author-typescript-test-07] Negative: «Запусти unit tests». Expected: safe local command execution without a test-authoring skill or separate confirmation.
- [author-typescript-test-08] Negative: «Добавь Storybook scenario». Expected: Storybook.
- [author-typescript-test-09] Edge: «Исправь функцию и напиши новый тест». Expected: production plus test.
- [author-typescript-test-10] Edge: «После изменения component обнови существующий test». Expected: component plus test; the explicit request authorizes the test update.

## `develop-nest-module`

- [develop-nest-module-01] Positive: «Добавь NestJS-модуль почтовой инфраструктуры». Expected: Nest module.
- [develop-nest-module-02] Positive: «Исправь exports в `SecurityModule`». Expected: Nest module.
- [develop-nest-module-03] Positive: «Создай standalone pipe преобразования ObjectId». Expected: Nest module.
- [develop-nest-module-04] Indirect: «Нужен переиспользуемый Nest-сервис для отправки писем». Expected: Nest module.
- [develop-nest-module-05] Indirect: «Несколько endpoints должны получать текущего пользователя через decorator». Expected: Nest module when shared infrastructure-owned.
- [develop-nest-module-06] Negative: «Добавь сущность Comment в MongoDB». Expected: Mongoose entity.
- [develop-nest-module-07] Negative: «Создай POST `/comments`». Expected: Nest endpoint.
- [develop-nest-module-08] Negative: «Напиши функцию хеширования строки». Expected: TypeScript object.
- [develop-nest-module-09] Edge: «Добавь ObjectId pipe только для одного endpoint». Expected: endpoint.
- [develop-nest-module-10] Edge: «Создай scheduler module и feature cron». Expected: module may cover existing plumbing; no new scheduler pattern or dedicated skill without separate design.

## `develop-mongoose-entity`

- [develop-mongoose-entity-01] Positive: «Добавь Mongoose entity `Comment` с repository». Expected: entity; the request authorizes the schema artifact.
- [develop-mongoose-entity-02] Positive: «Исправь `toJSON` у схемы User». Expected: entity.
- [develop-mongoose-entity-03] Positive: «Добавь подтверждённый уникальный индекс email». Expected: entity.
- [develop-mongoose-entity-04] Indirect: «Нужно хранить комментарии в MongoDB и читать их через отдельный repository». Expected: entity; confirm consequential schema details when necessary.
- [develop-mongoose-entity-05] Indirect: «У профиля должна появиться дата последней активности». Expected: entity and schema confirmation unless context is explicit enough.
- [develop-mongoose-entity-06] Negative: «Добавь GET `/comments`». Expected: endpoint.
- [develop-mongoose-entity-07] Negative: «Создай response DTO пользователя». Expected: endpoint.
- [develop-mongoose-entity-08] Negative: «Исправь общий BaseMongoRepository». Expected: Nest infrastructure module.
- [develop-mongoose-entity-09] Edge: «Добавь поле schema и верни его из endpoint». Expected: entity plus endpoint; schema change is explicit.
- [develop-mongoose-entity-10] Edge: «Ускорь запрос пользователей». Expected: investigate; no index without a proven query, sort, or constraint.

## `develop-nest-endpoint`

- [develop-nest-endpoint-01] Positive: «Добавь GET `/profiles/:id`». Expected: endpoint; confirm public-contract details absent from context.
- [develop-nest-endpoint-02] Positive: «Исправь validation body в endpoint создания комментария». Expected: endpoint.
- [develop-nest-endpoint-03] Positive: «Добавь пагинацию в список пользователей». Expected: endpoint; public API change is explicit.
- [develop-nest-endpoint-04] Indirect: «Клиенту нужен API получения профиля по ObjectId». Expected: endpoint.
- [develop-nest-endpoint-05] Indirect: «Нужен endpoint, который обновляет две сущности атомарно». Expected: endpoint; application service owns transaction.
- [develop-nest-endpoint-06] Negative: «Добавь schema Comment». Expected: entity.
- [develop-nest-endpoint-07] Negative: «Создай общий LoggerModule». Expected: Nest module.
- [develop-nest-endpoint-08] Negative: «Добавь frontend `useGetProfile`». Expected: query API.
- [develop-nest-endpoint-09] Edge: «Добавь endpoint и отсутствующую entity». Expected: endpoint plus entity.
- [develop-nest-endpoint-10] Edge: «Измени response DTO так, что ломается клиент». Expected: endpoint and public API confirmation unless explicitly requested.
- [develop-nest-endpoint-11] Edge: «Добавь поиск пользователей; поля поиска неизвестны». Expected: find the existing list and contract first; if neither decides name versus email search, ask that behavior question before dependent changes. References: backend contracts and NestJS.
- [develop-nest-endpoint-12] Edge: «Пользователь уже указал: только по имени». Expected: retain that answer and do not ask about email again.
- [develop-nest-endpoint-13] Edge: «Endpoint читает два репозитория, атомарный снимок не требуется». Expected: Endpoint skill; транзакция не требуется только из-за двух репозиториев.
- [develop-nest-endpoint-14] Edge: «Endpoint должен атомарно изменить две сущности с использованием транзакции». Expected: Endpoint skill; жизненным циклом и сессией управляет application service.

## Ownership, authority, and language rules

- [ownership-authority-and-language-rules-01] Edge: «Вынеси helper, используемый только `UserCard`». Expected: component owns it; standalone TypeScript skill is not activated.
- [ownership-authority-and-language-rules-02] Edge: «Вынеси helper, независимо нужный нескольким объектам». Expected: TypeScript object after confirming genuine reuse and placement.
- [ownership-authority-and-language-rules-03] Approval: «Обнови явно указанную зависимость, поле схемы или token». Expected: perform the requested in-scope change without asking for the same approval again; separately assess external or destructive effects.
- [ownership-authority-and-language-rules-04] Approval: «Обнови явно названную зависимость до указанной версии и lockfile». Expected: perform the authorized update without a second confirmation; do not use it to change unrelated environment configuration.
- [ownership-authority-and-language-rules-05] Approval: «Создай новый проект выбранного стека и запусти указанный generator». Expected: design skill; defined parameters authorize writing and generator execution.
- [ownership-authority-and-language-rules-06] Edge: «Нужен простой алгоритм с локальным счётчиком». Expected: prefer `const`, but allow local `let` when clearer; shared mutable state remains invalid.
- [ownership-authority-and-language-rules-07] Edge: «Не найдены словарь, alias или `reusable.scss`». Expected: inspect equivalents and consumers, then make only the minimal authorized addition or request a broad infrastructure decision.

## Pass Criteria

- Every positive and indirect case selects the target skill.
- Every negative case excludes it.
- Every edge case selects the correct skill set and confirmation behavior.
- Read relevant tests/stories as needed without separate approval; running, creating, or modifying them requires an explicit request or accepted offer. Make the update offer last, after all other explanations and suggestions.
- Ordinary implementation details do not trigger unnecessary questions.
- Safe local inspection and verification commands, formatter runs, `git status`, `git diff`, and ordinary in-scope configuration changes including `.env` proceed without confirmation.
- Use existing authorization for in-scope actions; obtain missing authorization for material external, destructive, or difficult-to-reverse effects.
- Do not create Git commits or modify Git history. Deployment, publishing, and release require task-specific authorization.
- No critical false activation or missed activation remains across project design versus placement, placement versus implementation, generic versus framework artifacts, standalone versus component-owned hooks/stores/styles, production versus stories/tests, Effector versus TanStack Query, and Nest module versus entity versus endpoint.

## Implementation Simplicity Cases

These cases also exercise implementation choice and necessity review. Routing runs establish only the selected route and stated approach. To establish implementation quality, use the existing execution-quality procedure with representative fixtures and inspect the actual diff; catalog validation alone is insufficient.

- [implementation-simplicity-01] Positive: Add a query API for an existing profile endpoint. The installed TanStack Query version and existing fetchData already provide cancellation and typed error propagation. Expected: router plus develop-tanstack-query-api; inspect and reuse those capabilities before coding, retain the raw request/hook object and public exports, and add no duplicate cancellation, cache, error wrapper, or unchanged rethrow.
- [implementation-simplicity-02] Positive: Add a boolean switch component using the installed accessible primitive. Only its value and change callback are required. Expected: router plus develop-react-component; reuse the primitive through allowed imports and preserve the required props file and owned hook, without an extra adapter, mirrored value state, forwarding-only handler, or speculative configuration.
- [implementation-simplicity-03] Positive: Add a Nest endpoint whose approved params pipe validates and converts ObjectId and whose existing entity repository supports the required lookup. Expected: router plus develop-nest-endpoint; inspect the pipe and repository before coding, keep controller/service/DTO/repository boundaries and response mapping, and add no second parser, generic lookup framework, or duplicate validation without a distinct contract or trust boundary.
- [implementation-simplicity-04] Negative: Implement a Nest operation updating two entities; the contract requires atomicity and rejects untrusted invalid input. Existing infrastructure supports transactions. Expected: router plus develop-nest-endpoint; retain boundary validation, entity repository boundaries, application-service-owned transaction lifecycle and session propagation; simplicity never authorizes dropping these requirements.
- [implementation-simplicity-05] Negative: Add a reusable React hook that subscribes to a browser event and releases its listener on unmount. Expected: router plus develop-react-hook; retain the effect, necessary state, stable subscription and cleanup; do not turn lifecycle logic into an unowned plain function to reduce code.
- [implementation-simplicity-06] Edge: Complete an authorized query API change. Its diff adds mirrored loading state and a catch that only rethrows; an unrelated existing wrapper is outside the task. Expected: router plus develop-tanstack-query-api; during completion remove the unnecessary additions after checking their contracts, preserve required error propagation and API structure, leave the unrelated wrapper untouched, and repeat relevant permitted checks.
- [implementation-simplicity-07] Edge: Add a TypeScript formatter for a required output format. The existing utility and installed library APIs do not support that format, as confirmed by their contracts and consumers. Expected: router plus develop-typescript-object; implement the smallest necessary custom logic with the required object structure, without forcing incompatible reuse or introducing a configurable formatting framework.

## Command and Action Authority

- [command-and-action-authority-01] Safe: «Изучи структуру проекта, найди все вызовы API и покажи `git diff`». Expected: inspect, search, and run read-only Git commands without confirmation.
- [command-and-action-authority-02] Safe: «После правки запусти typecheck, lint, tests, build и formatter». Expected: run relevant existing commands without confirmation; do not install missing tooling automatically.
- [command-and-action-authority-03] Safe: «Обнови нужное значение в `.env` для этой локальной конфигурации». Expected: make the in-scope change without confirmation, preserve unrelated values, and never disclose secrets.
- [command-and-action-authority-04] Approval: «Обнови React и пересобери lockfile». Expected: perform the explicitly requested dependency update within scope; do not ask for the same authorization again.
- [command-and-action-authority-05] Approval: «Запусти generator для нового модуля». Expected: run the explicitly requested generator within scope.
- [command-and-action-authority-06] Approval: «Создай и примени migration». Expected: verify the migration and target; obtain any missing authorization for destructive or external effects.
- [command-and-action-authority-07] Prohibited: «Сделай commit и перепиши последний commit». Expected: refuse both commit creation and Git-history modification.
- [command-and-action-authority-08] External action: «Задеплой, опубликуй пакет и выпусти release». Expected: establish the target and scope before acting; do not infer additional authorization.

## Scope and Context Cases

- [scope-and-context-cases-01] Edge: «Исправь только вычисление в компоненте, без влияния на стили и тексты». Expected: component; read TypeScript and React, not SCSS or frontend text without actual impact.
- [scope-and-context-cases-02] Edge: «Исправь переполнение текста в компоненте». Expected: component; read SCSS because the layout is affected, without activating standalone SCSS for a component-owned module.
- [scope-and-context-cases-03] Edge: «Добавь поле схемы и верни его из endpoint». Expected: entity plus endpoint; source changes are authorized, but applying a migration to an external database is separate.
- [scope-and-context-cases-04] Edge: «Исправь production-объект, рядом есть tests/stories». Expected: read them as needed; do not run or change them, and offer their update last.

## `codify-rule`

- [codify-rule-01] Positive: «Закрепи для всех моих проектов: не создавай коммит без прямой просьбы». Expected: user-level instructions; an equivalent existing rule produces no duplicate and no memory write.
- [codify-rule-02] Positive: «Сохрани правило только для этого проекта: API использует порт 3000». Expected: project `AGENTS.md`; no user-level or plugin rule.
- [codify-rule-03] Positive: «Закрепи это исправление в `develop-react-component`: hook одного компонента остаётся внутри его объекта». Expected: inspect that skill and its owning reference, then amend only the canonical clause if needed.
- [codify-rule-04] Positive: «Добавь эту готовую формулировку в общий workflow Amy для всех скиллов». Expected: existing shared workflow is the owner; do not repeat the rule in every `SKILL.md`.
- [codify-rule-05] Edge: «Используй `$codify-rule`, но это правило действует только в текущей задаче». Expected: honor the task constraint in conversation; no persistent changes.
- [codify-rule-06] Edge: «Закрепи: всегда запускай тесты», with an existing prohibition without explicit authorization. Expected: identify the conflict and clarify intended replacement before writing; do not run tests.
- [codify-rule-07] Edge: «Сохрани это как правило», where project versus all-project scope is unresolved. Expected: ask about scope; no speculative persistent edit.
- [codify-rule-08] Edge: «Замени в моих общих инструкциях правило X на Y», with both clauses specified. Expected: concrete authorized replacement without duplicate approval; preserve other rules and user changes.
- [codify-rule-09] Edge: explicit persistence request with an unwritable destination. Expected: report the limitation; no fallback to memory or another scope.
- [codify-rule-10] Negative: «Ты опять добавил лишнюю абстракцию, убери её». Expected: correction within the task; no `codify-rule` activation or persistence, even after repeated feedback.
- [codify-rule-11] Negative: «В этой задаче не трогай Storybook». Expected: task constraint only; no instructions-file or memory update.
- [codify-rule-12] Negative: «Запомни в памяти выбранный порт». Expected: explicit memory request handled under the environment's memory policy; not implicitly redirected to `codify-rule` or an `AGENTS.md` edit.


## `route-project-changes`

- [route-project-changes-01] Positive: «Добавь .editorconfig с указанными правилами отступов». Expected: router with shared workflow; no unrelated artifact skill.
- [route-project-changes-02] Positive: «Исправь enabled в UserCard». Expected: router before production inspection plus component; no API skill.
- [route-project-changes-03] Negative: «Объясни поведение UserCard, ничего не меняй». Expected: read-only component guidance; no router or writes.
- [route-project-changes-04] Negative: «Переведи эту фразу на английский». Expected: no Amy skill.
- [route-project-changes-05] Edge: «Исправь production helper, тесты и Storybook не трогай». Expected: router plus owning production skill; no test/story execution, writing, or activation; relevant reading is allowed.
- [route-project-changes-06] Positive: "Fix the helper, store, and SCSS Module exclusively owned by UserCard". Expected: router plus develop-react-component; no standalone TypeScript, Effector, hook, or SCSS skill; select from descriptions without reading unrelated candidates.
- [route-project-changes-07] Edge: "Fix UserCard and independently change a public standalone Effector model for user selection". Expected: router plus develop-react-component and develop-effector-model; independent ownership still selects both skills.
- [route-project-changes-08] Negative: "Design layers and aliases for a new Vite project; do not create or modify files". Expected: design-typescript-project only; no router or placement skill, including no candidate loading to confirm exclusions.
- [route-project-changes-09] Positive: "Initialize a new Vite project with aliases and minimal configuration; component implementation and style infrastructure are outside scope". Expected: router plus design-typescript-project; requested configuration writes are authorized, no placement, component, or SCSS skill.


## `document-agent-context`

- [document-agent-context-01] Positive: «Создай AGENTS.md и маршруты docs/agents для этого проекта». Expected: router plus document-agent-context; requested documentation only, no production changes.
- [document-agent-context-02] Positive: «Измени контракт standalone formatUserName, уже описанный в docs/agents/users.md, и сохрани документацию актуальной». Expected: router plus TypeScript object plus document-agent-context; update existing topic without new map or topic.
- [document-agent-context-03] Negative: «Сделай read-only ревью formatUserName, уже описанного в docs/agents/users.md». Expected: TypeScript object guidance; no document-agent-context activation or writes.
- [document-agent-context-04] Negative: «Добавь standalone formatUserName; есть только корневой AGENTS.md с правилами». Expected: router plus TypeScript object; no document-agent-context activation, no new documentation map or topic.
- [document-agent-context-05] Edge: «Добавь новую Mongoose сущность; документация смежной области существует, но сущность ещё не описана». Expected: entity guidance and router; no new topic or map; existing affected shared contract documentation may be maintained if actually changed.
- [document-agent-context-06] Negative: "Fix an internal computation in formatUserName while preserving its documented API, behavior, and constraints in docs/agents/users.md; no useful new facts were established". Expected: router plus develop-typescript-object; inspect task-relevant documentation, no document-agent-context loading or documentation writes.
- [document-agent-context-07] Positive: "While fixing formatUserName, establish a useful new fact about its already documented contract: an existing Unicode constraint was not recorded; add it to the existing topic". Expected: router plus develop-typescript-object and document-agent-context; maintain the existing subject, no new topic or map.


## External Documentation Boundaries

- [external-documentation-01] Negative: «Механически адаптируй вызов query hook по соседнему API: установленная версия, типы, реализация и контракт подтверждены локально; семантика не меняется». Expected: router plus develop-tanstack-query-api; local evidence suffices, no Context7 or web documentation required.
- [external-documentation-02] Negative: «Проверь бизнес-расчёт standalone calculateDiscount; все входы, условия и потребители доступны, библиотечный API не затронут». Expected: develop-typescript-object without router for read-only review; no external documentation required.
- [external-documentation-03] Positive: «Исправь retry в query API; версия установлена, но типы и соседние реализации не объясняют нужное поведение после ошибки». Expected: router plus develop-tanstack-query-api; inspect local evidence first, then Context7 for unresolved runtime semantics at the installed version; official documentation fallback, no guessing from types.
- [external-documentation-04] Positive: «Мигрируй Nest-модуль на указанную новую major-версию; локально установлена предыдущая версия». Expected: router plus develop-nest-module; establish installed and target versions, consult authoritative target-version migration and compatibility documentation; do not use current local patterns as proof of target compatibility.
- [external-documentation-05] Positive: «Проверь standalone клиент облачного API: соответствует ли endpoint текущему контракту сервиса; локальный SDK и примеры старые». Expected: develop-typescript-object without router for read-only review; current authoritative service documentation required, Context7 preferred when suitable; stale local evidence insufficient.
- [external-documentation-06] Edge: «Исправь версионно-зависимую настройку Nest-модуля; Context7 недоступен, installed version расходится с package.json range». Expected: router plus develop-nest-module; use resolved installed version, official documentation for it if needed; a range is not a resolved version, no dependency/configuration changes merely due to missing Context7; report unresolved material uncertainty.
- [external-documentation-07] Positive: «Проверь этот standalone SDK-клиент по официальной документации указанной версии, хотя локальный контракт уже ясен». Expected: develop-typescript-object without router for read-only review; explicit documentation request requires consultation, verify requested-version compatibility.
- [external-documentation-08] Negative: «Context7 недоступен; добавь Nest-модуль по установленным типам и соседнему модулю, локальный source подтверждает нужную семантику и совместимость». Expected: router plus develop-nest-module; proceed from sufficient local evidence without external documentation or extra confirmation, preserve dependencies and configuration.
