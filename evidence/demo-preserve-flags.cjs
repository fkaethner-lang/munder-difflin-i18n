'use strict';

const path = require('node:path');

const root = process.argv[2];
if (!root) throw new Error('usage: node demo-preserve-flags.cjs <repoRoot>');

const loadTs = require(path.join(root, 'test', 'load-ts.cjs'));
const config = loadTs('src/renderer/src/store/config.ts');
const merge = config.mergeSpawnCommand ?? ((previous, cfg, model, provider) =>
  config.buildSpawnCommand(cfg, model, provider));

function show(label, previous, cfg, model) {
  const command = merge(previous, cfg, model, 'codex', 'codex');
  console.log(label);
  console.log(`stored: ${previous}`);
  console.log(`rebuilt: ${command}`);
  console.log(`tokens: ${config.tokenizeCommand(command).join(' ')}`);
}

console.log('demo: Codex restart/edit preserves user flags');
show(
  'case: model switch, auto-mode off',
  'codex --model gpt-5.5 -s workspace-write',
  { defaultCommand: 'codex', autoMode: false },
  'gpt-6'
);
show(
  'case: stored approval bypass, auto-mode off',
  'codex --model gpt-5.5 -a never',
  { defaultCommand: 'codex', autoMode: false },
  'gpt-6'
);
