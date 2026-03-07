# 新增 CLI 开发指南

这份文档专门说明：在当前仓库结构下，如何新增一个新的 CLI，以及相关代码应该放在哪里。

如果你只想先记住一句话，请记住这一句：

`一个新的 CLI = 新建一个 src/app/clis/*.cli.ts 文件 + 在 src/app/clis/index.ts 里登记。`

如果你想直接看一个带注释的完整模板，可以参考：

- `docs/exp/doctor.cli.example.ts`

## 1. 先理解当前 CLI 分层

当前仓库里，CLI 不是只有一层，而是两层一起工作的：

1. 内核层 CLI
   通过 `defineCli({...})` 定义，给微内核和 mock host 使用。

2. OpenClaw 注册层 CLI
   通过 `registerStatusCli()` 这类函数，把命令同步挂到 `api.registerCli(({ program }) => ...)` 上。

这两层都围绕同一个功能，所以通常放在同一个 `*.cli.ts` 文件里。

当前相关文件分工如下：

- `src/app/clis/status.cli.ts`
  一个具体 CLI 的功能文件。
- `src/app/clis/shared.ts`
  多个 CLI 共用的类型、输出工具和注册 helper。
- `src/app/clis/index.ts`
  `clis/` 目录聚合入口，统一登记有哪些 CLI。
- `src/app/cli.ts`
  app 级桥接层，遍历所有 CLI registrar。
- `src/app/index.ts`
  插件入口，在 OpenClaw 启动时同步注册 CLI。

## 2. 开发一个新 CLI 时，代码应该放在哪里

### 放在 `src/app/clis/*.cli.ts` 的内容

这里放“某一个具体 CLI 功能”的代码，例如：

- 命令名常量
- 描述常量
- 返回结果类型
- 结果组装函数
- 内核执行函数
- OpenClaw 注册函数
- `defineCli({...})` 默认导出

例如：

- `src/app/clis/status.cli.ts`
- 未来可以新增 `src/app/clis/doctor.cli.ts`
- 未来也可以新增 `src/app/clis/project.cli.ts`

### 放在 `src/app/clis/shared.ts` 的内容

只有当两个或更多 CLI 都会复用时，才放这里，例如：

- 共享类型
- JSON 输出 helper
- 根命令 + 子命令注册 helper

不要把某个 CLI 私有的小函数过早抽到这里。

### 放在 `src/app/clis/index.ts` 的内容

这里专门做聚合和登记，例如：

- 导出具体 CLI
- 维护 `appCliDefinitions`
- 维护 `appCliCommands`
- 维护 `appCliRegistrars`

以后新增 CLI，最重要的一步就是记得更新这里。

## 3. 新增 CLI 的标准步骤

下面是一套推荐固定流程。

### 第 1 步：创建新文件

例如你要新增一个 `doctor` CLI，可以创建：

```text
src/app/clis/doctor.cli.ts
```

### 第 2 步：写具体 CLI 文件

推荐结构如下：

```ts
import { defineCli } from "../../framework/core/definition";
import type { KernelRuntime, RuntimeContext } from "../../framework/core/types";
import {
  emitCliJson,
  registerCliGroup,
  type AppCliGroupDefinition,
  type AppCliRegistrationParams,
} from "./shared";

export const doctorCliName = "doctor";
const doctorCliDescription = "Inspect plugin runtime health.";
const doctorCheckSubcommandName = "check";
const doctorCheckDescription = "Run runtime health checks.";

type DoctorCliResult = {
  ok: boolean;
  loadedModules: string[];
  loadedTools: string[];
};

function createDoctorCliResult(context: Pick<RuntimeContext, "diagnostics">): DoctorCliResult {
  return {
    ok: context.diagnostics.failures.length === 0,
    loadedModules: context.diagnostics.loadedModules,
    loadedTools: context.diagnostics.loadedTools,
  };
}

function executeDoctorCli(args: string[], context: RuntimeContext): DoctorCliResult {
  const [subcommand] = args;

  if (subcommand === undefined || subcommand === doctorCheckSubcommandName) {
    return createDoctorCliResult(context);
  }

  throw new Error(`Unknown CLI subcommand: ${subcommand}`);
}

async function runRegisteredDoctorCheck(params: {
  ensureRuntime: () => Promise<KernelRuntime>;
  logger?: AppCliRegistrationParams["logger"];
}): Promise<void> {
  const runtime = await params.ensureRuntime();
  const result = createDoctorCliResult(runtime);
  emitCliJson(result, params.logger);
}

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

export function registerDoctorCli(params: AppCliRegistrationParams): void {
  registerCliGroup(params, doctorCliRegistration);
}

const doctorCli = defineCli({
  kind: "cli",
  name: doctorCliName,
  description: doctorCliDescription,
  execute(args, context) {
    return executeDoctorCli(args, context);
  },
});

export default doctorCli;
```

