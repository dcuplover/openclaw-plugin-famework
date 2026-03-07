import {
  appCliCommands,
  appCliRegistrars,
  type AppCliRegistrationParams,
} from "./clis";

export { appCliCommands };

export function registerAppCli(params: AppCliRegistrationParams): void {
  for (const registerCli of appCliRegistrars) {
    registerCli(params);
  }
}