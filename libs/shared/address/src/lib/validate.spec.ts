import { validateAddressSelection } from './validate';
import { loadProvinces, loadWards } from './dataset';

describe('validateAddressSelection', () => {
  it('accepts a matching province/ward pair (Hà Nội / Ba Đình)', () => {
    const hanoi = loadProvinces().find((p) => p.name === 'Hà Nội');
    const baDinh = loadWards().find(
      (w) => w.name === 'Ba Đình' && w.parentCode === hanoi?.code,
    );
    expect(hanoi).toBeDefined();
    expect(baDinh).toBeDefined();

    const result = validateAddressSelection({
      provinceCode: hanoi?.code,
      wardCode: baDinh?.code,
    });

    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
    expect(result.province?.code).toBe(hanoi?.code);
    expect(result.ward?.code).toBe(baDinh?.code);
  });

  it('rejects a missing province code', () => {
    const result = validateAddressSelection({
      provinceCode: '',
      wardCode: '00004',
    });
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Vui lòng chọn tỉnh/thành phố');
  });

  it('rejects an unknown province code', () => {
    const result = validateAddressSelection({
      provinceCode: '99',
      wardCode: '00004',
    });
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Tỉnh/thành phố không hợp lệ');
  });

  it('rejects a missing ward code', () => {
    const result = validateAddressSelection({ provinceCode: '01' });
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Vui lòng chọn phường/xã');
  });

  it('rejects an unknown ward code', () => {
    const result = validateAddressSelection({
      provinceCode: '01',
      wardCode: 'not-a-code',
    });
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Phường/xã không hợp lệ');
  });

  it('rejects a ward that belongs to a different province', () => {
    const hanoiWard = loadWards().find((w) => w.parentCode === '01');
    expect(hanoiWard).toBeDefined();

    const result = validateAddressSelection({
      provinceCode: '79', // Hồ Chí Minh
      wardCode: hanoiWard?.code,
    });

    expect(result.valid).toBe(false);
    expect(result.errors).toContain(
      'Phường/xã không thuộc tỉnh/thành phố đã chọn',
    );
  });
});
