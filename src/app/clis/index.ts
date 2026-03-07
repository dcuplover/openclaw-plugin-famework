import statusCli, { registerStatusCli } from "./status.cli";
import type { AppCliRegistrar } from "./shared";

export { default as statusCli, registerStatusCli } from "./status.cli";
export type { AppCliRegistrationParams, AppCliRegistrar } from "./shared";

export const appCliDefinitions = [statusCli];
export const appCliCommands = appCliDefinitions.map((cli) => cli.name);
export const appCliRegistrars: AppCliRegistrar[] = [registerStatusCli];
