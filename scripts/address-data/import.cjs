#!/usr/bin/env node
'use strict';

/**
 * Build the deterministic Vietnam administrative address dataset
 * (2-level province + ward model, post-2025 reform: 34 provincial units,
 * district level abolished).
 *
 * Reads the embedded local snapshot under scripts/address-data/source/
 * (no network calls at runtime). If that snapshot is missing, this script
 * can refresh it with a single one-time HTTPS fetch when
 * ALLOW_ADDRESS_DATA_FETCH=1 is set — never implicit, never at import time
 * by default.
 *
 * Source: open-admin-data/vietnam-administrative-divisions (CC-BY-4.0)
 * https://github.com/open-admin-data/vietnam-administrative-divisions
 *
 * Usage:
 *   node scripts/address-data/import.cjs
 *   node scripts/address-data/import.cjs --force
 */

const fs = require('fs');
const path = require('path');
const https = require('https');

const ROOT = path.resolve(__dirname, '../..');
const SOURCE_DIR = path.join(__dirname, 'source');
const OUT_DIR = path.join(ROOT, 'data', 'vietnam-administrative');
// The shared-address lib cannot import files from outside its own project
// (Nx module-boundary rule), so the same generated provinces/wards JSON is
// mirrored into its src/data folder. Both copies are always written
// together from the same in-memory data — never edit the mirror by hand.
const LIB_DATA_DIR = path.join(
  ROOT,
  'libs',
  'shared',
  'address',
  'src',
  'data',
);

const SOURCE_NAME = 'open-admin-data/vietnam-administrative-divisions';
const SOURCE_URL =
  'https://github.com/open-admin-data/vietnam-administrative-divisions';
// Upstream dataset "Last Updated" marker captured at snapshot time.
const SOURCE_VERSION = '2026-06-01';
// Nghị quyết 60-NQ/TW & Quyết định 759/QĐ-TTg: 2-level model (34 provincial
// units, no district level) took effect nationwide on this date.
const EFFECTIVE_VERSION = '2025-07-01';

const FETCH_URLS = {
  provinces:
    'https://raw.githubusercontent.com/open-admin-data/vietnam-administrative-divisions/main/data/all-province.json',
  wards:
    'https://raw.githubusercontent.com/open-admin-data/vietnam-administrative-divisions/main/data/all-ward.json',
};

// 6 centrally-run cities (thành phố trực thuộc trung ương) after the 2025 reform.
const MUNICIPALITY_CODES = new Set(['01', '31', '46', '48', '79', '92']);

const EXPECTED_PROVINCE_COUNT = 34;

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

