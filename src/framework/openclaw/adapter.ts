import type {
  CliDefinition,
  CommandInvocationContext,
  FrameworkLogger,
  HostAdapter,
  HostCliRegistration,
  HostCommandRegistration,
  HostHookRegistration,
  HostToolRegistration,
  KernelRuntime,
  RuntimeContext,
} from "../core/types";

export interface OpenClawCliCommandLike {
  command(name: string): OpenClawCliCommandLike;
  description(text: string): OpenClawCliCommandLike;
  action(handler: (...args: unknown[]) => unknown): OpenClawCliCommandLike;
  option?(flags: string, description?: string, defaultValue?: unknown): OpenClawCliCommandLike;
  alias?(name: string): OpenClawCliCommandLike;
}

export interface OpenClawCliProgramLike {
  command(name: string): OpenClawCliCommandLike;
}

export interface OpenClawCliContext {
  program: OpenClawCliProgramLike;
  logger?: {
    info?: (...args: unknown[]) => void;
    warn?: (...args: unknown[]) => void;
    error?: (...args: unknown[]) => void;
  };
}

export interface OpenClawLikeApi {
  registerTool(definition: unknown, meta?: unknown): void;
  registerCli(factory: (context: OpenClawCliContext) => void, meta?: { commands?: string[] }): void;
  registerCommand(definition: {
    name: string;
    description?: string;
    acceptsArgs?: boolean;
    requireAuth?: boolean;
    handler: (commandContext?: CommandInvocationContext) => Promise<{ text: string }> | { text: string };
  }): void;
  on(
    event: string,
    handler: (payload: unknown) => Promise<void> | void,
    opts?: { name?: string; description?: string; priority?: number }
  ): void;
  pluginConfig?: Record<string, unknown>;
  logger?: {
    info?: (...args: unknown[]) => void;
    warn?: (...args: unknown[]) => void;
    error?: (...args: unknown[]) => void;
    debug?: (...args: unknown[]) => void;
  };
  log?: {
    info?: (...args: unknown[]) => void;
    warn?: (...args: unknown[]) => void;
    error?: (...args: unknown[]) => void;
  };
}

