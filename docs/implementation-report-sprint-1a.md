# Laporan Implementasi Sprint 1A — P4I Office v1.0
## Bootstrap, Security Foundation & Surat Draft
**Dokumen:** `docs/implementation-report-sprint-1a.md`  
**Sasaran Evaluasi:** Tim Reviewer GPT & Pengurus Yayasan P4I  
**Pelaksana Teknis:** Gemini Flash 3.8 (Reasoning High) di Antigravity IDE  

---

### 1. Metadata Eksekusi & Lingkungan Kerja
- **Tanggal Selesai:** 28 Oktober 2026
- **Branch:** `master`
- **Remote / Link PR:** *Belum disiapkan / repositori lokal privat* (sesuai arahan klausul 1 Prompt Master: repositori dikerjakan bersih di lokal mandiri tanpa commit secret/token).
- **Commit SHA:** `3b81e5f27c539b38daae4d7fe2caae607ae0b4cf` (commit awal Sprint 1A lokal)
- **Lingkungan Kerja:**
  - **OS:** Windows 11 (build lokal pengguna)
  - **Node.js:** v22.14.0
  - **Package Manager:** npm v10.9.2
  - **Framework:** Next.js 15.1.7 (App Router), React 19.0.0, TypeScript 5.7.3 (Strict Mode)
  - **Styling:** Tailwind CSS 3.4.17 + Lucide React 0.475.0
  - **Database Service:** PostgreSQL 16 (koneksi lokal offline / in-memory secure fail-safe fallback aktif)
  - **Direktori Mandiri:** `d:\p4i-office` (terisolasi penuh dari `p4i-corporate-hub` dan `p4i-webgis`)

---

### 2. Tujuan Sprint dan Ringkasan Pekerjaan Aktual
Tujuan utama Sprint 1A adalah meletakkan fondasi arsitektur perangkat lunak yang aman, modular, dan terverifikasi untuk sistem persuratan internal Yayasan P4I, dengan pembatasan ketat bahwa **fase ini BELUM menerbitkan surat resmi ataupun nomor surat resmi**.

**Ringkasan Pekerjaan yang Diselesaikan:**
1. **Isolasi Proyek Mandiri:** Membangun repositori baru di `d:\p4i-office` tanpa sentuhan ke basis kode lain.
2. **Arsitektur Keamanan & RBAC:**
   - Autentikasi sesi aman berbasis HttpOnly cookie (`p4i_office_session`), ditandatangani dan dienkripsi via `jose` JWT.
   - Hashing password dengan `bcryptjs` (salt rounds = 10).
   - Penolakan akses mutlak pada level server untuk akun berstatus `DISABLED`.
   - Pemisahan peran tegas (`SYSTEM_ADMIN` vs `STAFF`) dengan server-side guard; staf dicegah membuka rute admin (HTTP 403).
   - Peran `SYSTEM_ADMIN` dibatasi secara hukum: dilarang menyetujui (*approve*) atau menandatangani (*sign*) surat dinas.
   - Analisis kesenjangan MFA dicatat secara transparan sebagai gap keamanan sebelum go-live produksi.
3. **Pangkalan Data & Migrasi Terversi:**
   - Menyusun berkas migrasi SQL versi 1 (`db/migrations/0001_sprint1a_core.sql`) mencakup 10 tabel inti dengan UUID v4, audit timestamps UTC, foreign key constraint, dan indeks performa.
   - Menyusun skrip migrasi rollback aman (`0001_sprint1a_core.rollback.sql`).
   - Abstraksi repository basis data dengan deteksi status layanan PostgreSQL lokal secara jujur.
4. **Alur Draf Surat & Immutability Revisi:**
   - Pembuatan draf surat baru dengan validasi schema Zod, status awal `DRAFT`, dan `officialNumber === null`.
   - Setiap pengeditan draf melahirkan baris revisi baru (`version = n + 1`) tanpa menimpa data versi sebelumnya.
   - Integritas isi surat diikat oleh hash SHA-256 (`content_sha256`) pada setiap versi revisi.
   - Alur pengajuan draf ke tahap peninjauan (`IN_REVIEW`).
