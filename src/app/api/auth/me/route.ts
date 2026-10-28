import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/security/session";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ success: false, message: "Sesi tidak valid atau telah berakhir." }, { status: 401 });
  }

  return NextResponse.json({
    success: true,
    user: {
      id: user.id,
      organizationId: user.organizationId,
      email: user.email,
      displayName: user.displayName,
      role: user.role,
      status: user.status,
    },
  });
}
