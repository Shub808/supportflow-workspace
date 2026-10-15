import type { DatabaseSync } from "node:sqlite";

import { getDb } from "@/server/db";
import type {
  Agent,
  Customer,
  Message,
  Paginated,
  Ticket,
  TicketEvent,
  TicketWithCustomer,
} from "@/types/domain";

/**
 * Ticket data access.
 *
 * Every function takes an explicit `db` handle (defaulting to the process
 * one), which is what lets the integration tests run each case against a
 * fresh, isolated in-memory database instead of sharing global state.
 *
 * SQL lives here and nowhere else. Server actions call these functions; they
 * never build queries themselves.
 */

export interface TicketFilter {
  status: string[];
  priority: string[];
  assigneeId: string | null;
  /** `true` matches tickets with no assignee. */
  unassigned: boolean;
  labels: string[];
  q: string | null;
  sort: "updated" | "created" | "priority";
  dir: "asc" | "desc";
  page: number;
  pageSize: number;
}

export const DEFAULT_FILTER: TicketFilter = {
  status: [],
  priority: [],
  assigneeId: null,
  unassigned: false,
  labels: [],
  q: null,
  sort: "updated",
  dir: "desc",
  page: 1,
  pageSize: 20,
};

type Row = Record<string, unknown>;

const str = (row: Row, key: string): string => String(row[key] ?? "");
const nullableStr = (row: Row, key: string): string | null =>
  row[key] == null ? null : String(row[key]);
const num = (row: Row, key: string): number => Number(row[key] ?? 0);

function toCustomer(row: Row): Customer {
  return {
    id: str(row, "customer_id"),
    name: str(row, "customer_name"),
    email: str(row, "customer_email"),
    company: str(row, "customer_company"),
    plan: str(row, "customer_plan") as Customer["plan"],
    since: str(row, "customer_since"),
  };
}

function toAssignee(row: Row): Agent | null {
  const id = nullableStr(row, "assignee_id");
  if (!id) return null;
  return {
    id,
    name: str(row, "assignee_name"),
    email: str(row, "assignee_email"),
    role: str(row, "assignee_role") as Agent["role"],
  };
}

function toTicket(row: Row): Ticket {
  return {
    id: str(row, "id"),
    reference: str(row, "reference"),
    subject: str(row, "subject"),
    status: str(row, "status") as Ticket["status"],
    priority: str(row, "priority") as Ticket["priority"],
    channel: str(row, "channel") as Ticket["channel"],
    customerId: str(row, "customer_id"),
    assigneeId: nullableStr(row, "assignee_id"),
    labels: str(row, "labels") ? str(row, "labels").split(",").filter(Boolean) : [],
    createdAt: str(row, "created_at"),
    updatedAt: str(row, "updated_at"),
    version: num(row, "version"),
  };
}

/**
 * `priority` is stored as a word, so ordering by it alphabetically would run
 * high → low → normal → urgent. This CASE gives the real severity order.
 */
const PRIORITY_RANK = `CASE t.priority
  WHEN 'urgent' THEN 4 WHEN 'high' THEN 3 WHEN 'normal' THEN 2 ELSE 1 END`;

const BASE_SELECT = `
  SELECT
    t.id, t.reference, t.subject, t.status, t.priority, t.channel,
    t.customer_id, t.assignee_id, t.created_at, t.updated_at, t.version,
    c.name AS customer_name, c.email AS customer_email,
    c.company AS customer_company, c.plan AS customer_plan, c.since AS customer_since,
    a.name AS assignee_name, a.email AS assignee_email, a.role AS assignee_role,
    (SELECT GROUP_CONCAT(label) FROM ticket_labels WHERE ticket_id = t.id) AS labels,
    (SELECT COUNT(*) FROM messages WHERE ticket_id = t.id) AS message_count,
    (SELECT MAX(created_at) FROM messages WHERE ticket_id = t.id) AS last_message_at,
    (SELECT body FROM messages WHERE ticket_id = t.id ORDER BY created_at DESC LIMIT 1) AS last_message_body
  FROM tickets t
  JOIN customers c ON c.id = t.customer_id
  LEFT JOIN agents a ON a.id = t.assignee_id`;