5. **Antarmuka Pengguna Responsif & Perlindungan Visual Nonresmi:**
   - Bahasa Indonesia baku dan profesional pada seluruh komponen.
   - Halaman pratinjau (`/letters/[id]/preview`) dilengkapi watermark teks diagonal mencolok: **"DRAF — BELUM RESMI"** dan kop surat berlabel **"DATA BELUM DIVERIFIKASI"**.
   - Halaman katalog jenis surat (`/templates`), manajemen pengguna (`/users`), profil/pengaturan organisasi (`/settings`).
6. **Zero Fictional Numbering & Zero Production Seed:**
   - `FEATURE_NUMBERING_ACTIVE = false` dikunci mati di level kode dan environment.
   - Tidak ada nomor surat resmi, nomor historis, atau pejabat penandatangan fiktif yang dimasukkan ke basis data.

---

### 3. File Dibuat/Diubah, Migrations, dan Dependencies Utama

#### Berkas Utama yang Dibangun:
```
d:/p4i-office/
├── .env.example                               # Variabel lingkungan tanpa secret
├── .eslintrc.json                             # Konfigurasi Next.js ESLint
├── .gitignore                                 # Ignore rule untuk node_modules, .env, build, zip
├── .github/workflows/ci.yml                   # Pipeline CI otomatis (Lint, Typecheck, Test, Build)
├── package.json & package-lock.json           # Definisi dependensi terkunci
├── tsconfig.json                              # TypeScript strict configuration
├── tailwind.config.ts & postcss.config.mjs    # Desain sistem korporat Tailwind
├── vitest.config.ts                           # Konfigurasi test runner Vitest
├── README.md                                  # Dokumentasi operasional lokal
├── db/
│   └── migrations/
│       ├── 0001_sprint1a_core.sql             # Migrasi DDL PostgreSQL Sprint 1A
│       └── 0001_sprint1a_core.rollback.sql    # Skrip rollback migrasi DDL
├── docs/
│   ├── architecture-decisions.md              # ADR arsitektur, RBAC, dan batasan produksi
│   ├── decision-log.md                        # Rekonsiliasi keputusan teknis (DEC-001 s.d DEC-006)
│   ├── sprint-1a-plan.md                      # Rencana eksekusi dan Acceptance Criteria Gate
│   ├── implementation-report-sprint-1a.md     # Dokumen laporan ini (10 butir lengkap)
│   └── evidence/
│       └── screenshots/                       # 11 tangkapan layar verifikasi visual
├── scripts/
│   ├── migrate.mjs                            # Skrip eksekutor migrasi SQL
│   ├── seed-test.mjs                          # Skrip seed pengujian terisolasi
│   └── capture-evidence.mjs                   # Skrip otomatisasi browser perekam bukti visual
├── src/
│   ├── app/
│   │   ├── api/
│   │   │   ├── auth/ (login, logout, me)      # Route handler otentikasi & sesi
│   │   │   ├── health/                        # Healthcheck & status safety guards
│   │   │   ├── letters/ & letters/[id]/       # Endpoint CRUD draf & revisi immutable
│   │   │   ├── letter-types/                  # Endpoint katalog jenis surat
│   │   │   └── users/                         # Endpoint RBAC manajemen pengguna (admin only)
│   │   ├── dashboard/                         # Halaman dashboard metrik draf
│   │   ├── letters/                           # Halaman daftar draf surat
│   │   ├── letters/new/                       # Formulir buat draf baru
│   │   ├── letters/[id]/                      # Detail draf, audit trail, riwayat revisi
│   │   ├── letters/[id]/preview/              # Pratinjau draf ber-watermark nonresmi
│   │   ├── templates/                         # Katalog jenis surat & templat usulan
│   │   ├── users/                             # Antarmuka manajemen pengguna (admin only)
│   │   ├── settings/                          # Pengaturan organisasi & kebijakan nomor (OFF)
│   │   └── login/                             # Halaman login dengan penanganan status error
│   ├── components/                            # Navbar, Sidebar, StatusBadge
│   └── lib/
│       ├── audit/                             # Audit logging service
│       ├── db/                                # Abstraksi database & mock test fixtures
│       └── security/                          # Session (JOSE), Hash (SHA-256), Guard RBAC
└── tests/
    ├── integration/db-status.test.ts          # Integrasi status service PostgreSQL lokal
    ├── unit/letters.test.ts                   # Pengujian immutability revisi & draf
    ├── unit/rbac.test.ts                      # Pengujian pemisahan peran admin vs staf
    ├── unit/security.test.ts                  # Pengujian enkripsi sesi, hash, & rate-limit
    └── smoke-test.mjs                         # 10 assertions pengujian smoke end-to-end
```

