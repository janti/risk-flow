export type AssessmentType = "inherent" | "residual";

export type ScoringGrid = "3x3" | "5x5";

export type ScoreRating = "low" | "medium" | "high" | "critical";

export type ScoringThresholds = {
  lowMax: number;
  mediumMax: number;
  highMax: number;
};

export type ScoringModelDefinition = {
  key: string;
  version: number;
  grid: ScoringGrid;
  thresholds: ScoringThresholds;
};

export const DEFAULT_5X5_THRESHOLDS: ScoringThresholds = {
  lowMax: 4,
  mediumMax: 9,
  highMax: 16,
};

export const DEFAULT_3X3_THRESHOLDS: ScoringThresholds = {
  lowMax: 2,
  mediumMax: 4,
  highMax: 6,
};

export function gridSize(grid: ScoringGrid): 3 | 5 {
  return grid === "3x3" ? 3 : 5;
}

/**
 * Initial scoring contract: score = likelihood * impact.
 * Historical assessments must store the model version used at assessment time.
 */
export function calculateScore(likelihood: number, impact: number): number {
  if (!Number.isInteger(likelihood) || !Number.isInteger(impact)) {
    throw new Error("Likelihood and impact must be integers.");
  }
  if (likelihood < 1 || impact < 1) {
    throw new Error("Likelihood and impact must be at least 1.");
  }
  return likelihood * impact;
}

export function assertScoreInputs(likelihood: number, impact: number, grid: ScoringGrid): number {
  const score = calculateScore(likelihood, impact);
  const max = gridSize(grid);
  if (likelihood > max || impact > max) {
    throw new Error(`Likelihood and impact must be at most ${max} for ${grid}.`);
  }
  return score;
}

export function rateScore(score: number, thresholds: ScoringThresholds): ScoreRating {
  if (score <= thresholds.lowMax) {
    return "low";
  }
  if (score <= thresholds.mediumMax) {
    return "medium";
  }
  if (score <= thresholds.highMax) {
    return "high";
  }
  return "critical";
}

export function parseScoringDefinition(value: unknown): { grid: ScoringGrid; thresholds: ScoringThresholds } | null {
  if (!value || typeof value !== "object") {
    return null;
  }
  const record = value as Record<string, unknown>;
  const grid = record.grid;
  const thresholds = record.thresholds;
  if ((grid !== "3x3" && grid !== "5x5") || !thresholds || typeof thresholds !== "object") {
    return null;
  }
  const parsed = thresholds as Record<string, unknown>;
  if (
    typeof parsed.lowMax !== "number" ||
    typeof parsed.mediumMax !== "number" ||
    typeof parsed.highMax !== "number"
  ) {
    return null;
  }
  return {
    grid,
    thresholds: {
      lowMax: parsed.lowMax,
      mediumMax: parsed.mediumMax,
      highMax: parsed.highMax,
    },
  };
}
