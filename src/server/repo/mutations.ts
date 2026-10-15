import { randomUUID } from "node:crypto";
import type { DatabaseSync } from "node:sqlite";

import { getDb } from "@/server/db";
import { getTicket } from "@/server/repo/tickets";
import type {
  Agent,
  TicketPriority,
  TicketStatus,
  TicketWithCustomer,
} from "@/types/domain";

/**
 * Ticket writes.
 *
 * Two rules hold for every function in this file:
 *
 * 1. **Every write is conditional on the version the caller last saw.** The
 *    `UPDATE ... WHERE id = ? AND version = ?` returns `changes: 0` when some
 *    other session has moved on, and the caller gets a `conflict` result
 *    instead of silently clobbering that change.
 * 2. **Every write happens inside one transaction**, so a ticket is never left
 *    updated-but-unlogged, or replied-to without its `updated_at` moving.
 */

export type MutationResult<T> =
  | { ok: true; data: T }
  | { ok: false; reason: "not_found" }
  | { ok: false; reason: "conflict"; current: TicketWithCustomer };

const nowIso = (): string => new Date().toISOString();

function conflictOrMissing<T>(
  db: DatabaseSync,
  ticketId: string,
): MutationResult<T> {
  const current = getTicket(ticketId, db);
  return current
    ? { ok: false, reason: "conflict", current }
    : { ok: false, reason: "not_found" };
}

