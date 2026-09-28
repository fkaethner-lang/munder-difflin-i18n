'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const root = process.argv[2];
if (!root) throw new Error('usage: node demo-codex-add-dir.cjs <repoRoot>');

const electron = require.resolve('electron', { paths: [root] });
require.cache[electron] = {
  id: electron,
  filename: electron,
  loaded: true,
  exports: { Notification: class { show() {} static isSupported() { return false; } } }
};

const loadTs = require(path.join(root, 'test', 'load-ts.cjs'));
const { HiveManager } = loadTs('src/main/hive.ts');

function compact(args, home) {
  const out = [];
  for (let i = 0; i < args.length - 1; i++) {
    if (args[i] === '--add-dir') out.push('--add-dir', args[++i].replace(home, '<home>'));
    else if (args[i].startsWith('-')) out.push(args[i]);
    else if (out.at(-1)?.startsWith('-')) out.push(args[i]);
  }
  return out.join(' ');
}

async function run(label, launchArgs) {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'md-demo-add-dir-'));
  const oldHome = process.env.HOME;
  const oldUserProfile = process.env.USERPROFILE;
  try {
    process.env.HOME = home;
    process.env.USERPROFILE = home;
    const hive = new HiveManager(() => home);
    const extra = path.join(home, 'shared');
    const inj = await hive.ensureAgent(
      { id: 'codex-agent', name: 'a Codex agent', provider: 'codex', cwd: home },
      { launchArgs, extraWritableDirs: [extra] }
    );
    const shownArgs = [...launchArgs, ...inj.args];
    const hasAddDir = shownArgs.includes('--add-dir');
    console.log(`${label}`);
    console.log(`input: codex ${launchArgs.join(' ')}`);
    console.log(`spawn args: ${compact(shownArgs, home)}`);
    console.log(`result: --add-dir ${hasAddDir ? 'present' : 'absent'}`);
    if (hasAddDir && !launchArgs.join(' ').includes('workspace-write')) {
      console.log('Codex would reject: Error adding directories: Ignoring --add-dir ...');
      console.log('because the effective permissions do not allow additional writable roots');
    }
  } finally {
    if (oldHome === undefined) delete process.env.HOME; else process.env.HOME = oldHome;
    if (oldUserProfile === undefined) delete process.env.USERPROFILE; else process.env.USERPROFILE = oldUserProfile;
    fs.rmSync(home, { recursive: true, force: true });
  }
}

(async () => {
  console.log('demo: Codex --add-dir with read-only vs workspace-write');
  await run('case: no writable sandbox', ['--model', 'gpt-5.5']);
  await run('case: workspace-write', ['--model', 'gpt-5.5', '-s', 'workspace-write']);
})().catch((err) => {
  console.error(err && err.stack || err);
  process.exitCode = 1;
});
