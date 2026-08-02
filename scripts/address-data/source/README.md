# Vietnam administrative address — embedded source snapshot

`provinces.source.json` and `wards.source.json` are a deterministic, trimmed
snapshot derived **once** from the open dataset:

- Project: `open-admin-data/vietnam-administrative-divisions`
- URL: https://github.com/open-admin-data/vietnam-administrative-divisions
- License: CC-BY-4.0
- Upstream files: `data/all-province.json`, `data/all-ward.json`
- Snapshot taken: 2026-08-02 (upstream "Last Updated" marker at time of fetch: 2026-06-01)

The upstream dataset reflects Vietnam's post-2025 administrative reform
(Nghị quyết 60-NQ/TW, Quyết định 759/QĐ-TTg, effective 2025-07-01): the
district level was abolished nationwide, leaving a 2-level model of
34 provincial units (tỉnh/thành phố) directly administering 3,321
communes/wards (xã/phường/đặc khu).

`scripts/address-data/import.cjs` reads these two files **locally** by
default (no network access at runtime) and builds the published dataset
under `data/vietnam-administrative/`. If the local snapshot is ever
missing, the import script can refresh it with a single HTTPS fetch when
`ALLOW_ADDRESS_DATA_FETCH=1` is set in the environment — this is opt-in and
never happens implicitly.

Fields kept from upstream:

- `code` — official unit code (`code.id` upstream)
- `nameLocal` / `nameEn` — Vietnamese/English names (diacritics preserved)
- `type` (provinces only) — `PROVINCE` or `MUNICIPALITY` (6 centrally-run
  cities: Hà Nội, Hải Phòng, Huế, Đà Nẵng, Hồ Chí Minh, Cần Thơ)
- `wardCount` (provinces only) — informational, from upstream `children_count.ward`
- `provinceCode` (wards only) — parent province code (`parent.id` upstream)
