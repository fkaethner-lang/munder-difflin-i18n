'use strict';

const fs = require('node:fs');
const path = require('node:path');

const root = process.argv[2];
if (!root) throw new Error('usage: node demo-auto-mode.cjs <repoRoot>');

const loadTs = require(path.join(root, 'test', 'load-ts.cjs'));
const provider = loadTs('src/shared/agentProvider.ts');
const source = fs.readFileSync(path.join(root, 'src', 'main', 'index.ts'), 'utf8').split(/\r?\n/);
const hasAllProviderPath = typeof provider.argsForAutoMode === 'function';

function mainSpawnArgs(args, enabled, p) {
  if (hasAllProviderPath) return provider.argsForAutoMode(args, enabled, p);
  return p === 'claude' ? provider.argsWithAutoModeFlag(args, enabled, p) : args;
}

function lineLike(text) {
  const i = source.findIndex((line) => line.includes(text));
  return i < 0 ? 'not found' : `${i + 1}: ${source[i].trim()}`;
}

const onInput = ['--model', 'gemini-2.5', 'prompt'];
const offInput = ['--model', 'gemini-2.5', '--approval-mode', 'yolo', 'prompt'];

console.log('demo: auto-mode args for a non-Claude provider');
console.log(`path: ${hasAllProviderPath ? 'argsForAutoMode' : 'spawnAgentCore Claude-only normalization'}`);
if (!hasAllProviderPath) {
  console.log(`source: ${lineLike('if (opts.hive && claudeProvider)')}`);
  console.log(`source: ${lineLike('argsWithAutoModeFlag(opts.args')}`);
}
console.log(`input on: gemini ${onInput.join(' ')}`);
console.log(`spawn args on: ${mainSpawnArgs(onInput, true, 'gemini').join(' ')}`);
console.log(`result on: ${mainSpawnArgs(onInput, true, 'gemini').includes('--approval-mode=yolo') ? 'auto flag present' : 'auto flag missing'}`);
console.log(`input off: gemini ${offInput.join(' ')}`);
console.log(`spawn args off: ${mainSpawnArgs(offInput, false, 'gemini').join(' ')}`);
console.log(`result off: ${mainSpawnArgs(offInput, false, 'gemini').includes('yolo') ? 'stale flag remains' : 'stale flag removed'}`);
