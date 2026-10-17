import { Router, Request, Response, NextFunction } from 'express';
import { randomBytes, randomUUID, scryptSync, timingSafeEqual } from 'crypto';
import db from '../db.js';

const router = Router();
const LOGIN_FAILURE_LIMIT = 5;
const SETUP_ATTEMPT_LIMIT = 5;
const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000;

type RateLimitEntry = {
  failures: number;
  windowStartedAt: number;
};

const loginUsernameFailures = new Map<string, RateLimitEntry>();
const loginIpFailures = new Map<string, RateLimitEntry>();
const setupAttempts = new Map<string, RateLimitEntry>();

type AuthUser = {
  id: string;
  name: string;
  token: string;
  pin_hash: string;
  pin_salt: string;
  role: string;
};

function isDirectLoopbackAddress(address: string | undefined): boolean {
  return address === '127.0.0.1' || address === '::ffff:127.0.0.1' || address === '::1';
}

/**
 * Resolve the real client IP for rate limiting. The API listens on loopback
 * only, so a loopback socket address means the request arrived through the
 * local reverse proxy; in that case trust the last hop of X-Forwarded-For
 * (the proxy appends the true remote address last — clients can prepend to
 * the header but can never replace that final value). Direct connections
 * keep their socket address.
 */
function requestClientIp(req: Request): string {
  const direct = req.socket.remoteAddress ?? 'unknown';
  if (!isDirectLoopbackAddress(direct)) return direct;
  const header = req.headers['x-forwarded-for'];
  const chain = Array.isArray(header) ? header.join(',') : header;
  const hops = chain?.split(',').map((part) => part.trim()).filter(Boolean) ?? [];
  return hops.pop() ?? direct;
}

function isRateLimited(
  attempts: Map<string, RateLimitEntry>,
  key: string,
  limit: number,
  now = Date.now(),
): boolean {
  const entry = attempts.get(key);
  if (!entry) return false;
  if (now - entry.windowStartedAt >= RATE_LIMIT_WINDOW_MS) {
    attempts.delete(key);
    return false;
  }
  return entry.failures >= limit;
}

function recordFailure(attempts: Map<string, RateLimitEntry>, key: string, now = Date.now()): void {
  const entry = attempts.get(key);
  if (!entry || now - entry.windowStartedAt >= RATE_LIMIT_WINDOW_MS) {
    attempts.set(key, { failures: 1, windowStartedAt: now });
    return;
  }
  entry.failures += 1;
}

function validName(name: unknown): name is string {
  return typeof name === 'string' && name.trim().length > 0 && name.trim().length <= 50;
}

function validPin(pin: unknown): pin is string {
  return typeof pin === 'string' && /^\d{6}$/.test(pin);
}

function hashPin(pin: string, salt: string): string {
  return scryptSync(pin, salt, 64).toString('hex');
}

function pinMatches(pin: string, user: AuthUser): boolean {
  try {
    const actual = Buffer.from(hashPin(pin, user.pin_salt), 'hex');
    const expected = Buffer.from(user.pin_hash, 'hex');
    return actual.length === expected.length && timingSafeEqual(actual, expected);
  } catch {
    return false;
  }
}

function requireAdmin(req: Request, res: Response, next: NextFunction): void {
  const header = req.headers.authorization;
  const token = header?.startsWith('Bearer ') ? header.slice(7) : '';
  const user = db.prepare("SELECT id, role FROM users WHERE token = ? AND is_active = 1")
    .get(token) as { id: string; role: string } | undefined;

  if (!user) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }
  if (user.role !== 'admin') {
    res.status(403).json({ error: 'Administrator access is required' });
    return;
  }
  next();
}

router.get('/status', (_req: Request, res: Response) => {
  const row = db.prepare('SELECT COUNT(*) AS count FROM users WHERE pin_hash IS NOT NULL').get() as { count: number };
  res.json({ requiresSetup: row.count === 0 });
});

