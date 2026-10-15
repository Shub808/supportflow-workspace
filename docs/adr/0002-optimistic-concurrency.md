# ADR 0002 — Optimistic concurrency with a revision token

**Status:** accepted · **Date:** 2026-10-15

## Context

A support inbox is shared. Two agents open the same ticket; one sets it to
*pending*, the other sets it to *resolved* a second later. With a plain
`UPDATE tickets SET status = ?`, the second write wins silently and the first
agent's change disappears without either of them knowing — the lost-update
problem.

Pessimistic locking (lock the row while a ticket is open in someone's browser)
is the other classic answer, and it is wrong here: a ticket can sit open in a
tab for an hour.

## Decision

Every ticket carries a monotonic `version`. The client sends back the version
it rendered, and every write is conditional on it:

```sql
UPDATE tickets
   SET status = ?, updated_at = ?, version = version + 1
 WHERE id = ? AND version = ?
```

`changes === 0` means someone else got there first. The repository then re-reads
the row and returns `{ ok: false, reason: "conflict", current }` so the caller
has the *actual* current state, not just a failure.

## How it reaches the user

The UI applies the change optimistically with React's `useOptimistic`, so the
badge updates on click. When the action settles without the underlying ticket
having changed, React discards the optimistic value and the UI returns to the
server's state — **the rollback is the framework's behaviour, not hand-written
error handling**, which is why the optimistic state is derived from the
`ticket` prop rather than held in `useState`.

The conflict message then says what the ticket actually is now
("It is now *pending*, priority *high*, assigned to…"), because "something went
wrong" leaves the agent with no idea what to do next.

## Consequences

- Concurrent edits are detected rather than silently lost.
- Writes stay cheap: no locks, no retries, no serialisable isolation.
- The `version` has to be threaded through every form. That is a real cost, and
  it is why it lives in one hidden input per form rather than being re-derived.
- A conflict asks the user to re-apply their change. For this domain that is
  correct — merging two people's intent about a ticket's status automatically
  would be worse than asking.

## Tested

`tests/integration/mutations.test.ts` covers the conflict path explicitly,
including the assertion that matters most: when a reply is rejected for a stale
revision, **the message row is not inserted either**, even though the `UPDATE`
and the `INSERT` are separate statements. They are wrapped in one transaction.
