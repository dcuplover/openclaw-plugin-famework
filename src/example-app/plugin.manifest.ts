import { definePlugin } from "../framework/plugin/manifest";

export interface ExampleAppConfig {
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
    packageName: "@dcuplover/openclaw-example-app",
    private: true,
  },
  build: {
    entrySource: "src/example-app/index.ts",
    artifactEntry: "./index.js",
    outputDir: "dist",
    registryOutput: "src/generated/registry.ts",
    artifactRoot: "artifacts/example-app",
    packageJsonOutput: "artifacts/example-app/package.json",
    pluginManifestOutput: "artifacts/example-app/openclaw.plugin.json",
  },
});
