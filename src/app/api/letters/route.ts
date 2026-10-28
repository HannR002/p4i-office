import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/security/session";
import { db } from "@/lib/db";
import { sanitizeObject, sanitizeString } from "@/lib/security/sanitization";

const createDraftSchema = z.object({
  letterTypeId: z.string().min(1, "Jenis surat wajib dipilih."),
  subject: z.string().min(3, "Perihal surat minimal 3 karakter.").max(255),
  recipientName: z.string().min(2, "Nama penerima wajib diisi.").max(255),
  classification: z.enum(["PUBLIC", "INTERNAL", "CONFIDENTIAL"]).default("INTERNAL"),
  plannedDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Format tanggal harus YYYY-MM-DD."),
  content: z.record(z.unknown()).default({}),
});

export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ success: false, message: "Akses ditolak: silakan masuk terlebih dahulu." }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status") || "ALL";

  const letters = db.getAllLetters(user.organizationId, status);
  return NextResponse.json({ success: true, letters });
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ success: false, message: "Akses ditolak: silakan masuk terlebih dahulu." }, { status: 401 });
  }

  try {
    const body = await req.json();
    const parsed = createDraftSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { success: false, message: parsed.error.issues[0]?.message || "Data input tidak valid." },
        { status: 400 }
      );
    }

    // Sanitasi data masukan
    const sanitizedSubject = sanitizeString(parsed.data.subject);
    const sanitizedRecipient = sanitizeString(parsed.data.recipientName);
    const sanitizedContent = sanitizeObject(parsed.data.content);

    const result = db.createDraft(
      {
        letterTypeId: parsed.data.letterTypeId,
        subject: sanitizedSubject,
        recipientName: sanitizedRecipient,
        classification: parsed.data.classification,
        plannedDate: parsed.data.plannedDate,
        content: sanitizedContent,
      },
      {
        id: user.id,
        name: user.displayName,
        organizationId: user.organizationId,
      }
    );

    return NextResponse.json({
      success: true,
      message: "Draf surat berhasil dibuat.",
      letter: result.letter,
      revision: result.revision,
    });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : "Gagal membuat draf surat.";
    return NextResponse.json({ success: false, message: errorMsg }, { status: 500 });
  }
}
