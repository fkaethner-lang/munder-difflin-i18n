'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const root = process.argv[2];
if (!root) throw new Error('usage: node demo-codex-usage.cjs <repoRoot>');

const loadTs = require(path.join(root, 'test', 'load-ts.cjs'));
const usageFile = path.join(root, 'src', 'main', 'codexUsage.ts');

function countTokenCount(dir) {
  let count = 0;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) count += countTokenCount(p);
    else if (entry.isFile() && /\.(ts|tsx|js|cjs)$/.test(entry.name)) {
      const text = fs.readFileSync(p, 'utf8');
      count += (text.match(/token_count/g) ?? []).length;
    }
  }
  return count;
}

function tokenRow() {
  return JSON.stringify({
    timestamp: '2026-09-26T10:00:00.000Z',
    type: 'event_msg',
    payload: {
      type: 'token_count',
      info: {
        total_token_usage: {
          input_tokens: 100,
          cached_input_tokens: 30,
          cache_write_input_tokens: 5,
          output_tokens: 40
        }
      }
    }
  });
}

(async () => {
  console.log('demo: Codex token_count usage ingestion');
  console.log('input: one token_count event with total input=100 cache=30 write=5 output=40');
  if (!fs.existsSync(usageFile)) {
    console.log('feature: src/main/codexUsage.ts missing');
    console.log(`grep token_count in src: ${countTokenCount(path.join(root, 'src'))} matches`);
    console.log('usage recorded: 0 tokens (no Codex ingestion)');
    return;
  }

  const electron = require.resolve('electron', { paths: [root] });
  require.cache[electron] = {
    id: electron,
    filename: electron,
    loaded: true,
    exports: { Notification: class { show() {} static isSupported() { return false; } } }
  };
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'md-demo-codex-usage-'));
  try {
    const agentHome = path.join(tmp, 'hive', 'agents', 'codex-agent', '.codex');
    const sessionDir = path.join(agentHome, 'sessions', '2026', '09', '26');
    fs.mkdirSync(sessionDir, { recursive: true });
    const sessionFile = path.join(sessionDir, 'session.jsonl');
    fs.writeFileSync(sessionFile, `${tokenRow()}\n`);

    const { parseCodexUsageTail, readCodexUsage } = loadTs('src/main/codexUsage.ts');
    const { TelemetryCollector } = loadTs('src/main/telemetry.ts');
    const parsed = parseCodexUsageTail(fs.readFileSync(sessionFile, 'utf8'));
    const read = await readCodexUsage(sessionFile, agentHome);
    const telemetry = new TelemetryCollector();
    telemetry.ingestAgentUsage({
      agentId: 'codex-agent',
      sessionId: 'session-1',
      model: 'gpt-5.5',
      usd: 0,
      ...read
    });
    const sample = telemetry.getAgentUsage('codex-agent');
    console.log(`parser: input=${parsed.input} cacheRead=${parsed.cacheRead} cacheCreation=${parsed.cacheCreation} output=${parsed.output}`);
    console.log(`ledger: input=${sample.input} cacheRead=${sample.cacheRead} cacheCreation=${sample.cacheCreation} output=${sample.output}`);
    console.log(`usage recorded: ${sample.input + sample.cacheRead + sample.cacheCreation + sample.output} tokens`);
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
})().catch((err) => {
  console.error(err && err.stack || err);
  process.exitCode = 1;
});
