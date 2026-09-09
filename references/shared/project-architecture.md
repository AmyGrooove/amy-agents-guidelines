# Project Architecture

## Frontend

`A → B` означает: слой `A` может импортировать слой `B`.

Разрешённое направление: `app → pages or routes → entities → providers → shared`. Слой может импортировать любой нижележащий слой без прохождения промежуточных.

- `shared`: portable reusable code.
- `providers`: portable application-support wrappers and services.
- `entities`: project-specific domain code, APIs, constants, types, and components.
- `pages` or `routes`: screens and route-level composition.
- `app`: initialization and framework adapters.

Next.js uses `src/app` as a thin App Router adapter and keeps route implementation in `src/routes`. Server Components are the default; add `use client` only at the smallest boundary needing React state, effects, handlers, browser APIs, custom client hooks, or a client-only library.

Vite uses `src/main.tsx`, `src/pages`, and a `RoutesProvider` composition boundary. Lazily load non-trivial top-level route pages by default; small fallbacks and route shells may remain eager.

Preserve the existing form stack, validation approach, and browser requirements. In a new project, add no form dependency before a real form requires it and the user approves it. Without a project baseline, target current Baseline Widely Available features across stable desktop and mobile Chrome, Edge, Firefox, and Safari; progressively enhance or provide a fallback for newer non-critical behavior.

## Backend

`A → B` означает: слой `A` может импортировать слой `B`.

Разрешённое направление: `app → endpoints → entities → infrastructure → shared`. Слой может импортировать любой нижележащий слой без прохождения промежуточных.

- `shared`: portable primitives.
- `infrastructure`: portable service-like support.
- `entities`: domain schemas, repositories, types, and helpers.
- `endpoints`: controllers, application services, DTOs, and endpoint logic.
- `app`: application composition and initialization.

Frontend and backend are independent projects; do not infer a monorepo.

## Placement and Imports

Choose an omitted destination from ownership, portability, and dependency direction. Ask only when two materially different valid placements remain.

- Обратные импорты запрещены: например, `entities` не импортирует `pages`, а `infrastructure` не импортирует `endpoints`.
- Разрешённый пример: `pages` импортирует публичный API объекта из `shared`; `endpoints` импортирует entity repository.
- Объекты одного слоя могут импортировать друг друга через публичный API, если сохраняются владение и ацикличность.
- Different objects import through aliases and the target object's public `index.ts`, including objects in the same layer.
- Deep imports into another object's internals are forbidden.
- Files inside one object use exact relative imports, never the object's own `index.ts` or a parent barrel such as `..`.
- Public `index.ts` exports the main runtime object and only externally required public types or units.
- Do not create layer-wide mega-barrels or re-export internal props, constants, helpers, hooks, or implementation details.
- Dependency cycles are forbidden.

Resolve a same-layer cycle by moving orchestration upward or extracting a genuinely shared primitive to the lowest valid layer. A shared public type belongs to the lowest-layer object that owns its meaning and is consumed with `import type` through that object's public API. If that export would cycle, create a dedicated type object in the lowest common allowed layer only when genuinely shared; never use a deep import or layer-wide type barrel as a bypass.

## Minimal New Projects

Before writing, establish frontend, backend, or both as separate projects; Next.js or Vite; package manager; first domain modules and real files; and approved dependencies. If frontend versus backend or Next.js versus Vite is unresolved, ask.

Create only package metadata, TypeScript and required framework configuration, real entry points, aliases used by real imports, configuration typing used by real code, and first real artifacts. Do not pre-populate empty shared, UI, provider, infrastructure, or feature areas. Do not add generic lint, formatting, testing, CI, container, deployment, or placeholder configuration by default. CORS and a global route prefix require a concrete consumer or URL convention.
