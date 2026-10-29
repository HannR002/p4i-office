import { describe, it, expect } from "vitest";
import { db, UserContext } from "@/lib/db";

describe("T07 & T09: Otorisasi Kepemilikan Surat & Hak Akses (Authorization Matrix)", () => {
  const staff1: UserContext = {
    id: "e0000000-0000-4000-8000-000000000002",
    name: "Staf Administrasi 1",
    role: "STAFF",
    organizationId: "a0000000-0000-4000-8000-000000000001",
  };

  const staff2: UserContext = {
    id: "e0000000-0000-4000-8000-000000000099",
    name: "Staf Administrasi 2 (Lain)",
    role: "STAFF",
    organizationId: "a0000000-0000-4000-8000-000000000001",
  };

  const admin: UserContext = {
    id: "e0000000-0000-4000-8000-000000000001",
    name: "Admin Sistem",
    role: "SYSTEM_ADMIN",
    organizationId: "a0000000-0000-4000-8000-000000000001",
  };

  it("T09: pengguna tanpa hak tidak dapat mengubah draf milik orang lain", async () => {
    // 1. Staf 1 membuat draf
    const { letter } = await db.createDraft(
      {
        letterTypeId: "type-tugas",
        subject: "Surat Tugas Khusus Staf 1",
        recipientName: "Biro Perencanaan",
        classification: "INTERNAL",
        plannedDate: "2026-10-30",
        content: { note: "Draf internal milik Staf 1." },
      },
      staff1
    );

    // 2. Staf 2 mencoba menambahkan revisi pada draf milik Staf 1 -> HARUS DITOLAK
    await expect(
      db.addRevision(
        letter.id,
        {
          subject: "Upaya Ubah Tanpa Otorisasi oleh Staf 2",
          recipientName: "Biro Perencanaan",
          classification: "INTERNAL",
          plannedDate: "2026-10-30",
          content: { note: "Konten tidak sah." },
        },
        staff2
      )
    ).rejects.toThrowError(/Akses ditolak: Hanya pembuat draf/);

    // 3. Staf 2 mencoba mengajukan pemeriksaan draf Staf 1 -> HARUS DITOLAK
    await expect(
      db.submitForReview(letter.id, staff2)
    ).rejects.toThrowError(/Akses ditolak: Hanya pembuat draf/);

    // 4. Staf 1 (pemilik sah) dapat menyunting draf miliknya
    const { revision: rev2 } = await db.addRevision(
      letter.id,
      {
        subject: "Surat Tugas Khusus Staf 1 (Revisi Sah)",
        recipientName: "Biro Perencanaan",
        classification: "INTERNAL",
        plannedDate: "2026-10-30",
        content: { note: "Pembaruan sah oleh pemilik." },
      },
      staff1
    );
    expect(rev2.version).toBe(2);
  });

  it("T09: staf dilarang membaca surat rahasia (CONFIDENTIAL) milik orang lain", async () => {
    // 1. Staf 1 membuat draf rahasia (CONFIDENTIAL)
    const { letter } = await db.createDraft(
      {
        letterTypeId: "type-permohonan",
        subject: "Surat Permohonan Audit Keuangan Khusus",
        recipientName: "Kantor Akuntan Publik",
        classification: "CONFIDENTIAL",
        plannedDate: "2026-11-01",
        content: { detail: "Data rahasia audit internal yayasan." },
      },
      staff1
    );

    // 2. Staf 2 mencoba membaca draf rahasia -> DITOLAK
    await expect(
      db.getLetterById(letter.id, staff2.organizationId, staff2)
    ).rejects.toThrowError(/Akses ditolak: Surat ini bersifat RAHASIA/);

    // 3. Staf 1 (pembuat) dapat membaca surat rahasia miliknya
    const readByOwner = await db.getLetterById(letter.id, staff1.organizationId, staff1);
    expect(readByOwner).not.toBeNull();
    expect(readByOwner?.subject).toContain("Audit Keuangan");

    // 4. Administrator sistem dapat membaca surat rahasia untuk keperluan audit tata kelola
    const readByAdmin = await db.getLetterById(letter.id, admin.organizationId, admin);
    expect(readByAdmin).not.toBeNull();
    expect(readByAdmin?.id).toBe(letter.id);
  });
});
