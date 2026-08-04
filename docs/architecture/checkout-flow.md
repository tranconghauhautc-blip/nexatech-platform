# Checkout flow

```mermaid
sequenceDiagram
  participant C as Customer
  participant Cart as cart-service
  participant Ord as order-service
  participant Inv as inventory-service
  participant Pay as payment-service
  participant Ship as shipping-service
  C->>Cart: validate cart
  C->>Ord: checkout (Standard|Pickup + COD|MOCK)
  Ord->>Inv: reserve stock (idempotent)
  Ord->>Ord: create order+packages+outbox (txn)
  alt COD
    Ord->>Pay: create COD PENDING
  else MOCK
    Ord->>Pay: create MOCK + checkout URL
  end
  opt Standard
    Ord->>Ship: create shipment booking (staff/flow)
  end
  opt Store Pickup
    Note over Ship: no carrier shipment; pickup code later
  end
```
