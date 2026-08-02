import {
  loadProvinces,
  loadWards,
  getWardsByProvince,
  getProvinceByCode,
  getWardByCode,
} from './dataset';

describe('dataset loaders', () => {
  it('loads all 34 provincial units', () => {
    expect(loadProvinces()).toHaveLength(34);
  });

  it('loads every ward with a valid parentCode', () => {
    const provinceCodes = new Set(loadProvinces().map((p) => p.code));
    const wards = loadWards();
    expect(wards.length).toBeGreaterThan(3000);
    for (const ward of wards) {
      expect(provinceCodes.has(ward.parentCode)).toBe(true);
    }
  });

  it('getWardsByProvince filters and sorts by name', () => {
    const wards = getWardsByProvince('01');
    expect(wards.length).toBeGreaterThan(50);
    expect(wards.every((w) => w.parentCode === '01')).toBe(true);
    const sorted = [...wards].sort((a, b) =>
      a.name.localeCompare(b.name, 'vi'),
    );
    expect(wards).toEqual(sorted);
  });

  it('getWardsByProvince returns an empty array for unknown codes', () => {
    expect(getWardsByProvince('unknown')).toEqual([]);
    expect(getWardsByProvince(null)).toEqual([]);
  });

  it('getProvinceByCode / getWardByCode resolve known records', () => {
    expect(getProvinceByCode('01')?.name).toBe('Hà Nội');
    expect(getProvinceByCode('missing')).toBeUndefined();
    const someWard = loadWards()[0];
    expect(getWardByCode(someWard.code)?.code).toBe(someWard.code);
  });
});
