import { describe, it, expect } from "vitest";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import { UserContext } from "@/lib/db/types";

describe("DB-06: Verifikasi Keamanan RBAC, Hashing Sandi & Otorisasi Kepemilikan Surat pada PostgreSQL Riil", () => {
  const staff1: UserContext = {
    id: "e0000000-0000-4000-8000-000000000002",
    displayName: "Staf Tata Usaha 1",
    email: "staf.test@p4i.local",
    role: "STAFF",
    organizationId: "a0000000-0000-4000-8000-000000000001",
  };

  const staff2: UserContext = {
    id: "e0000000-0000-4000-8000-000000000004", // User lain
    displayName: "Staf Unit Riset",
    email: "staf2.test@p4i.local",
    role: "STAFF",
    organizationId: "a0000000-0000-4000-8000-000000000001",
  };

  const admin: UserContext = {
    id: "e0000000-0000-4000-8000-000000000001",
    displayName: "Administrator Sistem",
    email: "admin.test@p4i.local",
    role: "SYSTEM_ADMIN",
    organizationId: "a0000000-0000-4000-8000-000000000001",
  };

  it("DB-06: akun aktif dapat diverifikasi sandinya menggunakan bcrypt cost factor 10 dari PostgreSQL riil", async () => {
    const user = await db.getUserByEmail("admin.test@p4i.local");
    expect(user).toBeDefined();
    expect(user?.email).toBe("admin.test@p4i.local");
    expect(user?.status).toBe("ACTIVE");
    expect(user?.role).toBe("SYSTEM_ADMIN");

    // Verifikasi password hash bcrypt
    expect(user?.passwordHash).toMatch(/^\$2[aby]\$10\$/);
    const validPass = await bcrypt.compare("Password123!", user!.passwordHash);
    expect(validPass).toBe(true);

    const invalidPass = await bcrypt.compare("WrongPassword!", user!.passwordHash);
    expect(invalidPass).toBe(false);
  });

  it("DB-06: akun berstatus DISABLED teridentifikasi tegas pada pangkalan data riil", async () => {
    const disabledUser = await db.getUserByEmail("disabled.test@p4i.local");
    expect(disabledUser).toBeDefined();
    expect(disabledUser?.status).toBe("DISABLED");
  });

  it("DB-06: otorisasi kepemilikan surat menolak staf lain yang mencoba mengubah draf", async () => {
    // Staff 1 buat draf
    const draft = await db.createDraft(
      {
        letterTypeId: "c0000000-0000-4000-8000-000000000004", // PERMOHONAN
        subject: "Surat Permohonan Hibah Riset P4I",
        recipientName: "Kementerian Terkait",
        classification: "INTERNAL",
        plannedDate: "2026-11-05",
        content: { ringkasan: "Draf proposal hibah" },
      },
      staff1
    );

    const letterId = draft.letter.id;

    // Staff 2 mencoba menambahkan revisi ke draf milik Staff 1
    await expect(
      db.addRevision(
        letterId,
        {
          subject: "Pembajakan Draf oleh Staf Lain",
          recipientName: "Kementerian Terkait",
          classification: "INTERNAL",
          plannedDate: "2026-11-06",
          content: { ringkasan: "Upaya modifikasi tanpa hak" },
        },
        staff2
      )
    ).rejects.toThrow(/hanya pembuat draf|tidak memiliki hak/i);
  });

  it("DB-06: surat berklasifikasi CONFIDENTIAL hanya dapat diakses oleh pembuat dan SYSTEM_ADMIN", async () => {
    // Staff 1 buat surat rahasia
    const draft = await db.createDraft(
      {
        letterTypeId: "c0000000-0000-4000-8000-000000000001",
        subject: "Laporan Investigasi Internal (CONFIDENTIAL)",
        recipientName: "Dewan Pembina Yayasan",
        classification: "CONFIDENTIAL",
        plannedDate: "2026-11-10",
        content: { hasil: "Temuan audit kepatuhan khusus" },
      },
      staff1
    );

    const letterId = draft.letter.id;

    // 1. Staff 2 mencoba membaca -> ditolak tegas dengan eksepsi akses
    await expect(
      db.getLetterById(letterId, staff1.organizationId, staff2)
    ).rejects.toThrow(/akses ditolak|rahasia|confidential/i);

    // 2. Staff 1 (pembuat) membaca -> berhasil
    const readByAuthor = await db.getLetterById(letterId, staff1.organizationId, staff1);
    expect(readByAuthor).toBeDefined();
    expect(readByAuthor?.id).toBe(letterId);

    // 3. Admin membaca -> berhasil
    const readByAdmin = await db.getLetterById(letterId, staff1.organizationId, admin);
    expect(readByAdmin).toBeDefined();
    expect(readByAdmin?.id).toBe(letterId);
  });
});
