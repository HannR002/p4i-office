# Rencana Pengujian Migrasi (Migration Test Plan)
## P4I Office v1.0: Strategi Verifikasi Paritas Fungsional & Integritas Laravel

**Dokumen:** `docs/migration-test-plan.md`  
**Tanggal:** 30 Oktober 2026  
**Pelaksana Teknis:** Gemini Flash 3.8 (Reasoning High) — Lead Software Engineer  
**Tim Perancangan & Arsitek Sistem:** GPT-6 (Software Architect & Penulis Laporan Resmi)  
**Pemilik Keputusan Administratif:** Ketua / Pengurus Yayasan P4I  
**Framework Pengujian:** PHPUnit 10.x & Laravel Testing Framework  

---

### 1. Tujuan & Ruang Lingkup Pengujian

Rencana pengujian migrasi ini dirancang untuk membuktikan secara empiris bahwa penulisan ulang sistem P4I Office ke dalam arsitektur **Laravel 10.x + MariaDB InnoDB** memiliki kesetaraan fungsi (*100% functional parity*), integritas data, dan pengamanan yang identik dengan sistem Next.js / PostgreSQL hasil Sprint 1A, 1B, 1C, dan Sprint 2.

Pengujian tidak menggunakan mock palsu untuk transaksi database inti, melainkan menggunakan database pengujian transaksional yang mendukung rollback otomatis (`RefreshDatabase` trait).

---

### 2. Lingkungan & Perangkat Pengujian

| Komponen | Konfigurasi Pengujian Unit | Konfigurasi Pengujian Integrasi / Fitur |
|---|---|---|
| **Runtime** | PHP 8.2.12 CLI | PHP 8.2.12 CLI |
| **Test Runner** | PHPUnit 10.5.x | PHPUnit 10.5.x / `php artisan test` |
| **Basis Data** | SQLite in-memory (`:memory:`) untuk kecepatan unit | MariaDB 10.4+ InnoDB (`p4i_office_laravel_test`) |
| **Isolasi Transaksi** | `Illuminate\Foundation\Testing\RefreshDatabase` | `RefreshDatabase` (Migrasi bersih per batch pengujian) |
| **Autentikasi** | `actingAs($user)` dengan Factory terverifikasi | Sesi HTTP riil via Form Login |

---

### 3. Matriks Kasus Uji Ekuivalen (Equivalence Test Matrix)

Setiap pengujian memetakan kriteria penerimaan dari Sprint 1A, 1B, 1C, dan Sprint 2:

#### 3.1 Kelompok A: Otentikasi, Sesi, dan Kontrol Akses (RBAC)

| Kode Kasus Uji | Kriteria Pengujian | Metodologi Uji di Laravel | Status Target |
|---|---|---|:---:|
| **TC-AUTH-01** | Pengguna aktif (`ACTIVE`) dapat login dengan kata sandi bcrypt yang benar, memperoleh cookie sesi aman HttpOnly, dan profilnya termuat lengkap. | `Tests\Feature\AuthTest::test_user_can_login_with_correct_credentials` | **PASS** |
| **TC-AUTH-02** | Pengguna memasukkan password salah ditolak dengan HTTP 422 / pesan kesalahan aman (tanpa membocorkan eksistensi email). | `Tests\Feature\AuthTest::test_user_cannot_login_with_incorrect_password` | **PASS** |
| **TC-AUTH-03** | Akun berstatus `DISABLED` ditolak login secara seketika dengan pesan akun dinonaktifkan. | `Tests\Feature\AuthTest::test_disabled_user_is_forbidden_from_login` | **PASS** |
| **TC-AUTH-04** | Sesi pengguna yang diubah statusnya menjadi `DISABLED` di database langsung dibatalkan pada request berikutnya oleh middleware `EnsureUserIsActive`. | `Tests\Feature\AuthTest::test_session_revoked_immediately_when_user_disabled` | **PASS** |
| **TC-AUTH-05** | Pengguna dengan peran `STAFF` dilarang mengakses modul administrasi sistem (HTTP 403 Forbidden). | `Tests\Feature\RbacTest::test_staff_cannot_access_admin_endpoints` | **PASS** |
| **TC-AUTH-06** | Administrator sistem (`SYSTEM_ADMIN`) memiliki akses penuh ke manajemen pengguna dan unit kerja yayasan. | `Tests\Feature\RbacTest::test_admin_can_access_user_management` | **PASS** |

