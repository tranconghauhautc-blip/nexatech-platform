# Kong routing architecture (LAN/IP first)

```mermaid
flowchart LR
  Client[Browser / Playwright] --> Kong[Kong Proxy LB<br/>dedicated node]
  Kong -->|/| SF[storefront-web]
  Kong -->|/admin| AD[admin-web]
  Kong -->|/swagger| SW[swagger-portal]
  Kong -->|/security-guide| SG[security-guide-portal]
  Kong -->|/api/v1/auth| ID[identity-service]
  Kong -->|/api/v1/customers| CU[customer-service]
  Kong -->|/api/v1/catalog*| CA[catalog-service]
  Kong -->|/api/v1/media| ME[media-service]
  Kong -->|/api/v1/inventory*| INV[inventory-service]
  Kong -->|/api/v1/cart*| CART[cart-service]
  Kong -->|/api/v1/orders*| ORD[order-service]
  Kong -->|/api/v1/payments*| PAY[payment-service]
  Kong -->|/api/v1/shipping*| SHIP[shipping-service]
  Kong -->|/api/v1/reviews*| REV[review-service]
  Kong -->|/api/v1/warranty*| WAR[warranty-service]
  Kong -->|/api/v1/support*| SUP[support-service]
  Kong -->|/api/v1/notifications*| NOT[notification-service]
  Kong -->|/api/v1/admin/reporting*| RPT[reporting-service]
  Kong -.->|Admin API ClusterIP only| AdminAPI[kong-admin:8001]
```

Notes:

- Strip-path only for portal UI prefixes (`/admin`, `/swagger`, `/security-guide`).
- API paths preserve `/api/v1/...` for Nest global prefixes (no duplicated `/shipping/shipping`).
- Lab routes IP-restricted.
- PUBLIC\_\*\_URL config values — no hard-coded deployment IPs in app source.
