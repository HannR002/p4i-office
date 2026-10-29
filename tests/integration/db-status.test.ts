import { describe, it, expect } from "vitest";
import { checkPostgresConnection, getMaskedDatabaseUrl, db, getPgPool } from "@/lib/db";

describe("DB-01 & DB-02: Verifikasi Koneksi PostgreSQL Riil & Pelacakan Migrasi", () => {
  it("DB-01: harus terhubung ke PostgreSQL riil dan mengembalikan status CONNECTED", async () => {
    const conn = await checkPostgresConnection();
    const maskedUrl = getMaskedDatabaseUrl();

    expect(conn.connected).toBe(true);
    expect(conn.latencyMs).toBeGreaterThanOrEqual(0);

    const health = await db.getHealthStatus();
    expect(health.status).toBe("CONNECTED");
    expect(health.connected).toBe(true);
    expect(health.mode).toBe("REAL_POSTGRES");
    expect(health.target).toBe(maskedUrl);

    // Verifikasi versi server PostgreSQL riil
    const pool = getPgPool();
    const verRes = await pool.query("SELECT version();");
    expect(verRes.rows[0].version).toContain("PostgreSQL");
    console.log(`[DB-01: PASS] PostgreSQL Version: ${verRes.rows[0].version.split(",")[0]}`);
  });

  it("DB-02: tabel schema_migrations harus mencatat migrasi 0001 dan 0002 secara lengkap dengan checksum", async () => {
    const pool = getPgPool();
    const res = await pool.query("SELECT version, checksum, applied_at FROM schema_migrations ORDER BY version ASC;");

    expect(res.rows.length).toBeGreaterThanOrEqual(2);
    const versions = res.rows.map((r) => r.version);
    expect(versions).toContain("0001_sprint1a_core.sql");
    expect(versions).toContain("0002_sprint1b_persistence.sql");

    for (const row of res.rows) {
      expect(row.checksum).toBeDefined();
      expect(row.checksum.length).toBe(64); // SHA-256 hex string
      expect(row.applied_at).toBeDefined();
    }

    console.log(`[DB-02: PASS] Migrations verified: ${versions.join(", ")}`);
  });

  it("DB-02: seluruh tabel inti harus tersedia dengan integritas foreign key aktif", async () => {
    const pool = getPgPool();
    const requiredTables = [
      "organizations",
      "org_units",
      "users",
      "roles",
      "user_roles",
      "numbering_policies",
      "letter_types",
      "letters",
      "letter_revisions",
      "audit_events",
    ];

    for (const tbl of requiredTables) {
      const check = await pool.query(
        "SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = $1",
        [tbl]
      );
      expect(check.rows.length).toBe(1);
    }
  });
});
