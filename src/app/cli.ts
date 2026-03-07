import type { KernelRuntime } from "../framework/core/types";
import type { OpenClawCliContext, OpenClawCliProgramLike } from "../framework/openclaw/adapter";
import statusCli, { registerStatusCli } from "./clis/status.cli";

export const appCliCommands = [statusCli.name];

export function registerAppCli(params: {
  program: OpenClawCliProgramLike;
  ensureRuntime: () => Promise<KernelRuntime>;
  logger?: OpenClawCliContext["logger"];
}): void {
  registerStatusCli(params);
}