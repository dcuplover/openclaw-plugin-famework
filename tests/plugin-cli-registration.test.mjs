import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const plugin = require('../artifacts/app/app/index.js').default;

test('plugin register wires CLI through api.registerCli and program.command()', async () => {
  const events = [];
  const logs = [];
  let capturedAction;

  const subcommandBuilder = {
    description(text) {
      events.push(['description', text]);
      return this;
    },
    action(handler) {
      capturedAction = handler;
      events.push(['action']);
      return this;
    },
  };

  const rootCommandBuilder = {
    description(text) {
      events.push(['description', text]);
      return this;
    },
    command(name) {
      events.push(['command', name]);
      return subcommandBuilder;
    },
  };

  const api = {
    pluginConfig: {},
    registerTool() {},
    on() {},
    registerCli(factory, meta) {
      events.push(['registerCli', meta]);
      factory({
        program: {
          command(name) {
            events.push(['command', name]);
            return rootCommandBuilder;
          },
        },
        logger: {
          info(message) {
            logs.push(message);
          },
        },
      });
    },
    registerCommand() {},
    logger: {
      info() {},
      warn() {},
      error() {},
      debug() {},
    },
  };

  const runtimePromise = plugin.register(api);

  assert.equal(typeof capturedAction, 'function');
  assert.deepEqual(events, [
    ['registerCli', { commands: ['framework'] }],
    ['command', 'framework'],
    ['description', 'Framework CLI utilities.'],
    ['command', 'status'],
    ['description', 'Print runtime diagnostics for the convention microkernel.'],
    ['action'],
  ]);

  await capturedAction();

  assert.equal(logs.length > 0, true);
  const cliResult = JSON.parse(logs[0]);
  assert.equal(typeof cliResult.beforeAgentStartCount, 'number');
  assert.ok(Array.isArray(cliResult.services));
  assert.ok(cliResult.services.includes('config'));
  assert.ok(cliResult.diagnostics);

  const runtime = await runtimePromise;
  await runtime.shutdown();
});
