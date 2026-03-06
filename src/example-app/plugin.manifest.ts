import { definePlugin } from "../framework/plugin/manifest";

interface ExampleAppConfig {
  environment: string;
  greetingPrefix: string;
}

const configSchema = {
  type: "object",
  properties: {
    environment: { type: "string" },
    greetingPrefix: { type: "string" },
  },
  required: ["environment", "greetingPrefix"],
  additionalProperties: false,
} as const;

export default definePlugin<ExampleAppConfig>({
  id: "example-app",
  name: "Example App",
  version: "0.1.0",
  description: "Example OpenClaw plugin app built on the convention microkernel prototype.",
  openclaw: {
    runtime: "node",
    entry: "dist/index.js",
    displayName: "Example App",
  },
  configSchema,
  app: {
    root: "src/example-app",
    registryPath: "src/generated/registry.ts",
    defaultConfig: {
      environment: "local-prototype",
      greetingPrefix: "Architect-grade hello",
    },
  },
  package: {
    packageName: "@dcuplover/openclaw-microkernel-framework",
    private: true,
  },
  build: {
    entrySource: "src/index.ts",
    outputDir: "dist",
    registryOutput: "src/generated/registry.ts",
    pluginManifestOutput: "openclaw.plugin.json",
  },
});
