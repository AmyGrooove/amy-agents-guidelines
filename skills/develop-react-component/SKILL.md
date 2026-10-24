---
name: develop-react-component
description: Use when working on React components and exclusively owned props, hooks, stores, helpers, internal components, and SCSS Modules. Excludes standalone hooks/Effector models, shared styles, and test/story-only work.
---

# Develop React Component

## Responsibility and Activation

Create, change, or review a React component object and everything exclusively owned by it.

Activate for JSX, public props, behavior, accessibility, `use<Component>`, component-owned hooks, stores, helpers, internal components, and owned SCSS Modules. Do not activate for standalone hooks or Effector models, shared/global SCSS, story-only or test-only requests, or architecture without a component artifact. Keep incidental owned artifacts here; do not activate separate hook, Effector, TypeScript, or SCSS skills for them.

## Context and References

Start with the affected component and its props/behavior contract. For creation, establish the complete required object and search installed primitives; inspect a neighbor only for an unresolved convention. For a targeted change, follow only the affected owned hook/helper and relevant props usages. Read styles/tokens for presentation changes, dictionaries for text changes, and tests/stories only to resolve relevant behavior.

Read [workflow and authority](../../references/shared/workflow-and-authority.md) once. Apply its activation conditions to [TypeScript and objects](../../references/shared/typescript-and-objects.md) and [project architecture](../../references/shared/project-architecture.md). Read [React](../../references/frontend/react.md) for affected JSX, props, component/hook structure, lifecycle, accessibility, or client boundaries; [SCSS](../../references/frontend/scss.md) for affected styles or layout; and [frontend text](../../references/frontend/frontend-text.md) for affected user-facing text. Read [Effector](../../references/frontend/effector.md) for affected component-owned Effector state or coordination; apply unit semantics without imposing standalone model placement. Read [Storybook](../../references/frontend/storybook.md) for authorized story work and [testing](../../references/shared/testing.md) for test authoring or failure diagnosis.

## Expected Result

Produce the complete component object and necessary consumers, with its public props, owned logic and styles, accessible interaction, and public entrypoint. Verify the owned-hook contract against [React component objects](../../references/frontend/react.md#component-objects) when props or owned logic are affected.
