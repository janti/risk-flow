import {
  PERMISSION_KEYS,
  ROLE_PERMISSIONS,
  SYSTEM_ROLE_KEYS,
  type SystemRoleKey,
} from "@riskflow/permissions";
import { createMigratorClient } from "./tenant-database";

export const LOCAL_OIDC_ISSUER = "http://127.0.0.1:3300";

const PERMISSION_DESCRIPTIONS: Record<(typeof PERMISSION_KEYS)[number], string> = {
  "risk:read": "Read risks",
  "risk:create": "Create risks",
  "risk:update": "Update risks",
  "risk:archive": "Archive risks",
  "risk:assess": "Assess risks",
  "risk:approve": "Approve risk treatments",
  "action:assign": "Assign actions",
  "action:complete": "Complete actions",
  "analytics:read": "Read analytics",
  "form:manage": "Manage forms",
  "module:manage": "Manage modules",
  "users:manage": "Manage users",
  "audit:read": "Read audit events",
};

const ROLE_LABELS: Record<SystemRoleKey, string> = {
  employee: "Employee",
  manager: "Manager",
  "risk-manager": "Risk manager",
  "tenant-admin": "Tenant admin",
};

const DEFAULT_5X5_DEFINITION = {
  grid: "5x5",
  thresholds: { lowMax: 4, mediumMax: 9, highMax: 16 },
};

function daysAgo(days: number): Date {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000);
}

function matrixScore(likelihood: number, impact: number): {
  likelihood: number;
  impact: number;
  score: number;
  rating: "low" | "medium" | "high" | "critical";
} {
  const score = likelihood * impact;
  const rating =
    score <= DEFAULT_5X5_DEFINITION.thresholds.lowMax
      ? "low"
      : score <= DEFAULT_5X5_DEFINITION.thresholds.mediumMax
        ? "medium"
        : score <= DEFAULT_5X5_DEFINITION.thresholds.highMax
          ? "high"
          : "critical";
  return { likelihood, impact, score, rating };
}

type SeedMatrixRisk = {
  code: string;
  title: string;
  description: string;
  categoryCode: "OPS" | "COMP" | "CYBER" | "FIN";
  orgUnit: "Headquarters" | "Operations";
  status: "open" | "in_progress";
  daysAgo: number;
  inherent: { likelihood: number; impact: number };
  residual: { likelihood: number; impact: number };
};

const SEED_CATEGORIES = [
  { code: "OPS", name: "Operations" },
  { code: "COMP", name: "Compliance" },
  { code: "CYBER", name: "Cyber" },
  { code: "FIN", name: "Finance" },
] as const;

/**
 * Canonical examples plus extra 5x5 coverage so the residual heatmap has a
 * cell for every likelihood/impact pair. Keep OPS-001 and COMP-001 scores
 * unchanged for dashboard and e2e locators.
 */
