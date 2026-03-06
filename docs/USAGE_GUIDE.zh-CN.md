# OpenClaw 约定式微内核框架使用说明

本文档不是一句话的 README 扩展，而是一份真正面向架构设计、项目落地和团队协作的使用手册。

它回答 4 个核心问题：

1. 这个框架到底解决什么问题。
2. 开发者应该怎样基于它构建一个 OpenClaw 插件应用。
3. 模块、工具、Hook、命令分别应该怎么写。
4. 一个成熟团队应该怎样用它，而不是把它重新写回“大号 index.ts”。

---

## 1. 框架定位

这个框架的定位不是“一个自动扫描文件夹的小工具”，而是：

`一个面向 OpenClaw 插件生态的约定式微内核框架`

关键词有 4 个：

- `面向 OpenClaw`：它不是通用 Web 框架，而是为插件宿主、Tool、Hook、CLI 这类能力组织服务。
- `约定式`：开发者通过目录和文件后缀参与装配，而不是手工把所有能力堆进入口文件。
- `微内核`：内核本身尽量只负责装配、生命周期、依赖关系、诊断与主机适配，不承载业务细节。
- `框架`：它不仅是代码片段集合，而是有契约、有边界、有演进方向的底层平台。

这个框架当前不实现记忆系统业务。
它实现的是“让未来的记忆系统、工作流系统、知识图谱系统、观察性系统都能跑在同一底座上”的基础设施。

---

## 2. 你应该怎样理解它

如果用一句话理解它：

`你写能力单元，框架负责编排能力单元。`

你需要写的不是一个大入口文件，而是四类标准化对象：

- `module`：提供服务和状态，属于系统内部能力。
- `tool`：对模型暴露的函数调用接口。
- `hook`：响应宿主生命周期事件。
- `command`：对人类运维或调试暴露的命令入口。

框架内核负责：

- 扫描并生成注册表
- 加载定义
- 按依赖关系排序模块
- 初始化服务容器
- 注册 tool / hook / command
- 记录诊断信息
- 按逆序关闭模块

代码核心在 `framework/src/framework/core/kernel.ts`。

---

## 3. 框架的核心心智模型

### 3.1 内核不做业务

内核只关心：

- 谁要被加载
- 谁依赖谁
- 谁向容器里注册了什么
- 谁向宿主暴露了什么
- 启动是否成功
- 失败发生在哪里

这意味着：

- 业务逻辑不应该塞进内核。
- 内核不应该知道 memory、retrieval、workflow 的细节。
- 领域能力必须通过 module/tool/hook/command 的契约进入系统。

### 3.2 module 是一等公民

在很多项目里，tool 和 hook 被直接写在入口文件里，导致系统无法演化。
在这个框架里，真正的一等公民是 `module`。

因为只有 module 才适合承载：

- 服务实例
- 共享状态
- 生命周期
- 依赖关系
- 资源释放

如果某段逻辑需要被多个 tool/hook/command 复用，它大概率应该先成为 module，而不是 helper。

### 3.3 tool / hook / command 是边界，不是核心

- `tool` 是模型能力边界。
- `hook` 是宿主事件边界。
- `command` 是人类运维边界。

真正的业务核心通常应该下沉到 module 中。

这是避免“边界层过胖”的关键原则。

---

## 4. 当前目录结构应该如何理解

当前原型使用的是单应用目录：

```text
framework/
  src/
    framework/
      core/
      openclaw/
    example-app/
      modules/
      tools/
      hooks/
      commands/
      bootstrap.ts
    generated/
      registry.ts
  scripts/
    generate-registry.mjs
```

每一层的含义：

- `src/framework/core/`
  框架内核。
  包括类型、定义函数、容器、日志器、注册表加载器、启动器。

- `src/framework/openclaw/`
  OpenClaw 宿主适配层。
  用来把 HostAdapter 映射到 OpenClaw 的 API 形态。

- `src/example-app/`
  一个真正的应用示例。
  它不是“测试数据”，而是告诉你一个框架应用应该长什么样。

- `src/generated/registry.ts`
  由生成脚本产物写出。
  不是主要编辑目标。

- `scripts/generate-registry.mjs`
  自动发现和生成注册表的入口。

