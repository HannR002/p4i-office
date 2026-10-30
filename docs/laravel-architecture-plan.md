# Dokumen Rencana Arsitektur Laravel (Laravel Architecture Plan)
## P4I Office v1.0: Enterprise Architecture on Laravel 10.x & Livewire 3

**Dokumen:** `docs/laravel-architecture-plan.md`  
**Tanggal:** 30 Oktober 2026  
**Pelaksana Teknis:** Gemini Flash 3.8 (Reasoning High) — Lead Software Engineer  
**Tim Perancangan & Arsitek Sistem:** GPT-6 (Software Architect & Penulis Laporan Resmi)  
**Pemilik Keputusan Administratif:** Ketua / Pengurus Yayasan P4I  
**Workspace Baru:** `D:\p4i-office-laravel`  
**Status Dokumen:** Baseline Proposal Arsitektur Sprint M0  

---

### 1. Ringkasan Pilihan Teknologi

Arsitektur baru P4I Office dirancang untuk beroperasi secara handal di lingkungan hosting Hostinger selama 24 jam dengan performa tinggi, perawatan minimal, dan tata kelola keamanan ketat:

- **Framework Inti:** Laravel 10.50.4 (LTS Stability) / PHP 8.2+
- **Antarmuka Reaktif:** Blade Components + Livewire 3 (Reaktivitas server-driven tanpa kompleksitas SPA terpisah)
- **Styling & Token Desain:** Tailwind CSS 3.x + Lucide Blade Icons
- **Basis Data Target:** MariaDB 10.4+ InnoDB (dengan driver `mysql` PDO) / PostgreSQL jika paket VPS
- **Otentikasi & Sesi:** Laravel Session Guard dengan cookie HttpOnly terenkripsi (`SameSite=Lax`, `Secure` di HTTPS)
- **Otorisasi:** Laravel Policies (`LetterPolicy`, `ApprovalPolicy`, `MandatePolicy`) dan Custom Middleware
- **Penyimpanan Berkas:** Local Private Disk (`storage/app/private`) di luar document root publik
- **Pengujian Otomatis:** PHPUnit 10.x dengan Feature & Unit Test Suites terisolasi

---

### 2. Diagram Arsitektur Lapisan Aplikasi (Layered Architecture)

```
+-------------------------------------------------------------------------+
|                       PRESENTATION LAYER (UI)                           |
|       Blade Templates + Livewire 3 Components + Tailwind CSS            |
|   (Watermark "DRAF - BELUM RESMI", Timeline Status, Modal Keputusan)    |
+------------------------------------+------------------------------------+
                                     |
+------------------------------------v------------------------------------+
|                      HTTP & AUTHORIZATION LAYER                         |
|  - Middleware: Authenticate, EnsureUserIsActive, OrganizationIsolation  |
|  - Policies: LetterPolicy, ApprovalPolicy, MandatePolicy                |
|  - Form Requests: CreateDraftRequest, SubmitApprovalRequest, etc.       |
+------------------------------------+------------------------------------+
                                     |
+------------------------------------v------------------------------------+
|                         DOMAIN SERVICE LAYER                            |
|  - ApprovalWorkflowService (State Machine, Anti Self-Approval Guard)    |
|  - LetterRevisionService (Append-only Versioning, SHA-256 Hashing)      |
|  - SignatoryMandateService (Masa Berlaku, Lingkup Surat, canApprove)    |
|  - AuditLoggingService (Append-only Audit Events, Immutability)         |
+------------------------------------+------------------------------------+
                                     |
+------------------------------------v------------------------------------+
|                       PERSISTENCE LAYER (DATA)                          |
|  - Eloquent ORM + HasUuids Trait + Database Transactions                |
|  - MariaDB InnoDB (Row Locking via DB::table()->lockForUpdate())        |
|  - Private Document Storage (storage/app/private)                       |
+-------------------------------------------------------------------------+
```

---

