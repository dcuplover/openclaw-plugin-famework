import type { DefinitionRegistry } from "../framework/core/types";

export const registry: DefinitionRegistry = {
  modules: [
  () => import("../example-app/modules/greeter.module"),
  () => import("../example-app/modules/platform.module"),
  () => import("../example-app/modules/session.module"),
  ],
  tools: [
  () => import("../example-app/tools/greet.tool"),
  ],
  hooks: [
  () => import("../example-app/hooks/before-agent-start.hook"),
  ],
  commands: [
  () => import("../example-app/commands/status.command"),
  ],
};
