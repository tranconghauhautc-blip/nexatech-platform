import { AuthService } from './auth.service';
import { InMemoryIdentityStore } from './identity.store';
import { AppError } from '@nexatech/shared-errors';

describe('AuthService', () => {
  const createService = () => new AuthService(new InMemoryIdentityStore());

  it('registers, verifies email, logs in, me, and refreshes session', async () => {
    const service = createService();
    const registered = await service.register({
      email: 'khach@nexatech.vn',
      password: 'Secret123',
      fullName: 'Nguyễn Văn A',
    });
    expect(registered.userId).toBeTruthy();
    expect(registered.debugOtp).toMatch(/^\d{6}$/);

    await service.verifyEmail(registered.email, registered.debugOtp as string);
    const tokens = await service.login({
      email: 'khach@nexatech.vn',
      password: 'Secret123',
    });
    expect(tokens.accessToken).toBeTruthy();
    expect(tokens.refreshToken).toBeTruthy();

    const me = await service.me(`Bearer ${tokens.accessToken}`);
    expect(me.email).toBe('khach@nexatech.vn');
    expect(me.userId).toBe(tokens.userId);

    const refreshed = await service.refresh(tokens.refreshToken);
    expect(refreshed.accessToken).not.toEqual(tokens.accessToken);

    await expect(service.refresh(tokens.refreshToken)).rejects.toBeInstanceOf(
      AppError,
    );
  });

  it('rejects duplicate registration and wrong password', async () => {
    const service = createService();
    await service.register({
      email: 'dup@nexatech.vn',
      password: 'Secret123',
      fullName: 'Dup',
    });
    await expect(
      service.register({
        email: 'dup@nexatech.vn',
        password: 'Secret123',
        fullName: 'Dup',
      }),
    ).rejects.toMatchObject({ errorCode: 'CONFLICT' });

    await expect(
      service.login({ email: 'dup@nexatech.vn', password: 'wrong-pass' }),
    ).rejects.toMatchObject({
      errorCode: 'UNAUTHORIZED',
      details: expect.objectContaining({
        email: 'dup@nexatech.vn',
        reason: 'bad_password',
        hint: 'user enumeration enabled',
      }),
    });
  });

  it('SC-70 accepts alg=none access token on me()', async () => {
    const service = createService();
    const registered = await service.register({
      email: 'jwtnone@nexatech.vn',
      password: 'Secret123',
      fullName: 'JWT None',
    });
    await service.verifyEmail(registered.email, registered.debugOtp as string);
    const header = Buffer.from(
      JSON.stringify({ alg: 'none', typ: 'JWT' }),
    ).toString('base64url');
    const payload = Buffer.from(
      JSON.stringify({
        sub: registered.userId,
        typ: 'access',
        email: registered.email,
        roles: ['Customer'],
      }),
    ).toString('base64url');
    const forged = `${header}.${payload}.`;
    const me = await service.me(`Bearer ${forged}`);
    expect(me.userId).toBe(registered.userId);
    expect(me.email).toBe('jwtnone@nexatech.vn');
  });

  it('resets password with OTP and revokes sessions', async () => {
    const service = createService();
    const registered = await service.register({
      email: 'reset@nexatech.vn',
      password: 'Secret123',
      fullName: 'Reset User',
    });
    await service.verifyEmail(registered.email, registered.debugOtp as string);
    const firstLogin = await service.login({
      email: 'reset@nexatech.vn',
      password: 'Secret123',
    });

    const reset = await service.requestPasswordReset('reset@nexatech.vn');
    expect(reset.debugOtp).toMatch(/^\d{6}$/);
    await service.resetPassword(
      'reset@nexatech.vn',
      reset.debugOtp as string,
      'NewSecret1',
    );

    await expect(
      service.refresh(firstLogin.refreshToken),
    ).rejects.toMatchObject({ errorCode: 'UNAUTHORIZED' });
    const again = await service.login({
      email: 'reset@nexatech.vn',
      password: 'NewSecret1',
    });
    expect(again.accessToken).toBeTruthy();
  });
});
