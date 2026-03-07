import type { DefinitionRegistry } from "../framework/core/types";

export const registry: DefinitionRegistry = {
  modules: [
  () => import("../app/modules/greeter.module"),
  () => import("../app/modules/platform.module"),
  () => import("../app/modules/session.module"),
  ],
  tools: [
  () => import("../app/tools/greet.tool"),
  ],
  hooks: [
  () => import("../app/hooks/before-agent-start.hook"),
  ],
  clis: [
  () => import("../app/clis/status.cli"),
  ],
  commands: [
  () => import("../app/commands/hello.command"),
  ],
};
