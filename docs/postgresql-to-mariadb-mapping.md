# Pemetaan Basis Data PostgreSQL ke MariaDB (PostgreSQL to MariaDB Mapping)
## P4I Office v1.0: Skema Transasional InnoDB & Penyelarasan Dialek SQL

**Dokumen:** `docs/postgresql-to-mariadb-mapping.md`  
**Tanggal:** 30 Oktober 2026  
**Pelaksana Teknis:** Gemini Flash 3.8 (Reasoning High) — Lead Software Engineer  
**Tim Perancangan & Arsitek Sistem:** GPT-6 (Software Architect & Penulis Laporan Resmi)  
**Pemilik Keputusan Administratif:** Ketua / Pengurus Yayasan P4I  
**Lingkungan Target:** MariaDB 10.4.32+ on Hostinger Web / Cloud Hosting (Storage Engine: InnoDB)  

---

### 1. Prinsip & Kaidah Konversi

Konversi skema dari PostgreSQL ke MariaDB **bukan sekadar translasi sintaks SQL mentah**, melainkan penyesuaian struktural untuk menjamin:
1. **Dukungan Penuh Transaksi ACID & Row-Level Locking:** Seluruh tabel menggunakan mesin penyimpanan **InnoDB** (`ENGINE=InnoDB ROW_FORMAT=DYNAMIC`). Mesin MyISAM mutlak dilarang karena tidak mendukung transaksi dan foreign key.
2. **Keterbacaan dan Ketahanan UUID:** Menggunakan kolom `CHAR(36)` berformat string UUID v4 standar (`xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx`) yang dikelola otomatis oleh Laravel trait `HasUuids`. Hal ini mempermudah audit trail, inspeksi manual oleh pengurus, serta interoperabilitas antar-sistem.
3. **Integritas Referensial Ketat:** Seluruh relasi induk-anak mempertahankan batasan `ON DELETE RESTRICT` untuk mencegah penghapusan data master (pengguna, jenis surat, unit) yang telah memiliki relasi transaksi persuratan.
4. **Append-Only & Immutabilitas Revisi:** Proteksi mutasi pada tabel `audit_events` dan `letter_revisions` ditegakkan melalui kombinasi Trigger SQL MariaDB (`SIGNAL SQLSTATE '45000'`) dan Eloquent Model Observers.

---

### 2. Matriks Komparasi Tipe Data (PostgreSQL vs MariaDB)

| Tipe Data PostgreSQL | Tipe Ekuivalen MariaDB InnoDB | Laravel Migration Blueprint | Alasan & Mitigasi Teknis |
|---|---|---|---|
| `uuid` (128-bit native) | `CHAR(36)` (Character String) | `$table->uuid('id')->primary();` | Kompatibilitas universal di MariaDB, integrasi native dengan trait `HasUuids` Laravel, mudah diaudit di phpMyAdmin Hostinger. |
| `jsonb` (Binary JSON) | `JSON` (Alias `LONGTEXT` + `JSON_VALID`) | `$table->json('content');` | MariaDB 10.4+ mendukung validasi JSON otomatis. Di level Laravel, dicasting sebagai `array` via Eloquent `$casts`. |
| `timestamptz` (Timestamp with TZ) | `DATETIME(6)` / `TIMESTAMP` | `$table->timestamps();` / `$table->timestamp(...)` | Disimpan dalam format UTC standar. Konversi zona waktu (WIB / GMT+7) dilakukan pada level aplikasi Laravel. |
| `date` (Date only) | `DATE` | `$table->date('planned_date');` | Format standar `YYYY-MM-DD`, bebas distorsi zona waktu. |
| `boolean` (`true`/`false`) | `TINYINT(1)` (`1`/`0`) | `$table->boolean('is_active');` | Diterjemahkan otomatis oleh Laravel PDO MySQL connector ke tipe PHP `boolean`. |
| `text` (Unbounded string) | `TEXT` / `LONGTEXT` | `$table->text('notes')->nullable();` | Menampung catatan telaah dan draf isi surat panjang. |
| `varchar(n)` | `VARCHAR(n)` | `$table->string('code', n);` | Diberikan batas panjang eksplisit dengan collation `utf8mb4_unicode_ci`. |
| `CHECK (status IN (...))` | `CHECK (status IN (...))` | `$table->string('status')->...` | MariaDB 10.2.1+ mengevaluasi CHECK constraint secara native. Diperkuat oleh enum validation di Laravel. |

