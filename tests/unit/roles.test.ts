import { describe, expect, it } from "vitest";

import { CAPABILITIES, ROLE_CAPABILITIES, can } from "@/server/auth/roles";
import { ROLES } from "@/types/domain";

describe("capabilities", () => {
  it("lets every role do the core agent work", () => {
    for (const role of ROLES) {
      expect(can(role, "ticket:reply")).toBe(true);
      expect(can(role, "ticket:note")).toBe(true);
      expect(can(role, "ticket:change_status")).toBe(true);
      expect(can(role, "ticket:assign_self")).toBe(true);
    }
  });

  it("restricts routing work to others and closing to supervisors and above", () => {
    expect(can("agent", "ticket:assign_others")).toBe(false);
    expect(can("agent", "ticket:close")).toBe(false);
    expect(can("supervisor", "ticket:assign_others")).toBe(true);
    expect(can("supervisor", "ticket:close")).toBe(true);
    expect(can("admin", "ticket:close")).toBe(true);
  });

  it("restricts settings to admins", () => {
    expect(can("agent", "settings:manage")).toBe(false);
    expect(can("supervisor", "settings:manage")).toBe(false);
    expect(can("admin", "settings:manage")).toBe(true);
  });

  it("is strictly cumulative: each role is a superset of the one below", () => {
    const agent = new Set(ROLE_CAPABILITIES.agent);
    const supervisor = new Set(ROLE_CAPABILITIES.supervisor);
    const admin = new Set(ROLE_CAPABILITIES.admin);
    for (const capability of agent) expect(supervisor.has(capability)).toBe(true);
    for (const capability of supervisor) expect(admin.has(capability)).toBe(true);
    expect(admin.size).toBeGreaterThan(supervisor.size);
    expect(supervisor.size).toBeGreaterThan(agent.size);
  });

  it("grants no capability outside the declared list", () => {
    const declared = new Set<string>(CAPABILITIES);
    for (const role of ROLES) {
      for (const capability of ROLE_CAPABILITIES[role]) {
        expect(declared.has(capability)).toBe(true);
      }
    }
  });
});
