import { Logger } from '@nestjs/common';
import { AppError, ErrorCodes } from '@nexatech/shared-errors';
import * as nodemailer from 'nodemailer';

export interface SendEmailInput {
  to: string;
  subject: string;
  text: string;
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

/** Dev fallback when SMTP is not configured — logs instead of sending. */
export class LoggingEmailSender implements EmailSender {
  private static readonly logger = new Logger(LoggingEmailSender.name);

  async send(input: SendEmailInput): Promise<void> {
    LoggingEmailSender.logger.log(
      `[DEV EMAIL] to=${input.to} subject="${input.subject}"`,
    );
  }
}

export interface SmtpConfig {
  host: string;
  port: number;
  secure: boolean;
  user?: string;
  pass?: string;
  from: string;
}

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

  async send(input: SendEmailInput): Promise<void> {
    try {
      const transporter = this.getTransporter();
      await transporter.sendMail({
        from: this.config.from,
        to: input.to,
        subject: input.subject,
        text: input.text,
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

/**
 * Chọn triển khai EmailSender theo cấu hình môi trường:
 * - `SMTP_HOST` được cấu hình -> gửi email thật qua SMTP.
 * - `NODE_ENV=test` -> dùng bộ nhớ để test không phụ thuộc hạ tầng.
 * - Còn lại (dev không có SMTP) -> ghi log thay vì gửi thật.
 */
export function createEmailSender(): EmailSender {
  const host = process.env['SMTP_HOST'];
  if (host) {
    return new SmtpEmailSender({
      host,
      port: Number(process.env['SMTP_PORT'] ?? 587),
      secure: process.env['SMTP_SECURE'] === 'true',
      user: process.env['SMTP_USER'],
      pass: process.env['SMTP_PASS'],
      from: process.env['SMTP_FROM'] ?? 'no-reply@nexatech.local',
    });
  }
  if (process.env['NODE_ENV'] === 'test') {
    return new InMemoryEmailSender();
  }
  return new LoggingEmailSender();
}
