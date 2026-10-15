# ADR 0001 — SQLite through `node:sqlite`, not an ORM or a hosted database

**Status:** accepted · **Date:** 2026-10-15

## Context

The brief for this project called for a real write path: tickets that actually
change, an audit trail, and persistence that survives a navigation. The usual
options:

- **An array in memory.** Zero setup, but no transactions and no constraints —
  which means the interesting failure modes (a partial write, a concurrent
  edit) cannot be demonstrated or tested, because they cannot happen.
- **Postgres + Prisma/Drizzle.** Realistic, but requires a database to exist
  before anyone can run the project, and an ORM whose query behaviour becomes
  the thing a reviewer is reading instead of my SQL.
- **`better-sqlite3`.** A real database, but a native module with a build step
  that breaks on Node version mismatches and on some deploy targets.

## Decision

Node 22's built-in `node:sqlite`, with hand-written SQL in a repository layer.

## Consequences

**Good**

- A real relational database: `CHECK` constraints, foreign keys, indexes,
  transactions, and FTS5 full-text search with stemming for the knowledge base.
- `git clone && npm ci && npm run dev` works. No service to provision, no
  container, no connection string.
- No native build step, so CI and any Node 22 host just work.
- The SQL is visible in `src/server/repo/`, which is the point — the query for
  the inbox is something I can walk through in an interview.
- Tests get a fresh, fully-seeded in-memory database per test case, so the
  write-path tests run against the same SQL that runs in production with no
  mocking and no shared state.

**Costs**

- `node:sqlite` is marked experimental, and prints a warning on start. The API
  used here (`DatabaseSync`, `prepare`, `run`/`get`/`all`, `exec`) is small and
  stable, and the repository layer is the only place that touches it.
- SQLite is single-writer. Fine for this workload; it would not be the right
  choice for a genuinely multi-tenant support desk.
- With no `SUPPORTFLOW_DB_FILE` the database is in memory, so a restart
  re-seeds it. That is deliberate for a public demo — anyone can change
  anything and a restart puts it back — and it is documented rather than
  hidden.
- Serverless hosts give each instance its own filesystem, so a file-backed
  database would not be shared between instances. See the README's deployment
  notes.

## Migration path

Everything above `src/server/repo/` depends on the repository function
signatures, not on SQLite. Moving to Postgres means rewriting those modules and
nothing else — the server actions, the permission checks and the UI do not
change.
