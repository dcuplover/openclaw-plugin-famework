# OpenClaw Hook 插件取值指南

本文总结 OpenClaw 插件 hook 中 **event（事件参数）** 与 **ctx（上下文参数）** 的取值方式，重点说明：

- `sessionId`、`sessionKey`、`agentId` 应该从哪里取
- 常见 hook 的参数名是什么
- `before_agent_start` / `before_model_resolve` / `before_prompt_build` 的差异
- 如何写一个兼容当前源码的 normalize 方法

---

## 结论先说

在 OpenClaw 的 **typed plugin hooks** 里：

- **事件数据** 放在第一个参数 `event`
- **运行上下文 / 标识字段** 放在第二个参数 `ctx`

因此：

- `sessionId` → `ctx.sessionId`
- `sessionKey` → `ctx.sessionKey`
- `agentId` → `ctx.agentId`
- `workspaceDir` → `ctx.workspaceDir`
- `messageProvider` → `ctx.messageProvider`
- `trigger` → `ctx.trigger`
- `channelId` → `ctx.channelId`

**不要**从 `event.sessionId`、`event.agent.id`、`event.conversation.id` 这类路径里找。  
在当前 OpenClaw 源码中，这些字段通常不在 `event` 里。

---

## 一、核心原则：event 和 ctx 分工不同

### 1. `event`
`event` 表示“这次 hook 触发的事件内容”。

例如在 agent 生命周期 hook 中，常见内容有：

- `prompt`
- `messages`
- `toolName`
- `params`
- `result`
- `message`

### 2. `ctx`
`ctx` 表示“这次运行的上下文信息”。

例如：

- `agentId`
- `sessionId`
- `sessionKey`
- `workspaceDir`
- `messageProvider`
- `trigger`
- `channelId`

---

## 二、源码依据

### 1. `before_agent_start` 的签名

```ts
before_agent_start: (
  event: PluginHookBeforeAgentStartEvent,
  ctx: PluginHookAgentContext,
) => Promise<PluginHookBeforeAgentStartResult | void> | PluginHookBeforeAgentStartResult | void;
```

这说明 `before_agent_start` 的第二个参数就是 `PluginHookAgentContext`。

### 2. 运行时实际传入的上下文

在 `src/agents/pi-embedded-runner/run.ts` 中，OpenClaw 明确构造了 `hookCtx`：

```ts
const hookCtx = {
  agentId: workspaceResolution.agentId,
  sessionKey: params.sessionKey,
  sessionId: params.sessionId,
  workspaceDir: resolvedWorkspace,
  messageProvider: params.messageProvider ?? undefined,
  trigger: params.trigger,
  channelId: params.messageChannel ?? params.messageProvider ?? undefined,
};
```

然后把它传给 hook：

```ts
legacyBeforeAgentStartResult = await hookRunner.runBeforeAgentStart(
  { prompt: params.prompt },
  hookCtx,
);
```

这意味着：

- `event` 中只有 `prompt`
- `agentId/sessionId/sessionKey/...` 都在 `ctx`

---

## 三、你最关心的字段应该怎么取

| 目标信息 | 正确取值 | 备注 |
|---|---|---|
| 会话 ID | `ctx.sessionId` | 当前会话的 UUID / 临时 session 标识 |
| 会话键 | `ctx.sessionKey` | 稳定的 session key |
| Agent ID | `ctx.agentId` | 当前 agent 标识 |
| 工作区 | `ctx.workspaceDir` | 当前 agent/workspace 路径 |
| 消息来源 | `ctx.messageProvider` | 如 telegram / discord / webhook 等 |
| 触发来源 | `ctx.trigger` | 某些 agent hook 可用 |
| 渠道 ID | `ctx.channelId` | 某些 agent hook 可用 |

---

## 四、不同 hook 的参数说明

---

### A. `before_model_resolve`

**用途：**
在模型解析前拦截，适合改 `providerOverride` / `modelOverride`。

**参数：**
- `event.prompt`
- `ctx.agentId`
- `ctx.sessionId`
- `ctx.sessionKey`
- `ctx.workspaceDir`
- `ctx.messageProvider`
- `ctx.trigger`
- `ctx.channelId`

