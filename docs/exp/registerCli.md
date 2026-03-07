# OpenClaw 插件：`registerCli` 与 `registerCommand` 最小示例

## `registerCli` 最小示例

```ts
export default function register(api) {
  api.registerCli(
    ({ program, logger }) => {
      program
        .command("demo")
        .description("Demo CLI command")
        .action(() => {
          logger.info("demo called");
        });
    },
    { commands: ["demo"] }
  );
}
```

### 必要项

编写时，真正必要的是：

- `api.registerCli(...)`
- 回调里使用 `program.command("命令名")` 真正注册命令
- `opts.commands` 最好填写，并且与命令名一致

最小必要写法：

```ts
export default function register(api) {
  api.registerCli(
    ({ program }) => {
      program.command("demo").action(() => {});
    },
    { commands: ["demo"] }
  );
}
```

### 建议写

以下不是绝对必要，但建议写：

- `logger`
- `.description(...)`

### 返回值

- **没有固定必要返回值**
- `.action(() => {})` 中可以不返回任何内容