### 3. Peta Model Eloquent & Relasi Data

Seluruh model menggunakan Primary Key tipe `UUID` via trait `Illuminate\Database\Eloquent\Concerns\HasUuids`:

1. **`Organization` (`app/Models/Organization.php`):**
   - Entitas yayasan induk.
   - Relasi: `hasMany(OrgUnit::class)`, `hasMany(User::class)`, `hasMany(LetterType::class)`, `hasMany(Letter::class)`.
2. **`OrgUnit` (`app/Models/OrgUnit.php`):**
   - Struktur unit kerja organisasi (Sekretariat Utama, Bidang Riset, dsb.).
   - Relasi: `belongsTo(Organization::class)`, `belongsTo(OrgUnit::class, 'parent_id')`, `hasMany(OrgUnit::class, 'parent_id')`.
3. **`User` (`app/Models/User.php`):**
   - Akun pengguna internal yayasan.
   - Kolom: `id`, `organization_id`, `unit_id`, `email`, `display_name`, `password` (bcrypt), `status` (`ACTIVE`, `DISABLED`, `INVITED`), `mfa_enabled`.
   - Relasi: `belongsTo(Organization::class)`, `belongsTo(OrgUnit::class)`, `belongsToMany(Role::class, 'user_roles')`, `hasMany(Letter::class, 'author_id')`, `hasMany(SignatoryMandate::class)`.
4. **`Role` (`app/Models/Role.php`):**
   - Definisi peran sistem: `SYSTEM_ADMIN`, `STAFF`, `REVIEWER`, `PENGURUS_YAYASAN`.
   - Relasi: `belongsToMany(User::class, 'user_roles')`.
5. **`LetterType` (`app/Models/LetterType.php`):**
   - Jenis surat dinas (kode, label, prioritas P0/P1, status aktif).
   - Relasi: `belongsTo(Organization::class)`, `hasMany(Letter::class)`.
6. **`Letter` (`app/Models/Letter.php`):**
   - Data entitas surat dinas.
   - Kolom: `id`, `organization_id`, `unit_id`, `letter_type_id`, `author_id`, `subject`, `recipient_name`, `classification` (`PUBLIC`, `INTERNAL`, `CONFIDENTIAL`), `planned_date`, `status`, `current_revision_no`, `official_number` (selalu `null` di Sprint M0), `created_at`, `updated_at`.
   - Relasi: `belongsTo(Organization::class)`, `belongsTo(LetterType::class)`, `belongsTo(User::class, 'author_id')`, `hasMany(LetterRevision::class)`, `hasMany(ApprovalRequest::class)`, `hasMany(LetterStatusHistory::class)`.
7. **`LetterRevision` (`app/Models/LetterRevision.php`):**
   - Berkas naskah berversi murni *immutable* (append-only).
   - Kolom: `id`, `letter_id`, `version`, `subject`, `recipient_name`, `classification`, `planned_date`, `content` (JSON array cast), `content_sha256` (CHAR 64), `change_summary`, `created_by`, `created_at`.
   - Proteksi Immutabilitas: Event model `updating` dan `deleting` melempar `ImmutableRecordException`.
8. **`SignatoryMandate` (`app/Models/SignatoryMandate.php`):**
   - Mandat pejabat penandatangan dan pemeriksa berdasarkan SK penetapan.
   - Kolom: `id`, `organization_id`, `user_id`, `letter_type_id`, `unit_id`, `can_review`, `can_approve`, `can_sign`, `valid_from`, `valid_to`, `status` (`ACTIVE`, `EXPIRED`, `REVOKED`), `decree_number`, `notes`.
   - Relasi: `belongsTo(User::class)`, `belongsTo(LetterType::class)`.
