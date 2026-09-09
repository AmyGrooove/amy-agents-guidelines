# TanStack Query

Name one frontend API object `use<Method><Name>`, such as `useGetAccount`, using the common hook-object structure. Define `I<Name>Response` and `I<Name>Body` when a body exists.

Put the raw request function first in the core file and its query or mutation hook below it. Export both through `index.ts`. Use the project's existing `fetchData` utility. The raw request returns the parsed success DTO directly, without a universal `data` wrapper.

A non-success HTTP response rejects through the shared typed API error so TanStack Query receives failure naturally. The error exposes HTTP status plus backend `code`, `message`, `details`, and `traceId` when available. A `204` may return `undefined` only when the declared response explicitly permits `void` or `undefined`.

Choose a query for cacheable reading semantics and a mutation for command/write semantics; HTTP method is evidence, not the sole decision. For a query, receive the `AbortSignal` provided to `queryFn`, pass it to the request, and include every result-affecting input and no irrelevant input in the query key. Do not create a manual `AbortController` for ordinary query cancellation. Mutation does not require a query key or `queryFn` signal. Invoke necessary supporting hooks inside the API hook rather than requiring repeated caller wiring.

Use the installed version and current official guidance when behavior is version-sensitive. Static completion requires an exported raw request and hook plus success/error types matching the backend contract; for a query also verify its complete key and propagated signal.
