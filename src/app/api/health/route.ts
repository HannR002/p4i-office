import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    status: "healthy",
    app: "P4I Office",
    version: "1.0.0-sprint1a",
    environment: process.env.NODE_ENV || "development",
    timestamp: new Date().toISOString(),
    safetyGuards: {
      featureNumberingActive: false, // STRICTLY FALSE
      featureSigningActive: false,   // STRICTLY FALSE
      fictionalNumberingBlocked: true,
      mfaStatus: "GAP_PENDING_IMPLEMENTATION",
    },
    database: {
      urlConfigured: !!process.env.DATABASE_URL,
      target: "PostgreSQL 14+ (p4i_office_test)",
    },
  });
}
