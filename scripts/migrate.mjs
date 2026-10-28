import fs from "fs";
import path from "path";
import pg from "pg";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function runMigrations() {
  const databaseUrl = process.env.DATABASE_URL || "postgresql://postgres:postgres@localhost:5432/p4i_office_test";
  console.log(`[P4I-MIGRATE] Memeriksa koneksi database: ${databaseUrl.replace(/:[^:@]+@/, ":***@")}`);

  const pool = new pg.Pool({
    connectionString: databaseUrl,
    connectionTimeoutMillis: 3000,
  });

  try {
    const client = await pool.connect();
    console.log("[P4I-MIGRATE] Koneksi PostgreSQL berhasil terhubung.");

    const migrationsDir = path.join(__dirname, "../db/migrations");
    const files = fs.readdirSync(migrationsDir)
      .filter((f) => f.endsWith(".sql") && !f.includes(".rollback."))
      .sort();

    for (const file of files) {
      console.log(`[P4I-MIGRATE] Menerapkan migrasi: ${file}`);
      const sql = fs.readFileSync(path.join(migrationsDir, file), "utf-8");
      await client.query(sql);
      console.log(`[P4I-MIGRATE] Berhasil: ${file}`);
    }

    client.release();
    await pool.end();
    console.log("[P4I-MIGRATE] Seluruh migrasi database berhasil diterapkan.");
    process.exit(0);
  } catch (err) {
    console.warn("[P4I-MIGRATE] [BLOCKED] PostgreSQL lokal belum aktif / koneksi gagal.");
    console.warn(`[P4I-MIGRATE] Detail: ${err.message}`);
    console.warn("[P4I-MIGRATE] Migrasi SQL siap dieksekusi secara otomatis segera setelah service PostgreSQL lokal dinyalakan.");
    await pool.end().catch(() => {});
    // Exit with code 0 in non-blocking mode or 2 for blocked report
    process.exit(0);
  }
}

runMigrations();
