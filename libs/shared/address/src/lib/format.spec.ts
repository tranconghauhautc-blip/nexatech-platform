import { formatVietnamAddress } from './format';

describe('formatVietnamAddress', () => {
  it('joins line1, ward and province', () => {
    expect(
      formatVietnamAddress({
        addressLine1: '123 Đường Nguyễn Huệ',
        wardName: 'Bến Nghé',
        provinceName: 'Hồ Chí Minh',
      }),
    ).toBe('123 Đường Nguyễn Huệ, Bến Nghé, Hồ Chí Minh');
  });

  it('inserts the legacy district when present', () => {
    expect(
      formatVietnamAddress({
        addressLine1: '456 Phố Huế',
        wardName: 'Phố Huế',
        provinceName: 'Hà Nội',
        legacyDistrictName: 'Hai Bà Trưng',
      }),
    ).toBe('456 Phố Huế, Phố Huế, Hai Bà Trưng, Hà Nội');
  });

  it('skips empty/missing parts', () => {
    expect(
      formatVietnamAddress({
        addressLine1: '789 Lê Lợi',
        wardName: null,
        provinceName: undefined,
      }),
    ).toBe('789 Lê Lợi');
  });

  it('trims whitespace-only parts', () => {
    expect(
      formatVietnamAddress({
        addressLine1: '  1 Trần Phú  ',
        wardName: '   ',
        provinceName: 'Đà Nẵng',
      }),
    ).toBe('1 Trần Phú, Đà Nẵng');
  });
});
