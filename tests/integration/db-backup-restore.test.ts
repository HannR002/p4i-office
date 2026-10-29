import { describe, it, expect } from "vitest";
import { backupDatabase } from "@/../scripts/backup-db.mjs";
import { restoreDatabase } from "@/../scripts/restore-db.mjs";
import pg from "pg";

const { Client } = pg;

describe("DB-07: Verifikasi Prosedur Backup & Restore Otomatis Round-trip", () => {
  it("DB-07: backup p4i_office_test dan restore ke p4i_office_restore_test harus 100% cocok jumlah baris dan hash SHA-256", async () => {
    // 1. Jalankan backup dari p4i_office_test
    const backupRes = await backupDatabase("p4i_office_test");
    expect(backupRes.success).toBe(true);
    expect(backupRes.filePath).toBeDefined();
    expect(backupRes.manifest.totalRows).toBeGreaterThan(0);
    expect(backupRes.manifest.dataHash).toBeDefined();
    expect(backupRes.manifest.dataHash.length).toBe(64);

    // 2. Jalankan restore ke database target p4i_office_restore_test
    const restoreRes = await restoreDatabase("p4i_office_restore_test", backupRes.filePath);
    expect(restoreRes.success).toBe(true);
    expect(restoreRes.restoredRows).toBe(backupRes.manifest.totalRows);
    expect(restoreRes.isRowCountMatched).toBe(true);
    expect(restoreRes.isHashMatched).toBe(true);

    // 3. Verifikasi independen via Client PostgreSQL ke database restore
    const client = new Client("postgresql://postgres:postgres@localhost:5432/p4i_office_restore_test");
    await client.connect();

    const countLetters = await client.query("SELECT COUNT(*)::int AS count FROM letters;");
    const countRevs = await client.query("SELECT COUNT(*)::int AS count FROM letter_revisions;");
    const countUsers = await client.query("SELECT COUNT(*)::int AS count FROM users;");

    const tables = backupRes.manifest.tables as Record<string, number>;
    expect(countLetters.rows[0].count).toBe(tables.letters);
    expect(countRevs.rows[0].count).toBe(tables.letter_revisions);
    expect(countUsers.rows[0].count).toBe(tables.users);

    await client.end();
    console.log(`[DB-07: PASS] Round-trip backup & restore verified. Total rows: ${restoreRes.restoredRows}, Hash: ${backupRes.manifest.dataHash}`);
  });
});
