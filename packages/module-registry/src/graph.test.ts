import { describe, expect, it } from "vitest";
import { MODULE_CATALOG } from "./catalog";
import { assertAcyclicCatalog, findDependencyCycle, topologicalOrder } from "./graph";

describe("module dependency graph", () => {
  it("accepts the shipped catalog", () => {
    expect(() => assertAcyclicCatalog(MODULE_CATALOG)).not.toThrow();
    expect(topologicalOrder(MODULE_CATALOG)[0]).toBe("audits");
  });

  it("detects cyclic dependencies", () => {
    const cycle = findDependencyCycle([
      { key: "a", dependencies: ["b"] },
      { key: "b", dependencies: ["c"] },
      { key: "c", dependencies: ["a"] },
    ]);
    expect(cycle).toEqual(["a", "b", "c", "a"]);
  });

  it("rejects unknown dependency keys", () => {
    expect(() =>
      assertAcyclicCatalog([{ key: "incidents", dependencies: ["missing"] }]),
    ).toThrow(/Unknown module dependency/);
  });
});
