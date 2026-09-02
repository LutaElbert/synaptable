import { describe, expect, it } from 'vitest';
import nextConfig from '../next.config';
import { PERMISSIONS_POLICY, WORKER_SECURITY_HEADERS } from './security-headers';

describe('WebMCP permissions policy', () => {
  it('keeps tools same-origin and preserves existing restricted capabilities', () => {
    expect(PERMISSIONS_POLICY).toContain('tools=(self)');
    for (const capability of ['camera', 'geolocation', 'microphone', 'payment', 'usb']) {
      expect(PERMISSIONS_POLICY).toContain(`${capability}=()`);
    }
  });

  it('uses the shared policy in the Next.js response configuration', async () => {
    const routes = await nextConfig.headers?.();
    const permissions = routes
      ?.flatMap((route) => route.headers)
      .find((header) => header.key === 'Permissions-Policy');
    expect(permissions?.value).toBe(PERMISSIONS_POLICY);
  });

  it('uses the identical same-origin policy in Cloudflare Worker responses', () => {
    expect(WORKER_SECURITY_HEADERS['Permissions-Policy']).toBe(PERMISSIONS_POLICY);
    expect(WORKER_SECURITY_HEADERS['X-Frame-Options']).toBe('DENY');
    expect(WORKER_SECURITY_HEADERS['Cross-Origin-Resource-Policy']).toBe('same-origin');
  });
});
