import type { OpenAPIObject } from '@nestjs/swagger';
import { stripForbiddenHeaderParametersForTest } from './swagger-setup';

describe('swagger-setup forbidden headers', () => {
  it('removes user-agent header parameters from operations', () => {
    const document = {
      openapi: '3.0.0',
      info: { title: 't', version: '1' },
      paths: {
        '/api/v1/auth/login': {
          post: {
            parameters: [
              { in: 'header', name: 'user-agent', required: true },
              { in: 'header', name: 'x-request-id', required: false },
            ],
          },
        },
      },
    } as unknown as OpenAPIObject;

    stripForbiddenHeaderParametersForTest(document);

    expect(document.paths?.['/api/v1/auth/login']?.post?.parameters).toEqual([
      { in: 'header', name: 'x-request-id', required: false },
    ]);
  });
});
