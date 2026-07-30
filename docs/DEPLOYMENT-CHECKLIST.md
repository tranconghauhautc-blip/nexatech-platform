# Deployment Checklist — Final (M21)

See also `docs/RELEASE-CHECKLIST.md` and `docs/DEPLOYMENT-ORDER.md`.

## Production

- [ ] Image tag pinned (not latest)
- `NEXATECH_SECURITY_LAB=0` / `deployProfile=production`
- [ ] Secrets created
- [ ] DB backup taken
- [ ] migrate deploy Jobs OK
- [ ] smoke-release OK
- [ ] Kong/Citrix/Imperva (**OPERATOR**)

## Security lab

- [ ] Separate namespace `nexatech-security-lab`
- [ ] Lab secrets + fake data only
- [ ] Image tag `*-sec-lab`
- [ ] `/health/lab` returns marker
- [ ] `pnpm security:test:lab` with ACK
- [ ] NetworkPolicy enabled
- [ ] Not publicly routed without allowlist

## BLOCKED_EXTERNAL

Citrix, Imperva, live Kong, live helm upgrade, docker push, firewall.
