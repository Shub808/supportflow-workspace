import { describe, expect, it } from "vitest";

import {
  activeFilterCount,
  buildInboxSearch,
  parseInboxQuery,
  toTicketFilter,
} from "@/lib/filters";
import { replySchema } from "@/server/actions/schemas";

describe("parseInboxQuery", () => {
  it("applies defaults for an empty query", () => {
    expect(parseInboxQuery({})).toEqual({
      status: [],
      priority: [],
      assignee: undefined,
      label: [],
      q: undefined,
      sort: "updated",
      dir: "desc",
      page: 1,
    });
  });

  it("accepts repeated and comma-separated values and de-duplicates", () => {
    expect(parseInboxQuery({ status: "open,open,new" }).status).toEqual([
      "open",
      "new",
    ]);
    expect(parseInboxQuery({ status: ["open", "pending"] }).status).toEqual([
      "open",
      "pending",
    ]);
  });

  it("drops values outside the allowed vocabulary", () => {
    expect(parseInboxQuery({ status: "open,DROP TABLE" }).status).toEqual(["open"]);
    expect(parseInboxQuery({ priority: "urgent,critical" }).priority).toEqual([
      "urgent",
    ]);
  });

  it("normalises labels and rejects ones that could not exist", () => {
    expect(parseInboxQuery({ label: "Billing,BUG" }).label).toEqual([
      "billing",
      "bug",
    ]);
    expect(parseInboxQuery({ label: "a,<script>" }).label).toEqual([]);
  });

  it("falls back rather than throwing on nonsense scalars", () => {
    const query = parseInboxQuery({ sort: "whatever", page: "-4" });
    expect(query.sort).toBe("updated");
    expect(query.page).toBe(1);
  });
});

describe("toTicketFilter", () => {
  it("maps the 'unassigned' pseudo-assignee onto its own flag", () => {
    const filter = toTicketFilter(parseInboxQuery({ assignee: "unassigned" }));
    expect(filter.unassigned).toBe(true);
    expect(filter.assigneeId).toBeNull();
  });

  it("passes a real agent id straight through", () => {
    const filter = toTicketFilter(parseInboxQuery({ assignee: "agt_rivera" }));
    expect(filter.unassigned).toBe(false);
    expect(filter.assigneeId).toBe("agt_rivera");
  });
});

describe("buildInboxSearch", () => {
  it("omits defaults so equivalent filter sets share one URL", () => {
    expect(buildInboxSearch(parseInboxQuery({}))).toBe("");
    expect(buildInboxSearch(parseInboxQuery({ page: "1" }))).toBe("");
  });

  it("round-trips through parse unchanged", () => {
    const original = parseInboxQuery({
      status: "open,pending",
      priority: "urgent",
      label: "billing",
      assignee: "agt_bhatt",
      q: "invoice",
      page: "3",
    });
    const reparsed = parseInboxQuery(
      Object.fromEntries(new URLSearchParams(buildInboxSearch(original))),
    );
    expect(reparsed).toEqual(original);
  });

  it("resets to page 1 when an override changes the filter", () => {
    const query = parseInboxQuery({ page: "5" });
    expect(buildInboxSearch(query, { status: ["open"], page: 1 })).toBe(
      "status=open",
    );
  });
});

describe("activeFilterCount", () => {
  it("counts each applied filter once", () => {
    expect(activeFilterCount(parseInboxQuery({}))).toBe(0);
    expect(
      activeFilterCount(
        parseInboxQuery({ status: "open,new", priority: "high", q: "x" }),
      ),
    ).toBe(4);
  });
});

describe("reply schema", () => {
  it("treats only explicit truthy values as an internal note", () => {
    const base = {
      ticketId: "tkt_0001",
      version: "2",
      body: "A reply that is long enough to pass validation.",
    };
    // "off" is what an unchecked flag actually sends; rejecting it used to
    // fail every public reply.
    expect(replySchema.parse({ ...base, internal: "off" }).internal).toBe(false);
    expect(replySchema.parse({ ...base }).internal).toBe(false);
    expect(replySchema.parse({ ...base, internal: "on" }).internal).toBe(true);
    expect(replySchema.parse({ ...base, internal: true }).internal).toBe(true);
  });

  it("accepts a status transition alongside the reply, and an empty one", () => {
    const base = {
      ticketId: "tkt_0001",
      version: "2",
      body: "A reply that is long enough to pass validation.",
    };
    expect(replySchema.parse({ ...base, nextStatus: "resolved" }).nextStatus).toBe(
      "resolved",
    );
    expect(replySchema.parse({ ...base, nextStatus: "" }).nextStatus).toBeUndefined();
  });

  it("rejects a body below the minimum length", () => {
    const result = replySchema.safeParse({
      ticketId: "tkt_0001",
      version: "2",
      body: "too short",
    });
    expect(result.success).toBe(false);
  });

  it("rejects an implausible ticket id", () => {
    const result = replySchema.safeParse({
      ticketId: "../../etc/passwd",
      version: "2",
      body: "A reply that is long enough to pass validation.",
    });
    expect(result.success).toBe(false);
  });
});
