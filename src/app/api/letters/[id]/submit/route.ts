import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/security/session";
import { db } from "@/lib/db";

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
    const updatedLetter = db.submitForReview(id, {
      id: user.id,
      organizationId: user.organizationId,
    });

    return NextResponse.json({
      success: true,
      message: "Draf berhasil diajukan untuk pemeriksaan (Status: IN_REVIEW).",
      letter: updatedLetter,
    });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : "Gagal mengajukan draf.";
    return NextResponse.json({ success: false, message: errorMsg }, { status: 400 });
  }
}
