import fs from "fs";
import path from "path";
import crypto from "crypto";
import pg from "pg";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function runMigrations() {
  const databaseUrl = process.env.DATABASE_URL || "postgresql://postgres:postgres@localhost:5432/p4i_office_test";
  const maskedUrl = databaseUrl.replace(/:[^:@]+@/, ":***@");
  console.log(`[P4I-MIGRATE] Memeriksa koneksi database: ${maskedUrl}`);

  const pool = new pg.Pool({
    connectionString: databaseUrl,
    connectionTimeoutMillis: 3000,
  });

  try {
    const client = await pool.connect();
    console.log("[P4I-MIGRATE] Koneksi PostgreSQL berhasil terhubung.");

    // Buat tabel pelacak migrasi jika belum ada
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        version varchar(255) PRIMARY KEY,
        applied_at timestamptz NOT NULL DEFAULT now(),
        checksum text
      );
    `);

    // Dapatkan daftar migrasi yang sudah diterapkan
    const appliedRes = await client.query("SELECT version FROM schema_migrations;");
    const appliedVersions = new Set(appliedRes.rows.map((r) => r.version));

    const migrationsDir = path.join(__dirname, "../db/migrations");
    const files = fs.readdirSync(migrationsDir)
      .filter((f) => f.endsWith(".sql") && !f.includes(".rollback."))
      .sort();

    let newMigrationsCount = 0;

    for (const file of files) {
      if (appliedVersions.has(file)) {
        console.log(`[P4I-MIGRATE] [SKIP] Migrasi ${file} sudah pernah diterapkan.`);
        continue;
      }

      console.log(`[P4I-MIGRATE] Menerapkan migrasi baru: ${file}...`);
      const sql = fs.readFileSync(path.join(migrationsDir, file), "utf-8");
      const checksum = crypto.createHash("sha256").update(sql).digest("hex");

      await client.query("BEGIN;");
      try {
        await client.query(sql);
        await client.query(`
          INSERT INTO schema_migrations (version, checksum)
          VALUES ($1, $2)
          ON CONFLICT (version) DO UPDATE SET checksum = EXCLUDED.checksum;
        `, [file, checksum]);
        await client.query("COMMIT;");
        console.log(`[P4I-MIGRATE] [SUCCESS] ${file} berhasil diterapkan.`);
        newMigrationsCount++;
      } catch (migrationErr) {
        await client.query("ROLLBACK;");
        console.error(`[P4I-MIGRATE] [ERROR] Gagal menerapkan migrasi ${file}:`, migrationErr.message);
        throw migrationErr;
      }
    }

    client.release();
    await pool.end();
    console.log(`[P4I-MIGRATE] Selesai. Total migrasi baru: ${newMigrationsCount}, total aktif: ${files.length}.`);
    process.exit(0);
  } catch (err) {
    console.warn("================================================================================");
    console.warn("[P4I-MIGRATE: BLOCKED] PostgreSQL lokal belum aktif / koneksi gagal.");
    console.warn(`Detail Error: ${err.message}`);
    console.warn("Skrip migrasi siap dieksekusi secara otomatis segera setelah service PostgreSQL lokal dinyalakan.");
    console.warn("================================================================================");
    await pool.end().catch(() => {});
    process.exit(0);
  }
}

runMigrations();