---

### 3. Pemetaan Skema 15 Tabel Relasional (Topological Order)

Seluruh tabel berikut dipetakan secara terstruktur ke dalam Laravel Migration:

#### 3.1 `organizations`
- **PostgreSQL:** `id uuid PK`, `legal_name text`, `acronym varchar(32)`, `address_placeholder text`, `created_at timestamptz`, `updated_at timestamptz`.
- **MariaDB InnoDB:**
  ```sql
  CREATE TABLE organizations (
    id CHAR(36) PRIMARY KEY,
    legal_name VARCHAR(255) NOT NULL,
    acronym VARCHAR(32) NOT NULL,
    address_placeholder TEXT NULL,
    created_at TIMESTAMP NULL,
    updated_at TIMESTAMP NULL
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  ```

#### 3.2 `org_units`
- **PostgreSQL:** `id uuid PK`, `organization_id uuid FK`, `parent_id uuid FK NULL`, `name text`, `active boolean`, `created_at timestamptz`, `UNIQUE(organization_id, name)`.
- **MariaDB InnoDB:**
  ```sql
  CREATE TABLE org_units (
    id CHAR(36) PRIMARY KEY,
    organization_id CHAR(36) NOT NULL,
    parent_id CHAR(36) NULL,
    name VARCHAR(255) NOT NULL,
    active TINYINT(1) NOT NULL DEFAULT 1,
    created_at TIMESTAMP NULL,
    updated_at TIMESTAMP NULL,
    UNIQUE KEY uq_org_units_name (organization_id, name),
    FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE RESTRICT,
    FOREIGN KEY (parent_id) REFERENCES org_units(id) ON DELETE RESTRICT
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  ```

#### 3.3 `users`
- **PostgreSQL:** `id uuid PK`, `organization_id uuid FK`, `unit_id uuid FK NULL`, `email text UNIQUE`, `display_name text`, `password_hash text`, `status text`, `mfa_enabled boolean`, `last_login_at timestamptz`, `created_at`, `updated_at`.
- **MariaDB InnoDB:**
  ```sql
  CREATE TABLE users (
    id CHAR(36) PRIMARY KEY,
    organization_id CHAR(36) NOT NULL,
    unit_id CHAR(36) NULL,
    email VARCHAR(255) NOT NULL UNIQUE,
    display_name VARCHAR(255) NOT NULL,
    password VARCHAR(255) NOT NULL,
    status VARCHAR(32) NOT NULL DEFAULT 'ACTIVE',
    mfa_enabled TINYINT(1) NOT NULL DEFAULT 0,
    last_login_at TIMESTAMP NULL,
    created_at TIMESTAMP NULL,
    updated_at TIMESTAMP NULL,
    FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE RESTRICT,
    FOREIGN KEY (unit_id) REFERENCES org_units(id) ON DELETE RESTRICT
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  ```

#### 3.4 `roles` & `user_roles`
- **MariaDB InnoDB:**
  ```sql
  CREATE TABLE roles (
    id CHAR(36) PRIMARY KEY,
    role_key VARCHAR(64) NOT NULL UNIQUE,
    label VARCHAR(255) NOT NULL
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

  CREATE TABLE user_roles (
    user_id CHAR(36) NOT NULL,
    role_id CHAR(36) NOT NULL,
    granted_by CHAR(36) NULL,
    granted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (user_id, role_id),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE RESTRICT,
    FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE RESTRICT
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  ```

