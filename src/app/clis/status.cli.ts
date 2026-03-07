import { defineCli } from "../../framework/core/definition";
import type { SessionState } from "../modules/session.module";

export default defineCli({
  kind: "cli",
  name: "framework:status",
  description: "Print runtime diagnostics for the convention microkernel.",
  execute(_args, context) {
    const sessionState = context.container.resolve<SessionState>("sessionState");

    return {
      diagnostics: context.diagnostics,
      services: context.container.entries().map(([key]) => key),
      beforeAgentStartCount: sessionState.beforeAgentStartCount,
    };
  },
});
