# Render with: $env:METALLB_ADDRESS_POOL replaced (PowerShell) or envsubst.
apiVersion: metallb.io/v1beta1
kind: IPAddressPool
metadata:
  name: nexatech-lan
  namespace: metallb-system
spec:
  addresses:
    - ${METALLB_ADDRESS_POOL}
---
apiVersion: metallb.io/v1beta1
kind: L2Advertisement
metadata:
  name: nexatech-lan
  namespace: metallb-system
spec:
  ipAddressPools:
    - nexatech-lan
