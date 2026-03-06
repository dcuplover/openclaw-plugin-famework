import type {
  FrameworkLogger,
  HostAdapter,
  HostCommandRegistration,
  HostHookRegistration,
  HostToolRegistration,
} from "../core/types";

export interface OpenClawCliCommandLike {
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
  on(event: string, handler: (payload: unknown) => Promise<void> | void): void;
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
      api.on(hook.event, hook.handler);
      logger?.info("Registered OpenClaw hook", { event: hook.event, priority: hook.priority });
    },
    registerCommand(command: HostCommandRegistration): void {
      api.registerCli(
        ({ program, logger: cliLogger }) => {
          program
            .command(command.name)
            .description(command.description)
            .action(async (...actionArgs: unknown[]) => {
              const normalizedArgs = normalizeCliArgs(actionArgs);
              const result = await command.execute(normalizedArgs);
              emitCommandResult(result, cliLogger ?? logger);
            });
        },
        { commands: [command.name] }
      );
      logger?.info("Registered OpenClaw command", { name: command.name });
    },
  };
}
