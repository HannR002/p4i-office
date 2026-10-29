import { describe, it, expect } from "vitest";
import { db, UserContext } from "@/lib/db";

describe("Logika Draf Surat & Immutability Revisi (Letters & Revisions)", () => {
  const author: UserContext = {
    id: "e0000000-0000-4000-8000-000000000002",
    name: "Staf Administrasi (Uji)",
    role: "STAFF",
    organizationId: "a0000000-0000-4000-8000-000000000001",
  };

  it("staf dapat membuat draf surat baru tanpa nomor resmi", async () => {
    const { letter, revision } = await db.createDraft(
      {
        letterTypeId: "type-magang",
        subject: "Surat Keterangan Magang Sdr. Ahmad",
        recipientName: "Sdr. Ahmad",
        classification: "INTERNAL",
        plannedDate: "2026-10-28",
        content: { bodyText: "Telah menyelesaikan magang riset selama 3 bulan." },
      },
      author
    );

    expect(letter.id).toBeDefined();
    expect(letter.status).toBe("DRAFT");
    expect(letter.currentRevisionNo).toBe(1);
    // SYARAT KUNCI SPRINT 1B: Tidak ada nomor surat resmi
    expect(letter.officialNumber).toBeNull();

    expect(revision.version).toBe(1);
    expect(revision.contentSha256).toHaveLength(64);
    expect(revision.changeSummary).toContain("v1");
  });

  it("penyuntingan draf menghasilkan revisi baru (v2) tanpa menimpa revisi lama (v1)", async () => {
    const { letter: initialLetter, revision: rev1 } = await db.createDraft(
      {
        letterTypeId: "type-tugas",
        subject: "Surat Tugas Lapangan Tim Survei",
        recipientName: "Tim Survei Lapangan",
        classification: "INTERNAL",
        plannedDate: "2026-10-28",
        content: { bodyText: "Penugasan survei awal di wilayah Jawa Barat." },
      },
      author
    );

    const hashV1Before = rev1.contentSha256;

    // Tambah revisi baru (v2)
    const { letter: updatedLetter, revision: rev2 } = await db.addRevision(
      initialLetter.id,
      {
        subject: "Surat Tugas Lapangan Tim Survei (Revisi Lokasi)",
        recipientName: "Tim Survei Lapangan & Pengawas",
        classification: "INTERNAL",
        plannedDate: "2026-10-29",
        content: { bodyText: "Penugasan survei awal di wilayah Jawa Barat dan Banten." },
        changeSummary: "Menambahkan wilayah Banten dan memperbarui nama penerima",
      },
      author
    );

    expect(updatedLetter.currentRevisionNo).toBe(2);
    expect(rev2.version).toBe(2);
    expect(rev2.contentSha256).not.toBe(hashV1Before);

    // Ambil seluruh riwayat revisi
    const allRevisions = await db.getLetterRevisions(initialLetter.id);
    expect(allRevisions).toHaveLength(2);

    // BUKTI IMMUTABILITY: Revisi v1 tetap utuh dengan hash aslinya
    const v1Stored = allRevisions.find((r) => r.version === 1);
    expect(v1Stored).toBeDefined();
    expect(v1Stored?.contentSha256).toBe(hashV1Before);
    expect(v1Stored?.subject).toBe("Surat Tugas Lapangan Tim Survei");
  });

  it("staf dapat mengajukan draf untuk pemeriksaan (status menjadi IN_REVIEW)", async () => {
    const { letter } = await db.createDraft(
      {
        letterTypeId: "type-undangan",
        subject: "Undangan Rapat Koordinasi Program",
        recipientName: "Mitra Riset",
        classification: "INTERNAL",
        plannedDate: "2026-11-01",
        content: { bodyText: "Rapat koordinasi melalui platform virtual." },
      },
      author
    );

    const submitted = await db.submitForReview(letter.id, author);
    expect(submitted.status).toBe("IN_REVIEW");

    // Ketika status IN_REVIEW, penyuntingan draf harus ditolak (terkunci)
    await expect(
      db.addRevision(
        letter.id,
        {
          subject: "Ubah ketika review",
          recipientName: "Mitra",
          classification: "INTERNAL",
          plannedDate: "2026-11-01",
          content: {},
        },
        author
      )
    ).rejects.toThrowError(/tidak dapat disunting/);
  });

  it("alokasi nomor surat resmi ditolak dan melempar eksepsi pada Sprint 1B (Safety Gate)", () => {
    expect(() => {
      db.allocateOfficialNumber();
    }).toThrowError(/BLOCKED: Penomoran surat resmi terkunci/);
  });
});
