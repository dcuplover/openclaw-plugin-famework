import { defineHook } from "../../framework/core/definition";
import type { SessionState } from "../modules/session.module";

export default defineHook({
  kind: "hook",
  name: "track_before_agent_start",
  event: "before_agent_start",
  priority: 50,
  handle(payload, context) {
    const sessionState = context.container.resolve<SessionState>("sessionState");
    sessionState.beforeAgentStartCount += 1;
    context.logger.info("before_agent_start observed", {
      count: sessionState.beforeAgentStartCount,
      payload: payload as Record<string, unknown>,
    });
  },
});
