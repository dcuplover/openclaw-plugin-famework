import type { DefinitionLoader } from "./types";

export async function loadDefinitions<T>(
  loaders: Array<DefinitionLoader<T>>
): Promise<T[]> {
  const resolved: T[] = [];

  for (const load of loaders) {
    const moduleValue = await load();
    const definition =
      typeof moduleValue === "object" && moduleValue !== null && "default" in moduleValue
        ? (moduleValue.default as T)
        : (moduleValue as T);
    resolved.push(definition);
  }

  return resolved;
}
