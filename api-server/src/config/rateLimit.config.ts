import rateLimit from 'express-rate-limit';

/**
 * Strict limiter for write/upload endpoints.
 * Each video process generates exactly one request per endpoint, so this only
 * needs to stop abuse, not normal usage.
 */
export const uploadLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  limit: 50,
  standardHeaders: true,
  legacyHeaders: false,
});

/**
 * Generous limiter for read/status endpoints.
 * The frontend polls the status endpoint while a video is processing, so this
 * must allow sustained polling (e.g. every 5s for several minutes) without
 * tripping over its own client.
 */
export const statusLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  limit: 600,
  standardHeaders: true,
  legacyHeaders: false,
});
