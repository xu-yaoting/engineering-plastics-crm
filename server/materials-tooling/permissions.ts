import type Database from 'better-sqlite3';
import type { NextFunction, Request, Response } from 'express';

export type MaterialsPermission = {
  enter: boolean;
  manageMaterials: boolean;
  approve: boolean;
  viewPrices: boolean;
  managePeriods: boolean;
};

export const MATERIAL_DOCUMENT_TYPES = [
  'purchase_request',
  'purchase_receipt',
  'material_issue',
  'material_return',
  'scrap',
  'count_adjustment',
  'tooling_movement',
] as const;

export type MaterialDocumentType = typeof MATERIAL_DOCUMENT_TYPES[number];
export type MaterialsCapability = keyof MaterialsPermission;

type MaterialsUser = {
  id: string;
  role: string;
};

type ListedMaterialsUser = MaterialsUser & {
  name: string;
};

type StoredPermissionRow = {
  manage_materials: number;
  approve: number;
  view_prices: number;
  manage_periods: number;
};

type PermissionUpdate = Omit<MaterialsPermission, 'enter'>;

export type ApprovalConfigEntry = {
  documentType: MaterialDocumentType;
  approver: null | {
    id: string;
    name: string;
    isActive: boolean;
    isAuthorized: boolean;
  };
};

const PERMISSION_UPDATE_KEYS = [
  'manageMaterials',
  'approve',
  'viewPrices',
  'managePeriods',
] as const satisfies readonly (keyof PermissionUpdate)[];

const ADMIN_PERMISSIONS: MaterialsPermission = {
  enter: true,
  manageMaterials: true,
  approve: true,
  viewPrices: true,
  managePeriods: true,
};

const DOCUMENT_TYPE_SET = new Set<string>(MATERIAL_DOCUMENT_TYPES);

export class MaterialsAuthorizationError extends Error {
  readonly statusCode = 403;
  readonly code = 'MATERIALS_FORBIDDEN';

  constructor(message = 'Materials & Tooling administrator access is required') {
    super(message);
    this.name = 'MaterialsAuthorizationError';
  }
}

export class MaterialsConfigurationError extends Error {
  readonly statusCode = 409;
  readonly code = 'MATERIALS_CONFIGURATION_ERROR';

  constructor(message: string) {
    super(message);
    this.name = 'MaterialsConfigurationError';
  }
}

export class MaterialsValidationError extends Error {
  readonly statusCode = 400;
  readonly code = 'MATERIALS_VALIDATION_ERROR';

  constructor(message: string) {
    super(message);
    this.name = 'MaterialsValidationError';
  }
}

function assertAdministrator(actor: MaterialsUser): void {
  if (actor.role !== 'admin') throw new MaterialsAuthorizationError();
}

function assertDocumentType(documentType: string): asserts documentType is MaterialDocumentType {
  if (!DOCUMENT_TYPE_SET.has(documentType)) {
    throw new MaterialsConfigurationError(`Unsupported materials document type: ${documentType}`);
  }
}

function assertPermissionUpdate(value: unknown): asserts value is PermissionUpdate {
  if (
    value === null
    || typeof value !== 'object'
    || Object.getPrototypeOf(value) !== Object.prototype
  ) {
    throw new MaterialsValidationError('Permissions must be a plain object');
  }

  const keys = Reflect.ownKeys(value);
  if (
    keys.length !== PERMISSION_UPDATE_KEYS.length
    || keys.some((key) => (
      typeof key !== 'string'
      || !PERMISSION_UPDATE_KEYS.includes(key as keyof PermissionUpdate)
    ))
  ) {
    throw new MaterialsValidationError(
      `Permissions must contain exactly: ${PERMISSION_UPDATE_KEYS.join(', ')}`,
    );
  }

  for (const key of PERMISSION_UPDATE_KEYS) {
    if (typeof (value as Record<string, unknown>)[key] !== 'boolean') {
      throw new MaterialsValidationError(`${key} must be a boolean`);
    }
  }
}