function logEvent(
  db: DatabaseSync,
  ticketId: string,
  actor: Agent,
  kind: string,
  detail: string,
  at: string,
): void {
  db.prepare(
    `INSERT INTO ticket_events (id, ticket_id, actor_id, actor_name, kind, detail, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
  ).run(`evt_${randomUUID()}`, ticketId, actor.id, actor.name, kind, detail, at);
}

/** Runs `work` in a transaction, rolling back on any throw. */
function transact<T>(db: DatabaseSync, work: () => T): T {
  db.exec("BEGIN IMMEDIATE");
  try {
    const result = work();
    db.exec("COMMIT");
    return result;
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
}

interface VersionedInput {
  ticketId: string;
  expectedVersion: number;
  actor: Agent;
}

export function updateStatus(
  input: VersionedInput & { status: TicketStatus },
  db: DatabaseSync = getDb(),
): MutationResult<TicketWithCustomer> {
  const before = getTicket(input.ticketId, db);
  if (!before) return { ok: false, reason: "not_found" };

  return transact(db, () => {
    const at = nowIso();
    const changed = db
      .prepare(
        "UPDATE tickets SET status = ?, updated_at = ?, version = version + 1 WHERE id = ? AND version = ?",
      )
      .run(input.status, at, input.ticketId, input.expectedVersion).changes;

    if (changed === 0) return conflictOrMissing<TicketWithCustomer>(db, input.ticketId);

    logEvent(
      db,
      input.ticketId,
      input.actor,
      "status_changed",
      `Status changed from ${before.status} to ${input.status}`,
      at,
    );
    return { ok: true, data: getTicket(input.ticketId, db)! };
  });
}

export function updatePriority(
  input: VersionedInput & { priority: TicketPriority },
  db: DatabaseSync = getDb(),
): MutationResult<TicketWithCustomer> {
  const before = getTicket(input.ticketId, db);
  if (!before) return { ok: false, reason: "not_found" };

  return transact(db, () => {
    const at = nowIso();
    const changed = db
      .prepare(
        "UPDATE tickets SET priority = ?, updated_at = ?, version = version + 1 WHERE id = ? AND version = ?",
      )
      .run(input.priority, at, input.ticketId, input.expectedVersion).changes;

    if (changed === 0) return conflictOrMissing<TicketWithCustomer>(db, input.ticketId);

    logEvent(
      db,
      input.ticketId,
      input.actor,
      "priority_changed",
      `Priority changed from ${before.priority} to ${input.priority}`,
      at,
    );
    return { ok: true, data: getTicket(input.ticketId, db)! };
  });
}

export function assignTicket(
  input: VersionedInput & { assigneeId: string | null },
  db: DatabaseSync = getDb(),
): MutationResult<TicketWithCustomer> {
  const before = getTicket(input.ticketId, db);
  if (!before) return { ok: false, reason: "not_found" };

  if (input.assigneeId) {
    const exists = db
      .prepare("SELECT 1 AS ok FROM agents WHERE id = ?")
      .get(input.assigneeId);
    if (!exists) return { ok: false, reason: "not_found" };
  }

  return transact(db, () => {
    const at = nowIso();
    const changed = db
      .prepare(
        "UPDATE tickets SET assignee_id = ?, updated_at = ?, version = version + 1 WHERE id = ? AND version = ?",
      )
      .run(input.assigneeId, at, input.ticketId, input.expectedVersion).changes;

    if (changed === 0) return conflictOrMissing<TicketWithCustomer>(db, input.ticketId);

    const next = getTicket(input.ticketId, db)!;
    logEvent(
      db,
      input.ticketId,
      input.actor,
      input.assigneeId ? "assigned" : "unassigned",
      input.assigneeId
        ? `Assigned to ${next.assignee?.name ?? input.assigneeId}`
        : "Unassigned",
      at,
    );
    return { ok: true, data: next };
  });
}

export function toggleLabel(
  input: VersionedInput & { label: string },
  db: DatabaseSync = getDb(),
): MutationResult<TicketWithCustomer> {
  const before = getTicket(input.ticketId, db);
  if (!before) return { ok: false, reason: "not_found" };

  const present = before.labels.includes(input.label);

  return transact(db, () => {
    const at = nowIso();
    const changed = db
      .prepare(
        "UPDATE tickets SET updated_at = ?, version = version + 1 WHERE id = ? AND version = ?",
      )
      .run(at, input.ticketId, input.expectedVersion).changes;

    if (changed === 0) return conflictOrMissing<TicketWithCustomer>(db, input.ticketId);

    if (present) {
      db.prepare(
        "DELETE FROM ticket_labels WHERE ticket_id = ? AND label = ?",
      ).run(input.ticketId, input.label);
    } else {
      db.prepare(
        "INSERT OR IGNORE INTO ticket_labels (ticket_id, label) VALUES (?, ?)",
      ).run(input.ticketId, input.label);
    }

    logEvent(
      db,
      input.ticketId,
      input.actor,
      present ? "label_removed" : "label_added",
      `${present ? "Removed" : "Added"} label "${input.label}"`,
      at,
    );
    return { ok: true, data: getTicket(input.ticketId, db)! };
  });
}

export interface ReplyInput extends VersionedInput {
  body: string;
  internal: boolean;
  /** Optional status transition applied in the same transaction as the reply. */
  nextStatus?: TicketStatus;
}

export function addReply(
  input: ReplyInput,
  db: DatabaseSync = getDb(),
): MutationResult<TicketWithCustomer> {
  const before = getTicket(input.ticketId, db);
  if (!before) return { ok: false, reason: "not_found" };

  return transact(db, () => {
    const at = nowIso();
    // Replying and transitioning are one atomic step. Doing them as two
    // statements is how a support tool ends up with a reply recorded against
    // a ticket whose status never moved.
    const status = input.nextStatus ?? before.status;
    const changed = db
      .prepare(
        "UPDATE tickets SET status = ?, updated_at = ?, version = version + 1 WHERE id = ? AND version = ?",
      )
      .run(status, at, input.ticketId, input.expectedVersion).changes;

    if (changed === 0) return conflictOrMissing<TicketWithCustomer>(db, input.ticketId);

    db.prepare(
      `INSERT INTO messages (id, ticket_id, author_kind, author_id, author_name, body, internal, created_at)
       VALUES (?, ?, 'agent', ?, ?, ?, ?, ?)`,
    ).run(
      `msg_${randomUUID()}`,
      input.ticketId,
      input.actor.id,
      input.actor.name,
      input.body,
      input.internal ? 1 : 0,
      at,
    );

    logEvent(
      db,
      input.ticketId,
      input.actor,
      input.internal ? "note_added" : "replied",
      input.internal ? "Added an internal note" : "Replied to the customer",
      at,
    );
    if (input.nextStatus && input.nextStatus !== before.status) {
      logEvent(
        db,
        input.ticketId,
        input.actor,
        "status_changed",
        `Status changed from ${before.status} to ${input.nextStatus}`,
        at,
      );
    }

    return { ok: true, data: getTicket(input.ticketId, db)! };
  });
}
