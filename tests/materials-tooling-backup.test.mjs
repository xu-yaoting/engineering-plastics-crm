import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import {
  copyFileSync, existsSync, mkdtempSync, mkdirSync, readdirSync, rmSync, writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';

const root = path.resolve(new URL('..', import.meta.url).pathname);
const backupScript = path.join(root, 'scripts/backup-crm.sh');
const restoreScript = path.join(root, 'scripts/restore-crm.sh');

test('backup creates .tar.gz archive with database and attachments, restore works', () => {
  const sandbox = mkdtempSync(path.join(tmpdir(), 'crm-backup-'));
  try {
    // Set up test CRM directory
    mkdirSync(path.join(sandbox, 'backups'));
    mkdirSync(path.join(sandbox, 'data', 'materials-tooling', 'attachments'), { recursive: true });

    // Create a real SQLite database
    execFileSync('sqlite3', [path.join(sandbox, 'crm.db'), 'CREATE TABLE test(id TEXT)']);

    // Create a test attachment file
    writeFileSync(path.join(sandbox, 'data', 'materials-tooling', 'attachments', 'sample.txt'), 'attachment-data');

    // Run backup
    const backupEnv = { ...process.env, CRM_ROOT_DIR: sandbox };
    execFileSync('bash', [backupScript], { env: backupEnv });

    // Backup was created
    const backupDir = path.join(sandbox, 'backups');
    const files = readdirSync(backupDir);
    const tarGz = files.find(f => f.endsWith('.tar.gz'));
    assert.ok(tarGz, 'Expected .tar.gz backup file');
    const checksumFile = files.find(f => f.endsWith('.sha256'));
    assert.ok(checksumFile, 'Expected checksum file');

    // Verify archive contains both DB and attachments
    const archive = path.join(backupDir, tarGz);
    const listing = execFileSync('tar', ['-tzf', archive], { encoding: 'utf8' });
    assert.ok(listing.includes('crm.db'), 'Archive should contain crm.db');
    assert.ok(listing.includes('data/materials-tooling/'), 'Archive should contain attachments dir');

    // Verify checksum matches
    const actualChecksum = execFileSync('shasum', ['-a', '256', archive], { encoding: 'utf8' }).split(/\s+/)[0];
    const checksumPath = path.join(backupDir, checksumFile);
    const storedChecksum = execFileSync('cat', [checksumPath], { encoding: 'utf8' }).split(/\s+/)[0];
    assert.equal(actualChecksum, storedChecksum);

    // Simulate restore into a fresh directory
    const restoreDir = mkdtempSync(path.join(tmpdir(), 'crm-restore-'));
    try {
      mkdirSync(path.join(restoreDir, 'backups'));
      // Restore without --confirm should fail
      assert.throws(() => execFileSync('bash', [restoreScript, archive], { encoding: 'utf8' }));

      // Restore with --confirm should succeed
      execFileSync('bash', [restoreScript, '--confirm', archive], { env: { ...process.env, CRM_ROOT_DIR: restoreDir } });

      // Database was restored (valid SQLite file)
      assert.ok(existsSync(path.join(restoreDir, 'crm.db')));
      const dbCheck = execFileSync('sqlite3', [path.join(restoreDir, 'crm.db'), 'SELECT name FROM sqlite_master'], { encoding: 'utf8' }).trim();
      assert.equal(dbCheck, 'test');

      // Attachments were restored
      assert.ok(existsSync(path.join(restoreDir, 'data', 'materials-tooling', 'attachments', 'sample.txt')));
      assert.equal(
        execFileSync('cat', [path.join(restoreDir, 'data', 'materials-tooling', 'attachments', 'sample.txt')], { encoding: 'utf8' }).trim(),
        'attachment-data',
      );
    } finally {
      rmSync(restoreDir, { recursive: true, force: true });
    }

    // Test: backup without attachments dir still works
    const noAttachSandbox = mkdtempSync(path.join(tmpdir(), 'crm-backup-noattach-'));
    try {
      mkdirSync(path.join(noAttachSandbox, 'backups'));
      execFileSync('sqlite3', [path.join(noAttachSandbox, 'crm.db'), 'CREATE TABLE test(id)']);
      execFileSync('bash', [backupScript], { env: { ...process.env, CRM_ROOT_DIR: noAttachSandbox } });
      const noAttachFiles = readdirSync(path.join(noAttachSandbox, 'backups'));
      const noAttachTar = noAttachFiles.find(f => f.endsWith('.tar.gz'));
      const noAttachArchive = path.join(noAttachSandbox, 'backups', noAttachTar);
      const noAttachListing = execFileSync('tar', ['-tzf', noAttachArchive], { encoding: 'utf8' });
      assert.ok(noAttachListing.includes('crm.db'));
    } finally {
      rmSync(noAttachSandbox, { recursive: true, force: true });
    }

    // Test: legacy .db.gz restore still works
    const legacyDb = path.join(sandbox, 'backups', 'test-legacy.db');
    execFileSync('sqlite3', [legacyDb, 'CREATE TABLE legacy(id TEXT)']);
    const legacyBackup = path.join(sandbox, 'backups', 'test-legacy.db.gz');
    execFileSync('gzip', ['-f', legacyDb]);
    const legacyRestoreDir = mkdtempSync(path.join(tmpdir(), 'crm-restore-legacy-'));
    try {
      mkdirSync(path.join(legacyRestoreDir, 'backups'));
      execFileSync('bash', [restoreScript, '--confirm', legacyBackup], { env: { ...process.env, CRM_ROOT_DIR: legacyRestoreDir } });
      assert.ok(existsSync(path.join(legacyRestoreDir, 'crm.db')));
      const legacyCheck = execFileSync('sqlite3', [path.join(legacyRestoreDir, 'crm.db'), 'SELECT name FROM sqlite_master'], { encoding: 'utf8' }).trim();
      assert.equal(legacyCheck, 'legacy');
    } finally {
      rmSync(legacyRestoreDir, { recursive: true, force: true });
    }
  } finally {
    rmSync(sandbox, { recursive: true, force: true });
  }
});

test('restore validates a backup before replacing the current database or attachments', () => {
  const sandbox = mkdtempSync(path.join(tmpdir(), 'crm-restore-invalid-'));
  try {
    mkdirSync(path.join(sandbox, 'backups'));
    mkdirSync(path.join(sandbox, 'scripts'));
    copyFileSync(backupScript, path.join(sandbox, 'scripts', 'backup-crm.sh'));
    mkdirSync(path.join(sandbox, 'data', 'materials-tooling', 'attachments'), { recursive: true });
    const databasePath = path.join(sandbox, 'crm.db');
    const attachmentPath = path.join(
      sandbox, 'data', 'materials-tooling', 'attachments', 'current.txt',
    );
    execFileSync('sqlite3', [databasePath, "CREATE TABLE current_data(value TEXT); INSERT INTO current_data VALUES ('keep-me')"]);
    writeFileSync(attachmentPath, 'keep-attachment');

    const corruptArchive = path.join(sandbox, 'backups', 'corrupt.tar.gz');
    writeFileSync(corruptArchive, 'not a tar archive');
    assert.throws(() => execFileSync(
      'bash', [restoreScript, '--confirm', corruptArchive],
      { env: { ...process.env, CRM_ROOT_DIR: sandbox }, stdio: 'pipe' },
    ));

    assert.equal(
      execFileSync('sqlite3', [databasePath, 'SELECT value FROM current_data'], { encoding: 'utf8' }).trim(),
      'keep-me',
    );
    assert.equal(execFileSync('cat', [attachmentPath], { encoding: 'utf8' }).trim(), 'keep-attachment');

    const missingDatabaseDirectory = path.join(sandbox, 'missing-database');
    mkdirSync(missingDatabaseDirectory);
    writeFileSync(path.join(missingDatabaseDirectory, 'readme.txt'), 'no database here');
    const missingDatabaseArchive = path.join(sandbox, 'backups', 'missing-database.tar.gz');
    execFileSync('tar', ['-czf', missingDatabaseArchive, '.'], { cwd: missingDatabaseDirectory });
    assert.throws(() => execFileSync(
      'bash', [restoreScript, '--confirm', missingDatabaseArchive],
      { env: { ...process.env, CRM_ROOT_DIR: sandbox }, stdio: 'pipe' },
    ));
    assert.equal(
      execFileSync('sqlite3', [databasePath, 'SELECT value FROM current_data'], { encoding: 'utf8' }).trim(),
      'keep-me',
    );

    const unsupported = path.join(sandbox, 'backups', 'backup.zip');
    writeFileSync(unsupported, 'unsupported');
    assert.throws(() => execFileSync(
      'bash', [restoreScript, '--confirm', unsupported],
      { env: { ...process.env, CRM_ROOT_DIR: sandbox }, stdio: 'pipe' },
    ));
    assert.equal(
      execFileSync('sqlite3', [databasePath, 'SELECT value FROM current_data'], { encoding: 'utf8' }).trim(),
      'keep-me',
    );
  } finally {
    rmSync(sandbox, { recursive: true, force: true });
  }
});
