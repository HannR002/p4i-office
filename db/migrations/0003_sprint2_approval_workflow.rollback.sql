-- ==============================================================================
-- P4I OFFICE v1.0 — ROLLBACK 0003_sprint2_approval_workflow.rollback.sql
-- Rollback untuk Migrasi Sprint 2
-- ==============================================================================

BEGIN;

DROP TABLE IF EXISTS letter_status_history CASCADE;
DROP TABLE IF EXISTS approval_steps CASCADE;
DROP TABLE IF EXISTS approval_requests CASCADE;
DROP TABLE IF EXISTS signatory_mandates CASCADE;

-- Kembalikan CHECK constraint status surat ke versi Sprint 1A
ALTER TABLE letters 
  DROP CONSTRAINT IF EXISTS letters_status_check;

ALTER TABLE letters 
  ADD CONSTRAINT letters_status_check 
  CHECK (status IN (
    'DRAFT',
    'IN_REVIEW',
    'RETURNED',
    'REVIEWED',
    'APPROVED',
    'NUMBERED',
    'AWAITING_SIGNATURE',
    'SIGNED',
    'ISSUED',
    'ARCHIVED',
    'VOIDED'
  ));

DELETE FROM schema_migrations WHERE version = '0003_sprint2_approval_workflow.sql';

COMMIT;

