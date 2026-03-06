import type {
  FrameworkLogger,
  HostAdapter,
  HostCommandRegistration,
  HostHookRegistration,
  HostToolRegistration,
} from "../core/types";

export interface OpenClawLikeApi {
  registerTool(definition: unknown, meta?: unknown): void;
  registerCli(factory: (context: { commands: HostCommandRegistration[] }) => void): void;
  on(event: string, handler: (payload: unknown) => Promise<void> | void): void;
  log?: {
    info?: (...args: unknown[]) => void;
    warn?: (...args: unknown[]) => void;
    error?: (...args: unknown[]) => void;
  };
}

export function createOpenClawAdapter(api: OpenClawLikeApi, logger?: FrameworkLogger): HostAdapter {
  const bufferedCommands: HostCommandRegistration[] = [];

  return {
    registerTool(tool: HostToolRegistration): void {
      api.registerTool(
        {
          name: tool.name,
          description: tool.description,
          parameters: tool.schema ?? {},
          execute: async (_toolCallId: string, params: Record<string, unknown>) => tool.execute(params),
        },
        { name: tool.name }
      );
      logger?.info("Registered OpenClaw tool", { name: tool.name });
    },
    registerHook(hook: HostHookRegistration): void {
      api.on(hook.event, hook.handler);
      logger?.info("Registered OpenClaw hook", { event: hook.event, priority: hook.priority });
    },
    registerCommand(command: HostCommandRegistration): void {
      bufferedCommands.push(command);
      api.registerCli(({ commands }) => {
        commands.push(...bufferedCommands);
      });
      logger?.info("Registered OpenClaw command", { name: command.name });
    },
  };
}
