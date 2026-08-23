#!/bin/bash
# negative-control the two e2e teeth that matter most. Backups live OUTSIDE the repo; the landing check uses
# `shasum` (never a function named after the binary it calls — that recursed and aborted before the restore,
# leaving a mutant in the working tree, 2026-08-23).
set -u
R="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"   # ตู๋ T4: the repo is THIS script's repo
BK=$(mktemp -d); cd "$R"
KEY=$(grep '^V2_PREVIEW_KEY=' .env.local | cut -d= -f2- | tr -d '"')
digest() { shasum -a 256 "$1" | cut -d' ' -f1; }
suite() { E2E_BASE_URL=http://127.0.0.1:3363 V2_PREVIEW_KEY="$KEY" npx playwright test e2e/v2-checkout.spec.ts --reporter=line 2>&1 | tail -1; }

mutate() { # name file py
  local name="$1" file="$2" py="$3"
  cp "$file" "$BK/$(basename "$file")"; local h0; h0=$(digest "$file")
  python3 -c "$py"
  if [ "$(digest "$file")" = "$h0" ]; then echo "$name → ❌ มิวแทนต์ไม่ลงไฟล์"; cp "$BK/$(basename "$file")" "$file"; return; fi
  sleep 4
  echo "$name → $(suite)"
  cp "$BK/$(basename "$file")" "$file"
  [ "$(digest "$file")" = "$h0" ] && echo "   restore ✓" || echo "   🔴 RESTORE FAILED"
}

echo "control → $(suite)"
mutate "MU-E1 จอ QR อ้างสำเร็จตอนยัง PENDING" features/v2-shop/components/QrScreen.tsx \
"p='features/v2-shop/components/QrScreen.tsx';s=open(p).read();open(p,'w').write(s.replace(\"  waiting: 'กำลังรอการชำระเงิน…',\",\"  waiting: 'ชำระเงินสำเร็จแล้ว',\",1))"
mutate "MU-E2 จอ result เชื่อ query string" pages/v2/shop/result.tsx \
"p='pages/v2/shop/result.tsx';s=open(p).read();i=s.index('  const state: ResultState =');j=s.index('\n\n',i);open(p,'w').write(s[:i]+'  const state: ResultState = claimed\n'+s[j:])"
sleep 4
echo "หลังคืนทั้งหมด → $(suite)"
echo "git dirty: $(git status --porcelain | wc -l | tr -d ' ') รายการ"
rm -rf "$BK"
