import pg from "pg";
import bcrypt from "bcryptjs";

async function runSeedTest() {
  if (process.env.NODE_ENV === "production") {
    console.error("[P4I-SEED] DILARANG menjalankan seed test pada lingkungan PRODUCTION!");
    process.exit(1);
  }

  if (process.env.ALLOW_TEST_SEED !== "true") {
    console.error("[P4I-SEED] Flag ALLOW_TEST_SEED tidak aktif. Pembatalan eksekusi demi keamanan.");
    process.exit(1);
  }

  const databaseUrl = process.env.DATABASE_URL || "postgresql://postgres:postgres@localhost:5432/p4i_office_test";
  const maskedUrl = databaseUrl.replace(/:[^:@]+@/, ":***@");
  console.log(`[P4I-SEED] Menghubungkan ke database test: ${maskedUrl}`);

  const pool = new pg.Pool({
    connectionString: databaseUrl,
    connectionTimeoutMillis: 3000,
  });

  try {
    const client = await pool.connect();
    console.log("[P4I-SEED] Memulai seeding data uji (khusus TEST, tanpa nomor fiktif / tanda tangan)...");

    await client.query("BEGIN;");

    // 1. Roles
    await client.query(`
      INSERT INTO roles (role_key, label)
      VALUES 
        ('SYSTEM_ADMIN', 'Administrator Sistem'),
        ('STAFF', 'Staf Administrasi')
      ON CONFLICT (role_key) DO UPDATE SET label = EXCLUDED.label;
    `);

    // 2. Organization (UUID Deterministik Uji)
    const orgId = "a0000000-0000-4000-8000-000000000001";
    await client.query(`
      INSERT INTO organizations (id, legal_name, acronym, address_placeholder)
      VALUES ($1, 'Yayasan Pusat Pendidikan dan Penelitian Pembangunan Indonesia', 'Yayasan P4I', 'Alamat belum diverifikasi (Sprint 1B)')
      ON CONFLICT (id) DO UPDATE SET legal_name = EXCLUDED.legal_name;
    `, [orgId]);

    // 3. Org Unit
    const unitId = "b0000000-0000-4000-8000-000000000001";
    await client.query(`
      INSERT INTO org_units (id, organization_id, name, active)
      VALUES ($1, $2, 'Sekretariat Utama', true)
      ON CONFLICT (organization_id, name) DO UPDATE SET active = EXCLUDED.active;
    `, [unitId, orgId]);

    // 4. Test Users with hashed password and deterministic UUIDs
    const testPassword = "Password123!";
    const passwordHash = await bcrypt.hash(testPassword, 10);

    const users = [
      { id: "e0000000-0000-4000-8000-000000000001", email: "admin.test@p4i.local", name: "Admin Pengujian Sistem", status: "ACTIVE", role: "SYSTEM_ADMIN" },
      { id: "e0000000-0000-4000-8000-000000000002", email: "staf.test@p4i.local", name: "Staf Administrasi Uji", status: "ACTIVE", role: "STAFF" },
      { id: "e0000000-0000-4000-8000-000000000003", email: "disabled.test@p4i.local", name: "Akun Nonaktif Uji", status: "DISABLED", role: "STAFF" },
    ];

    for (const u of users) {
      await client.query(`
        INSERT INTO users (id, organization_id, unit_id, email, display_name, password_hash, status)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        ON CONFLICT (email) DO UPDATE 
        SET display_name = EXCLUDED.display_name,
            password_hash = EXCLUDED.password_hash,
            status = EXCLUDED.status;
      `, [u.id, orgId, unitId, u.email, u.name, passwordHash, u.status]);

      // Assign role
      await client.query(`
        INSERT INTO user_roles (user_id, role_id)
        SELECT $1, r.id FROM roles r WHERE r.role_key = $2
        ON CONFLICT (user_id, role_id) DO NOTHING;
      `, [u.id, u.role]);
    }

    // 5. Numbering Policy (SAFETY: STRICTLY INACTIVE)
    const policyId = "d0000000-0000-4000-8000-000000000001";
    await client.query(`
      INSERT INTO numbering_policies (id, organization_id, series_key, code, is_active, legacy_reconciled)
      VALUES ($1, $2, 'SERI_UMUM', 'P4I', false, false)
      ON CONFLICT (organization_id, series_key) DO NOTHING;
    `, [policyId, orgId]);

    // 6. Letter Types P0 (5 Jenis Surat Utama)
    const types = [
      { id: "c0000000-0000-4000-8000-000000000001", code: "KET-MAGANG", label: "Surat Keterangan Selesai Magang", priority: "P0" },
      { id: "c0000000-0000-4000-8000-000000000002", code: "TUGAS", label: "Surat Tugas", priority: "P0" },
      { id: "c0000000-0000-4000-8000-000000000003", code: "UNDANGAN", label: "Surat Undangan", priority: "P0" },
      { id: "c0000000-0000-4000-8000-000000000004", code: "PERMOHONAN", label: "Surat Permohonan", priority: "P0" },
      { id: "c0000000-0000-4000-8000-000000000005", code: "PENGANTAR", label: "Surat Pengantar", priority: "P0" },
    ];

    for (const t of types) {
      await client.query(`
        INSERT INTO letter_types (id, organization_id, code, label, priority, numbering_policy_id, is_active)
        VALUES ($1, $2, $3, $4, $5, $6, true)
        ON CONFLICT (organization_id, code) DO UPDATE 
        SET label = EXCLUDED.label, priority = EXCLUDED.priority;
      `, [t.id, orgId, t.code, t.label, t.priority, policyId]);
    }

    await client.query("COMMIT;");
    console.log("[P4I-SEED] Seeding data uji lokal selesai.");
    console.log("[P4I-SEED] Kredensial Uji Lokal:");
    console.log("  - Admin: admin.test@p4i.local / Password123!");
    console.log("  - Staf:  staf.test@p4i.local / Password123!");
    console.log("  - Disabled: disabled.test@p4i.local / Password123!");

    client.release();
    await pool.end();
  } catch (err) {
    console.warn("================================================================================");
    console.warn("[P4I-SEED: FAILED] PostgreSQL lokal belum aktif / koneksi gagal.");
    console.warn(`Detail Error: ${err.message}`);
    console.warn("================================================================================");
    await pool.end().catch(() => {});
    process.exit(1);
  }
}

runSeedTest();
