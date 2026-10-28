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
  console.log(`[P4I-SEED] Menghubungkan ke database test: ${databaseUrl.replace(/:[^:@]+@/, ":***@")}`);

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

    // 2. Organization
    const orgRes = await client.query(`
      INSERT INTO organizations (legal_name, acronym, address_placeholder)
      VALUES ('Yayasan Pusat Pendidikan dan Penelitian Pembangunan Indonesia', 'Yayasan P4I', 'Alamat belum diverifikasi (Sprint 1A)')
      RETURNING id;
    `);
    const orgId = orgRes.rows[0].id;

    // 3. Org Unit
    const unitRes = await client.query(`
      INSERT INTO org_units (organization_id, name, active)
      VALUES ($1, 'Sekretariat Utama', true)
      ON CONFLICT (organization_id, name) DO UPDATE SET active = EXCLUDED.active
      RETURNING id;
    `, [orgId]);
    const unitId = unitRes.rows[0].id;

    // 4. Test Users with hashed password
    const testPassword = "Password123!";
    const passwordHash = await bcrypt.hash(testPassword, 10);

    const users = [
      { email: "admin.test@p4i.local", name: "Admin Pengujian Sistem", status: "ACTIVE", role: "SYSTEM_ADMIN" },
      { email: "staf.test@p4i.local", name: "Staf Administrasi Uji", status: "ACTIVE", role: "STAFF" },
      { email: "disabled.test@p4i.local", name: "Akun Nonaktif Uji", status: "DISABLED", role: "STAFF" },
    ];

    for (const u of users) {
      const uRes = await client.query(`
        INSERT INTO users (organization_id, unit_id, email, display_name, password_hash, status)
        VALUES ($1, $2, $3, $4, $5, $6)
        ON CONFLICT (email) DO UPDATE 
        SET display_name = EXCLUDED.display_name,
            password_hash = EXCLUDED.password_hash,
            status = EXCLUDED.status
        RETURNING id;
      `, [orgId, unitId, u.email, u.name, passwordHash, u.status]);

      const userId = uRes.rows[0].id;

      // Assign role
      await client.query(`
        INSERT INTO user_roles (user_id, role_id)
        SELECT $1, r.id FROM roles r WHERE r.role_key = $2
        ON CONFLICT (user_id, role_id) DO NOTHING;
      `, [userId, u.role]);
    }

    // 5. Letter Types & Numbering Policy (INACTIVE)
    const policyRes = await client.query(`
      INSERT INTO numbering_policies (organization_id, series_key, code, is_active, legacy_reconciled)
      VALUES ($1, 'SERI_UMUM', 'P4I', false, false)
      ON CONFLICT (organization_id, series_key) DO NOTHING
      RETURNING id;
    `, [orgId]);
    const policyId = policyRes.rows[0]?.id;

    await client.query(`
      INSERT INTO letter_types (organization_id, code, label, numbering_policy_id, is_active)
      VALUES 
        ($1, 'KET-MAGANG', 'Surat Keterangan Selesai Magang', $2, true),
        ($1, 'TUGAS', 'Surat Tugas', $2, true),
        ($1, 'UNDANGAN', 'Surat Undangan', $2, true)
      ON CONFLICT (organization_id, code) DO NOTHING;
    `, [orgId, policyId || null]);

    await client.query("COMMIT;");
    console.log("[P4I-SEED] Seeding data uji lokal selesai.");
    console.log("[P4I-SEED] Kredensial Uji Lokal:");
    console.log("  - Admin: admin.test@p4i.local / Password123!");
    console.log("  - Staf:  staf.test@p4i.local / Password123!");
    console.log("  - Disabled: disabled.test@p4i.local / Password123!");

    client.release();
    await pool.end();
  } catch (err) {
    console.warn("[P4I-SEED] [BLOCKED] PostgreSQL lokal belum aktif / koneksi gagal.");
    console.warn(`[P4I-SEED] Detail: ${err.message}`);
    await pool.end().catch(() => {});
  }
}

runSeedTest();
