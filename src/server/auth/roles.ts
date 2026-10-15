import type { Role } from "@/types/domain";

/**
 * Permissions.
 *
 * Capabilities are named for what they allow, not for who holds them, so a
 * call site reads `can(role, "ticket:assign_others")` rather than
 * `role === "supervisor" || role === "admin"`. Adding a role then means
 * editing this table, not hunting for role comparisons across the codebase.
 */
export const CAPABILITIES = [
  "ticket:reply",
  "ticket:note",
  "ticket:change_status",
  "ticket:change_priority",
  "ticket:assign_self",
  "ticket:assign_others",
  "ticket:label",
  "ticket:close",
  "kb:read",
  "settings:manage",
] as const;
export type Capability = (typeof CAPABILITIES)[number];

const AGENT: Capability[] = [
  "ticket:reply",
  "ticket:note",
  "ticket:change_status",
  "ticket:change_priority",
  "ticket:assign_self",
  "ticket:label",
  "kb:read",
];

const SUPERVISOR: Capability[] = [
  ...AGENT,
  "ticket:assign_others",
  "ticket:close",
];

const ADMIN: Capability[] = [...SUPERVISOR, "settings:manage"];

export const ROLE_CAPABILITIES: Record<Role, readonly Capability[]> = {
  agent: AGENT,
  supervisor: SUPERVISOR,
  admin: ADMIN,
};

export function can(role: Role, capability: Capability): boolean {
  return ROLE_CAPABILITIES[role].includes(capability);
}

/**
 * Human-readable reason a capability is denied. Surfacing *why* a control is
 * unavailable is the difference between a disabled button and a dead end.
 */
export function denialReason(role: Role, capability: Capability): string {
  return `Your role (${role}) does not allow "${capability}".`;
}