const SEED_MATRIX_RISKS: SeedMatrixRisk[] = [
  {
    code: "OPS-001",
    title: "Shift handover control gap",
    description: "Seeded Operations risk for Sprint 07 dashboards.",
    categoryCode: "OPS",
    orgUnit: "Operations",
    status: "open",
    daysAgo: 80,
    inherent: { likelihood: 3, impact: 2 },
    residual: { likelihood: 3, impact: 2 },
  },
  {
    code: "COMP-001",
    title: "Policy exception backlog",
    description: "Seeded Compliance risk for Sprint 07 dashboards.",
    categoryCode: "COMP",
    orgUnit: "Headquarters",
    status: "open",
    daysAgo: 40,
    inherent: { likelihood: 5, impact: 4 },
    residual: { likelihood: 5, impact: 4 },
  },
  {
    code: "OPS-002",
    title: "Spare-parts stockout on night shift",
    description: "Seeded low residual example for the 5x5 matrix.",
    categoryCode: "OPS",
    orgUnit: "Operations",
    status: "open",
    daysAgo: 25,
    inherent: { likelihood: 2, impact: 2 },
    residual: { likelihood: 1, impact: 1 },
  },
  {
    code: "OPS-003",
    title: "Contractor induction skipped",
    description: "Seeded operations residual example for the 5x5 matrix.",
    categoryCode: "OPS",
    orgUnit: "Operations",
    status: "open",
    daysAgo: 110,
    inherent: { likelihood: 4, impact: 2 },
    residual: { likelihood: 4, impact: 1 },
  },
  {
    code: "OPS-004",
    title: "Preventive maintenance backlog",
    description: "Seeded operations residual example for the 5x5 matrix.",
    categoryCode: "OPS",
    orgUnit: "Operations",
    status: "in_progress",
    daysAgo: 95,
    inherent: { likelihood: 3, impact: 3 },
    residual: { likelihood: 2, impact: 2 },
  },
  {
    code: "OPS-005",
    title: "Line changeover documentation stale",
    description: "Seeded operations residual example for the 5x5 matrix.",
    categoryCode: "OPS",
    orgUnit: "Operations",
    status: "open",
    daysAgo: 150,
    inherent: { likelihood: 2, impact: 4 },
    residual: { likelihood: 1, impact: 3 },
  },
  {
    code: "OPS-006",
    title: "Forklift collision near loading dock",
    description: "Seeded operations residual example for the 5x5 matrix.",
    categoryCode: "OPS",
    orgUnit: "Operations",
    status: "open",
    daysAgo: 200,
    inherent: { likelihood: 2, impact: 5 },
    residual: { likelihood: 1, impact: 4 },
  },
  {
    code: "OPS-007",
    title: "Key-person dependency on dispatch",
    description: "Seeded operations residual example for the 5x5 matrix.",
    categoryCode: "OPS",
    orgUnit: "Operations",
    status: "in_progress",
    daysAgo: 60,
    inherent: { likelihood: 5, impact: 4 },
    residual: { likelihood: 4, impact: 4 },
  },
  {
    code: "OPS-008",
    title: "Fire-suppression test overdue",
    description: "Seeded operations residual example for the 5x5 matrix.",
    categoryCode: "OPS",
    orgUnit: "Operations",
    status: "open",
    daysAgo: 18,
    inherent: { likelihood: 4, impact: 5 },
    residual: { likelihood: 4, impact: 5 },
  },
  {
    code: "COMP-002",
    title: "Vendor due-diligence lapsed",
    description: "Seeded compliance residual example for the 5x5 matrix.",
    categoryCode: "COMP",
    orgUnit: "Headquarters",
    status: "open",
    daysAgo: 55,
    inherent: { likelihood: 5, impact: 3 },
    residual: { likelihood: 5, impact: 2 },
  },
  {
    code: "COMP-003",
    title: "Mandatory training completion gap",
    description: "Seeded compliance residual example for the 5x5 matrix.",
    categoryCode: "COMP",
    orgUnit: "Headquarters",
    status: "in_progress",
    daysAgo: 130,
    inherent: { likelihood: 5, impact: 4 },
    residual: { likelihood: 5, impact: 3 },
  },
  {
    code: "COMP-004",
    title: "Record retention schedule unclear",
    description: "Seeded compliance residual example for the 5x5 matrix.",
    categoryCode: "COMP",
    orgUnit: "Headquarters",
    status: "open",
    daysAgo: 220,
    inherent: { likelihood: 2, impact: 5 },
    residual: { likelihood: 1, impact: 5 },
  },
  {
    code: "COMP-005",
    title: "Unapproved personal data transfer",
    description: "Seeded critical residual example for the 5x5 matrix.",
    categoryCode: "COMP",
    orgUnit: "Headquarters",
    status: "open",
    daysAgo: 12,
    inherent: { likelihood: 5, impact: 5 },
    residual: { likelihood: 5, impact: 5 },
  },
  {
    code: "CYB-001",
    title: "Unpatched laptops in field sales",
    description: "Seeded cyber residual example for the 5x5 matrix.",
    categoryCode: "CYBER",
    orgUnit: "Headquarters",
    status: "open",
    daysAgo: 33,
    inherent: { likelihood: 3, impact: 2 },
    residual: { likelihood: 2, impact: 1 },
  },
  {
    code: "CYB-002",
    title: "Shared admin password on jump host",
    description: "Seeded cyber residual example for the 5x5 matrix.",
    categoryCode: "CYBER",
    orgUnit: "Headquarters",
    status: "open",
    daysAgo: 48,
    inherent: { likelihood: 5, impact: 2 },
    residual: { likelihood: 5, impact: 1 },
  },
  {
    code: "CYB-003",
    title: "Phishing mailbox rules not reviewed",
    description: "Seeded cyber residual example for the 5x5 matrix.",
    categoryCode: "CYBER",
    orgUnit: "Headquarters",
    status: "in_progress",
    daysAgo: 70,
    inherent: { likelihood: 5, impact: 3 },
    residual: { likelihood: 4, impact: 2 },
  },
  {
    code: "CYB-004",
    title: "Privileged access recertification late",
    description: "Seeded cyber residual example for the 5x5 matrix.",
    categoryCode: "CYBER",
    orgUnit: "Headquarters",
    status: "open",
    daysAgo: 165,
    inherent: { likelihood: 4, impact: 4 },
    residual: { likelihood: 4, impact: 3 },
  },
  {
    code: "CYB-005",
    title: "Backup restore test failed",
    description: "Seeded cyber residual example for the 5x5 matrix.",
    categoryCode: "CYBER",
    orgUnit: "Headquarters",
    status: "open",
    daysAgo: 88,
    inherent: { likelihood: 3, impact: 5 },
    residual: { likelihood: 3, impact: 4 },
  },
  {
    code: "CYB-006",
    title: "Internet-facing API without rate limit",
    description: "Seeded cyber residual example for the 5x5 matrix.",
    categoryCode: "CYBER",
    orgUnit: "Headquarters",
    status: "open",
    daysAgo: 7,
    inherent: { likelihood: 4, impact: 5 },
    residual: { likelihood: 3, impact: 5 },
  },
  {
    code: "CYB-007",
    title: "MFA not enforced for remote access",
    description: "Seeded cyber residual example for the 5x5 matrix.",
    categoryCode: "CYBER",
    orgUnit: "Headquarters",
    status: "open",
    daysAgo: 36,
    inherent: { likelihood: 4, impact: 4 },
    residual: { likelihood: 3, impact: 3 },
  },
  {
    code: "FIN-001",
    title: "Manual journal entries without dual control",
    description: "Seeded finance residual example for the 5x5 matrix.",
    categoryCode: "FIN",
    orgUnit: "Headquarters",
    status: "open",
    daysAgo: 28,
    inherent: { likelihood: 4, impact: 2 },
    residual: { likelihood: 3, impact: 1 },
  },
  {
    code: "FIN-002",
    title: "Expense claims without receipt",
    description: "Seeded finance residual example for the 5x5 matrix.",
    categoryCode: "FIN",
    orgUnit: "Headquarters",
    status: "open",
    daysAgo: 175,
    inherent: { likelihood: 2, impact: 3 },
    residual: { likelihood: 1, impact: 2 },
  },
  {
    code: "FIN-003",
    title: "Customer credit limit override",
    description: "Seeded finance residual example for the 5x5 matrix.",
    categoryCode: "FIN",
    orgUnit: "Headquarters",
    status: "open",
    daysAgo: 140,
    inherent: { likelihood: 3, impact: 4 },
    residual: { likelihood: 2, impact: 3 },
  },
  {
    code: "FIN-004",
    title: "FX hedge documentation incomplete",
    description: "Seeded finance residual example for the 5x5 matrix.",
    categoryCode: "FIN",
    orgUnit: "Headquarters",
    status: "in_progress",
    daysAgo: 210,
    inherent: { likelihood: 3, impact: 5 },
    residual: { likelihood: 2, impact: 4 },
  },
  {
    code: "FIN-005",
    title: "Revenue recognition cut-off error",
    description: "Seeded finance residual example for the 5x5 matrix.",
    categoryCode: "FIN",
    orgUnit: "Headquarters",
    status: "open",
    daysAgo: 5,
    inherent: { likelihood: 3, impact: 5 },
    residual: { likelihood: 2, impact: 5 },
  },
];

