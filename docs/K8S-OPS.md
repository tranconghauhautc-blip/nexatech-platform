# Kubernetes Operations — NexaTech M18

Day-2 operations for cluster workloads in namespace `nexatech`. Assumes Helm release `nexatech`, chart `deploy/helm/nexatech`, production overlay `values-production.yaml`.

**Agent unattended:** read-only commands only (`get`, `describe`, `logs`, `helm template`). Mutating commands require verified operator kube-context.

## Infrastructure map

| Component           | Address               | Role                          |
| ------------------- | --------------------- | ----------------------------- |
| K8s workers         | `192.168.4.205`–`207` | Application node pool         |
| MetalLB VIP (entry) | `192.168.4.204`       | LoadBalancer → nginx entry    |
| PostgreSQL          | `192.168.4.208`       | External DB (outside cluster) |
| Kong Gateway        | `192.168.4.209`       | Edge proxy → VIP only         |

## Preflight — verify kube-context

Before **any** mutate (`apply`, `delete`, `helm upgrade`, `rollout restart`):

```powershell
kubectl config current-context
kubectl cluster-info
kubectl get nodes -o wide
kubectl get ns nexatech
helm list -n nexatech
```

Confirm:

- Context name matches **production** (not `docker-desktop`, not staging).
- All expected nodes `Ready`.
- Release `nexatech` revision matches change ticket.

Wrong context → **STOP**. Do not proceed.

## Rollout

Helm upgrade triggers RollingUpdate on Deployments (default `maxUnavailable: 0`, `maxSurge: 1`).

```powershell
# Operator — after images pushed and values reviewed
helm upgrade --install nexatech deploy/helm/nexatech `
  -f deploy/helm/nexatech/values-production.yaml `
  -f secret-values.yaml `
  --namespace nexatech --wait --timeout 15m
```

Watch rollout:

```powershell
kubectl -n nexatech rollout status deployment/nexatech-storefront-web
kubectl -n nexatech get pods -w
kubectl -n nexatech get jobs | Select-String migrate
```

Migrate Jobs run as Helm hooks **before** new pods scale up. If any migrate Job fails, upgrade aborts — see § Migration Job retry.

Manual rollout restart (same image, refresh config):

```powershell
kubectl -n nexatech rollout restart deployment/nexatech-identity-service
kubectl -n nexatech rollout status deployment/nexatech-identity-service
```

## Rollback

Application rollback (preferred for bad release):

```powershell
helm history nexatech -n nexatech
helm rollback nexatech <revision> -n nexatech --wait
kubectl -n nexatech get pods
```

**Schema rollback:** Helm rollback does **not** reverse applied migrations. If migration was destructive, restore PostgreSQL from backup (`docs/BACKUP-RESTORE.md`) on a controlled window — do not invent untested down SQL on production.

Kong rollback: re-apply previous known-good `kong.production.yml` on VM `.209`.

## Scale

```powershell
# Temporary scale-up
kubectl -n nexatech scale deployment/nexatech-catalog-service --replicas=3

