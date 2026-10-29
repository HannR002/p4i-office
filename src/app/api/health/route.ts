import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET() {
  const dbHealth = await db.getHealthStatus();

  return NextResponse.json({
    status: dbHealth.connected ? "healthy" : (dbHealth.status === "SIMULATION" ? "simulation" : "degraded"),
    app: "P4I Office",
    version: "1.0.0-sprint1c",
    environment: process.env.NODE_ENV || "development",
    timestamp: new Date().toISOString(),
    safetyGuards: {
      featureNumberingActive: false, // STRICTLY FALSE
      featureSigningActive: false,   // STRICTLY FALSE
      fictionalNumberingBlocked: true,
      mfaStatus: "GAP_PENDING_IMPLEMENTATION",
    },
    database: {
      connected: dbHealth.connected,
      mode: dbHealth.mode,
      status: dbHealth.status,
      target: dbHealth.target,
      latencyMs: dbHealth.latencyMs,
      error: dbHealth.errorDetail,
    },
  });
}