export function createMaterialsPermissionService(database: Database.Database) {
  function getMaterialsPermission(user: MaterialsUser): MaterialsPermission {
    if (user.role === 'admin') return { ...ADMIN_PERMISSIONS };

    const row = database.prepare(`
      SELECT manage_materials, approve, view_prices, manage_periods
      FROM mt_permissions
      WHERE user_id = ?
    `).get(user.id) as StoredPermissionRow | undefined;

    return {
      enter: true,
      manageMaterials: Boolean(row?.manage_materials),
      approve: Boolean(row?.approve),
      viewPrices: Boolean(row?.view_prices),
      managePeriods: Boolean(row?.manage_periods),
    };
  }

  function requireMaterialsPermission(capability: MaterialsCapability) {
    return (req: Request, res: Response, next: NextFunction): void => {
      if (!req.user) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      if (capability === 'enter' || getMaterialsPermission(req.user)[capability]) {
        next();
        return;
      }

      res.status(403).json({
        error: 'Forbidden',
        message: `Materials & Tooling permission required: ${capability}`,
      });
    };
  }

  function requireMaterialsAdministrator(req: Request, res: Response, next: NextFunction): void {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    if (req.user.role !== 'admin') {
      res.status(403).json({ error: 'Forbidden' });
      return;
    }
    next();
  }

  function listUserPermissions(actor: MaterialsUser): Array<ListedMaterialsUser & {
    permissions: MaterialsPermission;
  }> {
    assertAdministrator(actor);
    const users = database.prepare(`
      SELECT id, name, role
      FROM users
      WHERE is_active = 1
      ORDER BY name COLLATE NOCASE, id
    `).all() as ListedMaterialsUser[];

    return users.map((user) => ({
      ...user,
      permissions: getMaterialsPermission(user),
    }));
  }

  function requireActiveUser(userId: string, label: string): MaterialsUser {
    const user = database.prepare('SELECT id, role FROM users WHERE id = ? AND is_active = 1')
      .get(userId) as MaterialsUser | undefined;
    if (!user) throw new MaterialsConfigurationError(`${label} must be an active user`);
    return user;
  }

  function updateUserPermissions(
    actor: MaterialsUser,
    targetUserId: string,
    permissions: unknown,
  ): MaterialsPermission {
    assertAdministrator(actor);
    assertPermissionUpdate(permissions);
    const targetUser = requireActiveUser(targetUserId, 'Permission target');

    const updatedAt = new Date().toISOString();
    database.prepare(`
      INSERT INTO mt_permissions (
        user_id, manage_materials, approve, view_prices, manage_periods, updated_by, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(user_id) DO UPDATE SET
        manage_materials = excluded.manage_materials,
        approve = excluded.approve,
        view_prices = excluded.view_prices,
        manage_periods = excluded.manage_periods,
        updated_by = excluded.updated_by,
        updated_at = excluded.updated_at
    `).run(
      targetUserId,
      permissions.manageMaterials ? 1 : 0,
      permissions.approve ? 1 : 0,
      permissions.viewPrices ? 1 : 0,
      permissions.managePeriods ? 1 : 0,
      actor.id,
      updatedAt,
    );

    return getMaterialsPermission(targetUser);
  }

  function listApprovalConfig(actor: MaterialsUser): ApprovalConfigEntry[] {
    assertAdministrator(actor);
    const configuredRows = database.prepare(`
      SELECT
        config.document_type,
        approver.id AS approver_id,
        approver.name AS approver_name,
        approver.role AS approver_role,
        approver.is_active AS approver_is_active
      FROM mt_approval_config config
      LEFT JOIN users approver ON approver.id = config.approver_user_id
    `).all() as Array<{
      document_type: MaterialDocumentType;
      approver_id: string | null;
      approver_name: string | null;
      approver_role: string | null;
      approver_is_active: number | null;
    }>;
    const configuredByType = new Map(configuredRows.map((row) => [row.document_type, row]));

    return MATERIAL_DOCUMENT_TYPES.map((documentType) => {
      const row = configuredByType.get(documentType);
      if (!row?.approver_id || !row.approver_name || !row.approver_role) {
        return { documentType, approver: null };
      }
      const isActive = Boolean(row.approver_is_active);
      return {
        documentType,
        approver: {
          id: row.approver_id,
          name: row.approver_name,
          isActive,
          isAuthorized: isActive && getMaterialsPermission({
            id: row.approver_id,
            role: row.approver_role,
          }).approve,
        },
      };
    });
  }

  function updateApprovalConfig(
    actor: MaterialsUser,
    documentType: MaterialDocumentType,
    approverUserId: string,
  ): ApprovalConfigEntry {
    assertAdministrator(actor);
    assertDocumentType(documentType);
    const approver = requireActiveUser(approverUserId, 'Approver');
    if (!getMaterialsPermission(approver).approve) {
      throw new MaterialsConfigurationError(
        'Approver must have the Materials & Tooling approve permission',
      );
    }

    database.prepare(`
      INSERT INTO mt_approval_config (
        document_type, approver_user_id, updated_by, updated_at
      ) VALUES (?, ?, ?, ?)
      ON CONFLICT(document_type) DO UPDATE SET
        approver_user_id = excluded.approver_user_id,
        updated_by = excluded.updated_by,
        updated_at = excluded.updated_at
    `).run(documentType, approverUserId, actor.id, new Date().toISOString());

    const entry = listApprovalConfig(actor).find((config) => config.documentType === documentType);
    if (!entry) throw new MaterialsConfigurationError('Approval configuration was not saved');
    return entry;
  }

  function resolveApprover(
    documentType: MaterialDocumentType,
    applicantUserId?: string,
  ): string {
    assertDocumentType(documentType);
    const row = database.prepare(`
      SELECT config.approver_user_id, approver.role
      FROM mt_approval_config config
      JOIN users approver
        ON approver.id = config.approver_user_id
       AND approver.is_active = 1
      WHERE config.document_type = ?
    `).get(documentType) as { approver_user_id: string; role: string } | undefined;

    if (!row || !getMaterialsPermission({ id: row.approver_user_id, role: row.role }).approve) {
      throw new MaterialsConfigurationError(
        `No active and authorized approver is configured for ${documentType}`,
      );
    }
    if (applicantUserId && applicantUserId === row.approver_user_id) {
      throw new MaterialsConfigurationError('Applicants cannot approve their own documents');
    }
    return row.approver_user_id;
  }

  return {
    getMaterialsPermission,
    listApprovalConfig,
    listUserPermissions,
    requireMaterialsPermission,
    requireMaterialsAdministrator,
    resolveApprover,
    updateUserPermissions,
    updateApprovalConfig,
  };
}

