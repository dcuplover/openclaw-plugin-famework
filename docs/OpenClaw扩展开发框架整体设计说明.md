# OpenClaw 扩展开发框架整体设计说明

## 1. 文档目的

这份文档用来统一说明本项目未来的产品定位、设计目标、分层方案、包拆分思路，以及脚手架生成能力的整体方向。

一句话概括：

`把 OpenClaw 扩展开发中的宿主接线、生命周期、注册时序、打包校验、样板代码生成等重复劳动收进框架和工具链，让插件作者尽量只编写业务逻辑。`

这不是单纯的工具函数集合，也不是单一示例工程，而是一个面向 OpenClaw 插件开发的应用框架与开发工具体系。

## 2. 要解决的核心问题

在直接开发 OpenClaw 扩展时，插件作者往往需要反复处理下面这些事情：

- 理解宿主 API 的注册方式
- 区分聊天命令、CLI、tool、hook 等不同能力的接入方式
- 处理同步注册与异步初始化之间的时序问题
- 自己维护目录结构、导出聚合、注册清单
- 手工生成或同步 `package.json`、`openclaw.plugin.json` 等产物
- 编写大量重复样板代码
- 为测试、诊断、打包和发布做额外接线

这些工作大多不是业务价值本身，但会反复消耗开发者时间。

本项目的目标就是把这些共性复杂度沉到框架层或工具层，让插件作者把注意力集中在以下内容上：

- 我要提供什么能力
- 这段业务逻辑怎么实现
- 这个能力依赖哪些服务
- 最终对用户或模型返回什么结果

## 3. 产品定位

本项目建议长期演进为两类能力的组合：

1. 运行时框架
   负责插件运行期的抽象和装配。

2. 开发工具链
   负责项目初始化、目标文件生成、校验、打包和诊断。

也就是说，未来最理想的使用方式不是让用户手工拼接大量文件，而是：

```bash
npm install openclaw-plugin-framework
npx openclaw-plugin-cli generate command hello
npx openclaw-plugin-cli generate tool greet
npx openclaw-plugin-cli generate hook before-agent-start
```

或者更进一步：

```bash
npx create-openclaw-plugin my-plugin
```

这样，框架负责运行时，CLI 负责建结构、补样板、做校验。

## 4. 设计原则

### 4.1 用户只写业务，框架负责宿主复杂度

插件作者最好只需要声明：

- command
- tool
- hook
- cli
- module
- provider
- route

以及这些能力背后的业务逻辑。

至于宿主如何注册、何时初始化、何时等待 runtime ready、何时生成产物，应尽量由框架和脚手架承担。

### 4.2 同步声明，异步启动

虽然从插件作者视角看，很多能力都属于“插件注册”，但从宿主接入角度看，实际上存在两个不同阶段：

1. 声明阶段
   用来同步告诉宿主当前插件提供哪些能力。

2. 运行时阶段
   用来异步完成容器初始化、模块启动、资源准备、服务创建等工作。

因此，整体模型建议统一成：

- `register()`：同步、纯声明式
- `bootstrap()`：异步、构建 runtime
- `shutdown()`：可选、负责资源回收

这个两阶段模型比堆叠过多顶层 phase 更容易让用户理解，也更容易让框架保持稳定。

### 4.3 统一抽象，不暴露宿主细节

插件作者不应该被迫理解下面这些宿主细节：

- CLI 为什么必须同步注册
- 某些宿主是否会等待异步 `register()`
- tool 和 command 在宿主层面的形态差异
- route/provider/channel 在底层如何挂载

这些差异应该由 adapter 层统一吸收。

### 4.4 构建期生成优于运行时扫描

目录发现、注册清单生成、打包信息同步等工作，优先在构建期完成，而不是在运行期做隐式扫描。

这样可以获得更好的可预测性、构建稳定性和调试体验。

### 4.5 CLI 不只是生成文件，而是固化最佳实践

脚手架命令的价值不只是少打几行字，而是：

- 自动放到正确目录
- 自动生成合理模板
- 自动补充导出和注册接线
- 自动保持命名一致
- 自动减少遗漏和错误

## 5. 目标用户与使用方式

### 5.1 目标用户

这套体系主要服务两类用户：

