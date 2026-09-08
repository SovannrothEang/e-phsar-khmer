# Engineering Rules

## Architecture

- Feature-oriented modules.
- Domain logic belongs inside domain/application boundaries.
- Infrastructure must not leak into domain logic.
- Do not introduce CQRS unless the feature explicitly requires it.
- Do not introduce a new abstraction when an existing one is sufficient.

## Dependencies

- Do not add packages without explicit justification.
- Prefer the standard library/framework.
- Reuse existing utilities and services.

## Database

- PostgreSQL is the source of truth.
- Transactions must be explicit where consistency matters.
- Never perform read-modify-write without considering concurrency.

## API

- Controllers remain thin.
- Business logic belongs in application/domain services.
- Validate at the boundary.

## Code Generation

- Modify the smallest possible number of files.
- Do not rewrite working code unnecessarily.
- Do not rename files/classes unless required.
- Do not create "future-proof" abstractions without a current use case.

## Testing

- Add tests for changed behavior.
- Do not generate tests that merely duplicate implementation details.

## Before finishing

- Remove unused imports.
- Remove dead code.
- Remove speculative abstractions.
- Explain every new file and dependency.

## Module README convention

A request like "give me the README for `<module>`" or "let's do a README for `src/<module>`" means: write `src/<module>/README.md` in the fixed shape below, so module docs stay comparable to each other instead of drifting into whatever shape felt natural that day. `apps/backend/src/payment/README.md` and `apps/backend/src/chat/README.md` are the canonical examples — re-read both for tone and depth before writing a new one; this section describes their shape, not a substitute for looking at them.

_module term can be the same as feature for this topic_

**Sections, in this order:**

1. Title + a one-to-two sentence purpose statement.
2. `## Architecture`
    - An opening subsection whose heading names the module's actual core design idea (`The ledger boundary`, `REST is authoritative, the socket is a shortcut`) — never a generic `### Overview`.
    - A table: one row per file for a thin/service-style module, or one row per DB table for a schema-heavy one. One-line purpose per row.
    - `### Entity map` — a `mermaid erDiagram` of the tables the module owns (fields + FK relationships). Skip this subsection entirely if the module owns no tables.
    - A short subsection on how the module relates to this backend's two standing cross-cutting mechanisms — the transactional outbox (`src/outbox/`) and BullMQ queues. State plainly which ones it uses and which it deliberately skips, and why (chat skips both; payment is designed around both).
3. `## Lifecycle, end to end` — one or more `mermaid sequenceDiagram` blocks tracing the module's real request/data flow (not a generic CRUD sketch), followed by a short `Key properties this gives us` bullet list pulling out the non-obvious invariants the diagram makes visible.
4. `## Current state` — a table of piece vs. status (`Done` / `Not started` / partial with a caveat). Be honest: a mostly-unbuilt module should read as mostly-unbuilt, not padded out to look further along.
5. `## Open items` — real findings from reading the actual code (a structural gap, a guard that isn't applied consistently, a doc that's gone stale), each with why it matters. No filler items. Carry forward anything from this file's `Known gaps` section that applies to the module, plus whatever new gaps surfaced while writing the README.

**Process, before and while writing:**

- Read every file in the module first — an empty stub file changes what the README can honestly claim (this is why payment's README reads as mostly-unbuilt and chat's doesn't).
- Verify each architectural claim against the actual code (imports, schema, guards actually applied) rather than the file's own comments or this file's prose — both can be stale.
- Reuse the terminology this file and sibling READMEs already use for the same concept, rather than introducing a new synonym for it.
- Run `pnpm format` (or `npx prettier --write <path>`) on the finished file, and confirm the mermaid fences survived formatting untouched.
- If writing the README surfaces something that contradicts this file (e.g. a module description here turns out stale because the code moved on), note it under that module's Open items — don't silently rewrite this file as a side effect unless asked to.

