# Effector

Use a cohesive standalone model at `stores/<storeName>/core/<storeName>.ts`. One model may own its store, related events, effects, samples, and wiring. Store names use `$`; effects use `Fx`; events use meaningful names and may use past tense when it describes the event.

Prefer derived stores and `sample` for declarative flow and coordination. Use `watch` only at a genuine external side-effect or subscription boundary, never to imperatively coordinate Effector units when a derived store or `sample` expresses the relationship. Do not wrap an event in a function unless the wrapper adds behavior.

Pure reusable logic belongs in a separate function object only when independently reusable. Export through `index.ts` only the units consumers need. A store exclusively owned by a component remains inside that component. TanStack Query owns server cache; do not duplicate the same server state in Effector.

Static completion requires explicit effects and triggers, no unnecessary imperative links or behavior-free wrappers, and public units matching actual consumers.
