import { Request, Response, NextFunction } from "express";

/**
 * Cache control middleware for different types of content
 * Improves performance by allowing browsers and CDNs to cache responses
 */

export const cacheControl = (maxAge: number, options?: { 
  public?: boolean; 
  immutable?: boolean;
  staleWhileRevalidate?: number;
}) => {
  return (_req: Request, res: Response, next: NextFunction) => {
    const directives = [
      options?.public !== false ? 'public' : 'private',
      `max-age=${maxAge}`,
    ];

    if (options?.immutable) {
      directives.push('immutable');
    }

    if (options?.staleWhileRevalidate) {
      directives.push(`stale-while-revalidate=${options.staleWhileRevalidate}`);
    }

    res.setHeader('Cache-Control', directives.join(', '));
    next();
  };
};

/**
 * No cache for dynamic/authenticated content
 */
export const noCache = (_req: Request, res: Response, next: NextFunction) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  next();
};

/**
 * Short cache for frequently updated content (5 minutes)
 */
export const shortCache = cacheControl(300, { staleWhileRevalidate: 60 });

/**
 * Medium cache for semi-static content (1 hour)
 */
export const mediumCache = cacheControl(3600, { staleWhileRevalidate: 300 });

/**
 * Long cache for static content (1 day)
 */
export const longCache = cacheControl(86400, { public: true, staleWhileRevalidate: 3600 });

/**
 * Very long cache for immutable content (1 year)
 */
export const immutableCache = cacheControl(31536000, { public: true, immutable: true });
