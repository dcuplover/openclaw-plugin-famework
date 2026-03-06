import type {
  HostAdapter,
  HostCommandRegistration,
  HostHookRegistration,
  HostToolRegistration,
} from "../framework/core/types";

export class MockHostAdapter implements HostAdapter {
  private readonly tools = new Map<string, HostToolRegistration>();
  private readonly commands = new Map<string, HostCommandRegistration>();
  private readonly hooks = new Map<string, HostHookRegistration[]>();

  registerTool(tool: HostToolRegistration): void {
    this.tools.set(tool.name, tool);
  }

  registerHook(hook: HostHookRegistration): void {
    const hooks = this.hooks.get(hook.event) ?? [];
    hooks.push(hook);
    hooks.sort((left, right) => right.priority - left.priority);
    this.hooks.set(hook.event, hooks);
  }

  registerCommand(command: HostCommandRegistration): void {
    this.commands.set(command.name, command);
  }

  async emit(event: string, payload: unknown): Promise<void> {
    const hooks = this.hooks.get(event) ?? [];
    for (const hook of hooks) {
      await hook.handler(payload);
    }
  }

  async invokeTool(name: string, params: Record<string, unknown>): Promise<unknown> {
    const tool = this.tools.get(name);
    if (!tool) {
      throw new Error(`Tool not found: ${name}`);
    }
    return tool.execute(params);
  }

  async runCommand(name: string, args: string[]): Promise<unknown> {
    const command = this.commands.get(name);
    if (!command) {
      throw new Error(`Command not found: ${name}`);
    }
    return command.execute(args);
  }
}
