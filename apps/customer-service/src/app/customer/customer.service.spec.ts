import { CustomerService, InMemoryCustomerStore } from './customer.service';

describe('CustomerService', () => {
  it('creates profile, updates and manages addresses', async () => {
    const service = new CustomerService(new InMemoryCustomerStore());
    const profile = await service.getOrCreateMe('user-1', 'Nguyễn Văn B');
    expect(profile.fullName).toBe('Nguyễn Văn B');

    const updated = await service.updateMe('user-1', { phone: '0901234567' });
    expect(updated.phone).toBe('0901234567');

    const address = await service.addAddress('user-1', {
      label: 'Nhà',
      recipient: 'Nguyễn Văn B',
      phone: '0901234567',
      line1: '123 Nguyễn Huệ',
      city: 'Hồ Chí Minh',
      isDefault: true,
    });
    expect(address.isDefault).toBe(true);

    const list = await service.listMyAddresses('user-1');
    expect(list).toHaveLength(1);
    expect(list[0].displayAddress).toContain('123 Nguyễn Huệ');
  });

  it('accepts a valid province/ward selection and formats the address', async () => {
    const service = new CustomerService(new InMemoryCustomerStore());
    await service.getOrCreateMe('user-2', 'Trần Thị C');

    const address = await service.addAddress('user-2', {
      label: 'Nhà',
      recipient: 'Trần Thị C',
      phone: '0901000002',
      line1: '456 Phố Huế',
      city: 'Hà Nội',
      provinceCode: '01',
      provinceName: 'Hà Nội',
      wardCode: '00004',
      wardName: 'Ba Đình',
      isDefault: true,
    });

    expect(address.displayAddress).toBe('456 Phố Huế, Ba Đình, Hà Nội');
  });

  it('rejects a ward that does not belong to the selected province', async () => {
    const service = new CustomerService(new InMemoryCustomerStore());
    await service.getOrCreateMe('user-3', 'Lê Văn D');

    await expect(
      service.addAddress('user-3', {
        label: 'Nhà',
        recipient: 'Lê Văn D',
        phone: '0901000003',
        line1: '1 Lê Lợi',
        city: 'Hồ Chí Minh',
        provinceCode: '79',
        provinceName: 'Hồ Chí Minh',
        wardCode: '00004', // belongs to Hà Nội, not Hồ Chí Minh
        wardName: 'Ba Đình',
        isDefault: true,
      }),
    ).rejects.toThrow();
  });
});
