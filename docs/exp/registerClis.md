# OpenClaw `voice-call` 插件 CLI 注册代码编写说明

## 1. 文档目标

本文档基于对 `openclaw/openclaw` 仓库中 `voice-call` 插件相关代码的检索结果整理，目标是：

- 清晰总结 `voice-call` 插件的 CLI 注册链路
- 说明开发一个类似插件时，应该如何组织代码
- 按阶段给出代码编写说明
- 为每个阶段提供一个示例
- 最终帮助开发者快速实现一个“可注册、可运行、可测试、可文档化”的 OpenClaw 插件 CLI

> 注意：
> - 本说明基于代码搜索结果整理。
> - 由于代码搜索结果存在返回数量限制，结果**可能不完整**。
> - 如果需要进一步追踪插件加载总入口、插件扫描器、或 CLI 汇总注册逻辑，建议继续在仓库中做更深一层的全局搜索。

---

## 2. 核心结论概览

`voice-call` 插件的 CLI 注册不是独立存��的，而是插件整体注册流程中的一个阶段。

完整主链路可以概括为：

1. 插件暴露主入口 `register(api)`
2. 在 `register(api)` 内完成配置解析、校验、runtime 准备
3. 通过 `api.registerGatewayMethod(...)` 注册网关 RPC
4. 通过 `api.registerTool(...)` 注册 agent tool
5. 通过 `api.registerCli(...)` 注册 CLI
6. 通过 `api.registerService(...)` 注册后台服务
7. CLI 具体命令定义由 `registerVoiceCallCli(...)` 完成
8. 测试中通过模拟 `registerCli` 调用验证命令是否成功挂载

可以理解为：

- `index.ts`：**插件总装配入口**
- `src/cli.ts`：**CLI 命令定义入口**
- `*.test.ts`：**CLI 注册行为验证**

---

## 3. 关键文件职责总结

### 3.1 `extensions/voice-call/index.ts`
职责：

- 定义插件元信息（id / name / description）
- 解析并校验插件配置
- 初始化或懒加载 runtime
- 注册 gateway methods
- 注册 tool
- 注册 CLI
- 注册 service

这是整个插件的“总入口”。

---

### 3.2 `extensions/voice-call/src/cli.ts`
职责：

- 把 CLI 命令挂到 Commander `program`
- 创建根命令 `voicecall`
- 定义子命令，例如：
  - `call`
  - `start`
  - `continue`
  - `speak`
  - `end`
  - `status`
  - `tail`
  - `latency`
  - `expose`

这是 CLI 的“具体实现层”。

---

### 3.3 `src/plugins/voice-call.plugin.test.ts`
职责：

- 模拟插件注册过程
- 模拟 `registerCli` 注入 `program`
- 验证 `voicecall start` 等命令是否能被正确解析和执行

这是 CLI 注册逻辑的“验证层”。

---

## 4. 开发一个类似 `voice-call` 的 CLI 插件时，建议采用的分阶段实现方式

---

## 阶段一：定义插件主入口

### 目标
先定义插件的基础结构，让插件能被系统识别。

### 应包含内容

- 插件 `id`
- 插件 `name`
- 插件 `description`
- 插件 `configSchema`
- `register(api)` 主函数

### 编写说明

在这个阶段不要急着实现复杂逻辑，先把插件入口搭起来，确保以后所有能力都从这里统一注册。

### 示例

```typescript name=phase-1-plugin-entry-example.ts
type OpenClawPluginApi = {
  pluginConfig: unknown;
  logger: { info(msg: string): void };
};

const samplePlugin = {
  id: "sample-plugin",
  name: "Sample Plugin",
  description: "A sample plugin for demonstrating CLI registration",
  configSchema: {
    parse(value: unknown) {
      return value ?? {};
    },
  },
  register(api: OpenClawPluginApi) {
    const config = this.configSchema.parse(api.pluginConfig);
    api.logger.info(`sample-plugin loaded with config: ${JSON.stringify(config)}`);
  },
};

export default samplePlugin;
```

### 阶段产出
你应该得到一个可以被系统识别的插件骨架。

---

## 阶段二：解析配置并准备 runtime

