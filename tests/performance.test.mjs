import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

function harness() {
  const frames = new Map(), built = [], destroyed = [], watched = new Set();
  let id = 0, intersect, mutate, scans = 0;
  const element = () => ({ isConnected: true, offsetWidth: 100, offsetHeight: 100 });
  const elements = [element(), element(), element()];
  const root = { querySelectorAll() { scans++; return elements; }, contains: el => el.isConnected };
  const source = readFileSync(new URL('../js/glass-lens.js', import.meta.url), 'utf8');
  const code = source.slice(source.indexOf('export function fitGlass')).replaceAll('export function', 'function');
  const context = vm.createContext({
    document: { body: root }, GLASS_SELECTOR: '.panel', MAX_LENSES: 24, controller: null,
    lensesAllowed: () => true, isLensSupported: () => true,
    requestAnimationFrame: fn => { frames.set(++id, fn); return id; },
    cancelAnimationFrame: n => frames.delete(n), getComputedStyle: () => ({ visibility: 'visible' }),
    liquidGlass: el => { built.push(el); return { destroy: () => destroyed.push(el) }; },
    IntersectionObserver: class { constructor(fn) { intersect = fn; } observe(el) { watched.add(el); } unobserve(el) { watched.delete(el); } disconnect() { watched.clear(); } },
    MutationObserver: class { constructor(fn) { mutate = fn; } observe() {} disconnect() {} },
  });
  vm.runInContext(code + '\nfitGlass();', context);
  return { elements, built, destroyed, watched, frames, element, scans: () => scans,
    enter: (...els) => intersect(els.map(target => ({ target, isIntersecting: true }))),
    leave: el => intersect([{ target: el, isIntersecting: false }]),
    mutate: records => mutate(records), stop: () => vm.runInContext('stopGlass()', context),
    tick() { const batch = [...frames.values()]; frames.clear(); batch.forEach(fn => fn()); },
  };
}

test('glass builds at most one queued surface per animation frame and stop cancels pending work', () => {
  const h = harness();
  h.enter(...h.elements); h.enter(h.elements[0]);
  assert.equal(h.frames.size, 1);
  h.tick(); assert.equal(h.built.length, 1);
  h.tick(); assert.equal(h.built.length, 2);
  h.stop(); h.tick();
  assert.equal(h.built.length, 2);
  assert.equal(h.destroyed.length, 2);
  assert.equal(h.frames.size, 0);
});

test('leaving the viewport cancels queued glass; removed surfaces are released', () => {
  const h = harness(); h.enter(...h.elements); h.leave(h.elements[0]);
  h.tick(); assert.equal(h.built[0], h.elements[1]);
  h.elements[1].isConnected = false;
  h.mutate([{ addedNodes: [], removedNodes: [h.elements[1]] }]);
  assert.deepEqual(h.destroyed, [h.elements[1]]);
  assert.equal(h.watched.has(h.elements[1]), false);
});

test('mutations scan only added subtrees, not the entire application', () => {
  const h = harness(); const added = h.element(); let subtreeScans = 0;
  added.matches = () => true;
  added.querySelectorAll = () => { subtreeScans++; return []; };
  h.mutate([{ addedNodes: [added], removedNodes: [] }]);
  h.mutate([{ addedNodes: [{ nodeType: 3 }], removedNodes: [] }]);
  assert.equal(h.scans(), 1);
  assert.equal(subtreeScans, 1);
  assert.equal(h.watched.has(added), true);
});

test('view reveal finishes geometry reads before writing any reveal classes', async () => {
  const events = [];
  const nodes = [0, 1, 2].map(index => ({
    style: { setProperty() {} },
    classList: { add(name) { if (name === 'is-revealed') events.push(`write${index}`); } },
    getBoundingClientRect() { events.push(`read${index}`); return { top: 10, bottom: 100 }; },
  }));
  const source = readFileSync(new URL('../js/motion.js', import.meta.url), 'utf8').replaceAll('export function', 'function');
  const context = vm.createContext({
    document: { querySelectorAll: () => nodes }, innerHeight: 800,
    IntersectionObserver: class { observe() {} unobserve() {} disconnect() {} },
    matchMedia: () => ({ matches: false }),
  });
  vm.runInContext(source + '\ninitMotion();', context);
  assert.deepEqual(events, ['read0', 'read1', 'read2', 'write0', 'write1', 'write2']);
});

test('leaving lite mode removes data-lite instead of an unrelated attribute', () => {
  const source = readFileSync(new URL('../js/app.js', import.meta.url), 'utf8');
  const start = source.indexOf('function applyStyle(');
  const end = source.indexOf('/** One tile per style', start);
  const removed = [];
  const root = { dataset: { lite: '1' }, removeAttribute(name) { removed.push(name); if (name === 'data-lite') delete this.dataset.lite; } };
  const context = vm.createContext({
    state: { settings: {} }, document: { documentElement: root }, CLASSIC_STYLE: 'minimal',
    normalizeStyle: id => id, isPaintedStyle: () => false, preferLiteGlass: () => false,
    stopGlass() {}, syncThemeSwitchLock() {}, requestAnimationFrame() {}, syncBrowserChrome() {},
    $: () => null,
  });
  vm.runInContext(source.slice(start, end) + "\napplyStyle('minimal', { save: false, remember: false });", context);
  assert.equal(root.dataset.lite, undefined);
  assert.ok(removed.includes('data-lite'));
});

test('social polling removes visibility listeners on stop instead of accumulating after logins', () => {
  const source = readFileSync(new URL('../js/social.js', import.meta.url), 'utf8');
  const start = source.indexOf('let pollingVisibilityHandler');
  const end = source.indexOf('export const social =', start);
  const listeners = new Set(), intervals = new Set();
  let calls = 0, next = 0;
  const context = vm.createContext({
    state: { timer: null }, POLL_MS: 20000,
    document: { visibilityState: 'visible', addEventListener: (_type, fn) => listeners.add(fn), removeEventListener: (_type, fn) => listeners.delete(fn) },
    syncSocial: async () => { calls++; },
    setInterval: () => { const id = ++next; intervals.add(id); return id; }, clearInterval: id => intervals.delete(id),
  });
  vm.runInContext(source.slice(start, end).replaceAll('export function', 'function'), context);
  for (let i = 0; i < 4; i++) {
    vm.runInContext('startSocialPolling(); startSocialPolling();', context);
    assert.equal(listeners.size, 1);
    assert.equal(intervals.size, 1);
    const queuedHandler = [...listeners][0];
    vm.runInContext('stopSocialPolling();', context);
    const before = calls;
    queuedHandler();
    assert.equal(calls, before, 'queued callbacks do not fetch after stopping');
    assert.equal(listeners.size, 0);
    assert.equal(intervals.size, 0);
  }
});
