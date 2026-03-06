import { defineModule } from "../../framework/core/definition";

export interface PlatformDescriptor {
  environment: string;
  startedAt: number;
}

export default defineModule({
  kind: "module",
  name: "platform",
  provides: ["platform"],
  setup(context) {
    const platform: PlatformDescriptor = {
      environment: String((context.config as Record<string, unknown>).environment ?? "prototype"),
      startedAt: Date.now(),
    };

    context.container.register("platform", platform);
    context.logger.info("Platform module prepared", platform as unknown as Record<string, unknown>);
  },
});
