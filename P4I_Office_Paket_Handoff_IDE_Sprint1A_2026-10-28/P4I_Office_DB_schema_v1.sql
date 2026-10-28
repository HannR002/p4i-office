-- P4I OFFICE v1.0 | POSTGRESQL REFERENCE SCHEMA
-- 28 October 2026 | DRAFT: review, test and sign off before deployment.
-- Not production-ready by itself: authentication implementation, row-level security,
-- grants, migrations, tenant isolation, storage policies, backups and data import
-- must be implemented and verified separately.
-- DO NOT seed fictional issued numbers or signatory mandates.

BEGIN;
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE organizations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  legal_name text NOT NULL,
  acronym varchar(32) NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE org_units (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
  parent_id uuid REFERENCES org_units(id) ON DELETE RESTRICT,
  name text NOT NULL,
  active boolean NOT NULL DEFAULT true,
  UNIQUE(organization_id,name)
);

CREATE TABLE users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
  unit_id uuid REFERENCES org_units(id) ON DELETE RESTRICT,
  email text NOT NULL UNIQUE,
  display_name text NOT NULL,
  password_hash text,                 -- Omit when using external identity provider
  status text NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE','DISABLED','INVITED')),
  mfa_enabled boolean NOT NULL DEFAULT false,
  last_login_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  role_key varchar(64) NOT NULL UNIQUE,
  label text NOT NULL
);

CREATE TABLE user_roles (
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  role_id uuid NOT NULL REFERENCES roles(id) ON DELETE RESTRICT,
  granted_by uuid REFERENCES users(id) ON DELETE RESTRICT,
  granted_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(user_id,role_id)
);

CREATE TABLE numbering_policies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
  series_key varchar(64) NOT NULL,
  code varchar(40) NOT NULL,
  format_pattern text NOT NULL DEFAULT '{seq:03}/{code}/{month_roman}/{year}',
  reset_period text NOT NULL DEFAULT 'YEAR' CHECK(reset_period IN ('YEAR','MONTH','NONE')),
  padding smallint NOT NULL DEFAULT 3 CHECK (padding BETWEEN 1 AND 12),
  is_active boolean NOT NULL DEFAULT false,
  legacy_reconciled boolean NOT NULL DEFAULT false,
  approved_policy_ref text,            -- e.g. approved SOP/SK evidence reference
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(organization_id,series_key)
);

CREATE TABLE letter_types (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
  code varchar(40) NOT NULL,
  label text NOT NULL,
  numbering_policy_id uuid REFERENCES numbering_policies(id) ON DELETE RESTRICT,
  is_active boolean NOT NULL DEFAULT true,
  UNIQUE(organization_id,code)
);

CREATE TABLE signatory_mandates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  letter_type_id uuid REFERENCES letter_types(id) ON DELETE RESTRICT,
  can_review boolean NOT NULL DEFAULT false,
  can_approve boolean NOT NULL DEFAULT false,
  can_sign boolean NOT NULL DEFAULT false,
  valid_from date NOT NULL,
  valid_to date,
  evidence_reference text NOT NULL,
  revoked_at timestamptz,
  CHECK(valid_to IS NULL OR valid_to >= valid_from)
);

CREATE TABLE letter_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
  letter_type_id uuid NOT NULL REFERENCES letter_types(id) ON DELETE RESTRICT,
  version integer NOT NULL CHECK(version > 0),
  storage_key text NOT NULL,
  form_schema jsonb NOT NULL DEFAULT '{}'::jsonb,
  file_sha256 char(64) NOT NULL,
  is_active boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(letter_type_id,version)
);

CREATE TABLE letters (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
  unit_id uuid REFERENCES org_units(id) ON DELETE RESTRICT,
  letter_type_id uuid NOT NULL REFERENCES letter_types(id) ON DELETE RESTRICT,
  template_id uuid REFERENCES letter_templates(id) ON DELETE RESTRICT,
  author_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  intended_signer_id uuid REFERENCES users(id) ON DELETE RESTRICT,
  subject text NOT NULL,
  recipient_name text NOT NULL,
  classification text NOT NULL DEFAULT 'INTERNAL' CHECK(classification IN ('PUBLIC','INTERNAL','CONFIDENTIAL')),
  status text NOT NULL DEFAULT 'DRAFT'
    CHECK(status IN('DRAFT','IN_REVIEW','RETURNED','REVIEWED','APPROVED','NUMBERED','AWAITING_SIGNATURE','SIGNED','ISSUED','ARCHIVED','VOIDED')),
  current_revision_no integer NOT NULL DEFAULT 1 CHECK(current_revision_no > 0),
  signed_at timestamptz,
  signed_by uuid REFERENCES users(id) ON DELETE RESTRICT,
  issued_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE letter_revisions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  letter_id uuid NOT NULL REFERENCES letters(id) ON DELETE RESTRICT,
  version integer NOT NULL CHECK(version > 0),
  template_id uuid NOT NULL REFERENCES letter_templates(id) ON DELETE RESTRICT,
  content jsonb NOT NULL,
  content_sha256 char(64) NOT NULL,
  created_by uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(letter_id,version)
);

