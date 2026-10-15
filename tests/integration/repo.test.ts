import type { DatabaseSync } from "node:sqlite";
import { beforeEach, describe, expect, it } from "vitest";

import { createTestDb } from "@/server/db";
import { seedDatabase } from "@/server/db/seed";
import { searchArticles, toFtsQuery } from "@/server/repo/knowledge";
import {
  DEFAULT_FILTER,
  customerHistory,
  getTicket,
  listAgents,
  listMessages,
  listTickets,
  statusCounts,
} from "@/server/repo/tickets";

/**
 * Repository tests against a real SQLite database.
 *
 * Each test gets its own freshly-seeded in-memory database, so there is no
 * shared state between cases and no mocking of the data layer — the SQL that
 * runs here is the SQL that runs in production.
 */
let db: DatabaseSync;

beforeEach(() => {
  db = createTestDb();
});

describe("seeding", () => {
  it("creates a deterministic workspace", () => {
    const page = listTickets({ ...DEFAULT_FILTER, pageSize: 100 }, db);
    expect(page.total).toBe(48);
    expect(listAgents(db)).toHaveLength(4);
  });

  it("is idempotent — a second run does not duplicate anything", () => {
    const before = listTickets(DEFAULT_FILTER, db).total;
    // Re-running the seed against a populated database must be a no-op.
    seedDatabase(db);
    expect(listTickets(DEFAULT_FILTER, db).total).toBe(before);
  });

  it("uses only example.com addresses — no real contact data", () => {
    const rows = db.prepare("SELECT email FROM customers").all() as {
      email: string;
    }[];
    expect(rows.every((row) => row.email.endsWith(".example.com"))).toBe(true);
  });
});

describe("listTickets", () => {
  it("filters by status, treating multiple values as OR", () => {
    const page = listTickets(
      { ...DEFAULT_FILTER, status: ["new", "closed"], pageSize: 100 },
      db,
    );
    expect(page.total).toBeGreaterThan(0);
    expect(
      page.rows.every((row) => row.status === "new" || row.status === "closed"),
    ).toBe(true);
  });

  it("treats separate facets as AND", () => {
    const page = listTickets(
      { ...DEFAULT_FILTER, status: ["open"], priority: ["urgent"], pageSize: 100 },
      db,
    );
    expect(
      page.rows.every(
        (row) => row.status === "open" && row.priority === "urgent",
      ),
    ).toBe(true);
  });

  it("finds unassigned tickets", () => {
    const page = listTickets(
      { ...DEFAULT_FILTER, unassigned: true, pageSize: 100 },
      db,
    );
    expect(page.total).toBeGreaterThan(0);
    expect(page.rows.every((row) => row.assignee === null)).toBe(true);
  });

  it("searches subject, reference, customer name and company", () => {
    const anchor = listTickets({ ...DEFAULT_FILTER, pageSize: 1 }, db).rows[0]!;

    expect(
      listTickets({ ...DEFAULT_FILTER, q: anchor.reference }, db).rows[0]?.id,
    ).toBe(anchor.id);
    expect(
      listTickets({ ...DEFAULT_FILTER, q: anchor.customer.company, pageSize: 100 }, db)
        .rows.some((row) => row.id === anchor.id),
    ).toBe(true);
  });

  it("escapes LIKE wildcards so a literal % is not a match-everything", () => {
    const all = listTickets({ ...DEFAULT_FILTER, pageSize: 100 }, db).total;
    const wildcard = listTickets({ ...DEFAULT_FILTER, q: "%" }, db).total;
    expect(all).toBeGreaterThan(0);
    expect(wildcard).toBe(0);
  });

  it("orders by real priority severity, not alphabetically", () => {
    const page = listTickets(
      { ...DEFAULT_FILTER, sort: "priority", dir: "desc", pageSize: 10 },
      db,
    );
    // Alphabetical order would put "urgent" last; severity order puts it first.
    expect(page.rows[0]!.priority).toBe("urgent");
  });

  it("paginates without repeating or dropping rows", () => {
    const first = listTickets({ ...DEFAULT_FILTER, pageSize: 10, page: 1 }, db);
    const second = listTickets({ ...DEFAULT_FILTER, pageSize: 10, page: 2 }, db);
    const ids = new Set(first.rows.map((row) => row.id));
    expect(first.pageCount).toBe(5);
    expect(second.rows.some((row) => ids.has(row.id))).toBe(false);
  });

  it("clamps a page beyond the end instead of returning nothing", () => {
    const page = listTickets({ ...DEFAULT_FILTER, pageSize: 10, page: 99 }, db);
    expect(page.page).toBe(5);
    expect(page.rows.length).toBeGreaterThan(0);
  });

  it("builds a readable preview from the latest message", () => {
    const row = listTickets({ ...DEFAULT_FILTER, pageSize: 1 }, db).rows[0]!;
    expect(row.lastMessagePreview.length).toBeGreaterThan(0);
    expect(row.lastMessagePreview.length).toBeLessThanOrEqual(150);
    expect(row.lastMessagePreview).not.toContain("\n");
  });
});

