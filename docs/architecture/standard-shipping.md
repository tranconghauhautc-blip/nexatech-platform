# Standard shipping → order sync (P0)

```mermaid
sequenceDiagram
  participant Carrier as Mock/Carrier
  participant Ship as shipping-service
  participant Order as order-service
  participant Notif as notification-service
  participant Rpt as reporting-service
  Carrier->>Ship: delivery webhook / status update
  Ship->>Ship: update shipment + clear orderSyncedAt on change
  Ship->>Order: POST /api/v1/orders/:id/shipping-sync (Staff service identity)
  Order->>Order: package DELIVERED; promote order multi-step
  Order->>Order: order DELIVERED only if ALL packages DELIVERED
  Ship-->>Notif: shipping.shipment.* outbox
  Ship-->>Rpt: shipping.shipment.* outbox
  Note over Ship,Order: Idempotent on event key; optimistic lock retry
```