---

## 5. 框架启动流程

完整启动流程在 `framework/src/framework/core/kernel.ts`。

逻辑顺序如下：

1. 创建 `logger`
2. 创建 `container`
3. 创建 `diagnostics`
4. 将 `config`、`logger`、`host`、`diagnostics` 注册进容器
5. 从 `registry` 动态加载 module/tool/hook/command
6. 对 module 做依赖排序
7. 执行每个 module 的 `setup()`
8. 执行每个 module 的 `start()`
9. 注册所有 tool
10. 注册所有 hook
11. 注册所有 command
12. 输出 boot 完成日志
13. 在 shutdown 时按逆序执行 `shutdown()`

这里最重要的思想是：

`模块先于边界层装配`

也就是：

- 先有 service
- 再有 tool/hook/command 使用这些 service

这保证了边界层不会拿到半初始化对象。

---

## 6. 约定式发现是怎么工作的

当前生成器位于 `framework/scripts/generate-registry.mjs`。

它按下面的规则扫描：

```text
modules/*.module.ts
tools/*.tool.ts
hooks/*.hook.ts
commands/*.command.ts
```

然后生成 `framework/src/generated/registry.ts`，内容是 import loader 数组。

### 为什么是“构建期生成”而不是“运行时扫描”

因为高级框架的目标不是“看起来聪明”，而是“长期可控”。

构建期生成的好处：

- 启动顺序更确定
- 打包行为更稳定
- 错误更早暴露
- 调试更容易
- 生产环境更安全

运行时扫描文件系统虽然短期看方便，但在插件生态、打包部署、宿主集成里会迅速变成隐患。

所以这个框架采用的是：

`开发体验像自动扫描，运行时行为像显式注册`

这是最合理的折中。

---

## 7. 如何创建一个新应用

当前原型只有 `example-app`，但使用方式已经足够清晰。

### 第一步：创建应用目录

例如：

```text
src/my-plugin-app/
  modules/
  tools/
  hooks/
  commands/
  bootstrap.ts
```

### 第二步：写模块

模块负责注册服务、共享状态、资源句柄。

示例模式见：

- `framework/src/example-app/modules/platform.module.ts`
- `framework/src/example-app/modules/greeter.module.ts`
- `framework/src/example-app/modules/session.module.ts`

最小模块写法：

```ts
import { defineModule } from "../../framework/core/definition";

export default defineModule({
  kind: "module",
  name: "clock",
  provides: ["clockService"],
  setup(context) {
    context.container.register("clockService", {
      now: () => Date.now(),
    });
  },
});
```

### 第三步：写 tool

tool 不应该自己初始化一堆依赖，而应该从容器里拿已经准备好的服务。

```ts
import { defineTool } from "../../framework/core/definition";

export default defineTool({
  kind: "tool",
  name: "clock_now",
  description: "Return current timestamp",
  execute(_params, context) {
    const clock = context.container.resolve<{ now: () => number }>("clockService");
    return { timestamp: clock.now() };
  },
});
```

### 第四步：写 hook

hook 适合做事件响应，不适合承载深层业务状态。

```ts
import { defineHook } from "../../framework/core/definition";

export default defineHook({
  kind: "hook",
  name: "observe_agent_start",
  event: "before_agent_start",
  handle(payload, context) {
    context.logger.info("agent starting", {
      payload: payload as Record<string, unknown>,
    });
  },
});
```

### 第五步：写 command

command 用于运维、调试、诊断和人工触发操作。

```ts
import { defineCommand } from "../../framework/core/definition";

export default defineCommand({
  kind: "command",
  name: "app:status",
  description: "Show runtime status",
  execute(_args, context) {
    return {
      diagnostics: context.diagnostics,
      services: context.container.entries().map(([key]) => key),
    };
  },
});
```

### 第六步：生成 registry

```bash
npm run generate:registry
```

### 第七步：在 bootstrap 中启动

参考 `framework/src/example-app/bootstrap.ts`：

```ts
const runtime = await bootstrapMicrokernel({
  appId: "my-plugin-app",
  config,
  registry,
  host,
  logger,
});
```

---

## 8. module 应该怎么设计

这是最重要的一章。

### 8.1 module 的职责

