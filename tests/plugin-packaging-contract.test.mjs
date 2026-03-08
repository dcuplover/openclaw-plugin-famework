import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { toOpenClawPluginJson, toPackageJsonFields } = require('../artifacts/app/framework/plugin/manifest.js');
const pluginManifest = require('../artifacts/app/app/plugin.manifest.js').default;
const entryModule = require('../artifacts/app/index.js');

test('generated registry infers config type from plugin manifest', () => {
  const registrySource = readFileSync(new URL('../src/generated/registry.ts', import.meta.url), 'utf8');

  assert.match(registrySource, /import type \{ PluginManifest \} from "\.\.\/framework\/plugin\/manifest";/);
  assert.match(registrySource, /typeof import\("\.\.\/app\/plugin\.manifest"\)\.default extends PluginManifest<infer TConfig>/);
  assert.match(registrySource, /export const registry: DefinitionRegistry<RegistryConfig> = \{/);
  assert.doesNotMatch(registrySource, /export const registry: DefinitionRegistry = \{/);
});

test('package.json projection includes guide-compatible openclaw.extensions', () => {
  const packageJson = toPackageJsonFields(pluginManifest);

  assert.deepEqual(packageJson.openclaw, {
    extensions: ['./index.js'],
    channel: undefined,
    install: undefined,
  });
  assert.equal(packageJson.main, './index.js');
  assert.equal(packageJson.types, './index.d.ts');
});

test('openclaw.plugin.json projection omits legacy runtime entry fields', () => {
  const openClawPluginJson = toOpenClawPluginJson(pluginManifest);

  assert.equal(openClawPluginJson.id, 'app');
  assert.equal(openClawPluginJson.name, 'App');
  assert.equal(openClawPluginJson.version, '0.1.0');
  assert.ok(openClawPluginJson.configSchema);
  assert.equal('runtime' in openClawPluginJson, false);
  assert.equal('entry' in openClawPluginJson, false);
  assert.equal('displayName' in openClawPluginJson, false);
});

test('compiled plugin entry exports a register(api) contract', async () => {
  const plugin = entryModule.default;
  const events = [];

  const runtime = await plugin.register({
    pluginConfig: {
      environment: 'test',
      greetingPrefix: 'hello',
    },
    registerTool() {
      events.push('tool');
    },
    registerCli() {
      events.push('cli');
    },
    registerCommand() {
      events.push('command');
    },
    on() {
      events.push('hook');
    },
    logger: {
      info() {},
      warn() {},
      error() {},
    },
  });

  assert.equal(plugin.id, 'app');
  assert.equal(plugin.name, 'App');
  assert.equal(typeof plugin.register, 'function');
  assert.equal(runtime.appId, 'app');
  assert.ok(events.includes('tool'));
});