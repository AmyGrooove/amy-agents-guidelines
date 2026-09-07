# Amy Runtime

Amy Runtime is an explicitly invoked deterministic foundation for extending Amy
with independent capabilities. Installing the plugin does not route existing
skills through Runtime and does not start a background process.

## Architecture

The small Runtime kernel composes configuration, the capability registry,
runtime state, lifecycle events, and lifecycle control. It contains no React,
Effector, NestJS, analytics, project analysis, or domain-skill behavior.

Capabilities expose a descriptor and a public API. They register before Runtime
startup and can declare required and optional capability dependencies. Runtime
configuration decides whether a capability is enabled or required for the
current execution. Missing, disabled, incompatible, and temporarily unavailable
optional capabilities have explicit resolution statuses and do not break an
unrelated operation.

Core depends only on public contracts. Optional capability implementations may
depend on lower-level public capabilities, but core never imports them.

## Existing plugin mechanisms

Skills remain instructions describing how to perform a kind of work. Agents are
independent reasoning workers that may use multiple skills. Deterministic code
owns configuration, discovery, validation, capability resolution, state, event
delivery, and version checks.

The built-in `amy.plugin-inventory` compatibility capability reads plugin
metadata and reports canonical skills, agents, validators, permissions, and
scripts. `PluginInventory` is descriptive: discovery never registers or runs
the reported mechanisms.

## Public API

The TypeScript source in `runtime/src` builds to ESM in `runtime/dist`.
The generated directory is ignored by Git and is created explicitly with
`pnpm build` after dependencies are installed.
Consumers import `runtime/dist/index.js` and explicitly call `createAmyRuntime`.

Runtime registration is open until `start()`. Startup validates required
capabilities and dependencies and freezes registration. `resolveOptional`
returns a status; `resolveRequired` raises `AmyRuntimeError` when resolution is
not possible.

## CLI

Install dependencies and build Runtime before using its API or CLI:

```text
pnpm install
pnpm build
```

Runtime then runs on Node.js 20 or newer:

```text
node runtime/dist/cli.js status
node runtime/dist/cli.js capabilities
node runtime/dist/cli.js inventory
node runtime/dist/cli.js config --project <path>
```

`--project` defaults to the current directory. `--plugin` overrides plugin-root
discovery. Commands return JSON and never modify configuration or project files.

## Configuration

Runtime merges configuration in this order:

1. Amy defaults.
2. `~/.amy/config.json`.
3. `<project>/.amy/config.json`.
4. API or CLI overrides.

Schema version 1 accepts only per-capability `enabled` and `required` booleans.
Later sources merge by capability ID and override only explicitly supplied
properties. Invalid JSON, unknown fields, and unsupported schema versions fail
with `INVALID_CONFIGURATION`.

## State and events

`StateStore` is asynchronous and namespaced. Stage 1 supplies only
`MemoryStateStore`; no persistence is required. JSON-compatible records carry
the independent state-schema version.

`RuntimeEventBus` delivers lifecycle events on a best-effort basis. Consumer
failures appear in `EventDeliveryResult` and never control the main workflow.
No consumer is a valid no-op configuration.

## Compatibility and versions

Runtime API, configuration, capability contracts, state, and events each have
an independent integer major version. Capability implementations retain their
own SemVer version and dependency-major requirements.

Stage 1 adds Runtime without changing existing skill instructions, activation,
references, permissions, or canonical Codex behavior.

## Intentionally absent

Stage 1 does not implement project/context/task intelligence, automatic project
specifications, knowledge graphs, task classification or decomposition, model
selection, advanced orchestration, reviewer intelligence, analytics,
dashboards, evolution, automatic skill rewriting, persistent adapters,
long-term memory, or automatic skill routing.
