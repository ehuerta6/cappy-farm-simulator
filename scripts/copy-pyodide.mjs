import { mkdir, copyFile } from 'node:fs/promises';

// Serve the runtime locally: no CDN dependency and no cross-origin resources.
await mkdir('public/pyodide', { recursive: true });
for (const file of ['pyodide.js', 'pyodide.asm.js', 'pyodide.asm.wasm', 'python_stdlib.zip', 'pyodide-lock.json']) {
  await copyFile(`node_modules/pyodide/${file}`, `public/pyodide/${file}`);
}
console.log('Local Python runtime ready.');
