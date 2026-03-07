import { defineCli } from "../../src/framework/core/definition";
import type { KernelRuntime, RuntimeContext } from "../../src/framework/core/types";
import {
  emitCliJson,
  registerCliGroup,
  type AppCliGroupDefinition,
  type AppCliRegistrationParams,
} from "../../src/app/clis/shared";

// 根命令名。终端里会表现为 `doctor`。
export const doctorCliName = "doctor";

// 子命令名。终端里会表现为 `doctor check`。
export const doctorCheckSubcommandName = "check";

const doctorCliDescription = "Inspect plugin runtime health.";
const doctorCheckDescription = "Run runtime health checks and print diagnostics.";

// CLI 输出结果建议先定义成一个独立类型，后续扩展字段会更稳。
type DoctorCliResult = {
  ok: boolean;
  loadedModules: string[];
  loadedTools: string[];
  loadedHooks: string[];
  loadedCommands: string[];
  failureCount: number;
};

// 这个函数只负责“从运行时上下文读取信息并组装结果”。
// 不要在这里做 CLI 注册，也不要在这里直接打印日志。
function createDoctorCliResult(source: Pick<RuntimeContext, "diagnostics">): DoctorCliResult {
  return {
    ok: source.diagnostics.failures.length === 0,
    loadedModules: source.diagnostics.loadedModules,
    loadedTools: source.diagnostics.loadedTools,
    loadedHooks: source.diagnostics.loadedHooks,
    loadedCommands: source.diagnostics.loadedCommands,
    failureCount: source.diagnostics.failures.length,
  };
}

// 这是内核层 CLI 的执行入口。
// 它给 mock host 和微内核内部注册复用，所以返回值应该是纯结果，不直接输出到终端。
function executeDoctorCli(args: string[], context: RuntimeContext): DoctorCliResult {
  const [subcommand] = args;

  if (subcommand === undefined || subcommand === doctorCheckSubcommandName) {
    return createDoctorCliResult(context);
  }

  throw new Error(`Unknown CLI subcommand: ${subcommand}`);
}

// 这是 OpenClaw 注册层的 action。
// 这里的职责很单纯：等待 runtime、生成结果、把结果输出给终端用户。
async function runRegisteredDoctorCheck(params: {
  ensureRuntime: () => Promise<KernelRuntime>;
  logger?: AppCliRegistrationParams["logger"];
}): Promise<void> {
  const runtime = await params.ensureRuntime();
  const context: Pick<RuntimeContext, "diagnostics"> = {
    diagnostics: runtime.diagnostics,
  };

  emitCliJson(createDoctorCliResult(context), params.logger);
}

// 这里描述 Commander/OpenClaw 那一层的命令树结构。
// 如果后面还要加 `doctor inspect`、`doctor repair`，就在 subcommands 里继续追加。
const doctorCliRegistration: AppCliGroupDefinition = {
  name: doctorCliName,
  description: doctorCliDescription,
  subcommands: [
    {
      name: doctorCheckSubcommandName,
      description: doctorCheckDescription,
      action: runRegisteredDoctorCheck,
    },
  ],
};

// 这个导出函数专门给 `src/app/clis/index.ts` 聚合调用。
export function registerDoctorCli(params: AppCliRegistrationParams): void {
  registerCliGroup(params, doctorCliRegistration);
}

// 默认导出的 defineCli(...) 是内核层定义。
// 你可以把它理解为“框架内部登记的 CLI 版本”。
const doctorCli = defineCli({
  kind: "cli",
  name: doctorCliName,
  description: doctorCliDescription,
  execute(args, context) {
    return executeDoctorCli(args, context);
  },
});

export default doctorCli;

/*
接入步骤：
1. 把本文件复制到 `src/app/clis/doctor.cli.ts`
2. 根据需要修改命令名、描述和结果字段
3. 在 `src/app/clis/index.ts` 中导入并登记：
   - `doctorCli`
   - `registerDoctorCli`
4. 运行 `npm test`
*/
