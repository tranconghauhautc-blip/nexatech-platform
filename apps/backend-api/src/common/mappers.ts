import { Decimal } from '../generated/prisma/runtime/library';

export function toNumber(
  v: Decimal | number | string | null | undefined,
): number {
  if (v == null) return 0;
  if (typeof v === 'number') return v;
  return Number(v);
}

export function publicUser(u: {
  id: string;
  username: string;
  displayName: string;
  role: string;
  enabled: boolean;
  createdAt: Date;
}) {
  return {
    id: u.id,
    username: u.username,
    displayName: u.displayName,
    role: u.role,
    enabled: u.enabled,
    createdAt: u.createdAt.toISOString(),
  };
}

export function publicProduct(p: {
  id: string;
  name: string;
  description: string;
  price: Decimal | number;
  stock: number;
  active: boolean;
  metadata?: unknown;
  createdAt: Date;
}) {
  return {
    id: p.id,
    name: p.name,
    description: p.description,
    price: toNumber(p.price),
    stock: p.stock,
    active: p.active,
    metadata: p.metadata ?? undefined,
    createdAt: p.createdAt.toISOString(),
  };
}
