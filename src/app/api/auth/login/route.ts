import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { db } from "@/lib/db";
import { signSessionToken, SESSION_COOKIE_NAME } from "@/lib/security/session";
import { checkLoginRateLimit, recordLoginAttempt, clearLoginRateLimit } from "@/lib/security/rate-limit";
import { logAuditEvent } from "@/lib/audit";

const loginSchema = z.object({
  email: z.string().email("Format email tidak valid."),
  password: z.string().min(1, "Kata sandi wajib diisi."),
});

export async function POST(req: NextRequest) {
  try {
    const ip = req.headers.get("x-forwarded-for") || "127.0.0.1";
    const body = await req.json();
    const parsed = loginSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { success: false, message: parsed.error.issues[0]?.message || "Input tidak valid." },
        { status: 400 }
      );
    }

    const { email, password } = parsed.data;
    const rateLimitKey = `login:${ip}:${email.toLowerCase()}`;
    const rateLimit = checkLoginRateLimit(rateLimitKey);

    if (!rateLimit.success) {
      return NextResponse.json(
        {
          success: false,
          message: `Terlalu banyak percobaan masuk yang gagal. Silakan coba lagi dalam ${rateLimit.resetSeconds} detik.`,
        },
        { status: 429 }
      );
    }

    const user = db.getUserByEmail(email);
    if (!user) {
      recordLoginAttempt(rateLimitKey);
      return NextResponse.json(
        { success: false, message: "Email atau kata sandi tidak sesuai." },
        { status: 401 }
      );
    }

    // KEAMANAN KETAT: Periksa status akun
    if (user.status === "DISABLED") {
      logAuditEvent({
        organizationId: user.organizationId,
        actorId: user.id,
        eventType: "AUTH_LOGIN_REJECTED_DISABLED",
        entityType: "user",
        entityId: user.id,
        metadata: { email, reason: "Account is DISABLED" },
      });
      return NextResponse.json(
        { success: false, message: "Akun Anda berstatus NONAKTIF. Hubungi Administrator Sistem." },
        { status: 403 }
      );
    }

    const passwordMatch = await bcrypt.compare(password, user.passwordHash);
    if (!passwordMatch) {
      recordLoginAttempt(rateLimitKey);
      logAuditEvent({
        organizationId: user.organizationId,
        actorId: user.id,
        eventType: "AUTH_LOGIN_FAILED_PASSWORD",
        entityType: "user",
        entityId: user.id,
      });
      return NextResponse.json(
        { success: false, message: "Email atau kata sandi tidak sesuai." },
        { status: 401 }
      );
    }

    // Login sukses: bersihkan limit
    clearLoginRateLimit(rateLimitKey);

    const token = await signSessionToken({
      id: user.id,
      organizationId: user.organizationId,
      email: user.email,
      displayName: user.displayName,
      role: user.role,
      status: user.status,
    });

    logAuditEvent({
      organizationId: user.organizationId,
      actorId: user.id,
      eventType: "AUTH_LOGIN_SUCCESS",
      entityType: "user",
      entityId: user.id,
      metadata: { role: user.role },
    });

    const response = NextResponse.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        displayName: user.displayName,
        role: user.role,
      },
    });

    response.cookies.set(SESSION_COOKIE_NAME, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 28800, // 8 jam
    });

    return response;
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : "Terjadi kesalahan server internal.";
    return NextResponse.json({ success: false, message: errorMsg }, { status: 500 });
  }
}