CREATE TABLE approval_steps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  letter_id uuid NOT NULL REFERENCES letters(id) ON DELETE RESTRICT,
  revision_id uuid NOT NULL REFERENCES letter_revisions(id) ON DELETE RESTRICT,
  step_no smallint NOT NULL CHECK(step_no > 0),
  actor_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  decision text NOT NULL CHECK(decision IN ('REVIEWED','APPROVED','RETURNED','REJECTED')),
  note text,
  revision_hash char(64) NOT NULL,
  decided_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(letter_id,revision_id,step_no,actor_id,decision)
);

CREATE TABLE number_counters (
  policy_id uuid NOT NULL REFERENCES numbering_policies(id) ON DELETE RESTRICT,
  period_key varchar(32) NOT NULL,
  next_sequence bigint NOT NULL CHECK(next_sequence > 0),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(policy_id,period_key)
);

CREATE TABLE legacy_import_batches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
  source_label text NOT NULL,
  imported_by uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  status text NOT NULL DEFAULT 'STAGED' CHECK(status IN('STAGED','CONFLICT','RECONCILED','APPROVED')),
  reconciliation_note text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE legacy_import_rows (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id uuid NOT NULL REFERENCES legacy_import_batches(id) ON DELETE RESTRICT,
  source_row_no integer NOT NULL CHECK(source_row_no > 0),
  original_number text,
  original_date date,
  original_subject text,
  status text NOT NULL DEFAULT 'STAGED' CHECK(status IN('STAGED','CONFLICT','VERIFIED','SKIPPED')),
  conflict_reason text,
  source_file_reference text,
  UNIQUE(batch_id,source_row_no)
);

CREATE TABLE letter_numbers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
  letter_id uuid UNIQUE REFERENCES letters(id) ON DELETE RESTRICT, -- legacy may be unresolved
  policy_id uuid REFERENCES numbering_policies(id) ON DELETE RESTRICT,
  period_key varchar(32),
  sequence_no bigint,
  number_full text NOT NULL,
  normalized_number text GENERATED ALWAYS AS (regexp_replace(upper(btrim(number_full)), '[[:space:]]+', '', 'g')) STORED,
  source text NOT NULL CHECK(source IN ('NEW','LEGACY')),
  verification_status text NOT NULL DEFAULT 'VERIFIED' CHECK(verification_status IN ('UNVERIFIED','VERIFIED','CONFLICT')),
  legacy_batch_id uuid REFERENCES legacy_import_batches(id) ON DELETE RESTRICT,
  allocated_at timestamptz NOT NULL DEFAULT now(),
  voided_at timestamptz,
  void_reason text,
  voided_by uuid REFERENCES users(id) ON DELETE RESTRICT,
  UNIQUE(organization_id,normalized_number),
  UNIQUE(policy_id,period_key,sequence_no),
  CHECK(source='LEGACY' OR (letter_id IS NOT NULL AND policy_id IS NOT NULL AND sequence_no IS NOT NULL)),
  CHECK(voided_at IS NULL OR void_reason IS NOT NULL)
);

