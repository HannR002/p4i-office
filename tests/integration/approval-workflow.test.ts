import { describe, it, expect } from "vitest";
import { db, getPgPool } from "@/lib/db";
import { UserContext, CreateDraftInput, AddRevisionInput } from "@/lib/db/types";

describe("Sprint 2: Letter Approval Workflow & Authority Management Gates (AP-01 s.d. AP-14)", () => {
  const orgId = "a0000000-0000-4000-8000-000000000001";
  const letterTypeId = "c0000000-0000-4000-8000-000000000001"; // KET-MAGANG

  const authorStaff: UserContext = {
    id: "e0000000-0000-4000-8000-000000000002",
    displayName: "Staf Administrasi (Uji)",
    email: "staf.test@p4i.local",
    role: "STAFF",
    organizationId: orgId,
  };

  const reviewerUser: UserContext = {
    id: "e0000000-0000-4000-8000-000000000004",
    displayName: "Reviewer Pejabat (Uji)",
    email: "reviewer.test@p4i.local",
    role: "REVIEWER",
    organizationId: orgId,
  };

  const unauthorizedUser: UserContext = {
    id: "e0000000-0000-4000-8000-000000000006",
    displayName: "Pengguna Tanpa Mandat (Uji)",
    email: "unauthorized.test@p4i.local",
    role: "STAFF",
    organizationId: orgId,
  };

  const activeMandateId = "f0000000-0000-4000-8000-000000000001";
  const expiredMandateId = "f0000000-0000-4000-8000-000000000002";
  const revokedMandateId = "f0000000-0000-4000-8000-000000000003";

  it("AP-01: Happy Path Alur Lengkap: DRAFT → SUBMITTED → APPROVED dengan pengikatan hash dan SK Mandat", async () => {
    // 1. Buat draf
    const { letter: draft, revision: rev1 } = await db.createDraft({
      letterTypeId,
      subject: "Draf Pengujian Happy Path AP-01",
      recipientName: "Universitas Indonesia",
      classification: "INTERNAL",
      plannedDate: "2026-11-01",
      content: { bodyText: "Isi draf pengujian alur persetujuan lengkap." },
    }, authorStaff);

    expect(draft.status).toBe("DRAFT");
    expect(draft.officialNumber).toBeNull();

    // 2. Ajukan draf
    const submitRes = await db.submitForApproval(draft.id, authorStaff, "Pengajuan draf pertama");
    expect(submitRes.letter.status).toBe("SUBMITTED");
    expect(submitRes.request.status).toBe("PENDING");
    expect(submitRes.request.revisionVersion).toBe(1);
    expect(submitRes.request.contentSha256).toBe(rev1.contentSha256);

    // 3. Reviewer menyetujui
    const decisionRes = await db.decideApproval(submitRes.request.id, reviewerUser, {
      decision: "APPROVED",
      comments: "Draf telah sesuai dengan ketentuan internal P4I.",
      mandateId: activeMandateId,
    });

    expect(decisionRes.letter.status).toBe("APPROVED");
    expect(decisionRes.letter.officialNumber).toBeNull(); // AP-14: Tetap null!
    expect(decisionRes.step.decision).toBe("APPROVED");
    expect(decisionRes.step.decisionContentSha256).toBe(rev1.contentSha256);
    expect(decisionRes.step.decreeNumber).toBe("SK-P4I/2026/001-TEST");

    // Verifikasi persistensi di database
    const pool = getPgPool();
    const lRes = await pool.query("SELECT status FROM letters WHERE id = $1", [draft.id]);
    expect(lRes.rows[0].status).toBe("APPROVED");

    const stepRes = await pool.query("SELECT decision, decision_content_sha256 FROM approval_steps WHERE approval_request_id = $1", [submitRes.request.id]);
    expect(stepRes.rows[0].decision).toBe("APPROVED");
    expect(stepRes.rows[0].decision_content_sha256).toBe(rev1.contentSha256);
  });

  it("AP-02: Alur Perbaikan Draf: DRAFT → SUBMITTED → CHANGES_REQUESTED → DRAFT → SUBMITTED → APPROVED", async () => {
    // 1. Buat draf awal
    const { letter: draft } = await db.createDraft({
      letterTypeId,
      subject: "Draf Uji Perbaikan AP-02",
      recipientName: "Kementerian Pendidikan",
      classification: "INTERNAL",
      plannedDate: "2026-11-02",
      content: { bodyText: "Versi 1 sebelum diminta perbaikan." },
    }, authorStaff);

    // 2. Submit v1
    const submit1 = await db.submitForApproval(draft.id, authorStaff, "Mohon review awal");
    expect(submit1.letter.status).toBe("SUBMITTED");

    // 3. Reviewer meminta perbaikan
    const reqChanges = await db.decideApproval(submit1.request.id, reviewerUser, {
      decision: "CHANGES_REQUESTED",
      comments: "Mohon tambahkan daftar nama mahasiswa penerima magang.",
    });
    expect(reqChanges.letter.status).toBe("CHANGES_REQUESTED");

    // 4. Author menyimpan revisi baru v2 -> Status harus otomatis kembali ke DRAFT
    const { letter: revisedLetter, revision: rev2 } = await db.addRevision(draft.id, {
      subject: "Draf Uji Perbaikan AP-02 (Revisi)",
      recipientName: "Kementerian Pendidikan",
      classification: "INTERNAL",
      plannedDate: "2026-11-02",
      content: { bodyText: "Versi 2 dengan lampiran daftar mahasiswa." },
      changeSummary: "Menambahkan lampiran daftar mahasiswa sesuai arahan reviewer",
    }, authorStaff);

    expect(revisedLetter.status).toBe("DRAFT");
    expect(revisedLetter.currentRevisionNo).toBe(2);

    // 5. Submit ulang v2
    const submit2 = await db.submitForApproval(draft.id, authorStaff, "Pengajuan revisi v2");
    expect(submit2.letter.status).toBe("SUBMITTED");
    expect(submit2.request.revisionVersion).toBe(2);
    expect(submit2.request.contentSha256).toBe(rev2.contentSha256);

    // 6. Reviewer menyetujui v2
    const finalApproval = await db.decideApproval(submit2.request.id, reviewerUser, {
      decision: "APPROVED",
      comments: "Revisi v2 telah lengkap dan disetujui.",
      mandateId: activeMandateId,
    });
    expect(finalApproval.letter.status).toBe("APPROVED");
  });

  it("AP-03: Alur Penolakan: DRAFT → SUBMITTED → REJECTED, status terkunci dari penyuntingan lanjutan", async () => {
    // 1. Buat draf
    const { letter: draft } = await db.createDraft({
      letterTypeId,
      subject: "Draf Uji Penolakan AP-03",
      recipientName: "Instansi Eksternal",
      classification: "INTERNAL",
      plannedDate: "2026-11-03",
      content: { bodyText: "Draf yang akan ditolak reviewer." },
    }, authorStaff);

    // 2. Submit
    const submit = await db.submitForApproval(draft.id, authorStaff);

    // 3. Reviewer menolak
    const reject = await db.decideApproval(submit.request.id, reviewerUser, {
      decision: "REJECTED",
      comments: "Format dan usulan surat tidak sesuai dengan program kerja Yayasan.",
    });
    expect(reject.letter.status).toBe("REJECTED");

    // 4. Draf berstatus REJECTED tidak dapat disunting kembali
    await expect(
      db.addRevision(draft.id, {
        subject: "Mencoba edit setelah ditolak",
        recipientName: "Instansi Eksternal",
        classification: "INTERNAL",
        plannedDate: "2026-11-03",
        content: { bodyText: "Isi baru" },
      }, authorStaff)
    ).rejects.toThrow("tidak dapat disunting");
  });

  it("AP-04: Aturan Pemisahan Tugas (Anti Self-Approval): Pembuat draf dilarang menyetujui suratnya sendiri", async () => {
    // Buat draf oleh reviewerUser itu sendiri
    const { letter: draft } = await db.createDraft({
      letterTypeId,
      subject: "Draf Sendiri oleh Reviewer",
      recipientName: "Rekan Riset",
      classification: "INTERNAL",
      plannedDate: "2026-11-04",
      content: { bodyText: "Surat yang dibuat oleh reviewer." },
    }, reviewerUser);

    const submit = await db.submitForApproval(draft.id, reviewerUser);

    // Reviewer mencoba menyetujui surat buatannya sendiri -> HARUS DITOLAK
    await expect(
      db.decideApproval(submit.request.id, reviewerUser, {
        decision: "APPROVED",
        comments: "Mencoba menyetujui sendiri",
      })
    ).rejects.toThrow("Anti Self-Approval");
  });

  it("AP-05: Pengecekan Mandat Pejabat: Reviewer tanpa mandat aktif yang sah ditolak sistem", async () => {
    const { letter: draft } = await db.createDraft({
      letterTypeId,
      subject: "Draf Uji Mandat AP-05",
      recipientName: "Pihak Ketiga",
      classification: "INTERNAL",
      plannedDate: "2026-11-05",
      content: { bodyText: "Uji keabsahan mandat." },
    }, authorStaff);

    const submit = await db.submitForApproval(draft.id, authorStaff);

    // Kasus 1: Pengguna tanpa mandat sama sekali
    await expect(
      db.decideApproval(submit.request.id, unauthorizedUser, {
        decision: "APPROVED",
        comments: "Pengguna tanpa mandat",
      })
    ).rejects.toThrow("mandat");

    // Kasus 2: Menggunakan mandat yang sudah kadaluarsa (EXPIRED)
    await expect(
      db.decideApproval(submit.request.id, reviewerUser, {
        decision: "APPROVED",
        comments: "Mencoba pakai mandat kadaluarsa",
        mandateId: expiredMandateId,
      })
    ).rejects.toThrow("kadaluarsa");

    // Kasus 3: Menggunakan mandat yang telah dicabut (REVOKED)
    await expect(
      db.decideApproval(submit.request.id, reviewerUser, {
        decision: "APPROVED",
        comments: "Mencoba pakai mandat dicabut",
        mandateId: revokedMandateId,
      })
    ).rejects.toThrow("mandat");
  });

  it("AP-06: Pencegahan Persetujuan Basi (Anti-Stale Approval): Penolakan jika versi draf bertambah setelah diajukan", async () => {
    const { letter: draft } = await db.createDraft({
      letterTypeId,
      subject: "Draf Uji Anti-Stale AP-06",
      recipientName: "Mitra Riset",
      classification: "INTERNAL",
      plannedDate: "2026-11-06",
      content: { bodyText: "Versi 1 diajukan." },
    }, authorStaff);

    const submit = await db.submitForApproval(draft.id, authorStaff);

    // Secara sengaja menyisipkan revisi baru di tabel (simulasi stale / desinkronisasi)
    const pool = getPgPool();
    await pool.query("UPDATE letters SET current_revision_no = 2 WHERE id = $1;", [draft.id]);
    await pool.query(`
      INSERT INTO letter_revisions (
        id, letter_id, version, subject, recipient_name, classification, planned_date,
        content, content_sha256, change_summary, created_by, created_at
      ) VALUES (
        gen_random_uuid(), $1, 2, 'Revisi Terselubung', 'Mitra Riset', 'INTERNAL', '2026-11-06',
        '{}'::jsonb, '1111111111111111111111111111111111111111111111111111111111111111',
        'Revisi tak terdaftar', $2, now()
      );
    `, [draft.id, authorStaff.id]);

    // Reviewer memutuskan approval request lama (yang mengikat v1) -> HARUS DITOLAK STALE
    await expect(
      db.decideApproval(submit.request.id, reviewerUser, {
        decision: "APPROVED",
        comments: "Mencoba approve request yang sudah stale",
      })
    ).rejects.toThrow("stale approval");
  });

  it("AP-08: Catatan Wajib: Penolakan atau perubahan tanpa komentar (< 5 karakter) ditolak sistem", async () => {
    const { letter: draft } = await db.createDraft({
      letterTypeId,
      subject: "Draf Uji Catatan Wajib AP-08",
      recipientName: "Mitra Kerjasama",
      classification: "INTERNAL",
      plannedDate: "2026-11-08",
      content: { bodyText: "Uji komentar wajib." },
    }, authorStaff);

    const submit = await db.submitForApproval(draft.id, authorStaff);

    // Komentar kosong pada CHANGES_REQUESTED
    await expect(
      db.decideApproval(submit.request.id, reviewerUser, {
        decision: "CHANGES_REQUESTED",
        comments: "",
      })
    ).rejects.toThrow("wajib diisi");

    // Komentar terlalu pendek (< 5 karakter) pada REJECTED
    await expect(
      db.decideApproval(submit.request.id, reviewerUser, {
        decision: "REJECTED",
        comments: "No",
      })
    ).rejects.toThrow("wajib diisi");
  });

  it("AP-10: Integritas Riwayat Transisi: Seluruh perubahan terekam di letter_status_history", async () => {
    const { letter: draft } = await db.createDraft({
      letterTypeId,
      subject: "Draf Uji Audit History AP-10",
      recipientName: "Auditor P4I",
      classification: "INTERNAL",
      plannedDate: "2026-11-10",
      content: { bodyText: "Uji pencatatan riwayat." },
    }, authorStaff);

    await db.submitForApproval(draft.id, authorStaff, "Catatan pengajuan audit");

    const history = await db.getLetterHistory(draft.id, orgId);
    expect(history.length).toBeGreaterThanOrEqual(2); // DRAFT (initial) + SUBMITTED

    const submitStep = history.find(h => h.toStatus === "SUBMITTED");
    expect(submitStep).toBeDefined();
    expect(submitStep?.fromStatus).toBe("DRAFT");
    expect(submitStep?.actorId).toBe(authorStaff.id);
  });

  it("AP-12: Pengujian Mandat Spesifik Jenis Surat: Mandat untuk jenis surat tertentu ditolak jika digunakan untuk jenis surat lain", async () => {
    const pool = getPgPool();
    // Buat mandat khusus untuk jenis surat UNDANGAN (c0000000-0000-4000-8000-000000000003)
    const specificTypeId = "c0000000-0000-4000-8000-000000000003";
    const specificMandateId = "f0000000-0000-4000-8000-000000000055";

    await pool.query(`
      INSERT INTO signatory_mandates (
        id, organization_id, user_id, letter_type_id, can_review, can_approve, can_sign,
        valid_from, valid_to, status, decree_number, notes
      ) VALUES (
        $1, $2, $3, $4, true, true, false,
        '2026-01-01', '2026-12-31', 'ACTIVE', 'SK-P4I/2026/055-SPECIFIC', 'Mandat khusus surat undangan'
      ) ON CONFLICT (id) DO UPDATE SET letter_type_id = $4;
    `, [specificMandateId, orgId, reviewerUser.id, specificTypeId]);

    // Buat draf dengan jenis surat KET-MAGANG (berbeda dengan surat undangan)
    const { letter: draft } = await db.createDraft({
      letterTypeId, // KET-MAGANG
      subject: "Draf Uji Scope Mandat AP-12",
      recipientName: "Mitra Magang",
      classification: "INTERNAL",
      plannedDate: "2026-11-12",
      content: { bodyText: "Uji batasan scope mandat." },
    }, authorStaff);

    const submit = await db.submitForApproval(draft.id, authorStaff);

    // Mencoba menyetujui surat KET-MAGANG menggunakan mandat khusus surat UNDANGAN -> DITOLAK
    await expect(
      db.decideApproval(submit.request.id, reviewerUser, {
        decision: "APPROVED",
        comments: "Mencoba bypass scope jenis surat",
        mandateId: specificMandateId,
      })
    ).rejects.toThrow("mencakup jenis surat ini");
  });

  it("AP-14: Penomoran Resmi Tetap Nonaktif: officialNumber tetap null dan allocateOfficialNumber() diblokir", async () => {
    const { letter: draft } = await db.createDraft({
      letterTypeId,
      subject: "Draf Uji Lock Nomor AP-14",
      recipientName: "Pengurus P4I",
      classification: "INTERNAL",
      plannedDate: "2026-11-14",
      content: { bodyText: "Uji penomoran dinonaktifkan." },
    }, authorStaff);

    const submit = await db.submitForApproval(draft.id, authorStaff);
    const approved = await db.decideApproval(submit.request.id, reviewerUser, {
      decision: "APPROVED",
      comments: "Disetujui tanpa penomoran resmi",
    });

    expect(approved.letter.officialNumber).toBeNull();

    // Pemanggilan langsung metode allocateOfficialNumber wajib melempar error BLOCKED
    expect(() => db.allocateOfficialNumber()).toThrow("BLOCKED: Penomoran surat resmi");
  });
});
