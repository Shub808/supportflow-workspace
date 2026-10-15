import { describe, expect, it } from "vitest";

import { formatDate, formatDateTime, initials, relativeAge } from "@/lib/format";

describe("relativeAge", () => {
  const now = Date.parse("2026-10-15T12:00:00.000Z");

  it("describes recent instants in minutes and hours", () => {
    expect(relativeAge("2026-10-15T11:59:40.000Z", now)).toBe("just now");
    expect(relativeAge("2026-10-15T11:35:00.000Z", now)).toBe("25m ago");
    expect(relativeAge("2026-10-15T07:00:00.000Z", now)).toBe("5h ago");
  });

  it("switches to days and weeks as the gap grows", () => {
    expect(relativeAge("2026-10-12T12:00:00.000Z", now)).toBe("3d ago");
    expect(relativeAge("2026-10-01T12:00:00.000Z", now)).toBe("2w ago");
  });

  it("falls back to an absolute date beyond a month", () => {
    expect(relativeAge("2026-06-01T12:00:00.000Z", now)).toBe("1 Jun 2026");
  });

  it("does not throw on an unparseable timestamp", () => {
    expect(relativeAge("not-a-date", now)).toBe("unknown");
  });
});

describe("absolute formatters", () => {
  it("pins the time zone so server and client markup agree", () => {
    expect(formatDate("2026-03-09T23:30:00.000Z")).toBe("9 Mar 2026");
    expect(formatDateTime("2026-03-09T23:30:00.000Z")).toBe(
      "9 Mar 2026, 23:30",
    );
  });
});

describe("initials", () => {
  it("takes at most two initials", () => {
    expect(initials("Nadia Rivera")).toBe("NR");
    expect(initials("Mia")).toBe("M");
    expect(initials("Jean Luc Picard")).toBe("JL");
    expect(initials("")).toBe("");
  });
});