### 目标
在插件注册时完成配置解析和运行时资源准备。

### 应包含内容

- 默认配置处理
- 配置合法性校验
- `ensureRuntime()` 这样的懒加载函数

### 编写说明

CLI 命令通常最终都要依赖某个 runtime 执行业务逻辑，所以不要把逻辑直接写在 CLI action 里，而是通过 runtime 统一封装。

### 示例

```typescript name=phase-2-runtime-example.ts
type SampleConfig = {
  enabled: boolean;
  endpoint?: string;
};

type SampleRuntime = {
  ping(): Promise<string>;
};

function parseConfig(value: unknown): SampleConfig {
  const raw = value && typeof value === "object" ? (value as Record<string, unknown>) : {};
  return {
    enabled: typeof raw.enabled === "boolean" ? raw.enabled : true,
    endpoint: typeof raw.endpoint === "string" ? raw.endpoint : undefined,
  };
}

async function createRuntime(config: SampleConfig): Promise<SampleRuntime> {
  return {
    async ping() {
      return `pong from ${config.endpoint ?? "default-endpoint"}`;
    },
  };
}

export async function setupRuntime(pluginConfig: unknown) {
  const config = parseConfig(pluginConfig);

  let runtimePromise: Promise<SampleRuntime> | null = null;
  let runtime: SampleRuntime | null = null;

  const ensureRuntime = async () => {
    if (!config.enabled) {
      throw new Error("Plugin disabled");
    }
    if (runtime) return runtime;
    if (!runtimePromise) {
      runtimePromise = createRuntime(config);
    }
    runtime = await runtimePromise;
    return runtime;
  };

  return { config, ensureRuntime };
}
```

### 阶段产出
你应该得到一套“配置 + runtime”基础设施，供 CLI、tool、service 共用。

---

## 阶段三：在插件入口中注册 CLI

### 目标
在插件主入口 `register(api)` 中调用 `api.registerCli(...)`。

### 应包含内容

- 把 CLI 注册放到插件注册阶段中
- 将 `program` 和 runtime 依赖传给 CLI 构造函数

### 编写说明

这一步很关键：**CLI 注册不应散落在系统外层，而应由插件自己声明。**

这样插件具备良好的封装性：
- 插件启用时，CLI 生效
- 插件禁用时，CLI 可以不工作或受限
- 插件相关配置、runtime、日志都可以统一注入

### 示例

```typescript name=phase-3-register-cli-example.ts
type CliContext = {
  program: {
    command(name: string): {
      description(desc: string): unknown;
    };
  };
};

type PluginApi = {
  pluginConfig: unknown;
  logger: { info(msg: string): void };
  registerCli(fn: (ctx: CliContext) => void, meta?: { commands?: string[] }): void;
};

function registerSampleCli(params: { program: CliContext["program"] }) {
  params.program.command("sample").description("Sample plugin CLI");
}

const plugin = {
  id: "sample-plugin",
  name: "Sample Plugin",
  description: "Demo plugin",
  register(api: PluginApi) {
    api.registerCli(
      ({ program }) => {
        registerSampleCli({ program });
      },
      { commands: ["sample"] },
    );
  },
};

export default plugin;
```

### 阶段产出
你应该得到一个“插件注册时自动挂载 CLI”的结构。

---

## 阶段四：实现 CLI 根命令和子命令

### 目标
在 `src/cli.ts` 中实现完整 CLI 命令树。

### 应包含内容

- 根命令
- 若干子命令
- 参数校验
- 调用 runtime
- 输出结果

### 编写说明

建议将 CLI 放在独立文件中，例如：

- `extensions/your-plugin/src/cli.ts`

并导出一个统一函数：

- `registerYourPluginCli(...)`

这样在 `index.ts` 中只负责调用，不负责命令细节。

### 示例

