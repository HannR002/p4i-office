import { describe, it, expect } from "vitest";
import { db, getPgPool } from "@/lib/db";
import { UserContext, CreateDraftInput } from "@/lib/db/types";

describe("DB-04: Pengujian Konkurensi Revisi dengan Row-Locking PostgreSQL (SELECT FOR UPDATE)", () => {
  const testStaff: UserContext = {
    id: "e0000000-0000-4000-8000-000000000002",
    displayName: "Staf Tata Usaha",
    email: "staf.test@p4i.local",
    role: "STAFF",
    organizationId: "a0000000-0000-4000-8000-000000000001",
  };

  it("DB-04: beberapa request penambahan revisi simultan pada surat yang sama harus dieksekusi secara atomik tanpa lost update", async () => {
    // 1. Buat draf awal (v1)
    const initialInput: CreateDraftInput = {
      letterTypeId: "c0000000-0000-4000-8000-000000000003", // UNDANGAN
      subject: "Draf Undangan Rapat Koordinasi Konkurensi",
      recipientName: "Para Peneliti",
      classification: "INTERNAL",
      plannedDate: "2026-11-01",
      content: { agenda: "Koordinasi Awal v1" },
    };

    const draft = await db.createDraft(initialInput, testStaff);
    const letterId = draft.letter.id;
    expect(draft.revision.version).toBe(1);

    // 2. Jalankan 4 penambahan revisi secara paralel/simultan
    const concurrentCount = 4;
    const revisionPromises = Array.from({ length: concurrentCount }, (_, i) => {
      const revIndex = i + 1;
      return db.addRevision(
        letterId,
        {
          subject: `Draf Undangan Rapat Koordinasi - Update Simultan #${revIndex}`,
          recipientName: `Para Peneliti Kluster #${revIndex}`,
          classification: "INTERNAL",
          plannedDate: "2026-11-02",
          content: { agenda: `Materi Bahasan Update #${revIndex}`, timestamp: Date.now() },
          changeSummary: `Revisi konkuren #${revIndex}`,
        },
        testStaff
      );
    });

    const results = await Promise.all(revisionPromises);

    // Verifikasi bahwa seluruh 4 panggilan berhasil
    expect(results.length).toBe(concurrentCount);

    // 3. Verifikasi nomor versi yang dihasilkan di PostgreSQL
    const pool = getPgPool();
    const revsRes = await pool.query(
      'SELECT version, subject, change_summary FROM letter_revisions WHERE letter_id = $1 ORDER BY version ASC',
      [letterId]
    );

    // Total revisi harus tepat 1 (awal) + 4 (konkuren) = 5 revisi
    expect(revsRes.rows.length).toBe(5);

    const versions = revsRes.rows.map((r) => r.version);
    expect(versions).toEqual([1, 2, 3, 4, 5]);

    // Verifikasi current_revision_no pada tabel letters terupdate ke versi terakhir (5)
    const letterRes = await pool.query('SELECT current_revision_no FROM letters WHERE id = $1', [letterId]);
    expect(letterRes.rows[0].current_revision_no).toBe(5);

    console.log(
      `[DB-04: PASS] Eksekusi ${concurrentCount} revisi konkuren berhasil dengan urutan versi sempurna: ${versions.join(" -> ")}`
    );
  });
});
