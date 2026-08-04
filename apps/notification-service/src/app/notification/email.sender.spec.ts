import { ErrorCodes } from '@nexatech/shared-errors';
import {
  createEmailSender,
  DegradedEmailSender,
  InMemoryEmailSender,
  LoggingEmailSender,
  SmtpEmailSender,
} from './email.sender';

describe('InMemoryEmailSender', () => {
  it('captures sent messages', async () => {
    const sender = new InMemoryEmailSender();
    await sender.send({
      to: 'user@example.com',
      subject: 'Chào mừng',
      text: 'Nội dung email',
    });
    expect(sender.sent).toHaveLength(1);
    expect(sender.sent[0]?.to).toBe('user@example.com');
    expect(sender.sent[0]?.subject).toBe('Chào mừng');
    expect(sender.sent[0]?.sentAt).toBeInstanceOf(Date);
  });

  it('clears captured messages', async () => {
    const sender = new InMemoryEmailSender();
    await sender.send({ to: 'a@b.com', subject: 's', text: 't' });
    sender.clear();
    expect(sender.sent).toHaveLength(0);
  });
});

describe('LoggingEmailSender', () => {
  it('resolves without throwing (dev fallback without SMTP)', async () => {
    const sender = new LoggingEmailSender();
    await expect(
      sender.send({ to: 'dev@example.com', subject: 'x', text: 'y' }),
    ).resolves.toBeUndefined();
  });
});

describe('DegradedEmailSender', () => {
  it('refuses delivery with NOTIFICATION_EMAIL_DEGRADED', async () => {
    const sender = new DegradedEmailSender();
    await expect(
      sender.send({ to: 'ops@example.com', subject: 'x', text: 'y' }),
    ).rejects.toMatchObject({
      errorCode: ErrorCodes.NOTIFICATION_EMAIL_DEGRADED,
    });
  });
});

describe('createEmailSender factory', () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it('returns InMemoryEmailSender when NODE_ENV=test and no SMTP configured', () => {
    process.env['NODE_ENV'] = 'test';
    delete process.env['SMTP_HOST'];
    const sender = createEmailSender();
    expect(sender).toBeInstanceOf(InMemoryEmailSender);
  });

  it('returns SmtpEmailSender when SMTP_HOST is configured', () => {
    process.env['SMTP_HOST'] = 'smtp.example.com';
    process.env['SMTP_PORT'] = '587';
    const sender = createEmailSender();
    expect(sender).toBeInstanceOf(SmtpEmailSender);
  });

  it('returns LoggingEmailSender for development without SMTP', () => {
    process.env['NODE_ENV'] = 'development';
    delete process.env['SMTP_HOST'];
    const sender = createEmailSender();
    expect(sender).toBeInstanceOf(LoggingEmailSender);
  });

  it('returns DegradedEmailSender for production without SMTP', () => {
    process.env['NODE_ENV'] = 'production';
    delete process.env['SMTP_HOST'];
    const sender = createEmailSender();
    expect(sender).toBeInstanceOf(DegradedEmailSender);
  });
});
