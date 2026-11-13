// Os testes Node carregam os mesmos módulos WASM que Wrangler inclui no Worker.
import { registerHooks } from 'node:module';
import { readFileSync } from 'node:fs';

registerHooks({
  load(url, context, nextLoad) {
    if (!url.endsWith('.wasm')) return nextLoad(url, context);
    const bytes = readFileSync(new URL(url)).toString('base64');
    return { format: 'module', shortCircuit: true,
      source: `export default new WebAssembly.Module(Uint8Array.from(atob('${bytes}'), c => c.charCodeAt(0)));` };
  },
});
