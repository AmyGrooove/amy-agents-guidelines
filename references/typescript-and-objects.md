# TypeScript and Objects

## Language Rules

- Prefer existing utilities, objects, types, and dependencies.
- Decompose by responsibility, ownership, reuse, and dependency direction; size is only a signal.
- Do not use `let`, IIFEs, `any`, non-null assertions, or unjustified type assertions.
- Use arrow functions, braces for all control structures, and blank lines between logical blocks.
- Use `unknown` for genuinely unknown values. Default to `undefined` for omitted or unavailable values; use `null` only as an intentional supported contract value. Do not silently convert them at a boundary.
- Use `satisfies` when it validates without widening.
- Named or substantial functions use an explicit `return`; short expression callbacks may return implicitly.
- Omit a return type when inference is correct. Add it to narrow an API or prevent unintended `any` or `unknown`.
- Prefer `async`/`await`. Use promise chains only when clearer or required.
- Catch only to add context, map at an explicit boundary, recover, or perform required cleanup. Preserve correct domain/framework errors and never swallow unknown failures; rethrow or preserve the cause in the approved contract.

## Types, Naming, and Exports

- Keep types in separate files in normal application code, normally one type or interface per file.
- Prefer `interface` for object shapes, named `IName`. Put required properties first, a blank line, then optional properties.
- Use `type` for unions and shapes unsuitable for interfaces, named `TName`; union names are singular.
- Constants use `SCREAMING_SNAKE_CASE`, normally one per file.
- Prefer named exports with separate `export` and `export type` statements. Avoid defaults and star exports except framework-required defaults.
- Predicate functions normally start with `checkIs`; reuse concise existing guards such as `isNil`, `isString`, or `isObject`.
- Boolean names use `is`, `has`, `can`, or `should`. Internal handlers use `handle<Name>` and public callback props use `on<Name>`.
- More than two authored semantic parameters become one `I<Name>Props` object. Framework/library callbacks and `AbortSignal` are exceptions.

## Files and Object Shape

Normally keep one object per file. Accepted cohesive exceptions are public index barrels, Storybook story files, Nest module metadata, Effector models, and framework/configuration entry points.

Create only folders that contain real files:

- `core`: primary implementation named after the object;
- `static`: object-owned constants;
- `types`: object-specific types;
- `functions`, `hooks`, `stores`: object-local child objects;
- `hocs`: specialized component wrappers;
- `stories`: only for an explicitly requested Storybook artifact;
- `index.ts`: minimal public API.

Never create empty or placeholder directories. Do not add comments, JSDoc, or unfinished-work markers unless explicitly requested. Preserve existing comments unless the change makes them incorrect.

## Function and Decorator Objects

Function folders and functions use lower camel case; functions begin with a verb. The primary file is `core/<functionName>.ts`. Add `types`, `static`, `functions`, and `index.ts` only as needed. Group reusable shared functions semantically, preserving meaningful existing groups such as `checks`, `format`, `api`, `errors`, or `utility`; do not generalize this grouping rule automatically to all shared types or constants.

General decorators follow the function-object shape. Nest-owned custom decorators use PascalCase and remain with the owning Nest artifact.

## Static Review

Confirm one clear responsibility, minimal public exports, updated in-scope imports, no self/deep/barrel violations, no unnecessary files or directories, and no duplicated existing utility.
