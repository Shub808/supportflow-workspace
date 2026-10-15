import { createHmac, timingSafeEqual } from "node:crypto";

import type { Agent, Role } from "@/types/domain";

/**
 * Demo session handling.
 *
 * **What this is:** a signed, tamper-evident session cookie. The payload
 * (agent id, role, issue time) is base64url-encoded and carries an
 * HMAC-SHA256 signature. The server verifies the signature with a constant-
 * time comparison on every request, so a user cannot edit the cookie to
 * promote themselves from `agent` to `admin` — the thing a naive
 * `document.cookie = "role=admin"` demo gets wrong.
 *
 * **What this is not:** real authentication. There is no password, no
 * identity provider, and no credential of any kind — the sign-in screen is a
 * labelled demo role picker. Swapping in an OIDC provider means replacing
 * this module and nothing else; the capability checks in `roles.ts` and the
 * `requireCapability` guard in every action are what actually enforce access,
 * and they are independent of how identity is established.
 *
 * This limitation is stated in the README rather than papered over.
 */

export const SESSION_COOKIE = "supportflow_session";
export const SESSION_MAX_AGE_SECONDS = 60 * 60 * 8;

const DEV_SECRET = "supportflow-development-secret-not-for-production";

let warned = false;

function secret(): string {
  const configured = process.env.SESSION_SECRET?.trim();
  if (configured && configured.length >= 16) return configured;

  // Warn once per process, not once per request: a production deployment
  // running on the development secret is worth shouting about, but not worth
  // flooding the log with.
  if (process.env.NODE_ENV === "production" && !warned) {
    warned = true;
    console.warn(
      "[supportflow] SESSION_SECRET is not set or is shorter than 16 characters; " +
        "falling back to the development secret. Set SESSION_SECRET before exposing this to real users.",
    );
  }
  return configured && configured.length > 0 ? configured : DEV_SECRET;
}

export interface SessionPayload {
  agentId: string;
  role: Role;
  issuedAt: number;
}

const b64url = (value: string): string =>
  Buffer.from(value, "utf8").toString("base64url");

function sign(data: string): string {
  return createHmac("sha256", secret()).update(data).digest("base64url");
}

export function encodeSession(payload: SessionPayload): string {
  const body = b64url(JSON.stringify(payload));
  return `${body}.${sign(body)}`;
}

/** Returns the payload, or `null` for anything malformed, forged or expired. */
export function decodeSession(token: string | undefined): SessionPayload | null {
  if (!token) return null;

  const separator = token.lastIndexOf(".");
  if (separator <= 0) return null;

  const body = token.slice(0, separator);
  const signature = token.slice(separator + 1);

  const expected = Buffer.from(sign(body), "utf8");
  const actual = Buffer.from(signature, "utf8");
  // `timingSafeEqual` throws on a length mismatch, so that is checked first —
  // and the length check itself leaks nothing useful.
  if (expected.length !== actual.length) return null;
  if (!timingSafeEqual(expected, actual)) return null;

  try {
    const parsed = JSON.parse(
      Buffer.from(body, "base64url").toString("utf8"),
    ) as Partial<SessionPayload>;

    if (
      typeof parsed.agentId !== "string" ||
      typeof parsed.issuedAt !== "number" ||
      (parsed.role !== "agent" &&
        parsed.role !== "supervisor" &&
        parsed.role !== "admin")
    ) {
      return null;
    }

    const ageSeconds = (Date.now() - parsed.issuedAt) / 1000;
    if (ageSeconds > SESSION_MAX_AGE_SECONDS || ageSeconds < -60) return null;

    return {
      agentId: parsed.agentId,
      role: parsed.role,
      issuedAt: parsed.issuedAt,
    };
  } catch {
    return null;
  }
}

/**
 * The role is re-read from the database rather than trusted from the cookie.
 * A signed cookie proves the payload has not been edited; it does not prove
 * the role is still current after an administrator changes it.
 */
export function resolveAgent(
  payload: SessionPayload,
  agents: Agent[],
): Agent | null {
  return agents.find((agent) => agent.id === payload.agentId) ?? null;
}