interface CliLoggerLike {
  info?: (message: string, meta?: Record<string, unknown>) => void;
  warn?: (message: string, meta?: Record<string, unknown>) => void;
  error?: (message: string, meta?: Record<string, unknown>) => void;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * OpenClaw expects tool results in MCP-standard format: { content: [{ type, text }] }.
 * This normalizes arbitrary tool return values into that shape.
 */
function normalizeToolResult(result: unknown): { content: Array<{ type: string; text: string }>; details?: unknown } {
  if (isRecord(result) && Array.isArray(result.content)) {
    return result as { content: Array<{ type: string; text: string }>; details?: unknown };
  }
  if (isRecord(result) && typeof result.type === "string" && typeof result.text === "string") {
    return { content: [{ type: result.type, text: result.text }] };
  }
  const text = typeof result === "string" ? result : JSON.stringify(result, null, 2);
  return { content: [{ type: "text", text }] };
}

function normalizeCliArgs(actionArgs: unknown[]): string[] {
  const normalized: string[] = [];

  for (const arg of actionArgs) {
    if (typeof arg === "string" || typeof arg === "number" || typeof arg === "boolean") {
      normalized.push(String(arg));
      continue;
    }

    if (!isRecord(arg)) {
      continue;
    }

    // Commander commonly appends option bags and command instances to action args.
    if (typeof arg.name === "function" || typeof arg.opts === "function" || typeof arg.parent === "object") {
      continue;
    }

    for (const [key, value] of Object.entries(arg)) {
      if (value === undefined || value === false) {
        continue;
      }

      normalized.push(`--${key}`);
      if (value !== true) {
        normalized.push(String(value));
      }
    }
  }

  return normalized;
}

function emitCommandResult(result: unknown, logger?: CliLoggerLike | FrameworkLogger): void {
  if (result === undefined) {
    return;
  }

  if (typeof result === "string") {
    logger?.info?.(result);
    return;
  }

  if (isRecord(result) && Array.isArray(result.content)) {
    const texts = result.content
      .filter((entry): entry is { type?: unknown; text?: unknown } => isRecord(entry))
      .map((entry) => entry.text)
      .filter((text): text is string => typeof text === "string");

    if (texts.length > 0) {
      logger?.info?.(texts.join("\n"));
      return;
    }
  }

  logger?.info?.(JSON.stringify(result, null, 2));
}

function normalizeCommandContext(commandContext?: CommandInvocationContext): CommandInvocationContext {
  return {
    senderId: commandContext?.senderId,
    channel: commandContext?.channel,
    isAuthorizedSender: commandContext?.isAuthorizedSender,
    args: commandContext?.args,
    commandBody: commandContext?.commandBody,
    config: commandContext?.config,
  };
}

export function createOpenClawAdapter(api: OpenClawLikeApi, logger?: FrameworkLogger): HostAdapter {
  return {
    registerTool(tool: HostToolRegistration): void {
      const schema = tool.schema && Object.keys(tool.schema).length > 0
        ? tool.schema
        : { type: "object", properties: {} };

      // Use ToolFactory pattern (function) to match OpenClaw's preferred registration style.
      api.registerTool(
        (_toolCtx: unknown) => ({
          name: tool.name,
          label: tool.description,
          description: tool.description,
          parameters: schema,
          async execute(_toolCallId: string, params: Record<string, unknown>) {
            const result = await tool.execute(params);
            return normalizeToolResult(result);
          },
        }),
        { name: tool.name }
      );
      logger?.info("Registered OpenClaw tool", { name: tool.name });
    },
    registerHook(hook: HostHookRegistration): void {
      api.on(hook.event, hook.handler, {
        name: hook.name,
        description: hook.description,
        priority: hook.priority,
      });
      logger?.info("Registered OpenClaw hook", {
        name: hook.name,
        event: hook.event,
        priority: hook.priority,
      });
    },
    registerCli(cli: HostCliRegistration): void {
      api.registerCli(
        ({ program, logger: cliLogger }) => {
          program
            .command(cli.name)
            .description(cli.description)
            .action(async (...actionArgs: unknown[]) => {
              const normalizedArgs = normalizeCliArgs(actionArgs);
              const result = await cli.execute(normalizedArgs);
              emitCommandResult(result, cliLogger ?? logger);
            });
        },
        { commands: [cli.name] }
      );
      logger?.info("Registered OpenClaw CLI", { name: cli.name });
    },
    registerCommand(command: HostCommandRegistration): void {
      api.registerCommand({
        name: command.name,
        description: command.description,
        acceptsArgs: command.acceptsArgs ?? false,
        requireAuth: command.requireAuth ?? true,
        handler: async (commandContext) => command.handler(normalizeCommandContext(commandContext)),
      });
      logger?.info("Registered OpenClaw command", { name: command.name });
    },
  };
}

/**
 * Register a CLI definition synchronously with OpenClaw's Commander program.
 *
 * OpenClaw may not `await` the async `register(api)` call, so `api.registerCli`
 * must be invoked synchronously — before any `await` — to ensure Commander
 * recognises the command at startup. The action handler defers execution until
 * the kernel's bootstrap promise resolves.
 */
export function eagerRegisterCli<TConfig = unknown>(
  api: OpenClawLikeApi,
  cliDef: CliDefinition<TConfig>,
  runtimePromise: Promise<KernelRuntime<TConfig>>,
  logger?: FrameworkLogger
): void {
  api.registerCli(
    ({ program, logger: cliLogger }) => {
      program
        .command(cliDef.name)
        .description(cliDef.description ?? "")
        .action(async (...actionArgs: unknown[]) => {
          const runtime = await runtimePromise;
          const context: RuntimeContext<TConfig> = {
            config: runtime.container.resolve<TConfig>("config"),
            container: runtime.container,
            diagnostics: runtime.diagnostics,
            logger: runtime.container.resolve<FrameworkLogger>("logger"),
            host: runtime.container.resolve<HostAdapter>("host"),
          };
          const normalizedArgs = normalizeCliArgs(actionArgs);
          const result = await cliDef.execute(normalizedArgs, context);
          emitCommandResult(result, cliLogger ?? logger);
        });
    },
    { commands: [cliDef.name] }
  );
  logger?.info("Eager-registered OpenClaw CLI", { name: cliDef.name });
}
