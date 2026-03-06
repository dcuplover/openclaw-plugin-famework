import { bootstrapMicrokernel } from "../framework/core/kernel";
import { createConsoleLogger } from "../framework/core/logger";
import { registry } from "../generated/registry";
import { MockHostAdapter } from "./mock-host";

interface ExampleAppConfig {
  environment: string;
  greetingPrefix: string;
}

async function main(): Promise<void> {
  const host = new MockHostAdapter();
  const logger = createConsoleLogger("example-app");

  const runtime = await bootstrapMicrokernel<ExampleAppConfig>({
    appId: "example-app",
    config: {
      environment: "local-prototype",
      greetingPrefix: "Architect-grade hello",
    },
    registry,
    host,
    logger,
  });

  await host.emit("before_agent_start", { source: "demo" });
  const toolResult = await host.invokeTool("greet_user", { name: "OpenClaw" });
  const status = await host.runCommand("framework:status", []);

  console.log("Tool result:", toolResult);
  console.log("Command result:", status);

  await runtime.shutdown();
}

main().catch((error) => {
  console.error("Example bootstrap failed", error);
  process.exitCode = 1;
});
