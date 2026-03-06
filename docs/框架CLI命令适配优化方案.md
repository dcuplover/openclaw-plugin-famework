# 框架 CLI 命令适配优化方案

> 记录时间：2026-03-06
> 适用范围：`src/framework/core/*`、`src/framework/openclaw/*`
> 目标：将当前 CLI command 注册问题从一次性修补，升级为一套更稳定的宿主适配设计。

## 一、当前问题不只是实现错误，而是抽象层次不对

从现有代码看，CLI command 注册失败并不只是 `src/framework/openclaw/adapter.ts` 里的一段错误实现。

更深层的问题有两个：

1. `OpenClawLikeApi.registerCli` 的类型定义与真实宿主 API 不一致。
2. 框架把 CLI command 抽象成了过于简单的 `execute(args: string[])`，导致适配层必须“猜”宿主如何把 Commander 上下文转换成字符串数组。

这意味着即使修正当前 `commands.push(...)` 的错误逻辑，后续仍然会遇到：

1. 无法表达 option、alias、help、usage 等 CLI 元数据。
2. 无法稳定处理 Commander action 的参数形态。
3. 无法统一输出命令执行结果。
4. 无法对宿主侧 CLI 注册做可靠测试。

## 二、先给出最小修复范围

如果目标是先恢复 command 可用性，最小修复应集中在 `src/framework/openclaw/adapter.ts`。

### 1. 修正 OpenClaw API 类型

当前：

```ts
registerCli(factory: (context: { commands: HostCommandRegistration[] }) => void): void;
```

建议改成与文档一致的建模，例如：

```ts
export interface OpenClawCliProgramLike {
  command(name: string): OpenClawCliCommandLike;
}

export interface OpenClawCliCommandLike {
  description(text: string): OpenClawCliCommandLike;
  action(handler: (...args: unknown[]) => unknown): OpenClawCliCommandLike;
  option?(flags: string, description?: string, defaultValue?: unknown): OpenClawCliCommandLike;
  alias?(name: string): OpenClawCliCommandLike;
}

export interface OpenClawCliContext {
  program: OpenClawCliProgramLike;
  logger?: {
    info?: (...args: unknown[]) => void;
    warn?: (...args: unknown[]) => void;
    error?: (...args: unknown[]) => void;
  };
}

export interface OpenClawLikeApi {
  registerTool(definition: unknown, meta?: unknown): void;
  registerCli(factory: (context: OpenClawCliContext) => void, meta?: { commands?: string[] }): void;
  on(event: string, handler: (payload: unknown) => Promise<void> | void): void;
  log?: {
    info?: (...args: unknown[]) => void;
    warn?: (...args: unknown[]) => void;
    error?: (...args: unknown[]) => void;
  };
}
```

这里的重点不是把 Commander 类型引进内核，而是在 OpenClaw 适配层里承认真实宿主的能力形态。

### 2. 让 `registerCommand()` 直接桥接 Commander 注册

建议把当前缓冲数组逻辑改为逐条注册：

```ts
registerCommand(command: HostCommandRegistration): void {
  api.registerCli(
    ({ program, logger: cliLogger }) => {
      program
        .command(command.name)
        .description(command.description)
        .action(async (...actionArgs) => {
          const args = normalizeCliArgs(actionArgs);
          const result = await command.execute(args);
          emitCommandResult(result, cliLogger ?? api.log ?? logger);
        });
    },
    { commands: [command.name] }
  );
}
```

这样做有三个直接收益：

1. 注册链路与宿主文档一致。
2. command 的可见性不再依赖伪造的 `commands` 容器。
3. 每个 command 的注册元信息都能单独声明。

### 3. 增加两个适配器内部工具函数

建议在 `src/framework/openclaw/adapter.ts` 内新增：

1. `normalizeCliArgs(actionArgs: unknown[]): string[]`
2. `emitCommandResult(result: unknown, loggerLike): void`

建议行为如下：

`normalizeCliArgs()`：