#### 3.2 Kelompok B: Manajemen Draf Surat & Revisi Immutabel

| Kode Kasus Uji | Kriteria Pengujian | Metodologi Uji di Laravel | Status Target |
|---|---|---|:---:|
| **TC-DRAFT-01** | Pembuatan draf surat baru menghasilkan status awal `DRAFT`, nomor surat resmi `official_number = null`, dan versi revisi awal `v1`. | `Tests\Feature\LetterDraftTest::test_create_draft_initial_state` | **PASS** |
| **TC-DRAFT-02** | Penambahan revisi baru pada draf menghasilkan revisi append-only dengan nomor versi sekuensial (+1), serta menghitung hash SHA-256 dari konten canonical JSON. | `Tests\Feature\LetterDraftTest::test_add_revision_sequential_and_hashed` | **PASS** |
| **TC-DRAFT-03** | Immutabilitas revisi: percobaan UPDATE atau DELETE pada baris `letter_revisions` ditolak oleh model event / database trigger. | `Tests\Unit\LetterRevisionImmutabilityTest::test_revisions_cannot_be_mutated` | **PASS** |
| **TC-DRAFT-04** | Otorisasi kepemilikan draf: staf A dilarang menyunting atau menambahkan revisi pada draf milik staf B (HTTP 403 Forbidden). | `Tests\Feature\LetterOwnershipTest::test_user_cannot_edit_other_users_draft` | **PASS** |
| **TC-DRAFT-05** | Isolasi kerahasiaan: surat berklasifikasi `CONFIDENTIAL` hanya dapat dibaca oleh pembuat draf dan administrator. Staf lain menerima HTTP 403 Forbidden. | `Tests\Feature\LetterConfidentialityTest::test_confidential_letter_isolation` | **PASS** |

#### 3.3 Kelompok C: Alur Persetujuan & Mandat Pejabat (AP-01 s/d AP-14 Ekuivalen)

