# CLI 命令不可用问题分析与上游修复建议

> 记录时间：2026-03-06
> 适用项目：`my-plugin`
> 结论：当前问题应记录并提交给上游框架仓库处理，而不是在插件示例仓库中长期分叉修改框架代码。

## 一、问题现象

当前插件内已经通过框架定义了 command：

- 文件：`src/app/commands/hello.command.ts`
- 注册链路：`src/generated/registry.ts` -> `src/framework/core/kernel.ts` -> `src/framework/openclaw/adapter.ts`

但实际测试时，CLI command 不可用，表现为：

1. 命令没有按预期出现在 CLI 中。
2. 即使框架侧记录了 command 注册日志，宿主也没有形成可执行的 `program.command(...)` 命令。

## 二、根因分析

问题不在 `hello.command.ts` 本身，而在 OpenClaw 适配层对宿主 API 的理解与文档不一致。

### 1) 当前框架适配器的实现方式

文件：`src/framework/openclaw/adapter.ts`

当前实现中，`registerCommand` 逻辑是：

```ts
registerCommand(command: HostCommandRegistration): void {
  bufferedCommands.push(command);
  api.registerCli(({ commands }) => {
    commands.push(...bufferedCommands);
  });
}
```

这等价于假设 `registerCli` 会提供一个：

```ts
{ commands: HostCommandRegistration[] }
```

然后允许框架把命令对象 push 进去。

### 2) 文档中的真实 API 形态

根据仓库文档 `docs/注册CLI和Tool示例（固定变量说明）.md` 与 `docs/插件编写参数设置完全指南.md`，OpenClaw 的 `registerCli` 约定是：

```ts
api.registerCli(
  ({ program, logger }) => {
    program
      .command("demo")
      .description("Run demo command")
      .action(() => {
        logger.info("demo called");
      });
  },
  { commands: ["demo"] }
);
```

也就是说：

1. `registerCli` 的第一个参数是 Commander 风格注册函数。
2. 回调上下文里核心对象是 `program`，不是 `commands` 数组。
3. 命令需要通过 `program.command(...).action(...)` 显式注册。
4. `opts.commands` 只是元信息，不是命令承载容器。

### 3) 结论

当前框架适配层把 `registerCli` 当成了错误的接口模型，因此 command 虽然在框架内完成了收集，但没有被正确桥接到 OpenClaw 的真实 CLI 注册入口。

## 三、为什么这里不应直接修改当前插件仓库中的框架代码

本仓库 `my-plugin` 的定位更接近：

1. 插件示例仓库
2. 框架使用方
3. OpenClaw 插件实验场

如果直接在本仓库内长期修改 `src/framework/openclaw/adapter.ts`，会产生几个问题：

1. 本地框架逻辑与上游框架仓库分叉。
2. 后续同步上游改动时容易冲突。
3. 示例仓库会混入不属于插件本身职责的框架修复。
4. 问题来源会被掩盖，不利于向框架维护者说明真实缺陷。

因此，这里更合适的处理方式是：

1. 保持当前插件仓库中的框架副本不继续演化。
2. 将问题、根因、修复建议沉淀为文档。
3. 在上游框架仓库中提交正式修复。

## 四、建议提交给上游框架仓库的修复方向

### 方案目标

让框架中的 `registerCommand` 真正桥接到 OpenClaw 的 `registerCli(({ program }) => ...)` 形态。

### 建议实现

上游框架仓库中的 `src/framework/openclaw/adapter.ts` 可考虑按以下思路修复：

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
          emitCommandResult(result, cliLogger ?? logger);
        });
    },
    { commands: [command.name] }
  );
}
```

### 修复中应同时考虑的细节

1. 需要定义与文档一致的 `registerCli` 类型签名。
2. 需要把 Commander action 的入参归一化为框架 `execute(args: string[])` 所需格式。
3. 需要将命令执行结果输出到 CLI 日志，否则用户会误判为“命令没有生效”。
4. 应补集成测试，验证 CLI 命令确实注册并可执行。

## 五、上游 PR 建议说明

建议在框架仓库 PR 中明确说明以下内容：

1. 问题：适配器误把 `registerCli` 当成 `{ commands }` 收集器。
2. 正确模型：`registerCli(({ program }) => program.command(...), { commands })`。
3. 影响：插件定义的 command 无法映射为真实 CLI 命令。
4. 修复：改为 Commander 风格注册，并补齐执行结果输出。

可参考的 PR 标题：

```text
fix(openclaw): register framework commands via Commander program API
```

## 六、当前仓库的临时策略

在上游框架未修复前，有两种临时选择：

1. 不依赖当前框架的 `defineCommand` 能力注册 CLI。
2. 直接在插件入口 `index.ts` 中使用宿主原生 `api.registerCli(...)` 注册 CLI。

例如：

```ts
api.registerCli(
  ({ program, logger }) => {
    program
      .command("demo")
      .description("Run demo command")
      .action(() => {
        logger?.info?.("demo called");
      });
  },
  { commands: ["demo"] }
);
```

这种方式的优点是：

1. 不需要等待框架修复。
2. 能直接验证 OpenClaw CLI 文档是否正确。
3. 便于把问题范围锁定在框架适配层，而非插件业务代码。

## 七、一句话结论

当前 CLI command 不可用的根因，是框架适配层错误理解了 OpenClaw 的 `registerCli` API。这个问题应该以文档和上游 PR 的形式提交到框架仓库修复，而不应在当前插件示例仓库里长期修改框架副本。
