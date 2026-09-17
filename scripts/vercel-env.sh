#!/usr/bin/env bash
# Push every non-empty KEY=value from a local env file into a Vercel project.
#   scripts/vercel-env.sh apps/web/.env.production            # → production
#   scripts/vercel-env.sh apps/web/.env.preview preview       # → preview
# Run from apps/web after `vercel link`. Existing values are overwritten (--force).
set -euo pipefail
file="${1:?usage: scripts/vercel-env.sh <env-file> [production|preview|development]}"
target="${2:-production}"
n=0
while IFS= read -r line || [ -n "$line" ]; do
  [[ "$line" =~ ^[A-Z_0-9]+= ]] || continue
  key="${line%%=*}"; value="${line#*=}"
  [ -z "$value" ] && continue
  printf '%s' "$value" | vercel env add "$key" "$target" --force >/dev/null
  echo "set $key ($target)"; n=$((n + 1))
done < "$file"
echo "$n variables pushed to $target"