const DEFAULT_TENANT_SETTINGS = {
  separationOfDuties: true,
  approvalStages: ["treatment"],
};

const MODULE_CATALOG_SEED = [
  { key: "risk-register", version: "1.0.0", dependencies: [] as string[] },
  { key: "incidents", version: "1.0.0", dependencies: ["risk-register"] },
  { key: "audits", version: "1.0.0", dependencies: [] as string[] },
  { key: "vendor-risk", version: "1.0.0", dependencies: ["risk-register"] },
  { key: "continuity", version: "1.0.0", dependencies: ["risk-register"] },
];

export function oidcAuthSubject(accountId: string, issuer = LOCAL_OIDC_ISSUER): string {
  return `${issuer}|${accountId}`;
}

type SeedPerson = {
  accountId: string;
  email: string;
  displayName: string;
  platformAdmin?: boolean;
};

type SeedMembership = {
  accountId: string;
  role: SystemRoleKey;
  status?: "active" | "revoked";
  orgUnitName?: string;
};

const PEOPLE: SeedPerson[] = [
  { accountId: "acme-admin", email: "admin@acme.example", displayName: "Acme Admin" },
  { accountId: "acme-manager", email: "manager@acme.example", displayName: "Acme Manager" },
  { accountId: "acme-employee", email: "employee@acme.example", displayName: "Acme Employee" },
  { accountId: "acme-risk-manager", email: "risk-manager@acme.example", displayName: "Acme Risk Manager" },
  { accountId: "acme-revoked", email: "revoked@acme.example", displayName: "Acme Revoked" },
  { accountId: "globex-admin", email: "admin@globex.example", displayName: "Globex Admin" },
  { accountId: "globex-manager", email: "manager@globex.example", displayName: "Globex Manager" },
  { accountId: "globex-employee", email: "employee@globex.example", displayName: "Globex Employee" },
  { accountId: "globex-risk-manager", email: "risk-manager@globex.example", displayName: "Globex Risk Manager" },
  {
    accountId: "platform-admin",
    email: "platform@riskflow.example",
    displayName: "Platform Admin",
    platformAdmin: true,
  },
];

