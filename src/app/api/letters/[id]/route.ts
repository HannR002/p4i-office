import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/security/session";
import { db } from "@/lib/db";
import { sanitizeObject, sanitizeString } from "@/lib/security/sanitization";

const addRevisionSchema = z.object({
  subject: z.string().min(3, "Perihal minimal 3 karakter.").max(255),
  recipientName: z.string().min(2, "Nama penerima minimal 2 karakter.").max(255),
  classification: z.enum(["PUBLIC", "INTERNAL", "CONFIDENTIAL"]),
  plannedDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Format tanggal harus YYYY-MM-DD."),
  content: z.record(z.unknown()).default({}),
  changeSummary: z.string().max(500).optional(),
  expectedVersion: z.number().int().positive().optional(),
});

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ success: false, message: "Akses ditolak: Silakan masuk." }, { status: 401 });
  }

  const { id } = await context.params;

  try {
    const letter = await db.getLetterById(id, user.organizationId, user);

    if (!letter) {
      return NextResponse.json({ success: false, message: "Surat tidak ditemukan." }, { status: 404 });
    }

    const revisions = await db.getLetterRevisions(id);
    const organization = await db.getOrganization();

    return NextResponse.json({
      success: true,
      letter,
      revisions,
      organization,
    });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : "Gagal memuat draf surat.";
    if (errorMsg.includes("Akses ditolak")) {
      return NextResponse.json({ success: false, message: errorMsg }, { status: 403 });
    }
    return NextResponse.json({ success: false, message: errorMsg }, { status: 500 });
  }
}

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ success: false, message: "Akses ditolak: Silakan masuk." }, { status: 401 });
  }

  const { id } = await context.params;

  try {
    const body = await req.json();
    const parsed = addRevisionSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { success: false, message: parsed.error.issues[0]?.message || "Input tidak valid." },
        { status: 400 }
      );
    }

    const sanitizedSubject = sanitizeString(parsed.data.subject);
    const sanitizedRecipient = sanitizeString(parsed.data.recipientName);
    const sanitizedContent = sanitizeObject(parsed.data.content);
    const sanitizedSummary = parsed.data.changeSummary
      ? sanitizeString(parsed.data.changeSummary)
      : undefined;

    const result = await db.addRevision(
      id,
      {
        subject: sanitizedSubject,
        recipientName: sanitizedRecipient,
        classification: parsed.data.classification,
        plannedDate: parsed.data.plannedDate,
        content: sanitizedContent,
        changeSummary: sanitizedSummary,
        expectedVersion: parsed.data.expectedVersion,
      },
      {
        id: user.id,
        name: user.displayName,
        role: user.role,
        organizationId: user.organizationId,
      }
    );

    return NextResponse.json({
      success: true,
      message: `Revisi baru (v${result.revision.version}) berhasil disimpan secara permanen.`,
      letter: result.letter,
      revision: result.revision,
    });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : "Gagal menambahkan revisi draf.";
    if (errorMsg.includes("Akses ditolak")) {
      return NextResponse.json({ success: false, message: errorMsg }, { status: 403 });
    }
    if (errorMsg.includes("Konflik revisi")) {
      return NextResponse.json({ success: false, message: errorMsg }, { status: 409 });
    }
    return NextResponse.json({ success: false, message: errorMsg }, { status: 400 });
  }
}
