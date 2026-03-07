import { defineCli } from "../../framework/core/definition";
import type {
  KernelRuntime,
  RuntimeContext,
} from "../../framework/core/types";
import type { SessionState } from "../modules/session.module";
import {
  emitCliJson,
  registerCliGroup,
  type AppCliGroupDefinition,
  type AppCliRegistrationParams,
} from "./shared";

export const frameworkCliName = "framework";
export const frameworkStatusSubcommandName = "status";
const frameworkCliDescription = "Framework CLI utilities.";
const statusCliDescription = "Print runtime diagnostics for the convention microkernel.";

type StatusCliResult = {
  diagnostics: RuntimeContext["diagnostics"];
  services: string[];
  beforeAgentStartCount: number;
};

type StatusSnapshotSource = Pick<KernelRuntime, "container" | "diagnostics">;

function readSessionState(source: StatusSnapshotSource): SessionState {
  return source.container.resolve<SessionState>("sessionState");
}

function listRegisteredServices(source: StatusSnapshotSource): string[] {
  return source.container.entries().map(([key]) => key);
}

function createStatusCliResult(source: StatusSnapshotSource): StatusCliResult {
  const sessionState = readSessionState(source);

  return {
    diagnostics: source.diagnostics,
    services: listRegisteredServices(source),
    beforeAgentStartCount: sessionState.beforeAgentStartCount,
  };
}

function executeFrameworkCli(args: string[], context: RuntimeContext): StatusCliResult {
  const [subcommand] = args;

  if (subcommand === undefined || subcommand === frameworkStatusSubcommandName) {
    return createStatusCliResult(context);
  }

  throw new Error(`Unknown CLI subcommand: ${subcommand}`);
}

async function runRegisteredStatusCli(params: {
  ensureRuntime: () => Promise<KernelRuntime>;
  logger?: AppCliRegistrationParams["logger"];
}): Promise<void> {
  const runtime = await params.ensureRuntime();
  const result = createStatusCliResult(runtime);
  emitCliJson(result, params.logger);
}

const frameworkCliRegistration: AppCliGroupDefinition = {
  name: frameworkCliName,
  description: frameworkCliDescription,
  subcommands: [
    {
      name: frameworkStatusSubcommandName,
      description: statusCliDescription,
      action: runRegisteredStatusCli,
    },
  ],
};

export function registerStatusCli(params: AppCliRegistrationParams): void {
  registerCliGroup(params, frameworkCliRegistration);
}

const statusCli = defineCli({
  kind: "cli",
  name: frameworkCliName,
  description: frameworkCliDescription,
  execute(args, context) {
    return executeFrameworkCli(args, context);
  },
});

export default statusCli;
