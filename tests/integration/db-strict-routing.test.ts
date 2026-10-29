import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { db, DatabaseUnavailableError } from "@/lib/db";
import * as poolModule from "@/lib/db/pool";

describe("DB-05: Penanganan Kegagalan Offline & Pembatasan Mode Simulasi (Strict DB Routing)", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    vi.restoreAllMocks();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    vi.restoreAllMocks();
  });

  it("DB-05: ketika PostgreSQL gagal terhubung, operasi data harus melempar DatabaseUnavailableError (TIDAK ADA silent fallback ke memori)", async () => {
    // Simulasikan kegagalan koneksi PostgreSQL
    vi.spyOn(poolModule, "checkPostgresConnection").mockResolvedValue({
      connected: false,
      error: "connect ECONNREFUSED 127.0.0.1:5432",
      latencyMs: 12,
    });

    // Pastikan bukan mode simulasi
    delete process.env.DB_SIMULATION;

    // Operasi pembacaan data harus ditolak tegas
    await expect(db.getUserByEmail("staf.test@p4i.local")).rejects.toThrow(DatabaseUnavailableError);

    // Healthcheck harus mengembalikan status UNAVAILABLE
    const health = await db.getHealthStatus();
    expect(health.status).toBe("UNAVAILABLE");
    expect(health.connected).toBe(false);
    expect(health.mode).toBe("REAL_POSTGRES");
    expect(health.errorDetail).toContain("ECONNREFUSED");
  });

  it("DB-05: mode simulasi in-memory hanya boleh aktif jika DB_SIMULATION=true dan NODE_ENV=test secara eksplisit", async () => {
    process.env.DB_SIMULATION = "true";
    (process.env as Record<string, string | undefined>).NODE_ENV = "test";

    const health = await db.getHealthStatus();
    expect(health.status).toBe("SIMULATION");
    expect(health.mode).toBe("SIMULATION");
    expect(health.connected).toBe(false);
  });

  it("DB-05: mode simulasi in-memory mutlak ditolak dan tidak boleh aktif pada NODE_ENV=production", async () => {
    process.env.DB_SIMULATION = "true";
    (process.env as Record<string, string | undefined>).NODE_ENV = "production";

    // Pada production, router mengabaikan DB_SIMULATION dan tetap memvalidasi koneksi PostgreSQL riil
    const health = await db.getHealthStatus();
    expect(health.mode).toBe("REAL_POSTGRES");
    expect(health.status).not.toBe("SIMULATION");
  });

  it("DB-05: health status tidak boleh membocorkan password atau kredensial database riil", async () => {
    const health = await db.getHealthStatus();
    expect(health.target).not.toContain(":postgres@"); // Harus tertutup :***@
    expect(health.target).toMatch(/:\*\*\*@/);
  });
});