**特点：**
- 还没加载完整 session
- **没有 `messages`**
- 适合做“根据用户 prompt / session 决定模型”的逻辑

**示例：**

```ts
api.on("before_model_resolve", async (event, ctx) => {
  const prompt = event.prompt;
  const agentId = ctx.agentId;
  const sessionId = ctx.sessionId;
  const sessionKey = ctx.sessionKey;

  if (prompt?.includes("写代码")) {
    return {
      providerOverride: "openai",
      modelOverride: "gpt-5.2-mini",
    };
  }
});
```

---

### B. `before_prompt_build`

**用途：**
在 prompt 最终构建前处理上下文。适合注入系统提示、上下文拼接等。

**参数：**
- `event.prompt`
- `event.messages`
- `ctx.agentId`
- `ctx.sessionId`
- `ctx.sessionKey`
- `ctx.workspaceDir`
- `ctx.messageProvider`
- `ctx.trigger`
- `ctx.channelId`

**特点：**
- 比 `before_model_resolve` 更晚
- **有 `messages`**
- 推荐用于 prompt shaping

**示例：**

```ts
api.on("before_prompt_build", async (event, ctx) => {
  const { prompt, messages } = event;
  const { agentId, sessionId, sessionKey } = ctx;

  return {
    prependSystemContext: [
      `agentId=${agentId ?? ""}`,
      `sessionId=${sessionId ?? ""}`,
      `sessionKey=${sessionKey ?? ""}`,
    ].join("\n"),
  };
});
```

---

### C. `before_agent_start`（legacy）

**用途：**
兼容旧逻辑。当前仍可用，但官方更推荐 `before_model_resolve` 和 `before_prompt_build`。

**参数：**
在不同阶段可能略有差异：

#### 情况 1：model resolve 阶段
- `event.prompt`
- 没有 `event.messages`
- `ctx.*` 完整可取

#### 情况 2：prompt build 阶段
- `event.prompt`
- `event.messages`
- `ctx.*` 完整可取

**最重要结论：**
`sessionId / sessionKey / agentId` 仍然在 `ctx`，不在 `event`。

**示例：**

```ts
api.on("before_agent_start", async (event, ctx) => {
  const prompt = event.prompt;
  const messages = event.messages;
  const sessionId = ctx.sessionId;
  const sessionKey = ctx.sessionKey;
  const agentId = ctx.agentId;

  api.logger.info?.(
    JSON.stringify({
      prompt,
      hasMessages: Array.isArray(messages),
      sessionId,
      sessionKey,
      agentId,
    }),
  );
});
```

---

## 五、其他常见 hook 的字段来源

---

### 1. `before_tool_call`

**event:**
- `event.toolName`
- `event.params`
- `event.runId`
- `event.toolCallId`

**ctx:**
- `ctx.agentId`
- `ctx.sessionKey`
- `ctx.sessionId`
- `ctx.runId`
- `ctx.toolName`
- `ctx.toolCallId`

**示例：**

```ts
api.on("before_tool_call", async (event, ctx) => {
  const toolName = event.toolName;
  const params = event.params;
  const sessionId = ctx.sessionId;
  const agentId = ctx.agentId;
});
```

---

### 2. `after_tool_call`

**event:**
- `event.toolName`
- `event.params`
- `event.result`
- `event.error`
- `event.durationMs`
- `event.runId`
- `event.toolCallId`

**ctx:**
- `ctx.agentId`
- `ctx.sessionKey`
- `ctx.sessionId`
- `ctx.runId`
- `ctx.toolName`
- `ctx.toolCallId`

---

### 3. `session_start`

**event:**
- `event.sessionId`
- `event.sessionKey`
- `event.resumedFrom`

**ctx:**
- `ctx.sessionId`
- `ctx.sessionKey`
- `ctx.agentId`

这里 `sessionId` 在 `event` 和 `ctx` 里都可能有；但建议优先遵循各 hook 的语义使用。

---

### 4. `session_end`

**event:**
- `event.sessionId`
- `event.sessionKey`
- `event.messageCount`
- `event.durationMs`

**ctx:**
- `ctx.sessionId`
- `ctx.sessionKey`
- `ctx.agentId`

