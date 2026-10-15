import { cookies } from "next/headers";

import { SESSION_COOKIE, decodeSession, resolveAgent } from "@/server/auth/session";
import { can, denialReason, type Capability } from "@/server/auth/roles";
import { listAgents } from "@/server/repo/tickets";
import type { Agent } from "@/types/domain";

/** The signed-in agent for this request, or `null`. */
export async function currentAgent(): Promise<Agent | null> {
  const store = await cookies();
  const payload = decodeSession(store.get(SESSION_COOKIE)?.value);
  if (!payload) return null;
  // Role comes from the database, not the cookie — see session.ts.
  return resolveAgent(payload, listAgents());
}

export class AuthorizationError extends Error {
  readonly capability: Capability | null;

  constructor(message: string, capability: Capability | null = null) {
    super(message);
    this.name = "AuthorizationError";
    this.capability = capability;
  }
}

/**
 * The single guard every mutating server action calls first.
 *
 * Server Actions are public HTTP endpoints — the disabled button in the UI is
 * a convenience, not a control. Every action therefore re-derives the actor
 * from the cookie and re-checks the capability on the server, and the UI
 * reflects the same `can()` table so the two cannot disagree.
 */
export async function requireCapability(capability: Capability): Promise<Agent> {
  const agent = await currentAgent();
  if (!agent) {
    throw new AuthorizationError("You are signed out. Sign in to continue.");
  }
  if (!can(agent.role, capability)) {
    throw new AuthorizationError(denialReason(agent.role, capability), capability);
  }
  return agent;
}
