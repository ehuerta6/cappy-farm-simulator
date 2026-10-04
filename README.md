# Cappy Farm Simulator

A small programming proof of concept: write Python, press Run, and watch a capybara move and plant carrots in a cozy 6 × 6 farm. One scene, one objective: **plant 3 carrots**.

## Local development

Use Node.js 22.12+ and npm.

```sh
npm ci
npm run dev
```

Open the local URL shown by Vite. Installation copies Pyodide's Python/WASM runtime into `public/pyodide`; the app serves it locally, with no CDN, backend, account, or telemetry. The initial Python load can take a few seconds.

```sh
npm run lint
npm run typecheck
npm test
npm run build
npm run preview
```

The production output is `dist/`. `npm run preview` serves it with the required headers.

## Play

Cappy starts at tile `(1, 3)`, facing right. The six soil tiles occupy columns 1–3 and rows 2–3. Coordinates are zero-based. `right` increases the column; `down` increases the row. The fixed three-quarter camera makes the grid directions appear diagonal.

```python
plant()
move("right")
plant()
move("right")
plant()
```

The only gameplay commands are `move("up" | "down" | "left" | "right")` and `plant()`. Real Python supports `print()`, variables, loops, and functions. Each action waits for its animation before Python continues. Invalid actions raise a readable `CappyError`; normal Python exceptions appear in the console.

Run keeps the farm between programs and starts with fresh Python globals. Stop terminates the worker, including infinite loops, cancels the current animation, and keeps completed actions. The runtime reloads before the next run. Reset restores the farm and execution state without deleting the code. Interactive `input()` and installing additional Python packages are outside this POC.

## Browser and hosting requirements

Use a current desktop browser with WebGL, WebAssembly, Web Workers, and `SharedArrayBuffer`. Serve over HTTPS or localhost. The synchronous Python-to-animation bridge requires cross-origin isolation; Vite dev and preview already set:

```text
Cross-Origin-Opener-Policy: same-origin
Cross-Origin-Embedder-Policy: require-corp
```

A static production host must set both headers on responses. Opening `index.html` through `file://` or serving without these headers will not run Python. If the runtime fails to load, the console explains the failure; Reset retries it. Dependencies require network access at installation; the running app fetches its assets from its own origin.

## Implementation

- `src/simulation.ts`: deterministic grid state, action validation, and objective tracking.
- `src/farm-view.ts`: fixed Babylon.js diorama, animation timing, and grid-to-world mapping.
- `src/cappy-model.ts`: upright capybara with an authored pear-shaped body, broad continuous muzzle, straw hat, and independent head/limb animation pivots.
- `src/art.ts` / `src/farm-models.ts`: compact procedural mesh helpers, shared materials, beveled soil plots, carrot foliage, and farm decorations.
- `public/python-worker.js`: isolated Pyodide runtime with synchronous Python commands.
- `src/runtime.ts`: worker lifecycle and a single-action shared-memory acknowledgement bridge. Only the worker calls `Atomics.wait`; the UI stays responsive. Worker termination implements Stop without relying on Python cooperating.
- `src/editor.ts` / `src/main.ts`: CodeMirror editor, execution-line highlight, controls, bounded console, and animation/state coordination. State commits after each completed animation.

Tests cover movement and boundaries, planting, reset, the objective, worker cancellation/recovery, character proportions, grounded planting poses, and neutral-pose recovery. The [approved Cappy character sheet and model comparison](docs/CAPPY_CHARACTER.md) document the visual reference. Renderer details are intentionally kept simple.
