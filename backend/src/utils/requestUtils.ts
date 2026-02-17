import { Request } from 'express';

/**
 * Extract client IP address from request, handling proxy headers
 * Supports X-Forwarded-For header for load balancers/proxies
 */
export function getClientIp(req: Request): string | undefined {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string') {
    // X-Forwarded-For can contain multiple IPs: "client, proxy1, proxy2"
    // The first IP is the original client
    return forwarded.split(',')[0].trim();
  }
  if (Array.isArray(forwarded) && forwarded.length > 0) {
    return forwarded[0].split(',')[0].trim();
  }
  return req.ip || req.socket?.remoteAddress;
}

/**
 * Extract User-Agent header from request
 */
export function getUserAgent(req: Request): string | undefined {
  return req.headers['user-agent'];
}
