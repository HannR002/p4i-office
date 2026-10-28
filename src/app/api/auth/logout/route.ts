import { NextResponse } from "next/server";
import { getCurrentUser, SESSION_COOKIE_NAME } from "@/lib/security/session";
import { logAuditEvent } from "@/lib/audit";

export async function POST() {
  const user = await getCurrentUser();
  if (user) {
    logAuditEvent({
      organizationId: user.organizationId,
      actorId: user.id,
      eventType: "AUTH_LOGOUT",
      entityType: "user",
      entityId: user.id,
    });
  }

  const response = NextResponse.json({ success: true, message: "Berhasil keluar dari sistem." });
  response.cookies.delete(SESSION_COOKIE_NAME);
  return response;
}