CREATE TABLE document_files (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
  letter_id uuid REFERENCES letters(id) ON DELETE RESTRICT,
  category text NOT NULL CHECK(category IN ('DRAFT_DOCX','APPROVED_DOCX','PREVIEW_PDF','FINAL_PDF','SIGNED_SCAN','ATTACHMENT','INCOMING_SCAN','DISPATCH_PROOF','MANDATE_PROOF')),
  storage_key text NOT NULL UNIQUE,
  mime_type text NOT NULL,
  byte_size bigint NOT NULL CHECK(byte_size >= 0),
  sha256 char(64) NOT NULL,
  is_final boolean NOT NULL DEFAULT false,
  uploaded_by uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  uploaded_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE incoming_agenda_counters (
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
  agenda_year integer NOT NULL,
  next_sequence bigint NOT NULL CHECK(next_sequence > 0),
  PRIMARY KEY(organization_id,agenda_year)
);

CREATE TABLE incoming_letters (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
  recipient_unit_id uuid REFERENCES org_units(id) ON DELETE RESTRICT,
  agenda_year integer NOT NULL,
  agenda_sequence bigint NOT NULL,
  agenda_number text NOT NULL,
  external_number text, -- remains sender's original number
  sender_name text NOT NULL,
  subject text NOT NULL,
  sender_date date,
  received_at timestamptz NOT NULL DEFAULT now(),
  file_id uuid REFERENCES document_files(id) ON DELETE RESTRICT,
  created_by uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  UNIQUE(organization_id,agenda_year,agenda_sequence),
  UNIQUE(organization_id,agenda_number)
);

CREATE TABLE outgoing_dispatches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  letter_id uuid NOT NULL REFERENCES letters(id) ON DELETE RESTRICT,
  delivered_at timestamptz NOT NULL,
  channel text NOT NULL,
  recipient text NOT NULL,
  evidence_file_id uuid REFERENCES document_files(id) ON DELETE RESTRICT,
  recorded_by uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT
);

CREATE TABLE audit_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid REFERENCES organizations(id) ON DELETE RESTRICT,
  actor_id uuid REFERENCES users(id) ON DELETE RESTRICT,
  event_type text NOT NULL,
  entity_type text NOT NULL,
  entity_id uuid,
  event_metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  occurred_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE backup_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  started_at timestamptz NOT NULL,
  finished_at timestamptz,
  scope text NOT NULL CHECK(scope IN('DATABASE','FILES','BOTH')),
  status text NOT NULL CHECK(status IN('RUNNING','SUCCEEDED','FAILED')),
  artifact_reference text,
  restored_test_at timestamptz,
  error_summary text
);

CREATE INDEX idx_letters_org_status_date ON letters(organization_id,status,created_at DESC);
CREATE INDEX idx_letters_type ON letters(organization_id,letter_type_id);
CREATE INDEX idx_letters_subject_fts ON letters USING gin(to_tsvector('simple',subject));
CREATE INDEX idx_documents_letter ON document_files(letter_id,category);
CREATE INDEX idx_incoming_org_date ON incoming_letters(organization_id,received_at DESC);
CREATE INDEX idx_approvals_letter_revision ON approval_steps(letter_id,revision_id,step_no);
CREATE INDEX idx_number_issued ON letter_numbers(organization_id,allocated_at DESC);
CREATE INDEX idx_audit_org_time ON audit_events(organization_id,occurred_at DESC);
CREATE INDEX idx_mandates_user_type ON signatory_mandates(user_id,letter_type_id,valid_from);

-- Audit events are append-only at application level; this trigger blocks accidental
-- update/delete by non-superusers. Also configure appropriate DB GRANT/REVOKE.
CREATE OR REPLACE FUNCTION reject_audit_mutation() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'audit_events are append-only';
END $$;
CREATE TRIGGER trg_audit_no_update_delete
  BEFORE UPDATE OR DELETE ON audit_events
  FOR EACH ROW EXECUTE FUNCTION reject_audit_mutation();

-- Atomic allocation for one fully approved letter.
-- The application must still verify all required approval steps, signatory
-- authorization, organizational scope, document data completeness and mandate
-- conflicts before invocation. This function adds defense-in-depth checks.
CREATE OR REPLACE FUNCTION p4i_allocate_number(
  p_letter_id uuid,
  p_actor_id uuid
) RETURNS text
LANGUAGE plpgsql AS $$
DECLARE
  v_org uuid;
  v_type uuid;
  v_version integer;
  v_status text;
  v_policy uuid;
  v_code text;
  v_pattern text;
  v_reset text;
  v_pad integer;
  v_enabled boolean;
  v_reconciled boolean;
  v_existing text;
  v_period text;
  v_seq bigint;
  v_local timestamp;
  v_time timestamptz := clock_timestamp();
  v_month int;
  v_month_roman text;
  v_full text;
  v_hash text;
