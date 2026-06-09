import * as esbuild from 'esbuild';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const dir = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(dir, '..', 'flock-overview.js');

await esbuild.build({
  entryPoints: [path.join(dir, 'src/index.js')],
  bundle: true,
  format: 'iife',
  globalName: 'FlockOverviewBundle',
  platform: 'browser',
  target: ['es2020'],
  outfile: OUT,
  legalComments: 'none',
  logLevel: 'info',
  // The webapp runs the output via `new Function('module', code)` and reads
  // `module.exports`, so map the bundle's default export onto it.
  banner: {
    js: '/* eslint-disable */\n/* AUTO-GENERATED from ./flock-overview/src — run `npm run build` to regenerate. Do not edit by hand. */',
  },
  footer: {
    js: 'module.exports = (typeof FlockOverviewBundle !== "undefined" && FlockOverviewBundle.default) ? FlockOverviewBundle.default : FlockOverviewBundle;',
  },
});

const { size } = await fs.stat(OUT);
// eslint-disable-next-line no-console
console.log(`Built ${path.relative(dir, OUT)} (${(size / 1024 / 1024).toFixed(2)} MB)`);
