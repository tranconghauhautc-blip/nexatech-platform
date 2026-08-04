# Kubernetes deployment topology

```mermaid
flowchart TB
  subgraph KongNode[Kong node — nexatech.io/role=kong + taint]
    Kong[Kong Gateway + KIC]
  end
  subgraph AppNodes[App nodes x3 — nexatech.io/role=app]
    SF[storefront / admin / portals]
    SVC[14 microservices]
    PLAT[Redis / RabbitMQ / MinIO / Mailpit]
    JOBS[migrate + seed Jobs]
  end
  PG[(External PostgreSQL server<br/>1 DB + user per service)]
  Client[LAN clients] --> Kong
  Kong --> SF
  Kong --> SVC
  SVC --> PG
  SVC --> PLAT
  JOBS --> PG
```

Scheduling:

- Application workloads: `nodeSelector: nexatech.io/role=app` + topology spread
- Kong: `nodeSelector: nexatech.io/role=kong` + toleration `dedicated=kong:NoSchedule`
- Migrations: dedicated Jobs before rollout — never in app replicas
