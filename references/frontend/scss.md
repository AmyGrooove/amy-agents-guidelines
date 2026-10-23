# SCSS

## Ownership and Imports

- `global.scss` is the only application-level CSS entry. It composes reset, runtime tokens, base typography, and global element styles, never component collections.
- `reusable.scss` is the compile-time public entry forwarding Sass functions, mixins, and compile-time variables. It emits no CSS.
- `variables` owns tokens: themeable runtime values are CSS custom properties; Sass-required data such as breakpoint maps uses Sass variables or maps.
- `mixins` owns repeated declaration patterns, not full component designs. `functions` owns pure Sass transformations. `reset.scss` owns normalization only.
- Typography, animation, and responsive resources are created only when real files require them.
- Every consumer stylesheet, including a module, includes the reusable entry at the top after required Sass built-ins, even if it currently uses no forwarded member.
- Files implementing `shared/styles` import direct dependencies and never import `reusable.scss` back. `global.scss` composes internal partials through direct relative imports.

## Selectors and Values

- `.root` styles the top DOM element. Attach state variants such as disabled or error to `.root`, and nest descendant state styling under the root state.
- Prefer existing custom properties, variables, mixins, and tokens. A new color or token requires approval.
- Literal colors appear only in the token-definition layer. `transparent`, `currentColor`, `inherit`, and values derived from approved tokens with `color-mix` or an approved Sass function are allowed elsewhere.
- Prefer pixel values divisible by four. Exempt 1px/2px borders, outlines, separators, optical adjustments; typography and line-height; fluid/intrinsic values; aspect ratios; transforms; runtime custom-property values; breakpoints; and installed-primitive requirements. Other exceptions require a concrete design or runtime reason.
- Allowed units are semantic unitless values; `px`; `%`, `rem`, `em`, `ch`; `vw`, `vh`, `dvh`, `svh`, `lvh`; `fr`; `deg`; `ms`, `s`. Prefer `rem` for root-scalable typography, `em` for intentionally element-relative sizing, and `ms` for ordinary sub-second motion.
- Do not use `!important` by default. A narrowly scoped selector and property may use it only for justified integration with a third-party style or component after available configuration, styling APIs, and ordinary cascade are insufficient. Report the justification in the result; do not add a code comment unless requested. Do not use it for an ordinary specificity problem. Do not restate browser defaults.
- Prefer pseudo-elements for decoration and flexbox when it is the correct layout model.
- Prefer one-word class names, otherwise camelCase. Modifiers use underscore style such as `.root_disabled` or `&_disabled` with ampersand nesting.
- Define each class's base styles at top level. Root state modifiers and descendant overrides scoped to those states may be nested; do not introduce a descendant's base styles only inside a parent selector. Keep meaningful selector nesting to at most three levels; control directives and media wrappers do not count.
- Prefer logical properties unless a physical side or axis is intentional.

## Responsive and Motion

Keep viewport breakpoints in one Sass map and expose named shared responsive mixins. CSS custom properties may mirror values at runtime but cannot be media-query conditions. Prefer mobile-first `min-width`; preserve a coherent existing direction, or use `max-width` for a genuinely desktop-first design or bounded override. Raw media queries are allowed for non-viewport features or a one-off condition outside the shared set.

Prefer supported modern CSS. Use `:has` and `:focus-within` when they reduce component logic safely. Existing browser requirements win; critical interaction or layout needs a fallback, while non-critical newer behavior may progressively enhance.

Provide reduced-motion behavior for non-essential or automatic animation, including equivalent runtime checks for JavaScript motion.

Keep the Sass graph acyclic. Do not introduce CSS Layers without a separate decision for a concrete cascade problem. Preserve coherent existing layers.
