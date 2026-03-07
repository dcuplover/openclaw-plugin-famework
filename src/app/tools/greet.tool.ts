import { defineTool } from "../../framework/core/definition";
import type { GreeterService } from "../modules/greeter.module";

export default defineTool({
  kind: "tool",
  name: "greet_user",
  description: "Return a greeting using services provided by convention-loaded modules.",
  priority: 100,
  schema: {
    type: "object",
    properties: {
      name: { type: "string", description: "Target user name" },
    },
    required: ["name"],
  },
  execute(params, context) {
    const greeter = context.container.resolve<GreeterService>("greeter");
    const name = typeof params.name === "string" ? params.name : "world";

    return {
      type: "text",
      text: greeter.greet(name),
    };
  },
});
