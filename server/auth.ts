import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const KEY_FILE = path.join(__dirname, '..', '.api-key');

let cachedKey: string | null = null;

/**
 * Get or generate the API key.
 * Priority: API_KEY env var > .api-key file > generate new random key
 */
export function getApiKey(): string {
  if (cachedKey) return cachedKey;

  if (process.env.API_KEY) {
    cachedKey = process.env.API_KEY;
    return cachedKey;
  }

  if (fs.existsSync(KEY_FILE)) {
    cachedKey = fs.readFileSync(KEY_FILE, 'utf-8').trim();
    return cachedKey;
  }

  cachedKey = crypto.randomBytes(32).toString('hex');
  fs.writeFileSync(KEY_FILE, cachedKey, 'utf-8');
  console.log(`[Auth] API key generated: ${cachedKey}`);
  return cachedKey;
}

/**
 * Express middleware — requires x-api-key header matching the server's key.
 */
export function authMiddleware(req: any, res: any, next: any) {
  const key = getApiKey();
  const provided = req.headers['x-api-key'];

  if (provided === key) {
    next();
  } else {
    res.status(401).json({ error: 'Unauthorized', message: 'Valid x-api-key header required' });
  }
}