export async function seedDatabase(connectionString: string): Promise<void> {
  const prisma = createMigratorClient(connectionString);
  const issuer = process.env.AUTH_ISSUER ?? LOCAL_OIDC_ISSUER;

  try {
    for (const key of PERMISSION_KEYS) {
      await prisma.permission.upsert({
        where: { key },
        create: { key, description: PERMISSION_DESCRIPTIONS[key] },
        update: { description: PERMISSION_DESCRIPTIONS[key] },
      });
    }

    const users = new Map<string, { id: string }>();
    for (const person of PEOPLE) {
      const user = await prisma.user.upsert({
        where: { authSubject: oidcAuthSubject(person.accountId, issuer) },
        create: {
          authSubject: oidcAuthSubject(person.accountId, issuer),
          email: person.email,
          displayName: person.displayName,
          platformAdmin: person.platformAdmin ?? false,
        },
        update: {
          email: person.email,
          displayName: person.displayName,
          platformAdmin: person.platformAdmin ?? false,
        },
      });
      users.set(person.accountId, user);
    }

    await seedModuleCatalog(prisma);

    await seedTenant(prisma, users, {
      slug: "acme",
      name: "Acme Oy",
      riskCode: "R-001",
      riskTitle: "Single-source supplier outage",
      entitledModules: ["risk-register", "incidents", "vendor-risk"],
      memberships: [
        { accountId: "acme-admin", role: "tenant-admin" },
        { accountId: "acme-manager", role: "manager", orgUnitName: "Operations" },
        { accountId: "acme-employee", role: "employee" },
        { accountId: "acme-risk-manager", role: "risk-manager" },
        { accountId: "acme-revoked", role: "employee", status: "revoked" },
      ],
    });

    await seedTenant(prisma, users, {
      slug: "globex",
      name: "Globex Ab",
      riskCode: "R-001",
      riskTitle: "Unencrypted backup media",
      entitledModules: ["risk-register", "audits"],
      memberships: [
        { accountId: "globex-admin", role: "tenant-admin" },
        { accountId: "globex-manager", role: "manager", orgUnitName: "Operations" },
        { accountId: "globex-employee", role: "employee" },
        { accountId: "globex-risk-manager", role: "risk-manager" },
      ],
    });
  } finally {
    await prisma.$disconnect();
  }
}

