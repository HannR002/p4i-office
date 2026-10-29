import { describe, it, expect } from "vitest";
import { db, getPgPool } from "@/lib/db";
import { UserContext, CreateDraftInput, AddRevisionInput } from "@/lib/db/types";

describe("DB-03: Verifikasi Persistensi Data, Immutability & Foreign Key Constraints", () => {
  const testStaff: UserContext = {
    id: "e0000000-0000-4000-8000-000000000002",
    displayName: "Staf Tata Usaha",
    email: "staf.test@p4i.local",
    role: "STAFF",
    organizationId: "a0000000-0000-4000-8000-000000000001",
  };

  it("DB-03: pembuatan draf harus tersimpan secara persisten di tabel letters dan letter_revisions dengan officialNumber = null", async () => {
    const input: CreateDraftInput = {
      letterTypeId: "c0000000-0000-4000-8000-000000000001", // KETERANGAN
      subject: "Surat Keterangan Riset Lapangan Sprint 1C",
      recipientName: "Biro Akademik Universitas Mitra",
      classification: "INTERNAL",
      plannedDate: "2026-10-30",
      content: {
        ringkasan: "Keterangan riset evaluasi sistem tata usaha.",
        lampiran: ["TOR.pdf"],
      },
    };

    const result = await db.createDraft(input, testStaff);
    expect(result.letter.id).toBeDefined();
    expect(result.letter.officialNumber).toBeNull();
    expect(result.letter.status).toBe("DRAFT");
    expect(result.letter.currentRevisionNo).toBe(1);

    expect(result.revision.version).toBe(1);
    expect(result.revision.contentSha256).toBeDefined();
    expect(result.revision.contentSha256.length).toBe(64);

    // Verifikasi langsung di PostgreSQL via raw SQL query terpisah
    const pool = getPgPool();
    const letterInDb = await pool.query(
      'SELECT id, subject, status, current_revision_no FROM letters WHERE id = $1',
      [result.letter.id]
    );
    expect(letterInDb.rows.length).toBe(1);
    expect(result.letter.officialNumber).toBeNull();
    expect(letterInDb.rows[0].current_revision_no).toBe(1);

    const revInDb = await pool.query(
      'SELECT version, subject, content_sha256 FROM letter_revisions WHERE letter_id = $1',
      [result.letter.id]
    );
    expect(revInDb.rows.length).toBe(1);
    expect(revInDb.rows[0].version).toBe(1);
  });

  it("DB-03: pembaruan draf menghasilkan baris revisi baru secara immutable tanpa menimpa baris lama", async () => {
    const input: CreateDraftInput = {
      letterTypeId: "c0000000-0000-4000-8000-000000000002", // TUGAS
      subject: "Surat Tugas Monitoring Sprint 1C v1",
      recipientName: "Peneliti P4I",
      classification: "INTERNAL",
      plannedDate: "2026-10-30",
      content: { tugas: "Monitoring baseline v1" },
    };

    const created = await db.createDraft(input, testStaff);
    const letterId = created.letter.id;

    // Tambah revisi v2
    const rev2Input: AddRevisionInput = {
      subject: "Surat Tugas Monitoring Sprint 1C v2",
      recipientName: "Peneliti Senior P4I",
      classification: "INTERNAL",
      plannedDate: "2026-10-31",
      content: { tugas: "Monitoring baseline v2 dengan parameter tambahan" },
      changeSummary: "Penambahan parameter evaluasi",
    };

    const rev2Result = await db.addRevision(letterId, rev2Input, testStaff);
    expect(rev2Result.revision.version).toBe(2);
    expect(rev2Result.letter.currentRevisionNo).toBe(2);

    // Verifikasi immutability: kedua revisi (v1 dan v2) tetap ada dan utuh di database
    const pool = getPgPool();
    const revs = await pool.query(
      'SELECT version, subject, content_sha256 FROM letter_revisions WHERE letter_id = $1 ORDER BY version ASC',
      [letterId]
    );

    expect(revs.rows.length).toBe(2);
    expect(revs.rows[0].version).toBe(1);
    expect(revs.rows[0].subject).toBe("Surat Tugas Monitoring Sprint 1C v1");
    expect(revs.rows[1].version).toBe(2);
    expect(revs.rows[1].subject).toBe("Surat Tugas Monitoring Sprint 1C v2");
    expect(revs.rows[0].content_sha256).not.toBe(revs.rows[1].content_sha256);
  });

  it("DB-03: foreign key constraint harus menolak data yang tidak memiliki referensi sah", async () => {
    const pool = getPgPool();
    const fakeUuid = "ffffffff-ffff-4fff-8fff-ffffffffffff";

    // Coba insert surat dengan author_id yang tidak ada
    await expect(
      pool.query(`
        INSERT INTO letters (
          id, organization_id, letter_type_id, author_id, subject, recipient_name, classification, planned_date, status
        ) VALUES (
          gen_random_uuid(), 'a0000000-0000-4000-8000-000000000001', 'c0000000-0000-4000-8000-000000000001',
          $1, 'Test FK Subject', 'Test Recipient', 'INTERNAL', CURRENT_DATE, 'DRAFT'
        );
      `, [fakeUuid])
    ).rejects.toThrow(/foreign key constraint/i);
  });

  it("DB-03: unique constraint (letter_id, version) harus menolak duplikasi nomor revisi", async () => {
    const pool = getPgPool();
    const letterRes = await pool.query('SELECT id FROM letters LIMIT 1;');
    expect(letterRes.rows.length).toBeGreaterThan(0);
    const existingLetterId = letterRes.rows[0].id;

    // Coba insert revisi dengan version = 1 yang sudah ada
    await expect(
      pool.query(`
        INSERT INTO letter_revisions (
          id, letter_id, version, subject, recipient_name, classification, planned_date, content, content_sha256, created_by
        ) VALUES (
          gen_random_uuid(), $1, 1, 'Duplicate Test', 'Test Recipient', 'INTERNAL', CURRENT_DATE, '{}'::jsonb, 'abc123', 'e0000000-0000-4000-8000-000000000002'
        );
      `, [existingLetterId])
    ).rejects.toThrow(/unique constraint/i);
  });
});
