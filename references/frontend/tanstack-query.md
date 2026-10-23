# TanStack Query

Name one frontend API object `use<Method><Name>`, such as `useGetAccount`, using the common hook-object structure. Define `I<Name>Response` and `I<Name>Body` when a body exists.

Put the raw request function first in the core file and its query or mutation hook below it. Export both through `index.ts`. Use the project's existing `fetchData` utility. For affected HTTP success/error semantics, apply [backend contracts](../backend/backend-contracts.md); query-key-only work does not activate that reference.

TanStack Query owns server cache; keep it out of parallel Effector state.

Choose a query for cacheable reading semantics and a mutation for command/write semantics; HTTP method is evidence, not the sole decision. For a query, receive the `AbortSignal` provided to `queryFn`, pass it to the request, and include every result-affecting input and no irrelevant input in the query key. Do not create a manual `AbortController` for ordinary query cancellation. Mutation does not require a query key or `queryFn` signal. Invoke necessary supporting hooks inside the API hook rather than requiring repeated caller wiring.
