# 注册 CLI 和 Tool 示例（固定变量说明）

> 目标：给出一个可直接参考的插件入口示例，同时明确哪些变量/签名是框架约定（固定），以及为什么。

## 一、完整示例

```ts
// 这是 OpenClaw 插件入口。
// `register` 这个导出函数是框架约定的入口形式之一。
export default function register(api) {
  // `api` 是 OpenClaw 在加载插件时注入的插件 API 对象。
  // 这里的变量名可以改，但参数位置和对象能力是固定由框架提供。
  api.logger.info(`${api.name} loaded from ${api.source}`);

  // -----------------------------
  // 1) 注册 Tool（给 Agent 调用）
  // -----------------------------
  api.registerTool({
    // `name` 是工具唯一名称（对 Agent 可见），建议使用 snake_case。
    name: "call_you",
    description: "根据输入名称生成一段调用文本。",

    // `parameters` 是 OpenClaw 约定字段：用于定义工具入参 JSON Schema。
    // 如果写成 inputSchema/argsSchema，运行时可能识别不到。
    parameters: {
      type: "object",
      additionalProperties: false,
      properties: {
        // `name` 是业务字段名，可按你的业务改。
        name: {
          type: "string",
          description: "必填姓名",
        },
        // `title` 是业务字段名，可按你的业务改。
        title: {
          type: "string",
          description: "可选称呼前缀",
        },
      },
      required: ["name"],
    },

    // `execute` 是 OpenClaw 约定执行函数名。
    // 签名推荐为 execute(_callId, params)：
    // - 第一个参数是调用上下文 ID（通常不用可写 _callId）
    // - 第二个参数是按 parameters 校验后的入参对象
    async execute(_callId, params) {
      const rawName = typeof params?.name === "string" ? params.name : "";
      const rawTitle = typeof params?.title === "string" ? params.title : "";
      const name = rawName.trim();
      const title = rawTitle.trim();

      if (!name) {
        // Tool 返回结构建议固定为 { content: [...] }。
        return {
          content: [{ type: "text", text: "`name` 不能为空。" }],
        };
      }

      const result = title ? `${title} ${name}` : name;
      return {
        content: [{ type: "text", text: `Calling ${result}` }],
      };
    },
  });

  // -----------------------------
  // 2) 注册 CLI 命令
  // -----------------------------
  api.registerCli(
    // 这个回调由框架调用，参数对象由框架注入。
    // 常见写法是解构出 `program`（Commander 实例）。
    ({ program }) => {
      // `program.command(...)` 是 Commander 的固定 API。
      program
        .command("say-hi")
        .description("Print greeting from plugin CLI")
        .option("-n, --name <name>", "Name to greet", "OpenClaw")
        .action((opts) => {
          // `opts` 为 Commander 解析后的参数对象。
          console.log(`Hi, ${opts.name}!`);
        });
    },
    {
      // `commands` 用于声明本插件注册了哪些 CLI 命令（便于框架管理和展示）。
      commands: ["say-hi"],
    },
  );
}
```

## 二、哪些是“固定”的，哪些可改

## 1) 框架约定（建议视为固定）

1. `export default function register(...)`：入口约定。
2. `api.registerTool(...)`、`api.registerCli(...)`：注册方法名固定。
3. Tool 定义里的 `name`、`description`、`parameters`、`execute`：关键字段名固定。
4. Tool 返回结构 `content: [{ type: "text", text: "..." }]`：推荐固定，兼容性最好。
5. CLI 注册时回调拿到的 `program`：由框架/Commander 提供的标准对象。

## 2) 业务可自定义

1. Tool 名称值（如 `call_you`）可以改，但应遵循命名规范。
2. `parameters.properties` 下的业务字段（如 `name`、`title`）可以改。
3. CLI 命令名（如 `say-hi`）和 option（如 `--name`）可以改。
4. execute/action 内部实现逻辑完全可按业务扩展。

## 三、常见错误对照

1. 错误：Tool 用 `inputSchema` + `handler`。
正确：Tool 用 `parameters` + `execute`。

2. 错误：Tool 返回普通对象 `{ ok: true }` 导致上层不易解析。
正确：优先返回 `{ content: [{ type: "text", text: "..." }] }`。

3. 错误：`openclaw.plugin.json` 中 `configSchema` 过严，导致配置被拒绝。
正确：确保 `configSchema` 与 `plugins.entries.<id>.config` 的实际字段一致。

