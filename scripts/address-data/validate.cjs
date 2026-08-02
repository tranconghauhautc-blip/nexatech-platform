#!/usr/bin/env node
'use strict';

/**
 * Validate the generated Vietnam administrative address dataset:
 * - load success (files exist and parse as JSON)
 * - schema (required fields present with correct types)
 * - unique codes (provinces, wards)
 * - parent relationships (every ward.parentCode resolves to a real province;
 *   every province.parentCode is null)
 * - normalizedName is consistent with name
 * - metadata is present, complete and consistent with the data files
 *
 * Usage:
 *   node scripts/address-data/validate.cjs
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '../..');
const DATA_DIR = path.join(ROOT, 'data', 'vietnam-administrative');
const LIB_DATA_DIR = path.join(
  ROOT,
  'libs',
  'shared',
  'address',
  'src',
  'data',
);

const EXPECTED_PROVINCE_COUNT = 34;
// Hà Nội, Hồ Chí Minh, Đà Nẵng — must carry full ward coverage (seed customer addresses).
const KEY_PROVINCE_CODES = ['01', '79', '48'];
const MIN_WARDS_FOR_KEY_PROVINCES = 20;
const VALID_PROVINCE_TYPES = new Set(['PROVINCE', 'MUNICIPALITY']);
const REQUIRED_METADATA_FIELDS = [
  'source',
  'sourceVersion',
  'effectiveVersion',
  'provinceCount',
  'wardCount',
  'generatedAt',
  'notes',
];

function normalizeName(value) {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ');
}

function isNonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function readJson(fileName) {
  const full = path.join(DATA_DIR, fileName);
  if (!fs.existsSync(full)) {
    throw new Error(`Missing ${path.relative(ROOT, full)}`);
  }
  const raw = fs.readFileSync(full, 'utf8');
  return JSON.parse(raw);
}

function validateProvinces(provinces, errors, warnings) {
  if (!Array.isArray(provinces)) {
    errors.push('provinces.json must be a JSON array');
    return { provinceCodes: new Set(), duplicateProvinceCodes: [] };
  }

  const provinceCodes = new Set();
  const duplicateProvinceCodes = new Set();

  provinces.forEach((p, index) => {
    const ctx = `provinces[${index}]${p && p.code ? ` (${p.code})` : ''}`;
    for (const field of [
      'code',
      'name',
      'normalizedName',
      'sourceVersion',
      'effectiveVersion',
    ]) {
      if (!isNonEmptyString(p ? p[field] : undefined)) {
        errors.push(`${ctx}: missing/invalid "${field}"`);
      }
    }
    if (!p || !VALID_PROVINCE_TYPES.has(p.type)) {
      errors.push(
        `${ctx}: invalid "type" (expected PROVINCE or MUNICIPALITY, got ${p && p.type})`,
      );
    }
    if (!p || p.parentCode !== null) {
      errors.push(
        `${ctx}: "parentCode" must be null for provinces (got ${p && p.parentCode})`,
      );
    }
    if (p && isNonEmptyString(p.name) && isNonEmptyString(p.normalizedName)) {
      if (p.normalizedName !== normalizeName(p.name)) {
        errors.push(
          `${ctx}: normalizedName "${p.normalizedName}" does not match normalize(name)`,
        );
      }
    }
    if (p && p.code) {
      if (provinceCodes.has(p.code)) duplicateProvinceCodes.add(p.code);
      provinceCodes.add(p.code);
    }
  });

  if (duplicateProvinceCodes.size) {
    errors.push(
      `Duplicate province codes: ${[...duplicateProvinceCodes].join(', ')}`,
    );
  }
  if (provinces.length !== EXPECTED_PROVINCE_COUNT) {
    warnings.push(
      `Expected ${EXPECTED_PROVINCE_COUNT} provincial units (post-2025 reform), found ${provinces.length}`,
    );
  }

  return { provinceCodes, duplicateProvinceCodes: [...duplicateProvinceCodes] };
}

function validateWards(wards, provinceCodes, errors, warnings) {
  if (!Array.isArray(wards)) {
    errors.push('wards.json must be a JSON array');
    return {
      wardCount: 0,
      duplicateWardCodes: [],
      orphanWards: [],
      wardCountByProvince: new Map(),
    };
  }

  const wardCodes = new Set();
  const duplicateWardCodes = new Set();
  const orphanWards = [];
  const wardCountByProvince = new Map();

  wards.forEach((w, index) => {
    const ctx = `wards[${index}]${w && w.code ? ` (${w.code})` : ''}`;
    for (const field of [
      'code',
      'name',
      'normalizedName',
      'parentCode',
      'sourceVersion',
      'effectiveVersion',
    ]) {
      if (!isNonEmptyString(w ? w[field] : undefined)) {
        errors.push(`${ctx}: missing/invalid "${field}"`);
      }
    }
    if (!w || w.type !== 'WARD') {
      errors.push(`${ctx}: invalid "type" (expected WARD, got ${w && w.type})`);
    }
    if (w && isNonEmptyString(w.name) && isNonEmptyString(w.normalizedName)) {
      if (w.normalizedName !== normalizeName(w.name)) {
        errors.push(
          `${ctx}: normalizedName "${w.normalizedName}" does not match normalize(name)`,
        );
      }
    }
    if (w && w.code) {
      if (wardCodes.has(w.code)) duplicateWardCodes.add(w.code);
      wardCodes.add(w.code);
    }
    if (w && isNonEmptyString(w.parentCode)) {
      if (!provinceCodes.has(w.parentCode)) {
        orphanWards.push(w.code);
      } else {
        wardCountByProvince.set(
          w.parentCode,
          (wardCountByProvince.get(w.parentCode) || 0) + 1,
        );
      }
    }
  });

  if (duplicateWardCodes.size) {
    errors.push(`Duplicate ward codes: ${[...duplicateWardCodes].join(', ')}`);
  }
  if (orphanWards.length) {
    errors.push(
      `Orphan wards referencing an unknown province: ${orphanWards.slice(0, 20).join(', ')}` +
        (orphanWards.length > 20
          ? ` … (+${orphanWards.length - 20} more)`
          : ''),
    );
  }

  for (const code of KEY_PROVINCE_CODES) {
    if (!provinceCodes.has(code)) {
      errors.push(
        `Missing key province ${code} (required for seed customer address coverage)`,
      );
      continue;
    }
    const count = wardCountByProvince.get(code) || 0;
    if (count < MIN_WARDS_FOR_KEY_PROVINCES) {
      warnings.push(
        `Province ${code} has only ${count} wards (< ${MIN_WARDS_FOR_KEY_PROVINCES})`,
      );
    }
  }

  return {
    wardCount: wards.length,
    duplicateWardCodes: [...duplicateWardCodes],
    orphanWards,
    wardCountByProvince,
  };
}

function validateMetadata(metadata, provinceCount, wardCount, errors) {
  if (
    typeof metadata !== 'object' ||
    metadata === null ||
    Array.isArray(metadata)
  ) {
    errors.push('metadata.json must be a JSON object');
    return;
  }
  for (const field of REQUIRED_METADATA_FIELDS) {
    const value = metadata[field];
    if (value === undefined || value === null || value === '') {
      errors.push(`metadata.json missing "${field}"`);
    }
  }
  if (
    typeof metadata.provinceCount === 'number' &&
    metadata.provinceCount !== provinceCount
  ) {
    errors.push(
      `metadata.provinceCount (${metadata.provinceCount}) != provinces.length (${provinceCount})`,
    );
  }
  if (
    typeof metadata.wardCount === 'number' &&
    metadata.wardCount !== wardCount
  ) {
    errors.push(
      `metadata.wardCount (${metadata.wardCount}) != wards.length (${wardCount})`,
    );
  }
  if (
    isNonEmptyString(metadata.generatedAt) &&
    Number.isNaN(Date.parse(metadata.generatedAt))
  ) {
    errors.push('metadata.generatedAt is not a valid ISO date string');
  }
}

function main() {
  const errors = [];
  const warnings = [];

  let provinces;
  let wards;
  let metadata;
  try {
    provinces = readJson('provinces.json');
    wards = readJson('wards.json');
    metadata = readJson('metadata.json');
  } catch (err) {
    console.error(
      `[address-data:validate] FAILED to load dataset: ${err.message}`,
    );
    process.exit(1);
    return;
  }

  const { provinceCodes } = validateProvinces(provinces, errors, warnings);
  const { duplicateWardCodes, orphanWards, wardCountByProvince } =
    validateWards(wards, provinceCodes, errors, warnings);
  validateMetadata(
    metadata,
    Array.isArray(provinces) ? provinces.length : 0,
    Array.isArray(wards) ? wards.length : 0,
    errors,
  );

  // The shared-address lib cannot import files outside its own project
  // (Nx module boundaries), so provinces/wards are mirrored under
  // libs/shared/address/src/data/. Make sure the mirror hasn't drifted.
  for (const file of ['provinces.json', 'wards.json']) {
    const canonical = path.join(DATA_DIR, file);
    const mirror = path.join(LIB_DATA_DIR, file);
    if (!fs.existsSync(mirror)) {
      errors.push(
        `Missing lib mirror ${path.relative(ROOT, mirror)} — run pnpm address-data:import --force`,
      );
      continue;
    }
    const canonicalContent = fs.readFileSync(canonical, 'utf8');
    const mirrorContent = fs.readFileSync(mirror, 'utf8');
    if (canonicalContent !== mirrorContent) {
      errors.push(
        `Lib mirror ${path.relative(ROOT, mirror)} is out of sync with ${path.relative(ROOT, canonical)} — run pnpm address-data:import --force`,
      );
    }
  }

  const report = {
    ok: errors.length === 0,
    provinceCount: Array.isArray(provinces) ? provinces.length : 0,
    wardCount: Array.isArray(wards) ? wards.length : 0,
    municipalityCount: Array.isArray(provinces)
      ? provinces.filter((p) => p && p.type === 'MUNICIPALITY').length
      : 0,
    duplicateWardCodeCount: duplicateWardCodes.length,
    orphanWardCount: orphanWards.length,
    keyProvinceWardCoverage: Object.fromEntries(
      KEY_PROVINCE_CODES.map((code) => [
        code,
        wardCountByProvince.get(code) || 0,
      ]),
    ),
    warnings,
    errors,
  };

  if (errors.length) {
    console.error('[address-data:validate] FAILED');
    console.error(JSON.stringify(report, null, 2));
    process.exit(1);
    return;
  }

  for (const warning of warnings) {
    console.warn(`[address-data:validate] WARN ${warning}`);
  }
  console.log('[address-data:validate] PASSED');
  console.log(JSON.stringify(report, null, 2));
}

main();
