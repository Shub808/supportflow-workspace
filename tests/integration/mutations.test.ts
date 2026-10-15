import type { DatabaseSync } from "node:sqlite";
import { beforeEach, describe, expect, it } from "vitest";

import { createTestDb } from "@/server/db";
import {
  addReply,
  assignTicket,
  toggleLabel,
  updatePriority,
  updateStatus,
} from "@/server/repo/mutations";
import {
  DEFAULT_FILTER,
  getTicket,
  listEvents,
  listMessages,
  listTickets,
} from "@/server/repo/tickets";
import type { Agent, TicketWithCustomer } from "@/types/domain";

/**
 * Write-path tests.
 *
 * The behaviour under test is the thing that is easy to get wrong and
 * expensive to discover in production: concurrent edits, and partial writes.
 */

const ACTOR: Agent = {
  id: "agt_rivera",
  name: "Nadia Rivera",
  email: "nadia.rivera@example.com",
  role: "agent",
};

const SUPERVISOR: Agent = {
  id: "agt_lindqvist",
  name: "Mia Lindqvist",
  email: "mia.lindqvist@example.com",
  role: "supervisor",
};

let db: DatabaseSync;
let ticket: TicketWithCustomer;

beforeEach(() => {
  db = createTestDb();
  ticket = listTickets({ ...DEFAULT_FILTER, status: ["open"], pageSize: 1 }, db)
    .rows[0]!;
});

describe("updateStatus", () => {
  it("applies the change, bumps the revision and logs an event", () => {
    const result = updateStatus(
      { ticketId: ticket.id, expectedVersion: ticket.version, status: "pending", actor: ACTOR },
      db,
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.status).toBe("pending");
    expect(result.data.version).toBe(ticket.version + 1);

    const events = listEvents(ticket.id, db);
    const latest = events.at(-1)!;
    expect(latest.kind).toBe("status_changed");
    expect(latest.detail).toContain("pending");
    expect(latest.actorName).toBe(ACTOR.name);
  });

  it("rejects a write based on a stale revision and reports the current state", () => {
    // First writer wins.
    const first = updateStatus(
      { ticketId: ticket.id, expectedVersion: ticket.version, status: "pending", actor: ACTOR },
      db,
    );
    expect(first.ok).toBe(true);

    // Second writer is still holding the revision they loaded.
    const second = updateStatus(
      { ticketId: ticket.id, expectedVersion: ticket.version, status: "resolved", actor: SUPERVISOR },
      db,
    );

    expect(second.ok).toBe(false);
    if (second.ok || second.reason !== "conflict") throw new Error("expected a conflict");
    expect(second.current.status).toBe("pending");
    expect(second.current.version).toBe(ticket.version + 1);

    // The losing write changed nothing at all.
    expect(getTicket(ticket.id, db)!.status).toBe("pending");
    expect(
      listEvents(ticket.id, db).filter((e) => e.detail.includes("resolved")),
    ).toHaveLength(0);
  });

  it("reports a missing ticket distinctly from a conflict", () => {
    const result = updateStatus(
      { ticketId: "tkt_nope", expectedVersion: 1, status: "open", actor: ACTOR },
      db,
    );
    expect(result).toEqual({ ok: false, reason: "not_found" });
  });
});

describe("updatePriority", () => {
  it("records the before and after values in the event log", () => {
    const result = updatePriority(
      { ticketId: ticket.id, expectedVersion: ticket.version, priority: "urgent", actor: ACTOR },
      db,
    );
    expect(result.ok).toBe(true);
    const latest = listEvents(ticket.id, db).at(-1)!;
    expect(latest.detail).toContain(ticket.priority);
    expect(latest.detail).toContain("urgent");
  });
});

describe("assignTicket", () => {
  it("assigns and unassigns, logging the right event each time", () => {
    const assigned = assignTicket(
      { ticketId: ticket.id, expectedVersion: ticket.version, assigneeId: SUPERVISOR.id, actor: ACTOR },
      db,
    );
    expect(assigned.ok).toBe(true);
    if (!assigned.ok) return;
    expect(assigned.data.assignee?.id).toBe(SUPERVISOR.id);
    expect(listEvents(ticket.id, db).at(-1)!.kind).toBe("assigned");

    const cleared = assignTicket(
      { ticketId: ticket.id, expectedVersion: assigned.data.version, assigneeId: null, actor: ACTOR },
      db,
    );
    expect(cleared.ok).toBe(true);
    if (!cleared.ok) return;
    expect(cleared.data.assignee).toBeNull();
    expect(listEvents(ticket.id, db).at(-1)!.kind).toBe("unassigned");
  });

  it("refuses an assignee that does not exist", () => {
    const result = assignTicket(
      { ticketId: ticket.id, expectedVersion: ticket.version, assigneeId: "agt_ghost", actor: ACTOR },
      db,
    );
    expect(result).toEqual({ ok: false, reason: "not_found" });
    expect(getTicket(ticket.id, db)!.assigneeId).toBe(ticket.assigneeId);
  });
});

