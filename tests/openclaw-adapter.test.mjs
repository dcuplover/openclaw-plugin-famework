import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { createOpenClawAdapter } = require('../artifacts/app/framework/openclaw/adapter.js');

test('registerCli wires OpenClaw CLI through program.command()', async () => {
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
    registerCommand() {},
  };

  const adapter = createOpenClawAdapter(api);
  adapter.registerCli({
    name: 'demo',
    description: 'Demo CLI',
    async execute() {
      return undefined;
    },
  });

  assert.deepEqual(events, [
    ['registerCli', { commands: ['demo'] }],
    ['command', 'demo'],
    ['description', 'Demo CLI'],
    ['action'],
  ]);
  assert.equal(typeof capturedAction, 'function');
});

test('CLI action normalizes args and emits result text', async () => {
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
    registerCommand() {},
  };

  const adapter = createOpenClawAdapter(api);
  adapter.registerCli({
    name: 'demo',
    description: 'Demo CLI',
    async execute(args) {
      receivedArgs = args;
      return { content: [{ type: 'text', text: 'ok' }] };
    },
  });

  await capturedAction('Alice', { verbose: true, count: 2 }, { opts() {}, parent: {} });

  assert.deepEqual(receivedArgs, ['Alice', '--verbose', '--count', '2']);
  assert.deepEqual(logs, ['ok']);
});

test('registerCommand wires OpenClaw registerCommand with name, description, and handler', async () => {
  let capturedDefinition;
  let receivedCommandContext;

  const api = {
    registerTool() {},
    on() {},
    registerCli() {},
    registerCommand(definition) {
      capturedDefinition = definition;
    },
  };

  const adapter = createOpenClawAdapter(api);
  adapter.registerCommand({
    name: 'hello',
    description: 'Reply hello',
    acceptsArgs: true,
    requireAuth: false,
    async handler(commandContext) {
      receivedCommandContext = commandContext;
      return { text: commandContext?.args ?? 'hello' };
    },
  });

  assert.equal(capturedDefinition.name, 'hello');
  assert.equal(capturedDefinition.description, 'Reply hello');
  assert.equal(capturedDefinition.acceptsArgs, true);
  assert.equal(capturedDefinition.requireAuth, false);
  assert.equal(typeof capturedDefinition.handler, 'function');

  const result = await capturedDefinition.handler({
    senderId: 'user-1',
    channel: 'chat',
    isAuthorizedSender: true,
    args: 'hello',
    commandBody: '/hello hello',
  });
  assert.deepEqual(receivedCommandContext, {
    senderId: 'user-1',
    channel: 'chat',
    isAuthorizedSender: true,
    args: 'hello',
    commandBody: '/hello hello',
    config: undefined,
  });
  assert.deepEqual(result, { text: 'hello' });
});

test('registerCommand applies documented defaults for acceptsArgs and requireAuth', async () => {
  let capturedDefinition;

  const api = {
    registerTool() {},
    on() {},
    registerCli() {},
    registerCommand(definition) {
      capturedDefinition = definition;
    },
  };

  const adapter = createOpenClawAdapter(api);
  adapter.registerCommand({
    name: 'hello',
    async handler(commandContext) {
      return { text: commandContext?.args ?? 'hello' };
    },
  });

  assert.equal(capturedDefinition.description, undefined);
  assert.equal(capturedDefinition.acceptsArgs, false);
  assert.equal(capturedDefinition.requireAuth, true);

  const result = await capturedDefinition.handler({ args: 'hi' });
  assert.deepEqual(result, { text: 'hi' });
});

test('registerHook forwards hook metadata through api.on opts', async () => {
  const events = [];

  const api = {
    registerTool() {},
    on(event, handler, opts) {
      events.push([event, typeof handler, opts]);
    },
    registerCli() {},
    registerCommand() {},
  };

  const adapter = createOpenClawAdapter(api);
  adapter.registerHook({
    name: 'track_before_agent_start',
    description: 'Track before_agent_start events',
    event: 'before_agent_start',
    priority: 50,
    async handler() {},
  });

  assert.deepEqual(events, [[
    'before_agent_start',
    'function',
    { name: 'track_before_agent_start', description: 'Track before_agent_start events', priority: 50 },
  ]]);
});

