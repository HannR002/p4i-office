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
    const staffCookieHeader = staffCookie.split(";")[0];

    // 4. Staf dilarang mengakses endpoint admin /api/users -> 403 Forbidden
    const staffUsersRes = await fetch(`${baseUrl}/api/users`, {
      headers: { Cookie: staffCookieHeader },
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
        Cookie: staffCookieHeader,
      },
      body: JSON.stringify({
        letterTypeId: "type-magang",
        subject: "Surat Keterangan Magang Smoke Test Sprint 2",
        recipientName: "Sdr. Rian Pratama",
        classification: "INTERNAL",
        plannedDate: "2026-10-28",
        content: { bodyText: "Isi draf pengujian smoke test alur persetujuan." },
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
        Cookie: staffCookieHeader,
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
        Cookie: staffCookieHeader,
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
      headers: { Cookie: staffCookieHeader },
    });
    const detailData = await detailRes.json();
    assert(
      "Riwayat revisi memuat kedua versi (v1 dan v2) secara utuh (Immutability)",
      detailRes.status === 200 &&
      detailData.revisions?.length === 2 &&
      detailData.revisions[0].version === 1 &&
      detailData.revisions[1].version === 2
    );

    // 9. Staf mengajukan draf untuk pemeriksaan alur Sprint 2 -> status SUBMITTED / IN_REVIEW
    const submitRes = await fetch(`${baseUrl}/api/letters/${createdLetterId}/submit`, {
      method: "POST",
      headers: { 
        "Content-Type": "application/json",
        Cookie: staffCookieHeader 
      },
      body: JSON.stringify({ notes: "Pengajuan smoke test" }),
    });
    const submitData = await submitRes.json();
    const requestId = submitData.request?.id || submitData.data?.request?.id;
    assert(
      "Draf berhasil diajukan untuk alur persetujuan Sprint 2 (status: SUBMITTED / IN_REVIEW)",
      submitRes.status === 200 && 
      (submitData.letter?.status === "SUBMITTED" || submitData.letter?.status === "IN_REVIEW") &&
      Boolean(requestId)
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

    // 12. Login Akun Reviewer Pejabat -> Sukses (200)
    const reviewerLoginRes = await fetch(`${baseUrl}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "reviewer.test@p4i.local", password: "Password123!" }),
    });
    const reviewerCookie = reviewerLoginRes.headers.get("set-cookie") || "";
    const reviewerCookieHeader = reviewerCookie.split(";")[0];
    assert(
      "Reviewer Pejabat berhasil masuk dan memperoleh sesi",
      reviewerLoginRes.status === 200 && reviewerCookie.includes("p4i_office_session")
    );

    // 13. Reviewer melihat antrean pemeriksaan /api/approvals/pending
    const pendingRes = await fetch(`${baseUrl}/api/approvals/pending`, {
      headers: { Cookie: reviewerCookieHeader },
    });
    const pendingData = await pendingRes.json();
    assert(
      "Reviewer dapat mengakses antrean pemeriksaan (/api/approvals/pending)",
      pendingRes.status === 200 && Array.isArray(pendingData.queue)
    );

    // 14. Mandat Pejabat: Verifikasi endpoint /api/mandates
    const mandatesRes = await fetch(`${baseUrl}/api/mandates`, {
      headers: { Cookie: reviewerCookieHeader },
    });
    const mandatesData = await mandatesRes.json();
    const activeMandate = mandatesData.mandates?.find(m => m.decreeNumber === "SK-P4I/2026/001-TEST" && m.status === "ACTIVE" && m.canApprove);
    assert(
      "Mandat pejabat aktif ditemukan dan tercatat secara sah",
      mandatesRes.status === 200 && Boolean(activeMandate) && activeMandate.decreeNumber === "SK-P4I/2026/001-TEST"
    );

    // 15. Anti Self-Approval: Pembuat draf (staf) mencoba menyetujui suratnya sendiri -> 403 Forbidden
    if (requestId) {
      const selfApproveRes = await fetch(`${baseUrl}/api/approvals/${requestId}/decision`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Cookie: staffCookieHeader,
        },
        body: JSON.stringify({ decision: "APPROVED" }),
      });
      assert(
        "Anti Self-Approval: Pembuat draf ditolak saat mencoba menyetujui suratnya sendiri (403)",
        selfApproveRes.status === 403
      );
    }

    // 16. Keputusan Persetujuan Resmi oleh Reviewer Pejabat -> 200 OK
    if (requestId && activeMandate) {
      const decisionRes = await fetch(`${baseUrl}/api/approvals/${requestId}/decision`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Cookie: reviewerCookieHeader,
        },
        body: JSON.stringify({
          decision: "APPROVED",
          comments: "Disetujui berdasarkan verifikasi smoke test alur Sprint 2.",
          mandateId: activeMandate.id,
        }),
      });
      const decisionData = await decisionRes.json();
      assert(
        "Reviewer pejabat berhasil menyetujui surat (status: APPROVED, officialNumber: null)",
        decisionRes.status === 200 &&
        decisionData.data?.letter?.status === "APPROVED" &&
        decisionData.data?.letter?.officialNumber === null &&
        decisionData.data?.step?.decision === "APPROVED"
      );
    }

    // 17. Verifikasi Riwayat Status Surat (/api/letters/[id]/history)
    const historyRes = await fetch(`${baseUrl}/api/letters/${createdLetterId}/history`, {
      headers: { Cookie: staffCookieHeader },
    });
    const historyData = await historyRes.json();
    assert(
      "Riwayat alur status surat terekam secara kronologis (DRAFT -> SUBMITTED -> APPROVED)",
      historyRes.status === 200 && Array.isArray(historyData.history) && historyData.history.length >= 2
    );

  } catch (err) {
    console.error("[SMOKE-TEST] Error eksekusi smoke test:", err);
    failed++;
  }

  console.log(`\n[SMOKE-TEST] Hasil Akhir: ${passed} LULUS, ${failed} GAGAL`);
  process.exit(failed > 0 ? 1 : 0);
}

runSmokeTests();
