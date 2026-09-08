# React

## Standalone Hooks

Use `use<Name>` only when logic needs React hooks or lifecycle semantics; otherwise use a function object. The primary file is `core/use<Name>.ts`. Add types, static values, helpers, hooks, stores, and `index.ts` only when needed.

For a substantial hook, order props destructuring, hook calls, variables, functions, effects, then return. Keep effect dependencies stable and provide cleanup for subscriptions and listeners. In Next.js, place the smallest required client boundary around consumers.

## Component Objects

Component folders and names use PascalCase. Use:

- `core/<ComponentName>.tsx` for JSX and layout;
- `types/I<ComponentName>Props.ts` for props;
- `core/use<ComponentName>.ts` whenever the component has props or logic;
- `core/<ComponentName>.module.scss` for owned styles;
- only necessary owned helpers, hooks, stores, internal components, and a minimal `index.ts`.

A component with props or logic passes the original props object as the sole argument to its owned hook: `use<ComponentName>(props)`, for example `useTooltip(props)`. Destructure and normalize props inside the hook; do not rebuild, spread, or enumerate them at the call site. Omit the hook only when there are neither props nor logic.

JSX uses values and handlers returned by the hook. Small presentation-only combinations of these values and styles, such as `cn(st.root, className)`, may stay in the component. Keep business logic, prop normalization, and substantial derived computations in the hook. A deliberately extracted DOM-attribute rest object may be spread onto its intended element or installed primitive.

The owned hook computes derived values before `return`. Its returned object only exposes existing variables and handlers, normally through shorthand properties: `return { className, content, handleOpenChange }`. A property may rename an existing variable. Do not call functions or compute expressions in this returned object; for example, compute `const rootClassName = cn(st.root, className)` first if the hook owns that combination, then return `{ className: rootClassName }`. This hook-return rule does not restrict the component's returned JSX or its small presentation-only combinations.

An internal component may live under the parent's `core` when decomposition or reuse justifies it. It follows the same object structure and owns its local types and helpers. Lift a type to the parent only when both use it. Internal components do not get stories.

The `hocs` folder name is intentional for specialized wrappers such as `NumberInput` or `SingleToggle`. Such objects follow the same component rules and compose the primary component rather than duplicating it.

Component-owned hooks, stores, helpers, internal components, and SCSS Modules remain owned by the component rather than activating standalone artifact rules.

## Primitives, Accessibility, and Client Boundaries

Use a suitable already installed headless or UI primitive before duplicating it. If none exists, implement locally unless the user explicitly asks to consider a new dependency.

Use semantic HTML, keyboard interaction, visible focus, and correct label, error, and description relationships. Do not invent additional ARIA conventions beyond the concrete interaction.

In Next.js App Router, Server Components are the default. Add `use client` at the smallest boundary requiring state, effects, handlers, browser APIs, client hooks, or a client-only library. A new boundary that materially changes public architecture requires confirmation.

## Completion

Review props and exports, component/hook separation, owned artifacts, semantic DOM, keyboard behavior, focus, labels, installed primitive reuse, and smallest client boundary. For stories and tests, follow the shared existence-only and final-offer workflow.
