export type JsonSchema = Record<string, unknown>;

export interface PluginPackageManifest {
  packageName?: string;
  private?: boolean;
}

export interface PluginBuildManifest {
  entrySource?: string;
  outputDir?: string;
  registryOutput?: string;
  pluginManifestOutput?: string;
}

export interface PluginOpenClawManifest {
  runtime: "node";
  entry: string;
  displayName?: string;
  minHostVersion?: string;
  capabilities?: string[];
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
