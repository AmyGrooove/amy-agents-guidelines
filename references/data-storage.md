# Data Storage + Privacy

Stage 14 adds a small optional persistent data boundary without changing Amy's
execution path. Storage is downstream of the existing Runtime event bus:

```text
Runtime / Observability events
↓
RuntimeEventBus
↓
explicit Data Storage consumer
↓
privacy sanitization
↓
append-only JSONL + optional normalized SQLite
```

`amy.data-storage` is not registered by `createAmyRuntime()` and does not start a
background writer. A host explicitly creates/registers the capability and
subscribes `createDataStorageEventConsumer()` only when the capability is enabled
for that execution.

## Canonical API

The Stage 14 public boundary is:

```ts
interface IDataStorageApi {
  capture(value: unknown): Promise<IDataStorageCaptureReceipt>;
  cleanup(): Promise<IDataStorageCleanupReceipt>;
  exportData(options?: IDataStorageExportOptions): Promise<IDataStorageExport>;
  getStatus(): IDataStorageStatus;
}
```

Version ownership is independent:

- API: `1`;
- privacy/storage policy: `1`;
- raw JSONL record schema: `1`;
- SQLite schema: `1`.

The capability has no required Amy capability dependency. `Observability` remains
usable without storage, and storage can also capture ordinary Runtime lifecycle
or capability events.

## Storage layout

A caller chooses the root directory. The file implementation uses:

```text
<root>/
  raw/
    YYYY-MM-DD.jsonl
  cache/
  reports/
  evals/
  amy.sqlite
```

The three artifact directories establish bounded canonical locations for later
Analytics/Eval stages; Stage 14 does not populate them with invented data.

### Raw events

Raw storage is append-only JSONL segmented by UTC capture day. Each line is a
versioned wrapper containing `capturedAt` and a sanitized canonical Runtime event.
Segmentation keeps normal writes append-only and lets retention remove whole old
segments instead of rewriting a live log.

### Normalized SQLite

With `sqlite: auto` (default), the implementation dynamically loads Node's
built-in `node:sqlite`. It stores:

- normalized `runtime_events` for all current Runtime event types;
- an `observability_records` projection for `observability.recorded`;
- `amy_storage_migrations` with the applied schema version.

Indexes cover capture/event timestamps, Runtime IDs, event kind, observability
subject, record ID, and record kind. SQLite uses WAL, a bounded busy timeout, and
transactional writes/cleanup.

No runtime npm dependency is introduced. On a Node runtime that does not expose
`node:sqlite`, raw JSONL can still succeed and the receipt is `degraded` rather
than breaking Amy. A caller can explicitly choose `sqlite: disabled` when only
raw storage is desired.

## Privacy policy

Privacy is deterministic and applied before either backend receives an event.

Default policy:

```text
rawContent = omit
retentionDays = 30
sqlite = auto
```

Secret-like keys are always replaced with `[redacted]`. Bearer tokens and common
inline secret assignments are redacted inside strings. `.env` and environment
variant paths are protected while `.env.example` / `.env.sample` /
`.env.template` remain usable documentation references.

Prompt/body/messages/tool-payload-like fields are treated as raw content:

- default: `[raw-content-omitted]`;
- explicit `rawContent: redacted`: preserve the field only after recursive secret
  redaction.

Stage 14 intentionally provides no unredacted raw-content mode. Adding one would
create unnecessary privacy risk before there is a demonstrated product need.

## Failure and corruption handling

Backend I/O failures do not turn into execution success and do not control the
main Amy workflow:

- `capture()` returns `stored`, `degraded`, or `dropped` with backend-specific
  failures;
- the event consumer converts degraded/dropped capture into a consumer failure;
- `RuntimeEventBus` already isolates consumer failures, so the emitter continues
  while retaining evidence that persistence degraded.

Corrupt JSONL lines are skipped and counted during bounded export. A corrupt
SQLite database is quarantined with a timestamped `.corrupt-*` suffix and one
fresh-database recovery attempt is made. Repeated/non-corruption failures remain
fail-open and are returned as storage failures.

## Retention and export

`cleanup()` applies the configured retention window:

- whole JSONL day segments older than the UTC cutoff day are removed;
- normalized SQLite rows older than the exact cutoff timestamp are deleted in a
  transaction.

Because raw cleanup never rewrites the cutoff-day segment, raw retention may keep
less than one additional day of events. This is an intentional concurrency-safe
trade-off.

