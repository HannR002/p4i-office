import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/security/session";
import { db } from "@/lib/db";
import { sanitizeString } from "@/lib/security/sanitization";

const decisionSchema = z.object({
  decision: z.enum(["APPROVED", "CHANGES_REQUESTED", "REJECTED"]),
  comments: z.string().max(1000).optional(),
  mandateId: z.string().uuid("Format ID mandat tidak valid.").optional(),
});

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
    const rawBody = await req.json().catch(() => ({}));
    const parsed = decisionSchema.safeParse(rawBody);

    if (!parsed.success) {
      return NextResponse.json(
        { success: false, message: parsed.error.issues[0]?.message || "Input keputusan tidak valid." },
        { status: 400 }
      );
    }

    const sanitizedComments = parsed.data.comments 
      ? sanitizeString(parsed.data.comments) 
      : undefined;

    const result = await db.decideApproval(
      id,
      {
        id: user.id,
        name: user.displayName,
        role: user.role,
        organizationId: user.organizationId,
      },
      {
        decision: parsed.data.decision,
        comments: sanitizedComments,
        mandateId: parsed.data.mandateId,
      }
    );

    return NextResponse.json({
      success: true,
      message: `Keputusan ${parsed.data.decision} berhasil diproses.`,
      data: result,
    });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : "Gagal memproses keputusan persetujuan.";
    
    // Status HTTP spesifik untuk audit keamanan
    if (errorMsg.includes("Anti Self-Approval") || errorMsg.includes("Akses ditolak")) {
      return NextResponse.json({ success: false, message: errorMsg }, { status: 403 });
    }
    if (errorMsg.includes("stale approval") || errorMsg.includes("diperbarui oleh pengguna lain")) {
      return NextResponse.json({ success: false, message: errorMsg }, { status: 409 });
    }
    if (errorMsg.includes("mandat") || errorMsg.includes("Alasan penolakan") || errorMsg.includes("wajib diisi")) {
      return NextResponse.json({ success: false, message: errorMsg }, { status: 422 });
    }

    return NextResponse.json({ success: false, message: errorMsg }, { status: 400 });
  }
}

