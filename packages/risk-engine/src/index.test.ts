import { describe, expect, it } from "vitest";
import {
  DEFAULT_3X3_THRESHOLDS,
  DEFAULT_5X5_THRESHOLDS,
  assertScoreInputs,
  calculateScore,
  rateScore,
} from "./index";

describe("calculateScore", () => {
  it("multiplies likelihood and impact", () => {
    expect(calculateScore(4, 5)).toBe(20);
  });

  it("rejects non-integers and values below 1", () => {
    expect(() => calculateScore(1.5, 2)).toThrow();
    expect(() => calculateScore(0, 3)).toThrow();
  });
});

describe("assertScoreInputs", () => {
  it("accepts 5x5 boundaries 1 and 5", () => {
    expect(assertScoreInputs(1, 1, "5x5")).toBe(1);
    expect(assertScoreInputs(5, 5, "5x5")).toBe(25);
  });

  it("rejects values above the grid", () => {
    expect(() => assertScoreInputs(4, 1, "3x3")).toThrow();
    expect(() => assertScoreInputs(6, 2, "5x5")).toThrow();
  });
});

describe("rateScore", () => {
  it("classifies 5x5 scores against tenant thresholds", () => {
    expect(rateScore(3, DEFAULT_5X5_THRESHOLDS)).toBe("low");
    expect(rateScore(4, DEFAULT_5X5_THRESHOLDS)).toBe("low");
    expect(rateScore(9, DEFAULT_5X5_THRESHOLDS)).toBe("medium");
    expect(rateScore(16, DEFAULT_5X5_THRESHOLDS)).toBe("high");
    expect(rateScore(17, DEFAULT_5X5_THRESHOLDS)).toBe("critical");
    expect(rateScore(25, DEFAULT_5X5_THRESHOLDS)).toBe("critical");
  });

  it("classifies 3x3 scores against tenant thresholds", () => {
    expect(rateScore(1, DEFAULT_3X3_THRESHOLDS)).toBe("low");
    expect(rateScore(2, DEFAULT_3X3_THRESHOLDS)).toBe("low");
    expect(rateScore(4, DEFAULT_3X3_THRESHOLDS)).toBe("medium");
    expect(rateScore(6, DEFAULT_3X3_THRESHOLDS)).toBe("high");
    expect(rateScore(9, DEFAULT_3X3_THRESHOLDS)).toBe("critical");
  });
});
