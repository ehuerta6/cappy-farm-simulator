import type { Action } from './simulation';

export type RuntimeStatus = 'loading' | 'ready' | 'running' | 'unavailable';
interface Hooks {
  status: (status: RuntimeStatus) => void;
  log: (text: string, kind?: 'error' | 'success') => void;
  action: (action: Action, line: number, signal: AbortSignal) => Promise<void>;
  finished: () => void;
}
export class PythonRuntime {
  private worker?: Worker;
  private controller?: AbortController;
  private generation = 0;
  private bridge?: SharedArrayBuffer;
  private loadingTimer?: ReturnType<typeof setTimeout>;
  status: RuntimeStatus = 'loading';

  constructor(private hooks: Hooks) { this.initialize(); }
  private setStatus(status: RuntimeStatus) { this.status = status; this.hooks.status(status); }
  private initialize() {
    if (!crossOriginIsolated || typeof SharedArrayBuffer === 'undefined') {
      this.setStatus('unavailable');
      this.hooks.log('Python needs cross-origin isolation. Use npm run dev, or serve with the COOP/COEP headers documented in README.', 'error');
      return;
    }
    this.setStatus('loading');
    const generation = ++this.generation;
    const worker = new Worker(`${import.meta.env.BASE_URL}python-worker.js`);
    this.worker = worker;
    const fail = (text: string) => {
      if (generation !== this.generation) return;
      clearTimeout(this.loadingTimer);
      this.controller?.abort();
      worker.terminate();
      this.setStatus('unavailable');
      this.hooks.log(text, 'error');
      this.hooks.finished();
    };
    this.loadingTimer = setTimeout(() => fail('Python took too long to load. Press Reset to retry.'), 60_000);
    worker.onerror = event => fail(`Python worker error: ${event.message}. Press Reset to retry.`);
    worker.onmessage = async ({ data }) => {
      if (generation !== this.generation) return;
      if (data.type === 'ready') {
        clearTimeout(this.loadingTimer);
        this.setStatus('ready');
      } else if (data.type === 'load-error') {
        fail(`Could not load Python: ${data.text}. Press Reset to retry.`);
      } else if (data.runId === this.generation && this.status === 'running') {
        if (data.type === 'action') {
          let error = '';
          try { await this.hooks.action(data.action, data.line, this.controller!.signal); }
          catch (reason) { error = reason instanceof Error ? reason.message : String(reason); }
          if (generation !== this.generation || this.controller?.signal.aborted) return;
          const bytes = new TextEncoder().encode(error).subarray(0, 8184);
          new Uint8Array(this.bridge!, 8).set(bytes);
          const control = new Int32Array(this.bridge!, 0, 2);
          Atomics.store(control, 1, bytes.length);
          Atomics.store(control, 0, 1);
          Atomics.notify(control, 0);
        } else if (data.type === 'output') {
          this.hooks.log(data.text, data.error ? 'error' : undefined);
        } else if (data.type === 'done' || data.type === 'error') {
          this.setStatus('ready');
          this.hooks.log(data.type === 'done' ? 'Program complete. Nice work, farmer.' : data.text,
            data.type === 'done' ? 'success' : 'error');
          this.hooks.finished();
        }
      }
    };
    worker.postMessage({ type: 'init' });
  }
  run(code: string) {
    if (this.status !== 'ready') return;
    this.controller = new AbortController();
    this.bridge = new SharedArrayBuffer(8192);
    this.setStatus('running');
    this.hooks.log('> Running cappy.py…');
    this.worker!.postMessage({ type: 'run', code, bridge: this.bridge, runId: this.generation });
  }
  stop() {
    if (this.status !== 'running') return;
    this.controller?.abort();
    this.worker?.terminate();
    ++this.generation;
    this.hooks.log('Program stopped. Completed actions are kept.');
    this.hooks.finished();
    this.initialize();
  }
  retry() {
    if (this.status === 'unavailable') this.initialize();
  }
}