1. OpenClaw 插件开发者
   希望快速开发扩展能力，不想反复处理宿主接线和样板代码。

2. 框架维护者或团队内部平台工程师
   希望沉淀统一规范、提高交付一致性、降低新人接入成本。

### 5.2 理想使用体验

理想情况下，插件作者只需要完成下面这些工作：

1. 初始化一个插件项目
2. 通过命令生成某类能力文件
3. 在模板里填入业务逻辑
4. 运行构建和校验命令
5. 得到符合 OpenClaw 约定的产物

例如：

```bash
npx create-openclaw-plugin my-plugin
cd my-plugin
npx openclaw-plugin-cli generate command hello
npx openclaw-plugin-cli generate tool greet
npm run build
```

## 6. 整体分层模型

建议把整个体系拆成三层。

### 6.1 核心层 Core

负责与宿主无关的通用运行时能力，例如：

- definition contracts
- registry model
- service container
- lifecycle orchestration
- diagnostics
- runtime context

这一层的关键词是：

- 抽象稳定
- 不依赖具体宿主
- 可被多个适配器复用

### 6.2 宿主适配层 Adapter

负责把 Core 的抽象映射到 OpenClaw 宿主能力上，例如：

- `registerTool`
- `registerCli`
- `registerCommand`
- `on(event, handler)`
- provider / channel / route 元数据桥接

这一层的职责是：

- 屏蔽宿主 API 差异
- 处理宿主要求的注册时序
- 对外暴露统一入口

### 6.3 开发工具层 Tooling

负责脚手架、代码生成、校验、构建辅助和诊断，例如：

- `init`
- `generate`
- `doctor`
- `validate`
- `build`
- `package`

这一层的职责是：

- 生成目录和样板文件
- 自动补充接线
- 校验工程是否符合框架约定
- 降低使用门槛

## 7. 武器库模型

可以把这套框架理解成一个“能力武器库”。

框架不是为每一种场景重复写一套系统，而是在统一底座上提供一组标准能力构件，让用户按目标选用不同“武器”。

### 7.1 声明型武器

用于向宿主声明插件具备哪些能力，例如：

- command
- cli
- tool factory
- route
- provider metadata
- channel metadata

这些武器的特点是：

- 尽量同步注册
- 以描述符、handler、factory、metadata 为主
- 关注“宿主能否发现能力”

### 7.2 运行型武器

用于真正构建运行时能力，例如：

- module
- service
- bootstrap
- runtime context
- shutdown hooks

这些武器的特点是：

- 通常异步
- 关注“能力能否真正工作”
- 负责依赖注入、资源初始化和生命周期管理

### 7.3 连接型武器

用于把声明层和运行时层连接起来，例如：

- adapter
- lazy runtime
- service factory
- command executor wrapper
- CLI action bridge

这些武器的作用是：

- 让同步注册和异步启动可以协同工作
- 把宿主行为差异吸收到框架内部

## 8. 推荐的包拆分方式

建议后续按职责拆成至少两个 npm 包，最好三个。

### 8.1 `openclaw-plugin-framework-core`

负责：

- 定义 contracts
- lifecycle orchestration
- container
- diagnostics
- runtime types

### 8.2 `openclaw-plugin-framework-openclaw`

负责：

- OpenClaw adapter
- plugin entrypoint bridge
- host-facing bootstrap helpers
- OpenClaw metadata mapping

### 8.3 `openclaw-plugin-cli`

负责：

- 项目初始化
- 目标文件生成
- 注册/导出补线
- doctor / validate / package / build helpers

如果早期不想拆太多包，也可以先以单仓库多入口形式维护，等接口稳定后再拆。

## 9. 推荐的 CLI 命令体系

后续建议至少提供以下命令。

### 9.1 初始化项目

```bash
npx create-openclaw-plugin my-plugin
```

建议功能：

- 创建项目目录
- 生成基础 `package.json`
- 生成 `openclaw.plugin.json` 对应的 manifest 源
- 生成入口文件和示例 definitions
- 安装依赖

### 9.2 生成目标能力文件