9. **`ApprovalRequest` (`app/Models/ApprovalRequest.php`):**
   - Permohonan persetujuan draf yang mengikat versi dan hash naskah.
   - Kolom: `id`, `organization_id`, `letter_id`, `revision_id`, `revision_version`, `content_sha256`, `submitted_by`, `submitted_at`, `status` (`PENDING`, `IN_REVIEW`, `APPROVED`, `CHANGES_REQUESTED`, `REJECTED`, `SUPERSEDED`), `submission_notes`.
   - Relasi: `belongsTo(Letter::class)`, `belongsTo(LetterRevision::class)`, `belongsTo(User::class, 'submitted_by')`, `hasMany(ApprovalStep::class)`.
10. **`ApprovalStep` (`app/Models/ApprovalStep.php`):**
    - Rekam keputusan telaah reviewer.
    - Kolom: `id`, `approval_request_id`, `letter_id`, `revision_id`, `step_no`, `reviewer_id`, `mandate_id`, `decision` (`APPROVED`, `CHANGES_REQUESTED`, `REJECTED`), `decision_content_sha256`, `comments`, `decided_at`.
    - Relasi: `belongsTo(ApprovalRequest::class)`, `belongsTo(User::class, 'reviewer_id')`, `belongsTo(SignatoryMandate::class, 'mandate_id')`.
11. **`LetterStatusHistory` (`app/Models/LetterStatusHistory.php`):**
    - Linimasa transisi status surat dinas.
    - Kolom: `id`, `letter_id`, `revision_id`, `from_status`, `to_status`, `actor_id`, `reason`, `metadata` (JSON), `created_at`.
12. **`AuditEvent` (`app/Models/AuditEvent.php`):**
    - Jejak audit append-only organisasi.
    - Kolom: `id`, `organization_id`, `actor_id`, `event_type`, `entity_type`, `entity_id`, `event_metadata` (JSON), `occurred_at`.

---

### 4. Lapisan Logika Domain (Domain Services)

Logika bisnis tidak diletakkan di dalam Controller atau View, melainkan dipusatkan pada Service Classes:

1. **`ApprovalWorkflowService` (`app/Services/ApprovalWorkflowService.php`):**
   - `submitForApproval(Letter $letter, User $submitter, ?string $notes): ApprovalRequest`:
     - Verifikasi status draf (`DRAFT`, `CHANGES_REQUESTED`, `RETURNED`).
     - Verifikasi hak pengaju (`$submitter->id === $letter->author_id || $submitter->isSystemAdmin()`).
     - Ambil revisi terkini, tandai request lama berstatus `PENDING` menjadi `SUPERSEDED`.
     - Buat `ApprovalRequest` baru yang mengikat `revision_version` dan `content_sha256`.
     - Ubah status draf menjadi `SUBMITTED`.
     - Rekam linimasa status ke `LetterStatusHistory` dan kirim audit event.
   - `decideApproval(ApprovalRequest $request, User $reviewer, string $decision, ?string $mandateId, ?string $comments): ApprovalStep`:
     - Mengunci baris `ApprovalRequest` dan `Letter` dengan `lockForUpdate()`.
     - **Anti Self-Approval Guard:** Menolak jika `$reviewer->id === $letter->author_id` (Throw `SelfApprovalDisallowedException`).
     - **Anti-Stale Review Guard:** Memeriksa revisi terkini pada surat. Jika versi atau hash berbeda dengan yang terikat pada request, lempar `StaleRevisionException`.
     - **Mandate Enforcement:** Memvalidasi bahwa `$reviewer` memiliki mandat berstatus `ACTIVE`, berada dalam rentang `valid_from` s.d. `valid_to`, cocok dengan jenis surat, dan memiliki izin `can_approve = true` jika keputusannya adalah `APPROVED`.
     - **Mandatory Notes:** Jika keputusan `CHANGES_REQUESTED` atau `REJECTED`, mewajibkan catatan telaah minimal 5 karakter.
     - Ubah status surat dan request, rekam langkah ke `ApprovalStep` dan `LetterStatusHistory`.
