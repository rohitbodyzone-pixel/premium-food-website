import { Request, Response, NextFunction } from 'express';

interface RateLimitRecord {
  count: number;
  resetAt: number;
}

export function createRateLimiter(options: {
  windowMs: number;
  maxRequests: number;
  message: string;
  keyGenerator?: (req: Request) => string;
}) {
  const store = new Map<string, RateLimitRecord>();

  // Cleanup expired records periodically
  setInterval(() => {
    const now = Date.now();
    for (const [key, record] of store.entries()) {
      if (record.resetAt <= now) {
        store.delete(key);
      }
    }
  }, options.windowMs).unref();

  return (req: Request, res: Response, next: NextFunction): void => {
    // In test environment, allow passing a test header to bypass if needed
    if (process.env.NODE_ENV === 'test' && req.headers['x-bypass-rate-limit'] === 'true') {
      next();
      return;
    }

    const key = options.keyGenerator
      ? options.keyGenerator(req)
      : (req.ip || req.socket.remoteAddress || 'unknown-ip');

    const now = Date.now();
    const record = store.get(key);

    if (!record || record.resetAt <= now) {
      store.set(key, { count: 1, resetAt: now + options.windowMs });
      next();
      return;
    }

    if (record.count >= options.maxRequests) {
      const retryAfterSeconds = Math.ceil((record.resetAt - now) / 1000);
      res.setHeader('Retry-After', retryAfterSeconds);
      res.status(429).json({
        error: options.message,
        retryAfterSeconds,
      });
      return;
    }

    record.count += 1;
    next();
  };
}

// Pre-configured rate limiters
export const loginRateLimiter = createRateLimiter({
  windowMs: 5 * 60 * 1000, // 5 minutes
  maxRequests: 5,
  message: 'Too many login attempts. Please wait 5 minutes before trying again.',
  keyGenerator: (req) => `${req.ip}_${req.body?.email || 'anon'}`,
});

export const passwordResetRateLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  maxRequests: 3,
  message: 'Too many password reset requests. Please wait 15 minutes before requesting another reset.',
  keyGenerator: (req) => `${req.ip}_${req.body?.email || 'anon'}`,
});

export const callRequestRateLimiter = createRateLimiter({
  windowMs: 60 * 1000, // 1 minute
  maxRequests: 5,
  message: 'Too many call requests initiated. Please wait a moment before trying again.',
  keyGenerator: (req) => `${req.user?.id || req.ip}_call_requests`,
});

export const phoneOtpRateLimiter = createRateLimiter({
  windowMs: 10 * 60 * 1000, // 10 minutes
  maxRequests: 10,
  message: 'Too many SMS OTP requests for this phone number or network. Please wait a few minutes before trying again.',
  keyGenerator: (req) => {
    const rawPhone = req.body?.phoneNumber || '';
    const phoneKey = rawPhone.replace(/\D/g, '') || 'anon_phone';
    return `${req.ip}_${phoneKey}`;
  },
});
