---
name: codify-rule
description: Explicit requests to persist or amend a lasting working rule. Feedback, repetition, and task-only constraints alone do not activate it; memory updates are separate.
---

# Codify Rule

Turn an explicitly selected instruction into a scoped, actionable rule. Repetition is evidence of relevance, never permission to persist. Invoking this skill without identifying the rule requires clarification, not invention. Never update memory unless the user directly requests a memory change; a request to establish a rule is not such a request.

Follow [workflow and authority](../../references/shared/workflow-and-authority.md) once. This skill owns rule wording and scope; it does not authorize implementing the behavior described by the rule. Use [document-agent-context](../document-agent-context/SKILL.md) only when project documentation or its routing also needs maintenance.

## Choose One Owner

Respect an explicit destination. Otherwise select the narrowest scope supported by the request, rather than generalizing from the current project or a single failure:

| Scope | Canonical destination |
| --- | --- |
| All user projects | The active user-level instructions file, commonly `~/.codex/AGENTS.md`; verify the environment's actual location. |
| One project or subtree | Its applicable `AGENTS.md`, at the narrowest directory where the rule belongs; retain existing documentation routes. |
| An existing Amy skill | That skill's source `SKILL.md`, or its already owning reference when the rule concerns that reference. A rule genuinely shared by skills belongs in the existing shared reference. Use the plugin source and its maintenance instructions, never edit installed copies independently. |
| Current task only | Keep it in the conversation; write no persistent file. |

An artifact-specific standard belongs to its owning skill; a personal cross-project preference belongs to user instructions. A project-specific contract belongs to that project, even if a plugin skill is used there. If materially different scopes remain plausible, ask about scope before writing; proceed with independent inspection. If the user expressly limits an invoked request to this task, honor that boundary without persistence.

## Resolve and Apply

1. Extract the intended decision from the correction or supplied wording. Preserve exceptions and limits. State the trigger, required action, and cases outside the rule; avoid incident transcripts, unsupported universal claims, and secret values.
2. Read the destination, applicable higher-level instructions, and relevant existing skill or routed reference. Search those sources for equivalent and conflicting rules. An equivalent rule needs no duplicate; refine its canonical wording only if the request adds meaning. Do not copy the rule into consumers or multiple scopes; add a conditional link only when necessary for discovery.
3. Resolve conflicts before editing. Apply an explicitly requested replacement within its authorized scope. When incompatible existing requirements leave intent unclear, show the conflicting clauses and ask which should prevail. Do not silently delete an exception or attempt to override higher-priority instructions in a lower-level file.
4. Make the concrete, minimal edit to the chosen file, preserving surrounding user changes. Create an instructions file only when the requested scope needs one and no active equivalent exists. An unavailable or unwritable destination is a limitation, not permission to store elsewhere or in memory.
5. Review the diff and check an applicable case, a nearby excluded case, and any conflict or exception. Use the existing routing catalog for plugin scenarios; do not create tests or extra artifacts without authorization. Run the destination's permitted validators and plugin synchronization when applicable. Distinguish scenario inspection from observed agent behavior.

Report the rule, its scope, the changed file, and verification or unresolved conflicts. If no persistence was appropriate, say so. Activation and boundary scenarios live in [routing evaluation](../../references/shared/routing-evaluation.md).