#### 3.5 `numbering_policies` (Safety: is_active=0)
- **MariaDB InnoDB:**
  ```sql
  CREATE TABLE numbering_policies (
    id CHAR(36) PRIMARY KEY,
    organization_id CHAR(36) NOT NULL,
    series_key VARCHAR(64) NOT NULL,
    code VARCHAR(40) NOT NULL,
    format_pattern VARCHAR(255) NOT NULL DEFAULT '{seq:03}/{code}/{month_roman}/{year}',
    reset_period VARCHAR(16) NOT NULL DEFAULT 'YEAR',
    padding SMALLINT NOT NULL DEFAULT 3,
    is_active TINYINT(1) NOT NULL DEFAULT 0, -- SAFETY: Tetap 0 di Sprint M0
    legacy_reconciled TINYINT(1) NOT NULL DEFAULT 0,
    approved_policy_ref VARCHAR(255) NULL,
    created_at TIMESTAMP NULL,
    updated_at TIMESTAMP NULL,
    UNIQUE KEY uq_org_series (organization_id, series_key),
    FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE RESTRICT
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  ```

#### 3.6 `letter_types`
- **MariaDB InnoDB:**
  ```sql
  CREATE TABLE letter_types (
    id CHAR(36) PRIMARY KEY,
    organization_id CHAR(36) NOT NULL,
    code VARCHAR(40) NOT NULL,
    label VARCHAR(255) NOT NULL,
    priority VARCHAR(10) NOT NULL DEFAULT 'P0',
    numbering_policy_id CHAR(36) NULL,
    is_active TINYINT(1) NOT NULL DEFAULT 1,
    created_at TIMESTAMP NULL,
    updated_at TIMESTAMP NULL,
    UNIQUE KEY uq_org_code (organization_id, code),
    FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE RESTRICT,
    FOREIGN KEY (numbering_policy_id) REFERENCES numbering_policies(id) ON DELETE RESTRICT
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  ```

#### 3.7 `letter_templates`
- **MariaDB InnoDB:**
  ```sql
  CREATE TABLE letter_templates (
    id CHAR(36) PRIMARY KEY,
    organization_id CHAR(36) NOT NULL,
    letter_type_id CHAR(36) NOT NULL,
    version INT NOT NULL,
    title VARCHAR(255) NOT NULL,
    description TEXT NULL,
    form_schema JSON NOT NULL,
    content_template LONGTEXT NOT NULL,
    is_active TINYINT(1) NOT NULL DEFAULT 0,
    created_at TIMESTAMP NULL,
    updated_at TIMESTAMP NULL,
    UNIQUE KEY uq_type_version (letter_type_id, version),
    FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE RESTRICT,
    FOREIGN KEY (letter_type_id) REFERENCES letter_types(id) ON DELETE RESTRICT
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  ```

#### 3.8 `letters` (official_number = NULL)
- **MariaDB InnoDB:**
  ```sql
  CREATE TABLE letters (
    id CHAR(36) PRIMARY KEY,
    organization_id CHAR(36) NOT NULL,
    unit_id CHAR(36) NULL,
    letter_type_id CHAR(36) NOT NULL,
    template_id CHAR(36) NULL,
    author_id CHAR(36) NOT NULL,
    subject VARCHAR(255) NOT NULL,
    recipient_name VARCHAR(255) NOT NULL,
    classification VARCHAR(32) NOT NULL DEFAULT 'INTERNAL',
    planned_date DATE NOT NULL,
    status VARCHAR(32) NOT NULL DEFAULT 'DRAFT',
    current_revision_no INT NOT NULL DEFAULT 1,
    official_number VARCHAR(128) NULL, -- SAFETY: Tetap NULL
    created_at TIMESTAMP NULL,
    updated_at TIMESTAMP NULL,
    KEY idx_letters_org_status (organization_id, status),
    KEY idx_letters_author_status (author_id, status),
    KEY idx_letters_classification (classification),
    FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE RESTRICT,
    FOREIGN KEY (unit_id) REFERENCES org_units(id) ON DELETE RESTRICT,
    FOREIGN KEY (letter_type_id) REFERENCES letter_types(id) ON DELETE RESTRICT,
    FOREIGN KEY (author_id) REFERENCES users(id) ON DELETE RESTRICT
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  ```

