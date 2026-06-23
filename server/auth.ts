import type { NextFunction, Request, Response } from 'express';

export function getApiKey(): string | null {
  const key = process.env.API_KEY?.trim();
  return key || null;
}

export function isAuthEnabled(): boolean {
  const key = getApiKey();
  return Boolean(key);
}

export function authMiddleware(req: Request, res: Response, next: NextFunction): void {
  const key = getApiKey();
  if (!key) {
    next();
    return;
  }

  const provided = req.headers['x-api-key'];
  if (provided === key) {
    next();
  } else {
    res.status(401).json({ error: 'Unauthorized', message: 'Valid x-api-key header required' });
  }
}
