-- ==============================================================================
-- P4I OFFICE v1.0 — MIGRATION 0003_sprint2_approval_workflow.sql
-- Sprint 2: Alur Persetujuan Surat Internal, Mandat Kewenangan & Jejak Keputusan
-- Target: PostgreSQL 14+
-- ==============================================================================

BEGIN;

-- 1. Pembaruan CHECK Constraint pada Status Surat (Mendukung SUBMITTED, CHANGES_REQUESTED, REJECTED)
ALTER TABLE letters 
  DROP CONSTRAINT IF EXISTS letters_status_check;

ALTER TABLE letters 
  ADD CONSTRAINT letters_status_check 
  CHECK (status IN (
    'DRAFT',
    'SUBMITTED',
    'IN_REVIEW',
    'CHANGES_REQUESTED',
    'RETURNED',
    'REJECTED',
    'REVIEWED',
    'APPROVED',
    'NUMBERED',
    'AWAITING_SIGNATURE',
    'SIGNED',
    'ISSUED',
    'ARCHIVED',
    'VOIDED'
  ));

-- 2. Tabel Mandat Kewenangan & Penandatanganan (Signatory & Reviewer Mandates)
CREATE TABLE IF NOT EXISTS signatory_mandates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  letter_type_id uuid REFERENCES letter_types(id) ON DELETE RESTRICT, -- NULL = berlaku umum per organisasi jika berwenang
  unit_id uuid REFERENCES org_units(id) ON DELETE RESTRICT, -- NULL = seluruh unit organisasi
  can_review boolean NOT NULL DEFAULT true,
  can_approve boolean NOT NULL DEFAULT false,
  can_sign boolean NOT NULL DEFAULT false,
  valid_from date NOT NULL DEFAULT CURRENT_DATE,
  valid_to date NOT NULL,
  status varchar(32) NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'REVOKED', 'EXPIRED')),
  decree_number text NOT NULL, -- Nomor SK / Surat Penetapan Mandat
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_mandates_user_status ON signatory_mandates(user_id, status);
CREATE INDEX IF NOT EXISTS idx_mandates_org_dates ON signatory_mandates(organization_id, valid_from, valid_to);
CREATE INDEX IF NOT EXISTS idx_mandates_type ON signatory_mandates(letter_type_id);

-- 3. Tabel Permintaan Persetujuan Alur Kerja (Approval Requests)
CREATE TABLE IF NOT EXISTS approval_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
  letter_id uuid NOT NULL REFERENCES letters(id) ON DELETE RESTRICT,
  revision_id uuid NOT NULL REFERENCES letter_revisions(id) ON DELETE RESTRICT,
  revision_version integer NOT NULL CHECK (revision_version > 0),
  content_sha256 char(64) NOT NULL,
  submitted_by uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  submitted_at timestamptz NOT NULL DEFAULT now(),
  status varchar(32) NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'IN_REVIEW', 'APPROVED', 'CHANGES_REQUESTED', 'REJECTED', 'SUPERSEDED')),
  submission_notes text,
  workflow_version integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_approval_req_letter ON approval_requests(letter_id, status);
CREATE INDEX IF NOT EXISTS idx_approval_req_revision ON approval_requests(revision_id);
CREATE INDEX IF NOT EXISTS idx_approval_req_status ON approval_requests(organization_id, status);

-- 4. Tabel Keputusan dan Langkah Persetujuan (Approval Steps / Decision History)
CREATE TABLE IF NOT EXISTS approval_steps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  approval_request_id uuid NOT NULL REFERENCES approval_requests(id) ON DELETE RESTRICT,
  letter_id uuid NOT NULL REFERENCES letters(id) ON DELETE RESTRICT,
  revision_id uuid NOT NULL REFERENCES letter_revisions(id) ON DELETE RESTRICT,
  step_no integer NOT NULL DEFAULT 1 CHECK (step_no > 0),
  reviewer_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  mandate_id uuid NOT NULL REFERENCES signatory_mandates(id) ON DELETE RESTRICT,
  decision varchar(32) NOT NULL CHECK (decision IN ('APPROVED', 'CHANGES_REQUESTED', 'REJECTED')),
  decision_content_sha256 char(64) NOT NULL,
  comments text,
  decided_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_approval_steps_request ON approval_steps(approval_request_id);
CREATE INDEX IF NOT EXISTS idx_approval_steps_letter ON approval_steps(letter_id, decided_at DESC);

-- 5. Tabel Riwayat Status Surat Menyeluruh (Letter Status History)
CREATE TABLE IF NOT EXISTS letter_status_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  letter_id uuid NOT NULL REFERENCES letters(id) ON DELETE RESTRICT,
  revision_id uuid REFERENCES letter_revisions(id) ON DELETE RESTRICT,
  from_status varchar(32) NOT NULL,
  to_status varchar(32) NOT NULL,
  actor_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  reason text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_letter_status_hist_letter ON letter_status_history(letter_id, created_at DESC);

COMMIT;