# Persistent — edit values-production.yaml replicaCount then helm upgrade
```

HPA (when enabled in values): `kubectl -n nexatech get hpa`

Respect PDB: `kubectl -n nexatech get pdb` — scale-down may be blocked if `minAvailable` violated.

## Restart

| Target            | Command                                                                              |
| ----------------- | ------------------------------------------------------------------------------------ |
| Single Deployment | `kubectl -n nexatech rollout restart deployment/<name>`                              |
| Entry nginx       | `kubectl -n nexatech rollout restart deployment/nexatech-entry`                      |
| Platform Redis    | `kubectl -n nexatech rollout restart statefulset/nexatech-redis` (brief cache flush) |
| All apps          | Loop deployments or `helm upgrade --reuse-values` with restart annotation            |

After restart, run `scripts/validate-production.ps1` or `.sh`.

## Migration Job retry

Full Prisma runbook: **`docs/MIGRATIONS.md`**.

Summary:

1. `kubectl -n nexatech logs job/<service>-migrate`
2. Fix Secret `*-database-url`, network policy, or DB grants on `.208`
3. `kubectl -n nexatech delete job <service>-migrate` (if failed Job remains)
4. Re-run: `helm upgrade --install …` (hooks recreate Jobs)

Hooks: `pre-install,pre-upgrade`, `backoffLimit: 1`, `hook-delete-policy: before-hook-creation,hook-succeeded`.

**Never** `prisma migrate reset` or `db push` on production.

## Failed Job recovery

```powershell
kubectl -n nexatech get jobs
kubectl -n nexatech describe job identity-service-migrate
kubectl -n nexatech logs job/identity-service-migrate
```

| Symptom                       | Likely cause                         | Action                                          |
| ----------------------------- | ------------------------------------ | ----------------------------------------------- |
| `BackoffLimitExceeded`        | SQL error, bad URL, permission       | Fix root cause; delete Job; re-upgrade          |
| `ImagePullBackOff` on Job pod | Wrong tag / missing `-migrate` image | Push migrate image; verify `imageTag`           |
| Timeout                       | DB unreachable from cluster          | Check firewall `.208` ← workers; Secret host    |
| Hook weight ordering          | Rare race                            | Sequential helm upgrade; check hook annotations |

Bucket-init or one-off Jobs: same triage pattern — logs → describe → fix → delete Job → retry.

## PVC troubleshooting

Platform components use PVCs (Redis, RabbitMQ, MinIO).

```powershell
kubectl -n nexatech get pvc
kubectl -n nexatech describe pvc <name>
kubectl -n nexatech get pv
```

| Issue                       | Diagnosis                  | Remediation                                                                    |
| --------------------------- | -------------------------- | ------------------------------------------------------------------------------ |
| `Pending` PVC               | No StorageClass / capacity | Set `platform.*.persistence.storageClass` in values; expand pool               |
| `FailedMount`               | Node or CSI driver         | `kubectl describe pod`; check node `.205–207` disk                             |
| Full disk                   | App write errors           | Expand PVC if supported; MinIO lifecycle; **do not** delete PVC without backup |
| Wrong data after reschedule | AZ / node binding          | StatefulSet volumeClaimTemplates bind to PV — restore from backup if corrupted |

Snapshot before destructive ops: use storage vendor snapshot or Velero (if deployed).

## Node failure

```powershell
kubectl get nodes
kubectl describe node 192.168.4.205
```

1. Cordon failed node: `kubectl cordon <node>`
2. Drain (if recoverable maintenance): `kubectl drain <node> --ignore-daemonsets --delete-emptydir-data`
3. Pods reschedule to healthy workers `.206/.207`
4. MetalLB: VIP `.204` should reattach when entry Service has healthy endpoints
5. Replace / rejoin node per infra playbook; `kubectl uncordon <node>`

If **all** workers down: cluster unavailable — restore nodes first; Postgres on `.208` may still be up (apps fail DB connection until K8s returns).

## Pod Pending

```powershell
kubectl -n nexatech describe pod <pod-name>
```

Common causes:

| Event message                              | Fix                                    |
| ------------------------------------------ | -------------------------------------- |
| `Insufficient cpu/memory`                  | Add node capacity or lower requests    |
| `didn't match Pod's node affinity`         | Fix affinity/tolerations in values     |
| `0/N nodes available: pod has unbound PVC` | Fix PVC (see above)                    |
| `Too many pods`                            | Increase kubelet pod limit or add node |
| `ImagePullBackOff`                         | See below                              |

## CrashLoopBackOff

```powershell
kubectl -n nexatech logs <pod> --previous
kubectl -n nexatech describe pod <pod>
```

| Pattern                    | Likely cause                                                       |
| -------------------------- | ------------------------------------------------------------------ |
| Exit immediately on start  | Bad env / missing Secret key                                       |
| DB connection errors       | `.208` down, wrong URL, pool exhausted                             |
| OOMKilled                  | Raise memory limits or fix leak                                    |
| Probe failures             | App slow start — tune `initialDelaySeconds`; check `/health/ready` |
| Redis/RabbitMQ unreachable | Platform pod down; NetworkPolicy too strict                        |

Fix underlying issue → rollout restart. Do not disable probes in production without review.

## ImagePullBackOff

```powershell
kubectl -n nexatech describe pod <pod> | Select-String -Pattern "Failed|pull"
```

- Verify image exists: `docker pull docker.io/<user>/nexatech-identity-service:0.17.0`
- Check `global.imagePullSecrets` (`dockerhub-pull`) and registry credentials
- Confirm tag is **not** `latest` — use semver/git SHA from release
- Migrate Jobs need `:tag-migrate` image

## Secret rotation

Rotate in maintenance window; order matters for zero-downtime where possible.

### JWT / session secrets

1. Generate new secrets (min 32 chars access/refresh, 16 admin session)
2. Update K8s Secret `nexatech-secrets`
3. Rolling restart identity + admin + services validating JWT
4. Users re-login (refresh tokens invalidated)

### Database passwords

1. `ALTER USER … PASSWORD` on `.208`
2. Update each `*-database-url` in Secret
3. Rolling restart all affected Deployments
4. Verify migrate Job can still connect (deploy dry-run Job if needed)

### MinIO / RabbitMQ / Redis

Update platform keys in Secret → restart platform StatefulSets/Deployments → restart app pods.

Document rotation date in change log. Never commit new values to git.

## Certificate rotation

| Layer      | Location                           | Action                                            |
| ---------- | ---------------------------------- | ------------------------------------------------- |
| Public TLS | Citrix ADC / Imperva → Kong `.209` | Operator renews cert; reload Kong/nginx           |
| Kong → VIP | HTTP internal LAN                  | Optional TLS between Kong and entry               |
| Postgres   | `.208`                             | `sslmode=prefer` in URLs; renew server cert on VM |
| In-cluster | Service mesh N/A M18               | —                                                 |

After cert change: curl storefront via public URL; check Kong admin health.

## MetalLB VIP / entry / Kong health checks

### MetalLB VIP `192.168.4.204`

```powershell
kubectl -n nexatech get svc nexatech-entry -o wide
# EXTERNAL-IP should be 192.168.4.204
kubectl -n nexatech get endpoints nexatech-entry
```

From jump host:

```bash
curl -sf http://192.168.4.204/healthz
curl -sf -o /dev/null -w '%{http_code}' http://192.168.4.204:3001/health/live
curl -sf -o /dev/null -w '%{http_code}' http://192.168.4.204:3100/
```

Entry port map (Kong upstreams):

| VIP port  | Service        |
| --------- | -------------- |
| 80        | storefront-web |
| 3100      | admin-web      |
| 3001–3014 | API services   |

### Kong VM `192.168.4.209`

- Declarative config: `infra/kong/kong.production.yml` — all upstreams **only** `192.168.4.204`
- Apply: operator on VM (BLOCKED_EXTERNAL for agent)
- Health: Kong admin API `/status` ; route smoke via public host

If VIP healthy but Kong 502: Kong config drift or wrong upstream port — diff `kong.production.yml` vs entry Service ports.

## NetworkPolicy (production enable path)

Template: `deploy/helm/nexatech/templates/networkpolicy-ready.yaml`

Default `networkPolicy.enabled: false` in `values.yaml`. For production hardening:

```yaml
# values-production.yaml (when ready)
networkPolicy:
  enabled: true
