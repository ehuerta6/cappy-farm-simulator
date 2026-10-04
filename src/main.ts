import './style.css';
import { createEditor } from './editor';
import { FarmView } from './farm-view';
import { PythonRuntime, type RuntimeStatus } from './runtime';
import { applyAction, createFarm, carrotCount, objectiveComplete } from './simulation';

const leaf = '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M19 4C9 3 3 8 6 15s14 4 13-11Z" fill="currentColor" opacity=".25"/><path d="m5 20 10-11M10 15v-5m0 5h5" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg>';
const play = '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="m5 3 8 5-8 5Z" fill="currentColor"/></svg>';
const stop = '<svg viewBox="0 0 16 16" aria-hidden="true"><rect x="4" y="4" width="8" height="8" rx="1" fill="currentColor"/></svg>';
const reset = '<svg viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M3 6a5 5 0 1 1 .4 5M3 2v4h4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>';

document.querySelector<HTMLDivElement>('#app')!.innerHTML = `
  <header class="topbar">
    <div class="brand"><span class="brand-icon">${leaf}</span><div>Cappy Farm<span class="brand-sub">A LITTLE CODE, A LITTLE GROWTH</span></div></div>
    <span class="poc-badge"><span></span> Programming playground <small>POC</small></span>
  </header>
  <main>
    <div class="intro"><div><p class="eyebrow">YOUR FIRST LITTLE FARM</p><h1>Good things take a little code.</h1><p>Write Python. Press Run. Let Cappy do the growing.</p></div>
    <div class="objective" role="status" aria-live="polite"><span class="carrot-icon">🥕</span><div><span class="objective-label">TODAY’S OBJECTIVE</span><strong id="objective-text">Plant 3 carrots</strong><div class="progress-track"><div id="progress-fill"></div></div></div><span id="count">0 / 3</span></div></div>
    <section class="workspace" aria-label="Farm programming workspace">
      <div class="code-panel">
        <div class="panel-top"><span class="file-tab"><span class="python-mark">Py</span> cappy.py</span><span class="language">PYTHON</span></div>
        <div id="editor"></div>
        <div class="api-note"><span class="note-heading">CAPPY’S COMMANDS</span><code>move("up" | "down" | "left" | "right")</code><code>plant()</code></div>
        <div class="controls"><button id="run" class="primary" disabled>${play}<span>Loading Python…</span></button><button id="stop" disabled>${stop}Stop</button><button id="reset" title="Restore the farm and keep your code">${reset}Reset</button></div>
      </div>
      <div class="farm-panel">
        <div class="farm-top"><span><span class="live-dot"></span> THE LITTLE FARM</span><span id="farm-status">Cappy is ready for you</span></div>
        <canvas id="farm" aria-label="A six by six farm with Cappy and six soil tiles" role="img"></canvas>
        <div class="farm-bottom"><span id="position">Cappy · tile (1, 3)</span><span class="orientation">↗ up <span>↘ right</span> · 6 × 6 grid</span></div>
      </div>
    </section>
    <section class="console-panel" aria-label="Program output">
      <div class="console-heading"><span><span class="terminal-icon">›_</span> Console</span><span id="runtime-status" role="status"><i></i> Starting Python</span></div>
      <div id="console" role="log" aria-live="polite" aria-relevant="additions"></div>
    </section>
    <footer><span>${leaf} Small steps. Happy capybara.</span><span>Python in your browser · No backend</span></footer>
  </main>`;

function element<T extends HTMLElement>(selector: string) { return document.querySelector<T>(selector)!; }
const runButton = element<HTMLButtonElement>('#run');
const stopButton = element<HTMLButtonElement>('#stop');
const output = element('#console');
const statusLabel = element('#runtime-status');
const editor = createEditor(element('#editor'));
let state = createFarm();
let farm: FarmView;
let runningSource = '';

function log(text: string, kind?: 'error' | 'success') {
  const row = document.createElement('div');
  row.className = `log-entry ${kind ?? ''}`;
  row.textContent = text.slice(0, 8000);
  output.append(row);
  while (output.childElementCount > 100) output.firstElementChild?.remove();
  output.scrollTop = output.scrollHeight;
}
function updateFarmInfo() {
  const count = carrotCount(state);
  element('#count').textContent = `${count} / 3`;
  element('#progress-fill').style.width = `${Math.min(100, count / 3 * 100)}%`;
  element('#objective-text').textContent = objectiveComplete(state) ? '✓ Objective complete!' : 'Plant 3 carrots';
  element('.objective').classList.toggle('complete', objectiveComplete(state));
  element('#position').textContent = `Cappy · tile (${state.cappy.x}, ${state.cappy.y})`;
  element('#farm').setAttribute('aria-label', `Six by six farm. Cappy at tile (${state.cappy.x}, ${state.cappy.y}), facing ${state.cappy.direction}. ${count} carrots planted.`);
}
function updateStatus(status: RuntimeStatus) {
  runButton.disabled = status !== 'ready' || !farm;
  stopButton.disabled = status !== 'running';
  runButton.querySelector('span')!.textContent = status === 'loading' ? 'Loading Python…' : status === 'running' ? 'Running…' : 'Run code';
  const labels = { loading: 'Loading Python', ready: 'Python ready', running: 'Program running', unavailable: 'Python unavailable' };
  statusLabel.replaceChildren();
  statusLabel.append(document.createElement('i'), document.createTextNode(labels[status]));
  statusLabel.dataset.status = status;
  element('#farm-status').textContent = status === 'running' ? 'Cappy is following your code' : 'Cappy is ready for you';
}
try {
  farm = new FarmView(element<HTMLCanvasElement>('#farm'), state);
} catch (error) {
  log(`Could not start the farm renderer: ${String(error)}. A WebGL-capable browser is required.`, 'error');
  element('#farm-status').textContent = 'WebGL is unavailable';
}
const runtime = new PythonRuntime({
  status: updateStatus,
  log,
  finished: () => { editor.highlight(null); if (farm) farm.sync(state); },
  action: async (action, line, signal) => {
    // Editing while running is fine, but avoid highlighting unrelated changed lines.
    editor.highlight(editor.source() === runningSource ? line : null);
    let next;
    try { next = applyAction(state, action); }
    catch (error) {
      await farm.confused(signal);
      throw error;
    }
    const alreadyComplete = objectiveComplete(state);
    await farm.act(action, next, signal);
    if (signal.aborted) throw new DOMException('Stopped', 'AbortError');
    state = next;
    updateFarmInfo();
    log(action.kind === 'plant' ? 'Cappy planted a carrot.' : `Cappy moved ${action.direction}.`);
    if (!alreadyComplete && objectiveComplete(state)) {
      log('✓ Objective complete! Three carrots, one happy Cappy.', 'success');
      await farm.celebrate(signal);
    }
  },
});
runButton.addEventListener('click', () => { runningSource = editor.source(); runtime.run(runningSource); });
stopButton.addEventListener('click', () => runtime.stop());
element('#reset').addEventListener('click', () => {
  runtime.stop();
  runtime.retry();
  state = createFarm();
  if (farm) farm.sync(state);
  editor.highlight(null);
  updateFarmInfo();
  log('Farm reset. A fresh patch of soil awaits.');
});
log('Welcome to your little farm. Run the starter code to plant three carrots.');
updateFarmInfo();
