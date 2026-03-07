import { defineCli } from "../../framework/core/definition";
import type {
  FrameworkLogger,
  HostAdapter,
  KernelRuntime,
  RuntimeContext,
} from "../../framework/core/types";
import type { OpenClawCliContext, OpenClawCliProgramLike } from "../../framework/openclaw/adapter";
import type { SessionState } from "../modules/session.module";

export const frameworkCliName = "framework";
export const frameworkStatusSubcommandName = "status";
const frameworkCliDescription = "Framework CLI utilities.";
const statusCliDescription = "Print runtime diagnostics for the convention microkernel.";

type StatusCliResult = {
  diagnostics: RuntimeContext["diagnostics"];
  services: string[];
  beforeAgentStartCount: number;
};

function createStatusCliResult(context: Pick<RuntimeContext, "container" | "diagnostics">): StatusCliResult {
  const sessionState = context.container.resolve<SessionState>("sessionState");

  return {
    diagnostics: context.diagnostics,
    services: context.container.entries().map(([key]) => key),
    beforeAgentStartCount: sessionState.beforeAgentStartCount,
  };
}

function createRuntimeContext(runtime: KernelRuntime): RuntimeContext {
  return {
    config: runtime.container.resolve("config"),
    container: runtime.container,
    diagnostics: runtime.diagnostics,
    logger: runtime.container.resolve<FrameworkLogger>("logger"),
    host: runtime.container.resolve<HostAdapter>("host"),
  };
}

function emitStatusCliResult(result: StatusCliResult, logger?: OpenClawCliContext["logger"]): void {
  const text = JSON.stringify(result, null, 2);
  if (logger?.info) {
    logger.info(text);
    return;
  }
  console.log(text);
}

function executeFrameworkCli(args: string[], context: RuntimeContext): StatusCliResult {
  const [subcommand] = args;

  if (subcommand === undefined || subcommand === frameworkStatusSubcommandName) {
    return createStatusCliResult(context);
  }

  throw new Error(`Unknown CLI subcommand: ${subcommand}`);
}

export function registerStatusCli(params: {
  program: OpenClawCliProgramLike;
  ensureRuntime: () => Promise<KernelRuntime>;
  logger?: OpenClawCliContext["logger"];
}): void {
  const root = params.program.command(frameworkCliName).description(frameworkCliDescription);

  root
    .command(frameworkStatusSubcommandName)
    .description(statusCliDescription)
    .action(async () => {
      const runtime = await params.ensureRuntime();
      const context = createRuntimeContext(runtime);
      const result = createStatusCliResult(context);
      emitStatusCliResult(result, params.logger);
    });
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
