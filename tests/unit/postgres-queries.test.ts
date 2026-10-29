import { describe, it, expect } from "vitest";
import { PostgresDatabaseStore } from "@/lib/db/postgres-repository";
import fs from "fs";
import path from "path";

describe("T01–T05 / Static SQL Audit: Verifikasi Sintaks SQL PostgreSQL Repository", () => {
  it("harus memastikan seluruh query SQL di postgres-repository.ts menggunakan parameterisasi ($1, $2, ...) tanpa string concatenation", () => {
    const repoFilePath = path.resolve("src/lib/db/postgres-repository.ts");
    const code = fs.readFileSync(repoFilePath, "utf-8");

    // Cari panggilan client.query atau pool.query
    const queryCalls = code.match(/(client|pool)\.query\s*\([^)]+\)/g) || [];
    expect(queryCalls.length).toBeGreaterThan(5);

    // Pastikan tidak ada raw SQL concatenation berbahaya seperti "${" di dalam string query
    const forbiddenConcatenations = code.match(/query\s*\(`[^`]*\$\{[^}]+\}[^`]*`\)/g);
    expect(forbiddenConcatenations).toBeNull();
  });

  it("harus memastikan penguncian baris FOR UPDATE digunakan pada operasi addRevision dan submitForReview", () => {
    const repoFilePath = path.resolve("src/lib/db/postgres-repository.ts");
    const code = fs.readFileSync(repoFilePath, "utf-8");

    expect(code).toContain("FOR UPDATE");
    expect(code).toContain("BEGIN;");
    expect(code).toContain("COMMIT;");
    expect(code).toContain("ROLLBACK;");
  });

  it("harus memastikan migrasi 0001 dan 0002 memiliki struktur SQL valid", () => {
    const m1Path = path.resolve("db/migrations/0001_sprint1a_core.sql");
    const m2Path = path.resolve("db/migrations/0002_sprint1b_persistence.sql");

    expect(fs.existsSync(m1Path)).toBe(true);
    expect(fs.existsSync(m2Path)).toBe(true);

    const m1Sql = fs.readFileSync(m1Path, "utf-8");
    const m2Sql = fs.readFileSync(m2Path, "utf-8");

    // Memeriksa tabel inti
    expect(m1Sql).toContain("CREATE TABLE IF NOT EXISTS letters");
    expect(m1Sql).toContain("CREATE TABLE IF NOT EXISTS letter_revisions");
    expect(m1Sql).toContain("UNIQUE(letter_id, version)");
    expect(m1Sql).toContain("CREATE TABLE IF NOT EXISTS audit_events");

    // Memeriksa tabel migrasi Sprint 1B
    expect(m2Sql).toContain("CREATE TABLE IF NOT EXISTS schema_migrations");
    expect(m2Sql).toContain("ALTER TABLE letter_types");
    expect(m2Sql).toContain("idx_letters_author_status");
  });

  it("harus menolak upaya pemanggilan allocateOfficialNumber pada PostgresDatabaseStore", () => {
    const pgStore = new PostgresDatabaseStore();
    expect(() => {
      pgStore.allocateOfficialNumber();
    }).toThrowError(/BLOCKED: Penomoran surat resmi terkunci pada Sprint 1B/);
  });
});
