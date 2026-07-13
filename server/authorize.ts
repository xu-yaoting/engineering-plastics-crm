import type { Request, Response } from 'express';

type AuthorizedUser = { id: string; role: string };

export function canManageOwnedRecord(user: AuthorizedUser, ownerUserId: string | null | undefined): boolean {
  return user.role === 'admin' || (!!ownerUserId && ownerUserId === user.id);
}

export function requireOwnedRecord(
  req: Request,
  res: Response,
  ownerUserId: string | null | undefined,
): boolean {
  if (req.user && canManageOwnedRecord(req.user, ownerUserId)) return true;

  res.status(403).json({
    error: 'Only the owner or an administrator can edit this record',
  });
  return false;
}

export function requireAdministrator(req: Request, res: Response): boolean {
  if (req.user?.role === 'admin') return true;
  res.status(403).json({ error: 'Administrator access is required' });
  return false;
}