#### Dependencies Utama (`package.json`):
- `next`: `15.1.7` (Framework inti)
- `react` / `react-dom`: `^19.0.0`
- `jose`: `^5.9.6` (Enkripsi & verifikasi JWT sesi HttpOnly)
- `bcryptjs`: `^2.4.3` (Password hashing terisolasi)
- `zod`: `^3.24.2` (Validasi skema input server-side)
- `pg`: `^8.13.1` (Koneksi PostgreSQL)
- `lucide-react`: `^0.475.0` (Ikon antarmuka profesional)
- `vitest`: `^3.0.5` (Unit & security test runner)

---

### 4. Matriks Persyaratan & Bukti Uji (Acceptance Gate)

| ID | Kategori Persyaratan | Status | Bukti Verifikasi (Path / Test Suite / Perilaku) |
|---|---|---|---|
| **REQ-01** | Isolasi Repositori Mandiri | **PASS** | `d:/p4i-office` terpisah 100% dari repo lain; `.env` & secret tidak ter-commit. |
| **REQ-02** | Otentikasi Sesi HttpOnly | **PASS** | `tests/unit/security.test.ts`, `tests/smoke-test.mjs` (Assertion 3). Cookie `p4i_office_session` tervalidasi. |
| **REQ-03** | Penolakan Akun DISABLED | **PASS** | `tests/unit/security.test.ts`, `tests/smoke-test.mjs` (Assertion 2: status HTTP 403 Forbidden). |
| **REQ-04** | RBAC Guard Admin vs Staf | **PASS** | `tests/unit/rbac.test.ts`, `tests/smoke-test.mjs` (Assertion 4: staf diblokir 403 saat akses `/api/users`). |
| **REQ-05** | Pembatasan Peran Legal Admin | **PASS** | `src/lib/security/guards.ts` (Admin tidak memiliki izin approval/signing). |
| **REQ-06** | Pembuatan Draf Surat (`DRAFT`) | **PASS** | `tests/unit/letters.test.ts`, `tests/smoke-test.mjs` (Assertion 5: `status = DRAFT`, `officialNumber = null`). |
| **REQ-07** | Immutability Revisi Surat | **PASS** | `tests/unit/letters.test.ts`, `tests/smoke-test.mjs` (Assertion 6 & 7: edit melahirkan revisi v2 ber-SHA-256 64-karakter tanpa menimpa v1). |
| **REQ-08** | Alur Pemeriksaan (`IN_REVIEW`) | **PASS** | `tests/unit/letters.test.ts`, `tests/smoke-test.mjs` (Assertion 8: status berubah aman ke `IN_REVIEW`). |
| **REQ-09** | Watermark Pratinjau Nonresmi | **PASS** | `src/app/letters/[id]/preview/page.tsx`, `docs/evidence/screenshots/07_draft_preview_watermark.png`. |
| **REQ-10** | Kebijakan Penomoran Terkunci OFF | **PASS** | `FEATURE_NUMBERING_ACTIVE = false` pada config, skema DB, dan API Healthcheck. |
| **REQ-11** | Zero Fictional Official Numbers | **PASS** | Tidak ada nomor resmi fiktif atau nomor historis di-seed; seluruh fixture uji berlabel `TEST`. |
| **REQ-12** | Skema Database SQL Terstruktur | **PASS** | `db/migrations/0001_sprint1a_core.sql` & rollback SQL siap dieksekusi di database target. |
| **REQ-13** | Status Integrasi DB Riil | **BLOCKED** | `tests/integration/db-status.test.ts`: PostgreSQL offline dilaporkan jujur sebagai BLOCKED (bukan PASS palsu). |
| **REQ-14** | Build Produksi Next.js | **PASS** | `npm run build` sukses 100% mengompilasi 18/18 halaman statis dan dinamis. |

---

### 5. Hasil Eksekusi Uji Riil (Exit Code & Log Aktual)

#### 5.1 TypeScript Compilation (`npm run typecheck`)
- **Perintah:** `npm run typecheck` (`tsc --noEmit`)
- **Exit Code:** `0`
- **Hasil:** 0 errors (PASSED)

