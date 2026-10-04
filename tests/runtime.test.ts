import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PythonRuntime } from '../src/runtime';

class TestWorker {
  static instances: TestWorker[] = [];
  onmessage?: (event: { data: Record<string, unknown> }) => Promise<void>;
  onerror?: (event: { message: string }) => void;
  postMessage = vi.fn();
  terminate = vi.fn();
  constructor() { TestWorker.instances.push(this); }
  send(data: Record<string, unknown>) { return this.onmessage?.({ data }); }
}
function setup(action = vi.fn(async () => {})) {
  const hooks = { status: vi.fn(), log: vi.fn(), action, finished: vi.fn() };
  const runtime = new PythonRuntime(hooks);
  const worker = TestWorker.instances.at(-1)!;
  return { runtime, worker, hooks };
}

describe('Python worker lifecycle', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.stubGlobal('Worker', TestWorker);
    vi.stubGlobal('crossOriginIsolated', true);
    TestWorker.instances = [];
  });
  afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });

  it('requires isolation and gives a readable error', () => {
    vi.stubGlobal('crossOriginIsolated', false);
    const { runtime, hooks } = setup();
    expect(runtime.status).toBe('unavailable');
    expect(hooks.log).toHaveBeenCalledWith(expect.stringContaining('cross-origin isolation'), 'error');
    expect(TestWorker.instances).toHaveLength(0);
  });
  it('prevents duplicate runs and recovers after a Python error', async () => {
    const { runtime, worker, hooks } = setup();
    runtime.run('plant()');
    expect(worker.postMessage).toHaveBeenCalledTimes(1); // init only
    await worker.send({ type: 'ready' });
    runtime.run('plant()');
    runtime.run('plant()');
    expect(worker.postMessage).toHaveBeenCalledTimes(2);
    const runId = worker.postMessage.mock.calls[1][0].runId;
    await worker.send({ type: 'error', runId, text: 'CappyError: empty soil required' });
    expect(runtime.status).toBe('ready');
    expect(hooks.finished).toHaveBeenCalledOnce();
    runtime.run('print("recovered")');
    expect(worker.postMessage).toHaveBeenCalledTimes(3);
  });
  it('acknowledges an action only after its animation finishes', async () => {
    let complete!: () => void;
    const animation = new Promise<void>(resolve => { complete = resolve; });
    const { runtime, worker } = setup(vi.fn(() => animation));
    await worker.send({ type: 'ready' });
    runtime.run('plant()');
    const { runId, bridge } = worker.postMessage.mock.calls[1][0];
    const pending = worker.send({ type: 'action', runId, action: { kind: 'plant' }, line: 1 });
    const control = new Int32Array(bridge, 0, 2);
    expect(Atomics.load(control, 0)).toBe(0);
    complete();
    await pending;
    expect(Atomics.load(control, 0)).toBe(1);
    expect(Atomics.load(control, 1)).toBe(0);
  });
  it('stops a pending action, ignores stale completion, and initializes a new worker', async () => {
    let complete!: () => void;
    const { runtime, worker } = setup(vi.fn(() => new Promise<void>(resolve => { complete = resolve; })));
    await worker.send({ type: 'ready' });
    runtime.run('plant()');
    const { runId, bridge } = worker.postMessage.mock.calls[1][0];
    const pending = worker.send({ type: 'action', runId, action: { kind: 'plant' }, line: 1 });
    runtime.stop();
    complete();
    await pending;
    await worker.send({ type: 'done', runId });
    expect(worker.terminate).toHaveBeenCalledOnce();
    expect(Atomics.load(new Int32Array(bridge, 0, 2), 0)).toBe(0);
    expect(TestWorker.instances).toHaveLength(2);
    expect(runtime.status).toBe('loading');
    await TestWorker.instances[1].send({ type: 'ready' });
    expect(runtime.status).toBe('ready');
  });
  it('reports loading timeouts and supports retry', () => {
    const { runtime, worker, hooks } = setup();
    vi.advanceTimersByTime(60_000);
    expect(runtime.status).toBe('unavailable');
    expect(worker.terminate).toHaveBeenCalledOnce();
    expect(hooks.log).toHaveBeenCalledWith(expect.stringContaining('too long'), 'error');
    runtime.retry();
    expect(runtime.status).toBe('loading');
    expect(TestWorker.instances).toHaveLength(2);
  });
});
