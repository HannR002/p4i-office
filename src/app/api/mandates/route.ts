import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/security/session";
import { db } from "@/lib/db";
import { sanitizeString } from "@/lib/security/sanitization";

const createMandateSchema = z.object({
  userId: z.string().uuid("ID Pengguna tidak valid."),
  letterTypeId: z.string().uuid().nullable().optional(),
  unitId: z.string().uuid().nullable().optional(),
  canReview: z.boolean().default(true),
  canApprove: z.boolean(),
  canSign: z.boolean().default(false),
  validFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Format tanggal harus YYYY-MM-DD."),
  validTo: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Format tanggal harus YYYY-MM-DD."),
  decreeNumber: z.string().min(3, "Nomor SK minimal 3 karakter.").max(255),
  notes: z.string().max(500).optional(),
});

export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ success: false, message: "Akses ditolak: Silakan masuk." }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const userId = searchParams.get("userId") || undefined;

  try {
    const mandates = await db.getSignatoryMandates(user.organizationId, userId);
    return NextResponse.json({
      success: true,
      mandates,
    });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : "Gagal memuat daftar mandat.";
    return NextResponse.json({ success: false, message: errorMsg }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ success: false, message: "Akses ditolak: Silakan masuk." }, { status: 401 });
  }

  if (user.role !== "SYSTEM_ADMIN" && user.role !== "PENGURUS_YAYASAN") {
    return NextResponse.json({ success: false, message: "Akses ditolak: Hanya administrator atau pengurus yayasan yang berwenang menetapkan mandat." }, { status: 403 });
  }

  try {
    const body = await req.json();
    const parsed = createMandateSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { success: false, message: parsed.error.issues[0]?.message || "Input mandat tidak valid." },
        { status: 400 }
      );
    }

    const created = await db.createSignatoryMandate(
      {
        userId: parsed.data.userId,
        letterTypeId: parsed.data.letterTypeId,
        unitId: parsed.data.unitId,
        canReview: parsed.data.canReview,
        canApprove: parsed.data.canApprove,
        canSign: parsed.data.canSign,
        validFrom: parsed.data.validFrom,
        validTo: parsed.data.validTo,
        decreeNumber: sanitizeString(parsed.data.decreeNumber),
        notes: parsed.data.notes ? sanitizeString(parsed.data.notes) : undefined,
      },
      {
        id: user.id,
        name: user.displayName,
        role: user.role,
        organizationId: user.organizationId,
      }
    );

    return NextResponse.json({
      success: true,
      message: "Mandat pejabat berhasil dibuat.",
      mandate: created,
    }, { status: 201 });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : "Gagal membuat mandat.";
    return NextResponse.json({ success: false, message: errorMsg }, { status: 400 });
  }
}