| Kode Kasus Uji | Kriteria Pengujian (Ekuivalen SRS Sprint 2) | Metodologi Uji di Laravel | Status Target |
|---|---|---|:---:|
| **TC-AP-01** | Pengajuan draf oleh pembuatnya mengubah status menjadi `SUBMITTED`, membuat `ApprovalRequest` berstatus `PENDING` yang mengikat `revision_version` dan `content_sha256`. | `Tests\Feature\ApprovalWorkflowTest::test_ap01_submit_draft_binds_hash` | **PASS** |
| **TC-AP-02** | Staf yang bukan pemilik draf dilarang mengajukan draf (HTTP 403). Pengguna tanpa peran/mandat dilarang memeriksa draf (HTTP 403). | `Tests\Feature\ApprovalWorkflowTest::test_ap02_unauthorized_user_blocked` | **PASS** |
| **TC-AP-03** | Reviewer tanpa mandat sah, atau mandatnya kadaluwarsa (`valid_to < today`), atau dicabut (`REVOKED`), atau di luar jenis surat ditolak saat memberikan keputusan. | `Tests\Feature\ApprovalWorkflowTest::test_ap03_invalid_mandate_rejected` | **PASS** |
| **TC-AP-04** | Anti-Stale Review: jika draf diperbarui setelah permohonan diajukan (versi draf tidak cocok dengan versi pada request), keputusan telaah ditolak (`StaleRevisionException`). | `Tests\Feature\ApprovalWorkflowTest::test_ap04_stale_approval_rejected` | **PASS** |
| **TC-AP-05** | Alur perbaikan: keputusan `CHANGES_REQUESTED` mengembalikan draf ke staf; penyuntingan revisi baru otomatis mengembalikan status ke `DRAFT` dan dapat diajukan ulang ke `SUBMITTED`. | `Tests\Feature\ApprovalWorkflowTest::test_ap05_request_changes_revision_cycle` | **PASS** |
| **TC-AP-06** | Alasan wajib telaah: keputusan `CHANGES_REQUESTED` dan `REJECTED` tanpa catatan telaah (atau kurang dari 5 karakter) ditolak oleh validasi backend. | `Tests\Feature\ApprovalWorkflowTest::test_ap06_mandatory_notes_rejected` | **PASS** |
| **TC-AP-07** | Penguncian konkurensi: dua keputusan simultan dari reviewer pada permintaan yang sama diselesaikan atomik (`lockForUpdate`), persis satu berhasil dan satu gagal aman. | `Tests\Feature\ApprovalConcurrencyTest::test_ap07_concurrent_decisions_handled_atomically` | **PASS** |
| **TC-AP-08** | Anti Self-Approval: pembuat draf ditolak mutlak saat mencoba menyetujui surat buatannya sendiri (`SelfApprovalDisallowedException`). | `Tests\Feature\ApprovalWorkflowTest::test_ap08_self_approval_disallowed` | **PASS** |
| **TC-AP-09** | Antrean reviewer (`/approvals`) hanya memuat draf berstatus `PENDING` atau `IN_REVIEW` sesuai organisasi dan kewenangan mandat. | `Tests\Feature\ApprovalWorkflowTest::test_ap09_reviewer_queue_filtered` | **PASS** |
| **TC-AP-10** | Linimasa riwayat status (`letter_status_history`) dan jejak audit (`audit_events`) mencatat seluruh transisi secara kronologis dan berurutan. | `Tests\Feature\ApprovalWorkflowTest::test_ap10_status_history_integrity` | **PASS** |
| **TC-AP-11** | Transaksi basis data bersifat fail-closed: kegagalan di tengah alur persetujuan membatalkan seluruh perubahan (otomatis `rollBack`). | `Tests\Feature\ApprovalWorkflowTest::test_ap11_transaction_fail_closed` | **PASS** |
| **TC-AP-12** | Penomoran resmi tetap NONAKTIF: surat berstatus `APPROVED` tetap memiliki `official_number = null`, dan method `allocateOfficialNumber()` melempar penolakan eksplisit. | `Tests\Feature\ApprovalWorkflowTest::test_ap12_official_number_remains_null` | **PASS** |

#### 3.4 Kelompok D: Penyimpanan Dokumen Privat & Keamanan Hostinger

| Kode Kasus Uji | Kriteria Pengujian | Metodologi Uji di Laravel | Status Target |
|---|---|---|:---:|
| **TC-SEC-01** | Berkas naskah surat disimpan pada disk `private` di luar web root (`storage/app/private/`) dan tidak memiliki tautan langsung publik. | `Tests\Feature\DocumentStorageTest::test_private_files_stored_outside_web_root` | **PASS** |
| **TC-SEC-02** | Pengguna yang tidak terotentikasi ditolak saat mencoba mengunduh dokumen (HTTP 401 / Redirect ke login). | `Tests\Feature\DocumentStorageTest::test_unauthenticated_download_rejected` | **PASS** |
| **TC-SEC-03** | Pengguna staf dilarang mengunduh berkas surat berstatus `CONFIDENTIAL` milik pihak lain (HTTP 403 Forbidden). | `Tests\Feature\DocumentStorageTest::test_unauthorized_download_forbidden` | **PASS** |

---

### 4. Perintah Eksekusi Pengujian & Ambang Kelulusan

Seluruh pengujian dijalankan melalui antarmuka konsol Laravel Artisan:

```bash
# 1. Menjalankan seluruh test suite dengan laporan detail
php artisan test

# 2. Menjalankan pengujian spesifik fitur persetujuan dan mandat
php artisan test --filter=ApprovalWorkflowTest

# 3. Menjalankan pengujian keamanan dan otorisasi
php artisan test --filter=AuthTest
```

**Ambang Kelulusan Mutlak (Pass Criteria):**
- 100% assertions lulus (0 failed, 0 errors).
- Waktu eksekusi efisien (< 10 detik untuk seluruh suite).
- Tidak ada kebocoran rahasia atau pesan error yang mengekspos struktur server.
- Verifikasi manual audit trail dan screenshot visual antarmuka Blade / Livewire.