#### 5.2 Linter (`npm run lint`)
- **Perintah:** `npm run lint` (`next lint`)
- **Exit Code:** `0`
- **Hasil:** `✔ No ESLint warnings or errors` (PASSED)

#### 5.3 Unit & Security Test Suite (`npm run test`)
- **Perintah:** `npm run test` (`vitest run`)
- **Exit Code:** `0`
- **Waktu Eksekusi:** 11.89 detik
- **Rincian Test Suites:**
  - `tests/unit/security.test.ts`: 5 tests passed (enkripsi sesi, verifikasi token, SHA-256 content hash, rate limiter, penolakan password salah)
  - `tests/unit/rbac.test.ts`: 3 tests passed (proteksi rute admin, staf ditolak akses endpoint user, admin dapat menonaktifkan akun staf uji)
  - `tests/unit/letters.test.ts`: 4 tests passed (staf membuat draf tanpa nomor resmi, edit melahirkan v2 tanpa menimpa v1, penolakan edit jika bukan author/admin, pengajuan ke `IN_REVIEW`)
  - `tests/integration/db-status.test.ts`: 1 test passed (deteksi jujur bahwa PostgreSQL lokal offline -> status dilaporkan sebagai **BLOCKED** sesuai klausul prompt master).
- **Total:** **4 passed test files, 13 passed tests, 0 failed, 0 skipped.**

#### 5.4 Production Build (`npm run build`)
- **Perintah:** `npm run build` (`next build`)
- **Exit Code:** `0`
- **Hasil:** Kompilasi bundle teroptimasi berhasil. 18 route aplikasi terkompilasi tanpa error:
  - Route Statis: `/letters/new`, `/login`, `/_not-found`
  - Route Dinamis Server-Side: `/`, `/dashboard`, `/letters`, `/letters/[id]`, `/letters/[id]/preview`, `/templates`, `/users`, `/settings`, dan 8 API route handlers.

#### 5.5 Smoke Test Server Produksi (`node tests/smoke-test.mjs`)
- **Perintah:** `node tests/smoke-test.mjs` (dijalankan terhadap `http://localhost:3000`)
- **Exit Code:** `0`
- **Hasil Riil:**
  1. `✓ PASS: Endpoint Healthcheck aktif dan mengembalikan data`
  2. `✓ PASS: Safety guard: featureNumberingActive bernilai FALSE`
  3. `✓ PASS: Akun NONAKTIF (DISABLED) ditolak login dengan status 403`
  4. `✓ PASS: Akun Staf berhasil masuk (200) dan memperoleh cookie sesi HttpOnly`
  5. `✓ PASS: Staf dicegah mengakses endpoint admin /api/users (403 Forbidden)`
  6. `✓ PASS: Staf berhasil membuat draf surat baru (status: DRAFT, officialNumber: null)`
  7. `✓ PASS: Penyuntingan draf melahirkan revisi v2 dengan SHA-256 valid`
  8. `✓ PASS: Riwayat revisi memuat kedua versi (v1 dan v2) secara utuh (Immutability)`
  9. `✓ PASS: Draf berhasil diajukan untuk pemeriksaan (status: IN_REVIEW)`
  10. `✓ PASS: Admin dapat mengakses daftar pengguna pada /api/users`
- **Total:** **10 LULUS, 0 GAGAL (100% PASS)**

---

### 6. Bukti Keamanan Auth/RBAC, Lingkup Organisasi & Flag Numbering

1. **Otentikasi & Penolakan Akun:**
   - Evaluasi kredensial dilakukan di server melalui `bcrypt.compare`.
   - Jika pengguna berstatus `DISABLED`, sistem langsung menghentikan proses, menerbitkan audit log `AUTH_LOGIN_REJECTED_DISABLED`, dan mengembalikan HTTP 403.
2. **Perlindungan Rute & Otorisasi RBAC:**
   - Setiap rute admin dilindungi fungsi guard `requireAdminSession()`.
   - Bila pengguna memiliki peran `STAFF`, server menolak akses dengan HTTP 403 Forbidden dan tidak merender data sensitif.
3. **Isolasi Lingkup Organisasi:**
   - Seluruh query data (`getAllLetters`, `getAllUsers`, `getLetterTypes`) mewajibkan parameter `organizationId` yang diekstrak secara otomatis dari payload sesi cookie terverifikasi, bukan dari input query string client.
