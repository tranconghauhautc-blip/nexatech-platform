# NexaTech lab-release — clone and Helm install

Images are on public GHCR. This folder is the only thing you need from the repo.

## On the company K8s server

```bash
# 1) tools
curl https://raw.githubusercontent.com/helm/helm/main/scripts/get-helm-3 | bash

# 2) clone (shallow — only need this folder, full repo is fine)
git clone --depth 1 --branch fix/media-upload-profile-minimal-reset \
  https://github.com/tranconghauhautc-blip/nexatech-platform.git
cd nexatech-platform/deploy/lab-release

# 3) secrets (once)
cp secret.env.example secret.env
nano secret.env   # fill JWT + database URLs + rabbitmq/minio passwords

# 4) install
chmod +x install.sh
./install.sh
```

Or without the script:

```bash
kubectl create namespace nexatech --dry-run=client -o yaml | kubectl apply -f -
kubectl -n nexatech create secret generic nexatech-secrets --from-env-file=./secret.env
helm upgrade --install nexatech ./charts/nexatech-0.17.2.tgz \
  -n nexatech \
  -f ./values-ghcr.yaml \
  --wait --timeout 20m
```

## What this installs

- 14 backends + storefront + admin + portals
- Redis / RabbitMQ / MinIO (in-cluster)
- Prisma migrate Jobs
- Entry Service (LoadBalancer VIP `192.168.4.204` from values-ghcr)

Images: `ghcr.io/tranconghauhautc-blip/nexatech/*:0.17.0` (+ `:0.17.1-migrate`)

## You still need on the cluster (not in GitHub)

1. Working `kubectl` to the cluster
2. StorageClass `local-path` (or change values)
3. External PostgreSQL reachable at host in `secret.env` / values (`192.168.3.50` by default)
4. MetalLB (or change `entry.serviceType` to `NodePort` in values)

If you have no MetalLB:

```bash
helm upgrade --install nexatech ./charts/nexatech-0.17.2.tgz \
  -n nexatech \
  -f ./values-ghcr.yaml \
  -f ./values-nodeport.yaml \
  --wait --timeout 20m
```

## Check

```bash
kubectl -n nexatech get pods
kubectl -n nexatech get svc
```
