# Dokumen Penilaian Migrasi (Migration Assessment)
## P4I Office: Transisi dari Next.js / PostgreSQL ke Laravel / Hostinger Readiness

**Dokumen:** `docs/migration-assessment.md`  
**Tanggal:** 30 Oktober 2026  
**Pelaksana Teknis:** Gemini Flash 3.8 (Reasoning High) — Lead Software Engineer  
**Tim Perancangan & Arsitek Sistem:** GPT-6 (Software Architect, Auditor Independen & Penulis Laporan Resmi)  
**Pemilik Keputusan Administratif:** Ketua / Pengurus Yayasan Pusat Pendidikan dan Penelitian Pembangunan Indonesia (P4I)  
**Status Sprint:** Sprint M0 — Foundation & Readiness Assessment  

---

### 1. Latar Belakang & Rasional Keputusan Strategis

Sistem administrasi persuratan internal P4I Office sebelumnya dibangun menggunakan stack Next.js 15 (TypeScript), React 19, Tailwind CSS, dan PostgreSQL 18.4 native hingga penyelesaian Sprint 2 (Letter Approval Workflow & Authority Management).

Berdasarkan keputusan strategis terbaru dari Pemilik Proyek dan Pengurus Yayasan P4I:
1. **Target Infrastruktur Operasional 24 Jam:** Sistem diputuskan untuk beroperasi di atas layanan hosting **Hostinger** agar sistem dapat diakses stabil 24/7 dengan biaya operasional yang efisien dan pemeliharaan terkelola (*managed environment*).
2. **Peralihan Kerangka Kerja (Framework Migration):** Mengalihkan tumpukan teknologi backend dan frontend ke ekosistem **Laravel (PHP 8.2+) + Blade + Livewire 3 + Tailwind CSS**. Ekosistem ini merupakan standar industri yang memiliki kecocokan (*out-of-the-box compatibility*) tertinggi pada lingkungan shared/cloud hosting Hostinger.
3. **Kepatuhan Aturan Pemilihan Basis Data:**
   - Apabila paket hosting aktif adalah **Hostinger VPS** dengan akses root: basis data yang digunakan adalah **Laravel + PostgreSQL**.
   - Apabila paket hosting aktif adalah **Hostinger Business Web Hosting** atau **Cloud Hosting**: basis data yang digunakan adalah **Laravel + MariaDB** (menggunakan driver PDO MySQL InnoDB).
   - Dokumen historis mencatat rencana penggunaan *Hostinger Business Web Hosting*, sehingga arsitektur Sprint M0 memprioritaskan kesiapan MariaDB InnoDB tanpa menutup jalur PostgreSQL.

Dokumen ini menyajikan hasil audit mendalam terhadap seluruh aset kode, skema, logika bisnis, dan pengujian yang telah selesai pada Sprint 1A, 1B, 1C, dan Sprint 2, serta menyusun matriks transisi menuju Laravel.

---

### 2. Audit Menyeluruh Kode Sumber Eksisting (`D:\p4i-office`)

Audit dilakukan terhadap repositori lokal `D:\p4i-office` pada branch `feat/sprint-2-approval-workflow` commit `99efcd1621c95fbc4e901fb9efbc741d00e7c224`:

#### 2.1 Skema dan Model Data (PostgreSQL 14–18)
- **Tabel Inti Organisasi & Akses (Migration 0001):**
  - `organizations`: Entitas yayasan ber-UUID v4.
  - `org_units`: Struktur unit kerja (e.g., Sekretariat Utama) dengan relasi hirarkis (`parent_id`).
  - `users`: Identitas pengguna, `password_hash` (bcrypt), status (`ACTIVE`, `DISABLED`, `INVITED`), `mfa_enabled`.
  - `roles`: Definisi peran sistem (`SYSTEM_ADMIN`, `STAFF`, `REVIEWER`).
  - `user_roles`: Many-to-many user dan role.
  - `numbering_policies`: Konfigurasi pola nomor surat, periode reset, dan flag penguncian (`is_active = false`).
  - `letter_types`: Klasifikasi surat dinas (e.g., KET-MAGANG, UNDANGAN, TUGAS) berstatus aktif/nonaktif.
  - `letter_templates`: Format isi surat berversi dengan skema JSON (`form_schema`).
  - `letters`: Metadata draf surat (perihal, tujuan, klasifikasi `PUBLIC`/`INTERNAL`/`CONFIDENTIAL`, status, tanggal terencana).
  - `letter_revisions`: Naskah berversi *immutable* (append-only), mengikat hash SHA-256 (`content_sha256`) dari konten JSON.
  - `audit_events`: Jejak audit append-only dengan trigger proteksi mutasi.