describe("statusCounts", () => {
  it("adds up to the total", () => {
    const counts = statusCounts(db);
    const byStatus = ["new", "open", "pending", "resolved", "closed"].reduce(
      (sum, key) => sum + (counts[key] ?? 0),
      0,
    );
    expect(byStatus).toBe(counts.all);
    expect(counts.unassigned).toBeLessThanOrEqual(counts.all!);
  });
});

describe("ticket detail", () => {
  it("returns messages in chronological order", () => {
    const ticket = listTickets(
      { ...DEFAULT_FILTER, status: ["resolved"], pageSize: 1 },
      db,
    ).rows[0]!;
    const messages = listMessages(ticket.id, db);
    expect(messages.length).toBeGreaterThan(1);
    for (let i = 1; i < messages.length; i += 1) {
      expect(messages[i]!.createdAt >= messages[i - 1]!.createdAt).toBe(true);
    }
    expect(messages[0]!.authorKind).toBe("customer");
  });

  it("excludes the current ticket from the customer's history", () => {
    const ticket = listTickets({ ...DEFAULT_FILTER, pageSize: 1 }, db).rows[0]!;
    const history = customerHistory(ticket.customerId, ticket.id, db);
    expect(history.every((other) => other.id !== ticket.id)).toBe(true);
    expect(history.every((other) => other.customerId === ticket.customerId)).toBe(true);
  });

  it("returns null for an unknown ticket rather than throwing", () => {
    expect(getTicket("tkt_does_not_exist", db)).toBeNull();
  });
});

describe("knowledge base search", () => {
  it("lists everything when the query is empty", () => {
    expect(searchArticles(null, db)).toHaveLength(5);
    expect(searchArticles("", db)).toHaveLength(5);
  });

  it("stems, so a different word form still matches", () => {
    const results = searchArticles("retrying", db);
    expect(results.map((a) => a.slug)).toContain("webhook-retries");
  });

  it("ANDs multiple words", () => {
    const results = searchArticles("timezone display", db);
    expect(results.map((a) => a.slug)).toContain("timezone-display");
  });

  it("returns nothing, rather than erroring, for FTS syntax in user input", () => {
    // Raw FTS5 operators would otherwise throw and surface as a 500.
    expect(() => searchArticles('NEAR("a" "b")', db)).not.toThrow();
    expect(() => searchArticles('"', db)).not.toThrow();
    expect(() => searchArticles("* OR *", db)).not.toThrow();
  });

  it("escapes the query into a quoted AND expression", () => {
    expect(toFtsQuery("webhook retries")).toBe('"webhook" AND "retries"');
    // FTS operators lose their meaning: punctuation is stripped, so
    // `NEAR("x")` becomes the single harmless term "NEARx".
    expect(toFtsQuery('NEAR("x")')).toBe('"NEARx"');
    expect(toFtsQuery("webhook OR retries")).toBe(
      '"webhook" AND "OR" AND "retries"',
    );
    expect(toFtsQuery("a")).toBeNull();
    expect(toFtsQuery("   ")).toBeNull();
  });
});
