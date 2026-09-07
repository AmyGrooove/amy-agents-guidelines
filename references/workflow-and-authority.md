# Workflow and Authority

## Precedence and Scope

Follow the user's request and applicable AGENTS.md. Inspect neighboring production code before implementation. Plugin standards take precedence over existing project patterns within the task; use existing conventions where the plugin has no rule. Apply this precedence to every skill and reference.

Apply plugin standards to the requested changes. Bring the entire touched object into compliance only on a separate request to bring it to standards; an ordinary fix, feature, or review does not authorize full normalization. This includes its owned production artifacts, not unrelated neighbors or unapproved tests and stories. Preserve existing behavior and public APIs unless the task requires changing them. Prefer simple solutions and existing utilities, components, types, and dependencies.

## Working Contract

- Respond in Russian, briefly and to the point; give details only on request.
- Preserve pre-existing worktree changes and the project's package manager and tooling.
- For tests and Storybook files, check existence by path only. Exclude their contents from searches and reads. Do not read, run, create, or modify them without an explicit request or accepted offer.
- Do not add code comments, documentation, extra files, TODOs, or FIXMEs unless requested.
- After the main task, if relevant tests or stories exist and updating them is not already authorized, offer to inspect and update them as the last item after all explanations and other suggestions. Wait for agreement, then read and update them. Existence alone does not establish a defect.
- Do not create Git commits or modify Git history.
- Read sensitive configuration only when needed and never expose secret values.

## Authority

Handle necessary, reversible implementation and safe local inspection or verification autonomously. Existing authorization covers the requested action; do not ask again. Skill-specific confirmation rules apply only when the decision is not already authorized.

Preserve installed dependencies and reuse them first. Add a dependency only when necessary. Ask when required information or a material decision cannot be inferred, or when an external, destructive, or difficult-to-reverse action lacks authorization. Do not expand the task into infrastructure, deployment, publishing, or unrelated cleanup.

## Context and Documentation

Select the skill owning the requested artifact. Read this shared workflow once, then only reference files needed for the task; do not load every linked document or reread available context. Load routing evaluation only when checking routing.

Use Context7 for questions about libraries, frameworks, SDKs, APIs, CLI tools, and cloud services, including syntax, configuration, migration, setup, and library-specific debugging, even for familiar APIs. Prefer it over web search for library documentation. Do not use it for refactoring, scripts from scratch, business logic debugging, code review, or general programming concepts.

Start with resolve-library-id unless an exact /org/project ID is provided. Choose by name, relevance, snippets, source reputation, and benchmark score; use a matching version when specified. Retry alternate names or queries when results are unsuitable. Use query-docs for one concept per call, combining concepts only to explain their interaction. Base the answer on retrieved documentation. If unavailable, use installed types or official documentation and state material uncertainty.

Available workflows must respect the user's scope and restrictions. Missing optional tools do not block work supported by local evidence.

## Completion

Review the requested changes and affected consumers, then run relevant available checks. Report the result briefly and state any unresolved limitation; do not claim verification that did not run.
