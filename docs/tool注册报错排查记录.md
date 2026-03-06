# Tool 注册报错排查记录

> 记录时间：2026-03-06
> 适用项目：`my-plugin`

## 一、问题现象

在扩展插件并注册 `call_you` 工具后，出现了两类错误：

1. 插件配置校验错误

```text
Problem:
  - plugins.entries.my-plugin.config: invalid config: <root>: must NOT have additional properties
```

2. 工具运行时报错

```text
Cannot read properties of undefined (reading 'properties')
```

---

## 二、根因分析

### 1) 配置校验错误的根因

`openclaw.plugin.json` 中的 `configSchema` 配置为：

- `additionalProperties: false`
- `properties: {}`

这表示插件配置对象必须是空对象，任何额外字段都会被判定为非法，从而触发：
`must NOT have additional properties`。

### 2) 工具运行时报错的根因

最初工具定义使用了：

- `inputSchema`
- `handler`

但 OpenClaw 插件工具的推荐/兼容字段是：

- `parameters`
- `execute(_id, params)`

运行时在读取工具参数 schema 时，预期字段不存在，导致读取 `properties` 时出现 `undefined` 错误。

---

## 三、实际修改内容

## 1) 修改插件配置 schema

文件：`openclaw.plugin.json`

将：

```json
"additionalProperties": false
```

改为：

```json
"additionalProperties": true
```

目的：先放开 `plugins.entries.my-plugin.config` 的字段，避免因空 schema 拒绝所有配置。

## 2) 修正工具注册字段

文件：`index.ts`

关键调整：

1. `inputSchema` -> `parameters`
2. `handler` -> `execute(_callId, params)`
3. 返回结构调整为 OpenClaw 工具结果格式：

```ts
return {
  content: [
    {
      type: "text",
      text: "...",
    },
  ],
};
```

4. 保留输入规范化和兜底校验逻辑（`name` 必填）。

---

## 四、修复后核心代码（节选）

```ts
api.registerTool({
  name: "call_you",
  description: "当用户需要测试调用工具时，可以使用这个工具来验证输入输出的规范性。",
  parameters: {
    type: "object",
    additionalProperties: false,
    properties: {
      name: { type: "string", description: "必填的名称，用于调用工具时验证输入规范。" },
      title: { type: "string", description: "可选的标题或后缀，用于验证输入规范。" },
    },
    required: ["name"],
  },
  execute: async (_callId, params) => {
    const rawName = typeof params?.name === "string" ? params.name : "";
    const rawTitle = typeof params?.title === "string" ? params.title : "";
    const name = rawName.trim();
    const title = rawTitle.trim();

    if (!name) {
      return {
        content: [{ type: "text", text: "`name` is required and must be a non-empty string." }],
      };
    }

    const calledText = title ? `${title} ${name}` : name;
    return {
      content: [{ type: "text", text: `Calling ${calledText}` }],
    };
  },
});
```

---

## 五、验证结果与复测建议

当前验证：

- `index.ts` 静态检查无报错（`No errors found`）。

建议复测步骤：

1. 重启/重载 OpenClaw，确保插件重新加载。
2. 调用 `call_you`，仅传 `name`，应返回 `Calling <name>`。
3. 调用 `call_you`，传 `name + title`，应返回 `Calling <title> <name>`。
4. 传空 `name`，应返回明确错误提示文本。

---

## 六、经验总结

1. `openclaw.plugin.json` 的 `configSchema` 要与实际 `plugins.entries.<id>.config` 一致，否则会在启动时被校验拦截。
2. 插件 Tool 注册优先使用官方文档示例字段：`parameters + execute`。
3. Tool 返回结构建议固定为 `content[]`，便于运行时和模型稳定解析。
4. 新增功能后优先做两类验证：
   - 配置加载校验
   - Tool 运行时调用校验
