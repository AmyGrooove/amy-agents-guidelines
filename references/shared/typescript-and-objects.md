# TypeScript and Objects

## Language Rules

- Decompose by responsibility, ownership, reuse, and dependency direction; size is only a signal.
- Prefer `const`. Use local `let` only when reassignment makes an algorithm simpler and clearer than `reduce`, recursion, or a mutable helper object. Do not introduce unjustified shared mutable state.
- Do not use IIFEs, `any`, non-null assertions, or unjustified type assertions.
- Use arrow functions, braces for all control structures, and blank lines between logical blocks.
- Use `unknown` for genuinely unknown values. Default to `undefined` for omitted or unavailable values; use `null` only as an intentional supported contract value. Do not silently convert them at a boundary.
- Use `satisfies` when it validates without widening.
- Named or substantial functions use an explicit `return`; short expression callbacks may return implicitly.
- Omit a return type when inference is correct. Add it to narrow an API or prevent unintended `any` or `unknown`.
- Prefer `async`/`await`. Use promise chains only when clearer or required.
- Catch only to add context, map at an explicit boundary, recover, or perform required cleanup. Preserve correct domain/framework errors and never swallow unknown failures; rethrow or preserve the cause in the approved contract.

## Implementation Simplicity

Validate untrusted input at its owning boundary. Repeat a check, normalization, conversion, or fallback only when a distinct trust boundary or supported contract requires it. Preserve checks needed at runtime; a TypeScript type alone does not validate external data. Keep supported absence and error behavior explicit rather than replacing failures with invented defaults.

## Types, Naming, and Exports

- DTOs, types, and interfaces may share a file when they form a cohesive definition. Split independent definitions into separate files when the separation is logically meaningful and improves readability. Keep nested or supporting definitions used only by that DTO or type in the same file; do not extract them solely to satisfy one object per file.
- Prefer `interface` for object shapes, named `IName`. Put required properties first, a blank line, then optional properties.
- Use `type` for unions and shapes unsuitable for interfaces, named `TName`; union names are singular.
- Constants use `SCREAMING_SNAKE_CASE`, normally one per file.
- Prefer named exports with separate `export` and `export type` statements. Avoid defaults and star exports except framework-required defaults.
- Predicate functions normally start with `checkIs`; reuse concise existing guards such as `isNil`, `isString`, or `isObject`.
- Boolean names use `is`, `has`, `can`, or `should`. Internal handlers use `handle<Name>` and public callback props use `on<Name>`.
- More than two authored semantic parameters become one `I<Name>Props` object. Framework/library callbacks and `AbortSignal` are exceptions.

## Files and Object Shape

Normally keep one object per file, with the DTO, type, and interface grouping rules above as an exception. Specialized object rules take priority within their object: a TanStack Query API may keep its raw request and hook together. Other accepted cohesive exceptions are public index barrels, Storybook story files, Nest module metadata, Effector models, and framework/configuration entry points.

Create only folders that contain real files:

- `core`: primary implementation named after the object;
- `static`: object-owned constants;
- `types`: object-specific types;
- `functions`, `hooks`, `stores`: object-local child objects;
- `hocs`: specialized component wrappers;
- `stories`: only for an explicitly requested Storybook artifact;
- `index.ts`: minimal public API.

## Function and Decorator Objects

Function folders and functions use lower camel case; functions begin with a verb. The primary file is `core/<functionName>.ts`. Add `types`, `static`, `functions`, and `index.ts` only as needed. Group reusable shared functions semantically, preserving meaningful existing groups such as `checks`, `format`, `api`, `errors`, or `utility`; do not generalize this grouping rule automatically to all shared types or constants.

General decorators follow the function-object shape. Nest-owned decorators remain governed by the NestJS reference.
