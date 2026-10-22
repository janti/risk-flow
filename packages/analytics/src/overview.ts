import { authorize, hasEnabledModule, type TenantAccess } from "@riskflow/auth";
import type { Prisma, TenantDatabase } from "@riskflow/database";
import {
  gridSize,
  loadLatestAssessments,
  parseScoringDefinition,
  rateScore,
  visibleOrgUnitFilter,
  type AssessmentType,
  type HeatmapCell,
  type HeatmapResult,
} from "@riskflow/risk-engine";
import { z } from "zod";
import { monthKey, monthRange, resolveAnalyticsWindow } from "./window";

export type AnalyticsError = "forbidden" | "invalid" | "module_disabled";

export type OverviewKpis = {
  openRisks: number;
  inProgressRisks: number;
  highOrCriticalRisks: number;
  overdueActions: number;
  pendingTreatments: number;
};

export type CategoryBreakdown = {
  categoryId: string;
  name: string;
  code: string;
  count: number;
};

export type MonthlyTrend = {
  month: string;
  created: number;
  assessed: number;
};

export type OverdueActionSummary = {
  id: string;
  title: string;
  riskId: string;
  riskCode: string;
  dueAt: string;
  assigneeName: string;
};

export type AnalyticsOverview = {
  audience: "manager" | "risk-manager" | "tenant-admin";
  window: { from: string; to: string };
  assessmentType: AssessmentType;
  kpis: OverviewKpis;
  heatmap: HeatmapResult;
  categories: CategoryBreakdown[];
  monthlyTrends: MonthlyTrend[];
  overdueActions: OverdueActionSummary[];
};

export const overviewQuerySchema = z.object({
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  assessmentType: z.enum(["inherent", "residual"]).default("residual"),
});

export type OverviewQuery = z.infer<typeof overviewQuerySchema>;

export function parseOverviewQuery(searchParams: URLSearchParams): OverviewQuery | "invalid" {
  const emptyToUndef = (value: string | null) => (value && value.trim().length > 0 ? value : undefined);
  const parsed = overviewQuerySchema.safeParse({
    from: emptyToUndef(searchParams.get("from")),
    to: emptyToUndef(searchParams.get("to")),
    assessmentType: emptyToUndef(searchParams.get("assessmentType")),
  });
  return parsed.success ? parsed.data : "invalid";
}

function dashboardAudience(access: TenantAccess): AnalyticsOverview["audience"] {
  if (access.roleKeys.includes("tenant-admin")) {
    return "tenant-admin";
  }
  if (access.roleKeys.includes("risk-manager")) {
    return "risk-manager";
  }
  return "manager";
}

