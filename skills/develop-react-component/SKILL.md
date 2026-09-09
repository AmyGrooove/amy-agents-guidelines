---
name: develop-react-component
description: Create, fix, extend, refactor, or review a React component object, including its props, component-owned hooks, stores, helpers, internal components, and SCSS Module. Excludes standalone hooks, standalone Effector models, shared styles, stories, and tests.
---

# Develop React Component

## Responsibility and Activation

Create, change, or review a React component object and everything exclusively owned by it. Review reports confirmed findings without edits.

Activate for JSX, public props, behavior, accessibility, `use<Component>`, component-owned hooks, stores, helpers, internal components, and owned SCSS Modules. Do not activate for standalone hooks or Effector models, shared/global SCSS, story-only or test-only requests, or architecture without a component artifact. Keep incidental owned artifacts here; do not activate separate hook, Effector, TypeScript, or SCSS skills for them.

## Context and References

Inspect neighboring production components, installed primitives, consumers, design tokens, owned styles, and dictionaries. Check only the existence of relevant tests and stories until their inspection is authorized.

Read [workflow and authority](../../references/shared/workflow-and-authority.md) once. Consult only task-relevant references from: [TypeScript and objects](../../references/shared/typescript-and-objects.md), [React](../../references/frontend/react.md), [SCSS](../../references/frontend/scss.md), and [frontend text](../../references/frontend/frontend-text.md). Read [Storybook](../../references/frontend/storybook.md) only after approval to update an affected story. Read [testing](../../references/shared/testing.md) only for an explicitly requested test change.

## Expected Result

Produce a complete object with `core/<Name>.tsx`, `core/use<Name>.ts` when props or logic exist, props types, owned helpers/stores/internal components, SCSS Module, minimal index, and updated consumers.

## Process

1. Inspect neighboring production components, consumers, installed primitives, texts, and styles.
2. Define or preserve the public props contract.
3. Determine the smallest Next.js client boundary.
4. Separate the owned hook from JSX and decide justified internal artifacts.
5. Implement semantic DOM, keyboard behavior, focus, labels, errors, and descriptions.
6. Change owned SCSS and centralized text.
7. Update minimal exports and consumers.
8. Follow the shared final-offer workflow for existing tests and stories; do not inspect their contents before agreement.

## Authority

Choose an installed suitable primitive, semantic HTML, justified internal components, and only necessary in-scope changes. Require confirmation for a new UI dependency, color or token, breaking public props, or a test/story update not already authorized.

## Prevent

Prevent business logic and prop normalization in JSX, reconstructed props at the owned-hook call site, computations in the hook's returned object, unnecessary `use client`, duplicate primitives, local dictionaries, accessibility regressions, and unauthorized story or test changes. Allow small presentation-only combinations in JSX as described in the React reference.

## Verification and Completion

Complete when the component calls its owned hook with the original props object as its sole argument; the hook returns only existing variables and handlers; JSX uses those values and handlers with small presentation-only combinations allowed; props, exports, and consumers agree; and DOM, keyboard, focus, labels, text ownership, and owned SCSS pass static review.

## Optional-Capability Fallback

Use installed React/UI primitives, local types, and neighboring components. Do not invent version-sensitive behavior when local evidence is insufficient; report the uncertainty. Missing Superpowers does not block direct implementation and static review.
