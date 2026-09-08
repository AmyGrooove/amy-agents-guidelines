# Observability + Decision Provenance

Stage 13 adds a small optional observability boundary on top of the existing
`RuntimeEventBus`.

## Verdict

`simplify`

Amy already had a best-effort event bus for runtime lifecycle and capability
resolution. Stage 13 does not add a second telemetry framework, persistence,
background collection, or an orchestration hook in every subsystem. It adds one
bounded record contract, one fail-open recorder capability, and deterministic
builders that translate canonical Stage 4–12 decisions into compact provenance.

## Capability

`amy.observability` is optional and is not registered by `createAmyRuntime()` by
default. It has no Runtime capability dependencies.

Versions:

- capability: `1.0.0`;
- API: `1`;
- record schema: `1`;
- observability policy: `1`.

Public API:

```ts
interface IObservabilityApi {
  record(value: unknown): Promise<Readonly<IObservabilityReceipt>>;
}
```

The capability receives the same `IRuntimeEventBus` and `runtimeId` used by the
host Runtime. It emits a canonical `observability.recorded` runtime event rather
than creating a second transport.

Explicit CLI access:

```text
node runtime/dist/cli.js observability-record --input <observability-input.json> --project <path>
```

## Telemetry

`kind: telemetry` records intentionally stay small. They identify:

- a subject: `runtime`, `session`, `task`, `agent-run`, `tool-call`, `dag-node`,
  `verification`, or `recovery`;
- lifecycle: `started`, `completed`, `failed`, `cancelled`, or `observed`;
- optional duration;
- optional compact error code;
- optional opaque evidence/artifact refs.

Existing `runtime.started`, `runtime.stopped`, `capability.resolved`, and
`capability.failed` events remain canonical runtime telemetry and are not
re-emitted as duplicate observability records.

## Decision Provenance

`kind: decision` records answer why a bounded decision was made without storing
uncontrolled reasoning. A record contains:

- decision kind;
- compact decision value;
- structured reason codes;
- evidence refs;
- confidence when the source exposes it;
- policy owner/version;
- optional compact explanation.

There is no generic payload/attributes bag. Unknown fields are rejected, so raw
prompts, tool payloads, messages, `chainOfThought`, or arbitrary reasoning blobs
cannot silently enter the canonical record.

`buildDecisionProvenance()` consumes typed canonical outputs from Stages 4–12
and emits normalized decision inputs for:

- classification;
- context selection;
- compute;
- strategy;
- Scout activation;
- decomposition;
- parallelism;
- Verifier;
- Reviewer;
- Completion retry guard;
- Recovery action;
- Recovery retry/escalation.

For Strategy, Decomposition, Verification, Completion, and Recovery, provenance
reuses the source `policyVersion`. Earlier Task/Context/Compute contracts did not
publish a separate policy version; their existing decision/resolution
`schemaVersion` is therefore used as the stable version reference rather than
mutating those already-canonical Stage 4–6 schemas.

Evidence references stay bounded to 32 items per provenance record. The canonical
`sourceRef` is kept first and therefore always points to the complete source
artifact; additional evidence refs are deduplicated in source order and truncated
deterministically when the upstream canonical result contains more detail.

### Recovery provenance

Recovery is intentionally not reclassified. Provenance directly reuses:

- `TRecoveryReasonCode` values;
- the failing branch id/kind;
- diagnosis evidence refs;
- the Recovery action;
- Recovery policy version.

`retry` and `compute-escalate` additionally produce the dedicated `retry` or
`escalation` provenance decision. Other recovery actions remain represented by
the general `recovery` decision.

## Fail-open delivery

A valid record is emitted through `IRuntimeEventBus`. Delivery produces a
receipt:

- `emitted` — event bus accepted it, including the valid zero-consumer case;
- `degraded` — one or more consumers failed while others may have succeeded;
- `dropped` — the injected event port itself threw.

Consumer or event-port failures are returned as delivery evidence and never
throw into the caller's main execution path. Structural validation errors still
throw because they indicate a malformed observability contract rather than a
telemetry backend failure.