function buildWhere(filter: TicketFilter): {
  sql: string;
  params: (string | number)[];
} {
  const clauses: string[] = [];
  const params: (string | number)[] = [];

  if (filter.status.length > 0) {
    clauses.push(`t.status IN (${filter.status.map(() => "?").join(",")})`);
    params.push(...filter.status);
  }
  if (filter.priority.length > 0) {
    clauses.push(`t.priority IN (${filter.priority.map(() => "?").join(",")})`);
    params.push(...filter.priority);
  }
  if (filter.unassigned) {
    clauses.push("t.assignee_id IS NULL");
  } else if (filter.assigneeId) {
    clauses.push("t.assignee_id = ?");
    params.push(filter.assigneeId);
  }
  for (const label of filter.labels) {
    clauses.push(
      "EXISTS (SELECT 1 FROM ticket_labels tl WHERE tl.ticket_id = t.id AND tl.label = ?)",
    );
    params.push(label);
  }
  if (filter.q) {
    // Parameterised LIKE with escaped wildcards: a customer searching for
    // "100%" must not match everything.
    const needle = `%${filter.q.replace(/[%_\\]/g, (ch) => `\\${ch}`)}%`;
    clauses.push(`(
      t.subject LIKE ? ESCAPE '\\' OR
      t.reference LIKE ? ESCAPE '\\' OR
      c.name LIKE ? ESCAPE '\\' OR
      c.email LIKE ? ESCAPE '\\' OR
      c.company LIKE ? ESCAPE '\\'
    )`);
    params.push(needle, needle, needle, needle, needle);
  }

  return {
    sql: clauses.length > 0 ? `WHERE ${clauses.join(" AND ")}` : "",
    params,
  };
}

function toSummary(row: Row): TicketWithCustomer {
  const body = str(row, "last_message_body").replace(/\s+/g, " ").trim();
  return {
    ...toTicket(row),
    customer: toCustomer(row),
    assignee: toAssignee(row),
    messageCount: num(row, "message_count"),
    lastMessageAt: str(row, "last_message_at") || str(row, "updated_at"),
    lastMessagePreview: body.length > 150 ? `${body.slice(0, 149)}…` : body,
  };
}

export function listTickets(
  filter: TicketFilter = DEFAULT_FILTER,
  db: DatabaseSync = getDb(),
): Paginated<TicketWithCustomer> {
  const where = buildWhere(filter);

  const countRow = db
    .prepare(
      `SELECT COUNT(*) AS n FROM tickets t JOIN customers c ON c.id = t.customer_id ${where.sql}`,
    )
    .get(...where.params) as { n: number } | undefined;
  const total = countRow?.n ?? 0;

  const pageCount = Math.max(1, Math.ceil(total / filter.pageSize));
  const page = Math.min(Math.max(filter.page, 1), pageCount);

  const orderColumn =
    filter.sort === "created"
      ? "t.created_at"
      : filter.sort === "priority"
        ? PRIORITY_RANK
        : "t.updated_at";
  const direction = filter.dir === "asc" ? "ASC" : "DESC";

  const rows = db
    .prepare(
      `${BASE_SELECT} ${where.sql}
       ORDER BY ${orderColumn} ${direction}, t.id ${direction}
       LIMIT ? OFFSET ?`,
    )
    .all(...where.params, filter.pageSize, (page - 1) * filter.pageSize) as Row[];

  return {
    rows: rows.map(toSummary),
    total,
    page,
    pageSize: filter.pageSize,
    pageCount,
  };
}

