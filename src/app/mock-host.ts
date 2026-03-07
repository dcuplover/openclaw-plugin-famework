import type {
  HostAdapter,
  HostCliRegistration,
  HostCommandRegistration,
  HostHookRegistration,
  HostToolRegistration,
} from "../framework/core/types";

export class MockHostAdapter implements HostAdapter {
  private readonly tools = new Map<string, HostToolRegistration>();
  private readonly clis = new Map<string, HostCliRegistration>();
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

  registerCli(cli: HostCliRegistration): void {
    this.clis.set(cli.name, cli);
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

  async runCli(name: string, args: string[]): Promise<unknown> {
    const cli = this.clis.get(name);
    if (!cli) {
      throw new Error(`CLI not found: ${name}`);
    }
    return cli.execute(args);
  }

  async runCommand(name: string, args?: string): Promise<{ text: string }> {
    const command = this.commands.get(name);
    if (!command) {
      throw new Error(`Command not found: ${name}`);
    }
    return command.handler(args);
  }
}
