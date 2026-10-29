import bcrypt from "bcryptjs";
import pg from "pg";

async function runSeedTest() {
  const databaseUrl = process.env.DATABASE_URL || "postgresql://postgres:postgres@localhost:5432/p4i_office_test";
  const maskedUrl = databaseUrl.replace(/:[^:@]+@/, ":***@");
  console.log(`[P4I-SEED] Menghubungkan ke database test: ${maskedUrl}`);

  if (process.env.ALLOW_TEST_SEED !== "true") {
    console.warn("[P4I-SEED: ABORTED] Seeding ditolak karena ALLOW_TEST_SEED != 'true'.");
    return;
  }

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
        ('STAFF', 'Staf Administrasi'),
        ('REVIEWER', 'Pemeriksa Persuratan')
      ON CONFLICT (role_key) DO UPDATE SET label = EXCLUDED.label;
    `);

    // 2. Organization (UUID Deterministik Uji)
    const orgId = "a0000000-0000-4000-8000-000000000001";
    await client.query(`
      INSERT INTO organizations (id, legal_name, acronym, address_placeholder)
      VALUES ($1, 'Yayasan Pusat Pendidikan dan Penelitian Pembangunan Indonesia', 'Yayasan P4I', 'Alamat belum diverifikasi (Sprint 2)')
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
      { id: "e0000000-0000-4000-8000-000000000001", email: "admin.test@p4i.local", name: "Admin Pengujian Sistem", status: "ACTIVE", roles: ["SYSTEM_ADMIN"] },
      { id: "e0000000-0000-4000-8000-000000000002", email: "staf.test@p4i.local", name: "Staf Administrasi Uji", status: "ACTIVE", roles: ["STAFF"] },
      { id: "e0000000-0000-4000-8000-000000000003", email: "disabled.test@p4i.local", name: "Akun Nonaktif Uji", status: "DISABLED", roles: ["STAFF"] },
      { id: "e0000000-0000-4000-8000-000000000004", email: "reviewer.test@p4i.local", name: "Pemeriksa Surat Mandat", status: "ACTIVE", roles: ["STAFF", "REVIEWER"] },
      { id: "e0000000-0000-4000-8000-000000000005", email: "staf2.test@p4i.local", name: "Staf Administrasi Kedua", status: "ACTIVE", roles: ["STAFF"] },
      { id: "e0000000-0000-4000-8000-000000000006", email: "unauthorized.test@p4i.local", name: "Pengguna Tanpa Mandat", status: "ACTIVE", roles: ["STAFF"] },
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

      // Assign roles
      for (const roleKey of u.roles) {
        await client.query(`
          INSERT INTO user_roles (user_id, role_id)
          SELECT $1, r.id FROM roles r WHERE r.role_key = $2
          ON CONFLICT (user_id, role_id) DO NOTHING;
        `, [u.id, roleKey]);
      }
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

    // 7. Signatory & Reviewer Mandates (Simulasi Uji Sprint 2)
    const mandates = [
      {
        id: "f0000000-0000-4000-8000-000000000001",
        userId: "e0000000-0000-4000-8000-000000000004", // reviewer.test
        letterTypeId: null, // Berlaku seluruh jenis surat uji
        canReview: true,
        canApprove: true,
        canSign: false,
        validFrom: "2026-01-01",
        validTo: "2027-12-31",
        status: "ACTIVE",
        decreeNumber: "SK-P4I/2026/001-TEST",
        notes: "Mandat Pemeriksa & Penyetuju Surat Uji Coba Internal (Simulasi Test)",
      },
      {
        id: "f0000000-0000-4000-8000-000000000002",
        userId: "e0000000-0000-4000-8000-000000000005", // staf2.test (expired)
        letterTypeId: null,
        canReview: true,
        canApprove: true,
        canSign: false,
        validFrom: "2025-01-01",
        validTo: "2025-12-31",
        status: "EXPIRED",
        decreeNumber: "SK-P4I/2025/EXPIRED-TEST",
        notes: "Mandat Uji Kadaluwarsa",
      },
      {
        id: "f0000000-0000-4000-8000-000000000003",
        userId: "e0000000-0000-4000-8000-000000000003", // disabled.test (revoked)
        letterTypeId: null,
        canReview: true,
        canApprove: true,
        canSign: false,
        validFrom: "2026-01-01",
        validTo: "2026-12-31",
        status: "REVOKED",
        decreeNumber: "SK-P4I/2026/REVOKED-TEST",
        notes: "Mandat Uji Dicabut",
      },
    ];

    for (const m of mandates) {
      await client.query(`
        INSERT INTO signatory_mandates (
          id, organization_id, user_id, letter_type_id, can_review, can_approve, can_sign,
          valid_from, valid_to, status, decree_number, notes
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8::date, $9::date, $10, $11, $12
        ) ON CONFLICT (id) DO UPDATE SET
          can_review = EXCLUDED.can_review,
          can_approve = EXCLUDED.can_approve,
          valid_from = EXCLUDED.valid_from,
          valid_to = EXCLUDED.valid_to,
          status = EXCLUDED.status,
          decree_number = EXCLUDED.decree_number;
      `, [
        m.id, orgId, m.userId, m.letterTypeId, m.canReview, m.canApprove, m.canSign,
        m.validFrom, m.validTo, m.status, m.decreeNumber, m.notes
      ]);
    }

    await client.query("COMMIT;");
    console.log("[P4I-SEED] Seeding data uji lokal selesai.");
    console.log("[P4I-SEED] Kredensial Uji Lokal:");
    console.log("  - Admin:    admin.test@p4i.local / Password123!");
    console.log("  - Staf:     staf.test@p4i.local / Password123!");
    console.log("  - Reviewer: reviewer.test@p4i.local / Password123! (Mandat Aktif: SK-P4I/2026/001-TEST)");
    console.log("  - Staf 2:   staf2.test@p4i.local / Password123! (Mandat Kadaluwarsa)");
    console.log("  - Disabled: disabled.test@p4i.local / Password123! (Mandat Dicabut)");
    console.log("  - Unauth:   unauthorized.test@p4i.local / Password123! (Tanpa Mandat)");

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
