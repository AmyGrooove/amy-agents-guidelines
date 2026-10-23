---
name: author-typescript-test
description: Create, change, or review a TypeScript test only when the user explicitly requests a test, test case, or test-file repair. Never activate solely because production code changed.
---

# Author TypeScript Test

## Responsibility and Activation

Create, change, or review an explicitly requested TypeScript test artifact. An accepted offer to inspect and update existing files supplies this authorization.

Activate for writing a test, adding a test case or regression, repairing a test file, or covering explicitly named behavior. Do not activate for production work alone, command execution, or generic verification without a test artifact. Read relevant tests as needed without separate approval; follow the shared final-offer workflow before changing them.

## Context and References

Inspect the production contract, test configuration/setup, neighboring tests, and available mocks or fixtures. Read [workflow and authority](../../references/shared/workflow-and-authority.md) once. Consult only task-relevant references from: [testing](../../references/shared/testing.md). Read only the reference for the tested artifact when its public behavior is needed.

## Expected Result

Produce the main `__tests__/<Object>.test.ts` or `.tsx` file with Russian `it` descriptions and minimal local fixtures.

## Process

1. Confirm that a semantic test artifact is explicit.
2. Inspect the production contract, test setup, and neighboring tests.
3. Build the contract-based case map from the testing reference, including all applicable paths, boundaries, errors, states, and meaningful interactions in scope.
4. Cover every identified applicable case with meaningful existing or new tests; keep fixtures minimal and reuse established root mocks where appropriate.
5. Place test-local constants in the object's test `static` folder only when needed.
6. Diagnose failures using the testing reference before changing expectations; distinguish unintended production regressions, intentional contract changes, and defective tests or environment.
7. Review the case map, assertions, imports, types, descriptions, and production boundaries; run authorized relevant checks and report material coverage gaps.

## Authority

Discover and cover all applicable cases within the explicitly requested object or behavior and run the relevant existing test command as safe local verification. Require confirmation only when not already authorized before changing production API for testability, adding or changing testing dependencies, or using a package-manager operation that changes `lockfile` or `node_modules`.

## Prevent

Prevent changing expectations merely to obtain green results, hiding regressions, happy-path-only coverage, default test creation, implementation-detail assertions, meaningless snapshot-only coverage, duplicate setup, unauthorized production changes, and confirmation-gated dependency or infrastructure changes.

## Verification and Completion

Complete when every identified applicable case has meaningful coverage, expectations follow the required contract, failures have been diagnosed, and tests follow the required file structure, Russian `it` descriptions, and installed types. If a required case remains uncovered or blocked, report partial completion and the gap. Report the relevant test command's actual result or the reason it could not run; a green run alone is insufficient.

## Optional-Capability Fallback

Use installed test types/configuration, setup, and neighboring tests. Report missing infrastructure rather than adding it. For library-specific questions, follow the shared Context7 rules.