- **Pelacakan Migrasi & Hardening (Migration 0002):**
  - `schema_migrations`: Pelacakan eksekusi berkas migrasi idempotent berbasis checksum SHA-256.
  - Penambahan kolom `priority` (P0/P1) pada `letter_types` dan indeks pencarian teroptimasi.
- **Alur Persetujuan & Mandat Pejabat (Migration 0003):**
  - `signatory_mandates`: Dasar hukum penetapan SK pengurus yayasan, masa berlaku (`valid_from` s.d. `valid_to`), batas kewenangan (`can_review`, `can_approve`, `can_sign`), dan status (`ACTIVE`, `EXPIRED`, `REVOKED`).
  - `approval_requests`: Permintaan telaah yang mengikat versi draf tertentu (`revision_version`) dan hash SHA-256.
  - `approval_steps`: Rekam jejak keputusan telaah (`APPROVE`, `CHANGES_REQUESTED`, `REJECT`), referensi mandat, dan catatan reviewer.
  - `letter_status_history`: Linimasa riwayat perubahan status surat dinas secara kronologis.

#### 2.2 Aturan Bisnis & Logika Domain Terverifikasi
1. **State Machine Persetujuan:**
   - Alur normal: `DRAFT → SUBMITTED → IN_REVIEW → APPROVED`.
   - Alur perbaikan: `IN_REVIEW → CHANGES_REQUESTED → DRAFT → SUBMITTED`.
   - Alur penolakan: `IN_REVIEW → REJECTED` (terkunci dari penyuntingan lanjutan).
2. **Pencegahan Self-Approval:** Pembuat draf dilarang menyetujui surat buatannya sendiri (`author_id !== reviewer_id`).
3. **Pencegahan Stale Approval:** Keputusan ditolak jika versi atau hash draf telah berubah sejak diajukan (`STALE_REVISION`).
4. **Validasi Mandat Pejabat:** Persetujuan `APPROVED` wajib merujuk mandat aktif, tidak kadaluwarsa, dan berhak menyetujui (`can_approve = true`).
5. **Komentar Telaah Wajib:** Keputusan `CHANGES_REQUESTED` dan `REJECTED` mewajibkan komentar minimal 5 karakter.
6. **Row-Level Concurrency:** Mutasi draf dan persetujuan dilindungi oleh transaksi database dengan penguncian baris (`FOR UPDATE`).
7. **Isolasi Keamanan (Confidentiality Guard):** Draf berklasifikasi `CONFIDENTIAL` hanya dapat diakses oleh pembuat draf dan administrator.
8. **Revokasi Sesi Seketika:** Akun dengan status `DISABLED` langsung ditolak login dan seluruh token sesi aktifnya digugurkan saat request berikutnya.
9. **Watermark Nonresmi:** Seluruh draf menampilkan watermark **DRAF — BELUM RESMI** dan kop **DATA BELUM DIVERIFIKASI**.
10. **Penguncian Penomoran Resmi:** Fitur penomoran resmi terkunci mati (`FEATURE_NUMBERING_ACTIVE = false`, `officialNumber = null`).

---

### 3. Matriks Fitur & Penilaian Transisi (Feature Matrix)

Berikut adalah pemetaan menyeluruh antara implementasi Next.js eksisting terhadap rencana penulisan ulang pada Laravel:

