# Lab: một lệnh Helm là lên stack

## Ý tưởng đơn giản

```
Máy build (dev)
  → docker build + push lên GHCR (GitHub Container Registry)
  → đóng gói Helm chart thành zip lab-kit

Máy lab (K8s)
  → unzip lab-kit
  → điền secret.env (một lần)
  → .\install.ps1   ← Helm kéo image public từ GHCR, cài hết
```

Images **không** nằm trong zip (quá nặng). Zip chỉ có chart + values + script.
Cluster lab phải ra được internet tới `ghcr.io`.

## Đã sẵn sàng (2026-08-12)

| Thành phần | Giá trị |
| ---------- | ------- |
| Registry | `ghcr.io/tranconghauhautc-blip/nexatech` |
| Visibility | **public** (18 packages — không cần `imagePullSecret`) |
| App tag | `0.17.0` |
| Migrate tag | `0.17.1-migrate` |
| Chart | `0.17.2` |
| Lab kit zip | `dist/nexatech-lab-kit-0.17.2.zip` (tạo bằng script bên dưới) |

## Máy build — tạo lại kit khi cần

```powershell
# (Tuỳ chọn) build + push images — chỉ khi đổi code
$env:IMAGE_TAG='0.17.0'
$env:DOCKERHUB_USER='tranconghauhautc-blip'   # hoặc GHCR login + tag ghcr.io/...
# docker login ghcr.io -u USERNAME -p PAT
.\scripts\docker-build-all.ps1 -Push

# Đóng gói kit mang sang lab
powershell -NoProfile -File .\scripts\package-lab-kit.ps1
# → dist/nexatech-lab-kit-0.17.2.zip
```

## Máy lab — cài

### Điều kiện trước (một lần)

1. `kubectl` + `helm` + kubeconfig
2. StorageClass `local-path`
3. MetalLB có VIP `192.168.4.204`
4. PostgreSQL `192.168.3.50:5432` — đã tạo DB + user per service
5. Copy `secret.env.example` → `secret.env` và điền mật khẩu

### Một lệnh

```powershell
Expand-Archive nexatech-lab-kit-0.17.2.zip -DestinationPath .\nexatech-lab-kit
cd .\nexatech-lab-kit
copy secret.env.example secret.env
# notepad secret.env  → điền JWT, DB URL, rabbitmq, minio...
.\install.ps1
```

Hoặc Helm thuần (sau khi có namespace + secret):

```powershell
helm upgrade --install nexatech .\charts\nexatech-0.17.2.tgz `
  -n nexatech `
  -f .\values-ghcr.yaml `
  --wait --timeout 20m
```

Trong repo (không cần zip):

```powershell
helm upgrade --install nexatech deploy/helm/nexatech `
  -n nexatech `
  -f deploy/environments/staging/values-ghcr.yaml `
  --wait --timeout 20m
```

## Kiểm tra

```powershell
kubectl -n nexatech get pods
kubectl -n nexatech get svc entry
# Storefront qua VIP: http://192.168.4.204
```

## Không nằm trong một lệnh Helm

- Kong (VM `192.168.4.209`) — declarative `infra/kong/`
- Tạo database PostgreSQL lần đầu — `scripts/deployment/create-databases.ps1`
- Seed catalog — operator chạy riêng khi sẵn sàng

## Nếu GHCR lại private

```powershell
$env:GHCR_USERNAME='tranconghauhautc-blip'
$env:GHCR_TOKEN='ghp_...'   # PAT: read:packages
.\install.ps1
```

Script tạo secret `ghcr-pull` và overlay values tự động.
