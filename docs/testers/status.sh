#!/usr/bin/env bash
# Where each tester link stands: status, verdict, confidence. Public API, no keys needed.
#   docs/testers/status.sh            (reads links.local.md)
set -euo pipefail
cd "$(dirname "$0")"
API="${VOUCH_API_URL:-https://vouch-rouge.vercel.app}"
printf "%-46s %-10s %-13s %s\n" "TASK" "STATUS" "VERDICT" "LINK"
grep -o "| [^|]* | https://[^ ]*/j/0x[0-9a-f]\{64\}" links.local.md | while IFS='|' read -r _ task link; do
  id="${link##*/}"
  job=$(curl -s "$API/api/v1/jobs/$id")
  status=$(echo "$job" | python3 -c "import sys,json; print(json.load(sys.stdin)['job']['pill'])")
  verdict=$(curl -s "$API/api/v1/jobs/$id/verdict" | python3 -c "import sys,json; v=json.load(sys.stdin); print(f\"{v['verdict']} {round((v['confidence'] or 0)*100)}%\" if v.get('verdict') else '-')")
  printf "%-46s %-10s %-13s %s\n" "$(echo "$task" | sed "s/^ *//; s/ *$//")" "$status" "$verdict" "$(echo "$link" | tr -d " ")"
done