## 4. 然后去 `src/app/clis/index.ts` 登记

新增 CLI 后，要把它加入聚合入口。

例如原本是：

```ts
import statusCli, { registerStatusCli } from "./status.cli";
import type { AppCliRegistrar } from "./shared";

export { default as statusCli, registerStatusCli } from "./status.cli";
export type { AppCliRegistrationParams, AppCliRegistrar } from "./shared";

export const appCliDefinitions = [statusCli];
export const appCliCommands = appCliDefinitions.map((cli) => cli.name);
export const appCliRegistrars: AppCliRegistrar[] = [registerStatusCli];
```

新增 `doctor.cli.ts` 后，可以改成：

```ts
import doctorCli, { registerDoctorCli } from "./doctor.cli";
import statusCli, { registerStatusCli } from "./status.cli";
import type { AppCliRegistrar } from "./shared";

export { default as doctorCli, registerDoctorCli } from "./doctor.cli";
export { default as statusCli, registerStatusCli } from "./status.cli";
export type { AppCliRegistrationParams, AppCliRegistrar } from "./shared";

export const appCliDefinitions = [doctorCli, statusCli];
export const appCliCommands = appCliDefinitions.map((cli) => cli.name);
export const appCliRegistrars: AppCliRegistrar[] = [registerDoctorCli, registerStatusCli];
```

通常只要这里登记好了：

- `src/app/cli.ts` 不需要改
- `src/app/index.ts` 不需要改

## 5. 你在 CLI 文件里应该优先写什么样的函数

推荐从具体到抽象，按下面顺序写。

### 1. 常量

先写：

- CLI 名称
- 子命令名称
- 描述文案

这样文件结构更清楚，也方便后续复用和测试。

### 2. 结果类型

如果 CLI 输出的是结构化 JSON，建议先定义结果类型，例如：

```ts
type DoctorCliResult = {
  ok: boolean;
  loadedModules: string[];
};
```

### 3. 结果组装函数

把“从 runtime/context 读取信息并组装结果”的逻辑单独放一个函数里。

例如：

- `createStatusCliResult(...)`
- `createDoctorCliResult(...)`

这样：

- 内核执行层能复用
- OpenClaw 注册层也能复用
- 业务逻辑不会散在 `.action(...)` 里

### 4. 内核执行函数

这个函数负责解释 `args`，并在内部 CLI 运行时返回结果。

例如：

```ts
function executeDoctorCli(args: string[], context: RuntimeContext): DoctorCliResult {
  const [subcommand] = args;

  if (subcommand === undefined || subcommand === "check") {
    return createDoctorCliResult(context);
  }

  throw new Error(`Unknown CLI subcommand: ${subcommand}`);
}
```

### 5. OpenClaw action 函数

这个函数通常负责：

1. `await ensureRuntime()`
2. 读取 runtime
3. 调用结果组装函数
4. 输出给 logger 或 console

例如：

```ts
async function runRegisteredDoctorCheck(params: {
  ensureRuntime: () => Promise<KernelRuntime>;
  logger?: AppCliRegistrationParams["logger"];
}): Promise<void> {
  const runtime = await params.ensureRuntime();
  const result = createDoctorCliResult(runtime);
  emitCliJson(result, params.logger);
}
```

