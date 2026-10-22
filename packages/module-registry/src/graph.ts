export type ModuleGraphEntry = {
  key: string;
  dependencies: string[];
};

/**
 * Returns a cycle path (including the repeated start key) or null if the graph is acyclic.
 */
export function findDependencyCycle(entries: readonly ModuleGraphEntry[]): string[] | null {
  const deps = new Map(entries.map((entry) => [entry.key, entry.dependencies]));
  const visiting = new Set<string>();
  const visited = new Set<string>();
  const stack: string[] = [];

  const visit = (key: string): string[] | null => {
    if (visiting.has(key)) {
      const start = stack.indexOf(key);
      return [...stack.slice(Math.max(start, 0)), key];
    }
    if (visited.has(key)) {
      return null;
    }
    visiting.add(key);
    stack.push(key);
    for (const dependency of deps.get(key) ?? []) {
      const cycle = visit(dependency);
      if (cycle) {
        return cycle;
      }
    }
    stack.pop();
    visiting.delete(key);
    visited.add(key);
    return null;
  };

  for (const key of deps.keys()) {
    const cycle = visit(key);
    if (cycle) {
      return cycle;
    }
  }
  return null;
}

export function assertAcyclicCatalog(entries: readonly ModuleGraphEntry[]): void {
  const unknown = entries.flatMap((entry) =>
    entry.dependencies.filter((dependency) => !entries.some((item) => item.key === dependency)),
  );
  if (unknown.length > 0) {
    throw new Error(`Unknown module dependency: ${unknown[0]}`);
  }
  const cycle = findDependencyCycle(entries);
  if (cycle) {
    throw new Error(`Cyclic module dependency: ${cycle.join(" -> ")}`);
  }
}

export function topologicalOrder(entries: readonly ModuleGraphEntry[]): string[] {
  assertAcyclicCatalog(entries);
  const remaining = new Map(entries.map((entry) => [entry.key, new Set(entry.dependencies)]));
  const ordered: string[] = [];
  while (remaining.size > 0) {
    const ready = [...remaining.entries()].filter(([, deps]) => deps.size === 0).map(([key]) => key);
    if (ready.length === 0) {
      throw new Error("Cyclic module dependency.");
    }
    ready.sort();
    const next = ready[0]!;
    ordered.push(next);
    remaining.delete(next);
    for (const deps of remaining.values()) {
      deps.delete(next);
    }
  }
  return ordered;
}
