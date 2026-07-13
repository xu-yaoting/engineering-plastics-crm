import type { NextFunction, Request, Response } from 'express';
import db from './db.js';

declare global {
  namespace Express {
    interface Request {
      user?: { id: string; name: string; role: string };
    }
  }
}

export function authMiddleware(req: Request, _res: Response, next: NextFunction): void {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    _res.status(401).json({ error: 'Unauthorized', message: 'Valid Authorization: Bearer <token> header required' });
    return;
  }

  const token = header.slice(7);
  const user = db.prepare("SELECT id, name, role FROM users WHERE token = ? AND is_active = 1").get(token) as { id: string; name: string; role: string } | undefined;

  if (!user) {
    _res.status(401).json({ error: 'Unauthorized', message: 'Invalid or expired token' });
    return;
  }

  // Update last_seen_at
  db.prepare("UPDATE users SET last_seen_at = datetime('now') WHERE id = ?").run(user.id);

  req.user = user;
  next();
}
