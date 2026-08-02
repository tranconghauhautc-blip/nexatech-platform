// Mirrored from data/vietnam-administrative/ by scripts/address-data/import.cjs
// (kept in-project so bundlers/Nx module boundaries can resolve it directly).
import provincesData from '../data/provinces.json';
import wardsData from '../data/wards.json';
import type { Province, Ward } from './types';

// The generated dataset JSON already matches the Province/Ward shape
// (see scripts/address-data/import.cjs); cast once at the module boundary.
const PROVINCES = provincesData as unknown as Province[];
const WARDS = wardsData as unknown as Ward[];

let provinceIndex: Map<string, Province> | null = null;
let wardsByProvinceIndex: Map<string, Ward[]> | null = null;

function buildIndexes(): void {
  provinceIndex = new Map(PROVINCES.map((p) => [p.code, p]));
  const byProvince = new Map<string, Ward[]>();
  for (const ward of WARDS) {
    const bucket = byProvince.get(ward.parentCode);
    if (bucket) {
      bucket.push(ward);
    } else {
      byProvince.set(ward.parentCode, [ward]);
    }
  }
  for (const wards of byProvince.values()) {
    wards.sort((a, b) => a.name.localeCompare(b.name, 'vi'));
  }
  wardsByProvinceIndex = byProvince;
}

/** All 34 provincial units (tỉnh/thành phố), post-2025 reform. */
export function loadProvinces(): Province[] {
  return PROVINCES;
}

/** All wards (phường/xã) across every province. */
export function loadWards(): Ward[] {
  return WARDS;
}

export function getProvinceByCode(
  code: string | null | undefined,
): Province | undefined {
  if (!code) return undefined;
  if (!provinceIndex) buildIndexes();
  return provinceIndex?.get(code);
}

export function getWardByCode(
  code: string | null | undefined,
): Ward | undefined {
  if (!code) return undefined;
  return loadWards().find((w) => w.code === code);
}

/** Wards belonging to a given province, sorted by Vietnamese collation. */
export function getWardsByProvince(
  provinceCode: string | null | undefined,
): Ward[] {
  if (!provinceCode) return [];
  if (!wardsByProvinceIndex) buildIndexes();
  return wardsByProvinceIndex?.get(provinceCode) ?? [];
}
