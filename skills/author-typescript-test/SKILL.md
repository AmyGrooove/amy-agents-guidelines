---
name: author-typescript-test
description: Create, change, or review a TypeScript test only when the user explicitly requests a test, test case, or test-file repair. Never activate solely because production code changed.
---

# Author TypeScript Test

## Responsibility and Activation

Create, change, or review an explicitly requested TypeScript test artifact. An accepted offer to inspect and update existing files supplies this authorization. Review reports confirmed findings without edits.

Activate for writing a test, adding a test case or regression, repairing a test file, or covering explicitly named behavior. Do not activate for production work alone, command execution, or generic verification without a test artifact. Without authorization, follow the shared existence-only and final-offer workflow.

## Context and References

Inspect the production contract, test configuration/setup, neighboring tests, and available mocks or fixtures. Read [workflow and authority](../../references/shared/workflow-and-authority.md) once. Consult only task-relevant references from: [testing](../../references/shared/testing.md). Read only the reference for the tested artifact when its public behavior is needed.

## Expected Result

Produce the main `__tests__/<Object>.test.ts` or `.tsx` file with Russian `it` descriptions and minimal local fixtures.

## Process

1. Confirm that a semantic test artifact is explicit.
2. Inspect the production contract, test setup, and neighboring tests.
3. Select observable cases required by the named behavior.
4. Add minimal cases and reuse established root mocks where appropriate.
5. Place test-local constants in the object's test `static` folder only when needed.
6. Statically review imports, types, descriptions, and production boundaries.

## Authority

Choose cases directly required by the explicitly named behavior and run the relevant existing test command as safe local verification. Require confirmation before changing production API for testability, adding or changing testing dependencies, or using a package-manager operation that changes `lockfile` or `node_modules`.

## Prevent

Prevent default test creation, implementation-detail assertions, meaningless snapshot-only coverage, duplicate setup, unauthorized production changes, and confirmation-gated dependency or infrastructure changes.

## Verification and Completion

Complete when tests target observable behavior, use one main test file, have Russian `it` descriptions, compile against installed types, and the relevant test command ran when available or its limitation is reported.

## Optional-Capability Fallback

Use installed test types/configuration, setup, and neighboring tests. Report missing infrastructure rather than adding it. For library-specific questions, follow the shared Context7 rules.
