import { defineModule } from "../../framework/core/definition";
import type { ExampleAppConfig } from "../plugin.manifest";
import type { PlatformDescriptor } from "./platform.module";

export interface GreeterService {
  greet(name: string): string;
}

export default defineModule<ExampleAppConfig>({
  kind: "module",
  name: "greeter",
  dependsOn: ["platform"],
  provides: ["greeter"],
  setup(context) {
    const platform = context.container.resolve<PlatformDescriptor>("platform");
    const prefix = context.config.greetingPrefix;

    const greeter: GreeterService = {
      greet(name: string): string {
        return `${prefix}, ${name}. Environment: ${platform.environment}.`;
      },
    };

    context.container.register("greeter", greeter);
    context.logger.info("Greeter module prepared", { prefix });
  },
});