2. **`LetterRevisionService` (`app/Services/LetterRevisionService.php`):**
   - Menghitung canonical SHA-256 hash dari konten JSON.
   - Menjamin penambahan revisi baru mengunci baris surat (`lockForUpdate`), menambah `current_revision_no` secara sekuensial (+1), dan mengembalikan status surat ke `DRAFT` apabila sebelumnya berstatus `CHANGES_REQUESTED`.
3. **`SignatoryMandateService` (`app/Services/SignatoryMandateService.php`):**
   - Pembuatan dan pengelolaan SK mandat pejabat penandatangan dengan validasi masa berlaku dan wewenang.

---

### 5. Kebijakan Otorisasi (Laravel Policies)

Otorisasi ditegakkan menggunakan Laravel Policies:

- **`LetterPolicy`:**
  - `view(User $user, Letter $letter)`: Mengizinkan jika dalam organisasi yang sama. Jika berklasifikasi `CONFIDENTIAL`, hanya diizinkan untuk `$letter->author_id` atau pengguna ber-role `SYSTEM_ADMIN`.
  - `update(User $user, Letter $letter)`: Hanya diizinkan jika status draf adalah `DRAFT` atau `CHANGES_REQUESTED`, dan `$user->id === $letter->author_id`. Ditolak keras jika surat dalam status `SUBMITTED`, `IN_REVIEW`, `APPROVED`, atau `REJECTED`.
  - `submit(User $user, Letter $letter)`: Hanya pembuat draf (`author_id`) atau admin yang berhak mengajukan draf.
- **`ApprovalPolicy`:**
  - `review(User $user, ApprovalRequest $request)`: Pengguna wajib memiliki peran `REVIEWER` atau `PENGURUS_YAYASAN`, memiliki mandat aktif, dan **bukan pembuat draf surat bersangkutan** (`$user->id !== $request->letter->author_id`).
- **`MandatePolicy`:**
  - `manage(User $user)`: Hanya peran `SYSTEM_ADMIN` dan `PENGURUS_YAYASAN` yang berwenang menetapkan, mengubah, atau mencabut mandat pejabat.

---

### 6. Penyimpanan Dokumen Privat (Private Document Storage)

Untuk mencegah akses langsung (*direct URL access*) atau kebocoran dokumen draft nonresmi:
1. Berkas naskah dan lampiran disimpan pada disk privat di luar folder web root:
   - Lokasi fisik: `storage/app/private/letters/{organization_id}/{letter_id}/`
   - Direktori `storage/app/private/` sama sekali tidak memiliki symlink ke `public/` ataupun `public_html/`.
2. Unduhan dan pratinjau dilayani melalui Route Controller terproteksi:
   ```php
   Route::get('/letters/{letter}/download', [LetterDownloadController::class, 'download'])
       ->middleware(['auth', 'active.user', 'can:view,letter']);
   ```
3. Header HTTP respon menerapkan:
   - `X-Content-Type-Options: nosniff`
   - `Cache-Control: private, no-store, max-age=0, must-revalidate`
   - `Pragma: no-cache`

---

### 7. Pengamanan Mutlak Penomoran Resmi (Zero Fictional Numbering)

- Berkas konfigurasi `config/features.php` memuat penguncian mutlak:
  ```php
  return [
      'official_numbering_active' => false,
  ];
  ```
- Method `allocateOfficialNumber()` pada seluruh layanan melempar eksepsi penolakan:
  ```php
  public function allocateOfficialNumber(): never
  {
      throw new OfficialNumberingBlockedException(
          'BLOCKED: Penomoran surat resmi terkunci pada Sprint M0! ' .
          'Syarat pembukaan: SK pengesahan format nomor dan register arsip lama oleh Pengurus Yayasan P4I.'
      );
  }
  ```
- Kolom `letters.official_number` di basis data bernilai `NULL` secara mutlak pada seluruh draf dan surat yang disetujui di Sprint M0.