let defaultService: ReturnType<typeof createMaterialsPermissionService> | undefined;

export function configureMaterialsPermissionService(
  database: Database.Database,
): ReturnType<typeof createMaterialsPermissionService> {
  defaultService = createMaterialsPermissionService(database);
  return defaultService;
}

function getDefaultService(): ReturnType<typeof createMaterialsPermissionService> {
  if (!defaultService) {
    throw new Error('Materials & Tooling permission service has not been configured');
  }
  return defaultService;
}

export function getMaterialsPermission(user: MaterialsUser): MaterialsPermission {
  return getDefaultService().getMaterialsPermission(user);
}

export function requireMaterialsPermission(capability: MaterialsCapability) {
  return (req: Request, res: Response, next: NextFunction): void => {
    getDefaultService().requireMaterialsPermission(capability)(req, res, next);
  };
}

export function resolveApprover(
  documentType: MaterialDocumentType,
  applicantUserId?: string,
): string {
  return getDefaultService().resolveApprover(documentType, applicantUserId);
}

export function updateUserPermissions(
  actor: MaterialsUser,
  targetUserId: string,
  permissions: unknown,
): MaterialsPermission {
  return getDefaultService().updateUserPermissions(actor, targetUserId, permissions);
}

export function updateApprovalConfig(
  actor: MaterialsUser,
  documentType: MaterialDocumentType,
  approverUserId: string,
): ApprovalConfigEntry {
  return getDefaultService().updateApprovalConfig(actor, documentType, approverUserId);
}
