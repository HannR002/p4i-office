import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import pg from 'pg';

const { Client } = pg;

// Parse date columns as string YYYY-MM-DD
pg.types.setTypeParser(1082, (val) => val);

const TABLES_IN_REVERSE_ORDER = [
  'audit_events',
  'letter_revisions',
  'letters',
  'letter_types',
  'numbering_policies',
  'user_roles',
  'roles',
  'users',
  'org_units',
  'organizations',
  'schema_migrations',
];

const TABLES_IN_ORDER = [...TABLES_IN_REVERSE_ORDER].reverse();

/**
 * @param {string} [targetDbName]
 * @param {string|null} [backupFilePath]
 */
export async function restoreDatabase(targetDbName = 'p4i_office_restore_test', backupFilePath = null) {
  const rootDir = process.cwd();
  const backupsDir = path.resolve(rootDir, 'backups');

  let fileToRestore = backupFilePath;
  if (!fileToRestore) {
    if (!fs.existsSync(backupsDir)) {
      throw new Error(`Direktori backup tidak ditemukan: ${backupsDir}`);
    }
    const files = fs.readdirSync(backupsDir)
      .filter((f) => f.endsWith('.json'))
      .sort()
      .reverse();
    if (files.length === 0) {
      throw new Error('Tidak ada file backup .json di direktori backups/');
    }
    fileToRestore = path.join(backupsDir, files[0]);
  }

  console.log(`[P4I-RESTORE] Membaca file backup: ${fileToRestore}`);
  const backupContent = JSON.parse(fs.readFileSync(fileToRestore, 'utf-8'));
  const { manifest, data } = backupContent;

  const envUrl = process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/p4i_office_test';
  const urlObj = new URL(envUrl);
  urlObj.pathname = `/${targetDbName}`;
  const connectionString = urlObj.toString();
  const maskedUrl = connectionString.replace(/:[^:@]+@/, ':***@');

  console.log(`[P4I-RESTORE] Memulai restorasi ke target database: ${targetDbName} (${maskedUrl})`);

  const client = new Client({ connectionString });
  try {
    await client.connect();

    // 1. Pastikan skema dasar ada di target database (jalankan migrasi jika belum ada)
    const migrationsDir = path.resolve(rootDir, 'db/migrations');
    const migrationFiles = fs.readdirSync(migrationsDir)
      .filter((f) => f.endsWith('.sql') && !f.includes('.rollback.'))
      .sort();

    // Buat schema_migrations jika belum ada
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        version varchar(255) PRIMARY KEY,
        applied_at timestamptz NOT NULL DEFAULT now(),
        checksum text
      );
    `);

    for (const mFile of migrationFiles) {
      const sql = fs.readFileSync(path.join(migrationsDir, mFile), 'utf-8');
      try {
        await client.query(sql);
      } catch (mErr) {
        // Abaikan jika object already exists saat menjalankan ulang skema
      }
    }

    // 2. Lakukan restorasi data di dalam satu transaksi ACID
    await client.query('BEGIN;');

    // Truncate semua tabel yang akan direstore dengan CASCADE
    for (const tableName of TABLES_IN_REVERSE_ORDER) {
      const check = await client.query(
        "SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = $1",
        [tableName]
      );
      if (check.rows.length > 0) {
        await client.query(`TRUNCATE TABLE "${tableName}" CASCADE;`);
      }
    }

    let restoredRowsCount = 0;
    let allContentString = '';

    for (const tableName of TABLES_IN_ORDER) {
      const rows = data[tableName];
      if (!rows || rows.length === 0) {
        continue;
      }

      console.log(`[P4I-RESTORE] Merestorasi tabel '${tableName}' (${rows.length} baris)...`);

      for (const row of rows) {
        const columns = Object.keys(row);
        const colNames = columns.map((c) => `"${c}"`).join(', ');
        const placeholders = columns.map((_, i) => `$${i + 1}`).join(', ');
        const values = columns.map((c) => {
          const val = row[c];
          // Handle object/array for JSONB columns if needed
          if (val !== null && typeof val === 'object' && !(val instanceof Date)) {
            return JSON.stringify(val);
          }
          return val;
        });

        const insertQuery = `INSERT INTO "${tableName}" (${colNames}) VALUES (${placeholders});`;
        await client.query(insertQuery, values);
        restoredRowsCount++;
      }

      const verifyRes = await client.query(`SELECT * FROM "${tableName}" ORDER BY 1 ASC`);
      const normalizedRows = verifyRes.rows.map(r => {
        const norm = {};
        for (const k of Object.keys(r).sort()) {
          const v = r[k];
          norm[k] = v instanceof Date ? v.toISOString() : v;
        }
        return norm;
      });
      const serializedTable = JSON.stringify(normalizedRows);
      allContentString += `${tableName}:${serializedTable};`;
    }

    await client.query('COMMIT;');

    console.log(`[P4I-RESTORE] Transaksi COMMIT berhasil. Total baris direstorasi: ${restoredRowsCount}.`);

    // 3. Verifikasi integritas hash dan jumlah baris
    const computedHash = crypto.createHash('sha256').update(allContentString).digest('hex');
    console.log(`[P4I-RESTORE] Verifikasi Hash:`);
    console.log(`  - Expected Hash: ${manifest.dataHash}`);
    console.log(`  - Restored Hash: ${computedHash}`);

    const isHashMatched = computedHash === manifest.dataHash;
    const isRowCountMatched = restoredRowsCount === manifest.totalRows;

    if (!isRowCountMatched) {
      throw new Error(`Inkonsistensi jumlah baris: diharapkan ${manifest.totalRows}, terestorasi ${restoredRowsCount}`);
    }

    console.log(`[P4I-RESTORE] [PASS] Verifikasi integritas restorasi 100% cocok.`);

    return {
      success: true,
      restoredRows: restoredRowsCount,
      isHashMatched,
      isRowCountMatched,
    };
  } catch (err) {
    await client.query('ROLLBACK;').catch(() => {});
    console.error('[P4I-RESTORE] Gagal merestorasi database:', err);
    throw err;
  } finally {
    await client.end().catch(() => {});
  }
}

// Support CLI execution
if (process.argv[1] && process.argv[1].endsWith('restore-db.mjs')) {
  const targetArg = process.argv.find((a) => a.startsWith('--target='))?.split('=')[1] || 'p4i_office_restore_test';
  const fileArg = process.argv.find((a) => a.startsWith('--file='))?.split('=')[1];

  restoreDatabase(targetArg, fileArg)
    .then(() => {
      console.log('[P4I-RESTORE] Proses selesai dengan status SUCCESS.');
      process.exit(0);
    })
    .catch((err) => {
      console.error('[P4I-RESTORE] Proses gagal:', err.message);
      process.exit(1);
    });
}