/** One-time first-run setup. The first credentialed account becomes administrator. */
router.post('/setup', (req: Request, res: Response) => {
  const clientIp = req.socket.remoteAddress ?? '';
  const proxied = req.headers['x-forwarded-for'] ?? req.headers['x-real-ip'];
  if (!isDirectLoopbackAddress(clientIp) || proxied) {
    return res.status(403).json({ error: 'Initial setup is only available from this computer' });
  }

  const { name, pin } = req.body ?? {};
  if (!validName(name)) return res.status(400).json({ error: 'Name is required (maximum 50 characters)' });
  if (!validPin(pin)) return res.status(400).json({ error: 'PIN must contain exactly 6 digits' });

  const cleanName = name.trim();
  const credentialed = db.prepare('SELECT COUNT(*) AS count FROM users WHERE pin_hash IS NOT NULL').get() as { count: number };
  if (credentialed.count > 0) return res.status(409).json({ error: 'Initial setup has already been completed' });

  if (isRateLimited(setupAttempts, clientIp, SETUP_ATTEMPT_LIMIT)) {
    return res.status(429).json({ error: 'Too many setup attempts. Try again later.' });
  }
  recordFailure(setupAttempts, clientIp);

  const now = new Date().toISOString();
  const salt = randomBytes(16).toString('hex');
  const pinHash = hashPin(pin, salt);
  const token = randomUUID();

  const setup = db.transaction(() => {
    const credentialed = db.prepare('SELECT COUNT(*) AS count FROM users WHERE pin_hash IS NOT NULL').get() as { count: number };
    if (credentialed.count > 0) return null;

    const existing = db.prepare('SELECT id FROM users WHERE name = ? COLLATE NOCASE').get(cleanName) as { id: string } | undefined;
    const id = existing?.id ?? randomUUID();
    if (existing) {
      db.prepare("UPDATE users SET name = ?, token = ?, pin_hash = ?, pin_salt = ?, role = 'admin', is_active = 1, last_seen_at = ? WHERE id = ?")
        .run(cleanName, token, pinHash, salt, now, id);
    } else {
      db.prepare("INSERT INTO users (id, name, token, pin_hash, pin_salt, role, is_active, created_at, last_seen_at) VALUES (?, ?, ?, ?, ?, 'admin', 1, ?, ?)")
        .run(id, cleanName, token, pinHash, salt, now, now);
    }
    return id;
  })();

  if (!setup) return res.status(409).json({ error: 'Initial setup has already been completed' });
  setupAttempts.delete(clientIp);
  res.status(201).json({ user: { id: setup, name: cleanName, role: 'admin' }, token });
});

router.post('/login', (req: Request, res: Response) => {
  const { name, pin } = req.body ?? {};
  if (!validName(name) || !validPin(pin)) {
    return res.status(400).json({ error: 'Name and 6-digit PIN are required' });
  }

  const clientIp = requestClientIp(req);
  const cleanName = name.trim();
  const normalizedName = name.trim().toLocaleLowerCase();
  const usernameKey = normalizedName;
  if (
    isRateLimited(loginIpFailures, clientIp, LOGIN_FAILURE_LIMIT)
    || isRateLimited(loginUsernameFailures, usernameKey, LOGIN_FAILURE_LIMIT)
  ) {
    return res.status(429).json({ error: 'Too many failed login attempts. Try again later.' });
  }

  const user = db.prepare("SELECT id, name, token, pin_hash, pin_salt, role FROM users WHERE name = ? COLLATE NOCASE AND is_active = 1 AND pin_hash IS NOT NULL")
    .get(cleanName) as AuthUser | undefined;
  if (!user || !pinMatches(pin, user)) {
    recordFailure(loginIpFailures, clientIp);
    recordFailure(loginUsernameFailures, usernameKey);
    return res.status(401).json({ error: 'Invalid name or PIN' });
  }

  loginIpFailures.delete(clientIp);
  loginUsernameFailures.delete(usernameKey);
  const token = randomUUID();
  db.prepare('UPDATE users SET token = ?, last_seen_at = ? WHERE id = ?')
    .run(token, new Date().toISOString(), user.id);

  res.json({ user: { id: user.id, name: user.name, role: user.role }, token });
});

router.post('/register', (_req: Request, res: Response) => {
  res.status(410).json({ error: 'Passwordless registration has been disabled' });
});

router.get('/users', requireAdmin, (_req: Request, res: Response) => {
  const users = db.prepare('SELECT id, name, role, is_active, created_at, last_seen_at FROM users ORDER BY name COLLATE NOCASE')
    .all();
  res.json(users);
});

router.post('/users', requireAdmin, (req: Request, res: Response) => {
  const { name, pin } = req.body ?? {};
  if (!validName(name)) return res.status(400).json({ error: 'Name is required (maximum 50 characters)' });
  if (!validPin(pin)) return res.status(400).json({ error: 'PIN must contain exactly 6 digits' });

  const cleanName = name.trim();
  const existing = db.prepare('SELECT id FROM users WHERE name = ? COLLATE NOCASE').get(cleanName);
  if (existing) return res.status(409).json({ error: 'An account with this name already exists' });

  const id = randomUUID();
  const salt = randomBytes(16).toString('hex');
  const now = new Date().toISOString();
  db.prepare("INSERT INTO users (id, name, token, pin_hash, pin_salt, role, is_active, created_at) VALUES (?, ?, ?, ?, ?, 'member', 1, ?)")
    .run(id, cleanName, randomUUID(), hashPin(pin, salt), salt, now);

  res.status(201).json({ id, name: cleanName, role: 'member', is_active: 1, created_at: now, last_seen_at: null });
});

/** Verify current token — returns user info or 401 */
router.get('/me', (req: Request, res: Response) => {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const token = header.slice(7);
  const user = db.prepare("SELECT id, name, role FROM users WHERE token = ? AND is_active = 1").get(token) as { id: string; name: string; role: string } | undefined;

  if (!user) {
    return res.status(401).json({ error: 'Unauthorized', message: 'Invalid token' });
  }

  db.prepare("UPDATE users SET last_seen_at = datetime('now') WHERE id = ?").run(user.id);
  res.json({ user });
});

export default router;
