# Workflow and Authority

## Precedence and Scope

Follow the user's explicit requirements, applicable AGENTS.md, and mandatory project contracts before Amy standards. Establish those contracts from task-relevant specifications, public APIs, framework constraints, configuration, and consumers; an incidental existing pattern is not itself a mandatory contract. Apply Amy standards to new and changed code wherever compatible with these constraints, and use project conventions where Amy has no rule. Preserve required layers, ownership, and architectural boundaries unless a higher-priority requirement conflicts; resolve only the conflicting rule, not the rest of the standard. Ask only when a material conflict remains unresolved. This precedence governs every Amy skill and reference.

Use one of four modes. Creation makes the new object and necessary owned artifacts fully comply with applicable standards, without creating optional files. A targeted change applies standards to the requested change and necessary touched consumers only; inspect existing parts to understand behavior, but do not normalize them automatically. Full normalization applies to the agreed object and its owned production artifacts only after a separate request. Review does not change source files; report findings in the agreed area, separating confirmed behavior/contract defects from personal-standard deviations. An inapplicable rule is not a finding.

Apply standards to all new or changed code within the task. An existing deviation outside a necessary change neither blocks completion nor authorizes refactoring. When a correct result needs additional work, identify the minimum: perform it when authorized; otherwise ask only about a materially new decision or unapproved expansion.

Checking surrounding code does not authorize its normalization. Production normalization does not authorize creating or changing tests or stories. Preserve existing behavior and public APIs unless the task requires changing them. Prefer simple solutions and existing utilities, components, types, and dependencies.

## Working Contract

- Respond in Russian, briefly and to the point; give details only on request.
- Preserve pre-existing worktree changes and the project's package manager and tooling.
- Read and search relevant tests and Storybook files as needed. Existing safe tests may run to verify authorized changes under the verification rules below; creating or modifying tests requires an explicit request or accepted offer. Running, creating, or modifying Storybook still requires explicit authorization.
- Do not add code comments, extra files, TODOs, or FIXMEs unless requested. Create new agent documentation only on request; maintain existing agent documentation for affected documented subjects as specified below. Do not add other documentation unless requested.
- After the main task, if relevant tests or stories exist and updating them is not already authorized, offer to update them as the last item after all explanations and other suggestions. Wait for agreement before updating them. Existence alone does not establish a defect.
- Do not create Git commits or modify Git history.
- Read sensitive configuration only when needed and never expose secret values.

## Authority

Handle necessary, reversible implementation and safe local inspection or verification autonomously. Existing authorization covers the requested action; do not ask again. A direct request to change a schema field, contract, dependency, token, or run a generator authorizes that action, but not separate external, destructive, or difficult-to-reverse effects. Distinguish: known action and material parameters — perform it; authorized action with a missing material parameter — ask for that parameter; a proposed material expansion or external consequence — establish its boundary and authorization. Skill-specific confirmation rules apply only when the decision is not already authorized.

Preserve installed dependencies and reuse them first. Add a dependency only when necessary. Ask when required information or a material decision cannot be inferred, or when an external, destructive, or difficult-to-reverse action lacks authorization. Do not expand the task into infrastructure, deployment, publishing, or unrelated cleanup.

When an expected `fetchData`, dictionary, alias, or style entrypoint is absent, inspect existing equivalents and consumers first. Do not refer to a nonexistent object. Create the smallest required object only within the authorized task; do not migrate neighbors. If the standard needs substantial shared infrastructure beyond the task, identify the dependency and request that decision instead of silently weakening the standard.

## Agent Context

When present, consult the project's `AGENTS.md` for concise orientation and `docs/agents/index.md` for task-relevant routes; read additional area indexes or topics when affected dependencies or contracts require them. These documents are working context for agents, not user-facing documentation. Verify relevant claims against current production code. Missing documentation does not block production inspection. An existing `AGENTS.md` alone does not authorize creating a project-wide map.

During authorized implementation, use [document-agent-context](../../skills/document-agent-context/SKILL.md) when existing agent documentation becomes stale or useful new facts are established about its already documented subject. Determine this from task-relevant documentation and production evidence before loading the skill; a code edit alone does not trigger it. Update those existing topics and routes without a separate prompt. Creating a project-wide map, a new topic, or a new area requires a user request; a new implementation subject does not trigger new documentation. A direct documentation request is authorization for its stated scope. Root `AGENTS.md` gives a brief project orientation and key rules; routed documents hold actionable detail. Keep maintenance scoped to affected existing documents rather than auditing the repository.

