-- ==============================================================================
-- P4I OFFICE v1.0 — MIGRATION 0001_sprint1a_core.sql
-- Sprint 1A: Bootstrap, Security Foundation & Draf Surat
-- Target: PostgreSQL 14+ (Local Test & Staging)
-- ==============================================================================

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 1. Organisasi
CREATE TABLE IF NOT EXISTS organizations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  legal_name text NOT NULL,
  acronym varchar(32) NOT NULL,
  address_placeholder text DEFAULT 'Alamat belum diverifikasi',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 2. Unit Kerja Organisasi
CREATE TABLE IF NOT EXISTS org_units (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
  parent_id uuid REFERENCES org_units(id) ON DELETE RESTRICT,
  name text NOT NULL,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(organization_id, name)
);

-- 3. Pengguna Sistem
CREATE TABLE IF NOT EXISTS users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
  unit_id uuid REFERENCES org_units(id) ON DELETE RESTRICT,
  email text NOT NULL UNIQUE,
  display_name text NOT NULL,
  password_hash text NOT NULL,
  status text NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE','DISABLED','INVITED')),
  mfa_enabled boolean NOT NULL DEFAULT false,
  last_login_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 4. Peran Sistem (RBAC)
CREATE TABLE IF NOT EXISTS roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  role_key varchar(64) NOT NULL UNIQUE,
  label text NOT NULL
);

-- 5. Penugasan Peran Pengguna
CREATE TABLE IF NOT EXISTS user_roles (
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  role_id uuid NOT NULL REFERENCES roles(id) ON DELETE RESTRICT,
  granted_by uuid REFERENCES users(id) ON DELETE RESTRICT,
  granted_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, role_id)
);

-- 6. Kebijakan Penomoran (Safety: default is_active=false, legacy_reconciled=false)
CREATE TABLE IF NOT EXISTS numbering_policies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
  series_key varchar(64) NOT NULL,
  code varchar(40) NOT NULL,
  format_pattern text NOT NULL DEFAULT '{seq:03}/{code}/{month_roman}/{year}',
  reset_period text NOT NULL DEFAULT 'YEAR' CHECK (reset_period IN ('YEAR','MONTH','NONE')),
  padding smallint NOT NULL DEFAULT 3 CHECK (padding BETWEEN 1 AND 12),
  is_active boolean NOT NULL DEFAULT false,
  legacy_reconciled boolean NOT NULL DEFAULT false,
  approved_policy_ref text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(organization_id, series_key)
);

-- 7. Jenis Surat
CREATE TABLE IF NOT EXISTS letter_types (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
  code varchar(40) NOT NULL,
  label text NOT NULL,
  numbering_policy_id uuid REFERENCES numbering_policies(id) ON DELETE RESTRICT,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(organization_id, code)
);

-- 8. Templat Surat (Status Berversi)
CREATE TABLE IF NOT EXISTS letter_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
  letter_type_id uuid NOT NULL REFERENCES letter_types(id) ON DELETE RESTRICT,
  version integer NOT NULL CHECK(version > 0),
  title text NOT NULL,
  description text,
  form_schema jsonb NOT NULL DEFAULT '{}'::jsonb,
  content_template text NOT NULL DEFAULT '',
  is_active boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(letter_type_id, version)
);

-- 9. Surat Keluar (Fokus Sprint 1A: DRAFT & IN_REVIEW)
CREATE TABLE IF NOT EXISTS letters (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
  unit_id uuid REFERENCES org_units(id) ON DELETE RESTRICT,
  letter_type_id uuid NOT NULL REFERENCES letter_types(id) ON DELETE RESTRICT,
  template_id uuid REFERENCES letter_templates(id) ON DELETE RESTRICT,
  author_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  subject text NOT NULL,
  recipient_name text NOT NULL,
  classification text NOT NULL DEFAULT 'INTERNAL' CHECK (classification IN ('PUBLIC','INTERNAL','CONFIDENTIAL')),
  planned_date date NOT NULL DEFAULT CURRENT_DATE,
  status text NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT','IN_REVIEW','RETURNED','REVIEWED','APPROVED','NUMBERED','AWAITING_SIGNATURE','SIGNED','ISSUED','ARCHIVED','VOIDED')),
  current_revision_no integer NOT NULL DEFAULT 1 CHECK (current_revision_no > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 10. Riwayat Revisi Surat (IMMUTABLE: Tidak Boleh Ditimpa)
CREATE TABLE IF NOT EXISTS letter_revisions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  letter_id uuid NOT NULL REFERENCES letters(id) ON DELETE RESTRICT,
  version integer NOT NULL CHECK(version > 0),
  template_id uuid REFERENCES letter_templates(id) ON DELETE RESTRICT,
  subject text NOT NULL,
  recipient_name text NOT NULL,
  classification text NOT NULL,
  planned_date date NOT NULL,
  content jsonb NOT NULL,
  content_sha256 char(64) NOT NULL,
  change_summary text,
  created_by uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(letter_id, version)
);

-- 11. Audit Log Append-Only
CREATE TABLE IF NOT EXISTS audit_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid REFERENCES organizations(id) ON DELETE RESTRICT,
  actor_id uuid REFERENCES users(id) ON DELETE RESTRICT,
  event_type text NOT NULL,
  entity_type text NOT NULL,
  entity_id uuid,
  event_metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  occurred_at timestamptz NOT NULL DEFAULT now()
);

-- Indeks Kinerja
CREATE INDEX IF NOT EXISTS idx_letters_org_status_date ON letters(organization_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_letters_type ON letters(organization_id, letter_type_id);
CREATE INDEX IF NOT EXISTS idx_revisions_letter_ver ON letter_revisions(letter_id, version DESC);
CREATE INDEX IF NOT EXISTS idx_audit_org_time ON audit_events(organization_id, occurred_at DESC);

-- Trigger Immutability Audit Event (Mencegah UPDATE / DELETE pada tabel audit)
CREATE OR REPLACE FUNCTION reject_audit_mutation() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'Audit event bersifat append-only: mutasi UPDATE/DELETE dilarang!';
END $$;

DROP TRIGGER IF EXISTS trg_audit_no_update_delete ON audit_events;
CREATE TRIGGER trg_audit_no_update_delete
  BEFORE UPDATE OR DELETE ON audit_events
  FOR EACH ROW EXECUTE FUNCTION reject_audit_mutation();

COMMIT;
