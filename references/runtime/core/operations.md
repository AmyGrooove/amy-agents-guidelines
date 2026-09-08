# Amy Operations

Stage 20 exposes the smallest useful operational surface over the existing Amy
Runtime. It does not add an Operations capability, service layer, scheduler, or
application framework.

## Verdict

`simplify`.

The existing CLI is already the canonical explicit operational entrypoint. Stage
20 extends it only where a mature Runtime needs a practical operator boundary:

- `doctor` for deterministic health diagnostics;
- `analyze` as a thin adapter to canonical `amy.analytics`;
- `eval` as a thin adapter to canonical `amy.eval-system` using precomputed
  observations.

`stats` is deliberately deferred. Stage 14 storage currently exposes capture,
cleanup, export, and status APIs, but no canonical normalized query API that can
feed Stage 17/18 Analytics. Adding `stats` now would either duplicate Analytics or
invent a second storage-query abstraction.

## `amy doctor`

```text
node runtime/dist/cli.js doctor --project <path> [--plugin <plugin-root>]
```

`doctor` runs before normal Runtime creation so invalid project configuration can
be reported as diagnostic evidence instead of preventing the diagnostic command
itself from starting.

The versioned `doctor-report` checks:

- package manifest readability;
- Node.js compatibility with `engines.node`;
- Codex plugin manifest discovery;
- package/plugin version parity;
- discovered skills and their `SKILL.md` files;
- generated Runtime entrypoints;
- Runtime configuration validity;
- optional Project Intelligence presence and canonical freshness state;
- optional persistent data-storage root;
- existing SQLite migration version, read-only, when SQLite storage exists.

Missing optional Project Intelligence or Data Storage is `skipped`, not a failure.
Stale/unknown Project Intelligence and an older supported storage schema are
`warn`/`degraded`. Broken required plugin/runtime structure, invalid configuration,
or incompatible/newer storage schema are `fail`/`unhealthy`.

Exit codes are intentionally operational:

- `0`: `healthy` or `degraded` report was produced;
- `1`: `unhealthy` report was produced.

The report is fail-safe where possible: individual diagnostic failures are captured
as checks instead of aborting the whole command.

### Canonical Operations contract

Stage 20 introduces only the report boundary required by `doctor`:

- `runAmyDoctor()`;
- `IAmyDoctorReport`;
- `IDoctorCheck`;
- `TDoctorCheckStatus`;
- `TDoctorStatus`;
- `OPERATIONS_VERSIONS.doctorSchema`.

This is a utility/report contract, not a new Runtime capability.

## `amy analyze`

```text
node runtime/dist/cli.js analyze --input <analytics-input.json> --project <path>
```

The input is the existing canonical `IAnalyticsInput`. The command registers
`amy.analytics` only for that invocation and calls `IAnalyticsApi.analyze()`.
There is no CLI-specific analytics model, persistence layer, or automatic data
collection.

Mechanism health and archetype-specific APIs remain available through Runtime APIs;
Stage 20 does not mirror every method as a separate command.

## `amy eval`

```text
node runtime/dist/cli.js eval --input <eval-input.json> --project <path>
```

The CLI envelope is:

```json
{
  "run": "<canonical IEvalRunInput>",
  "observations": {
    "<case-id>": "<canonical IEvalObservation>"
  }
}
```

The strings above describe contract positions; real input contains the actual JSON
objects.

The command registers `amy.eval-system` only for that invocation and delegates to
`IEvalSystemApi.runCorpus()`. It intentionally does not execute production tasks,
start agents, call an LLM, or synthesize missing observations. Each corpus case
must have a host-produced precomputed observation.

## Deliberate limits

Stage 20 does not add:

- an Operations capability or daemon;
- `stats` backed by a new query/store abstraction;
- dashboards or interactive UI;
- automatic data collection for `analyze`;
- task execution for `eval`;
- automatic Evolution proposal application;
- project command execution from `doctor`;
- a new hooks/agents subsystem when the plugin inventory does not define one;
- external marketplace/install-state validation.

Optional Analytics, Eval, Project Intelligence, and Data Storage remain optional.

# Stage Handoff

- **Stage:** 20 — Amy Operations.
- **Verdict:** `simplify` — extend the existing explicit CLI instead of creating an
  Operations framework.
- **Implemented:** deterministic fail-safe `amy doctor`; thin `amy analyze` adapter
  over Stage 17/18 Analytics; thin offline `amy eval` adapter over Stage 16 Eval
  using precomputed observations; Runtime exports, tests, docs, plugin version
  `2.19.0`.
- **Canonical interfaces/contracts:** `runAmyDoctor()`, `IAmyDoctorReport`,
  `IDoctorCheck`, `TDoctorCheckStatus`, `TDoctorStatus`,
  `OPERATIONS_VERSIONS.doctorSchema`; existing `IAnalyticsInput` /
  `IAnalyticsApi.analyze()` and `IEvalRunInput` / `IEvalObservation` /
  `IEvalSystemApi.runCorpus()` remain canonical for operational analysis/eval.
- **Key architecture decisions:** no `amy.operations` capability; CLI remains a thin
  explicit adapter; doctor executes before Runtime creation so broken config remains
  diagnosable; optional mechanisms are skipped rather than required; Project
  Intelligence freshness is interpreted by its existing contract (implementation
  drift alone does not become stale); SQLite migration inspection is read-only;
  Eval execution remains host-owned and the CLI accepts only existing evidence;
  `stats` is deferred rather than creating a duplicate Analytics/storage query
  subsystem.
- **Verification results:** TDD RED was observed for the new operational CLI
  commands before implementation; focused Stage 20 CLI tests passed; production and
  test typecheck succeeded; build succeeded; the full Runtime suite passed `187/187`
  tests across `24/24` suites; generated output matched TypeScript sources; CLI
  `doctor` smoke returned `healthy`, `analyze` returned an `analytics-report`, and
  offline `eval` completed at score `100`; package/manifest JSON and `2.19.0` version
  parity passed; `96` local Markdown links were checked with zero broken links;
  source-level diff review found changes limited to Stage 20 CLI/Operations, tests,
  docs, and version metadata. Exact `pnpm check` was unavailable because `pnpm` and
  installed project dependencies are not shipped in the source archive; checks used
  Node `22.16.0`, TypeScript `5.8.3`, and available Node types `25.1.0`. One
  aggregate verification invocation was interrupted by an external timeout during
  the CLI suite; the isolated CLI suite then passed `22/22` and an immediate full
  rerun passed `187/187`, so no reproducible test failure remained.
- **Technical debt:** no canonical normalized Storage query → Analytics adapter yet,
  so `stats` remains deferred; doctor does not validate marketplace installation,
  external Codex compatibility, or execute project tests/builds; `analyze` exposes
  the general Analytics report rather than every Analytics/health method; Node's
  built-in SQLite may emit its platform experimental warning when migration state is
  inspected.
- **Limits:** no background operations, no daemon/dashboard, no automatic Eval task
  execution, no automatic data ingestion, no automatic policy mutation, no new
  required optional capability.
- **Next-stage constraints:** Stage 21 must first demonstrate concrete value for MCP
  beyond these Runtime APIs, CLI commands, scripts, and skills. If the same use
  cases are already covered locally, prefer `skip`; Amy Runtime must never depend on
  MCP.
- **Expected next Roadmap v2 stage:** 21 — Optional MCP Layer.
