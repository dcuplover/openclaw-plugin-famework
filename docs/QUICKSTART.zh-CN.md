# OpenClaw 插件框架快速开始手册

这份文档是写给第一次接触本框架的人看的。

你不需要先读完 `src/framework/` 里的系统代码，也不需要先理解微内核、适配层、容器这些术语。你只要跟着本文做，就能完成一个最小可运行插件，并把下面这些能力全部注册起来：

- `module`：内部服务
- `tool`：给模型调用的工具
- `hook`：宿主事件监听器
- `command`：聊天斜杠命令
- `cli`：终端 CLI 命令

如果你只想先记住一句话，请记住这一句：

`你负责写定义文件，框架负责把它们自动注册到 OpenClaw。`

## 1. 用这个框架时，你真正要写什么

使用这个框架开发插件时，你通常只需要关心这 7 类文件：

```text
src/my-plugin/
  plugin.manifest.ts    插件元数据
  index.ts              OpenClaw 入口
  modules/*.module.ts   内部服务
  tools/*.tool.ts       Tool 定义
  hooks/*.hook.ts       Hook 定义
  clis/*.cli.ts         终端 CLI 定义
  commands/*.command.ts 聊天命令定义
```

你写完这些文件后，执行：

```bash
npm run build
```

构建编排脚本会自动发现 `src/` 下的 `plugin.manifest.ts`，然后帮你完成这些工作：

1. 从 `plugin.manifest.ts` 读取所有路径配置
2. 扫描 `modules / tools / hooks / clis / commands`
3. 生成 `src/generated/registry.ts`
4. 编译 TypeScript（输出目录由 manifest 的 `build.outputDir` 决定）
5. 生成最终插件目录 `artifacts/<plugin-id>/`
6. 写出 `package.json` 和 `openclaw.plugin.json`

也就是说，平时你主要编辑的是 `src/my-plugin/`，而不是去手写注册表或修改 `package.json` 脚本。

> **注意**：你不需要在根目录的 `package.json` 里配置任何插件路径。构建脚本会自动扫描 `src/` 找到你的 `plugin.manifest.ts`。如果项目中有多个 manifest，可以显式指定：`node ./scripts/build.mjs src/my-plugin/plugin.manifest.ts`。

## 2. 先用人话理解 5 个角色

你可以先把框架理解成五层分工：

### `module`

这是内部服务层。

适合放：

- 状态
- 服务实例
- 配置读取
- 资源初始化
- 生命周期逻辑

如果一段逻辑会被多个 `tool`、`hook`、`command` 复用，它通常应该先写成 `module`。

### `tool`

这是暴露给模型调用的函数。

通常负责：

- 接收参数
- 调用 module 服务
- 返回结构化结果

### `hook`

这是对宿主事件的监听器。

通常负责：

- 响应像 `before_agent_start` 这样的事件
- 做日志、计数、预热、轻量初始化

### `command`

这是聊天里的斜杠命令，不是 CLI 命令。

在这个框架里，`defineCommand()` 最终桥接到 OpenClaw 的 `registerCommand()`。

所以：

- 想注册聊天命令，请写 `commands/*.command.ts`
- 想注册终端 CLI，请写 `clis/*.cli.ts`，并在插件入口里通过 `api.registerCli()` 挂载

### `cli`

这是终端里的命令树。

通常负责：

- 挂载 `program.command(...)`
- 组织根命令和子命令
- 在 `.action(...)` 里调用 `ensureRuntime()`
- 输出给终端用户看的结果

## 3. 最省事的开始方式

对第一次接入的人，最推荐的方式不是从零搭目录，而是参考现成示例：

- `src/app/plugin.manifest.ts`
- `src/app/index.ts`
- `src/app/modules/greeter.module.ts`
- `src/app/tools/greet.tool.ts`
- `src/app/hooks/before-agent-start.hook.ts`
- `src/app/clis/status.cli.ts`
- `src/app/commands/hello.command.ts`