1. 忽略 Commander 注入的 command 对象。
2. 对 string、number、boolean 做稳定字符串化。
3. 如果 action 只收到 option 对象，则把对象拍平成 `--key value` 形式，至少保证现有 `execute(args: string[])` 可以工作。

`emitCommandResult()`：

1. `string` 直接输出。
2. `{ content: [...] }` 时优先提取 text 内容输出。
3. 普通对象按 JSON 输出。
4. `undefined` 不输出，但保留 debug 日志。

这能减少“命令实际执行了，但用户没看到结果”的误判。

## 三、仅做最小修复还不够，建议继续优化抽象边界

### 1. 把 `HostAdapter` 分成“通用宿主能力”和“CLI 扩展能力”

当前 `src/framework/core/types.ts` 中：

```ts
export interface HostAdapter {
  registerTool(...)
  registerHook(...)
  registerCommand(...)
}
```

这里的问题是，`registerCommand()` 看起来像一个和 tool、hook 同级的稳定抽象，但实际上不同宿主对 CLI 的支持差异很大。

建议改成：

```ts
export interface HostAdapter {
  registerTool(tool: HostToolRegistration): Promise<void> | void;
  registerHook(hook: HostHookRegistration): Promise<void> | void;
}

export interface HostCommandCapableAdapter extends HostAdapter {
  registerCommand(command: HostCommandRegistration): Promise<void> | void;
}
```

然后在内核注册 command 前显式判断宿主是否支持 CLI：

```ts
function supportsCommands(host: HostAdapter): host is HostCommandCapableAdapter {
  return typeof (host as HostCommandCapableAdapter).registerCommand === "function";
}
```

好处是：

1. 不再假设所有宿主都具备 CLI。
2. 未来接入非 CLI 宿主时，内核不需要伪造空实现。
3. 不支持 CLI 的场景可以在 diagnostics 中给出清晰提示，而不是静默失败。

### 2. 给 command 引入更完整的定义模型

当前 `CommandDefinition` 只有：

```ts
name
 description
 execute(args: string[], context)
```

这对最简单命令够用，但不够表达真实 CLI。

建议逐步扩展为：

```ts
export interface CommandOptionDefinition {
  flags: string;
  description?: string;
  defaultValue?: unknown;
}

export interface CommandDefinition<TConfig = unknown> extends BaseDefinition {
  kind: "command";
  description: string;
  aliases?: string[];
  options?: CommandOptionDefinition[];
  execute: (args: string[], context: RuntimeContext<TConfig>) => Promise<unknown> | unknown;
}
```

这是兼容性最好的演进方式，因为：

1. 现有 `execute(args: string[])` 不需要立刻改。
2. OpenClaw 适配器已经可以把 `options`、`aliases` 映射到 Commander。
3. 未来如果需要，再引入更强的 `raw` 上下文对象。

### 3. 再下一步才考虑引入结构化 CLI 上下文

如果后续确实需要让 command 直接拿到解析后的 option 值，建议新增而不是替换：

```ts
export interface CommandExecutionContext {
  argv: string[];
  options: Record<string, unknown>;
  rawArgs: unknown[];
}
```

再把 `execute` 升级为：

```ts
execute: (
  input: CommandExecutionContext,
  context: RuntimeContext<TConfig>
) => Promise<unknown> | unknown;
```

但这一步建议放在第二阶段，因为它会影响现有全部 command 定义。

## 四、内核层也应同步做降级与诊断优化

`src/framework/core/kernel.ts` 目前默认总会调用 `context.host.registerCommand(...)`。

这在抽象上过于乐观。建议增加两类优化：

### 1. 对“不支持 command 的宿主”给出显式诊断

建议在 command 注册阶段记录：

1. 已发现的 command 数量。
2. 实际成功注册数量。
3. 若宿主不支持 CLI，则写入 `diagnostics.failures` 或新增 `diagnostics.warnings`。

例如：

```ts
Command registration skipped: host does not support CLI commands
```

