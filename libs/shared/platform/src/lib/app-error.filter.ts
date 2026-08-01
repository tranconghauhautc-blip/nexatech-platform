import {
  type ArgumentsHost,
  Catch,
  type ExceptionFilter,
  HttpException,
  HttpStatus,
  type INestApplication,
} from '@nestjs/common';
import {
  AppError,
  createErrorEnvelope,
  ErrorCodes,
  toErrorEnvelope,
} from '@nexatech/shared-errors';
import { createTraceId } from './shared-platform';

type HttpResponse = {
  status: (code: number) => { json: (body: unknown) => void };
};

type HttpRequest = {
  headers?: Record<string, string | string[] | undefined>;
};

function readTraceId(request: HttpRequest): string {
  const header = request.headers?.['x-trace-id'];
  if (typeof header === 'string' && header.trim()) {
    return header.trim();
  }
  if (Array.isArray(header) && header[0]?.trim()) {
    return header[0].trim();
  }
  return createTraceId();
}

function httpExceptionMessage(exception: HttpException): string {
  const body = exception.getResponse();
  if (typeof body === 'string') {
    return body;
  }
  if (typeof body === 'object' && body !== null && 'message' in body) {
    const message = (body as { message: unknown }).message;
    if (Array.isArray(message)) {
      return message.map(String).join(', ');
    }
    if (typeof message === 'string' && message.trim()) {
      return message;
    }
  }
  return exception.message || 'Yêu cầu thất bại';
}

/**
 * Chuẩn hóa mọi exception Nest về envelope lỗi NexaTech
 * (`errorCode`, `message`, `details`, `traceId`, `timestamp`).
 */
@Catch()
export class AppErrorFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<HttpResponse>();
    const request = ctx.getRequest<HttpRequest>();
    const traceId = readTraceId(request);

    if (exception instanceof AppError) {
      response
        .status(exception.httpStatus)
        .json(toErrorEnvelope(exception, traceId));
      return;
    }

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const errorCode =
        status === HttpStatus.BAD_REQUEST
          ? ErrorCodes.VALIDATION_FAILED
          : status === HttpStatus.UNAUTHORIZED
            ? ErrorCodes.UNAUTHORIZED
            : status === HttpStatus.FORBIDDEN
              ? ErrorCodes.FORBIDDEN
              : status === HttpStatus.NOT_FOUND
                ? ErrorCodes.NOT_FOUND
                : ErrorCodes.INTERNAL_ERROR;
      response.status(status).json(
        createErrorEnvelope({
          errorCode,
          message: httpExceptionMessage(exception),
          details: {},
          traceId,
        }),
      );
      return;
    }

    response
      .status(HttpStatus.INTERNAL_SERVER_ERROR)
      .json(toErrorEnvelope(exception, traceId));
  }
}

/** Đăng ký filter lỗi thống nhất cho mọi Nest microservice. */
export function useNexaTechExceptionFilter(app: INestApplication): void {
  app.useGlobalFilters(new AppErrorFilter());
}
