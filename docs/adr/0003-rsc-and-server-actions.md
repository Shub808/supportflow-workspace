# ADR 0003 — Server Components and Server Actions, not a client data layer

**Status:** accepted · **Date:** 2026-10-15

## Context

My other portfolio project (PulseBoard) is built the other way round: client
components, TanStack Query, JSON route handlers. That architecture is right
there — a dashboard whose state is a filter set, where the client owns caching,
retries and request cancellation.

A support workspace has a different shape. The data is relational and
server-resident, the mutations have authorization rules that must be enforced
server-side, and the pages are mostly reading-and-writing rather than
re-querying the same data at different granularities.

Building both projects the same way would have demonstrated one skill twice.

## Decision

- **Reads** happen in Server Components, straight from SQLite in the same
  process. No API layer, no client fetch, no loading spinner for the initial
  render.
- **Writes** are Server Actions invoked from `<form action={…}>`.
- **Client components are islands**, and there are only two of consequence:
  the property controls (which need `useOptimistic`) and the composer (which
  needs draft state and the AI panel).
- **Filters are links and the search is a GET form**, so the inbox is fully
  usable before hydration and every view has a real URL.

## Consequences

**Good**

- The ticket thread, the customer panel and the activity log ship as HTML. No
  JavaScript is sent for them at all.
- There is no API surface to keep in sync with the UI, and no serialisation
  layer between the query and the component.
- Authorization lives where it is enforced. Every action calls
  `requireCapability` before it parses its input.
- Progressive enhancement falls out for free rather than being retrofitted.

**Costs**

- A mutation re-renders the route rather than patching a cache, so the
  round-trip is heavier than a targeted cache update. `useOptimistic` covers
  the latency for the controls that need to feel instant.
- Server Actions are public HTTP endpoints. A disabled button in the UI is a
  convenience, not a control — which is why every action re-derives the actor
  and re-checks the capability regardless of what the component sent.
- **A `"use server"` module may only export async functions.** Exporting a
  plain object from one type-checks and builds, then arrives as `undefined` in
  the client component that imports it. That cost me a runtime `TypeError` on
  first render; there is now a test
  (`tests/unit/server-actions-contract.test.ts`) that asserts every export of
  every action module is an `AsyncFunction`.
