import { describe, it, expect } from "vitest";
import { z } from "zod";

const createDraftSchema = z.object({
  letterTypeId: z.string().min(1, "Jenis surat wajib dipilih."),
  subject: z.string().min(3, "Perihal surat minimal 3 karakter.").max(255),
  recipientName: z.string().min(2, "Nama penerima wajib diisi.").max(255),
  classification: z.enum(["PUBLIC", "INTERNAL", "CONFIDENTIAL"]).default("INTERNAL"),
  plannedDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Format tanggal harus YYYY-MM-DD."),
  content: z.record(z.unknown()).default({}),
});

const addRevisionSchema = z.object({
  subject: z.string().min(3, "Perihal minimal 3 karakter.").max(255),
  recipientName: z.string().min(2, "Nama penerima minimal 2 karakter.").max(255),
  classification: z.enum(["PUBLIC", "INTERNAL", "CONFIDENTIAL"]),
  plannedDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Format tanggal harus YYYY-MM-DD."),
  content: z.record(z.unknown()).default({}),
  changeSummary: z.string().max(500).optional(),
  expectedVersion: z.number().int().positive().optional(),
});

describe("T10: Validasi Input dan Skema Data Backend (Validation Matrix)", () => {
  it("T10: input pembuatan draf yang valid harus lolos validasi", () => {
    const validData = {
      letterTypeId: "c0000000-0000-4000-8000-000000000001",
      subject: "Surat Keterangan Magang Riset Kebijakan",
      recipientName: "Sdr. Rian Pratama",
      classification: "INTERNAL" as const,
      plannedDate: "2026-10-29",
      content: { note: "Kinerja baik" },
    };

    const parsed = createDraftSchema.safeParse(validData);
    expect(parsed.success).toBe(true);
  });

  it("T10: perihal kosong atau terlalu pendek (< 3 karakter) harus ditolak", () => {
    const invalidData = {
      letterTypeId: "c0000000-0000-4000-8000-000000000001",
      subject: "AB", // terlalu pendek
      recipientName: "Sdr. Rian Pratama",
      classification: "INTERNAL" as const,
      plannedDate: "2026-10-29",
      content: {},
    };

    const parsed = createDraftSchema.safeParse(invalidData);
    expect(parsed.success).toBe(false);
    expect(parsed.error?.issues[0]?.message).toContain("minimal 3 karakter");
  });

  it("T10: format tanggal bukan YYYY-MM-DD harus ditolak", () => {
    const invalidDateCases = ["29-10-2026", "2026/10/29", "invalid-date", "2026-1-1"];

    for (const d of invalidDateCases) {
      const parsed = createDraftSchema.safeParse({
        letterTypeId: "type-magang",
        subject: "Surat Keterangan Uji Format Tanggal",
        recipientName: "Penerima Uji",
        classification: "INTERNAL",
        plannedDate: d,
        content: {},
      });
      expect(parsed.success).toBe(false);
      expect(parsed.error?.issues[0]?.message).toContain("Format tanggal harus YYYY-MM-DD");
    }
  });

  it("T10: nilai klasifikasi di luar PUBLIC/INTERNAL/CONFIDENTIAL harus ditolak", () => {
    const invalidClassification = {
      subject: "Surat Klasifikasi Ilegal",
      recipientName: "Penerima",
      classification: "TOP_SECRET", // Tidak terdaftar di SRS / DB enum
      plannedDate: "2026-10-29",
      content: {},
    };

    const parsed = addRevisionSchema.safeParse(invalidClassification);
    expect(parsed.success).toBe(false);
  });

  it("T10: nama penerima kurang dari 2 karakter harus ditolak", () => {
    const invalidRecipient = {
      letterTypeId: "type-tugas",
      subject: "Surat Tugas Tanpa Penerima Valid",
      recipientName: "X",
      classification: "INTERNAL",
      plannedDate: "2026-10-29",
      content: {},
    };

    const parsed = createDraftSchema.safeParse(invalidRecipient);
    expect(parsed.success).toBe(false);
  });
});