```typescript name=phase-4-cli-command-example.ts
type CommandLike = {
  command(name: string): CommandLike;
  description(desc: string): CommandLike;
  requiredOption(flag: string, desc: string): CommandLike;
  action(fn: (options: Record<string, string>) => Promise<void> | void): CommandLike;
};

type SampleRuntime = {
  ping(): Promise<string>;
};

export function registerSampleCli(params: {
  program: CommandLike;
  ensureRuntime: () => Promise<SampleRuntime>;
}) {
  const root = params.program.command("sample").description("Sample utilities");

  root
    .command("ping")
    .description("Ping sample runtime")
    .requiredOption("--target <name>", "Target name")
    .action(async (options) => {
      const rt = await params.ensureRuntime();
      const result = await rt.ping();
      console.log(JSON.stringify({ target: options.target, result }, null, 2));
    });
}
```

### 阶段产出
你应该得到一个可被调用、可扩展的命令树。

---

## 阶段五：注册除 CLI 之外的其它能力

### 目标
让插件不仅能提供 CLI，还能提供 RPC、tool、service 等能力。

### 应包含内容

- `registerGatewayMethod`
- `registerTool`
- `registerService`

### 编写说明

`voice-call` 的优秀之处在于：它不是“只做 CLI”，而是把所有对外能力都放在同一个 `register(api)` 中统一装配。

这种设计非常适合复杂插件：
- CLI 适合人工执行
- Tool 适合 agent 调用
- GatewayMethod 适合 RPC 调用
- Service 适合后台常驻逻辑

### 示例

```typescript name=phase-5-multi-registration-example.ts
type PluginApi = {
  registerGatewayMethod(name: string, handler: (...args: unknown[]) => unknown): void;
  registerTool(tool: { name: string; execute: (...args: unknown[]) => unknown }): void;
  registerService(service: { id: string; start(): Promise<void>; stop(): Promise<void> }): void;
};

export function registerCapabilities(api: PluginApi) {
  api.registerGatewayMethod("sample.echo", async (_ctx) => {
    return { ok: true };
  });

  api.registerTool({
    name: "sample_tool",
    execute: async () => ({ ok: true }),
  });

  api.registerService({
    id: "sample-service",
    async start() {
      console.log("service started");
    },
    async stop() {
      console.log("service stopped");
    },
  });
}
```

### 阶段产出
你应该得到一个真正完整的插件能力体系，而不只是 CLI 命令。

---

## 阶段六：编写测试验证 CLI 注册成功

### 目标
通过测试验证 CLI 是否已挂载到 `program` 上，并能执行具体命令。

### 应包含内容

- 模拟插件 `register(...)`
- 模拟 `registerCli`
- 创建测试用 `program`
- 调用 `parseAsync(...)`
- 断言输出或行为

### 编写说明

测试时，不一定要依赖真实服务或真实网络。
重点是验证：

1. 命令是否被注册
2. 参数解析是否正常
3. action 是否被执行

### 示例

```typescript name=phase-6-cli-test-example.ts
import { describe, it, expect, vi } from "vitest";
import { Command } from "commander";

async function registerSampleCli(program: Command) {
  program
    .command("sample")
    .command("hello")
    .requiredOption("--name <name>")
    .action(async (options: { name: string }) => {
      console.log(JSON.stringify({ hello: options.name }));
    });
}

describe("sample CLI", () => {
  it("registers and runs hello command", async () => {
    const program = new Command();
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    await registerSampleCli(program);

    await program.parseAsync(["sample", "hello", "--name", "OpenClaw"], {
      from: "user",
    });

    expect(logSpy).toHaveBeenCalled();
    logSpy.mockRestore();
  });
});
```

### 阶段产出
你应该得到一组可以保护 CLI 注册逻辑不被破坏的测试。

---

## 阶段七：补全文档，保证可用性

### 目标
让用户知道 CLI 怎么安装、怎么调用、有哪些子命令。

### 应包含内容

- 插件安装方式
- 配置说明
- CLI 用法示例
- 常见命令列表

### 编写说明

任何可被用户直接调用的 CLI，都应该有说明文档。
否则代码虽然写好了，但用户和维护者很难快速理解使用方式。

### 示例

````markdown name=phase-7-cli-doc-example.md
# Sample CLI

## 安装

```bash
openclaw plugins install @openclaw/sample-plugin
```

## 使用

```bash
openclaw sample ping --target demo
```

## 命令

- `sample ping`：测试插件运行状态
- `sample status`：查看当前状态