export async function getAnalyticsOverview(
  db: TenantDatabase,
  access: TenantAccess,
  query: OverviewQuery,
  now = new Date(),
): Promise<AnalyticsOverview | AnalyticsError> {
  if (!hasEnabledModule(access, "risk-register")) {
    return "module_disabled";
  }
  if (!authorize(access, "analytics:read")) {
    return "forbidden";
  }
  const window = resolveAnalyticsWindow(query, now);
  if (window === "invalid") {
    return "invalid";
  }

  return db.withTenant(access.tenant.id, async (tx) => {
    const orgFilter = visibleOrgUnitFilter(access);
    const riskWhere: Prisma.RiskWhereInput = {
      ...orgFilter,
      status: { not: "archived" },
      createdAt: { gte: window.from, lte: window.to },
    };
    const risks = await tx.risk.findMany({
      where: riskWhere,
      select: {
        id: true,
        status: true,
        categoryId: true,
        createdAt: true,
        category: { select: { id: true, name: true, code: true } },
      },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    });
    const latest = await loadLatestAssessments(
      tx,
      risks.map((risk) => risk.id),
    );

    const modelRow = await tx.scoringModel.findFirst({
      where: { key: "default", publishedAt: { not: null } },
      orderBy: { version: "desc" },
    });
    const parsedModel = modelRow ? parseScoringDefinition(modelRow.definitionJson) : null;
    const heatmap = buildHeatmap(query.assessmentType, parsedModel, latest, modelRow);

    const categoryCounts = new Map<string, CategoryBreakdown>();
    let openRisks = 0;
    let inProgressRisks = 0;
    let highOrCriticalRisks = 0;
    for (const risk of risks) {
      if (risk.status === "open") {
        openRisks += 1;
      }
      if (risk.status === "in_progress") {
        inProgressRisks += 1;
      }
      const assessment = latest.get(risk.id)?.[query.assessmentType];
      if (assessment && (assessment.rating === "high" || assessment.rating === "critical")) {
        highOrCriticalRisks += 1;
      }
      const current = categoryCounts.get(risk.categoryId) ?? {
        categoryId: risk.category.id,
        name: risk.category.name,
        code: risk.category.code,
        count: 0,
      };
      current.count += 1;
      categoryCounts.set(risk.categoryId, current);
    }

    const overdueWhere = {
      risk: orgFilter,
      status: { not: "completed" },
      dueAt: { gte: window.from, lte: window.to, lt: now },
    };
    const overdueCount = await tx.riskAction.count({ where: overdueWhere });
    const overdueRows = await tx.riskAction.findMany({
      where: overdueWhere,
      include: { risk: true, assignee: { include: { user: true } } },
      orderBy: [{ dueAt: "asc" }, { id: "asc" }],
      take: 25,
    });

    const pendingTreatments = await tx.riskTreatment.count({
      where: {
        status: "pending",
        risk: riskWhere,
      },
    });

    const createdByMonth = new Map<string, number>();
    for (const risk of risks) {
      const key = monthKey(risk.createdAt);
      createdByMonth.set(key, (createdByMonth.get(key) ?? 0) + 1);
    }

    const assessments = await tx.riskAssessment.findMany({
      where: {
        assessedAt: { gte: window.from, lte: window.to },
        risk: { ...orgFilter, status: { not: "archived" } },
      },
      select: { assessedAt: true },
    });
    const assessedByMonth = new Map<string, number>();
    for (const assessment of assessments) {
      const key = monthKey(assessment.assessedAt);
      assessedByMonth.set(key, (assessedByMonth.get(key) ?? 0) + 1);
    }

    return {
      audience: dashboardAudience(access),
      window: { from: window.fromDate, to: window.toDate },
      assessmentType: query.assessmentType,
      kpis: {
        openRisks,
        inProgressRisks,
        highOrCriticalRisks,
        overdueActions: overdueCount,
        pendingTreatments,
      },
      heatmap,
      categories: [...categoryCounts.values()].sort((a, b) => b.count - a.count || a.code.localeCompare(b.code)),
      monthlyTrends: monthRange(window.from, window.to).map((month) => ({
        month,
        created: createdByMonth.get(month) ?? 0,
        assessed: assessedByMonth.get(month) ?? 0,
      })),
      overdueActions: overdueRows.map((row) => ({
        id: row.id,
        title: row.title,
        riskId: row.riskId,
        riskCode: row.risk.code,
        dueAt: row.dueAt.toISOString(),
        assigneeName: row.assignee.user.displayName,
      })),
    };
  });
}

function buildHeatmap(
  assessmentType: AssessmentType,
  parsedModel: ReturnType<typeof parseScoringDefinition>,
  latest: Awaited<ReturnType<typeof loadLatestAssessments>>,
  modelRow: { id: string; key: string; version: number; publishedAt: Date | null } | null,
): HeatmapResult {
  const grid = parsedModel?.grid ?? "5x5";
  const thresholds = parsedModel?.thresholds ?? { lowMax: 4, mediumMax: 9, highMax: 16 };
  const size = gridSize(grid);
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
        rating: rateScore(score, thresholds),
      });
    }
  }
  return {
    assessmentType,
    grid,
    size,
    scoringModel: {
      id: modelRow?.id ?? "",
      key: modelRow?.key ?? "default",
      version: modelRow?.version ?? 1,
      grid,
      thresholds,
      publishedAt: modelRow?.publishedAt?.toISOString() ?? null,
    },
    cells,
    total,
  };
}
