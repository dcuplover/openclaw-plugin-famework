import { defineModule } from "../../framework/core/definition";

export interface SessionState {
  beforeAgentStartCount: number;
}

export default defineModule({
  kind: "module",
  name: "session",
  dependsOn: ["platform"],
  provides: ["sessionState"],
  setup(context) {
    context.container.register<SessionState>("sessionState", {
      beforeAgentStartCount: 0,
    });
    context.logger.info("Session module prepared");
  },
});
