import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/security/session";
import { db } from "@/lib/db";

export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ success: false, message: "Akses ditolak: Silakan masuk." }, { status: 401 });
  }

  const { id } = await context.params;

  try {
    const detail = await db.getApprovalRequestById(id, {
      id: user.id,
      name: user.displayName,
      role: user.role,
      organizationId: user.organizationId,
    });

    if (!detail) {
      return NextResponse.json({ success: false, message: "Permintaan persetujuan tidak ditemukan." }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      data: detail,
    });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : "Gagal memuat detail persetujuan.";
    return NextResponse.json({ success: false, message: errorMsg }, { status: 500 });
  }
}

