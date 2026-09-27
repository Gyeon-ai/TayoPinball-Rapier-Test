import { copyFileSync } from 'node:fs';

for (const [source, target] of [
  ['LICENSE', 'LICENSE.txt'],
  ['NOTICE.md', 'NOTICE.md'],
  ['node_modules/@dimforge/rapier2d-compat/LICENSE', 'RAPIER-APACHE-2.0.txt'],
  ['node_modules/box2d-wasm/LICENSE.zlib.txt', 'BOX2D-ZLIB.txt'],
  ['node_modules/box2d-wasm/LICENSE.wasm-feature-detect.Apache.txt', 'WASM-FEATURE-DETECT-APACHE-2.0.txt'],
]) copyFileSync(source, `dist/${target}`);