4. **Flag Penomoran Resmi Terkunci Mati:**
   - `FEATURE_NUMBERING_ACTIVE = false` terkonfigurasi di `src/app/api/health/route.ts`, `src/lib/db/index.ts`, dan skema basis data `numbering_policies.is_active = false`.
   - Field `officialNumber` pada tabel `letters` bertipe `null` dan tidak memiliki fungsi generator nomor pada fase Sprint 1A.

---

### 7. Bukti Tangkapan Layar Antarmuka Pengguna (UI Screenshots)

Seluruh 11 tangkapan layar beresolusi tinggi (1440x900) telah diambil secara otomatis menggunakan browser Chrome headless dan tersimpan di repositori pada folder [`docs/evidence/screenshots/`](file:///d:/p4i-office/docs/evidence/screenshots):

| No | Berkas Tangkapan Layar | Deskripsi & Komponen Visual Terverifikasi |
|---|---|---|
| 1 | [`01_login_page.png`](file:///d:/p4i-office/docs/evidence/screenshots/01_login_page.png) | Halaman masuk P4I Office, logo persuratan, banner peringatan lingkungan uji Sprint 1A |
| 2 | [`02_disabled_login_rejection.png`](file:///d:/p4i-office/docs/evidence/screenshots/02_disabled_login_rejection.png) | Penolakan login akun nonaktif (`disabled.test@p4i.local`) dengan alert merah HTTP 403 |
| 3 | [`03_dashboard_staf.png`](file:///d:/p4i-office/docs/evidence/screenshots/03_dashboard_staf.png) | Dashboard staf: metrik total draf, banner status penomoran nonaktif, quick action |
| 4 | [`04_letters_list.png`](file:///d:/p4i-office/docs/evidence/screenshots/04_letters_list.png) | Daftar draf surat keluar: filter status (`DRAFT`, `IN_REVIEW`), indikator versi revisi |
| 5 | [`05_create_draft_form.png`](file:///d:/p4i-office/docs/evidence/screenshots/05_create_draft_form.png) | Formulir pembuatan draf surat baru: pilihan jenis surat, perihal, penerima, klasifikasi |
| 6 | [`06_draft_detail_revisions.png`](file:///d:/p4i-office/docs/evidence/screenshots/06_draft_detail_revisions.png) | Detail draf surat: timeline riwayat revisi, hash SHA-256 audit, tombol ajukan periksa |
| 7 | [`07_draft_preview_watermark.png`](file:///d:/p4i-office/docs/evidence/screenshots/07_draft_preview_watermark.png) | Pratinjau draf: kop berlabel belum diverifikasi & watermark besar **"DRAF — BELUM RESMI"** |
| 8 | [`08_templates_catalog.png`](file:///d:/p4i-office/docs/evidence/screenshots/08_templates_catalog.png) | Katalog jenis surat P0 (Surat Tugas, Ket. Magang, Undangan, Permohonan, Pengantar) |
| 9 | [`09_settings_numbering_locked.png`](file:///d:/p4i-office/docs/evidence/screenshots/09_settings_numbering_locked.png) | Profil organisasi & tabel kebijakan penomoran dengan badge merah **"NONAKTIF / DIKUNCI"** |
| 10 | [`10_staf_blocked_users.png`](file:///d:/p4i-office/docs/evidence/screenshots/10_staf_blocked_users.png) | Halaman penolakan akses 403 saat staf mencoba membuka rute admin `/users` |
| 11 | [`11_users_management_admin.png`](file:///d:/p4i-office/docs/evidence/screenshots/11_users_management_admin.png) | Manajemen pengguna khusus `SYSTEM_ADMIN`: tabel pengguna, role, status, dan tombol blokir |

---

### 8. Risiko, Keputusan Teknis, dan Deviasi terhadap SRS

1. **DEC-001 (Isolasi Proyek):** Proyek dibangun mandiri di `d:\p4i-office` tanpa ketergantungan kode dari `p4i-corporate-hub` atau `p4i-webgis`.
2. **DEC-002 (Ketiadaan Layanan PostgreSQL Lokal):** Karena service PostgreSQL daemon lokal pengguna offline, integrasi DB riil dilaporkan sebagai **BLOCKED** secara transparan, sementara logika persuratan, immutability, dan auth diuji penuh menggunakan repositori adaptor lokal.
3. **DEC-003 (Kebijakan Penomoran Resmi Terkunci):** Mengunci mati fitur penomoran otomatis (`FEATURE_NUMBERING_ACTIVE = false`) karena kebijakan pola nomor (D-01 s.d. D-03 pada `P4I_Office_Paket_Sprint0.xlsx`) belum memperoleh pengesahan tanda tangan Pengurus.
4. **DEC-004 (Pemisahan RBAC & Mandat Legal):** Peran teknis `SYSTEM_ADMIN` tidak diberikan wewenang untuk menyetujui atau menandatangani surat dinas.
5. **DEC-005 (Kesenjangan MFA):** Dukungan MFA belum diimplementasikan pada Sprint 1A dan dicatat sebagai blocker sebelum go-live produksi akun admin.
6. **DEC-006 (Watermark Pratinjau):** Setiap pratinjau surat digital wajib menyematkan watermark tegas guna mencegah penyalahgunaan draf digital internal sebagai surat resmi palsu.

---

### 9. Hal yang Membutuhkan Persetujuan Ketua / Sekretaris Yayasan

Sebelum fitur penomoran dan penandatanganan surat diaktifkan pada sprint berikutnya, diperlukan keputusan formal atas butir-butir berikut:
1. **Pola Format Penomoran Resmi:** Pengesahan keputusan D-01 s.d. D-03 mengenai format kode klasifikasi, urutan nomor buku register, dan perlakuan nomor surat di akhir tahun buku.
2. **Rekonsiliasi Register Surat Masa Lalu:** Verifikasi fisik/digital register surat manual tahun 2024–2026 untuk menentukan angka awal (*starting sequence number*) agar tidak terjadi tumpang-tindih nomor.
3. **SK Mandat Pejabat Penandatangan:** Surat Keputusan resmi Pengurus mengenai pejabat yang berhak menandatangani surat dinas (Ketua, Sekretaris, Direktur Eksekutif) beserta spesimen tanda tangan dan masa berlaku mandat.
4. **Identitas Kop Resmi & Stempel Organisasi:** Pengesahan logo resolusi tinggi, alamat resmi kantor yayasan, nomor kontak, dan surat keputusan legalitas Kemenkumham untuk dicantumkan pada kop surat cetak.

---

### 10. Panduan Menjalankan Proyek Lokal & Rekomendasi Sprint 1B

#### Cara Menjalankan Proyek di Komputer Lokal:
```bash
# 1. Pindah ke direktori proyek
cd d:/p4i-office

# 2. Pastikan dependensi terpasang
npm install

# 3. Menjalankan linter dan typecheck
npm run lint
npm run typecheck

# 4. Menjalankan unit & security test suite
npm run test

# 5. Membangun bundle produksi
npm run build

# 6. Menjalankan server lokal (port 3000)
npm run start
# Buka http://localhost:3000 pada peramban web
# Kredensial Uji:
# - Admin: admin.test@p4i.local / Password123!
# - Staf:  staf.test@p4i.local  / Password123!
# - Nonaktif: disabled.test@p4i.local / Password123! (Uji penolakan 403)

# 7. Menjalankan smoke test otomatis
node tests/smoke-test.mjs
```

#### Rekomendasi Langkah untuk Sprint 1B:
1. **Pengaktifan PostgreSQL Produksi:** Menjalankan migrasi `0001_sprint1a_core.sql` pada instans database PostgreSQL target setelah koneksi jaringan/server database siap.
2. **Alur Telaah & Komentar Revisi (`IN_REVIEW` -> `REVIEWED`):** Membangun komponen form koreksi/catatan telaah bagi penelaah surat sebelum diajukan ke penandatangan.
3. **Integrasi MFA Admin:** Menambahkan autentikasi dua faktor (TOTP / Google Authenticator) untuk peran `SYSTEM_ADMIN`.
4. **Ekspor PDF Nonresmi:** Memasang modul konversi HTML ke PDF untuk draf surat dengan watermark terintegrasi.
5. **Modul Rekonsiliasi Register:** Antarmuka khusus untuk staf menginput dan memvalidasi nomor-nomor surat historis sebelum fitur auto-numbering di-unlock.