最稳妥的上手路径是：

1. 直接在 `src/app/` 目录中修改
2. 修改名称、描述、配置项
3. 替换里面的业务逻辑
4. 执行 `npm run build`

如果你不确定某个文件该怎么写，优先对照 `src/app/`。

## 4. 哪些文件需要你写，哪些不要手改

### 你会经常编辑的文件

- `src/<your-app>/plugin.manifest.ts`
- `src/<your-app>/index.ts`
- `src/<your-app>/modules/*.module.ts`
- `src/<your-app>/tools/*.tool.ts`
- `src/<your-app>/hooks/*.hook.ts`
- `src/<your-app>/clis/*.cli.ts`
- `src/<your-app>/commands/*.command.ts`

### 一般不要手动编辑的文件

- `src/generated/registry.ts`
- `artifacts/<plugin-id>/package.json`
- `artifacts/<plugin-id>/openclaw.plugin.json`

这些文件都是构建流程生成或同步出来的。

如果你手改了，下一次 `npm run build` 很可能又会被覆盖。

## 5. 最小可运行插件，照着做就行

下面这部分是整份手册最重要的内容。

如果你什么都没读过，只照着这 8 步做，也能得到一个可运行插件。

### 第 1 步：创建应用目录

先准备一个应用目录，例如：

```text
src/my-plugin/
  index.ts
  plugin.manifest.ts
  modules/
  tools/
  hooks/
  clis/
  commands/
```

这里的目录名 `my-plugin` 不强制，但建议和插件 ID 保持一致，后续更不容易混淆。

### 第 2 步：写 `plugin.manifest.ts`

这个文件用来描述插件是谁、默认配置是什么、构建后输出到哪里。

```ts
import { definePlugin } from "../framework/plugin/manifest";

export interface MyPluginConfig {
  environment: string;
  greetingPrefix: string;
}

const configSchema = {
  type: "object",
  properties: {
    environment: { type: "string" },
    greetingPrefix: { type: "string" },
  },
  required: ["environment", "greetingPrefix"],
  additionalProperties: false,
} as const;

export default definePlugin<MyPluginConfig>({
  id: "my-plugin",
  name: "My Plugin",
  version: "0.1.0",
  description: "My first OpenClaw plugin.",
  configSchema,
  app: {
    root: "src/my-plugin",
    registryPath: "src/generated/registry.ts",
    defaultConfig: {
      environment: "local",
      greetingPrefix: "Hello",
    },
  },
  package: {
    packageName: "@your-scope/my-plugin",
    private: true,
  },
  build: {
    entrySource: "src/my-plugin/index.ts",
    artifactEntry: "./index.js",
    outputDir: "dist",
    registryOutput: "src/generated/registry.ts",
    artifactRoot: "artifacts/my-plugin",
    packageJsonOutput: "artifacts/my-plugin/package.json",
    pluginManifestOutput: "artifacts/my-plugin/openclaw.plugin.json",
  },
});
```

第一次写这个文件时，只要重点看 4 个字段：

1. `id`：插件唯一标识
2. `app.root`：源码目录
3. `app.defaultConfig`：默认配置
4. `build.artifactRoot`：最终插件输出目录

如果你还不熟悉其它字段，可以先直接照抄示例，再按需改名字。

### 第 3 步：写一个 `module`

这个步骤的目的，是先准备一个能被其它定义复用的服务。

创建 `src/my-plugin/modules/greeter.module.ts`：

```ts
import { defineModule } from "../../framework/core/definition";

export interface GreeterService {
  greet(name: string): string;
}

export default defineModule({
  kind: "module",
  name: "greeter",
  provides: ["greeter"],
  setup(context) {
    const prefix = String(
      (context.config as Record<string, unknown>).greetingPrefix ?? "Hello"
    );

    const greeter: GreeterService = {
      greet(name: string) {
        return `${prefix}, ${name}`;
      },
    };

    context.container.register("greeter", greeter);
    context.logger.info("Greeter module ready", { prefix });
  },
});
```