```

Enabling default-deny ingress requires companion allow policies (entry → apps, apps → platform, DNS). Test on staging before production toggle. See `docs/SECURITY-BASELINE.md`.

## Disaster recovery checklist

Use after major outage (cluster loss, DB corruption, region failure).

- [ ] Confirm incident scope (K8s only vs Postgres vs both)
- [ ] Stop write traffic (Kong maintenance page / ADC pool drain)
- [ ] Preserve logs: `kubectl logs`, Loki export if available
- [ ] PostgreSQL: restore from latest **verified** backup to `.208` or replacement VM (operator)
- [ ] Validate restore on test DB before prod cutover (`docs/BACKUP-RESTORE.md`)
- [ ] Recreate namespace + Secrets from encrypted backup
- [ ] `helm upgrade --install` with last known good `imageTag` and values
- [ ] All migrate Jobs `Completed` (or schema already at head)
- [ ] MinIO: restore mirror if media loss
- [ ] RabbitMQ: import definitions; accept message loss if no shovel backup
- [ ] VIP `.204` assigned; entry `/healthz` OK
- [ ] Apply Kong config on `.209`
- [ ] Run `scripts/validate-production.*`
- [ ] Smoke: login, catalog browse, cart (staging account)
- [ ] Post-incident review + backup drill schedule

## Useful read-only commands

```powershell
kubectl -n nexatech get all
kubectl -n nexatech top pods
kubectl -n nexatech get events --sort-by='.lastTimestamp'
helm get values nexatech -n nexatech
helm get manifest nexatech -n nexatech | Select-String "kind: Deployment"
```

## Related documents

- `docs/MIGRATIONS.md`
- `docs/BACKUP-RESTORE.md`
- `docs/DEPLOY-RUNBOOK-PRODUCTION.md`
- `docs/SECURITY-BASELINE.md`
- `scripts/validate-production.sh` / `.ps1`
