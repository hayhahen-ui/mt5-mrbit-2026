// ts-resolve-loader.mjs — cho node test:
// 1) resolve import './x' -> './x.ts' (test logic lib)
// 2) transpile .ts qua TypeScript compiler (ts.transpileModule) thay vì dựa vào
//    --experimental-strip-types — vì strip-types của Node v22+ KHÔNG xóa được
//    import type-only viết thiếu từ khóa `type` (vd: import { NewsEvent } from '../types'),
//    gây SyntaxError "does not provide an export named ...".
// Chạy test: node --no-warnings --loader ./ts-resolve-loader.mjs test-xxx.ts
import { existsSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const ts = require('typescript');

export async function resolve(specifier, context, nextResolve) {
  if ((specifier.startsWith('./') || specifier.startsWith('../')) && context.parentURL) {
    for (const cand of [specifier + '.ts', specifier]) {
      try {
        const url = new URL(cand, context.parentURL);
        if (existsSync(url)) return { url: url.href, shortCircuit: true };
      } catch { /* rơi xuống nextResolve */ }
    }
  }
  return nextResolve(specifier, context);
}

export async function load(url, context, nextLoad) {
  if (url.endsWith('.ts')) {
    const source = readFileSync(new URL(url), 'utf8');
    const { outputText } = ts.transpileModule(source, {
      compilerOptions: {
        module: ts.ModuleKind.ESNext,
        target: ts.ScriptTarget.ES2020,
        jsx: ts.JsxEmit.ReactJSX,
      },
    });
    return { format: 'module', source: outputText, shortCircuit: true };
  }
  return nextLoad(url, context);
}
