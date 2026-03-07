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
        name: 'framework',
        description: 'Framework CLI utilities',
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
  assert.equal(registeredClis[0].name, 'framework');
  assert.equal(registeredClis[0].description, 'Framework CLI utilities');
  assert.deepEqual(runtime.diagnostics.loadedClis, ['framework']);

  const result = await registeredClis[0].execute(['status', '--verbose']);

  assert.deepEqual(result, {
    args: ['status', '--verbose'],
    appId: 'framework',
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
        handler: async (commandContext) => {
          return { text: commandContext.args ?? 'hello' };
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

  const result = await registeredCommands[0].handler({
    senderId: 'user-1',
    channel: 'chat',
    isAuthorizedSender: true,
    args: 'hello',
    commandBody: '/hello hello',
  });
  assert.deepEqual(result, { text: 'hello' });

  await runtime.shutdown();
});

test('bootstrapMicrokernel preserves defaultable command metadata when omitted', async () => {
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
        name: 'ping',
        async handler(commandContext) {
          return { text: commandContext.args ?? 'pong' };
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
  assert.equal(registeredCommands[0].name, 'ping');
  assert.equal(registeredCommands[0].description, undefined);
  assert.equal(registeredCommands[0].acceptsArgs, undefined);
  assert.equal(registeredCommands[0].requireAuth, undefined);

  const result = await registeredCommands[0].handler({});
  assert.deepEqual(result, { text: 'pong' });

  await runtime.shutdown();
});

test('bootstrapMicrokernel enriches command invocation context with config', async () => {
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
        name: 'inspect',
        async handler(commandContext) {
          return {
            text: JSON.stringify({
              senderId: commandContext.senderId,
              channel: commandContext.channel,
              args: commandContext.args,
              commandBody: commandContext.commandBody,
              config: commandContext.config,
            }),
          };
        },
      }),
    ],
  };

  const runtime = await bootstrapMicrokernel({
    appId: 'app',
    config: { environment: 'test' },
    registry,
    host,
    logger,
  });

  const result = await registeredCommands[0].handler({
    senderId: 'user-2',
    channel: 'chat',
    isAuthorizedSender: false,
    args: 'details',
    commandBody: '/inspect details',
  });

  assert.deepEqual(JSON.parse(result.text), {
    senderId: 'user-2',
    channel: 'chat',
    args: 'details',
    commandBody: '/inspect details',
    config: { environment: 'test' },
  });

  await runtime.shutdown();
});

test('bootstrapMicrokernel forwards hook name, description, and priority to the host', async () => {
  const registeredHooks = [];
  const host = {
    registerTool() {},
    registerHook(hook) {
      registeredHooks.push(hook);
    },
    registerCli() {},
    registerCommand() {},
  };

  const logger = {
    info() {},
    warn() {},
    error() {},
  };

  const registry = {
    modules: [],
    tools: [],
    hooks: [
      async () => ({
        kind: 'hook',
        name: 'track_before_agent_start',
        description: 'Track before_agent_start events',
        event: 'before_agent_start',
        priority: 50,
        async handle() {},
      }),
    ],
    clis: [],
    commands: [],
  };

  const runtime = await bootstrapMicrokernel({
    appId: 'app',
    config: {},
    registry,
    host,
    logger,
  });

  assert.equal(registeredHooks.length, 1);
  assert.equal(registeredHooks[0].name, 'track_before_agent_start');
  assert.equal(registeredHooks[0].description, 'Track before_agent_start events');
  assert.equal(registeredHooks[0].event, 'before_agent_start');
  assert.equal(registeredHooks[0].priority, 50);

  await runtime.shutdown();
});
