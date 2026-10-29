import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/security/session";
import { db } from "@/lib/db";
import { sanitizeString } from "@/lib/security/sanitization";

const updateMandateSchema = z.object({
  canReview: z.boolean().optional(),
  canApprove: z.boolean().optional(),
  canSign: z.boolean().optional(),
  validFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Format tanggal harus YYYY-MM-DD.").optional(),
  validTo: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Format tanggal harus YYYY-MM-DD.").optional(),
  status: z.enum(["ACTIVE", "REVOKED", "EXPIRED"]).optional(),
  decreeNumber: z.string().min(3).max(255).optional(),
  notes: z.string().max(500).optional(),
});

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
    const mandate = await db.getMandateById(id, user.organizationId);
    if (!mandate) {
      return NextResponse.json({ success: false, message: "Mandat tidak ditemukan." }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      mandate,
    });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : "Gagal memuat mandat.";
    return NextResponse.json({ success: false, message: errorMsg }, { status: 500 });
  }
}

export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ success: false, message: "Akses ditolak: Silakan masuk." }, { status: 401 });
  }

  if (user.role !== "SYSTEM_ADMIN" && user.role !== "PENGURUS_YAYASAN") {
    return NextResponse.json({ success: false, message: "Akses ditolak: Hanya administrator atau pengurus yayasan yang berwenang memperbarui mandat." }, { status: 403 });
  }

  const { id } = await context.params;

  try {
    const body = await req.json();
    const parsed = updateMandateSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { success: false, message: parsed.error.issues[0]?.message || "Input pembaruan tidak valid." },
        { status: 400 }
      );
    }

    const updated = await db.updateSignatoryMandate(
      id,
      {
        canReview: parsed.data.canReview,
        canApprove: parsed.data.canApprove,
        canSign: parsed.data.canSign,
        validFrom: parsed.data.validFrom,
        validTo: parsed.data.validTo,
        status: parsed.data.status,
        decreeNumber: parsed.data.decreeNumber ? sanitizeString(parsed.data.decreeNumber) : undefined,
        notes: parsed.data.notes ? sanitizeString(parsed.data.notes) : undefined,
      },
      {
        id: user.id,
        name: user.displayName,
        role: user.role,
        organizationId: user.organizationId,
      }
    );

    if (!updated) {
      return NextResponse.json({ success: false, message: "Mandat tidak ditemukan." }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      message: "Mandat berhasil diperbarui.",
      mandate: updated,
    });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : "Gagal memperbarui mandat.";
    return NextResponse.json({ success: false, message: errorMsg }, { status: 400 });
  }
}

