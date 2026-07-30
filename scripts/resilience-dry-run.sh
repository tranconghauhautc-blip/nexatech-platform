#!/usr/bin/env bash
# Resilience dry-run — prints planned failure-mode checks; does NOT mutate cluster.
set -euo pipefail
echo "[resilience-dry-run] DRY-RUN only — no cluster mutation"
modes=(
  "F01 PostgreSQL unavailable"
  "F03 Redis unavailable"
  "F05 RabbitMQ unavailable"
  "F07 MinIO unavailable"
  "F09 Downstream REST timeout"
  "F13 Pod restart"
  "F16 Image pull failure"
  "F17 Secret missing"
  "F19 Migration failure"
  "F23 Kong upstream unavailable"
)
i=0
for m in "${modes[@]}"; do
  i=$((i + 1))
  echo "[resilience-dry-run] PASS: planned check $i — $m"
done
echo "[resilience-dry-run] See docs/RESILIENCE-TESTING.md"
echo "[resilience-dry-run] Result: OK (dry-run)"
exit 0
