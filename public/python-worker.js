/* global loadPyodide */
let pyodide;
let bridge;
let runId;
let outputCount = 0;
function output(text, error = false) {
  if (outputCount++ < 200) self.postMessage({ type: "output", runId, text: text.slice(0, 8000), error });
  else if (outputCount === 201) self.postMessage({ type: "output", runId, text: "Output limit reached. Further print output is hidden for this run." });
}

// Python is synchronous. Only this worker blocks; the main thread renders the
// action, then writes an acknowledgement into shared memory and wakes us.
function requestAction(kind, direction, line) {
  const control = new Int32Array(bridge, 0, 2);
  Atomics.store(control, 0, 0);
  self.postMessage({ type: 'action', runId, action: { kind, direction }, line });
  Atomics.wait(control, 0, 0);
  const length = Atomics.load(control, 1);
  return new TextDecoder().decode(new Uint8Array(bridge, 8, length).slice());
}

self.onmessage = async ({ data }) => {
  if (data.type === 'init') {
    try {
      importScripts('./pyodide/pyodide.js');
      pyodide = await loadPyodide({ indexURL: new URL('./pyodide/', self.location.href).href });
      pyodide.setStdout({ batched: text => output(text) });
      pyodide.setStderr({ batched: text => output(text, true) });
      pyodide.setStdin({ stdin: () => { throw new Error('Interactive input() is not supported in this POC.'); } });
      pyodide.registerJsModule('_cappy_bridge', { requestAction });
      self.postMessage({ type: 'ready' });
    } catch (error) {
      self.postMessage({ type: 'load-error', text: String(error) });
    }
  } else if (data.type === 'run') {
    bridge = data.bridge;
    runId = data.runId;
    outputCount = 0;
    let scope;
    try {
      scope = pyodide.runPython('dict(__name__="__main__")');
      pyodide.runPython(`
from _cappy_bridge import requestAction as _request_action
import sys as _sys
class CappyError(Exception):
    pass

def move(direction):
    if not isinstance(direction, str):
        raise CappyError('Choose a direction: "up", "down", "left", or "right".')
    error = _request_action("move", direction, _sys._getframe(1).f_lineno)
    if error:
        raise CappyError(error)

def plant():
    error = _request_action("plant", "", _sys._getframe(1).f_lineno)
    if error:
        raise CappyError(error)
`, { globals: scope });
      // Compile with a real filename so traceback line numbers match the editor.
      scope.set('_source', data.code);
      pyodide.runPython('exec(compile(_source, "cappy.py", "exec"))', { globals: scope });
      self.postMessage({ type: 'done', runId });
    } catch (error) {
      self.postMessage({ type: 'error', runId, text: String(error) });
    } finally {
      scope?.destroy();
    }
  }
};
