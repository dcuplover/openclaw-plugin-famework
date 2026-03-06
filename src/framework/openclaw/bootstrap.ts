import { bootstrapMicrokernel } from "../core/kernel";
import { createConsoleLogger } from "../core/logger";
import type { BootstrapOptions, DefinitionRegistry, FrameworkLogger, KernelRuntime } from "../core/types";
import type { PluginManifest } from "../plugin/manifest";
import { createOpenClawAdapter, type OpenClawLikeApi } from "./adapter";

export interface OpenClawPluginEntrypointOptions<TConfig = unknown> {
  api: OpenClawLikeApi;
  config?: Partial<TConfig>;
  logger?: FrameworkLogger;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function mergeConfig<TConfig>(defaultConfig: TConfig | undefined, overrideConfig: Partial<TConfig> | undefined): TConfig {
  if (overrideConfig === undefined) {
    return (defaultConfig ?? {}) as TConfig;
  }

  if (isRecord(defaultConfig) && isRecord(overrideConfig)) {
    return { ...defaultConfig, ...overrideConfig } as TConfig;
  }

  return overrideConfig as TConfig;
}

function createOpenClawLogger(api: OpenClawLikeApi, prefix: string): FrameworkLogger {
  return {
    info(message, meta) {
      api.log?.info?.(`[${prefix}] ${message}`, meta);
      if (!api.log?.info) {
        createConsoleLogger(prefix).info(message, meta);
      }
    },
    warn(message, meta) {
      api.log?.warn?.(`[${prefix}] ${message}`, meta);
      if (!api.log?.warn) {
        createConsoleLogger(prefix).warn(message, meta);
      }
    },
    error(message, meta) {
      api.log?.error?.(`[${prefix}] ${message}`, meta);
      if (!api.log?.error) {
        createConsoleLogger(prefix).error(message, meta);
      }
    },
    debug(message, meta) {
      createConsoleLogger(prefix).debug?.(message, meta);
    },
  };
}

export function bootstrapOpenClawPlugin<TConfig = unknown>(
  manifest: PluginManifest<TConfig>,
  registry: DefinitionRegistry<TConfig>
): (options: OpenClawPluginEntrypointOptions<TConfig>) => Promise<KernelRuntime<TConfig>> {
  return async function openClawPluginEntrypoint(
    options: OpenClawPluginEntrypointOptions<TConfig>
  ): Promise<KernelRuntime<TConfig>> {
    const logger = options.logger ?? createOpenClawLogger(options.api, manifest.id);
    const host = createOpenClawAdapter(options.api, logger);
    const config = mergeConfig(manifest.app.defaultConfig, options.config);

    const bootstrapOptions: BootstrapOptions<TConfig> = {
      appId: manifest.id,
      config,
      registry,
      host,
      logger,
    };

    return bootstrapMicrokernel(bootstrapOptions);
  };
}
