import { describe, it, expect } from "vitest";
import { db, getPgPool } from "@/lib/db";
import { UserContext } from "@/lib/db/types";

describe("AP-07: Uji Konkurensi Keputusan Persetujuan (Concurrent Decision Race Condition)", () => {
  const orgId = "a0000000-0000-4000-8000-000000000001";
  const letterTypeId = "c0000000-0000-4000-8000-000000000001";

  const authorStaff: UserContext = {
    id: "e0000000-0000-4000-8000-000000000002",
    displayName: "Staf Administrasi (Uji)",
    email: "staf.test@p4i.local",
    role: "STAFF",
    organizationId: orgId,
  };

  const reviewer1: UserContext = {
    id: "e0000000-0000-4000-8000-000000000004",
    displayName: "Reviewer Pejabat 1",
    email: "reviewer.test@p4i.local",
    role: "REVIEWER",
    organizationId: orgId,
  };

  // Reviewer 2 menggunakan admin yang juga memiliki hak mandat
  const reviewer2: UserContext = {
    id: "e0000000-0000-4000-8000-000000000001",
    displayName: "Admin Reviewer 2",
    email: "admin.test@p4i.local",
    role: "SYSTEM_ADMIN",
    organizationId: orgId,
  };

  it("AP-07: Dua keputusan simultan pada permintaan yang sama wajib ditangani atomik (1 menang, 1 gagal aman)", async () => {
    // 1. Pastikan reviewer2 memiliki mandat aktif untuk tes ini
    const pool = getPgPool();
    await pool.query(`
      INSERT INTO signatory_mandates (
        id, organization_id, user_id, can_review, can_approve, can_sign,
        valid_from, valid_to, status, decree_number, notes
      ) VALUES (
        'f0000000-0000-4000-8000-000000000099', $1, $2, true, true, false,
        '2026-01-01', '2026-12-31', 'ACTIVE', 'SK-P4I/2026/099-ADMIN', 'Mandat admin untuk uji konkurensi'
      ) ON CONFLICT (id) DO NOTHING;
    `, [orgId, reviewer2.id]);

    // 2. Buat dan ajukan draf surat
    const { letter: draft } = await db.createDraft({
      letterTypeId,
      subject: "Draf Uji Konkurensi Persetujuan AP-07",
      recipientName: "Mitra Riset Konkuren",
      classification: "INTERNAL",
      plannedDate: "2026-11-07",
      content: { bodyText: "Uji balapan persetujuan simultan." },
    }, authorStaff);

    const submit = await db.submitForApproval(draft.id, authorStaff, "Pengajuan untuk uji race condition");
    const requestId = submit.request.id;

    // 3. Jalankan dua keputusan secara paralel simultan melalui Promise.allSettled
    const results = await Promise.allSettled([
      db.decideApproval(requestId, reviewer1, {
        decision: "APPROVED",
        comments: "Keputusan oleh reviewer 1",
      }),
      db.decideApproval(requestId, reviewer2, {
        decision: "CHANGES_REQUESTED",
        comments: "Keputusan perubahan oleh reviewer 2",
      }),
    ]);

    const fulfilled = results.filter(r => r.status === "fulfilled");
    const rejected = results.filter(r => r.status === "rejected");

    // Persis SATU transaksi harus berhasil, dan SATU transaksi lainnya harus ditolak
    expect(fulfilled.length).toBe(1);
    expect(rejected.length).toBe(1);

    // Verifikasi pesan penolakan pada transaksi yang kalah balapan
    const failedReason = (rejected[0] as PromiseRejectedResult).reason;
    expect(failedReason.message).toMatch(/(sudah selesai diproses|tidak ditemukan)/);

    // Verifikasi di database: hanya ada persis 1 langkah keputusan
    const stepsInDb = await pool.query(
      "SELECT count(*)::int AS count FROM approval_steps WHERE approval_request_id = $1",
      [requestId]
    );
    expect(stepsInDb.rows[0].count).toBe(1);

    // Verifikasi status surat konsisten dengan keputusan yang menang
    const winningDecision = (fulfilled[0] as PromiseFulfilledResult<{ letter: { status: string } }>).value.letter.status;
    const letterInDb = await pool.query("SELECT status FROM letters WHERE id = $1", [draft.id]);
    expect(letterInDb.rows[0].status).toBe(winningDecision);
  });
});