## Questions, Context, and Documentation

Determine the expected result and boundaries from the request. Find implementation facts in the project: files, APIs, consumers, settings, and analogous objects. Ask a short question only after that research when materially different behavior, contract, or scope remains undefined; retain answers already given. While an answer is missing, inspect independent work but do not make dependent changes. Ordinary internal decisions follow the standards; no task contract, formal estimate, plan file, or confirmation of each step is required.

Use native Codex skill discovery from the requested outcome and artifact ownership; `route-project-changes` is explicit-only, not a prerequisite. Necessary mechanical consumer updates stay with the owning skill; another artifact skill applies when that artifact's own behavior, structure, or contract changes. If no specialized skill applies, complete authorized work using this shared workflow when available and project instructions and conventions; do not force an unrelated skill or require the router. Read shared guidance once and only task-relevant references. Load routing evaluation only when checking routing. Amy requires no activation announcements or final route reports; communicate material decisions, progress, and verification results.

Read `typescript-and-objects` for TypeScript code, types, exports, or object structure; `project-architecture` for placement, ownership, imports, or module composition. Read the relevant frontend reference for components/hooks/JSX/accessibility, styles/layout/tokens, user-facing text, Effector units, or TanStack Query APIs respectively. Read the relevant backend reference for Nest slices, Mongoose persistence, HTTP contracts, or backend messages. Read Storybook guidance for authorized story work and testing guidance when test authoring or failure diagnosis is in scope; executing an existing test command alone needs no authoring skill. These are relevance conditions, not a limit on further necessary context.

Start with current project evidence: affected code and consumers, resolved installed versions (or lockfile when dependencies are unavailable), types, local package documentation/source, configuration, and neighboring implementations. Local evidence is sufficient when it establishes the required API contract and behavior for the version in use without material uncertainty. A library mention, familiar API, or task label alone does not require external documentation; neighboring usage or types alone do not prove runtime semantics.

Consult current authoritative documentation when correctness depends on version-specific behavior not established locally, a changing or remote API/service contract, current support or compatibility, migration to a target version, or a material gap or conflict in local evidence. Also honor explicit requests to consult or verify documentation. This applies during implementation, refactoring, debugging, review, and setup alike. When version affects correctness, establish the installed or requested target version and verify compatibility against that version; do not substitute latest-version guidance or infer a resolved version from a dependency range.

When documentation is needed, prefer Context7 over web search for libraries, frameworks, SDKs, APIs, CLI tools, and cloud services. Start with resolve-library-id unless an exact /org/project ID is provided; select a reputable match and the relevant version, retrying a focused query if unsuitable. Use query-docs for the unresolved question, combining concepts only when their interaction matters. If Context7 is unavailable or insufficient, use official documentation for the relevant version and reconcile it with local evidence. Do not change dependencies or configuration merely because documentation access is missing; proceed only where evidence supports the decision, otherwise report material uncertainty or request the missing decision.

Use built-in Codex capabilities for inspection, planning, edits, verification, and permitted delegation when available. Amy does not depend on Superpowers or another process plugin. Optional workflows must respect the user's scope and restrictions and do not require extra approvals, plan/spec files, worktrees, commits, or test authoring. Missing optional tools do not block work supported by local evidence.

## Subagent Delegation

Use subagents selectively for independent review of complex changes, independent investigation, or substantial subtasks with agreed shared contracts and disjoint write ownership. Keep short or tightly dependent work in the main agent unless delegation has a concrete benefit. Do not create a separate agent per file or rename.

Use the host's available delegation tools. Respect higher-priority permissions and explicit delegation or model-selection restrictions. If delegation is unavailable or not permitted, continue directly.

Give each subagent a bounded goal, expected result, relevant Amy skill and reference paths, necessary project evidence, contracts to preserve, allowed files, and applicable user/AGENTS.md restrictions. Pass only necessary context, including existing changes in its area. Delegation grants no additional permission for tests, Storybook, commits, documentation, or scope expansion. Reviewers inspect without edits; implementers own disjoint write sets, with shared files integrated by the main agent.