第一次看 module，只需要理解两件事：

1. `setup(context)` 会在启动时执行
2. 你可以通过 `context.container.register("服务名", 服务实例)` 把服务放进容器

后面的 `tool`、`hook`、`command` 就能通过同一个 key 取到这个服务。

### 第 4 步：写一个 `tool`

创建 `src/my-plugin/tools/greet.tool.ts`：

```ts
import { defineTool } from "../../framework/core/definition";
import type { GreeterService } from "../modules/greeter.module";

export default defineTool({
  kind: "tool",
  name: "greet_user",
  description: "Return a greeting message.",
  schema: {
    type: "object",
    properties: {
      name: { type: "string", description: "Target user name" },
    },
    required: ["name"],
  },
  execute(params, context) {
    const greeter = context.container.resolve<GreeterService>("greeter");
    const name = typeof params.name === "string" ? params.name : "world";

    return {
      type: "text",
      text: greeter.greet(name),
    };
  },
});
```

这就是一个完整的 tool 注册定义。

推荐直接返回：

- 字符串
- `{ type: "text", text: "..." }`
- 或宿主原生 `{ content: [...] }`

框架适配层会把这些结果统一归一化到宿主需要的 tool 输出格式。

你不需要自己手动写：

- `api.registerTool(...)`
- 适配器桥接逻辑
- 注册表加载逻辑

你只需要把文件放到 `tools/` 目录，框架会在构建和启动时自动处理。

### 第 5 步：写一个 `hook`

创建 `src/my-plugin/hooks/before-agent-start.hook.ts`：

```ts
import { defineHook } from "../../framework/core/definition";

export default defineHook({
  kind: "hook",
  name: "track_before_agent_start",
  event: "before_agent_start",
  priority: 50,
  handle(payload, context) {
    context.logger.info("before_agent_start received", {
      payload: payload as Record<string, unknown>,
    });
  },
});
```

这里要记住的是：

1. `event` 是宿主事件名
2. `handle(payload, context)` 是事件处理函数
3. `priority` 越大，通常越早执行
4. `name`、`description`、`priority` 会随着 `api.on(..., opts)` 一起传给宿主

如果你只是要监听宿主事件，这一步就够了。

### 第 6 步：写一个终端 `cli`

创建 `src/my-plugin/clis/status.cli.ts`：

```ts
import { defineCli } from "../../framework/core/definition";

export default defineCli({
  kind: "cli",
  name: "framework",
  description: "Framework CLI utilities.",
  execute(args, context) {
    const [subcommand] = args;

    if (subcommand === undefined || subcommand === "status") {
      return {
        diagnostics: context.diagnostics,
        services: context.container.entries().map(([key]) => key),
      };
    }

    throw new Error(`Unknown CLI subcommand: ${subcommand}`);
  },
});
```

如果你要对接真实 OpenClaw Commander CLI，插件入口里通常还会配合一个 `registerAppCli({ program, ensureRuntime, logger })` 这样的函数，把 `program.command("framework").command("status")` 挂到宿主上。

### 第 7 步：写一个聊天 `command`

创建 `src/my-plugin/commands/hello.command.ts`：

```ts
import { defineCommand } from "../../framework/core/definition";

export default defineCommand({
  kind: "command",
  name: "hello",
  description: "Reply hello",
  acceptsArgs: true,
  requireAuth: true,
  handler(commandContext, context) {
    const services = context.container.entries().map(([key]) => key).join(", ");
    return {
      text:
        `hello ${commandContext.args ?? ""}`.trim() +
        ` | sender: ${commandContext.senderId ?? "unknown"}` +
        ` | services: ${services}`,
    };
  },
});
```

这是最容易被误解的一步，所以单独说明一下：

