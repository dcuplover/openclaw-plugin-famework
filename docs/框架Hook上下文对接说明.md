# 框架 Hook 上下文对接说明

本文说明在 `openclaw-plugin-famework` 中，插件层如何正确读取 OpenClaw hook 的 `event` 与 `ctx` 参数。

## 适用范围

本文面向使用框架 `defineHook()` 编写 hook 的插件作者。

如果你的插件运行在 OpenClaw 宿主下，推荐直接使用框架导出的 `defineOpenClawHook()` 与 `OpenClawHookContext`，这样第三个参数会有明确的类型提示。

## 推荐导入方式

在 OpenClaw 插件里，优先使用下面这组导入：

```ts
import {
  defineOpenClawHook,
  type OpenClawHookContext,
} from "../framework/openclaw/adapter";
```

如果你是在包对外导出的入口上使用，也可以从框架主出口导入：

```ts
import {
  defineOpenClawHook,
  type OpenClawHookContext,
} from "@dcuplover/openclaw-microkernel-framework";
```

推荐顺序如下：

- 框架内部源码中开发插件: 从 `../framework/openclaw/adapter` 导入
- 作为外部 npm 包使用框架: 从 `@dcuplover/openclaw-microkernel-framework` 导入

不建议继续把第三个参数写成 `any`，也不建议在 OpenClaw 插件里只使用无类型的 `defineHook()`。

从当前版本开始，框架会把三个维度的数据一起传给 hook：

1. `event`: OpenClaw hook 的事件数据
2. `runtimeContext`: 框架运行时上下文
3. `hookContext`: OpenClaw 宿主传入的原始 hook 上下文

对应签名如下：

```ts
handle(event, runtimeContext, hookContext)
```

更推荐的 OpenClaw 写法是：

```ts
import { defineOpenClawHook, type OpenClawHookContext } from "../framework/openclaw/adapter";
```

## 三个参数分别是什么

### 1. `event`

`event` 表示本次 hook 触发的业务事件内容。

常见字段示例：

- `event.prompt`
- `event.messages`
- `event.toolName`
- `event.params`
- `event.result`
- `event.message`

### 2. `runtimeContext`

`runtimeContext` 是这个框架自己的运行时上下文，用于访问容器、配置、日志与诊断数据。

常见用法：

- `runtimeContext.config`
- `runtimeContext.logger`
- `runtimeContext.container`
- `runtimeContext.diagnostics`
- `runtimeContext.host`

### 3. `hookContext`

`hookContext` 是 OpenClaw 宿主传入的原始上下文，身份字段通常在这里。

常见字段示例：

- `hookContext.sessionId`
- `hookContext.sessionKey`
- `hookContext.agentId`
- `hookContext.workspaceDir`
- `hookContext.messageProvider`
- `hookContext.trigger`
- `hookContext.channelId`

## 最重要的规则

身份字段优先从 `hookContext` 取，不要从 `event` 里猜。

推荐分工如下：

- 事件内容: 从 `event` 取
- 运行时服务: 从 `runtimeContext` 取
- 会话和 Agent 标识: 从 `hookContext` 取

## 推荐写法

```ts
import { defineOpenClawHook, type OpenClawHookContext } from "../framework/openclaw/adapter";

function normalizeAgentHookInput(event: unknown, hookContext?: OpenClawHookContext) {
  return {
    prompt: (event as { prompt?: string } | undefined)?.prompt ?? "",
    messages: Array.isArray((event as { messages?: unknown[] } | undefined)?.messages)
      ? (event as { messages?: unknown[] }).messages
      : [],
    sessionId: hookContext?.sessionId ?? null,
    sessionKey: hookContext?.sessionKey ?? null,
    agentId: hookContext?.agentId ?? null,
    workspaceDir: hookContext?.workspaceDir ?? null,
    messageProvider: hookContext?.messageProvider ?? null,
    trigger: hookContext?.trigger ?? null,
    channelId: hookContext?.channelId ?? null,
  };
}

export default defineOpenClawHook({
  kind: "hook",
  name: "track_before_agent_start",
  event: "before_agent_start",
  async handle(event, runtimeContext, hookContext) {
    const input = normalizeAgentHookInput(event, hookContext);

    runtimeContext.logger.info("before_agent_start observed", {
      sessionId: input.sessionId,
      sessionKey: input.sessionKey,
      agentId: input.agentId,
      prompt: input.prompt,
      hasMessages: input.messages.length > 0,
    });
  },
});
```

## 可复用类型

框架现在提供以下 OpenClaw 专用类型与助手：

- `OpenClawHookContext`
- `OpenClawHookDefinition<TConfig>`
- `defineOpenClawHook()`

推荐优先用它们，而不是手动把第三个参数标成 `any`。

## 常见 hook 的取值建议

### `before_model_resolve`

推荐读取：

- `event.prompt`
- `hookContext.sessionId`
- `hookContext.sessionKey`
- `hookContext.agentId`

适合做模型路由、provider 选择、轻量策略判断。

### `before_prompt_build`

推荐读取：

- `event.prompt`
- `event.messages`
- `hookContext.sessionId`
- `hookContext.sessionKey`
- `hookContext.agentId`

适合做 prompt shaping、系统提示拼装、消息上下文增强。

### `before_agent_start`

这是 legacy hook。

如果你还在使用它，仍然应该遵循相同规则：

- `prompt/messages` 从 `event` 取
- `sessionId/sessionKey/agentId` 从 `hookContext` 取

## 不推荐的写法

以下路径不要当成稳定来源：

- `event.sessionId`
- `event.session_id`
- `event.session.id`
- `event.conversationId`
- `event.conversation_id`
- `event.conversation.id`
- `event.agentId`
- `event.agent_id`
- `event.agent.id`

这些路径可能在某些宿主事件里为空，或者根本不存在。

## 一个更贴近业务的模板

```ts
import { defineOpenClawHook } from "../framework/openclaw/adapter";

export default defineOpenClawHook({
  kind: "hook",
  name: "route_model_before_prompt_build",
  event: "before_prompt_build",
  async handle(event, runtimeContext, hookContext) {
    const prompt = event?.prompt ?? "";
    const messages = Array.isArray(event?.messages) ? event.messages : [];
    const sessionId = hookContext?.sessionId ?? null;
    const agentId = hookContext?.agentId ?? null;

    runtimeContext.logger.info("hook input", {
      sessionId,
      agentId,
      promptLength: prompt.length,
      messageCount: messages.length,
    });

    if (prompt.includes("写代码")) {
      runtimeContext.logger.info("code-oriented prompt detected", {
        sessionId,
        agentId,
      });
    }
  },
});
```

## 迁移建议

如果你原来写的是只接两个参数的 hook：

```ts
handle(payload, context)
```

现在可以迁移为：

```ts
handle(event, runtimeContext, hookContext)
```

其中：

- 旧的 `context` 对应新的 `runtimeContext`
- OpenClaw 的身份字段从新增的 `hookContext` 中读取

旧代码如果不需要 `hookContext`，可以不使用第三个参数。

如果你想保留通用框架写法，也可以继续使用：

```ts
defineHook<TConfig, OpenClawHookContext>({ ... })
```

但在 OpenClaw 插件里，`defineOpenClawHook()` 更直接。

## 最后一条判断标准

如果你需要的是：

- 配置、日志、容器服务: 看 `runtimeContext`
- prompt、messages、tool params: 看 `event`
- sessionId、sessionKey、agentId: 看 `hookContext`

按这个规则写，基本不会再走到错误字段路径上。