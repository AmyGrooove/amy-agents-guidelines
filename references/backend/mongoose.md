# Mongoose

An entity slice owns its schema, entity-specific repository, domain types and helpers, and entity module wiring. Endpoint transport DTOs and mapping remain outside it.

- Enable timestamps by default unless a concrete entity should not store `createdAt` and `updatedAt`.
- For new projects, use an explicit stable lower-camel-case plural collection name. Preserve an established existing collection name.
- Disable the version key by default.
- Configure `toJSON` with virtuals, expose `_id` as string `id`, and omit `_id` and `__v`.
- Add individual virtuals only for a real consumer.
- Define an index only for a confirmed uniqueness, query, sort, TTL, geospatial, or integration requirement. Never add speculative indexes; map each index to its actual constraint or operation.
- Reuse an existing suitable generic repository only behind the entity-specific repository boundary.
- Accept an application-service-owned `ClientSession` where required. A repository never begins, commits, or aborts the transaction implicitly.
- Never expose a Mongoose document directly through a transport response.

Schema changes, collection renames, operationally significant indexes, migrations, and destructive data implications require authorization under the shared workflow. A source schema change does not authorize applying a migration to an external database.
