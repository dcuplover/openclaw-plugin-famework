import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { createOpenClawAdapter } = require('../dist/framework/openclaw/adapter.js');

test('registerCommand wires OpenClaw CLI through program.command()', async () => {
  const events = [];
  let capturedAction;

  const commandBuilder = {
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

  const api = {
    registerTool() {},
    on() {},
    registerCli(factory, meta) {
      events.push(['registerCli', meta]);
      factory({
        program: {
          command(name) {
            events.push(['command', name]);
            return commandBuilder;
          },
        },
        logger: {
          info() {},
        },
      });
    },
  };

  const adapter = createOpenClawAdapter(api);
  adapter.registerCommand({
    name: 'demo',
    description: 'Demo command',
    async execute() {
      return undefined;
    },
  });

  assert.deepEqual(events, [
    ['registerCli', { commands: ['demo'] }],
    ['command', 'demo'],
    ['description', 'Demo command'],
    ['action'],
  ]);
  assert.equal(typeof capturedAction, 'function');
});

test('command action normalizes args and emits result text', async () => {
  const logs = [];
  let capturedAction;
  let receivedArgs;

  const commandBuilder = {
    description() {
      return this;
    },
    action(handler) {
      capturedAction = handler;
      return this;
    },
  };

  const api = {
    registerTool() {},
    on() {},
    registerCli(factory) {
      factory({
        program: {
          command() {
            return commandBuilder;
          },
        },
        logger: {
          info(message) {
            logs.push(message);
          },
        },
      });
    },
  };

  const adapter = createOpenClawAdapter(api);
  adapter.registerCommand({
    name: 'demo',
    description: 'Demo command',
    async execute(args) {
      receivedArgs = args;
      return { content: [{ type: 'text', text: 'ok' }] };
    },
  });

  await capturedAction('Alice', { verbose: true, count: 2 }, { opts() {}, parent: {} });

  assert.deepEqual(receivedArgs, ['Alice', '--verbose', '--count', '2']);
  assert.deepEqual(logs, ['ok']);
});
