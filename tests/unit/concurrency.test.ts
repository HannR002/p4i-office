import { describe, it, expect } from "vitest";
import { db, UserContext } from "@/lib/db";

describe("T11: Penanganan Konkurensi & Integritas Nomor Revisi (Concurrency Matrix)", () => {
  const author: UserContext = {
    id: "e0000000-0000-4000-8000-000000000002",
    name: "Staf Administrasi (Uji)",
    role: "STAFF",
    organizationId: "a0000000-0000-4000-8000-000000000001",
  };

  it("T11: eksekusi simultan beberapa revisi tidak merusak urutan versi atau menghilangkan data", async () => {
    // 1. Buat draf awal (v1)
    const { letter } = await db.createDraft(
      {
        letterTypeId: "type-magang",
        subject: "Surat Keterangan Magang Uji Konkurensi",
        recipientName: "Sdr. Bayu Pratama",
        classification: "INTERNAL",
        plannedDate: "2026-10-29",
        content: { text: "Versi awal draf v1." },
      },
      author
    );

    expect(letter.currentRevisionNo).toBe(1);

    // 2. Kirim 3 permintaan revisi simultan menggunakan Promise.all
    const promises = [
      db.addRevision(
        letter.id,
        {
          subject: "Revisi Simultan A",
          recipientName: "Sdr. Bayu Pratama",
          classification: "INTERNAL",
          plannedDate: "2026-10-29",
          content: { text: "Konten pembaruan dari proses A" },
          changeSummary: "Pembaruan proses A",
        },
        author
      ),
      db.addRevision(
        letter.id,
        {
          subject: "Revisi Simultan B",
          recipientName: "Sdr. Bayu Pratama",
          classification: "INTERNAL",
          plannedDate: "2026-10-29",
          content: { text: "Konten pembaruan dari proses B" },
          changeSummary: "Pembaruan proses B",
        },
        author
      ),
      db.addRevision(
        letter.id,
        {
          subject: "Revisi Simultan C",
          recipientName: "Sdr. Bayu Pratama",
          classification: "INTERNAL",
          plannedDate: "2026-10-29",
          content: { text: "Konten pembaruan dari proses C" },
          changeSummary: "Pembaruan proses C",
        },
        author
      ),
    ];

    const results = await Promise.all(promises);

    // Verifikasi setiap panggilan sukses
    expect(results).toHaveLength(3);

    // Ambil seluruh riwayat revisi dari basis data
    const allRevisions = await db.getLetterRevisions(letter.id);

    // Harus ada tepat 4 revisi: v1, v2, v3, v4
    expect(allRevisions).toHaveLength(4);

    const versions = allRevisions.map((r) => r.version).sort((a, b) => a - b);
    expect(versions).toEqual([1, 2, 3, 4]);

    // Verifikasi nomor versi unik tanpa duplikasi
    const uniqueVersions = new Set(versions);
    expect(uniqueVersions.size).toBe(4);

    // Verifikasi surat memiliki nomor revisi akhir = 4
    const finalLetter = await db.getLetterById(letter.id, author.organizationId, author);
    expect(finalLetter?.currentRevisionNo).toBe(4);
  });

  it("T11: penolakan konflik revisi jika expectedVersion tidak sesuai (Optimistic Concurrency Control)", async () => {
    const { letter } = await db.createDraft(
      {
        letterTypeId: "type-tugas",
        subject: "Surat Tugas Uji Optimistic Lock",
        recipientName: "Tim Survei",
        classification: "INTERNAL",
        plannedDate: "2026-10-29",
        content: { text: "Initial" },
      },
      author
    );

    // Tambah revisi pertama sehingga version menjadi 2
    await db.addRevision(
      letter.id,
      {
        subject: "Surat Tugas v2",
        recipientName: "Tim Survei",
        classification: "INTERNAL",
        plannedDate: "2026-10-29",
        content: { text: "Updated" },
      },
      author
    );

    // Percobaan revisi lain yang masih mengira versi saat ini adalah v1 -> HARUS GAGAL
    await expect(
      db.addRevision(
        letter.id,
        {
          subject: "Surat Tugas Stale Update",
          recipientName: "Tim Survei",
          classification: "INTERNAL",
          plannedDate: "2026-10-29",
          content: { text: "Stale Content" },
          expectedVersion: 1, // Stale version!
        },
        author
      )
    ).rejects.toThrowError(/Konflik revisi: Draf telah diperbarui/);
  });
});
