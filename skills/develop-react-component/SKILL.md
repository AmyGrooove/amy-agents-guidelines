---
name: develop-react-component
description: Create, fix, extend, refactor, or review a React component object, including its props, component-owned hooks, stores, helpers, internal components, and SCSS Module. Excludes standalone hooks, standalone Effector models, shared styles, stories, and tests.
---

# Develop React Component

## Responsibility and Activation

Create, change, or review a React component object and everything exclusively owned by it.

Activate for JSX, public props, behavior, accessibility, `use<Component>`, component-owned hooks, stores, helpers, internal components, and owned SCSS Modules. Do not activate for standalone hooks or Effector models, shared/global SCSS, story-only or test-only requests, or architecture without a component artifact. Keep incidental owned artifacts here; do not activate separate hook, Effector, TypeScript, or SCSS skills for them.

## Context and References

Inspect neighboring production components, installed primitives, consumers, design tokens, owned styles, and dictionaries. Read relevant tests and stories as needed to understand the component contract.

Read [workflow and authority](../../references/shared/workflow-and-authority.md) once. Read [TypeScript and objects](../../references/shared/typescript-and-objects.md) for code, types, exports, or object structure; [React](../../references/frontend/react.md) for JSX, props, lifecycle, accessibility, or client boundaries; [SCSS](../../references/frontend/scss.md) only for affected styles or layout; and [frontend text](../../references/frontend/frontend-text.md) only for affected user-facing text. Read [Storybook](../../references/frontend/storybook.md) only after approval to update an affected story. Read [testing](../../references/shared/testing.md) only for an explicitly requested test change.

## Expected Result

For creation, produce the complete applicable object: `core/<Name>.tsx`, an owned hook only when props or logic require it, necessary props types, owned artifacts, SCSS Module, minimal index, and consumers. For a targeted change, modify only the request and necessary consumers. For explicit normalization, cover the agreed production object; review reports the agreed area without edits.

## Process

1. Inspect neighboring production components, consumers, installed primitives, texts, and styles.
2. Define or preserve the public props contract.
3. Determine the smallest Next.js client boundary.
4. For creation or explicit normalization, separate an owned hook from JSX when required; for a targeted change, do not extract a hook or restructure props solely to normalize existing code.
5. Implement semantic DOM, keyboard behavior, focus, labels, errors, and descriptions.
6. Change owned SCSS and centralized text.
7. Update minimal exports and consumers.
8. Follow the shared final-offer workflow before updating existing tests and stories.

## Authority

Choose an installed suitable primitive, semantic HTML, justified internal components, and only necessary in-scope changes. Require confirmation only when not already authorized for a new UI dependency, color or token, breaking public props, or a test/story update.

## Prevent

Prevent business logic and prop normalization in JSX, reconstructed props at the owned-hook call site, computations in the hook's returned object, unnecessary `use client`, duplicate primitives, local dictionaries, accessibility regressions, and unauthorized story or test changes. Allow small presentation-only combinations in JSX as described in the React reference.

## Verification and Completion

Complete a creation or explicit normalization when its applicable component structure, props, exports, consumers, DOM, keyboard, focus, labels, text ownership, and owned SCSS pass static review. Complete a targeted change when its changed behavior and necessary consumers pass the same applicable checks; existing unrelated structure does not block it. Verify the owned-hook contract against [React component objects](../../references/frontend/react.md#component-objects).

## Optional-Capability Fallback

Use installed React/UI primitives, local types, and neighboring components. Do not invent version-sensitive behavior when local evidence is insufficient; report the uncertainty. Missing Superpowers does not block direct implementation and static review.
