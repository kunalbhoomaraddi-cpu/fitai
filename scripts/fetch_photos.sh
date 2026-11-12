#!/usr/bin/env bash
# Downloads curated Unsplash photos into frontend/public/images/photos (bundled locally, no hotlinking).
# Photos are under the Unsplash License (https://unsplash.com/license): free for commercial use, no
# attribution required. Any photo that fails to download is simply skipped — the app then shows
# FitAI's original bundled artwork for that slot.
set -u
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
OUT="$ROOT/frontend/public/images/photos"
mkdir -p "$OUT"
ok=0; skip=0; fail=0
while IFS='|' read -r name id subject; do
  [[ -z "${name// }" || "$name" == \#* ]] && continue
  dest="$OUT/$name.jpg"
  if [[ -s "$dest" ]]; then skip=$((skip+1)); continue; fi
  url="https://images.unsplash.com/${id}?auto=format&fit=crop&w=1600&q=72&fm=jpg"
  if curl -fsSL --max-time 25 -o "$dest.tmp" "$url" && file "$dest.tmp" 2>/dev/null | grep -qiE 'jpeg|image'; then
    mv "$dest.tmp" "$dest"; ok=$((ok+1)); echo "  ✓ $name ($subject)"
  else
    rm -f "$dest.tmp"; fail=$((fail+1)); echo "  · $name — unavailable, using bundled artwork"
  fi
done < "$ROOT/scripts/photos.txt"
echo "Photos: $ok downloaded, $skip already present, $fail using artwork fallback → $OUT"
