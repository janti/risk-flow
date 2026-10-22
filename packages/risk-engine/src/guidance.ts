import type { MessageKey } from "@riskflow/shared";

export type GuidancePack = "ohs" | "cyber" | "compliance" | "finance" | "generic";

export type GuidanceFramework = {
  id: string;
  href: string;
  labelKey: MessageKey;
};

export const GUIDANCE_FRAMEWORKS: readonly GuidanceFramework[] = [
  {
    id: "iso31000",
    href: "https://www.iso.org/standard/65694.html",
    labelKey: "guidance.framework.iso31000",
  },
  {
    id: "iso27001",
    href: "https://www.iso.org/standard/27001",
    labelKey: "guidance.framework.iso27001",
  },
  {
    id: "iso27005",
    href: "https://www.iso.org/standard/80585.html",
    labelKey: "guidance.framework.iso27005",
  },
  {
    id: "iso45001",
    href: "https://www.iso.org/standard/63787.html",
    labelKey: "guidance.framework.iso45001",
  },
  {
    id: "nist-csf",
    href: "https://www.nist.gov/cyberframework",
    labelKey: "guidance.framework.nistCsf",
  },
  {
    id: "tyosuojelu",
    href: "https://tyosuojelu.fi/tyosuojelu-tyopaikalla/vaarojen-arviointi",
    labelKey: "guidance.framework.tyosuojelu",
  },
  {
    id: "ttk",
    href: "https://ttk.fi/tyoturvallisuus/vastuut-tyopaikalla/vaarojen-arviointi/",
    labelKey: "guidance.framework.ttk",
  },
] as const;

export type CategoryGuidance = {
  pack: GuidancePack;
  frameworkIds: readonly string[];
  identifyKey: MessageKey;
  promptsKey: MessageKey;
  treatKey: MessageKey;
  templateKey: MessageKey;
};

const PACKS: Record<GuidancePack, CategoryGuidance> = {
  ohs: {
    pack: "ohs",
    frameworkIds: ["iso31000", "iso45001", "tyosuojelu", "ttk"],
    identifyKey: "guidance.pack.ohs.identify",
    promptsKey: "guidance.pack.ohs.prompts",
    treatKey: "guidance.pack.ohs.treat",
    templateKey: "guidance.pack.ohs.template",
  },
  cyber: {
    pack: "cyber",
    frameworkIds: ["iso31000", "iso27001", "iso27005", "nist-csf"],
    identifyKey: "guidance.pack.cyber.identify",
    promptsKey: "guidance.pack.cyber.prompts",
    treatKey: "guidance.pack.cyber.treat",
    templateKey: "guidance.pack.cyber.template",
  },
  compliance: {
    pack: "compliance",
    frameworkIds: ["iso31000"],
    identifyKey: "guidance.pack.compliance.identify",
    promptsKey: "guidance.pack.compliance.prompts",
    treatKey: "guidance.pack.compliance.treat",
    templateKey: "guidance.pack.compliance.template",
  },
  finance: {
    pack: "finance",
    frameworkIds: ["iso31000"],
    identifyKey: "guidance.pack.finance.identify",
    promptsKey: "guidance.pack.finance.prompts",
    treatKey: "guidance.pack.finance.treat",
    templateKey: "guidance.pack.finance.template",
  },
  generic: {
    pack: "generic",
    frameworkIds: ["iso31000"],
    identifyKey: "guidance.pack.generic.identify",
    promptsKey: "guidance.pack.generic.prompts",
    treatKey: "guidance.pack.generic.treat",
    templateKey: "guidance.pack.generic.template",
  },
};

const CODE_PACKS: Record<string, GuidancePack> = {
  OPS: "ohs",
  OHS: "ohs",
  HSE: "ohs",
  CYBER: "cyber",
  CYB: "cyber",
  ISMS: "cyber",
  INFOSEC: "cyber",
  COMP: "compliance",
  COMPLIANCE: "compliance",
  FIN: "finance",
  FINANCE: "finance",
};

export function guidancePackForCategory(code: string): GuidancePack {
  return CODE_PACKS[code.trim().toUpperCase()] ?? "generic";
}

export function categoryGuidance(code: string): CategoryGuidance {
  return PACKS[guidancePackForCategory(code)];
}

export function frameworksForCategory(code: string): GuidanceFramework[] {
  const pack = categoryGuidance(code);
  return GUIDANCE_FRAMEWORKS.filter((framework) => pack.frameworkIds.includes(framework.id));
}

export function likelihoodScaleKey(grid: 3 | 5, value: number): MessageKey {
  const key = `guidance.likelihood.${grid}.${value}`;
  return key as MessageKey;
}

export function impactScaleKey(grid: 3 | 5, value: number): MessageKey {
  const key = `guidance.impact.${grid}.${value}`;
  return key as MessageKey;
}

export function treatmentStrategyKey(strategy: "avoid" | "reduce" | "share" | "accept"): MessageKey {
  return `guidance.treatment.${strategy}` as MessageKey;
}