### 6. 注册定义对象

如果这是一个根命令 + 子命令的结构，推荐定义一个命令组对象：

```ts
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
```

### 7. 暴露 `registerXxxCli()` 和默认导出

一般最后保留两类对外出口：

- `registerDoctorCli(...)`
- `export default doctorCli`

## 6. 什么时候应该继续放在一个文件里，什么时候该拆分

### 可以继续放在一个 `*.cli.ts` 文件里的情况

- 只有一个根命令
- 子命令数量很少
- 结果组装逻辑比较简单
- 只有这个 CLI 自己会用到这些 helper

### 应该考虑拆分的情况

- 一个根命令下有很多子命令
- 子命令之间的业务逻辑差异很大
- 文件开始同时处理很多运行时数据读取和输出格式转换
- 某些 helper 已经被两个以上 CLI 复用

### 一个实用判断方法

问自己这三个问题：

1. 这段代码是不是只服务某一个 CLI
2. 这段代码是不是两个以上 CLI 都要用
3. 这段代码是不是 app 级聚合逻辑

对应位置分别是：

- 某一个 CLI：`src/app/clis/*.cli.ts`
- 多个 CLI 共用：`src/app/clis/shared.ts`
- app 聚合：`src/app/clis/index.ts` 或 `src/app/cli.ts`

## 7. 什么时候该把文件从 `status.cli.ts` 升级成 `framework.cli.ts`

当前 `status.cli.ts` 是合理的，因为现在 `framework` 下面只有一个 `status` 子命令。

但如果以后出现：

- `framework status`
- `framework doctor`
- `framework inspect`

那么更推荐把文件调整成：

```text
src/app/clis/framework.cli.ts
```

因为这时文件表达的已经不是“status 这个 CLI”，而是“framework 这个命令组”。

判断标准很简单：

- 如果文件只承载一个子命令，可以保留 `status.cli.ts`
- 如果文件开始承载整个根命令组，应该改成根命令名

## 8. 开发新 CLI 时最常见的错误

### 错误 1：忘记更新 `src/app/clis/index.ts`

结果就是：

- 代码写了
- 但是 app 级入口根本没有聚合它
- OpenClaw 启动时不会注册这个 CLI

### 错误 2：把 app 专属 CLI helper 放进 `src/framework/`

`src/framework/` 应该放框架通用能力。

如果一个 helper 只是 `src/app/clis/` 里几个 CLI 共用，就应该先放在 `src/app/clis/shared.ts`。

### 错误 3：把业务逻辑直接堆进 `.action(...)`

这样会让 CLI 文件越来越难读。

更好的做法是：

- `.action(...)` 只做调用
- 业务读取和结果组装放到单独函数

### 错误 4：过早抽象

如果某个函数目前只有一个 CLI 会用，就先留在当前 `*.cli.ts` 文件里。

不要因为“以后也许会复用”就提前塞进 `shared.ts`。

## 9. 开发完成后怎么验证

开发完一个新的 CLI 后，至少执行一次：

```bash
npm test
```

如果只是快速验证编译，也可以先执行：

```bash
npm run build
```

推荐检查点：

1. TypeScript 是否通过
2. 构建脚本是否正常生成 `artifacts/app/`
3. CLI 注册相关测试是否仍然通过
4. `src/app/clis/index.ts` 是否已登记新 CLI

## 10. 最后给你一个最短开发清单

以后你要新增 CLI，最短可以按这份清单做：

1. 新建 `src/app/clis/<name>.cli.ts`
2. 写常量、结果类型、结果组装函数
3. 写 `execute<Name>Cli()`
4. 写 `runRegistered<Name>...()`
5. 写 `register<Name>Cli()`
6. 默认导出 `defineCli({...})`
7. 去 `src/app/clis/index.ts` 登记
8. 执行 `npm test`

如果你照着这个流程写，基本不会跑偏。
