import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import pg from 'pg';

const { Client } = pg;

// Parse date columns as string YYYY-MM-DD
pg.types.setTypeParser(1082, (val) => val);

const TABLES_IN_ORDER = [
  'schema_migrations',
  'organizations',
  'org_units',
  'users',
  'roles',
  'user_roles',
  'numbering_policies',
  'letter_types',
  'signatory_mandates',
  'letters',
  'letter_revisions',
  'approval_requests',
  'approval_steps',
  'letter_status_history',
  'audit_events',
];

/**
 * @param {string|null} [targetDbName]
 * @param {string|null} [outputFileName]
 */
export async function backupDatabase(targetDbName = null, outputFileName = null) {
  const rootDir = process.cwd();
  const backupsDir = path.resolve(rootDir, 'backups');
  fs.mkdirSync(backupsDir, { recursive: true });

  const envUrl = process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/p4i_office_test';
  const urlObj = new URL(envUrl);
  if (targetDbName) {
    urlObj.pathname = `/${targetDbName}`;
  }
  const sourceDb = urlObj.pathname.replace(/^\//, '');
  const connectionString = urlObj.toString();
  const maskedUrl = connectionString.replace(/:[^:@]+@/, ':***@');

  console.log(`[P4I-BACKUP] Memulai proses backup dari basis data: ${sourceDb} (${maskedUrl})`);

  const client = new Client({ connectionString });
  try {
    await client.connect();

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const manifest = {
      version: '1.0.0-sprint1c',
      sourceDatabase: sourceDb,
      createdAt: new Date().toISOString(),
      tables: {},
      totalRows: 0,
      dataHash: '',
    };

    const dumpData = {};
    let allContentString = '';

    for (const tableName of TABLES_IN_ORDER) {
      // Check if table exists
      const tableCheck = await client.query(
        "SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = $1",
        [tableName]
      );
      if (tableCheck.rows.length === 0) {
        console.log(`[P4I-BACKUP] [SKIP] Tabel '${tableName}' belum ada di database.`);
        continue;
      }

      const res = await client.query(`SELECT * FROM "${tableName}" ORDER BY 1 ASC`);
      dumpData[tableName] = res.rows;
      manifest.tables[tableName] = res.rows.length;
      manifest.totalRows += res.rows.length;

      const normalizedRows = res.rows.map(r => {
        const norm = {};
        for (const k of Object.keys(r).sort()) {
          const v = r[k];
          norm[k] = v instanceof Date ? v.toISOString() : v;
        }
        return norm;
      });
      const serializedTable = JSON.stringify(normalizedRows);
      allContentString += `${tableName}:${serializedTable};`;
      console.log(`[P4I-BACKUP] Tabel '${tableName}': diekspor ${res.rows.length} baris.`);
    }

    manifest.dataHash = crypto.createHash('sha256').update(allContentString).digest('hex');

    const backupPayload = {
      manifest,
      data: dumpData,
    };

    const jsonFileName = outputFileName || `p4i_office_backup_${sourceDb}_${timestamp}.json`;
    const jsonFilePath = path.join(backupsDir, jsonFileName);
    fs.writeFileSync(jsonFilePath, JSON.stringify(backupPayload, null, 2), 'utf-8');

    console.log(`[P4I-BACKUP] Backup berhasil disimpan ke: ${jsonFilePath}`);
    console.log(`[P4I-BACKUP] Total baris: ${manifest.totalRows}, SHA-256 Data Hash: ${manifest.dataHash}`);

    return {
      success: true,
      filePath: jsonFilePath,
      manifest,
      data: dumpData,
    };
  } catch (err) {
    console.error('[P4I-BACKUP] Gagal melakukan backup:', err);
    throw err;
  } finally {
    await client.end().catch(() => {});
  }
}

// Support CLI execution
if (process.argv[1] && process.argv[1].endsWith('backup-db.mjs')) {
  const dbArg = process.argv.find((a) => a.startsWith('--db='))?.split('=')[1];
  const outArg = process.argv.find((a) => a.startsWith('--out='))?.split('=')[1];

  backupDatabase(dbArg, outArg)
    .then(() => {
      console.log('[P4I-BACKUP] Proses selesai dengan status SUCCESS.');
      process.exit(0);
    })
    .catch((err) => {
      console.error('[P4I-BACKUP] Proses gagal:', err.message);
      process.exit(1);
    });
}