test('registerTool uses factory pattern and normalizes plain results to content format', async () => {
  let capturedFactory;
  let capturedMeta;

  const api = {
    registerTool(factory, meta) {
      capturedFactory = factory;
      capturedMeta = meta;
    },
    on() {},
    registerCli() {},
    registerCommand() {},
  };

  const adapter = createOpenClawAdapter(api);
  adapter.registerTool({
    name: 'greet_user',
    description: 'Greet a user',
    schema: { type: 'object', properties: { name: { type: 'string' } }, required: ['name'] },
    async execute(params) {
      return { ok: true, message: `Hello ${params.name}` };
    },
  });

  // Factory pattern: registerTool receives a function, not a plain object
  assert.equal(typeof capturedFactory, 'function');
  assert.deepEqual(capturedMeta, { name: 'greet_user' });

  // Invoke the factory
  const toolDef = capturedFactory({});
  assert.equal(toolDef.name, 'greet_user');
  assert.equal(toolDef.label, 'Greet a user');
  assert.equal(toolDef.description, 'Greet a user');
  assert.deepEqual(toolDef.parameters, { type: 'object', properties: { name: { type: 'string' } }, required: ['name'] });

  // Execute and verify result is normalized to { content: [...] }
  const result = await toolDef.execute('call-1', { name: 'Alice' });
  assert.ok(Array.isArray(result.content), 'result.content should be an array');
  assert.equal(result.content[0].type, 'text');
  assert.ok(result.content[0].text.includes('Hello Alice'));
});

test('registerTool passes through results already in content format', async () => {
  let capturedFactory;

  const api = {
    registerTool(factory) { capturedFactory = factory; },
    on() {},
    registerCli() {},
    registerCommand() {},
  };

  const adapter = createOpenClawAdapter(api);
  adapter.registerTool({
    name: 'native_tool',
    description: 'Tool returning native format',
    schema: { type: 'object', properties: {} },
    async execute() {
      return { content: [{ type: 'text', text: 'native result' }], details: { count: 1 } };
    },
  });

  const toolDef = capturedFactory({});
  const result = await toolDef.execute('call-2', {});
  assert.deepEqual(result.content, [{ type: 'text', text: 'native result' }]);
  assert.deepEqual(result.details, { count: 1 });
});

test('registerTool normalizes a single content item object', async () => {
  let capturedFactory;

  const api = {
    registerTool(factory) { capturedFactory = factory; },
    on() {},
    registerCli() {},
    registerCommand() {},
  };

  const adapter = createOpenClawAdapter(api);
  adapter.registerTool({
    name: 'single_content_item',
    description: 'Tool returning one text item',
    async execute() {
      return { type: 'text', text: 'hello item' };
    },
  });

  const toolDef = capturedFactory({});
  const result = await toolDef.execute('call-4', {});
  assert.deepEqual(result.content, [{ type: 'text', text: 'hello item' }]);
});

test('registerTool uses fallback schema when none provided', async () => {
  let capturedFactory;

  const api = {
    registerTool(factory) { capturedFactory = factory; },
    on() {},
    registerCli() {},
    registerCommand() {},
  };

  const adapter = createOpenClawAdapter(api);
  adapter.registerTool({
    name: 'no_schema_tool',
    description: 'Tool without schema',
    async execute() {
      return 'plain string';
    },
  });

  const toolDef = capturedFactory({});
  assert.deepEqual(toolDef.parameters, { type: 'object', properties: {} });

  const result = await toolDef.execute('call-3', {});
  assert.deepEqual(result.content, [{ type: 'text', text: 'plain string' }]);
});
