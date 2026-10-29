import pg from "pg";

// Pastikan tipe data DATE (OID 1082) dikembalikan sebagai string YYYY-MM-DD tanpa distorsi zona waktu
pg.types.setTypeParser(1082, (val: string) => val);

let pool: pg.Pool | null = null;

export function getDatabaseUrl(): string {
  return process.env.DATABASE_URL || "postgresql://postgres:postgres@localhost:5432/p4i_office_test";
}

export function getMaskedDatabaseUrl(): string {
  const url = getDatabaseUrl();
  return url.replace(/:[^:@]+@/, ":***@");
}

export function getPgPool(): pg.Pool {
  if (!pool) {
    const connectionString = getDatabaseUrl();
    const ssl = process.env.DATABASE_SSL === "true" ? { rejectUnauthorized: false } : false;

    pool = new pg.Pool({
      connectionString,
      ssl,
      connectionTimeoutMillis: 2000,
      idleTimeoutMillis: 10000,
      max: 10,
    });

    pool.on("error", (err) => {
      console.warn("[P4I-PG-POOL] Pool error caught:", err.message);
    });
  }

  return pool;
}

/**
 * Memeriksa status konektivitas PostgreSQL riil.
 */
export async function checkPostgresConnection(): Promise<{
  connected: boolean;
  error?: string;
  latencyMs?: number;
}> {
  const start = Date.now();
  const currentPool = getPgPool();

  try {
    const client = await currentPool.connect();
    await client.query("SELECT 1 AS is_alive");
    client.release();
    return {
      connected: true,
      latencyMs: Date.now() - start,
    };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    return {
      connected: false,
      error: errorMsg,
      latencyMs: Date.now() - start,
    };
  }
}

/**
 * Menutup pool koneksi jika ada.
 */
export async function closePgPool(): Promise<void> {
  if (pool) {
    await pool.end().catch(() => {});
    pool = null;
  }
}
