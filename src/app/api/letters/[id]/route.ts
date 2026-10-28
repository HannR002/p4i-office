import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/security/session";
import { db } from "@/lib/db";
import { sanitizeObject, sanitizeString } from "@/lib/security/sanitization";

const addRevisionSchema = z.object({
  subject: z.string().min(3).max(255),
  recipientName: z.string().min(2).max(255),
  classification: z.enum(["PUBLIC", "INTERNAL", "CONFIDENTIAL"]),
  plannedDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  content: z.record(z.unknown()).default({}),
  changeSummary: z.string().max(500).optional(),
});

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ success: false, message: "Akses ditolak." }, { status: 401 });
  }

  const { id } = await context.params;
  const letter = db.getLetterById(id, user.organizationId);

  if (!letter) {
    return NextResponse.json({ success: false, message: "Surat tidak ditemukan." }, { status: 404 });
  }

  const revisions = db.getLetterRevisions(id);

  return NextResponse.json({
    success: true,
    letter,
    revisions,
    organization: db.getOrganization(),
  });
}

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ success: false, message: "Akses ditolak." }, { status: 401 });
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

    const result = db.addRevision(
      id,
      {
        subject: sanitizedSubject,
        recipientName: sanitizedRecipient,
        classification: parsed.data.classification,
        plannedDate: parsed.data.plannedDate,
        content: sanitizedContent,
        changeSummary: sanitizedSummary,
      },
      {
        id: user.id,
        name: user.displayName,
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
    return NextResponse.json({ success: false, message: errorMsg }, { status: 400 });
  }
}
