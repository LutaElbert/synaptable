import app from 'vinext/server/app-router-entry';
import { WORKER_SECURITY_HEADERS } from './app/security-headers';

const CONTENT_SECURITY_POLICY = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  "worker-src 'self' blob:",
  "connect-src 'self' data:",
  "object-src 'none'",
  "base-uri 'none'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join('; ');

type AppEnvironment = Parameters<typeof app.fetch>[1];
type AppContext = Parameters<typeof app.fetch>[2];

const worker = {
  async fetch(request: Request, environment?: AppEnvironment, context?: AppContext) {
    const response = await app.fetch(request, environment, context);
    const headers = new Headers(response.headers);
    for (const [name, value] of Object.entries(WORKER_SECURITY_HEADERS)) headers.set(name, value);
    if (process.env.NODE_ENV === 'production') {
      headers.set('Content-Security-Policy', CONTENT_SECURITY_POLICY);
    }
    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers,
    });
  },
};

export default worker;