#### 3.9 `letter_revisions` (Immutable Versioning & Hash)
- **MariaDB InnoDB:**
  ```sql
  CREATE TABLE letter_revisions (
    id CHAR(36) PRIMARY KEY,
    letter_id CHAR(36) NOT NULL,
    version INT NOT NULL,
    template_id CHAR(36) NULL,
    subject VARCHAR(255) NOT NULL,
    recipient_name VARCHAR(255) NOT NULL,
    classification VARCHAR(32) NOT NULL,
    planned_date DATE NOT NULL,
    content JSON NOT NULL,
    content_sha256 CHAR(64) NOT NULL,
    change_summary TEXT NULL,
    created_by CHAR(36) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uq_letter_version (letter_id, version),
    KEY idx_revisions_created_by (created_by),
    FOREIGN KEY (letter_id) REFERENCES letters(id) ON DELETE RESTRICT,
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE RESTRICT
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  ```

#### 3.10 `signatory_mandates`
- **MariaDB InnoDB:**
  ```sql
  CREATE TABLE signatory_mandates (
    id CHAR(36) PRIMARY KEY,
    organization_id CHAR(36) NOT NULL,
    user_id CHAR(36) NOT NULL,
    letter_type_id CHAR(36) NULL,
    unit_id CHAR(36) NULL,
    can_review TINYINT(1) NOT NULL DEFAULT 1,
    can_approve TINYINT(1) NOT NULL DEFAULT 0,
    can_sign TINYINT(1) NOT NULL DEFAULT 0,
    valid_from DATE NOT NULL,
    valid_to DATE NOT NULL,
    status VARCHAR(32) NOT NULL DEFAULT 'ACTIVE',
    decree_number VARCHAR(255) NOT NULL,
    notes TEXT NULL,
    created_at TIMESTAMP NULL,
    updated_at TIMESTAMP NULL,
    KEY idx_mandates_user_status (user_id, status),
    KEY idx_mandates_org_dates (organization_id, valid_from, valid_to),
    FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE RESTRICT,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE RESTRICT,
    FOREIGN KEY (letter_type_id) REFERENCES letter_types(id) ON DELETE RESTRICT
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  ```

#### 3.11 `approval_requests`
- **MariaDB InnoDB:**
  ```sql
  CREATE TABLE approval_requests (
    id CHAR(36) PRIMARY KEY,
    organization_id CHAR(36) NOT NULL,
    letter_id CHAR(36) NOT NULL,
    revision_id CHAR(36) NOT NULL,
    revision_version INT NOT NULL,
    content_sha256 CHAR(64) NOT NULL,
    submitted_by CHAR(36) NOT NULL,
    submitted_at TIMESTAMP NOT NULL,
    status VARCHAR(32) NOT NULL DEFAULT 'PENDING',
    submission_notes TEXT NULL,
    workflow_version INT NOT NULL DEFAULT 1,
    created_at TIMESTAMP NULL,
    updated_at TIMESTAMP NULL,
    KEY idx_approval_letter_status (letter_id, status),
    KEY idx_approval_org_status (organization_id, status),
    FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE RESTRICT,
    FOREIGN KEY (letter_id) REFERENCES letters(id) ON DELETE RESTRICT,
    FOREIGN KEY (revision_id) REFERENCES letter_revisions(id) ON DELETE RESTRICT,
    FOREIGN KEY (submitted_by) REFERENCES users(id) ON DELETE RESTRICT
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  ```

#### 3.12 `approval_steps`
- **MariaDB InnoDB:**
  ```sql
  CREATE TABLE approval_steps (
    id CHAR(36) PRIMARY KEY,
    approval_request_id CHAR(36) NOT NULL,
    letter_id CHAR(36) NOT NULL,
    revision_id CHAR(36) NOT NULL,
    step_no INT NOT NULL DEFAULT 1,
    reviewer_id CHAR(36) NOT NULL,
    mandate_id CHAR(36) NOT NULL,
    decision VARCHAR(32) NOT NULL,
    decision_content_sha256 CHAR(64) NOT NULL,
    comments TEXT NULL,
    decided_at TIMESTAMP NOT NULL,
    KEY idx_steps_request (approval_request_id),
    KEY idx_steps_letter (letter_id, decided_at),
    FOREIGN KEY (approval_request_id) REFERENCES approval_requests(id) ON DELETE RESTRICT,
    FOREIGN KEY (letter_id) REFERENCES letters(id) ON DELETE RESTRICT,
    FOREIGN KEY (revision_id) REFERENCES letter_revisions(id) ON DELETE RESTRICT,
    FOREIGN KEY (reviewer_id) REFERENCES users(id) ON DELETE RESTRICT,
    FOREIGN KEY (mandate_id) REFERENCES signatory_mandates(id) ON DELETE RESTRICT
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  ```

