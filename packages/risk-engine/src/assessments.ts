import { authorize, hasEnabledModule, type TenantAccess } from "@riskflow/auth";
import type { Prisma, TenantDatabase, TenantTransaction } from "@riskflow/database";
import { z } from "zod";
import {
  assertScoreInputs,
  parseScoringDefinition,
  rateScore,
  type AssessmentType,
  type ScoreRating,
  type ScoringGrid,
  type ScoringThresholds,
} from "./scoring";
import { inOrgUnitScope, visibleOrgUnitFilter } from "./scope";

export type AssessmentError = "forbidden" | "not_found" | "invalid" | "module_disabled";

export type AssessmentSummary = {
  id: string;
  assessmentType: AssessmentType;
  likelihood: number;
  impact: number;
  score: number;
  rating: ScoreRating;
  scoringVersionId: string;
  scoringModelKey: string;
  scoringModelVersion: number;
  rationale: string;
  assessedBy: { id: string; displayName: string };
  assessedAt: string;
};

export type ScoringModelRecord = {
  id: string;
  key: string;
  version: number;
  grid: ScoringGrid;
  thresholds: ScoringThresholds;
  publishedAt: string | null;
};

export type HeatmapCell = {
  likelihood: number;
  impact: number;
  count: number;
  rating: ScoreRating;
};

export type HeatmapResult = {
  assessmentType: AssessmentType;
  grid: ScoringGrid;
  size: 3 | 5;
  scoringModel: ScoringModelRecord;
  cells: HeatmapCell[];
  total: number;
};

export const createAssessmentSchema = z.object({
  assessmentType: z.enum(["inherent", "residual"]),
  likelihood: z.number().int().min(1).max(5),
  impact: z.number().int().min(1).max(5),
  rationale: z.string().trim().min(1).max(4000),
  scoringVersionId: z.string().uuid(),
});

export type CreateAssessmentInput = z.infer<typeof createAssessmentSchema>;

function mapModel(row: { id: string; key: string; version: number; definitionJson: Prisma.JsonValue; publishedAt: Date | null }): ScoringModelRecord | null {
  const definition = parseScoringDefinition(row.definitionJson);
  if (!definition) {
    return null;
  }
  return {
    id: row.id,
    key: row.key,
    version: row.version,
    grid: definition.grid,
    thresholds: definition.thresholds,
    publishedAt: row.publishedAt?.toISOString() ?? null,
  };
}

function mapAssessment(
  row: {
    id: string;
    assessmentType: string;
    likelihood: number;
    impact: number;
    score: number;
    rating: string;
    scoringVersionId: string;
    rationale: string;
    assessedAt: Date;
    scoringModel: { key: string; version: number };
    assessor: { id: string; user: { displayName: string } };
  },
): AssessmentSummary {
  return {
    id: row.id,
    assessmentType: row.assessmentType as AssessmentType,
    likelihood: row.likelihood,
    impact: row.impact,
    score: row.score,
    rating: row.rating as ScoreRating,
    scoringVersionId: row.scoringVersionId,
    scoringModelKey: row.scoringModel.key,
    scoringModelVersion: row.scoringModel.version,
    rationale: row.rationale,
    assessedBy: { id: row.assessor.id, displayName: row.assessor.user.displayName },
    assessedAt: row.assessedAt.toISOString(),
  };
}

const assessmentInclude = {
  scoringModel: true,
  assessor: { include: { user: true } },
} as const;

export async function listPublishedScoringModels(
  db: TenantDatabase,
  access: TenantAccess,
): Promise<ScoringModelRecord[] | "forbidden" | "module_disabled"> {
  if (!hasEnabledModule(access, "risk-register")) {
    return "module_disabled";
  }
  if (!authorize(access, "risk:read")) {
    return "forbidden";
  }
  return db.withTenant(access.tenant.id, async (tx) => {
    const rows = await tx.scoringModel.findMany({
      where: { publishedAt: { not: null } },
      orderBy: [{ key: "asc" }, { version: "desc" }],
    });
    return rows.map(mapModel).filter((model): model is ScoringModelRecord => Boolean(model));
  });
}

export async function listAssessments(
  db: TenantDatabase,
  access: TenantAccess,
  riskId: string,
): Promise<{ assessments: AssessmentSummary[]; scoringModels: ScoringModelRecord[] } | AssessmentError> {
  if (!hasEnabledModule(access, "risk-register")) {
    return "module_disabled";
  }
  if (!authorize(access, "risk:read")) {
    return "forbidden";
  }
  return db.withTenant(access.tenant.id, async (tx) => {
    const risk = await tx.risk.findFirst({ where: { id: riskId } });
    if (!risk || !inOrgUnitScope(access, risk.orgUnitId)) {
      return "not_found";
    }
    const [rows, models] = await Promise.all([
      tx.riskAssessment.findMany({
        where: { riskId },
        include: assessmentInclude,
        orderBy: [{ assessedAt: "desc" }, { id: "desc" }],
      }),
      tx.scoringModel.findMany({
        where: { publishedAt: { not: null } },
        orderBy: [{ key: "asc" }, { version: "desc" }],
      }),
    ]);
    return {
      assessments: rows.map(mapAssessment),
      scoringModels: models.map(mapModel).filter((model): model is ScoringModelRecord => Boolean(model)),
    };
  });
}

