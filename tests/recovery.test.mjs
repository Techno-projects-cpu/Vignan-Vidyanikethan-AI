import test from 'node:test';
import assert from 'node:assert/strict';
import { classifyFailure, routeIdentity, routeCooling, recordRouteFailure, recordRouteSuccess, resetRecovery, reportRecovery, recoverySnapshot, recoveryMessage, initRecoveryMonitoring } from '../js/recovery.js?v=91';

test('route circuit pauses after repeated failures, expires and resets after success', () => {
  resetRecovery();
  recordRouteFailure('test', 1000);
  assert.equal(routeCooling('test', 1001), false);
  recordRouteFailure('test', 1002);
  assert.equal(routeCooling('test', 1003), true);
  assert.equal(routeCooling('test', 61003), false);
  recordRouteSuccess('test');
  assert.equal(routeCooling('test', 1003), false);
});

test('recovery classifications and diagnostics never retain arbitrary error text or secrets', () => {
  resetRecovery();
  assert.equal(classifyFailure({ status: 429 }), 'quota');
  assert.equal(classifyFailure({ status: 401 }), 'credentials');
  assert.equal(classifyFailure({ name: 'TimeoutError' }), 'timeout');
  assert.equal(classifyFailure({ name: 'AbortError' }), 'cancelled');
  for (let i = 0; i < 20; i++) reportRecovery('secret question and key', 'https://private.example/?token=secret');
  assert.equal(recoverySnapshot().recent.length, 8);
  assert.doesNotMatch(JSON.stringify(recoverySnapshot()), /secret|private|token/);
  const a = routeIdentity({ id: 'server', apiKey: 'secret-one' });
  assert.notEqual(a, routeIdentity({ id: 'server', apiKey: 'secret-two' }));
  assert.doesNotMatch(a, /secret/);
});

test('runtime detection observes without suppressing or reloading; reconnect does not resend requests', () => {
  resetRecovery();
  const events = new Map();
  initRecoveryMonitoring({ addEventListener: (type, callback) => events.set(type, callback) });
  events.get('unhandledrejection')({ reason: new Error('sensitive contents') });
  assert.equal(recoverySnapshot().runtimeErrors, 1);
  assert.match(recoveryMessage(), /screen error/);
  recordRouteFailure('test'); recordRouteFailure('test');
  events.get('online')();
  assert.equal(routeCooling('test'), false);
  assert.match(recoveryMessage(), /no question was resent/);
  assert.doesNotMatch(JSON.stringify(recoverySnapshot()), /sensitive/);
});

test('a hosting 503 serves the cached app, while API calls stay outside the worker cache', async () => {
  const { readFileSync } = await import('node:fs');
  const { default: vm } = await import('node:vm');
  const source = readFileSync(new URL('../sw.js', import.meta.url), 'utf8');
  const handlers = new Map();
  const context = vm.createContext({
    self: { addEventListener: (type, fn) => handlers.set(type, fn), location: { origin: 'https://study.test' } },
    caches: { open: async () => ({ match: async () => new Response('cached study app') }) },
    fetch: async () => new Response('host sleeping', { status: 503 }), Response, URL,
  });
  vm.runInContext(source, context);
  const response = await vm.runInContext("networkFirst('https://study.test/')", context);
  assert.equal(await response.text(), 'cached study app');
  let intercepted = false;
  handlers.get('fetch')({ request: { method: 'GET', url: 'https://study.test/api/health', mode: 'navigate' }, respondWith() { intercepted = true; } });
  assert.equal(intercepted, false);
});

test('an incomplete new app cache does not activate over a working previous release', async () => {
  const { readFileSync } = await import('node:fs');
  const { default: vm } = await import('node:vm');
  const source = readFileSync(new URL('../sw.js', import.meta.url), 'utf8');
  const handlers = new Map(); let activation = 0, installation;
  const context = vm.createContext({
    self: { addEventListener: (type, fn) => handlers.set(type, fn), skipWaiting: async () => { activation++; } },
    caches: { open: async () => ({ add: async () => { throw new Error('network down'); }, match: async () => undefined }) },
    fetch: async () => { throw new Error('network down'); }, Response, URL,
  });
  vm.runInContext(source, context);
  handlers.get('install')({ waitUntil: promise => { installation = promise; } });
  await assert.rejects(installation, /Incomplete app cache/);
  assert.equal(activation, 0);
});

async function workerHarness(overrides = {}) {
  const { readFileSync } = await import('node:fs');
  const { default: vm } = await import('node:vm');
  const handlers = new Map();
  const context = vm.createContext({
    self: { addEventListener: (type, fn) => handlers.set(type, fn), location: { origin: 'https://study.test' }, clients: { claim: async () => {} } },
    caches: { open: async () => ({ match: async () => undefined, put: async () => {} }) },
    fetch: async () => new Response('network works'), Response, URL,
    ...overrides,
  });
  vm.runInContext(readFileSync(new URL('../sw.js', import.meta.url), 'utf8'), context);
  return { handlers, run: expression => vm.runInContext(expression, context) };
}

test('updates delete only old app caches, not downloaded WebLLM models or unrelated data', async () => {
  const deleted = [];
  const harness = await workerHarness({ caches: {
    keys: async () => ['vignan-vidyanikethan-ai-v1', 'vignan-vidyanikethan-ai-v999', 'webllm/model', 'webllm/wasm', 'another-app'],
    delete: async name => { deleted.push(name); },
  } });
  let activation;
  harness.handlers.get('activate')({ waitUntil: promise => { activation = promise; } });
  await activation;
  assert.deepEqual(deleted, ['vignan-vidyanikethan-ai-v1', 'vignan-vidyanikethan-ai-v999']);
});

test('blocked cache opening or matching does not break successful online pages or assets', async () => {
  for (const caches of [
    { open: async () => { throw new Error('storage blocked'); } },
    { open: async () => ({ match: async () => { throw new Error('cache unavailable'); }, put: async () => { throw new Error('quota'); } }) },
  ]) {
    const harness = await workerHarness({ caches });
    assert.equal(await (await harness.run("networkFirst('https://study.test/')")).text(), 'network works');
    assert.equal(await (await harness.run("cacheFirst('https://study.test/styles.css')")).text(), 'network works');
  }
});

test('operator routes bypass worker caches and private/no-store responses are never written', async () => {
  let writes = 0, intercepted = false;
  const harness = await workerHarness({ caches: { open: async () => ({ match: async () => undefined, put: async () => { writes++; } }) } });
  for (const path of ['/admin', '/admin/export?format=json', '/admin/login', '/setup', '/setup.html']) {
    harness.handlers.get('fetch')({ request: { method: 'GET', url: `https://study.test${path}`, mode: 'navigate' }, respondWith() { intercepted = true; } });
  }
  assert.equal(intercepted, false);
  await harness.run("(async () => storeResponse(await availableCache(), '/', new Response('private content', { headers: { 'Cache-Control': 'private, no-store' } })))()");
  await harness.run("(async () => storeResponse(await availableCache(), '/', new Response('private content', { headers: { 'Cache-Control': 'no-store' } })))()");
  assert.equal(writes, 0);
  await harness.run("(async () => storeResponse(await availableCache(), '/', new Response('public content')))()");
  assert.equal(writes, 1, 'public content still caches');
});