- 你写的是 `command`
- 框架内部会把它自动桥接成 OpenClaw 聊天命令
- 最终宿主层用的是 `registerCommand()`

所以，`command` 不是本框架里注册 CLI 的标准方式；它对应的是聊天命令。

### 第 8 步：写插件入口 `index.ts`

创建 `src/my-plugin/index.ts`：

```ts
import { registry } from "../generated/registry";
import type { OpenClawLikeApi } from "../framework/openclaw/adapter";
import { bootstrapOpenClawPlugin } from "../framework/openclaw/bootstrap";
import { appCliCommands, registerAppCli } from "./cli";
import pluginManifest from "./plugin.manifest";

const registryWithoutClis = { ...registry, clis: [] as typeof registry.clis };
const openClawPluginEntrypoint = bootstrapOpenClawPlugin(pluginManifest, registryWithoutClis);

export default {
  id: pluginManifest.id,
  name: pluginManifest.name,
  description: pluginManifest.description,
  version: pluginManifest.version,
  configSchema: pluginManifest.configSchema,
  register(api: OpenClawLikeApi) {
    const runtimePromise = openClawPluginEntrypoint({
      api,
      config: api.pluginConfig as Partial<Record<string, unknown>> | undefined,
    });

    let runtime: Awaited<typeof runtimePromise> | null = null;
    const ensureRuntime = async () => {
      if (runtime) {
        return runtime;
      }
      runtime = await runtimePromise;
      return runtime;
    };

    api.registerCli(
      ({ program, logger }) => {
        registerAppCli({ program, ensureRuntime, logger });
      },
      { commands: appCliCommands }
    );

    return runtimePromise;
  },
};
```

这个文件的职责非常简单：

1. 读取 manifest
2. 读取生成后的 registry
3. 同步注册 CLI
4. 导出一个 OpenClaw 能识别的 `register(api)` 入口

这里尽量保持“薄”，不要把业务逻辑写进去。

## 6. 构建后到底发生了什么

当你执行：

```bash
npm run build
```

构建编排脚本（`scripts/build.mjs`）会按以下顺序执行：

1. **自动发现** `src/` 下的 `plugin.manifest.ts`（也可显式传参）
2. **从 manifest 源码读取**所有路径配置（`app.root`、`build.outputDir`、`registryPath` 等）
3. **扫描** `modules/*.module.ts`、`tools/*.tool.ts`、`hooks/*.hook.ts`、`clis/*.cli.ts`、`commands/*.command.ts`
4. **生成** `src/generated/registry.ts`
5. **编译 TypeScript**（`outDir` 由 manifest 的 `build.outputDir` 决定，默认 `dist/`）
6. **暂存插件制品**到 `artifacts/<plugin-id>/`
7. **生成** `package.json` 和 `openclaw.plugin.json`
8. **校验**所有生成产物与 manifest 一致

整个过程不需要你手动在 `package.json` 里维护任何硬编码路径。

如果你想知道“为什么我没手写注册函数也生效了”，答案就是：

`因为 registry 和适配器在构建与启动阶段已经帮你接管了注册过程。`

## 7. 各类定义最终是怎么注册到 OpenClaw 的

这部分不是必须先理解，但很多人第一次会想知道“框架到底替我做了什么”。

最终映射关系如下：

| 你写的文件 | 你实现的函数 | 最终宿主注册方式 |
| --- | --- | --- |
| `*.module.ts` | `setup/start/shutdown` | 仅供内核使用，不直接暴露给宿主 |
| `*.tool.ts` | `execute(params, context)` | `api.registerTool()` |
| `*.hook.ts` | `handle(payload, context)` | `api.on()` |
| `*.cli.ts` | `execute(args, context)` | `api.registerCli(({ program }) => ...)` |
| `*.command.ts` | `handler(commandContext, context)` | `api.registerCommand()` |

所以你可以这样记：

