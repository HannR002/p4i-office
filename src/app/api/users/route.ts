import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/security/session";
import { db } from "@/lib/db";

const updateUserStatusSchema = z.object({
  userId: z.string().min(1, "User ID wajib diisi."),
  status: z.enum(["ACTIVE", "DISABLED"]),
});

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ success: false, message: "Akses ditolak: Silakan masuk." }, { status: 401 });
  }

  // KEAMANAN KETAT RBAC: Hanya SYSTEM_ADMIN yang diizinkan mengakses data pengguna
  if (user.role !== "SYSTEM_ADMIN") {
    return NextResponse.json(
      { success: false, message: "Akses ditolak: Hanya Administrator Sistem yang diizinkan mengakses data pengguna." },
      { status: 403 }
    );
  }

  const userList = await db.getAllUsers(user.organizationId);
  const users = userList.map((u) => ({
    id: u.id,
    email: u.email,
    displayName: u.displayName,
    role: u.role,
    status: u.status,
    createdAt: u.createdAt,
  }));

  return NextResponse.json({ success: true, users });
}

export async function PATCH(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ success: false, message: "Akses ditolak: Silakan masuk." }, { status: 401 });
  }

  // KEAMANAN KETAT RBAC: Hanya SYSTEM_ADMIN
  if (user.role !== "SYSTEM_ADMIN") {
    return NextResponse.json(
      { success: false, message: "Akses ditolak: Hanya Administrator Sistem yang diizinkan mengubah status pengguna." },
      { status: 403 }
    );
  }

  try {
    const body = await req.json();
    const parsed = updateUserStatusSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { success: false, message: parsed.error.issues[0]?.message || "Input tidak valid." },
        { status: 400 }
      );
    }

    const { userId, status } = parsed.data;

    // Cegah admin menonaktifkan dirinya sendiri
    if (userId === user.id && status === "DISABLED") {
      return NextResponse.json(
        { success: false, message: "Anda tidak dapat menonaktifkan akun Anda sendiri." },
        { status: 400 }
      );
    }

    const updated = await db.updateUserStatus(userId, status, user.id);
    if (!updated) {
      return NextResponse.json({ success: false, message: "Pengguna tidak ditemukan." }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      message: `Status pengguna berhasil diubah menjadi ${status}.`,
      user: {
        id: updated.id,
        email: updated.email,
        displayName: updated.displayName,
        role: updated.role,
        status: updated.status,
      },
    });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : "Gagal memperbarui status pengguna.";
    return NextResponse.json({ success: false, message: errorMsg }, { status: 500 });
  }
}
