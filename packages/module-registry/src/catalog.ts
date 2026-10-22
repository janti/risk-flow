export const MODULE_KEYS = [
  "risk-register",
  "incidents",
  "audits",
  "vendor-risk",
  "continuity",
] as const;

export type ModuleKey = (typeof MODULE_KEYS)[number];

export type ModuleCatalogEntry = {
  key: ModuleKey;
  version: string;
  dependencies: ModuleKey[];
};

export const MODULE_CATALOG: readonly ModuleCatalogEntry[] = [
  { key: "risk-register", version: "1.0.0", dependencies: [] },
  { key: "incidents", version: "1.0.0", dependencies: ["risk-register"] },
  { key: "audits", version: "1.0.0", dependencies: [] },
  { key: "vendor-risk", version: "1.0.0", dependencies: ["risk-register"] },
  { key: "continuity", version: "1.0.0", dependencies: ["risk-register"] },
];

export const MODULE_LABELS: Record<ModuleKey, string> = {
  "risk-register": "Riskirekisteri",
  incidents: "Poikkeamat",
  audits: "Auditoinnit",
  "vendor-risk": "Toimittajariski",
  continuity: "Jatkuvuus",
};

export function isModuleKey(value: string): value is ModuleKey {
  return (MODULE_KEYS as readonly string[]).includes(value);
}

export function getModule(key: string): ModuleCatalogEntry | undefined {
  return MODULE_CATALOG.find((entry) => entry.key === key);
}
