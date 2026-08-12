import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';

type HttpReq = {
  headers: Record<string, string | string[] | undefined>;
  method?: string;
  url?: string;
};

type HttpRes = {
  status: (code: number) => HttpRes;
  json: (body: unknown) => void;
};

export class ApiErrorBody {
  errorCode!: string;
  message!: string;
  details?: unknown;
  traceId!: string;
  timestamp!: string;
  /** LAB: stack intentionally exposed (Security Misconfiguration) */
  stack?: string;
}

@Catch()
export class VulnCartExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(VulnCartExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const res = ctx.getResponse<HttpRes>();
    const req = ctx.getRequest<HttpReq>();
    const traceId =
      (req.headers['x-trace-id'] as string) ||
      (req.headers['x-request-id'] as string) ||
      `trc-${Date.now()}`;

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let errorCode = 'INTERNAL_ERROR';
    let message: string | string[] = 'Unexpected error';
    let details: unknown;

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const body = exception.getResponse();
      if (typeof body === 'string') {
        message = body;
      } else if (body && typeof body === 'object') {
        const o = body as Record<string, unknown>;
        message = (o['message'] as string | string[]) ?? exception.message;
        errorCode = String(o['errorCode'] ?? o['error'] ?? `HTTP_${status}`);
        details = o['details'] ?? o['message'];
      }
      errorCode =
        status === 401
          ? 'UNAUTHORIZED'
          : status === 403
            ? 'FORBIDDEN'
            : status === 404
              ? 'NOT_FOUND'
              : status === 400
                ? 'BAD_REQUEST'
                : errorCode;
    } else if (exception instanceof Error) {
      message = exception.message;
    }

    const payload: ApiErrorBody = {
      errorCode,
      message: Array.isArray(message) ? message.join('; ') : String(message),
      details,
      traceId,
      timestamp: new Date().toISOString(),
      stack: exception instanceof Error ? exception.stack : undefined,
    };

    this.logger.warn(`${req.method} ${req.url} -> ${status} ${errorCode}`);
    res.status(status).json(payload);
  }
}
