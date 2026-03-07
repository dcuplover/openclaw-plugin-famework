import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { bootstrapMicrokernel } = require('../artifacts/app/framework/core/kernel.js');

test('bootstrapMicrokernel registers CLIs from the registry onto the host', async () => {
  const registeredClis = [];
  const host = {
    registerTool() {},
    registerHook() {},
    registerCli(cli) {
      registeredClis.push(cli);
    },
    registerCommand() {},
  };

  const loggerMessages = [];
  const logger = {
    info(message, meta) {
      loggerMessages.push(['info', message, meta]);
    },
    warn(message, meta) {
      loggerMessages.push(['warn', message, meta]);
    },
    error(message, meta) {
      loggerMessages.push(['error', message, meta]);
    },
  };

  const registry = {
    modules: [],
    tools: [],
    hooks: [],
    clis: [
      async () => ({
        kind: 'cli',
        name: 'framework:status',
        description: 'Return boot state',
        async execute(args, context) {
          return {
            args,
            appId: context.diagnostics.loadedClis[0],
            configEnvironment: context.config.environment,
            serviceKeys: context.container.entries().map(([key]) => key),
          };
        },
      }),
    ],
    commands: [],
  };

  const runtime = await bootstrapMicrokernel({
    appId: 'app',
    config: { environment: 'test' },
    registry,
    host,
    logger,
  });

  assert.equal(registeredClis.length, 1);
  assert.equal(registeredClis[0].name, 'framework:status');
  assert.equal(registeredClis[0].description, 'Return boot state');
  assert.deepEqual(runtime.diagnostics.loadedClis, ['framework:status']);

  const result = await registeredClis[0].execute(['--verbose']);

  assert.deepEqual(result, {
    args: ['--verbose'],
    appId: 'framework:status',
    configEnvironment: 'test',
    serviceKeys: ['config', 'logger', 'host', 'diagnostics'],
  });

  assert.equal(
    loggerMessages.some(([level, message]) => level === 'info' && message === 'Microkernel boot complete'),
    true
  );

  await runtime.shutdown();
});

test('bootstrapMicrokernel registers commands from the registry onto the host', async () => {
  const registeredCommands = [];
  const host = {
    registerTool() {},
    registerHook() {},
    registerCli() {},
    registerCommand(command) {
      registeredCommands.push(command);
    },
  };

  const logger = {
    info() {},
    warn() {},
    error() {},
  };

  const registry = {
    modules: [],
    tools: [],
    hooks: [],
    clis: [],
    commands: [
      async () => ({
        kind: 'command',
        name: 'hello',
        description: 'Reply hello',
        handler: async () => {
          return { text: 'hello' };
        },
      }),
    ],
  };

  const runtime = await bootstrapMicrokernel({
    appId: 'app',
    config: {},
    registry,
    host,
    logger,
  });

  assert.equal(registeredCommands.length, 1);
  assert.equal(registeredCommands[0].name, 'hello');
  assert.equal(registeredCommands[0].description, 'Reply hello');
  assert.deepEqual(runtime.diagnostics.loadedCommands, ['hello']);

  const result = await registeredCommands[0].handler();
  assert.deepEqual(result, { text: 'hello' });

  await runtime.shutdown();
});