- `tool` 对应模型调用
- `hook` 对应宿主事件
- `cli` 对应终端命令
- `command` 对应聊天命令
- `module` 给前三者提供共享服务

## 8. 最快的验证方法

如果你想确认刚写的定义是不是都注册成功了，最简单的方式是参考 `src/app/bootstrap.ts` 做一次本地验证。

它的核心思路是：

1. 用 `MockHostAdapter` 启动内核
2. 手动触发一个 hook 事件
3. 手动调用一个 tool
4. 手动执行一个 CLI
5. 手动执行一个聊天 command

示例：

```ts
await host.emit("before_agent_start", { source: "demo" });
console.log(await host.invokeTool("greet_user", { name: "OpenClaw" }));
console.log(await host.runCli("framework", ["status", "--verbose"]));
console.log(await host.runCommand("hello", "OpenClaw"));
```

如果前五步都正常返回，说明：

- hook 注册成功
- tool 注册成功
- cli 注册成功
- command 注册成功

## 9. 新手最常遇到的 5 个问题

### 1. 我写了文件，为什么没有生效

优先检查：

- 是否放在正确目录下
- 文件后缀是否正确
- 是否重新执行了 `npm run build`

当前生成器只认下面这些后缀：

- `.module.ts`
- `.tool.ts`
- `.hook.ts`
- `.cli.ts`
- `.command.ts`

### 2. 为什么 `src/generated/registry.ts` 里没有我的文件

原因通常只有两个：

1. 文件路径不符合约定
2. 你还没有重新执行构建

这个文件是生成产物，不建议手改。

### 3. 为什么 `tool` 里拿不到服务

优先检查：

- 对应服务是不是在 module 里 `container.register()` 了
- 取服务时的 key 是否完全一致
- 依赖模块是否需要 `dependsOn`

### 4. 为什么我现在既有 `clis/*.cli.ts` 又有 `commands/*.command.ts`

因为在这个框架里：

- `clis/*.cli.ts` 对应终端 CLI
- `commands/*.command.ts` 对应聊天斜杠命令

两者最终桥接到的是宿主的两种不同能力，不是重复设计。

### 5. `cli` 的参数为什么是 `string[]`

因为当前适配层会把 CLI action 参数归一化成字符串数组，方便命令定义保持统一。

如果你需要更复杂的参数解析，可以：

1. 在 `execute(args)` 里自行解析
2. 后续增强 `src/framework/openclaw/adapter.ts`

## 10. 建议你第一次就这样做

如果你希望第一次尽量少踩坑，建议按下面顺序推进：

1. 直接在 `src/app/` 中修改
2. 先只改 `plugin.manifest.ts` 和 `index.ts`
3. 再改一个最简单的 `module`
4. 再接一个 `tool`
5. 再补一个 `hook`
6. 再加一个 `cli`
7. 最后加 `command`
8. 每完成一步就执行一次 `npm run build`

不要一上来同时加 10 个定义文件，否则第一次排错会比较痛苦。

## 11. 一份可以照着过的检查清单

在你准备把插件接到 OpenClaw 之前，至少确认下面这些项：

1. 已有 `plugin.manifest.ts`
2. 已有 `index.ts`
3. 至少有一个 `module`
4. 至少有一个 `tool`
5. 至少有一个 `hook`
6. 至少有一个 `command`
7. `npm run build` 可以通过
8. `src/generated/registry.ts` 能看到你的定义文件
9. `artifacts/<plugin-id>/` 已生成
10. 本地调用 `tool / hook / cli / command` 至少验证过一次

## 12. 一句话总结整个框架

如果你读完还是觉得信息有点多，可以只记下面这段：

1. 在 `src/<your-app>/` 里写 `manifest`、`index`、`module`、`tool`、`hook`、`command`
2. 执行 `npm run build`
3. 让框架自动生成注册表和插件制品
4. 从 `artifacts/<plugin-id>/` 作为最终插件根目录接入 OpenClaw

这就是使用本框架的主流程。