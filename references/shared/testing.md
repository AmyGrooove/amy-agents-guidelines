# TypeScript Testing

Use one main `__tests__/<ObjectName>.test.ts` or `.tsx` file. `describe` uses the object name. Every `it` description is in Russian and states observable behavior. Test-local constants live in that object's `__tests__/static`; repeated cross-test mocks belong in the project's existing root test setup.

Prefer observable behavior over implementation details, avoid meaningless snapshot-only coverage, and reuse established infrastructure. Change testing configuration only when it is directly required by the in-scope test or production task.

## Case Discovery and Coverage

Before writing or changing tests, inspect the requested behavior, specification, public contract, affected production paths and consumers, and existing tests. Derive expected outcomes from that evidence independently of the current implementation's output. If the intended behavior remains materially ambiguous, clarify it rather than encoding a guess.

Build a compact case map for the authorized object or behavior. Identify all reachable, materially distinct scenarios: normal and alternative paths; equivalence classes and boundary values; empty, absent, invalid, and unsupported inputs where the boundary accepts them; observable errors and side effects. For stateful or asynchronous behavior, include applicable transitions, loading, retries, repeated actions, cancellation, cleanup, stale responses, and ordering or concurrency interactions. For UI, include applicable user interactions, disabled states, keyboard, and focus behavior. These are discovery prompts, not requirements to invent unsupported features or exercise unrelated objects.

Map every identified applicable case to an existing meaningful test or add coverage. Check relevant combinations when their interaction changes behavior. Use representative values or parameterized cases for equivalent inputs; retain distinct failure modes. Keep fixtures and setup minimal, not behavioral coverage. Do not stop at the happy path, the lines changed, or a coverage percentage. Record excluded or blocked cases with reasons; do not claim literal exhaustiveness over arbitrary inputs or unobserved behavior. Keep the case map in working context and report coverage and material gaps briefly; create no extra document unless requested.

## Failing Tests and Regression Diagnosis

When a test fails, inspect the failure, relevant test and production diffs, contract, fixtures, mocks, and setup before changing assertions. Establish whether recent work caused it and whether that work intentionally changes the required behavior. Use available before-state evidence or an authorized isolated comparison without overwriting existing user changes. If attribution is uncertain, report it rather than guessing.

- If recent changes violate behavior that must remain valid, keep the contractual expectation and fix the responsible component or other production code within the authorized scope. Preserve the failing regression test or add the missing case when test edits are authorized. If the necessary production repair is outside scope, report the blocker instead of weakening the test.
- If an authorized requirement intentionally changes behavior, update the affected test only when test edits are authorized; otherwise report the mismatch and offer the scoped update. Preserve coverage of contracts that remain valid and explain the requirement justifying a changed expectation.
- If the test, mock, fixture, or environment is defective, establish that cause using the contract and project evidence and correct it only within the authorized scope. A test failure alone is not proof that either the test or production code is wrong. Separate pre-existing failures from regressions.

Never obtain green results by deleting or skipping valid cases, weakening assertions, refreshing snapshots blindly, mocking away the behavior under test, or copying observed output into expected values without contract evidence. Mocks must model the dependency contract and exercise the subject's real decisions. Assert observable outcomes and relevant errors or side effects so the test can detect a plausible defect, rather than merely repeating the implementation. Repair a flawed test when evidence establishes its flaw; do not preserve an incorrect expectation solely because it already exists.

## Completion

Review the case map against the tests, imports, types, descriptions, and file structure. Green results alone do not establish coverage or prove that a changed expectation is correct.
