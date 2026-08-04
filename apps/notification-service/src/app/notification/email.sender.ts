import { Logger } from '@nestjs/common';
import { AppError, ErrorCodes } from '@nexatech/shared-errors';
import * as nodemailer from 'nodemailer';

export interface SendEmailInput {
  to: string;
  subject: string;
  text: string;
  html?: string;
}

export interface EmailSender {
  send(input: SendEmailInput): Promise<void>;
}

export interface SentEmail extends SendEmailInput {
  sentAt: Date;
}

/** Test double — captures sent messages instead of delivering them. */
export class InMemoryEmailSender implements EmailSender {
  readonly sent: SentEmail[] = [];

  async send(input: SendEmailInput): Promise<void> {
    this.sent.push({ ...input, sentAt: new Date() });
  }

  clear(): void {
    this.sent.length = 0;
  }
}

/** Local-lab fallback when SMTP is not configured — logs instead of sending. */
export class LoggingEmailSender implements EmailSender {
  private static readonly logger = new Logger(LoggingEmailSender.name);

  async send(input: SendEmailInput): Promise<void> {
    LoggingEmailSender.logger.warn(
      `[DEV EMAIL — SMTP not configured] to=${input.to} subject="${input.subject}"`,
    );
  }
}

/**
 * Production without SMTP — never report fake delivery success.
 * In-app notification may still succeed; email channel is explicitly degraded.
 */
export class DegradedEmailSender implements EmailSender {
  private static readonly logger = new Logger(DegradedEmailSender.name);

  async send(input: SendEmailInput): Promise<void> {
    DegradedEmailSender.logger.error(
      `Email channel degraded (SMTP_HOST missing); refused delivery to=${input.to}`,
    );
    throw new AppError({
      errorCode: ErrorCodes.NOTIFICATION_EMAIL_DEGRADED,
      message:
        'Kênh email đang degraded: thiếu SMTP_HOST. Cấu hình SMTP hoặc dùng Mailpit cho lab.',
      details: { channel: 'email', status: 'degraded' },
    });
  }
}

export interface SmtpConfig {
  host: string;
  port: number;
  secure: boolean;
  user?: string;
  pass?: string;
  fromName?: string;
  fromEmail: string;
}

/**
 * SMTP transport abstraction — domain logic chỉ phụ thuộc EmailSender.
 * Có thể thay Gmail bằng provider khác mà không sửa notification domain.
 */
export class SmtpEmailSender implements EmailSender {
  private static readonly logger = new Logger(SmtpEmailSender.name);
  private transporter: nodemailer.Transporter | null = null;

  constructor(private readonly config: SmtpConfig) {}

  private getTransporter(): nodemailer.Transporter {
    if (!this.transporter) {
      this.transporter = nodemailer.createTransport({
        host: this.config.host,
        port: this.config.port,
        secure: this.config.secure,
        auth: this.config.user
          ? { user: this.config.user, pass: this.config.pass }
          : undefined,
      });
    }
    return this.transporter;
  }

  private fromHeader(): string {
    if (this.config.fromName) {
      return `"${this.config.fromName}" <${this.config.fromEmail}>`;
    }
    return this.config.fromEmail;
  }

  async send(input: SendEmailInput): Promise<void> {
    try {
      const transporter = this.getTransporter();
      await transporter.sendMail({
        from: this.fromHeader(),
        to: input.to,
        subject: input.subject,
        text: input.text,
        html: input.html,
      });
    } catch (error) {
      SmtpEmailSender.logger.error(`Gửi email thất bại: ${String(error)}`);
      throw new AppError({
        errorCode: ErrorCodes.NOTIFICATION_EMAIL_FAILED,
        message: 'Gửi email thất bại',
        details: { cause: String(error) },
      });
    }
  }
}

function envFirst(...names: string[]): string | undefined {
  for (const name of names) {
    const value = process.env[name]?.trim();
    if (value) return value;
  }
  return undefined;
}

/**
 * Chọn triển khai EmailSender theo cấu hình môi trường:
 * - `SMTP_HOST` được cấu hình -> gửi email thật qua SMTP (Mailpit hoặc Gmail).
 * - `NODE_ENV=test` -> dùng bộ nhớ để test không phụ thuộc hạ tầng.
 * - `NODE_ENV=production` không có SMTP -> DegradedEmailSender (không fake success).
 * - Còn lại (local lab không có SMTP) -> LoggingEmailSender.
 *
 * Env chuẩn (ưu tiên tên mới, giữ tương thích tên cũ):
 *   SMTP_HOST, SMTP_PORT, SMTP_SECURE,
 *   SMTP_USERNAME | SMTP_USER,
 *   SMTP_APP_PASSWORD | SMTP_PASS,
 *   SMTP_FROM_NAME,
 *   SMTP_FROM_EMAIL | SMTP_FROM
 */
export function createEmailSender(): EmailSender {
  const host = envFirst('SMTP_HOST');
  if (host) {
    return new SmtpEmailSender({
      host,
      port: Number(envFirst('SMTP_PORT') ?? 587),
      secure: envFirst('SMTP_SECURE') === 'true',
      user: envFirst('SMTP_USERNAME', 'SMTP_USER'),
      pass: envFirst('SMTP_APP_PASSWORD', 'SMTP_PASS'),
      fromName: envFirst('SMTP_FROM_NAME'),
      fromEmail:
        envFirst('SMTP_FROM_EMAIL', 'SMTP_FROM') ?? 'no-reply@nexatech.local',
    });
  }
  if (process.env['NODE_ENV'] === 'test') {
    return new InMemoryEmailSender();
  }
  if (process.env['NODE_ENV'] === 'production') {
    return new DegradedEmailSender();
  }
  return new LoggingEmailSender();
}