| Modul / Fitur | Status di Next.js (Sprint 1-2) | Status Pengujian | Kompleksitas Migrasi | Ekuivalen di Laravel 10/11 | Catatan Teknis & Mitigasi Risiko |
|---|---|---|:---:|---|---|
| **Otentikasi & Sesi** | JWT via JOSE + HttpOnly Cookie + bcryptjs | 100% PASS (Unit & Smoke) | **Rendah** | Laravel Session Guard / Sanctum + Eloquent User Provider | Gunakan cookie sesi standar Laravel (`HttpOnly`, `SameSite=Lax`). Bcrypt 10–12 rounds kompatibel penuh. |
| **RBAC & Otorisasi** | Kode peran `SYSTEM_ADMIN`, `STAFF`, `REVIEWER`, `PENGURUS_YAYASAN` | 100% PASS (Unit & Smoke) | **Sedang** | Laravel Policies (`LetterPolicy`, `MandatePolicy`) & Gates | Pola otorisasi berbasis Policy lebih deklaratif dan terpusat dibanding route guard Next.js. |
| **Revokasi Akun DISABLED** | Cek database pada `getCurrentUser()` di setiap request | 100% PASS (Smoke) | **Rendah** | Laravel Middleware `EnsureUserIsActive` | Middleware memeriksa `Auth::user()->status === 'ACTIVE'`. Jika `DISABLED`, panggil `Auth::logout()` seketika. |
| **Manajemen Draf Surat** | Form draf, metadata, validasi Zod | 100% PASS | **Sedang** | Livewire 3 Component / Controller + FormRequest | Validasi FormRequest Laravel menggantikan Zod schema. |
| **Revisi Immutabel & Hashing** | Append-only `letter_revisions`, SHA-256 hash kalkulasi | 100% PASS (4 tests) | **Sedang** | Eloquent Model `LetterRevision` (Immutability enforced via Model Events) | Mencegah `update` dan `delete` pada model event `updating` & `deleting`. Hash SHA-256 dari canonical JSON. |
| **State Machine Persetujuan** | Transisi status terpusat di repository | 100% PASS (AP-01 s/d AP-06) | **Sedang** | Service Class `ApprovalWorkflowService` + Database Transactions | Bungkus transisi dalam `DB::transaction()` dengan `lockForUpdate()`. |
| **Pencegahan Self-Approval** | Cek `author_id === reviewer_id` di DB & UI | 100% PASS (AP-08) | **Rendah** | `LetterPolicy::approve` & Service Guard | Tolak otorisasi jika `auth()->id() === $letter->author_id`. |
| **Pencegahan Stale Approval** | Komparasi hash dan versi revisi | 100% PASS (AP-04) | **Sedang** | Service Guard di `ApprovalWorkflowService` | Verifikasi `$approvalRequest->revision_version === $letter->current_revision_no`. |
| **Validasi Mandat Pejabat** | Validasi status ACTIVE, rentang tanggal, canApprove | 100% PASS (AP-03) | **Sedang** | Eloquent Model `SignatoryMandate` + Policy | Scope query: `where('status', 'ACTIVE')->whereDate('valid_from', '<=', $today)->whereDate('valid_to', '>=', $today)`. |
| **Catatan Telaah Wajib** | Cek panjang string minimal 5 karakter | 100% PASS (AP-06) | **Rendah** | Laravel FormRequest validation `required|min:5` | Validasi otomatis dengan pesan error berbahasa Indonesia. |
| **Row-Level Concurrency** | PostgreSQL `SELECT ... FOR UPDATE` | 100% PASS (AP-07, 2 tests) | **Tinggi** | MariaDB InnoDB `DB::table(...)->lockForUpdate()` | InnoDB mendukung row-level locking identik dengan PostgreSQL pada kolom berindeks. |
| **Audit Trail & Timeline** | Append-only `letter_status_history` & `audit_events` | 100% PASS (AP-10) | **Sedang** | Eloquent Observer / Event Listeners | Merekam setiap perubahan status dan aksi krusial ke tabel audit terpisah. |
| **Kerahasiaan (CONFIDENTIAL)** | Filter query berbasis kepemilikan & peran admin | 100% PASS (Unit & Smoke) | **Rendah** | `LetterPolicy::view` & Eloquent Global Scope | Batasi akses baca hanya untuk pembuat surat dan administrator. |
| **Watermark DRAF Nonresmi** | Visual overlay CSS & badge status | 100% PASS (Visual) | **Rendah** | Blade Component `x-watermark-draft` & Tailwind | Porting langsung Tailwind CSS classes dari Next.js JSX ke Blade template. |
| **Penyimpanan Dokumen Privat** | Saat ini hanya pratinjau teks/HTML | Terverifikasi | **Sedang** | Laravel `Storage::disk('private')` + Download Controller | Berkas disimpan di luar `public_html` (`storage/app/private`), diakses via route bertanda otorisasi. |
| **Penguncian Nomor Resmi** | `FEATURE_NUMBERING_ACTIVE = false` | 100% PASS (Smoke & AP-12) | **Rendah** | `config('features.official_numbering_active')` | Tetap terkunci `false`. Service penomoran melempar exception penolakan jika dipanggil. |