## Deliberate limits

Stage 13 does not add:

- JSONL/SQLite persistence;
- migrations or retention;
- redaction/privacy policy beyond bounded no-raw-payload contracts;
- automatic instrumentation of every function;
- background workers;
- timing instrumentation wrappers;
- outcome/failure analytics;
- dashboards;
- production routing changes.

Persistent storage, corruption handling, retention, export, and stronger privacy
controls are implemented by the separate optional Stage 14 `amy.data-storage`
capability; Stage 13 observability itself remains persistence-agnostic. See
[Data Storage + Privacy](./data-storage.md).

# Stage Handoff

- **Stage:** 13 — Observability + Decision Provenance.
- **Verdict:** `simplify`.
- **Implemented:** optional `amy.observability`; bounded telemetry and decision
  provenance records; fail-open delivery through the existing `RuntimeEventBus`;
  deterministic Stage 4–12 provenance adapters; explicit `observability-record`
  CLI; public Runtime exports; `observability.recorded` event; deterministic
  evidence-ref bounding while retaining the canonical source artifact ref.
- **Canonical interfaces/contracts:** `IObservabilityApi`,
  `TObservabilityInput`, `IObservabilityTelemetryInput`,
  `IObservabilityDecisionInput`, `TObservabilityRecord`,
  `IObservabilityReceipt`, `IObservabilitySubject`, `IObservabilityPolicyRef`,
  `OBSERVABILITY_VERSIONS`, `createObservabilityCapability()`,
  `recordObservability()`, `validateObservabilityInput()`,
  `buildDecisionProvenance()`, `TDecisionProvenanceSource`, and Runtime event
  `observability.recorded`.
- **Key architecture decisions:** reuse the Stage 1 `RuntimeEventBus` instead of
  creating a telemetry transport; capability stays optional and unregistered by
  default; existing Runtime lifecycle events remain canonical instead of being
  duplicated; decision provenance is a downstream projection of existing Stage
  4–12 contracts, not a new decision owner; Recovery reason codes/branch/evidence
  and policy version are reused directly; no persistence is introduced before
  Stage 14; raw reasoning/prompt/tool payload bags are not part of the schema.
- **Verification results:** production typecheck/build and post-build test
  typecheck/compile passed; full Runtime runner passed `139/139` tests across
  `19` suites; isolated CLI suite passed `16/16`; generated `runtime/dist` parity
  passed; package/manifest version parity is `2.12.0`; JSON parsing, all `16`
  skill directories, Markdown links, and the Stage 12→13 changed-file scope were
  verified. The environment did not provide `pnpm`, so equivalent commands ran
  directly with Node `22.16.0` + available TypeScript `5.8.3`/Node typings. One
  initial concurrent full-run attempt hit the execution timeout without an
  assertion failure; the isolated CLI suite and immediate full-run retry both
  completed successfully.
- **Technical debt:** Stage 4–6 canonical contracts expose schema versions but no
  distinct policy version, so provenance uses those schema versions as the stable
  compatibility reference; evidence references remain opaque and host-owned; the
  existing test typecheck imports `runtime/dist`, so `pnpm typecheck` is
  order-dependent on a prior build when generated output has been cleaned; the
  existing parallel test runner can be resource-sensitive because the CLI suite
  itself launches synchronous child processes.
- **Limits:** no JSONL/SQLite, migrations, retention/cleanup/export, raw-content
  storage, privacy/redaction engine, automatic instrumentation, dashboards,
  outcome/failure intelligence, or routing mutation.
- **Next-stage constraints:** Stage 14 storage should subscribe to the existing
  Runtime event boundary (including `observability.recorded`) instead of adding a
  second transport; persistence must remain optional/fail-open; raw prompts/tool
  payloads stay excluded by default and any raw-content support must be explicit
  opt-in with redaction/secret protection; storage failure must not become an
  execution dependency.
- **Expected next Roadmap v2 stage:** 14 — Data Storage + Privacy.
