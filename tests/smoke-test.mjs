async function runSmokeTests() {
  const baseUrl = "http://localhost:3000";
  console.log(`[SMOKE-TEST] Memulai pengujian smoke test pada ${baseUrl}...`);

  let passed = 0;
  let failed = 0;

  async function assert(desc, condition, details = "") {
    if (condition) {
      console.log(`  ✓ PASS: ${desc}`);
      passed++;
    } else {
      console.error(`  ✗ FAIL: ${desc} - ${details}`);
      failed++;
    }
  }

  try {
    // 1. Healthcheck
    const healthRes = await fetch(`${baseUrl}/api/health`);
    const healthData = await healthRes.json();
    assert(
      "Endpoint Healthcheck aktif dan mengembalikan data",
      healthRes.status === 200 && (healthData.status === "healthy" || healthData.status === "degraded")
    );
    assert(
      "Safety guard: featureNumberingActive bernilai FALSE",
      healthData.safetyGuards?.featureNumberingActive === false
    );
    assert(
      "Healthcheck memuat status database aktual",
      healthData.database && typeof healthData.database.status === "string"
    );

    // 2. Login Akun Nonaktif (DISABLED) -> Harus DITOLAK (403)
    const disabledLoginRes = await fetch(`${baseUrl}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "disabled.test@p4i.local", password: "Password123!" }),
    });
    const disabledData = await disabledLoginRes.json();
    assert(
      "Akun NONAKTIF (DISABLED) ditolak login dengan status 403",
      disabledLoginRes.status === 403 && disabledData.message?.includes("NONAKTIF")
    );

    // 3. Login Akun Staf -> Sukses (200) + Set-Cookie
    const staffLoginRes = await fetch(`${baseUrl}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "staf.test@p4i.local", password: "Password123!" }),
    });
    const staffCookie = staffLoginRes.headers.get("set-cookie") || "";
    const staffData = await staffLoginRes.json();
    assert(
      "Akun Staf berhasil masuk (200) dan memperoleh cookie sesi HttpOnly",
      staffLoginRes.status === 200 && staffData.success === true && staffCookie.includes("p4i_office_session")
    );

    // Extract cookie value for subsequent requests
    const cookieHeader = staffCookie.split(";")[0];

    // 4. Staf dilarang mengakses endpoint admin /api/users -> 403 Forbidden
    const staffUsersRes = await fetch(`${baseUrl}/api/users`, {
      headers: { Cookie: cookieHeader },
    });
    assert(
      "Staf dicegah mengakses endpoint admin /api/users (403 Forbidden)",
      staffUsersRes.status === 403
    );

    // 5. Staf membuat draf surat baru -> 200 OK, officialNumber === null
    const createDraftRes = await fetch(`${baseUrl}/api/letters`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: cookieHeader,
      },
      body: JSON.stringify({
        letterTypeId: "type-magang",
        subject: "Surat Keterangan Magang Smoke Test",
        recipientName: "Sdr. Rian Pratama",
        classification: "INTERNAL",
        plannedDate: "2026-10-28",
        content: { bodyText: "Isi draf pengujian smoke test otomatis." },
      }),
    });
    const createData = await createDraftRes.json();
    const createdLetterId = createData.letter?.id;
    assert(
      "Staf berhasil membuat draf surat baru (status: DRAFT, officialNumber: null)",
      createDraftRes.status === 200 &&
      createData.letter?.status === "DRAFT" &&
      createData.letter?.officialNumber === null &&
      createData.revision?.version === 1
    );

    // 6. Validasi Input: Penolakan input tidak valid (400)
    const invalidInputRes = await fetch(`${baseUrl}/api/letters`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: cookieHeader,
      },
      body: JSON.stringify({
        letterTypeId: "type-magang",
        subject: "A", // Kurang dari 3 karakter
        recipientName: "Sdr. Rian Pratama",
        classification: "INTERNAL",
        plannedDate: "2026-10-28",
        content: {},
      }),
    });
    assert(
      "Input tidak valid (perihal < 3 karakter) ditolak backend dengan status 400",
      invalidInputRes.status === 400
    );

    // 7. Staf menambah revisi ke-2 (v2) -> tidak menimpa v1
    const addRevRes = await fetch(`${baseUrl}/api/letters/${createdLetterId}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: cookieHeader,
      },
      body: JSON.stringify({
        subject: "Surat Keterangan Magang Smoke Test (Revisi 2)",
        recipientName: "Sdr. Rian Pratama",
        classification: "INTERNAL",
        plannedDate: "2026-10-28",
        content: { bodyText: "Isi draf pengujian smoke test dengan klausul tambahan." },
        changeSummary: "Menambahkan klausul evaluasi",
      }),
    });
    const revData = await addRevRes.json();
    assert(
      "Penyuntingan draf melahirkan revisi v2 dengan SHA-256 valid",
      addRevRes.status === 200 &&
      revData.revision?.version === 2 &&
      revData.revision?.contentSha256?.length === 64
    );

    // 8. Verifikasi riwayat revisi (kedua versi ada dan utuh)
    const detailRes = await fetch(`${baseUrl}/api/letters/${createdLetterId}`, {
      headers: { Cookie: cookieHeader },
    });
    const detailData = await detailRes.json();
    assert(
      "Riwayat revisi memuat kedua versi (v1 dan v2) secara utuh (Immutability)",
      detailRes.status === 200 &&
      detailData.revisions?.length === 2 &&
      detailData.revisions[0].version === 1 &&
      detailData.revisions[1].version === 2
    );

    // 9. Staf mengajukan draf untuk pemeriksaan -> status IN_REVIEW
    const submitRes = await fetch(`${baseUrl}/api/letters/${createdLetterId}/submit`, {
      method: "POST",
      headers: { Cookie: cookieHeader },
    });
    const submitData = await submitRes.json();
    assert(
      "Draf berhasil diajukan untuk pemeriksaan (status: IN_REVIEW)",
      submitRes.status === 200 && submitData.letter?.status === "IN_REVIEW"
    );

    // 10. Login Akun Admin -> Sukses (200)
    const adminLoginRes = await fetch(`${baseUrl}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "admin.test@p4i.local", password: "Password123!" }),
    });
    const adminCookie = adminLoginRes.headers.get("set-cookie") || "";
    const adminCookieHeader = adminCookie.split(";")[0];

    // 11. Admin dapat mengakses /api/users
    const adminUsersRes = await fetch(`${baseUrl}/api/users`, {
      headers: { Cookie: adminCookieHeader },
    });
    const usersData = await adminUsersRes.json();
    assert(
      "Admin dapat mengakses daftar pengguna pada /api/users",
      adminUsersRes.status === 200 && Array.isArray(usersData.users) && usersData.users.length >= 3
    );

    // 12. Admin dapat memperbarui status pengguna via PATCH /api/users
    const targetUserId = usersData.users.find((u) => u.email === "disabled.test@p4i.local")?.id;
    if (targetUserId) {
      const patchRes = await fetch(`${baseUrl}/api/users`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Cookie: adminCookieHeader,
        },
        body: JSON.stringify({ userId: targetUserId, status: "ACTIVE" }),
      });
      const patchData = await patchRes.json();
      assert(
        "Admin berhasil mengubah status pengguna (PATCH /api/users)",
        patchRes.status === 200 && patchData.user?.status === "ACTIVE"
      );

      // Kembalikan ke DISABLED
      await fetch(`${baseUrl}/api/users`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Cookie: adminCookieHeader,
        },
        body: JSON.stringify({ userId: targetUserId, status: "DISABLED" }),
      });
    }

  } catch (err) {
    console.error("[SMOKE-TEST] Error eksekusi smoke test:", err);
    failed++;
  }

  console.log(`\n[SMOKE-TEST] Hasil Akhir: ${passed} LULUS, ${failed} GAGAL`);
  process.exit(failed > 0 ? 1 : 0);
}

runSmokeTests();