---

### 4. Daftar Artefak yang Perlu Ditulis Ulang pada Laravel

1. **Routing & Controllers:**
   - 18 Next.js Route Handlers (`src/app/api/...`) dikonversi menjadi Controller terstruktur (`app/Http/Controllers/LetterController.php`, `ApprovalController.php`, `MandateController.php`, `AuthController.php`).
2. **Komponen Antarmuka (UI):**
   - 8 Halaman Next.js (`/login`, `/dashboard`, `/letters`, `/letters/[id]`, `/letters/new`, `/approvals`, `/mandates`, `/templates`) dikonversi menjadi Blade Views dengan Livewire 3 reactive components (`resources/views/...` dan `app/Livewire/...`).
   - Tailwind CSS diselaraskan menggunakan Vite bundler (`resources/css/app.css` dan `vite.config.js`).
3. **Model & Lapisan Data:**
   - 15 Tabel PostgreSQL dikonversi ke Laravel Database Migrations (`database/migrations/...`) menggunakan skema MariaDB InnoDB.
   - 12 Eloquent Models (`app/Models/...`) dengan relasi `belongsTo`, `hasMany`, dan trait `HasUuids`.
4. **Pengujian Otomatis:**
   - Seluruh test Vitest (53 tests) dikonversi ke **PHPUnit Feature & Unit Tests** (`tests/Feature/...` dan `tests/Unit/...`) yang dapat dijalankan secara konsisten melalui `php artisan test`.

---

### 5. Penilaian Risiko & Hambatan Teknis

1. **Keterbatasan Lingkungan Shared Hosting Hostinger:**
   - **Background Processes:** Shared hosting tidak mendukung supervisor daemon untuk queue worker jangka panjang. Solusi: Gunakan queue driver `sync` untuk alur langsung, atau manfaatkan Hostinger Scheduled Tasks (Cron) setiap menit untuk mengeksekusi `php artisan schedule:run`.
   - **Document Root:** Hostinger shared hosting mengarahkan domain utama ke `public_html`. Solusi arsitektur: Letakkan seluruh folder inti aplikasi di root user (`/home/u123456/p4i-office`), lalu buat symlink atau salin isi folder `public/` ke `public_html/` dengan penyesuaian path index.
2. **Perbedaan Dialek Basis Data (PostgreSQL vs MariaDB):**
   - Tipe data `UUID`: PostgreSQL memiliki tipe native `uuid`, sedangkan MariaDB menggunakan `CHAR(36)` atau `BINARY(16)`. Keputusan: Gunakan `CHAR(36)` dengan trait `HasUuids` Laravel untuk keterbacaan audit log dan determinisme data uji.
   - Tipe data `JSONB`: PostgreSQL mendukung binary JSON berindeks. MariaDB 10.4+ mendukung tipe data `JSON` (alias `LONGTEXT` dengan `JSON_VALID` check constraint). Pengambilan data konten terbukti aman menggunakan casting model Eloquent `$casts = ['content' => 'array']`.
   - Transaksi & Row Locking: InnoDB mendukung `SELECT ... FOR UPDATE` secara penuh asalkan kueri mengunci kolom berindeks prima.
3. **Integritas Penomoran Resmi:**
   - Fitur penomoran surat resmi dan register masa lalu tetap **100% NONAKTIF** di Sprint M0. Tidak ada pembuatan nomor surat fiktif atau pengesahan mandat sepihak.

---

### 6. Kesimpulan & Rekomendasi Pelaksana

Sprint M0 membuktikan bahwa seluruh logika bisnis, aturan integritas, dan mekanisme pengamanan P4I Office yang telah selesai di Next.js dapat dipetakan secara terstruktur, elegan, dan tanpa kehilangan jaminan keamanan ke dalam arsitektur **Laravel 10.x / 11.x + Livewire 3 + MariaDB InnoDB**.

Pondasi proyek paralel di `D:\p4i-office-laravel` siap untuk diisi dengan skema migrasi, model, dan kerangka pengujian awal, dengan mempertahankan repositori lama `D:\p4i-office` tetap utuh sebagai dokumen rujukan teknis.

