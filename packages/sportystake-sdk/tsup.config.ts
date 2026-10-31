import { defineConfig } from 'tsup';

export default defineConfig({
  entry: { index: 'src/index.ts' },
  format: ['esm', 'cjs'],
  dts: true,
  target: 'es2022',
  splitting: false,
  clean: true,
  sourcemap: true,
  treeshake: true,
  external: ['viem'],
});
