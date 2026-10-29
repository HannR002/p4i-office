import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/security/session";
import { db } from "@/lib/db";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ success: false, message: "Akses ditolak." }, { status: 401 });
  }

  const types = await db.getLetterTypes(user.organizationId);
  return NextResponse.json({ success: true, types });
}
