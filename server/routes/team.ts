import { Router, Response } from 'express';
import db from '../db.js';

const router = Router();

router.get('/', (_req, res: Response) => {
  const members = db.prepare(
    'SELECT id, name, role FROM users WHERE is_active = 1 ORDER BY name COLLATE NOCASE'
  ).all();
  res.json(members);
});

export default router;