async function seedTenant(
  prisma: ReturnType<typeof createMigratorClient>,
  users: Map<string, { id: string }>,
  input: {
    slug: string;
    name: string;
    riskCode: string;
    riskTitle: string;
    entitledModules: string[];
    memberships: SeedMembership[];
  },
): Promise<void> {
  const tenant = await prisma.tenant.upsert({
    where: { slug: input.slug },
    create: {
      slug: input.slug,
      name: input.name,
      status: "active",
      settingsJson: DEFAULT_TENANT_SETTINGS,
    },
    update: { name: input.name, settingsJson: DEFAULT_TENANT_SETTINGS },
  });

  await seedTenantModules(prisma, tenant.id, input.entitledModules);

  let headquarters = await prisma.orgUnit.findFirst({
    where: { tenantId: tenant.id, name: "Headquarters" },
  });
  headquarters ??= await prisma.orgUnit.create({
    data: { tenantId: tenant.id, name: "Headquarters", type: "company" },
  });

  let operations = await prisma.orgUnit.findFirst({
    where: { tenantId: tenant.id, name: "Operations" },
  });
  operations ??= await prisma.orgUnit.create({
    data: {
      tenantId: tenant.id,
      name: "Operations",
      type: "division",
      parentId: headquarters.id,
    },
  });

  const unitsByName = {
    Headquarters: headquarters,
    Operations: operations,
  };

  const roles = [];
  for (const key of SYSTEM_ROLE_KEYS) {
    const role = await prisma.role.upsert({
      where: { tenantId_key: { tenantId: tenant.id, key } },
      create: { tenantId: tenant.id, key, label: ROLE_LABELS[key], isSystem: true },
      update: { label: ROLE_LABELS[key] },
    });
    roles.push(role);

    const allowed = ROLE_PERMISSIONS[key];
    for (const permissionKey of allowed) {
      await prisma.rolePermission.upsert({
        where: {
          tenantId_roleId_permissionKey: {
            tenantId: tenant.id,
            roleId: role.id,
            permissionKey,
          },
        },
        create: { tenantId: tenant.id, roleId: role.id, permissionKey },
        update: {},
      });
    }
    await prisma.rolePermission.deleteMany({
      where: {
        tenantId: tenant.id,
        roleId: role.id,
        permissionKey: { notIn: [...allowed] },
      },
    });
  }

  const ownerMemberships = [];
  for (const grant of input.memberships) {
    const user = users.get(grant.accountId);
    if (!user) {
      throw new Error(`Missing seeded user ${grant.accountId}`);
    }
    const membership = await prisma.membership.upsert({
      where: { tenantId_userId: { tenantId: tenant.id, userId: user.id } },
      create: {
        tenantId: tenant.id,
        userId: user.id,
        status: grant.status ?? "active",
      },
      update: { status: grant.status ?? "active" },
    });
    ownerMemberships.push({ grant, membership });

    const homeUnit = unitsByName[grant.orgUnitName === "Operations" ? "Operations" : "Headquarters"];
    await prisma.orgUnitMembership.upsert({
      where: {
        tenantId_membershipId_orgUnitId: {
          tenantId: tenant.id,
          membershipId: membership.id,
          orgUnitId: homeUnit.id,
        },
      },
      create: {
        tenantId: tenant.id,
        membershipId: membership.id,
        orgUnitId: homeUnit.id,
      },
      update: {},
    });

    const role = roles.find((item) => item.key === grant.role);
    if (!role) {
      continue;
    }
    const existingGrant = await prisma.membershipRole.findFirst({
      where: { tenantId: tenant.id, membershipId: membership.id, roleId: role.id },
    });
    if (!existingGrant) {
      await prisma.membershipRole.create({
        data: {
          tenantId: tenant.id,
          membershipId: membership.id,
          roleId: role.id,
          orgUnitId: grant.orgUnitName === "Operations" ? operations.id : null,
        },
      });
    }
  }

  const categories = new Map<string, { id: string }>();
  for (const item of SEED_CATEGORIES) {
    const category = await prisma.riskCategory.upsert({
      where: { tenantId_code: { tenantId: tenant.id, code: item.code } },
      create: { tenantId: tenant.id, name: item.name, code: item.code },
      update: { name: item.name },
    });
    categories.set(item.code, category);
  }

  const owner = ownerMemberships.find((item) => item.grant.role === "tenant-admin")?.membership;
  if (!owner) {
    throw new Error(`Tenant ${input.slug} is missing a tenant-admin membership.`);
  }

  const operationsCategory = categories.get("OPS");
  if (!operationsCategory) {
    throw new Error("Missing seeded Operations category.");
  }

  const existingRisk = await prisma.risk.findUnique({
    where: { tenantId_code: { tenantId: tenant.id, code: input.riskCode } },
  });
  const risk =
    existingRisk ??
    (await prisma.risk.create({
      data: {
        tenantId: tenant.id,
        code: input.riskCode,
        title: input.riskTitle,
        description: "Seeded in Sprint 02.",
        categoryId: operationsCategory.id,
        orgUnitId: headquarters.id,
        ownerMembershipId: owner.id,
        status: "open",
      },
    }));

  const scoringModel = await prisma.scoringModel.upsert({
    where: {
      tenantId_key_version: { tenantId: tenant.id, key: "default", version: 1 },
    },
    create: {
      tenantId: tenant.id,
      key: "default",
      version: 1,
      definitionJson: DEFAULT_5X5_DEFINITION,
      publishedAt: new Date(),
    },
    update: {},
  });

  const riskManager = ownerMemberships.find((item) => item.grant.role === "risk-manager")?.membership;
  const manager = ownerMemberships.find((item) => item.grant.role === "manager")?.membership;
  const employee = ownerMemberships.find((item) => item.grant.role === "employee")?.membership;
  const r001AssessedAt = risk.createdAt;

  await upsertSeedAssessment(prisma, {
    tenantId: tenant.id,
    riskId: risk.id,
    assessmentType: "inherent",
    ...matrixScore(4, 4),
    scoringVersionId: scoringModel.id,
    rationale: "Seeded inherent assessment for the default 5x5 model.",
    assessedBy: owner.id,
    assessedAt: r001AssessedAt,
  });
  await upsertSeedAssessment(prisma, {
    tenantId: tenant.id,
    riskId: risk.id,
    assessmentType: "residual",
    ...matrixScore(3, 3),
    scoringVersionId: scoringModel.id,
    rationale: "Seeded residual assessment after alternate-supplier controls.",
    assessedBy: owner.id,
    assessedAt: r001AssessedAt,
  });

  if (riskManager) {
    await upsertSeedAction(prisma, {
      tenantId: tenant.id,
      riskId: risk.id,
      title: "Confirm alternate supplier",
      description: "Seeded overdue action for Sprint 06.",
      assigneeMembershipId: riskManager.id,
      dueAt: daysAgo(2),
    });
  }

  if (employee) {
    const existingEmployeeTask = await prisma.riskAction.findFirst({
      where: { tenantId: tenant.id, riskId: risk.id, title: "Review supplier questionnaire" },
    });
    if (!existingEmployeeTask) {
      await prisma.riskAction.create({
        data: {
          tenantId: tenant.id,
          riskId: risk.id,
          title: "Review supplier questionnaire",
          description: "Seeded employee home task for Sprint 07.",
          assigneeMembershipId: employee.id,
          dueAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
          status: "open",
        },
      });
    }
  }

  const seededByCode = new Map<string, { id: string }>();
  for (const example of SEED_MATRIX_RISKS) {
    const category = categories.get(example.categoryCode);
    if (!category) {
      throw new Error(`Missing seeded category ${example.categoryCode}`);
    }
    const orgUnit = example.orgUnit === "Operations" ? operations : headquarters;
    const ownerMembership = example.orgUnit === "Operations" ? (manager ?? owner) : owner;
    const createdAt = daysAgo(example.daysAgo);
    const seeded = await upsertSeedRisk(prisma, {
      tenantId: tenant.id,
      code: example.code,
      title: example.title,
      description: example.description,
      categoryId: category.id,
      orgUnitId: orgUnit.id,
      ownerMembershipId: ownerMembership.id,
      status: example.status,
      createdAt,
    });
    seededByCode.set(example.code, seeded);
    await upsertSeedAssessment(prisma, {
      tenantId: tenant.id,
      riskId: seeded.id,
      assessmentType: "inherent",
      ...matrixScore(example.inherent.likelihood, example.inherent.impact),
      scoringVersionId: scoringModel.id,
      rationale: `Seeded inherent assessment for ${example.code}.`,
      assessedBy: ownerMembership.id,
      assessedAt: createdAt,
    });
    await upsertSeedAssessment(prisma, {
      tenantId: tenant.id,
      riskId: seeded.id,
      assessmentType: "residual",
      ...matrixScore(example.residual.likelihood, example.residual.impact),
      scoringVersionId: scoringModel.id,
      rationale: `Seeded residual assessment for ${example.code}.`,
      assessedBy: ownerMembership.id,
      assessedAt: createdAt,
    });
  }

  const operationsRisk = seededByCode.get("OPS-001");
  if (manager && operationsRisk) {
    await upsertSeedAction(prisma, {
      tenantId: tenant.id,
      riskId: operationsRisk.id,
      title: "Document handover checklist",
      description: "Seeded overdue Operations action for Sprint 07.",
      assigneeMembershipId: manager.id,
      dueAt: daysAgo(5),
    });
  }

  const complianceRisk = seededByCode.get("COMP-001");
  if (complianceRisk) {
    const existingTreatment = await prisma.riskTreatment.findUnique({
      where: { tenantId_riskId: { tenantId: tenant.id, riskId: complianceRisk.id } },
    });
    if (!existingTreatment) {
      await prisma.riskTreatment.create({
        data: {
          tenantId: tenant.id,
          riskId: complianceRisk.id,
          strategy: "reduce",
          status: "pending",
          submittedById: (riskManager ?? owner).id,
        },
      });
    }
  }
}

