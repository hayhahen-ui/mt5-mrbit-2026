// ts-resolve-loader.mjs — cho node test resolve import './x' -> './x.ts' (dùng cho test logic lib)
import { existsSync } from 'node:fs';

export async function resolve(specifier, context, nextResolve) {
  if ((specifier.startsWith('./') || specifier.startsWith('../')) && context.parentURL) {
    try {
      const url = new URL(specifier + '.ts', context.parentURL);
      if (existsSync(url)) return { url: url.href, shortCircuit: true };
    } catch { /* rơi xuống nextResolve */ }
  }
  return nextResolve(specifier, context);
}
