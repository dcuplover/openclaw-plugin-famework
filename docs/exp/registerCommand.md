## 2. `registerCommand` 最小示例

```ts
export default function register(api) {
  api.registerCommand({
    name: "hello",
    description: "Reply hello",
    handler: async (commandContext) => {
      return {
        text: `hello ${commandContext?.args ?? ""}`.trim(),
      };
    },
  });
}
```

### 必要项

编写时，必要的是：

- `api.registerCommand({...})`
- `name`
- `handler`

最小必要写法：

```ts
export default function register(api) {
  api.registerCommand({
    name: "hello",
    handler: async (commandContext) => {
      console.log(commandContext?.senderId);
      return { text: "hello" };
    },
  });
}
```

### 建议写

以下不是绝对必要，但建议写：

- `description`
- `acceptsArgs`
- `requireAuth`
- `commandContext.senderId / args / channel`

### 返回值

`handler` 需要返回：

```ts
{ text: "..." }
```

最小必要返回值：

```ts
return { text: "hello" };
```