export async function createAssessment(
  db: TenantDatabase,
  access: TenantAccess,
  riskId: string,
  input: CreateAssessmentInput,
  requestId?: string,
): Promise<AssessmentSummary | AssessmentError> {
  if (!hasEnabledModule(access, "risk-register")) {
    return "module_disabled";
  }
  if (!authorize(access, "risk:assess")) {
    return "forbidden";
  }
  return db.withTenant(access.tenant.id, async (tx) => {
    const risk = await tx.risk.findFirst({ where: { id: riskId } });
    if (!risk || !inOrgUnitScope(access, risk.orgUnitId)) {
      return "not_found";
    }
    if (!authorize(access, "risk:assess", { orgUnitId: risk.orgUnitId })) {
      return "forbidden";
    }

    const modelRow = await tx.scoringModel.findFirst({
      where: { id: input.scoringVersionId, publishedAt: { not: null } },
    });
    const model = modelRow ? mapModel(modelRow) : null;
    if (!model) {
      return "invalid";
    }

    let score: number;
    let rating: ScoreRating;
    try {
      score = assertScoreInputs(input.likelihood, input.impact, model.grid);
      rating = rateScore(score, model.thresholds);
    } catch {
      return "invalid";
    }

    const created = await tx.riskAssessment.create({
      data: {
        tenantId: access.tenant.id,
        riskId,
        assessmentType: input.assessmentType,
        likelihood: input.likelihood,
        impact: input.impact,
        score,
        rating,
        scoringVersionId: model.id,
        rationale: input.rationale,
        assessedBy: access.membership.id,
      },
      include: assessmentInclude,
    });
    await tx.auditEvent.create({
      data: {
        tenantId: access.tenant.id,
        actorUserId: access.user.id,
        action: "assessment.create",
        entityType: "risk_assessment",
        entityId: created.id,
        afterJson: {
          riskId,
          assessmentType: created.assessmentType,
          likelihood: created.likelihood,
          impact: created.impact,
          score: created.score,
          rating: created.rating,
          scoringVersionId: created.scoringVersionId,
        },
        requestId,
      },
    });
    return mapAssessment(created);
  });
}

export async function loadLatestAssessments(
  tx: TenantTransaction,
  riskIds: string[],
): Promise<Map<string, { inherent: AssessmentSummary | null; residual: AssessmentSummary | null }>> {
  const result = new Map<string, { inherent: AssessmentSummary | null; residual: AssessmentSummary | null }>();
  for (const id of riskIds) {
    result.set(id, { inherent: null, residual: null });
  }
  if (riskIds.length === 0) {
    return result;
  }
  const rows = await tx.riskAssessment.findMany({
    where: { riskId: { in: riskIds } },
    include: assessmentInclude,
    orderBy: [{ assessedAt: "desc" }, { id: "desc" }],
  });
  for (const row of rows) {
    const current = result.get(row.riskId);
    if (!current) {
      continue;
    }
    const mapped = mapAssessment(row);
    if (mapped.assessmentType === "inherent" && !current.inherent) {
      current.inherent = mapped;
    }
    if (mapped.assessmentType === "residual" && !current.residual) {
      current.residual = mapped;
    }
  }
  return result;
}

export async function riskIdsMatchingCell(
  tx: TenantTransaction,
  input: { assessmentType: AssessmentType; likelihood: number; impact: number; riskWhere: Prisma.RiskWhereInput },
): Promise<string[]> {
  const risks = await tx.risk.findMany({ where: input.riskWhere, select: { id: true } });
  const latest = await loadLatestAssessments(tx, risks.map((risk) => risk.id));
  return [...latest.entries()]
    .filter(([, value]) => {
      const assessment = value[input.assessmentType];
      return assessment?.likelihood === input.likelihood && assessment?.impact === input.impact;
    })
    .map(([riskId]) => riskId);
}

export async function getAssessmentHeatmap(
  db: TenantDatabase,
  access: TenantAccess,
  assessmentType: AssessmentType,
): Promise<HeatmapResult | AssessmentError> {
  if (!hasEnabledModule(access, "risk-register")) {
    return "module_disabled";
  }
  if (!authorize(access, "risk:read") && !authorize(access, "analytics:read")) {
    return "forbidden";
  }
  return db.withTenant(access.tenant.id, async (tx) => {
    const modelRow = await tx.scoringModel.findFirst({
      where: { key: "default", publishedAt: { not: null } },
      orderBy: { version: "desc" },
    });
    const model = modelRow ? mapModel(modelRow) : null;
    if (!model) {
      return "invalid";
    }
    const size = model.grid === "3x3" ? 3 : 5;
    const risks = await tx.risk.findMany({
      where: { ...visibleOrgUnitFilter(access), status: { not: "archived" } },
      select: { id: true },
    });
    const latest = await loadLatestAssessments(tx, risks.map((risk) => risk.id));
    const counts = new Map<string, number>();
    let total = 0;
    for (const value of latest.values()) {
      const assessment = value[assessmentType];
      if (!assessment) {
        continue;
      }
      const key = `${assessment.likelihood}:${assessment.impact}`;
      counts.set(key, (counts.get(key) ?? 0) + 1);
      total += 1;
    }
    const cells: HeatmapCell[] = [];
    for (let impact = size; impact >= 1; impact -= 1) {
      for (let likelihood = 1; likelihood <= size; likelihood += 1) {
        const score = likelihood * impact;
        cells.push({
          likelihood,
          impact,
          count: counts.get(`${likelihood}:${impact}`) ?? 0,
          rating: rateScore(score, model.thresholds),
        });
      }
    }
    return {
      assessmentType,
      grid: model.grid,
      size,
      scoringModel: model,
      cells,
      total,
    };
  });
}
