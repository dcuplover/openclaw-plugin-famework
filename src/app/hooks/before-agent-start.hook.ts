import { defineOpenClawHook, type OpenClawHookContext } from "../../framework/openclaw/adapter";
import type { SessionState } from "../modules/session.module";

export default defineOpenClawHook({
  kind: "hook",
  name: "track_before_agent_start",
  event: "before_agent_start",
  priority: 50,
  handle(event, context, hookContext: OpenClawHookContext | undefined) {
    const sessionState = context.container.resolve<SessionState>("sessionState");
    sessionState.beforeAgentStartCount += 1;
    context.logger.info("before_agent_start observed", {
      count: sessionState.beforeAgentStartCount,
      payload: event as Record<string, unknown>,
      sessionId: hookContext?.sessionId,
      sessionKey: hookContext?.sessionKey,
      agentId: hookContext?.agentId,
    });
  },
});
