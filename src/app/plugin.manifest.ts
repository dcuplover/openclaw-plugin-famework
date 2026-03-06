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
  id: "app",
  name: "App",
  version: "0.1.0",
  description: "OpenClaw plugin app built on the convention microkernel framework.",
  configSchema,
  app: {
    root: "src/app",
    registryPath: "src/generated/registry.ts",
    defaultConfig: {
      environment: "local-prototype",
      greetingPrefix: "Architect-grade hello",
    },
  },
  package: {
    packageName: "@dcuplover/openclaw-app",
    private: true,
  },
  build: {
    entrySource: "src/app/index.ts",
    artifactEntry: "./index.js",
    outputDir: "artifacts",
    registryOutput: "src/generated/registry.ts",
  },
});
