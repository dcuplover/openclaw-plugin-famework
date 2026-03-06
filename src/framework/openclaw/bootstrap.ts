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

interface OpenClawLoggerLike {
  info?: (...args: unknown[]) => void;
  warn?: (...args: unknown[]) => void;
  error?: (...args: unknown[]) => void;
  debug?: (...args: unknown[]) => void;
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

function getLoggerSink(api: OpenClawLikeApi): OpenClawLoggerLike | undefined {
  return api.logger ?? api.log;
}

function createOpenClawLogger(api: OpenClawLikeApi, prefix: string): FrameworkLogger {
  const sink = getLoggerSink(api);

  return {
    info(message, meta) {
      sink?.info?.(`[${prefix}] ${message}`, meta);
      if (!sink?.info) {
        createConsoleLogger(prefix).info(message, meta);
      }
    },
    warn(message, meta) {
      sink?.warn?.(`[${prefix}] ${message}`, meta);
      if (!sink?.warn) {
        createConsoleLogger(prefix).warn(message, meta);
      }
    },
    error(message, meta) {
      sink?.error?.(`[${prefix}] ${message}`, meta);
      if (!sink?.error) {
        createConsoleLogger(prefix).error(message, meta);
      }
    },
    debug(message, meta) {
      sink?.debug?.(`[${prefix}] ${message}`, meta);
      if (!sink?.debug) {
        createConsoleLogger(prefix).debug?.(message, meta);
      }
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