```bash
npx openclaw-plugin-cli generate plugin my-plugin
npx openclaw-plugin-cli generate command hello
npx openclaw-plugin-cli generate tool greet
npx openclaw-plugin-cli generate hook before-agent-start
npx openclaw-plugin-cli generate cli status
npx openclaw-plugin-cli generate module greeter
```

建议功能：

- 生成标准文件模板
- 放到正确目录
- 自动处理导出和注册清单
- 按约定生成命名
- 可选择是否附带测试模板

### 9.3 工程诊断与校验

```bash
npx openclaw-plugin-cli doctor
npx openclaw-plugin-cli validate
```

建议功能：

- 校验 manifest
- 校验 registry 和目录结构是否匹配
- 检查产物是否与源码配置一致
- 给出常见问题修复建议

### 9.4 打包与构建辅助

```bash
npx openclaw-plugin-cli build
npx openclaw-plugin-cli package
```

建议功能：

- 调用规范构建链路
- 生成可安装 artifact
- 做发布前完整性检查

## 10. 目标文件生成策略

脚手架生成能力应尽量遵循“目标驱动”，而不是“文件驱动”。

也就是说，用户不应该思考“我要改哪几个文件”，而应该只思考“我要新增什么能力”。

例如执行：

```bash
npx openclaw-plugin-cli generate command hello
```

工具应尽量自动完成：

- 生成 `hello.command.ts`
- 按约定写入模板代码
- 补齐必要导出
- 更新聚合入口或生成清单
- 如有需要，补上测试模板

这样，用户关心的是目标，而不是接线细节。

## 11. 生命周期建议

顶层生命周期建议保持简单。

### 11.1 顶层统一模型

推荐维持以下顶层概念：

- `register()`
- `bootstrap()`
- `shutdown()`

其中：

- `register()` 负责同步声明宿主能力
- `bootstrap()` 负责异步构建 runtime
- `shutdown()` 负责回收资源

### 11.2 模块内部生命周期

模块内部可以保留相对细一点的阶段，例如：

- `setup`
- `start`
- `shutdown`

但不建议在插件顶层暴露过多并列 phase，例如：

- `initialize()`
- `warmup()`
- `activate()`
- `createService()`

除非后期真的出现明确且高频的场景，否则过多 phase 会增加心智负担，并放大测试和兼容成本。

## 12. 用户应该写什么，框架应该做什么

### 12.1 用户负责

- 业务逻辑
- 业务配置结构
- 插件元信息
- 服务实现细节
- command/tool/hook 的业务处理

### 12.2 框架负责

- OpenClaw API 适配
- 注册时机和初始化时机的协调
- runtime 装配
- 依赖注入和容器
- 诊断与日志基础设施
- registry 生成
- 打包信息同步
- 项目结构和样板代码生成

这条边界越清晰，框架越容易被真正使用。

## 13. 对当前仓库的落地方向

结合当前仓库现状，建议后续按下面顺序演进：

1. 稳定现有 `core + openclaw adapter + build scripts` 结构
2. 统一文档术语，明确“声明层”和“运行时层”的边界
3. 提供最小可用的脚手架命令
4. 把常见新增操作改造成 `generate <target>` 命令
5. 逐步把工程规范、校验逻辑、模板生成统一到 CLI 中
6. 等接口稳定后，再考虑拆分独立 npm 包

## 14. 成功标准

后续是否做对，可以用下面这些标准衡量：

1. 新建一个插件时，需要手写多少样板代码
2. 新增一个 command/tool/hook 时，需要改多少地方
3. 用户是否需要理解 OpenClaw 宿主细节
4. 项目目录和命名是否保持一致
5. 打包产物是否稳定可预测
6. 框架升级时，用户业务代码是否需要大改

如果这些指标持续改善，说明设计方向是正确的。

## 15. 总结

本项目的理想形态，不是单一示例，也不是若干分散工具函数，而是一套围绕 OpenClaw 扩展开发的完整开发底座。

它应当具备以下特征：

- 以框架承接宿主复杂度
- 以适配层吸收宿主差异
- 以 CLI 固化最佳实践和样板生成
- 以构建流程保证产物一致性
- 以清晰边界让插件作者专注业务逻辑

最终要达成的体验是：

`开发者描述目标，框架负责接线；开发者实现逻辑，工具负责生成结构。`