---

### 5. `before_message_write`

**event:**
- `event.message`
- `event.sessionKey`
- `event.agentId`

**ctx:**
- `ctx.sessionKey`
- `ctx.agentId`

这个 hook 比较特殊，有些标识字段 event 和 ctx 都可能有。

---

## 六、推荐的 normalize 方式

如果你在插件里想统一取值，**不要只 normalize payload/event**。  
正确方式是同时处理 `event + ctx`。

### 推荐实现

```ts
function normalizeAgentHookInput(event: any, ctx: any) {
  return {
    prompt: event?.prompt,
    messages: Array.isArray(event?.messages) ? event.messages : undefined,

    sessionId: ctx?.sessionId,
    sessionKey: ctx?.sessionKey,
    agentId: ctx?.agentId,
    workspaceDir: ctx?.workspaceDir,
    messageProvider: ctx?.messageProvider,
    trigger: ctx?.trigger,
    channelId: ctx?.channelId,
  };
}
```

### 使用方式

```ts
api.on("before_agent_start", async (event, ctx) => {
  const input = normalizeAgentHookInput(event, ctx);

  api.logger.info?.(JSON.stringify(input, null, 2));
});
```

---

## 七、不推荐的取值方式

下面这些路径在当前 OpenClaw 里**不可靠**，不要依赖：

- `event.sessionId`
- `event.session_id`
- `event.session.id`
- `event.conversationId`
- `event.conversation_id`
- `event.conversation.id`
- `event.agentId`
- `event.agent_id`
- `event.agent.id`

原因很简单：当前源码并没有把这些身份字段放进 `before_agent_start` 的 `event`。

---

## 八、推荐实践

### 1. 需要身份字段时，永远先看 `ctx`
尤其是这些字段：

- `sessionId`
- `sessionKey`
- `agentId`

### 2. 需要 prompt / messages 时，看 `event`
- `event.prompt`
- `event.messages`

### 3. 新逻辑优先用新 hook
官方推荐顺序：

- `before_model_resolve`
- `before_prompt_build`
- `before_agent_start` 仅作 legacy 兼容

### 4. 写容错代码
OpenClaw 某些 hook / 某些阶段下，不是所有字段都保证存在。建议这样写：

```ts
const sessionId = ctx?.sessionId ?? null;
const sessionKey = ctx?.sessionKey ?? null;
const agentId = ctx?.agentId ?? null;
const prompt = event?.prompt ?? "";
const messages = Array.isArray(event?.messages) ? event.messages : [];
```

---

## 九、可直接复制的模板

```ts
export default function register(api) {
  function normalizeAgentHookInput(event: any, ctx: any) {
    return {
      prompt: event?.prompt ?? "",
      messages: Array.isArray(event?.messages) ? event.messages : undefined,

      sessionId: ctx?.sessionId ?? null,
      sessionKey: ctx?.sessionKey ?? null,
      agentId: ctx?.agentId ?? null,
      workspaceDir: ctx?.workspaceDir ?? null,
      messageProvider: ctx?.messageProvider ?? null,
      trigger: ctx?.trigger ?? null,
      channelId: ctx?.channelId ?? null,
    };
  }

  api.on("before_model_resolve", async (event, ctx) => {
    const input = normalizeAgentHookInput(event, ctx);
    api.logger.info?.(`[before_model_resolve] ${JSON.stringify(input)}`);
  });

  api.on("before_prompt_build", async (event, ctx) => {
    const input = normalizeAgentHookInput(event, ctx);
    api.logger.info?.(`[before_prompt_build] ${JSON.stringify(input)}`);
  });

  api.on("before_agent_start", async (event, ctx) => {
    const input = normalizeAgentHookInput(event, ctx);
    api.logger.info?.(`[before_agent_start] ${JSON.stringify(input)}`);
  });
}
```

---

## 十、最终一句话总结

**在 OpenClaw hook 插件里，`sessionId` / `sessionKey` / `agentId` 这类标识字段要从 `ctx` 取，不要从 `event/payload` 取。**

- 事件内容：`event`
- 运行上下文：`ctx`

这是当前源码实现下最稳定、最正确的取值方式。