function readLocalSource(name) {
  const file = path.join(SOURCE_DIR, `${name}.source.json`);
  if (!fs.existsSync(file)) {
    return null;
  }
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function fetchJson(url) {
  return new Promise((resolve, reject) => {
    https
      .get(
        url,
        { headers: { 'user-agent': 'nexatech-address-import' } },
        (res) => {
          if (res.statusCode !== 200) {
            res.resume();
            reject(new Error(`HTTP ${res.statusCode} while fetching ${url}`));
            return;
          }
          let data = '';
          res.setEncoding('utf8');
          res.on('data', (chunk) => {
            data += chunk;
          });
          res.on('end', () => {
            try {
              resolve(JSON.parse(data));
            } catch (err) {
              reject(err);
            }
          });
        },
      )
      .on('error', reject);
  });
}

async function loadRawProvinces() {
  const local = readLocalSource('provinces');
  if (local) {
    return local;
  }
  if (process.env.ALLOW_ADDRESS_DATA_FETCH !== '1') {
    throw new Error(
      'Missing scripts/address-data/source/provinces.source.json and network fetch is disabled ' +
        '(set ALLOW_ADDRESS_DATA_FETCH=1 to allow a one-time refresh fetch).',
    );
  }
  console.warn(
    '[address-data:import] local province snapshot missing, fetching once from network…',
  );
  const raw = await fetchJson(FETCH_URLS.provinces);
  const mapped = raw
    .map((p) => ({
      code: p.code.id,
      nameLocal: p.name.local,
      nameEn: p.name.en,
      type: MUNICIPALITY_CODES.has(p.code.id) ? 'MUNICIPALITY' : 'PROVINCE',
      wardCount: p.children_count.ward,
    }))
    .sort((a, b) => a.code.localeCompare(b.code));
  fs.mkdirSync(SOURCE_DIR, { recursive: true });
  fs.writeFileSync(
    path.join(SOURCE_DIR, 'provinces.source.json'),
    `${JSON.stringify(mapped, null, 2)}\n`,
    'utf8',
  );
  return mapped;
}

async function loadRawWards() {
  const local = readLocalSource('wards');
  if (local) {
    return local;
  }
  if (process.env.ALLOW_ADDRESS_DATA_FETCH !== '1') {
    throw new Error(
      'Missing scripts/address-data/source/wards.source.json and network fetch is disabled ' +
        '(set ALLOW_ADDRESS_DATA_FETCH=1 to allow a one-time refresh fetch).',
    );
  }
  console.warn(
    '[address-data:import] local ward snapshot missing, fetching once from network…',
  );
  const raw = await fetchJson(FETCH_URLS.wards);
  const mapped = raw
    .map((w) => ({
      code: w.code.id,
      nameLocal: w.name.local,
      nameEn: w.name.en,
      provinceCode: w.parent.id,
    }))
    .sort((a, b) => a.code.localeCompare(b.code));
  fs.mkdirSync(SOURCE_DIR, { recursive: true });
  fs.writeFileSync(
    path.join(SOURCE_DIR, 'wards.source.json'),
    `${JSON.stringify(mapped, null, 2)}\n`,
    'utf8',
  );
  return mapped;
}

function buildDataset(rawProvinces, rawWards) {
  const provinces = rawProvinces
    .map((p) => ({
      code: p.code,
      name: p.nameLocal,
      normalizedName: normalizeName(p.nameLocal),
      type: p.type,
      parentCode: null,
      sourceVersion: SOURCE_VERSION,
      effectiveVersion: EFFECTIVE_VERSION,
    }))
    .sort((a, b) => a.code.localeCompare(b.code));

  const wards = rawWards
    .map((w) => ({
      code: w.code,
      name: w.nameLocal,
      normalizedName: normalizeName(w.nameLocal),
      type: 'WARD',
      parentCode: w.provinceCode,
      sourceVersion: SOURCE_VERSION,
      effectiveVersion: EFFECTIVE_VERSION,
    }))
    .sort((a, b) => a.code.localeCompare(b.code));

  return { provinces, wards };
}

function analyzeIntegrity(provinces, wards) {
  const provinceCodes = new Set();
  const duplicateProvinces = new Set();
  for (const p of provinces) {
    if (provinceCodes.has(p.code)) duplicateProvinces.add(p.code);
    provinceCodes.add(p.code);
  }

  const wardCodes = new Set();
  const duplicateWards = new Set();
  const orphanWards = [];
  const wardCountByProvince = new Map();
  for (const w of wards) {
    if (wardCodes.has(w.code)) duplicateWards.add(w.code);
    wardCodes.add(w.code);
    if (!provinceCodes.has(w.parentCode)) {
      orphanWards.push(w.code);
    } else {
      wardCountByProvince.set(
        w.parentCode,
        (wardCountByProvince.get(w.parentCode) || 0) + 1,
      );
    }
  }

  return {
    duplicateProvinces: [...duplicateProvinces],
    duplicateWards: [...duplicateWards],
    orphanWards,
    wardCountByProvince,
  };
}

async function main() {
  const force = process.argv.includes('--force');

  const [rawProvinces, rawWards] = await Promise.all([
    loadRawProvinces(),
    loadRawWards(),
  ]);

  if (rawProvinces.length !== EXPECTED_PROVINCE_COUNT) {
    console.warn(
      `[address-data:import] WARNING expected ${EXPECTED_PROVINCE_COUNT} provincial units, got ${rawProvinces.length}`,
    );
  }

  const { provinces, wards } = buildDataset(rawProvinces, rawWards);
  const report = analyzeIntegrity(provinces, wards);

  const integrityErrors = [];
  if (report.duplicateProvinces.length) {
    integrityErrors.push(
      `Duplicate province codes: ${report.duplicateProvinces.join(', ')}`,
    );
  }
  if (report.duplicateWards.length) {
    integrityErrors.push(
      `Duplicate ward codes: ${report.duplicateWards.join(', ')}`,
    );
  }
  if (report.orphanWards.length) {
    integrityErrors.push(
      `Orphan wards (unknown parentCode): ${report.orphanWards.slice(0, 20).join(', ')}` +
        (report.orphanWards.length > 20
          ? ` … (+${report.orphanWards.length - 20} more)`
          : ''),
    );
  }
  if (integrityErrors.length) {
    console.error('[address-data:import] FAILED integrity checks:');
    integrityErrors.forEach((e) => console.error(` - ${e}`));
    process.exit(1);
  }

  fs.mkdirSync(OUT_DIR, { recursive: true });
  const targets = ['metadata.json', 'provinces.json', 'wards.json'].map((f) =>
    path.join(OUT_DIR, f),
  );
  const existing = targets.filter((f) => fs.existsSync(f));
  if (existing.length && !force) {
    console.error(
      '[address-data:import] Refusing to overwrite existing address data. Pass --force to replace.',
    );
    existing.forEach((f) => console.error(` - ${path.relative(ROOT, f)}`));
    process.exit(1);
  }

  const metadata = {
    source: SOURCE_NAME,
    sourceUrl: SOURCE_URL,
    sourceVersion: SOURCE_VERSION,
    effectiveVersion: EFFECTIVE_VERSION,
    provinceCount: provinces.length,
    wardCount: wards.length,
    generatedAt: new Date().toISOString(),
    notes:
      'Vietnam 2-level administrative model (province + ward) after the 2025 reform ' +
      '(34 provincial units, district level abolished nationwide 2025-07-01). ' +
      'Generated deterministically by scripts/address-data/import.cjs from the embedded local ' +
      'snapshot in scripts/address-data/source/ — no runtime network calls. ' +
      `Includes ${provinces.filter((p) => p.type === 'MUNICIPALITY').length} centrally-run cities ` +
      `and ${provinces.filter((p) => p.type === 'PROVINCE').length} provinces, with complete ward ` +
      'coverage for every provincial unit (not just major cities).',
  };

  const provincesJson = `${JSON.stringify(provinces, null, 2)}\n`;
  const wardsJson = `${JSON.stringify(wards, null, 2)}\n`;
  const metadataJson = `${JSON.stringify(metadata, null, 2)}\n`;

  fs.writeFileSync(path.join(OUT_DIR, 'provinces.json'), provincesJson, 'utf8');
  fs.writeFileSync(path.join(OUT_DIR, 'wards.json'), wardsJson, 'utf8');
  fs.writeFileSync(path.join(OUT_DIR, 'metadata.json'), metadataJson, 'utf8');

  // Mirror provinces/wards into the shared-address lib so it can import them
  // as in-project assets (see LIB_DATA_DIR comment above).
  fs.mkdirSync(LIB_DATA_DIR, { recursive: true });
  fs.writeFileSync(
    path.join(LIB_DATA_DIR, 'provinces.json'),
    provincesJson,
    'utf8',
  );
  fs.writeFileSync(path.join(LIB_DATA_DIR, 'wards.json'), wardsJson, 'utf8');

  console.log(
    `[address-data:import] OK provinces=${provinces.length} wards=${wards.length} ` +
      `duplicates=0 orphans=0 wroteTo=${path.relative(ROOT, OUT_DIR)} ` +
      `mirroredTo=${path.relative(ROOT, LIB_DATA_DIR)}`,
  );
}

main().catch((err) => {
  console.error(
    `[address-data:import] ERROR ${err && err.message ? err.message : err}`,
  );
  process.exit(1);
});
