export type JsonSchema = Record<string, unknown>;

export interface OpenClawChannelMetadata {
  id: string;
  label: string;
  selectionLabel?: string;
  detailLabel?: string;
  docsPath?: string;
  docsLabel?: string;
  blurb?: string;
  order?: number;
  aliases?: string[];
  preferOver?: string[];
  systemImage?: string;
  quickstartAllowFrom?: boolean;
}

export interface OpenClawInstallMetadata {
  npmSpec?: string;
  localPath?: string;
  defaultChoice?: "npm" | "local";
}

export interface OpenClawPackageMetadata {
  extensions?: string[];
  channel?: OpenClawChannelMetadata;
  install?: OpenClawInstallMetadata;
}

export interface PluginPackageManifest {
  packageName?: string;
  private?: boolean;
  type?: string;
}

export interface PackageJsonFile {
  name: string;
  version: string;
  description?: string;
  private?: boolean;
  type?: string;
  main: string;
  types: string;
  openclaw: OpenClawPackageMetadata;
}

export interface PluginBuildManifest {
  entrySource?: string;
  outputDir?: string;
  registryOutput?: string;
  artifactRoot?: string;
  artifactEntry?: string;
  packageJsonOutput?: string;
  pluginManifestOutput?: string;
}

export interface OpenClawPluginFile {
  id: string;
  configSchema: JsonSchema;
  name?: string;
  description?: string;
  version?: string;
  kind?: string;
  channels?: string[];
  providers?: string[];
  skills?: string[];
  uiHints?: Record<string, unknown>;
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
  kind?: string;
  channels?: string[];
  providers?: string[];
  skills?: string[];
  uiHints?: Record<string, unknown>;
  configSchema: JsonSchema;
  openclaw?: Omit<OpenClawPackageMetadata, "extensions">;
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
    configSchema: manifest.configSchema,
    name: manifest.name,
    description: manifest.description,
    version: manifest.version,
    kind: manifest.kind,
    channels: manifest.channels,
    providers: manifest.providers,
    skills: manifest.skills,
    uiHints: manifest.uiHints,
  };
}

export function toPackageJsonFields<TConfig = unknown>(
  manifest: PluginManifest<TConfig>
): PackageJsonFile {
  const main = manifest.build?.artifactEntry ?? "./index.js";
  const types = main.endsWith(".js") ? `${main.slice(0, -3)}.d.ts` : `${main}.d.ts`;

  return {
    name: manifest.package?.packageName ?? manifest.id,
    version: manifest.version,
    description: manifest.description,
    private: manifest.package?.private,
    type: manifest.package?.type,
    main,
    types,
    openclaw: {
      extensions: [main],
      channel: manifest.openclaw?.channel,
      install: manifest.openclaw?.install,
    },
  };
}
