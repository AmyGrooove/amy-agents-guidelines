# Final Integration + Hardening

Stage 22 validates Amy as one agent engineering harness without introducing a new
orchestrator, mandatory capability bundle, or transport layer.

Structural migration `2.19.2` later moved production sources to `src/` and removed
the Amy repository test suite and its test configuration. Test-related sections below
record historical Stage 22 evidence; they are not current verification commands.

## Verdict

`simplify`.

The existing Stage 1-20 capabilities already expose the required canonical
boundaries. Final integration is therefore implemented as regression coverage,
clean-build hardening, release checks, and an architectural disposition of the
existing mechanisms rather than a new execution subsystem.

## Integration result

The canonical execution path remains host-composed and explicit:

```text
Task Contract
→ Task Intelligence
→ Context Intelligence
→ Compute Routing
→ Strategy Routing
→ optional Decomposition/DAG
→ host-owned execution
→ Verification
→ Completion
→ optional Recovery
→ Outcome Intelligence
→ optional Observability/Data
→ optional Analytics/Eval/Evolution
```

Stage 22 adds no function that owns this entire chain. This is intentional: semantic
normalization, agent execution, command execution, and optional capabilities remain
owned by their existing boundaries instead of being collapsed into a giant
orchestrator prompt or runtime object.

## Hardening changes

### Clean public-API typecheck

Runtime tests intentionally import `runtime/dist/index.js` so they exercise the same
public entrypoint as consumers. On a clean source tree, the previous `typecheck`
script tried to typecheck those tests before `runtime/dist` existed. Stage 22 makes
the build dependency explicit before test typechecking while preserving the
production no-emit typecheck.

This is a packaging/developer-workflow fix only. Runtime contracts and capability
behavior are unchanged.

### End-to-end regression coverage

`runtime/tests/FinalIntegration.test.ts` covers cross-capability behavior that was
previously proven mostly by subsystem suites:

- trivial task → Context → FAST compute → Fast Path → no DAG → Verification →
  Completion → successful Outcome;
- high-risk multi-module task → Worker + decomposition → bounded three-node DAG →
  conditional Verifier/Reviewer → sequential execution when coordination and
  integration cost are high;
- failed mechanical verification → failed Completion → bounded scoped Recovery with
  mandatory re-verification → failure Outcome rather than false success;
- Runtime lifecycle and Observability remain fail-open when the optional Data Storage
  consumer fails;
- package/manifest version parity and strict plugin SemVer;
- clean-source typecheck ordering for tests that consume the public build.

These tests compose canonical APIs directly. They do not add an Amy-wide coordinator.

## Subsystem disposition

| Subsystem | Verdict | Stage 22 disposition |
| --- | --- | --- |
| Runtime kernel / capability registry | `keep` | Small deterministic lifecycle and optional-capability boundary remains appropriate. |
| Project Intelligence + freshness/graph | `keep` | Existing deterministic knowledge/freshness contracts already cover project context and drift. |
| Task Intelligence | `keep` | Cheap text-first classification remains the correct front door. |
| Context Intelligence | `keep` | Budgeted resolution and explicit Project Intelligence fallback remain canonical. |
| Compute Routing | `keep` | Logical profiles remain independent from roles and vendor models. |
| Agent Roles + Handoff | `keep` | Minimal universal role catalog remains sufficient; domain expertise stays in skills. |
| Strategy Routing / Fast Path | `keep` | Fast Path is preserved and now covered end-to-end. |
| Decomposition / DAG / parallelism policy | `keep` | Bounded DAG planning is useful; no scheduler is added. |
| Verification | `keep` | Mechanical + conditional semantic/review evidence remains canonical. |
| Completion / Stop Guards | `keep` | Evidence-based completion prevents failed verification from becoming success. |
| Retry + Escalation | `keep` | Recovery remains bounded, diagnosed, branch-local, and verification-gated. |
| Observability / provenance | `keep` | Fail-open event delivery and bounded provenance remain appropriate. |
| Data Storage / privacy | `keep` | Optional JSONL/SQLite persistence remains isolated and privacy-first. |
| Outcome / Failure Intelligence | `keep` | Completion plus post-task/recovery evidence remains the canonical outcome model. |
| Eval System | `keep` | Host-owned execution with deterministic scoring avoids an LLM/runtime dependency. |
| Analytics / mechanism health | `keep` | Descriptive, segmented, non-causal analysis remains appropriately separated. |
| Controlled Evolution | `keep` | Proposal-only evolution preserves explicit user authority. |
| Operations CLI | `keep` | Thin `doctor`/`analyze`/`eval` adapters are sufficient. |
| MCP | `remove` / absent | Stage 21 `skip` remains intentional; no duplicated protocol surface is introduced. |
| Amy-wide orchestrator | `remove` / absent | A new giant coordinator would duplicate existing contracts and couple optional capabilities. |

