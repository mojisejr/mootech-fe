#!/usr/bin/env bash
# One command to stand up the test stack SAFELY. Never touches prod.
# Steps: guard env → docker postgres(SSL) → restore dump → swap each app's .env (BACKUP first,
# guard AFTER) → print boot commands. The risky parts (backup + post-copy guard) are the whole point.
set -euo pipefail
HERE="$(cd "$(dirname "$0")/.." && pwd)"          # testenv/
GH="$(cd "$HERE/../.." && pwd)"                    # ~/ghq/github.com/mojisejr
GUARD="$HERE/scripts/guard.sh"

# repo → which env template → which real dotfile the app actually loads
#   BE loads .env (no envFilePath) · FE loads .env · bazi loads .env.local
declare -A TARGET=(
  [mootech-fe]="$HERE/env/fe.env:.env"
  [mootech-be]="$HERE/env/be.env:.env"
  [bazi-sft-dataset]="$HERE/env/bazi.env:.env.local"
)

echo "── 1. guard env templates (before) ──"
bash "$GUARD" "$HERE/env/fe.env" "$HERE/env/be.env" "$HERE/env/bazi.env"

echo "── 2. postgres:17 (SSL) up ──"
docker compose -f "$HERE/docker-compose.yml" up -d
echo "   waiting for healthy…"
for i in $(seq 1 24); do
  [ "$(docker inspect -f '{{.State.Health.Status}}' mumate_testenv_pg 2>/dev/null || echo none)" = "healthy" ] && break
  sleep 5
done

echo "── 3. restore dump (if present) ──"
if [ -f "$HERE/dumps/schema.sql" ] || [ -f "$HERE/dumps/full.sql" ]; then
  bash "$HERE/scripts/restore.sh" "$([ -f "$HERE/dumps/full.sql" ] && echo "$HERE/dumps/full.sql" || echo "$HERE/dumps/schema.sql")"
else
  echo "   ⚠ no dump yet — run dump.sh (ฟีม, holds prod cred) then re-run stack.sh"
fi

echo "── 4. swap each app's .env (BACKUP existing → copy template → guard AFTER) ──"
# Backups go to testenv/.backups/ (gitignored) — NOT ".env.prod.bak" loose in each repo, where it
# would hold PROD cred and is NOT gitignored in mootech-be/mootech-fe → committable. (goo's adversary find.)
BK="$HERE/.backups"; mkdir -p "$BK"
for repo in "${!TARGET[@]}"; do
  IFS=':' read -r tmpl dotfile <<< "${TARGET[$repo]}"
  dir="$GH/$repo"; dest="$dir/$dotfile"; bak="$BK/$repo${dotfile//\//_}.prod.bak"
  [ -d "$dir" ] || { echo "   ⚠ $repo not found at $dir — skip"; continue; }
  # 🛑 the existing dotfile may hold PROD cred — back it up (into gitignored .backups/), never clobber
  if [ -f "$dest" ] && [ ! -f "$bak" ]; then
    cp "$dest" "$bak"
    echo "   💾 backed up $repo/$dotfile → testenv/.backups/ (restore: cp '$bak' '$dest')"
  fi
  cp "$tmpl" "$dest"
  # 🛡️ guard AFTER the copy — the RESULTING dotfile must point local, not prod (บอง's catch)
  bash "$GUARD" "$dest" || { echo "   🛑 post-copy guard FAILED for $repo — restoring backup"; [ -f "$bak" ] && cp "$bak" "$dest"; exit 1; }
  echo "   ✅ $repo/$dotfile ← $(basename "$tmpl") (guarded local)"
done

cat <<EOF

── 5. boot the 3 apps (each in its own terminal) ──
  FE    : (cd $GH/mootech-fe && npm run dev)                 # :3000
  BE    : (cd $GH/mootech-be && PORT=4000 npm run start:dev) # :4000
  bazi  : (cd $GH/bazi-sft-dataset && npm run dev -- -p 3100) # :3100
  DB    : localhost:5433  (mumate_test, SSL self-signed)

🛡️ never point any of these at prod — guard.sh refuses prod hosts (before + after env swap).
EOF
