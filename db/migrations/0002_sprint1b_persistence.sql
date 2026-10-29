-- ==============================================================================
-- P4I OFFICE v1.0 — MIGRATION 0002_sprint1b_persistence.sql
-- Sprint 1B: Pelacakan Migrasi, Ekstensi Skema & Indeks Keamanan
-- Target: PostgreSQL 14+
-- ==============================================================================

BEGIN;

-- 1. Tabel Pelacakan Migrasi Skema
CREATE TABLE IF NOT EXISTS schema_migrations (
  version varchar(255) PRIMARY KEY,
  applied_at timestamptz NOT NULL DEFAULT now(),
  checksum text
);

-- 2. Kolom Prioritas pada Jenis Surat (P0 / P1)
ALTER TABLE letter_types 
  ADD COLUMN IF NOT EXISTS priority varchar(10) NOT NULL DEFAULT 'P0';

-- 3. Indeks Kinerja dan Audit
CREATE INDEX IF NOT EXISTS idx_letters_author_status ON letters(author_id, status);
CREATE INDEX IF NOT EXISTS idx_letters_classification ON letters(classification);
CREATE INDEX IF NOT EXISTS idx_letter_revisions_created_by ON letter_revisions(created_by);

COMMIT;