No subsystem required a production API rewrite in Stage 22.

## Remaining technical debt

- There is still no canonical normalized Data Storage query → Analytics adapter, so a
  persistent `amy stats` / task-history surface remains deferred. This is a domain
  query contract gap, not a reason to add MCP or expose SQLite directly.
- `amy doctor` does not validate a real marketplace installation, execute a target
  project's tests/build, or prove host/Codex compatibility outside the source tree.
- Actual agent execution, semantic verifier/reviewer work, source exploration, and
  DAG scheduling remain host-owned by design. Runtime records/plans/contracts do not
  pretend to execute them.
- Clean install with the exact pinned pnpm toolchain still requires `pnpm install`;
  source archives intentionally do not contain `node_modules` or generated `dist`.
- Performance/token overhead for LLM-hosted workflows cannot be measured from this
  deterministic source-only environment; Stage 17/18 telemetry/analytics remain the
  canonical place to measure it in real usage.

## Compatibility

Stage 22 changes no Runtime schema major, capability ID, capability API, or capability
version. Existing skills and explicit Runtime invocation remain backward compatible.
The plugin/package version advances by PATCH to `2.19.1` because the only behavior
change is developer/release hardening.

# Stage Handoff

- **Stage:** 22 — Final Integration + Hardening.
- **Verdict:** `simplify` — harden and prove the existing canonical pipeline instead
  of creating a new Amy-wide orchestrator.
- **Implemented:** clean-source public-API typecheck ordering; Stage 22 cross-capability
  integration regression suite; strict package/manifest version-parity coverage;
  subsystem `keep / simplify / fix / remove` self-review; final hardening decision
  record; plugin/package PATCH `2.19.1`.
- **Canonical interfaces/contracts:** unchanged. Task Contract, Project/Context
  Intelligence, Compute/Strategy decisions, Agent Handoff, Decomposition plan,
  Verification result, Completion evidence, Recovery plan, Observability/Storage,
  Outcome, Eval, Analytics, Evolution, and Operations remain the canonical boundaries.
- **Key architecture decisions:** no giant orchestrator; no automatic capability
  bundle; no MCP reopening; optional mechanisms remain optional; host owns actual
  execution and semantic work; integration tests compose existing public APIs rather
  than creating a second pipeline abstraction.
- **Verification results:** TDD RED reproduced the clean-source typecheck defect,
  then the focused Stage 22 suite passed `6/6`; production build and production/test
  typechecks passed with the available Node `22.16.0` / TypeScript `5.8.3` toolchain;
  a clean-source sequence (`prod noEmit → build → test noEmit`) passed; the full
  Runtime suite passed `193/193` tests across `25/25` suites; generated output matched
  TypeScript sources; `amy doctor` returned `healthy` with `10` checks and no warnings
  or failures; package/manifest JSON and strict `2.19.1` SemVer parity passed; `100`
  local Markdown links resolved; a deterministic routing smoke completed `10,000`
  local Task→Compute→Strategy iterations at about `0.083 ms/iteration` in this
  environment with a `324`-byte fallback context packet. Exact `pnpm check`,
  `pnpm install`, marketplace reinstall, and external Codex host checks were
  unavailable because pnpm/project dependencies are not shipped in the source ZIP.
- **Technical debt:** normalized Storage query → Analytics adapter / persistent
  `amy stats` remains deferred; external marketplace/Codex installation and real
  LLM token/performance measurements require the host environment.
- **Limits:** no background daemon, no DAG scheduler, no automatic retries, no
  automatic project commands, no automatic policy mutation, no mandatory optional
  capability, no MCP server.
- **Next-stage constraints:** Roadmap v2 ends here. Future work should be evidence-led
  maintenance or a separately approved roadmap; do not treat deferred optional
  mechanisms as unfinished Stage 22 dependencies.
- **Expected next Roadmap v2 stage:** none — Stage 22 completes Amy Roadmap v2.
