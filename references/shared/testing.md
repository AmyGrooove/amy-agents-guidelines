# TypeScript Testing

Before authorization, follow the shared existence-only and final-offer workflow. An explicit test request or accepted update offer authorizes reading and changing the relevant tests and running verification. An execution-only request authorizes running tests, not reading or editing their source.

Use one main `__tests__/<ObjectName>.test.ts` or `.tsx` file. `describe` uses the object name. Every `it` description is in Russian and states observable behavior. Test-local constants live in that object's `__tests__/static`; repeated cross-test mocks belong in the project's existing root test setup.

Inspect the production contract, test configuration, setup, neighboring tests, and available mocks or fixtures. Prefer observable behavior over implementation details, avoid meaningless snapshot-only coverage, reuse established infrastructure, and do not add a dependency without confirmation. Change testing configuration only when it is directly required by the in-scope test or production task.

Completion requires correct imports and types, minimal cases for the explicitly requested behavior, one main file, Russian `it` descriptions, and the relevant test command run when available or a reported reason it could not run.