type SeedClient = ReturnType<typeof createMigratorClient>;

async function seedModuleCatalog(prisma: SeedClient): Promise<void> {
  for (const entry of MODULE_CATALOG_SEED) {
    await prisma.moduleCatalog.upsert({
      where: { key: entry.key },
      create: {
        key: entry.key,
        version: entry.version,
        dependenciesJson: entry.dependencies,
      },
      update: {
        version: entry.version,
        dependenciesJson: entry.dependencies,
      },
    });
  }
}

async function seedTenantModules(
  prisma: SeedClient,
  tenantId: string,
  entitledModules: string[],
): Promise<void> {
  for (const moduleKey of entitledModules) {
    await prisma.tenantEntitlement.upsert({
      where: { tenantId_moduleKey: { tenantId, moduleKey } },
      create: { tenantId, moduleKey, entitled: true },
      update: { entitled: true },
    });
  }
  await prisma.tenantModule.upsert({
    where: { tenantId_moduleKey: { tenantId, moduleKey: "risk-register" } },
    create: { tenantId, moduleKey: "risk-register", enabled: true },
    update: { enabled: true },
  });
}

async function upsertSeedRisk(
  prisma: SeedClient,
  input: {
    tenantId: string;
    code: string;
    title: string;
    description: string;
    categoryId: string;
    orgUnitId: string;
    ownerMembershipId: string;
    status: "open" | "in_progress";
    createdAt: Date;
  },
) {
  const existing = await prisma.risk.findUnique({
    where: { tenantId_code: { tenantId: input.tenantId, code: input.code } },
  });
  if (existing) {
    return existing;
  }
  return prisma.risk.create({
    data: {
      tenantId: input.tenantId,
      code: input.code,
      title: input.title,
      description: input.description,
      categoryId: input.categoryId,
      orgUnitId: input.orgUnitId,
      ownerMembershipId: input.ownerMembershipId,
      status: input.status,
      createdAt: input.createdAt,
      updatedAt: input.createdAt,
    },
  });
}

