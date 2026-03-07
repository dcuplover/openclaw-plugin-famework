import { bootstrapMicrokernel } from "../framework/core/kernel";
import { createConsoleLogger } from "../framework/core/logger";
import { registry } from "../generated/registry";
import { MockHostAdapter } from "./mock-host";
import pluginManifest from "./plugin.manifest";

interface ExampleAppConfig {
  environment: string;
  greetingPrefix: string;
}

async function main(): Promise<void> {
  const host = new MockHostAdapter();
  const logger = createConsoleLogger("app");
  const defaultConfig: ExampleAppConfig = pluginManifest.app.defaultConfig ?? {
    environment: "local-prototype",
    greetingPrefix: "Architect-grade hello",
  };

  const runtime = await bootstrapMicrokernel<ExampleAppConfig>({
    appId: pluginManifest.id,
    config: defaultConfig,
    registry,
    host,
    logger,
  });

  await host.emit("before_agent_start", { source: "demo" });
  const toolResult = await host.invokeTool("greet_user", { name: "OpenClaw" });
  const cliResult = await host.runCli("framework", ["status"]);
  const commandResult = await host.runCommand("hello", "OpenClaw");

  console.log("Tool result:", toolResult);
  console.log("CLI result:", cliResult);
  console.log("Command result:", commandResult);

  await runtime.shutdown();
}

main().catch((error) => {
  console.error("Example bootstrap failed", error);
  process.exitCode = 1;
});