describe("toggleLabel", () => {
  it("adds a label then removes it", () => {
    const added = toggleLabel(
      { ticketId: ticket.id, expectedVersion: ticket.version, label: "escalated", actor: ACTOR },
      db,
    );
    expect(added.ok).toBe(true);
    if (!added.ok) return;
    expect(added.data.labels).toContain("escalated");

    const removed = toggleLabel(
      { ticketId: ticket.id, expectedVersion: added.data.version, label: "escalated", actor: ACTOR },
      db,
    );
    expect(removed.ok).toBe(true);
    if (!removed.ok) return;
    expect(removed.data.labels).not.toContain("escalated");
  });
});

describe("addReply", () => {
  it("writes the message and the status transition as one atomic step", () => {
    const before = listMessages(ticket.id, db).length;

    const result = addReply(
      {
        ticketId: ticket.id,
        expectedVersion: ticket.version,
        body: "Thanks for your patience — the fix is live now.",
        internal: false,
        nextStatus: "resolved",
        actor: ACTOR,
      },
      db,
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.status).toBe("resolved");

    const messages = listMessages(ticket.id, db);
    expect(messages).toHaveLength(before + 1);
    expect(messages.at(-1)!.internal).toBe(false);
    expect(messages.at(-1)!.authorName).toBe(ACTOR.name);

    const kinds = listEvents(ticket.id, db).map((event) => event.kind);
    expect(kinds).toContain("replied");
    expect(kinds).toContain("status_changed");
  });

  it("marks an internal note so it is never treated as a customer reply", () => {
    const result = addReply(
      {
        ticketId: ticket.id,
        expectedVersion: ticket.version,
        body: "Third report today — flagging to platform.",
        internal: true,
        actor: ACTOR,
      },
      db,
    );
    expect(result.ok).toBe(true);
    expect(listMessages(ticket.id, db).at(-1)!.internal).toBe(true);
    expect(listEvents(ticket.id, db).at(-1)!.kind).toBe("note_added");
  });

  it("writes nothing at all when the revision is stale", () => {
    updateStatus(
      { ticketId: ticket.id, expectedVersion: ticket.version, status: "pending", actor: SUPERVISOR },
      db,
    );
    const messagesBefore = listMessages(ticket.id, db).length;

    const result = addReply(
      {
        ticketId: ticket.id,
        expectedVersion: ticket.version,
        body: "This reply is based on a stale view of the ticket.",
        internal: false,
        nextStatus: "closed",
        actor: ACTOR,
      },
      db,
    );

    expect(result.ok).toBe(false);
    // The crucial assertion: the message must not have been inserted even
    // though the UPDATE and the INSERT are separate statements.
    expect(listMessages(ticket.id, db)).toHaveLength(messagesBefore);
    expect(getTicket(ticket.id, db)!.status).toBe("pending");
  });

  it("leaves the status untouched when no transition is requested", () => {
    const result = addReply(
      {
        ticketId: ticket.id,
        expectedVersion: ticket.version,
        body: "Still looking into this, will update shortly.",
        internal: false,
        actor: ACTOR,
      },
      db,
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.status).toBe(ticket.status);
  });
});

describe("revision discipline", () => {
  it("every successful write bumps the revision exactly once", () => {
    let version = ticket.version;
    const steps = [
      () => updateStatus({ ticketId: ticket.id, expectedVersion: version, status: "pending", actor: ACTOR }, db),
      () => updatePriority({ ticketId: ticket.id, expectedVersion: version, priority: "high", actor: ACTOR }, db),
      () => toggleLabel({ ticketId: ticket.id, expectedVersion: version, label: "escalated", actor: ACTOR }, db),
      () => addReply({ ticketId: ticket.id, expectedVersion: version, body: "An update for you.", internal: false, actor: ACTOR }, db),
    ];

    for (const step of steps) {
      const result = step();
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.data.version).toBe(version + 1);
      version = result.data.version;
    }
  });
});

describe("event ordering", () => {
  it("keeps same-millisecond events in the order they happened", () => {
    // A reply and the status change it triggers are written in one
    // transaction and share a timestamp. Ordering by the UUID primary key
    // would shuffle them at random; insertion order is what is correct.
    const result = addReply(
      {
        ticketId: ticket.id,
        expectedVersion: ticket.version,
        body: "Closing the loop on this one for you now.",
        internal: false,
        nextStatus: "resolved",
        actor: ACTOR,
      },
      db,
    );
    expect(result.ok).toBe(true);

    const tail = listEvents(ticket.id, db).slice(-2).map((event) => event.kind);
    expect(tail).toEqual(["replied", "status_changed"]);
  });

  it("orders assignment events deterministically across rapid writes", () => {
    let version = ticket.version;
    for (let i = 0; i < 6; i += 1) {
      const result = assignTicket(
        {
          ticketId: ticket.id,
          expectedVersion: version,
          assigneeId: i % 2 === 0 ? SUPERVISOR.id : null,
          actor: ACTOR,
        },
        db,
      );
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      version = result.data.version;
    }

    const kinds = listEvents(ticket.id, db)
      .slice(-6)
      .map((event) => event.kind);
    expect(kinds).toEqual([
      "assigned",
      "unassigned",
      "assigned",
      "unassigned",
      "assigned",
      "unassigned",
    ]);
  });
});