async function upsertSeedAssessment(
  prisma: SeedClient,
  input: {
    tenantId: string;
    riskId: string;
    assessmentType: "inherent" | "residual";
    likelihood: number;
    impact: number;
    score: number;
    rating: string;
    scoringVersionId: string;
    rationale: string;
    assessedBy: string;
    assessedAt: Date;
  },
) {
  const existing = await prisma.riskAssessment.findFirst({
    where: {
      tenantId: input.tenantId,
      riskId: input.riskId,
      assessmentType: input.assessmentType,
    },
  });
  if (existing) {
    return existing;
  }
  return prisma.riskAssessment.create({ data: input });
}

async function upsertSeedAction(
  prisma: SeedClient,
  input: {
    tenantId: string;
    riskId: string;
    title: string;
    description: string;
    assigneeMembershipId: string;
    dueAt: Date;
  },
) {
  const existing = await prisma.riskAction.findFirst({
    where: { tenantId: input.tenantId, riskId: input.riskId, title: input.title },
  });
  if (!existing) {
    return prisma.riskAction.create({
      data: {
        ...input,
        status: "open",
      },
    });
  }
  if (existing.status !== "open" || existing.completedAt) {
    return prisma.riskAction.update({
      where: { id: existing.id },
      data: {
        status: "open",
        completedAt: null,
        dueAt: input.dueAt,
        assigneeMembershipId: input.assigneeMembershipId,
      },
    });
  }
  return existing;
}
