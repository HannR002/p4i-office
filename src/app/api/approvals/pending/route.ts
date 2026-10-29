import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/security/session";
import { db } from "@/lib/db";

export async function GET(_req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ success: false, message: "Akses ditolak: Silakan masuk." }, { status: 401 });
  }

  try {
    const queue = await db.getPendingApprovals(
      {
        id: user.id,
        name: user.displayName,
        role: user.role,
        organizationId: user.organizationId,
      },
      user.organizationId
    );

    return NextResponse.json({
      success: true,
      queue,
      count: queue.length,
    });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : "Gagal memuat antrean pemeriksaan.";
    return NextResponse.json({ success: false, message: errorMsg }, { status: 500 });
  }
}