一个好的 module 应该承担以下一种或几种职责：

- 初始化领域服务
- 管理共享状态
- 建立外部资源连接
- 向容器暴露能力
- 在关闭时释放资源

### 8.2 module 的字段含义

在 `framework/src/framework/core/types.ts` 中，`ModuleDefinition` 主要字段有：

- `name`
  模块唯一名。
  同时也是依赖排序里的节点标识。

- `dependsOn`
  声明依赖哪些其他模块。
  内核会据此做拓扑排序。

- `provides`
  当前是声明性字段，表示该模块提供哪些能力。
  当前版本主要用于表达意图，后续可以进化成真正的 capability token 验证。

- `setup(context)`
  做基础初始化和容器注册。

- `start(context)`
  适合做真正的启动动作，比如开启轮询、启动连接、订阅流。

- `shutdown(context)`
  释放资源、清理句柄、做逆序关闭。

### 8.3 setup 和 start 的区别

建议这样理解：

- `setup()`：构造系统结构
- `start()`：启动系统行为

例如：

- 在 `setup()` 中创建数据库客户端对象并注册到容器
- 在 `start()` 中开始后台同步任务

不要把所有事情都塞进 `setup()`。

### 8.4 dependsOn 应该怎么用

`dependsOn` 不是“引用一下名字”的装饰字段，而是系统顺序控制器。

示例：

- `retriever` 依赖 `store`
- `memory-router` 依赖 `store` 和 `embedding`
- `memory-tools` 本身不应是 module，而应作为 tool 通过容器拿服务

如果某个 module 在 `setup()` 里需要从容器中读取其他服务，那它就应该在 `dependsOn` 里明确声明。

### 8.5 module 的推荐粒度

不要太粗，也不要太碎。

推荐标准：

- 一个 module 对应一个“稳定能力域”
- 一个 module 的名字应该能作为架构词汇存在

好的例子：

- `store`
- `embedding`
- `retriever`
- `compactor`
- `session`
- `telemetry`

不好的例子：

- `utils`
- `helpers`
- `misc`
- `logic1`

---

## 9. tool 应该怎么设计

### 9.1 tool 的定位

tool 是对 LLM 暴露的能力边界。

因此一个好的 tool 应该：

- 描述清晰
- 输入明确
- 副作用可预期
- 逻辑薄
- 尽量调用 module 中的服务，而不是在 tool 文件里写重逻辑

### 9.2 tool 的结构

在 `framework/src/framework/core/types.ts` 中，`ToolDefinition` 包含：

- `name`
- `description`
- `priority`
- `schema`
- `execute(params, context)`

### 9.3 priority 的意义

当前内核对 tool 采用按 `priority` 降序注册。

这为将来的高级能力预留了空间，例如：

- 同名 tool 冲突处理
- 覆盖式注册
- 分层策略

当前版本里它主要用于保持框架语义一致性。

### 9.4 tool 的最佳实践

1. schema 描述必须尽量清楚。
2. 不要在 execute 中 new 重型对象。
3. 依赖尽量从容器读取。
4. 对外返回值要稳定。
5. tool 是边界层，不是业务内核。

---

## 10. hook 应该怎么设计

### 10.1 hook 的定位

hook 用于响应主机事件，例如：

- `before_agent_start`
- `after_tool_call`
- `agent_end`
- `before_compaction`

它是主机到应用的事件桥。

### 10.2 hook 的结构

`HookDefinition` 关键字段：

- `name`
- `event`
- `priority`
- `handle(payload, context)`

### 10.3 hook 的最佳实践

1. hook 只做事件编排，不做重业务。
2. 复杂逻辑应下沉到 module service。
3. hook 的副作用要可观测。
4. 同一事件多个 hook 时，用 priority 控制顺序。

### 10.4 一个重要建议

如果你发现 hook 文件越来越大，通常说明：

- 你缺少一个 domain module
- 或者把 orchestration 写成了 business logic

这时应该重构，而不是继续堆 if/else。

---

## 11. command 应该怎么设计

command 是给人类用的，不是给模型用的。

适合放在 command 的内容：

- 诊断
- 导出
- 清理
- 修复
- 手动触发某个任务

不适合放在 command 的内容：