### 2. 区分“定义加载成功”和“宿主注册成功”

当前 `loadedCommands.push(definition.name)` 发生在 `registerCommand()` 调用之后，但并没有验证宿主侧注册是否真的成立。

建议拆成两层：

1. `discoveredCommands`
2. `registeredCommands`

最少也应在 diagnostics 里记录：

```ts
commandRegistration: {
  discovered: number;
  registered: number;
  skipped: number;
}
```

这样问题定位会更快，不会再出现“框架日志显示注册成功，但 CLI 里没有命令”的错觉。

## 五、测试层建议补齐三类验证

当前仓库没有现成的 command 集成测试，这是这次问题能进入主干的原因之一。

建议至少补三类测试。

### 1. 适配器单元测试

目标文件：`src/framework/openclaw/adapter.ts`

覆盖点：

1. `registerCommand()` 是否调用了 `api.registerCli()`。
2. `registerCli` 的第二个参数是否包含 `{ commands: [name] }`。
3. 回调执行后是否调用了 `program.command(name)`。
4. `action()` 执行后是否触发 `command.execute()`。
5. 返回值是否经 `emitCommandResult()` 输出。

### 2. 内核集成测试

目标文件：`src/framework/core/kernel.ts`

覆盖点：

1. registry 中存在 command 时，支持 CLI 的 host 能收到注册调用。
2. 不支持 CLI 的 host 不应导致整个 boot 失败。
3. diagnostics 能准确反映 command 注册状态。

### 3. 示例应用冒烟测试

目标文件：`src/example-app/commands/status.command.ts`

覆盖点：

1. `framework:status` 能被注册。
2. action 触发后可以输出 diagnostics。
3. 当 session module 已启动时，命令结果中包含 `beforeAgentStartCount`。

## 六、建议的演进顺序

### 阶段 A：止血

范围：`src/framework/openclaw/adapter.ts`

1. 修正 `registerCli` 类型。
2. 去掉 `bufferedCommands` + `commands.push(...)` 模型。
3. 增加 `normalizeCliArgs()`。
4. 增加 `emitCommandResult()`。
5. 补最小适配器测试。

### 阶段 B：补齐诊断

范围：`src/framework/core/types.ts`、`src/framework/core/kernel.ts`

1. 为宿主 command 支持能力做显式建模。
2. 为 diagnostics 增加 command 注册状态信息。
3. 对不支持 CLI 的宿主提供清晰日志或失败记录。

### 阶段 C：增强命令契约

范围：`src/framework/core/types.ts`、`src/framework/core/definition.ts`、示例 command

1. 为 command 增加 `aliases`、`options` 等元数据。
2. 在 OpenClaw 适配器里映射到 Commander。
3. 保持 `execute(args: string[])` 兼容，避免一次性破坏现有定义。

### 阶段 D：结构化执行上下文

范围：命令定义与适配器

1. 设计 `CommandExecutionContext`。
2. 提供兼容层，允许旧 command 与新 command 共存。
3. 再决定是否升级生成器与示例项目模板。

## 七、对这个仓库的实际建议

结合 `README.md` 和 `docs/ARCHITECTURE.md` 当前定位，这个仓库更像“框架原型 + 示例应用”，因此更适合做两件事：

1. 保留问题分析文档，说明当前实现为何错误。
2. 新增优化设计文档，把修复路径和演进顺序讲清楚。

不太适合在没有补测试、没有确认上游真实 API 细节的前提下，直接继续扩大本地框架分叉。

## 八、一句话结论

这个问题暴露出的核心不是“命令没注册进去”，而是“框架对宿主 CLI 的抽象粒度不对”。

真正稳妥的优化方向应是：

1. 先按真实 `registerCli(({ program }) => ...)` 语义修复适配器。
2. 再把 command 能力从宿主抽象、命令模型、诊断和测试四个层面补完整。
3. 最终让框架既能兼容当前 `defineCommand()`，又能逐步演进到更强的 CLI 建模。
