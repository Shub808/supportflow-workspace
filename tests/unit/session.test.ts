import { describe, expect, it } from "vitest";

import {
  SESSION_MAX_AGE_SECONDS,
  decodeSession,
  encodeSession,
  resolveAgent,
} from "@/server/auth/session";
import type { Agent } from "@/types/domain";

/**
 * The session cookie is the only thing standing between "pick a demo role"
 * and "edit a cookie to become an admin", so its failure modes are pinned
 * here explicitly.
 */
describe("session token", () => {
  const payload = {
    agentId: "agt_rivera",
    role: "agent" as const,
    issuedAt: Date.now(),
  };

  it("round-trips a valid payload", () => {
    expect(decodeSession(encodeSession(payload))).toEqual(payload);
  });

  it("rejects a token with an edited payload", () => {
    const token = encodeSession(payload);
    const [body, signature] = token.split(".");
    const forged = Buffer.from(
      JSON.stringify({ ...payload, role: "admin" }),
      "utf8",
    ).toString("base64url");
    // The attacker rewrites the role but cannot produce a matching signature.
    expect(decodeSession(`${forged}.${signature}`)).toBeNull();
    expect(body).not.toBe(forged);
  });

  it("rejects a token with an edited signature", () => {
    const token = encodeSession(payload);
    const [body] = token.split(".");
    expect(decodeSession(`${body}.not-a-real-signature`)).toBeNull();
  });

  it("rejects malformed, empty and missing tokens", () => {
    expect(decodeSession(undefined)).toBeNull();
    expect(decodeSession("")).toBeNull();
    expect(decodeSession("no-separator")).toBeNull();
    expect(decodeSession(".onlyseparator")).toBeNull();
  });

  it("rejects an unknown role even when correctly signed", () => {
    const token = encodeSession({
      ...payload,
      role: "superuser" as unknown as "admin",
    });
    expect(decodeSession(token)).toBeNull();
  });

  it("rejects an expired token", () => {
    const expired = encodeSession({
      ...payload,
      issuedAt: Date.now() - (SESSION_MAX_AGE_SECONDS + 60) * 1000,
    });
    expect(decodeSession(expired)).toBeNull();
  });

  it("rejects a token issued in the future", () => {
    const future = encodeSession({ ...payload, issuedAt: Date.now() + 600_000 });
    expect(decodeSession(future)).toBeNull();
  });
});

describe("resolveAgent", () => {
  const agents: Agent[] = [
    { id: "agt_a", name: "A", email: "a@example.com", role: "agent" },
    { id: "agt_b", name: "B", email: "b@example.com", role: "supervisor" },
  ];

  it("looks the agent up by id so the role comes from the database", () => {
    // The cookie claims "admin"; the stored record says "agent". The record
    // is what the application uses.
    const resolved = resolveAgent(
      { agentId: "agt_a", role: "admin", issuedAt: Date.now() },
      agents,
    );
    expect(resolved?.role).toBe("agent");
  });

  it("returns null for an agent that no longer exists", () => {
    expect(
      resolveAgent({ agentId: "agt_gone", role: "agent", issuedAt: Date.now() }, agents),
    ).toBeNull();
  });
});