- 只给程序内部调用的逻辑
- 应被复用的领域核心

command 应该尽量调用 module service，而不是自带一份私有实现。

---

## 12. 容器应该怎样使用

容器接口定义在 `framework/src/framework/core/types.ts`，实现位于 `framework/src/framework/core/container.ts`。

当前支持：

- `register(key, value)`
- `resolve(key)`
- `tryResolve(key)`
- `has(key)`
- `entries()`

### 推荐用法

在 module 中注册服务：

```ts
context.container.register("retriever", retrieverService);
```

在 tool/hook/command 中解析：

```ts
const retriever = context.container.resolve<RetrieverService>("retriever");
```

### 当前版本的限制

当前容器是字符串 key 的轻量 Map 容器。

这意味着：

- 简单直接
- 但还没有 token 类型安全

未来应该演进为 capability token 或 symbol token 机制。

但在原型阶段，这个实现是合理的，因为它降低了抽象成本，足以验证框架形态。

---

## 13. diagnostics 应该怎么用

`diagnostics` 是框架可观测性的起点。

在 `framework/src/framework/core/types.ts` 中，它包含：

- `loadedModules`
- `loadedTools`
- `loadedHooks`
- `loadedCommands`
- `timings`
- `failures`

### 它的价值

1. 你可以知道系统到底加载了什么。
2. 你可以知道启动时间花在哪。
3. 你可以知道失败发生在哪个单元。
4. 你可以把它暴露给 command 做运行时诊断。

当前示例 `framework/src/example-app/commands/status.command.ts` 就是这样做的。

在成熟系统里，这块还应继续扩展成：

- health 状态
- 模块版本
- 宿主能力快照
- 资源占用摘要
- 配置指纹

---

## 14. HostAdapter 应该怎么理解

框架中非常关键的一点是：

`内核不直接依赖 OpenClaw API，而是依赖 HostAdapter。`

定义见 `framework/src/framework/core/types.ts`：

- `registerTool()`
- `registerHook()`
- `registerCommand()`

这意味着框架是“宿主无关的核心 + 宿主相关的适配器”。

### 为什么这很重要

如果内核直接操作 OpenClaw API：

- 测试会更难
- 升级会更痛苦
- 迁移到其他宿主几乎不可能

通过适配器层，框架获得两个巨大好处：

1. 可以用 `MockHostAdapter` 做本地测试和演示
2. 可以用 `createOpenClawAdapter()` 对接真实宿主

这就是架构中的“边界隔离”。

---

## 15. 如何接入真实 OpenClaw

当前适配器在：

`framework/src/framework/openclaw/adapter.ts`

接入思路如下：

```ts
import { bootstrapMicrokernel, createOpenClawAdapter, createConsoleLogger } from "...";
import { registry } from "...";

export default {
  id: "my-plugin",
  name: "my-plugin",
  kind: "custom",
  register(api: any) {
    return bootstrapMicrokernel({
      appId: "my-plugin",
      config: api.pluginConfig,
      registry,
      host: createOpenClawAdapter(api),
      logger: createConsoleLogger("my-plugin"),
    });
  },
};
```

### 当前需要注意的一点

`registerCommand()` 对 OpenClaw CLI 的映射目前还是原型方式，后续应该根据宿主真实 CLI API 做更正式的适配。

这不影响框架思想，但在生产接入时要继续增强。

---

## 16. 如何调试一个应用

### 16.1 第一层：看 registry

先看：

`framework/src/generated/registry.ts`

如果你的新文件没有出现在这里，问题通常不是内核，而是：

- 目录不对
- 文件后缀不对
- 没有执行 `generate:registry`

### 16.2 第二层：看 diagnostics

如果 registry 正常，但行为不对，就看：

- `loadedModules`
- `loadedTools`
- `loadedHooks`
- `loadedCommands`
- `timings`
- `failures`

### 16.3 第三层：看 dependsOn

如果模块没有正常准备，很可能是依赖链写错。

例如：

- `greeter` 依赖 `platform`
- 如果忘了写 `dependsOn: ["platform"]`
- 就会在 setup 读取容器时出现时序问题

### 16.4 第四层：看容器键名

当前容器是字符串键。

所以要保证：

