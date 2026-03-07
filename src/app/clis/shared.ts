import type { KernelRuntime } from "../../framework/core/types";
import type { OpenClawCliContext, OpenClawCliProgramLike } from "../../framework/openclaw/adapter";

export interface AppCliRegistrationParams {
  program: OpenClawCliProgramLike;
  ensureRuntime: () => Promise<KernelRuntime>;
  logger?: OpenClawCliContext["logger"];
}

export type AppCliRegistrar = (params: AppCliRegistrationParams) => void;

export interface AppCliSubcommandDefinition {
  name: string;
  description: string;
  action: (params: AppCliRegistrationParams) => Promise<void> | void;
}

export interface AppCliGroupDefinition {
  name: string;
  description: string;
  subcommands: AppCliSubcommandDefinition[];
}

export function emitCliJson(value: unknown, logger?: OpenClawCliContext["logger"]): void {
  const text = JSON.stringify(value, null, 2);

  if (logger?.info) {
    logger.info(text);
    return;
  }

  console.log(text);
}

export function registerCliGroup(params: AppCliRegistrationParams, group: AppCliGroupDefinition): void {
  const root = params.program.command(group.name).description(group.description);

  for (const subcommand of group.subcommands) {
    root
      .command(subcommand.name)
      .description(subcommand.description)
      .action(async () => {
        await subcommand.action(params);
      });
  }
}