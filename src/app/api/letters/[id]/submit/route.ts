import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/security/session";
import { db } from "@/lib/db";
import { sanitizeString } from "@/lib/security/sanitization";

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
    const body = await req.json().catch(() => ({}));
    const notes = body.notes ? sanitizeString(body.notes) : undefined;

    const result = await db.submitForApproval(
      id,
      {
        id: user.id,
        name: user.displayName,
        role: user.role,
        organizationId: user.organizationId,
      },
      notes
    );

    return NextResponse.json({
      success: true,
      message: "Draf berhasil diajukan untuk pemeriksaan (Status: SUBMITTED).",
      letter: result.letter,
      request: result.request,
      data: result,
    });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : "Gagal mengajukan draf.";
    if (errorMsg.includes("Akses ditolak")) {
      return NextResponse.json({ success: false, message: errorMsg }, { status: 403 });
    }
    return NextResponse.json({ success: false, message: errorMsg }, { status: 400 });
  }
}
