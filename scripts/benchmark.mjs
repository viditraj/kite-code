#!/usr/bin/env node

/**
 * Performance benchmark for Kite CLI.
 *
 * Measures:
 *   1. Module import time (cold start)
 *   2. --help execution time (full CLI boot)
 *   3. Provider factory initialization
 *   4. Tool registry bootstrap
 *
 * Target: boot < 100ms
 */

import { execSync, execFileSync } from 'node:child_process';
import { performance } from 'node:perf_hooks';
import { existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(__dirname, '..');

// ── Helpers ──────────────────────────────────────────────

function median(arr) {
  const sorted = [...arr].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

function p95(arr) {
  const sorted = [...arr].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length * 0.95)];
}

function formatMs(ms) {
  return ms < 1000 ? `${ms.toFixed(1)}ms` : `${(ms / 1000).toFixed(2)}s`;
}

function runBench(label, fn, iterations = 10) {
  const times = [];
  // Warm-up run
  fn();

  for (let i = 0; i < iterations; i++) {
    const start = performance.now();
    fn();
    times.push(performance.now() - start);
  }

  const med = median(times);
  const pct95 = p95(times);
  const min = Math.min(...times);
  const max = Math.max(...times);

  const status = med < 100 ? '\x1b[32mPASS\x1b[0m' : med < 200 ? '\x1b[33mWARN\x1b[0m' : '\x1b[31mFAIL\x1b[0m';

  console.log(
    `  ${status}  ${label.padEnd(40)} ` +
    `median=${formatMs(med).padStart(8)}  ` +
    `p95=${formatMs(pct95).padStart(8)}  ` +
    `min=${formatMs(min).padStart(8)}  ` +
    `max=${formatMs(max).padStart(8)}`
  );

  return { label, median: med, p95: pct95, min, max, status: med < 100 ? 'pass' : 'warn' };
}

// ── Benchmarks ───────────────────────────────────────────

console.log('');
console.log('  Kite Code — Performance Benchmark');
console.log('  ═════════════════════════════════════════════════════════════');
console.log('');

const results = [];

// 1. CLI --help (full boot)
const cliPath = resolve(projectRoot, 'dist/entrypoints/cli.js');
if (existsSync(cliPath)) {
  results.push(runBench('CLI --help (built)', () => {
    execFileSync('node', [cliPath, '--help'], {
      cwd: projectRoot,
      stdio: 'pipe',
      env: { ...process.env, NODE_NO_WARNINGS: '1' },
    });
  }));
} else {
  console.log('  SKIP  CLI --help (built) — run `npm run build` first');
}

// 2. CLI --help via tsx (dev mode)
results.push(runBench('CLI --help (tsx/dev)', () => {
  execSync('node --no-warnings --import tsx/esm src/entrypoints/cli.ts -- --help', {
    cwd: projectRoot,
    stdio: 'pipe',
    env: { ...process.env, NODE_NO_WARNINGS: '1' },
  });
}, 5)); // fewer iterations — tsx is slower

// 3. Module import time — just import the tool registry
results.push(runBench('Import: tools.ts', () => {
  execFileSync('node', [
    '--no-warnings',
    '--import', 'tsx/esm',
    '-e',
    `import('${resolve(projectRoot, 'src/tools.ts').replace(/\\/g, '/')}')`,
  ], {
    cwd: projectRoot,
    stdio: 'pipe',
    env: { ...process.env, NODE_NO_WARNINGS: '1' },
  });
}, 5));

// 4. Module import time — provider factory
results.push(runBench('Import: providers/factory.ts', () => {
  execFileSync('node', [
    '--no-warnings',
    '--import', 'tsx/esm',
    '-e',
    `import('${resolve(projectRoot, 'src/providers/factory.ts').replace(/\\/g, '/')}')`,
  ], {
    cwd: projectRoot,
    stdio: 'pipe',
    env: { ...process.env, NODE_NO_WARNINGS: '1' },
  });
}, 5));

// ── Summary ──────────────────────────────────────────────

console.log('');
console.log('  ─────────────────────────────────────────────────────────────');

const failing = results.filter(r => r.status !== 'pass');
if (failing.length === 0) {
  console.log('  \x1b[32m✓ All benchmarks within 100ms target\x1b[0m');
} else {
  console.log(`  \x1b[33m⚠ ${failing.length} benchmark(s) above 100ms target:\x1b[0m`);
  for (const r of failing) {
    console.log(`    - ${r.label}: median ${formatMs(r.median)}`);
  }
}

console.log('');
