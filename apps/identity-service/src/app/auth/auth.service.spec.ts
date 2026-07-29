import { AuthService } from './auth.service';
import { InMemoryIdentityStore } from './identity.store';
import { AppError } from '@nexatech/shared-errors';

describe('AuthService', () => {
  const createService = () => new AuthService(new InMemoryIdentityStore());

  it('registers, verifies email, logs in and refreshes session', async () => {
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
    ).rejects.toMatchObject({ errorCode: 'UNAUTHORIZED' });
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
