export type JsonSchema = Record<string, unknown>;

export interface PluginPackageManifest {
  packageName?: string;
  private?: boolean;
}

export interface PackageJsonFile {
  name: string;
  version: string;
  description?: string;
  private?: boolean;
  main: string;
  types: string;
}

export interface PluginBuildManifest {
  entrySource?: string;
  outputDir?: string;
  registryOutput?: string;
  artifactRoot?: string;
  packageJsonOutput?: string;
  pluginManifestOutput?: string;
}

export interface PluginOpenClawManifest {
  runtime: "node";
  entry: string;
  displayName?: string;
  minHostVersion?: string;
  capabilities?: string[];
}

export interface OpenClawPluginFile {
  id: string;
  name: string;
  version: string;
  description?: string;
  runtime: "node";
  entry: string;
  displayName?: string;
  minHostVersion?: string;
  capabilities?: string[];
  configSchema?: JsonSchema;
}

export interface PluginAppManifest<TConfig = unknown> {
  root: string;
  registryPath?: string;
  defaultConfig?: TConfig;
}

export interface PluginManifest<TConfig = unknown> {
  id: string;
  name: string;
  version: string;
  description?: string;
  configSchema?: JsonSchema;
  openclaw: PluginOpenClawManifest;
  app: PluginAppManifest<TConfig>;
  package?: PluginPackageManifest;
  build?: PluginBuildManifest;
}

export function definePlugin<TConfig = unknown>(
  manifest: PluginManifest<TConfig>
): PluginManifest<TConfig> {
  return manifest;
}

export function toOpenClawPluginJson<TConfig = unknown>(
  manifest: PluginManifest<TConfig>
): OpenClawPluginFile {
  return {
    id: manifest.id,
    name: manifest.name,
    version: manifest.version,
    description: manifest.description,
    runtime: manifest.openclaw.runtime,
    entry: manifest.openclaw.entry,
    displayName: manifest.openclaw.displayName,
    minHostVersion: manifest.openclaw.minHostVersion,
    capabilities: manifest.openclaw.capabilities,
    configSchema: manifest.configSchema,
  };
}

export function toPackageJsonFields<TConfig = unknown>(
  manifest: PluginManifest<TConfig>
): PackageJsonFile {
  const main = manifest.openclaw.entry;
  const types = main.endsWith(".js") ? `${main.slice(0, -3)}.d.ts` : `${main}.d.ts`;

  return {
    name: manifest.package?.packageName ?? manifest.id,
    version: manifest.version,
    description: manifest.description,
    private: manifest.package?.private,
    main,
    types,
  };
}
