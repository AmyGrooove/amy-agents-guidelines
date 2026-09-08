# Optional MCP Layer

Stage 21 evaluates whether a local/bundled Model Context Protocol (MCP) surface adds
material value beyond Amy's existing Runtime APIs, CLI commands, scripts, and skills.

## Verdict

`skip`.

The current architecture already exposes the useful Stage 21 candidates through
canonical local boundaries, while the remaining gaps are data/query gaps rather
than transport gaps. Adding MCP now would duplicate those boundaries without
creating a new capability.

## Capability assessment

| Roadmap candidate | Existing canonical surface | Stage 21 decision |
| --- | --- | --- |
| task history | optional Data Storage export/raw + normalized persistence contracts | no MCP wrapper; a canonical normalized query API does not exist yet |
| skill / agent stats | Stage 18 Analytics mechanism-health APIs | no second transport-specific analytics contract |
| strategy comparison | Stage 19 Evolution shadow comparison + Stage 18 routing cohorts | reuse canonical Runtime APIs |
| failures | Stage 15 Outcome/Failure Intelligence + Stage 18 Analytics | no MCP-specific failure taxonomy/query model |
| project graph | `IProjectIntelligenceApi` graph/impact APIs + existing intelligence CLI | already directly available locally |
| eval execution | `IEvalSystemApi` + `amy eval` offline CLI | already directly available locally |

`amy doctor`, `amy analyze`, `amy eval`, Project Intelligence CLI commands, and the
public Runtime exports provide explicit operator/agent-callable local entrypoints.
Skills already describe the agent-facing workflows that need Project and Context
Intelligence. No current workflow requires a long-lived protocol server, remote
client interoperability, or an MCP-only capability.

The missing normalized Storage query → Analytics boundary identified in Stage 20 is
not solved by MCP. Wrapping SQLite or JSONL directly in MCP would make a transport
layer own data semantics that currently have no canonical Runtime contract, creating
accidental coupling and a duplicate API.

## Why MCP is not added

A Stage 21 MCP implementation would add all of the following without demonstrated
product value:

- another versioned public schema surface over existing versioned contracts;
- server lifecycle and process/error isolation concerns;
- tool authorization and payload-bounding policy;
- a second discovery/invocation path beside Runtime API, CLI, scripts, and skills;
- adapter tests and compatibility maintenance for duplicated operations;
- pressure to expose raw or storage-specific data before a canonical query boundary
  exists.

This conflicts with the roadmap requirement that optional capabilities must not
become required and with Amy's primary objective of minimizing the cost of a reliable
result.

## Revisit criteria

MCP can be reconsidered only when at least one concrete workflow demonstrates value
that cannot be achieved reasonably through the canonical local surfaces. Examples
of sufficient evidence would be:

- Codex or another supported host requires MCP tools to invoke Amy capabilities that
  cannot be reached through the plugin's existing CLI/skills/runtime boundary;
- multiple external local clients need the same Amy operations and maintaining CLI
  adapters becomes measurably more expensive than one bounded MCP adapter;
- a canonical task-history/storage query API exists and MCP measurably improves its
  safe consumption without owning storage semantics;
- eval/project-graph/analytics integrations need structured interactive tool calls
  that materially outperform subprocess CLI use in reliability or context cost.

Any future MCP layer must remain an adapter over canonical Amy Runtime contracts. It
must not introduce MCP-owned business semantics, become a dependency of
`createAmyRuntime()`, or start automatically.

## Changes in Stage 21

Stage 21 intentionally adds no Runtime code, MCP server, dependency, capability id,
configuration, generated artifact, or plugin version bump. The only repository
changes are this decision/handoff record and links from the architecture/index docs.

# Stage Handoff

- **Stage:** 21 — Optional MCP Layer.
- **Verdict:** `skip` — no demonstrated incremental value beyond canonical Runtime
  APIs, CLI, scripts, and skills.
- **Implemented:** architectural evaluation and explicit decision record; documented
  existing-surface mapping, rejection rationale, and evidence required to revisit
  MCP; linked the decision from primary Amy docs.
- **Canonical interfaces/contracts:** unchanged. Existing Project Intelligence,
  Analytics, Eval System, Evolution, Outcome/Failure Intelligence, Data Storage, and
  Operations contracts remain canonical. No MCP-specific contract exists.
- **Key architecture decisions:** transport must not own missing domain/query
  semantics; lack of a normalized Storage query → Analytics boundary is not a reason
  to expose storage internals through MCP; MCP must remain optional if ever added;
  no long-lived server or duplicate tool surface is justified now.
- **Verification results:** Stage 21 is documentation-only by design. Production
  typecheck, build, test typecheck/compile, and generated parity passed with the
  available toolchain (Node `22.16.0`, TypeScript `5.8.3`, Node types `25.1.0`);
  the full Runtime suite passed `187/187` tests across `24/24` suites; generated
  output matched TypeScript sources. `pnpm` and archived `node_modules` were
  unavailable, so the exact package-script wrapper (`pnpm check`) could not be run;
  equivalent underlying checks were executed directly. The first streamed aggregate
  run was interrupted by an external timeout during the CLI suite; the captured
  immediate rerun completed with `187` passes and `0` failures. Documentation links,
  JSON manifests, version parity, archive cleanliness, and source-diff scope are
  verified before packaging.
- **Technical debt:** Stage 20's missing canonical normalized Storage query →
  Analytics adapter remains; this still blocks a clean persistent `amy stats`/task
  history surface. This is not Stage 21 scope and MCP would not resolve it.
- **Limits:** no MCP server/tools/resources, no remote protocol surface, no storage
  query API, no new runtime dependency, no automatic server lifecycle.
- **Next-stage constraints:** Stage 22 should harden the existing end-to-end Amy
  system rather than reopen MCP unless concrete integration evidence appears. Treat
  the absence of MCP as intentional, not as an incomplete dependency.
- **Expected next Roadmap v2 stage:** 22 — Final Integration + Hardening.
