# Product Media Pipeline Audit

> Snapshot **2026-08-02** final acceptance.

## Pipeline stages

| Stage | Status | Evidence |
| ----- | ------ | -------- |
| Catalog seed | COMPLETE | — |
| Placeholder / batch import | COMPLETE | prior import |
| Presign API | PASS | media-e2e |
| MinIO PUT | PASS | docker network curl (Host=minio) |
| Confirm | PASS | media-e2e |
| Link entity | PASS | by-entity lists mediaId |
| Admin UI upload | source + rewrite | browser rewrite minio→localhost |
| `pnpm media:audit` | PASS | no `minio:9000` in sampled browser URLs |
| Storefront rendering | PARTIAL→OK | seeded products have linked media (8/10 sampled) |

## Conclusion

```
Product image upload end-to-end:
Admin Browser (UI ready) / Admin API
→ Media API (presign)
→ MinIO
→ Media DB record
→ Catalog product binding
→ Storefront rendering (existing links)
= PASS with API+runtime evidence
```

## Constraints

- Presigned URLs signed for `minio` hostname: upload from Compose network or use Admin rewrite for browser.
- Do not delete production/lab media during acceptance.
- Intentional upload vulns remain always-on (Security Guide).
