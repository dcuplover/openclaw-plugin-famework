import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { bootstrapMicrokernel } = require('../dist/framework/core/kernel.js');

test('bootstrapMicrokernel registers commands from the registry onto the host', async () => {
  const registeredCommands = [];
  const host = {
    registerTool() {},
    registerHook() {},
    registerCommand(command) {
      registeredCommands.push(command);
    },
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
    commands: [
      async () => ({
        kind: 'command',
        name: 'framework:status',
        description: 'Return boot state',
        async execute(args, context) {
          return {
            args,
            appId: context.diagnostics.loadedCommands[0],
            configEnvironment: context.config.environment,
            serviceKeys: context.container.entries().map(([key]) => key),
          };
        },
      }),
    ],
  };

  const runtime = await bootstrapMicrokernel({
    appId: 'example-app',
    config: { environment: 'test' },
    registry,
    host,
    logger,
  });

  assert.equal(registeredCommands.length, 1);
  assert.equal(registeredCommands[0].name, 'framework:status');
  assert.equal(registeredCommands[0].description, 'Return boot state');
  assert.deepEqual(runtime.diagnostics.loadedCommands, ['framework:status']);

  const result = await registeredCommands[0].execute(['--verbose']);

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