#### 3.13 `letter_status_history`
- **MariaDB InnoDB:**
  ```sql
  CREATE TABLE letter_status_history (
    id CHAR(36) PRIMARY KEY,
    letter_id CHAR(36) NOT NULL,
    revision_id CHAR(36) NULL,
    from_status VARCHAR(32) NOT NULL,
    to_status VARCHAR(32) NOT NULL,
    actor_id CHAR(36) NOT NULL,
    reason TEXT NULL,
    metadata JSON NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    KEY idx_history_letter (letter_id, created_at),
    FOREIGN KEY (letter_id) REFERENCES letters(id) ON DELETE RESTRICT,
    FOREIGN KEY (actor_id) REFERENCES users(id) ON DELETE RESTRICT
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  ```

#### 3.14 `audit_events` (Append-Only)
- **MariaDB InnoDB:**
  ```sql
  CREATE TABLE audit_events (
    id CHAR(36) PRIMARY KEY,
    organization_id CHAR(36) NULL,
    actor_id CHAR(36) NULL,
    event_type VARCHAR(128) NOT NULL,
    entity_type VARCHAR(64) NOT NULL,
    entity_id CHAR(36) NULL,
    event_metadata JSON NULL,
    occurred_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    KEY idx_audit_org_time (organization_id, occurred_at),
    FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE RESTRICT,
    FOREIGN KEY (actor_id) REFERENCES users(id) ON DELETE RESTRICT
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  ```

---

### 4. Penegakan Immutabilitas pada MariaDB

Di PostgreSQL, proteksi mutasi tabel `audit_events` ditegakkan via trigger `reject_audit_mutation()`. Pada MariaDB InnoDB, kita menetapkan **dua lapis proteksi**:

1. **Trigger MariaDB Level SQL (Database Boundary):**
   ```sql
   DELIMITER $$
   CREATE TRIGGER trg_audit_events_prevent_update
   BEFORE UPDATE ON audit_events
   FOR EACH ROW
   BEGIN
       SIGNAL SQLSTATE '45000'
       SET MESSAGE_TEXT = 'Pelanggaran Keamanan: audit_events bersifat append-only, operasi UPDATE dilarang!';
   END$$

   CREATE TRIGGER trg_audit_events_prevent_delete
   BEFORE DELETE ON audit_events
   FOR EACH ROW
   BEGIN
       SIGNAL SQLSTATE '45000'
       SET MESSAGE_TEXT = 'Pelanggaran Keamanan: audit_events bersifat append-only, operasi DELETE dilarang!';
   END$$
   DELIMITER ;
   ```
2. **Eloquent Model Level Guard (Application Boundary):**
   ```php
   // app/Models/AuditEvent.php & app/Models/LetterRevision.php
   protected static function booted(): void
   {
       static::updating(function () {
           throw new \RuntimeException('Mutasi UPDATE dilarang pada entitas audit dan revisi immutabel.');
       });
       static::deleting(function () {
           throw new \RuntimeException('Mutasi DELETE dilarang pada entitas audit dan revisi immutabel.');
       });
   }
   ```

---

### 5. Penanganan Konkurensi & Penguncian Baris (Row-Level Locking)

MariaDB InnoDB mendukung penuh row locking identik dengan PostgreSQL:
```php
// Pada ApprovalWorkflowService.php
DB::transaction(function () use ($requestId, $reviewer, $decision) {
    // MariaDB mengeksekusi: SELECT * FROM approval_requests WHERE id = ? FOR UPDATE
    $request = ApprovalRequest::where('id', $requestId)->lockForUpdate()->firstOrFail();
    $letter = Letter::where('id', $request->letter_id)->lockForUpdate()->firstOrFail();

    // Logika verifikasi mandat, anti-stale, dan anti-self approval ...
});
```
Karena kolom `id` adalah Primary Key, InnoDB mengunci hanya baris spesifik tersebut (*record lock* tanpa *table lock*), menjamin transaksi konkuren reviewer lain pada surat yang berbeda tetap berjalan cepat tanpa hambatan.