BEGIN
  SELECT organization_id,letter_type_id,current_revision_no,status
    INTO v_org,v_type,v_version,v_status
  FROM letters WHERE id=p_letter_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'letter not found'; END IF;

  SELECT number_full INTO v_existing FROM letter_numbers WHERE letter_id=p_letter_id;
  IF FOUND THEN RETURN v_existing; END IF; -- idempotency for same letter
  IF v_status <> 'APPROVED' THEN RAISE EXCEPTION 'letter must be APPROVED'; END IF;

  SELECT r.content_sha256 INTO v_hash FROM letter_revisions r
  WHERE r.letter_id=p_letter_id AND r.version=v_version;
  IF v_hash IS NULL THEN RAISE EXCEPTION 'approved revision missing'; END IF;
  IF NOT EXISTS (
    SELECT 1 FROM approval_steps a
    WHERE a.letter_id=p_letter_id
      AND a.revision_hash=v_hash
      AND a.decision='APPROVED'
      AND EXISTS (
        SELECT 1 FROM signatory_mandates m
        WHERE m.user_id=a.actor_id AND m.organization_id=v_org
          AND (m.letter_type_id=v_type OR m.letter_type_id IS NULL)
          AND m.can_approve=true AND m.revoked_at IS NULL
          AND (v_time AT TIME ZONE 'Asia/Jakarta')::date >= m.valid_from
          AND (m.valid_to IS NULL OR (v_time AT TIME ZONE 'Asia/Jakarta')::date <= m.valid_to)
      )
  ) THEN RAISE EXCEPTION 'valid approval mandate not found'; END IF;

  SELECT p.id,p.code,p.format_pattern,p.reset_period,p.padding,p.is_active,p.legacy_reconciled
  INTO v_policy,v_code,v_pattern,v_reset,v_pad,v_enabled,v_reconciled
  FROM letter_types t JOIN numbering_policies p ON p.id=t.numbering_policy_id
  WHERE t.id=v_type AND t.organization_id=v_org AND t.is_active=true
    AND p.organization_id=v_org;
  IF v_policy IS NULL OR v_enabled IS DISTINCT FROM true OR v_reconciled IS DISTINCT FROM true
  THEN RAISE EXCEPTION 'numbering policy unapproved, inactive or legacy not reconciled'; END IF;

  v_local := v_time AT TIME ZONE 'Asia/Jakarta';
  v_month := EXTRACT(MONTH FROM v_local)::int;
  v_month_roman := (ARRAY['I','II','III','IV','V','VI','VII','VIII','IX','X','XI','XII'])[v_month];
  v_period := CASE v_reset
      WHEN 'MONTH' THEN to_char(v_local,'YYYY-MM')
      WHEN 'YEAR' THEN to_char(v_local,'YYYY')
      ELSE 'GLOBAL' END;

  INSERT INTO number_counters(policy_id,period_key,next_sequence)
  VALUES(v_policy,v_period,2)
  ON CONFLICT(policy_id,period_key)
  DO UPDATE SET next_sequence=number_counters.next_sequence+1,
                updated_at=v_time
  RETURNING next_sequence-1 INTO v_seq;

  v_full := replace(v_pattern,'{seq:03}',lpad(v_seq::text,v_pad,'0'));
  v_full := replace(v_full,'{seq}',lpad(v_seq::text,v_pad,'0'));
  v_full := replace(v_full,'{code}',v_code);
  v_full := replace(v_full,'{month_roman}',v_month_roman);
  v_full := replace(v_full,'{year}',to_char(v_local,'YYYY'));

  INSERT INTO letter_numbers(organization_id,letter_id,policy_id,period_key,sequence_no,
                             number_full,source,verification_status,allocated_at)
  VALUES(v_org,p_letter_id,v_policy,v_period,v_seq,v_full,'NEW','VERIFIED',v_time);
  UPDATE letters SET status='NUMBERED',updated_at=v_time WHERE id=p_letter_id;
  INSERT INTO audit_events(organization_id,actor_id,event_type,entity_type,entity_id,event_metadata)
  VALUES(v_org,p_actor_id,'NUMBER_ALLOCATED','letter',p_letter_id,
         jsonb_build_object('number',v_full,'policy_id',v_policy,'revision_hash',v_hash));
  RETURN v_full;
END $$;

COMMIT;

-- GO-LIVE CHECKS (manual):
-- [ ] Validate AD/ART & mandate evidence and implement full approval-step policy.
-- [ ] Import historical register, retain original numbers, reconcile conflicts.
-- [ ] Seed number_counters(policy_id, period_key, next_sequence) from verified ledger
--     BEFORE setting numbering_policies.legacy_reconciled = true.
-- [ ] No fictitious counter values in production.
-- [ ] DB role grants/RLS, tenant checks, and endpoint authorization tested.
-- [ ] 100 concurrent allocations + idempotent retries tested.
-- [ ] Object storage private, restore drill passed, document checksums verified.
