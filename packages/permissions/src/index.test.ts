import { describe, expect, it } from "vitest";
import {
  denyByDefault,
  expandOrgUnitScope,
  hasPermission,
  orgUnitIsInScope,
  PERMISSION_KEYS,
  ROLE_PERMISSIONS,
} from "./index";

describe("permission catalog", () => {
  it("includes the documented permission keys", () => {
    expect(PERMISSION_KEYS).toContain("risk:read");
    expect(PERMISSION_KEYS).toContain("audit:read");
    expect(PERMISSION_KEYS).toHaveLength(13);
  });

  it("denies by default", () => {
    expect(denyByDefault("risk:read")).toBe(false);
    expect(hasPermission([], "risk:read")).toBe(false);
    expect(hasPermission(["risk:read"], "users:manage")).toBe(false);
  });

  it("grants only listed permissions for system roles", () => {
    expect(ROLE_PERMISSIONS.employee).toEqual(["risk:read"]);
    expect(ROLE_PERMISSIONS["tenant-admin"]).toHaveLength(PERMISSION_KEYS.length);
    expect(hasPermission(ROLE_PERMISSIONS.manager, "risk:update")).toBe(true);
    expect(hasPermission(ROLE_PERMISSIONS.manager, "users:manage")).toBe(false);
  });

  it("expands org-unit grants to descendants", () => {
    const units = [
      { id: "hq", parentId: null },
      { id: "ops", parentId: "hq" },
      { id: "team", parentId: "ops" },
    ];
    const scope = expandOrgUnitScope(units, ["ops"]);
    expect(orgUnitIsInScope("ops", scope)).toBe(true);
    expect(orgUnitIsInScope("team", scope)).toBe(true);
    expect(orgUnitIsInScope("hq", scope)).toBe(false);
    expect(orgUnitIsInScope("ops", "tenant")).toBe(true);
  });
});
