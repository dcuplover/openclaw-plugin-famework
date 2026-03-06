import type {
  CommandDefinition,
  HookDefinition,
  ModuleDefinition,
  ToolDefinition,
} from "./types";

export function defineModule<TConfig = unknown>(
  definition: ModuleDefinition<TConfig>
): ModuleDefinition<TConfig> {
  return definition;
}

export function defineTool<TConfig = unknown>(
  definition: ToolDefinition<TConfig>
): ToolDefinition<TConfig> {
  return definition;
}

export function defineHook<TConfig = unknown>(
  definition: HookDefinition<TConfig>
): HookDefinition<TConfig> {
  return definition;
}

export function defineCommand<TConfig = unknown>(
  definition: CommandDefinition<TConfig>
): CommandDefinition<TConfig> {
  return definition;
}
