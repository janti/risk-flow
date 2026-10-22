import { describe, expect, it } from "vitest";
import {
  categoryGuidance,
  frameworksForCategory,
  guidancePackForCategory,
  impactScaleKey,
  likelihoodScaleKey,
} from "./guidance";

describe("standard guidance packs", () => {
  it("maps operations and OHS codes to occupational safety guidance", () => {
    expect(guidancePackForCategory("OPS")).toBe("ohs");
    expect(guidancePackForCategory("ohs")).toBe("ohs");
    expect(categoryGuidance("OPS").frameworkIds).toEqual(["iso31000", "iso45001", "tyosuojelu", "ttk"]);
    expect(categoryGuidance("OPS").templateKey).toBe("guidance.pack.ohs.template");
  });

  it("maps cyber codes to ISO 27001/27005 and NIST CSF", () => {
    expect(guidancePackForCategory("CYBER")).toBe("cyber");
    expect(frameworksForCategory("CYBER").map((item) => item.id)).toEqual([
      "iso31000",
      "iso27001",
      "iso27005",
      "nist-csf",
    ]);
    expect(categoryGuidance("CYBER").templateKey).toBe("guidance.pack.cyber.template");
  });

  it("falls back to ISO 31000 for unknown categories", () => {
    expect(guidancePackForCategory("CUSTOM")).toBe("generic");
    expect(frameworksForCategory("CUSTOM").map((item) => item.id)).toEqual(["iso31000"]);
  });

  it("exposes tyosuojelu-style 3x3 and 5x5 scale keys", () => {
    expect(likelihoodScaleKey(3, 1)).toBe("guidance.likelihood.3.1");
    expect(impactScaleKey(5, 5)).toBe("guidance.impact.5.5");
  });
});
