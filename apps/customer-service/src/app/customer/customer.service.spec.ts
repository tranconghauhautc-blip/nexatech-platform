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
  });
});