export function getTicket(
  id: string,
  db: DatabaseSync = getDb(),
): TicketWithCustomer | null {
  const row = db.prepare(`${BASE_SELECT} WHERE t.id = ?`).get(id) as
    | Row
    | undefined;
  return row ? toSummary(row) : null;
}

export function listMessages(
  ticketId: string,
  db: DatabaseSync = getDb(),
): Message[] {
  // `rowid`, not `id`, is the tiebreaker: ids are UUIDs, so two rows written
  // in the same millisecond would otherwise be ordered at random. `rowid` is
  // assigned in insertion order, which is the order the thread happened in.
  const rows = db
    .prepare(
      "SELECT * FROM messages WHERE ticket_id = ? ORDER BY created_at ASC, rowid ASC",
    )
    .all(ticketId) as Row[];
  return rows.map((row) => ({
    id: str(row, "id"),
    ticketId: str(row, "ticket_id"),
    authorKind: str(row, "author_kind") as Message["authorKind"],
    authorId: nullableStr(row, "author_id"),
    authorName: str(row, "author_name"),
    body: str(row, "body"),
    internal: num(row, "internal") === 1,
    createdAt: str(row, "created_at"),
  }));
}

export function listEvents(
  ticketId: string,
  db: DatabaseSync = getDb(),
): TicketEvent[] {
  // Same reasoning as `listMessages`: a reply and the status change it
  // triggered are written inside one transaction and share a timestamp to the
  // millisecond, so insertion order is what keeps the activity log truthful.
  const rows = db
    .prepare(
      "SELECT * FROM ticket_events WHERE ticket_id = ? ORDER BY created_at ASC, rowid ASC",
    )
    .all(ticketId) as Row[];
  return rows.map((row) => ({
    id: str(row, "id"),
    ticketId: str(row, "ticket_id"),
    actorId: nullableStr(row, "actor_id"),
    actorName: str(row, "actor_name"),
    kind: str(row, "kind") as TicketEvent["kind"],
    detail: str(row, "detail"),
    createdAt: str(row, "created_at"),
  }));
}

export function listAgents(db: DatabaseSync = getDb()): Agent[] {
  const rows = db.prepare("SELECT * FROM agents ORDER BY name").all() as Row[];
  return rows.map((row) => ({
    id: str(row, "id"),
    name: str(row, "name"),
    email: str(row, "email"),
    role: str(row, "role") as Agent["role"],
  }));
}

export function listAllLabels(db: DatabaseSync = getDb()): string[] {
  const rows = db
    .prepare("SELECT DISTINCT label FROM ticket_labels ORDER BY label")
    .all() as Row[];
  return rows.map((row) => str(row, "label"));
}

/** Counts per status for the inbox sidebar, in one pass. */
export function statusCounts(
  db: DatabaseSync = getDb(),
): Record<string, number> {
  const rows = db
    .prepare("SELECT status, COUNT(*) AS n FROM tickets GROUP BY status")
    .all() as Row[];
  const counts: Record<string, number> = {};
  for (const row of rows) counts[str(row, "status")] = num(row, "n");
  counts.unassigned = num(
    db
      .prepare("SELECT COUNT(*) AS n FROM tickets WHERE assignee_id IS NULL")
      .get() as Row,
    "n",
  );
  counts.all = num(
    db.prepare("SELECT COUNT(*) AS n FROM tickets").get() as Row,
    "n",
  );
  return counts;
}

/** Other tickets from the same customer — the context panel in the detail view. */
export function customerHistory(
  customerId: string,
  excludeTicketId: string,
  db: DatabaseSync = getDb(),
): TicketWithCustomer[] {
  const rows = db
    .prepare(
      `${BASE_SELECT} WHERE t.customer_id = ? AND t.id != ?
       ORDER BY t.updated_at DESC LIMIT 8`,
    )
    .all(customerId, excludeTicketId) as Row[];
  return rows.map(toSummary);
}