When model selection is supported and permitted, prefer a known available lightweight model for mechanical work with explicit source/destination paths and a defined reference-update scope, such as batch renames or moves. A move needing architectural placement, public-path changes, or uncertain consumers first needs main-agent assessment; it is not mechanical merely because few files change. Choose from actual host capabilities rather than hardcoded model names; do not claim a model switch without runtime evidence.

Each subagent reports findings or changed files, checks actually performed, and unresolved limits. The main agent inspects the resulting diff and affected consumers, resolves conflicts, and verifies the integrated result against the task-scoped rules. A subagent's success report alone does not establish completion.

## Implementation Choice

Before writing code, choose the simplest direct implementation that satisfies the current requirements and all applicable architectural standards. Treat required layers, ownership boundaries, object/file structure, public APIs, and conventions as constraints, never as candidates for removal to shorten code. Keep the decision in the existing task-scoped working checklist; no separate document, approval, or process stage is required.

Inspect relevant project capabilities and installed library/framework APIs before designing a custom mechanism. Reuse a suitable existing capability through its permitted API and dependency direction. Create a mechanism only for a concrete gap in behavior, contract, or architecture; identify that gap rather than assuming reuse is unsuitable. Do not bypass a required boundary to reuse code or force an existing abstraction onto incompatible semantics.

Start with the direct data and control flow inside the required structure. Add abstractions, wrappers, state, checks, transformations, and error handlers only for a current requirement, observed contract, or mandatory structural rule. Hypothetical reuse, future configurability, and defensive handling of unsupported cases do not establish necessity. Use the language-specific implementation rules when applicable; required validation, cleanup, concurrency, and error semantics remain part of the solution.

## Task-Scoped Rule Check

Before editing, identify the requested behavior, contracts to preserve, and applicable requirements from the user, AGENTS.md, the owning skill, and loaded references. Keep a compact working checklist with source locations; include conditional rules only when their condition holds. This is working context, not a new file, repeated rule dump, or approval step. Resolve ordinary choices from project evidence; ask only about a material unresolved conflict. On resuming after context loss or a scope change, recover this checklist and only the missing relevant guidance.

## Completion

Review the actual diff and necessary consumers against the working checklist. For each applicable requirement, identify evidence in changed code or performed checks; mark it satisfied, violated, or unverified. Correct in-scope violations before completion. Do not treat reading a skill, recalling its intent, or passing lint/typecheck as proof that all its rules were followed. Report material unverified requirements without claiming compliance.

For each added or changed helper, abstraction, wrapper, state, handler, branch, check, transformation, fallback, and catch, identify the current requirement, observed contract, or mandatory structural rule it serves. Compare the actual implementation with the direct solution chosen before coding and with suitable existing project/library capabilities. Remove unnecessary additions and duplication within the authorized diff, including state derivable from an existing source and error handlers that only rethrow unchanged. Preserve mandatory architecture and conventions, required validation, security, error handling, lifecycle, concurrency, and compatibility. Do not remove required layers, owned hooks, repositories, DTO mappings, type files, or public entrypoints merely because they look indirect. Hypothetical reuse and shorter line counts are not sufficient reasons to add or remove structure. Re-run relevant permitted checks after corrections.

When a user questions a block, inspect its consumers and contract before agreeing to remove it. Explain its concrete purpose or simplify it when the evidence supports that change; the question itself is not evidence of redundancy.

Run the smallest relevant available checks for authorized changes, including existing safe tests unless the user or project prohibits them. Inspect command definitions, setup, and relevant hooks first when effects are unclear. Test execution does not authorize source or snapshot updates, dependency installation, destructive operations, or external mutations; isolate test data and use local disposable resources. Obtain missing authorization for such effects or report the verification limit. Do not broaden to full suites without a concrete need. Diagnose failures against the required contract before changing production code; do not weaken tests or edit them without authorization.

Distinguish static reading, formatting, typecheck, lint, build, test execution, and other observed runtime behavior. Reading never proves interactivity, accessibility, or runtime behavior. Report the result, checks actually performed, and material limits briefly; keep the internal checklist out of the final answer unless requested.