- 注册键一致
- 解析键一致
- 不要随手改名字

---

## 17. 团队开发时的推荐规则

如果这个框架要给一个团队长期使用，建议立下以下规约。

### 17.1 任何共享能力优先做成 module

不要在多个 tool 文件里复制逻辑。

### 17.2 边界文件保持薄

- tool 薄
- hook 薄
- command 薄

厚的是 module。

### 17.3 每个 module 只能讲清一个能力域

不要出现“超级模块”。

### 17.4 registry 文件不应手工维护

`src/generated/registry.ts` 应视为生成产物。

### 17.5 bootstrap 文件保持极薄

理想状态下，bootstrap 只做这几件事：

- 准备 config
- 准备 host
- 准备 logger
- 调用 `bootstrapMicrokernel()`

不要把业务再写回 bootstrap。

---

## 18. 当前版本最适合做什么

这版框架最适合用来：

- 作为新的 OpenClaw 插件底座
- 作为现有插件的重构目标
- 作为团队统一的插件工程结构
- 作为未来多插件生态的内核原型

它当前还不适合直接宣称“生产就绪平台”，原因不是方向错，而是还缺少一些工程能力。

---

## 19. 当前版本还缺什么

从架构成熟度来看，下一批值得补的能力是：

1. 多应用支持
   当前扫描的是单个 `example-app` 根目录。

2. capability token
   替代字符串容器键，提高类型安全和重构安全。

3. schema 验证
   对 module/tool/hook/command 定义做更正式校验。

4. 更强的 OpenClaw adapter
   尤其是 command 映射与宿主事件类型收敛。

5. 测试工具包
   支持只启动部分 module、模拟 hook、断言 diagnostics。

6. 配置模型
   当前 config 只是传入对象，后续应补 config schema + normalize + validate。

---

## 20. 一套推荐的开发流程

如果你未来要基于它开发真正的插件，我建议这样做：

1. 先识别领域能力边界
   例如 store、embedding、router、retriever、compactor、telemetry。

2. 把这些能力做成 module
   每个 module 负责初始化并向容器暴露服务。

3. 再定义对外边界
   哪些是 tool，哪些是 hook，哪些是 command。

4. 让边界层只编排，不承载复杂业务

5. 通过 registry 自动装配

6. 用 diagnostics 和 command 做运行时审计

这条路径的本质是：

`先建能力内核，再建交互边界，最后交给框架装配。`

---

## 21. 一个架构师视角下的最终建议

真正高级的框架从来不是“减少 import 数量”这么简单。

它要解决的是：

- 如何让能力被稳定组织
- 如何让演进不依赖个人记忆
- 如何让团队在扩展系统时不把边界破坏掉
- 如何让系统能够持续增长但不失控

因此，使用这个框架时你要记住三条总原则：

1. `把业务下沉到 module，把边界留给 tool/hook/command。`
2. `把自动发现放在构建期，把确定性留给运行时。`
3. `把宿主差异隔离在 adapter，把框架核心保持纯净。`

只要守住这三条，这个框架就能承载的不只是一个插件，而是一整条插件产品线。

---

## 22. 快速索引

如果你只想快速定位代码入口：

- 框架启动器：`framework/src/framework/core/kernel.ts`
- 类型契约：`framework/src/framework/core/types.ts`
- 定义函数：`framework/src/framework/core/definition.ts`
- Host 适配器：`framework/src/framework/openclaw/adapter.ts`
- 注册表生成脚本：`framework/scripts/generate-registry.mjs`
- 注册表产物：`framework/src/generated/registry.ts`
- 示例启动入口：`framework/src/example-app/bootstrap.ts`
- 示例 module：`framework/src/example-app/modules/`
- 示例 tool：`framework/src/example-app/tools/`
- 示例 hook：`framework/src/example-app/hooks/`
- 示例 command：`framework/src/example-app/commands/`

---

## 23. 结语

这个框架的正确使用方式，不是把它当成“自动 import 工具”，而是把它当成：

`一个稳定组织 OpenClaw 插件能力的系统级骨架`

当你这样使用它时，目录结构、生成注册表、依赖注入、生命周期、主机适配这些看似分散的东西，才会拼成一个真正可增长的架构。
