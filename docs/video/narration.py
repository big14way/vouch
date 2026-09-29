"""Regenerate NARRATION.md from demo.json and a build log (scene durations).
python3 narration.py <build.log>"""
import json, re, subprocess, sys
cfg = json.load(open('demo.json'))
durs = {}
for line in open(sys.argv[1]):
    m = re.match(r'\s*(\S+)\s+\S+\s+([\d.]+)s\s*$', line)
    if m: durs[m.group(1)] = float(m.group(2))
head = """# Pitch video — narration

Built with the pitch-video skill: `caffeinate -i python3 ~/.claude/skills/pitch-video/scripts/build_demo.py demo.json` (clips from `node record.js scenes.json`). Output: `out/vouch-pitch.mp4` (gitignored). This table: `python3 narration.py <build log>`.

Evidence behind every scene: the UI flow is job `0x6229218f…314392` on the public deployment (Sept 26, PASS 0.92, settled), a re-enactment of Rita's job the way it should have gone, with test wallets; the private payout is a live Zone A send from the worker wallet (Sept 27); the Tempo agent run, the injection run and the Base x402 run are the logs in this folder; Earn is the Sept 17 contract run on a labelled demo venue (docs/e2e-earn-moderato-2026-09-17.txt); the freelancer figure is from BUILD_SPEC_v3.md §1.2. Rita is the founder's sister, a freelance designer in Nigeria; the two "Why we built this" scenes tell her story in the founder's voice. Photos are illustrative and are not her (img/CREDITS.md).

| # | Scene | Seconds | Narration |
|---|---|---|---|
"""
rows, total = [], 0.0
for s in cfg['scenes']:
    title = s.get('head') or s.get('tagline') or ''
    d = durs.get(s['id'], 0.0); total += d
    rows.append(f"| {s['id']} | {title} | {d:.1f} | {s['vo']} |")
try:
    fl = float(subprocess.check_output(['ffprobe', '-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', cfg['output']]))
except Exception:
    fl = 0.0
note = f"Scene durations add to {total:.1f} s; the file is {fl:.1f} s ({int(fl // 60)}:{int(fl % 60):02d}) after the {cfg.get('crossfade', 0.6)} s crossfades." if fl else f"Total: {total:.1f} s"
open('NARRATION.md', 'w').write(head + '\n'.join(rows) + '\n\n' + note + '\n')
print(f"NARRATION.md: {len(rows)} scenes; {note}")
