import {
  addressFormSchema,
  flattenZodErrors,
  loginFormSchema,
  registerFormSchema,
  resetPasswordRequestSchema,
} from '../../src/lib/validation';

describe('loginFormSchema', () => {
  it('accepts a valid login payload', () => {
    const result = loginFormSchema.safeParse({
      email: 'user@nexatech.vn',
      password: 'secret123',
    });
    expect(result.success).toBe(true);
  });

  it('rejects invalid email', () => {
    const result = loginFormSchema.safeParse({
      email: 'not-an-email',
      password: 'x',
    });
    expect(result.success).toBe(false);
  });
});

describe('registerFormSchema', () => {
  const base = {
    fullName: 'Nguyễn Văn A',
    email: 'a@nexatech.vn',
    password: 'Secret123',
    confirmPassword: 'Secret123',
    agreeTerms: true as const,
  };

  it('accepts a valid registration payload', () => {
    expect(registerFormSchema.safeParse(base).success).toBe(true);
  });

  it('rejects mismatched confirm password', () => {
    const result = registerFormSchema.safeParse({
      ...base,
      confirmPassword: 'Different1',
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const errors = flattenZodErrors(result.error);
      expect(errors['confirmPassword']).toBeDefined();
    }
  });

  it('rejects when terms are not agreed', () => {
    const result = registerFormSchema.safeParse({ ...base, agreeTerms: false });
    expect(result.success).toBe(false);
  });
});

describe('resetPasswordRequestSchema', () => {
  it('accepts a valid reset payload', () => {
    const result = resetPasswordRequestSchema.safeParse({
      email: 'a@nexatech.vn',
      code: '123456',
      newPassword: 'NewSecret1',
    });
    expect(result.success).toBe(true);
  });

  it('rejects a too-short password', () => {
    const result = resetPasswordRequestSchema.safeParse({
      email: 'a@nexatech.vn',
      code: '123456',
      newPassword: 'short',
    });
    expect(result.success).toBe(false);
  });
});

describe('addressFormSchema', () => {
  it('accepts a full Vietnamese address', () => {
    const result = addressFormSchema.safeParse({
      recipientName: 'Trần Thị B',
      recipientPhone: '0912345678',
      line1: '123 Đường Lê Lợi',
      ward: 'Phường Bến Nghé',
      district: 'Quận 1',
      city: 'Hồ Chí Minh',
    });
    expect(result.success).toBe(true);
  });

  it('rejects invalid phone numbers', () => {
    const result = addressFormSchema.safeParse({
      recipientName: 'Trần Thị B',
      recipientPhone: '123',
      line1: '123 Đường Lê Lợi',
      city: 'Hồ Chí Minh',
    });
    expect(result.success).toBe(false);
  });
});

describe('flattenZodErrors', () => {
  it('keeps the first message per field path', () => {
    const result = loginFormSchema.safeParse({ email: 'bad', password: '' });
    expect(result.success).toBe(false);
    if (!result.success) {
      const errors = flattenZodErrors(result.error);
      expect(Object.keys(errors)).toEqual(
        expect.arrayContaining(['email', 'password']),
      );
    }
  });
});
