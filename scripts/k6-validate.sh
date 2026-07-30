#!/usr/bin/env bash
# Validate k6 scripts syntax (requires k6 in PATH). Dry-run friendly.
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

if ! command -v k6 >/dev/null 2>&1; then
  echo "[k6-validate] BLOCKED: k6 not in PATH — syntax check skipped"
  exit 0
fi

fail=0
for f in tests/k6/*.js; do
  echo "[k6-validate] checking $f"
  if k6 inspect "$f" >/dev/null 2>&1; then
    echo "[k6-validate] PASS: $f"
  else
    # older k6 may not have inspect — fall back to dry run with 0 VUs via --vus 1 --duration 1s against invalid will still parse
    if k6 run --vus 1 --duration 1s -e BASE_URL=http://127.0.0.1:9 "$f" >/dev/null 2>&1; then
      echo "[k6-validate] PASS (run smoke): $f"
    else
      # Parse errors exit non-zero; connection refused is OK for syntax
      out="$(k6 run --vus 1 --duration 1s -e BASE_URL=http://127.0.0.1:9 "$f" 2>&1 || true)"
      if echo "$out" | grep -qiE 'SyntaxError|GoError.*javascript|could not load'; then
        echo "[k6-validate] FAIL: $f"
        echo "$out" | tail -n 20
        fail=1
      else
        echo "[k6-validate] PASS (parse ok / target down): $f"
      fi
    fi
  fi
done

if [[ "$fail" -ne 0 ]]; then
  echo "[k6-validate] Result: FAIL"
  exit 1
fi
echo "[k6-validate] Result: OK"
exit 0