`exportData()` returns newest-first sanitized raw records with a bounded limit
(default `500`, hard cap `5000`), a `truncated` flag, and the number of corrupt
lines encountered while scanning the bounded export window.

## Explicit integration

Example host wiring:

```ts
const storage = createDataStorageCapability({
  rootDirectory: join(projectRoot, '.amy', 'data'),
});

runtime.capabilities.register(storage);
const resolution = await runtime.resolveOptional('amy.data-storage');

if (resolution.status === 'available') {
  runtime.events.subscribe(createDataStorageEventConsumer(storage.api));
}
```

Configuration still controls whether the capability is enabled/required through
the existing capability map; storage-specific privacy/retention settings are
factory options, so Stage 14 does not mutate Runtime config schema 1.

## Deliberate limits

Stage 14 does not add:

- automatic default registration or background services;
- an ORM or external SQLite dependency;
- normalized task/outcome/failure tables before Stage 15 owns those semantics;
- analytics queries or dashboards;
- automatic retention scheduling;
- unredacted prompt/tool payload persistence;
- CLI product commands that belong to later Amy Operations work.

# Stage Handoff

- **Stage:** 14 — Data Storage + Privacy.
- **Verdict:** `implement` with a deliberately thin persistence boundary.
- **Implemented:** optional `amy.data-storage`; append-only day-segmented JSONL;
  privacy sanitization before persistence; dynamically loaded normalized SQLite;
  schema migration table and indexes; WAL/busy-timeout transactional writes;
  corrupt SQLite quarantine/recovery; corrupt JSONL accounting; retention cleanup;
  bounded newest-first export; canonical event-consumer adapter; cache/report/eval
  artifact directories; public Runtime exports; plugin version `2.13.0`.
- **Canonical interfaces/contracts:** `IDataStorageApi`,
  `IDataStorageCaptureReceipt`, `IDataStorageCleanupReceipt`,
  `IDataStorageExport`, `IDataStorageRawRecord`, `IDataStorageStatus`,
  `IDataPrivacyPolicy`, `DATA_STORAGE_VERSIONS`, `DATA_STORAGE_LIMITS`,
  `DEFAULT_DATA_STORAGE_POLICY`, `FileDataStorage`,
  `createDataStorageCapability()`, `createDataStorageEventConsumer()`, and
  `sanitizeRuntimeEventForStorage()`.
- **Key architecture decisions:** reuse `RuntimeEventBus` rather than creating a
  second telemetry transport; no automatic capability registration; raw JSONL is
  always the portable baseline; SQLite is a dynamically imported optional
  normalized projection; storage configuration remains factory-owned so Runtime
  config schema 1 stays backward compatible; privacy is applied before both
  backends; raw content has only omit/redacted modes; normalized Stage 15
  semantics are not invented early.
- **Verification results:** baseline Stage 13 passed `139/139` tests across `19`
  suites before modification. Final Stage 14 production/test typecheck, build, and
  test compile passed; the full runner passed `146/146` tests across `20` suites;
  the isolated Stage 14 suite passed `7/7`; generated `runtime/dist` parity passed.
  A mutation check disabled SQLite corruption recovery and the targeted test failed
  as expected, then passed after recovery was restored. Manifest/package JSON,
  version parity, skills, Markdown links, changed-file scope, and clean ZIP contents
  were checked separately. `pnpm` was unavailable, so verification used Node
  `22.16.0` with the available TypeScript `5.8.3` and Node typings; the intended
  lockfile toolchain could not be installed in this environment.
- **Technical debt:** built-in `node:sqlite` availability depends on the host Node
  runtime and is still marked experimental by Node 22; raw JSONL cross-process
  append relies on OS append semantics; retention intentionally keeps the cutoff
  day's full raw segment; corruption quarantine preserves the main SQLite file
  but does not yet archive possible sibling WAL/SHM files separately.
- **Limits:** no automatic scheduling, no storage CLI, no unredacted raw content,
  no normalized outcome/failure entities, no analytics, no external DB, and no
  storage dependency in core execution.
- **Next-stage constraints:** Stage 15 should derive Outcome/Failure Intelligence
  from canonical Completion/Verification/Recovery/Observability evidence and may
  add only the normalized tables it actually needs; it should not bypass the
  Stage 14 privacy boundary or make storage mandatory. User corrections remain a
  semantic Stage 15 concern, not a raw prompt logging reason.
- **Expected next Roadmap v2 stage:** 15 — Outcome + Failure Intelligence.
