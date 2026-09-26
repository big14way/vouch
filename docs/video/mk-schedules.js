// Builds the terminal replays from the real run logs (node mk-schedules.js).
const fs = require('fs');
const { fromCommand } = require(process.env.HOME + '/.claude/skills/pitch-video/scripts/schedules.js');
const short = (s) => s.replace(/0x([0-9a-fA-F]{8})[0-9a-fA-F]{24,}([0-9a-fA-F]{4})/g, '0x$1…$2').replace(/https:\/\/vouch-rouge\.vercel\.app\/j\/\S+/, 'vouch-rouge.vercel.app/j/…');
function build(log, cmd, out, pick) {
  const lines = fs.readFileSync(log, 'utf8').split('\n').filter((l) => /^\d\d:\d\d:\d\d/.test(l)).map(short).map(pick);
  fs.writeFileSync(out, JSON.stringify(fromCommand(cmd, lines, { dir: 'vouch/examples/claude-code-payer', gap: 1.0 }), null, 1));
}
build('agent-run-2026-09-26.txt', 'pnpm start   # payer agent hires a worker agent on Tempo', 'schedules/agent.json', (l) => {
  if (/ verdict /.test(l)) return { text: l, cls: 'ok', gap: 1.2 };
  if (/^\S+\s{5}met/.test(l)) return { text: '  ✓ ' + l.replace(/^\S+\s+met\s+/, ''), gap: 0.45 };
  if (/done:/.test(l)) return { text: l, cls: 'ok' };
  return l;
});
build('attack-run-2026-09-26.txt', 'npx tsx attack.ts   # the worker tries to trick the verifier', 'schedules/attack.json', (l) => {
  if (/red flag/.test(l)) return { text: l, cls: 'bad', gap: 0.9 };
  if (/worker submits/.test(l)) return { text: l, cls: 'kw' };
  if (/ verdict /.test(l)) return { text: l, cls: 'kw', gap: 1.2 };
  if (/status/.test(l)) return { text: l, cls: 'ok' };
  return l;
});