## 四、插件配置项示例：在 `openclaw.plugin.json` 中声明 `age`

如果你希望用户在 `openclaw.json` 中为插件配置一个变量，比如 `age`，那么第一步不是在 `index.ts` 里直接读，而是先在插件 manifest 里声明这个字段。

### 1) `openclaw.plugin.json` 中如何配置

`configSchema` 用来校验 `openclaw.json` 里 `plugins.entries.<插件 id>.config` 的内容。

例如当前插件 `id` 为 `my-plugin`，希望用户必须提供一个整数类型的 `age`，可以这样写：

```json
{
  "id": "my-plugin",
  "name": "My Plugin",
  "description": "A minimal custom plugin",
  "version": "0.1.0",
  "configSchema": {
    "type": "object",
    "additionalProperties": false,
    "properties": {
      "age": {
        "type": "integer",
        "description": "Required age value provided from openclaw.json.",
        "minimum": 0
      }
    },
    "required": ["age"]
  }
}
```

这里几项最关键：

1. `properties.age`：声明插件支持的配置字段名叫 `age`。
2. `type: "integer"`：限制它必须是整数。
3. `required: ["age"]`：表示用户必须配置这个字段。
4. `additionalProperties: false`：只允许 schema 中声明过的字段，避免写错字段名却不自知。

对应的 `openclaw.json` 示例：

```json
{
  "plugins": {
    "entries": {
      "my-plugin": {
        "enabled": true,
        "config": {
          "age": 18
        }
      }
    }
  }
}
```

也就是说：

`openclaw.plugin.json` 负责“声明和校验配置结构”，而 `openclaw.json` 负责“真正填写配置值”。

### 2) `index.ts` 中如何使用

当插件加载后，`openclaw.json` 中该插件的 `config` 会注入到 `api.pluginConfig`。

所以在 `index.ts` 里，应当通过 `api.pluginConfig?.age` 读取：

```ts
export default function register(api: any) {
  api.registerTool({
    name: "call_you",
    description: "测试读取插件配置 age。",
    parameters: {
      type: "object",
      additionalProperties: false,
      properties: {
        name: {
          type: "string",
          description: "必填姓名",
        },
      },
      required: ["name"],
    },
    execute: async (_callId: unknown, params: Record<string, unknown>) => {
      const configuredAge = api.pluginConfig?.age;
      const rawName = typeof params?.name === "string" ? params.name : "";
      const name = rawName.trim();

      if (!Number.isInteger(configuredAge) || configuredAge < 0) {
        return {
          content: [
            {
              type: "text",
              text: "`age` must be configured as a non-negative integer in openclaw.json.",
            },
          ],
        };
      }

      if (!name) {
        return {
          content: [{ type: "text", text: "`name` 不能为空。" }],
        };
      }

      return {
        content: [{ type: "text", text: `Calling ${name}, age ${configuredAge}` }],
      };
    },
  });
}
```

这里的关键点是：

1. `api.pluginConfig`：这是插件专属配置入口，对应 `plugins.entries.<id>.config`。
2. `api.pluginConfig?.age`：读取当前插件在 `openclaw.json` 中配置的 `age`。
3. 运行时最好再做一次校验：即使 manifest 已经声明了 schema，执行时做兜底仍然更稳妥。
4. 返回值中可以直接带上 `age`，例如：`Calling Alice, age 18`。

### 3) 一句话总结

如果一个变量需要在 `openclaw.json` 中配置并在插件里使用，标准做法就是：

1. 在 `openclaw.plugin.json` 的 `configSchema` 里声明它。
2. 在 `openclaw.json` 的 `plugins.entries.<id>.config` 中填写它。
3. 在 `index.ts` 中通过 `api.pluginConfig` 读取它。

## 五、最小测试清单

1. 重载插件后确认启动日志输出正常。
2. 调用 Tool：`name` 必填场景可返回结果。
3. 调用 Tool：缺少 `name` 时返回清晰错误文本。
4. 若 `openclaw.json` 中未配置 `age`，Tool 返回清晰配置错误。
5. 若 `openclaw.json` 中配置了合法 `age`，返回结果中包含该值。
6. 执行 CLI：`say-hi --name Alice` 输出 `Hi, Alice!`。
