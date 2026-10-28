# Sprint 1A Execution Plan & Acceptance Criteria
## P4I Office v1.0 — Bootstrap, Security Foundation & Surat Draft
**Tanggal Mulai:** 28 Oktober 2026  
**Target:** Fondasi Sistem, Autentikasi, RBAC, CRUD Draft, Immutability Revisi, dan Verifikasi Nyata  

---

### 1. Checklist Pekerjaan

- [x] **A. Audit dan Blueprint Singkat**
  - [x] Inspeksi lingkungan lokal (Node.js v22.14.0, npm 10.9.2, Git 2.47.1, PostgreSQL service check).
  - [x] Evaluasi berkas handoff (`SRS v1.0`, `P4I_Office_DB_schema_v1.sql`, `P4I_Office_Paket_Sprint0.xlsx`, `Instruksi Sprint 1`).
  - [x] Dokumentasi Architecture Decisions Record (`docs/architecture-decisions.md`).
  - [x] Dokumentasi Rencana & Acceptance Criteria (`docs/sprint-1a-plan.md`).

- [x] **B. Scaffold Proyek & Operasional Lokal**
  - [x] Inisialisasi Git repository lokal (`git init`).
  - [x] Konfigurasi struktur modular: `src/app`, `src/components`, `src/features`, `src/lib`, `db/migrations`, `tests`.
  - [x] Konfigurasi TypeScript strict mode (`tsconfig.json`), Tailwind CSS, ESLint.
  - [x] Siapkan `.gitignore`, `.env.example` tanpa secret, README.md instruksi lokal.
  - [x] Siapkan skrip `npm run dev`, `npm run build`, `npm run lint`, `npm run typecheck`, `npm run test`, `npm run db:migrate`.
  - [x] Siapkan CI workflow GitHub Actions (`.github/workflows/ci.yml`).

- [x] **C. Basis Data & Model Keamanan**
  - [x] Buat file migrasi SQL versi 1 (`db/migrations/0001_sprint1a_core.sql`) untuk tabel inti:
    - `organizations`, `org_units`, `users`, `roles`, `user_roles`
    - `numbering_policies` (flag `is_active=false`, `legacy_reconciled=false`)
    - `letter_types`, `letter_templates`
    - `letters`, `letter_revisions`
    - `audit_events`
  - [x] Implementasikan lapisan basis data (`src/lib/db`) dengan dukungan PostgreSQL dan fail-safe in-memory/mock fallback untuk pengetesan tanpa daemon DB aktif.
  - [x] Pastikan penomoran resmi terkunci mati (`FEATURE_NUMBERING_ACTIVE=false`).
  - [x] Buat skrip seed test lokal terisolasi (`npm run db:seed:test`) dengan kredensial test bertanda jelas (`staf.test@p4i.local`, `admin.test@p4i.local`), DILARANG seed ke database produksi.

- [x] **D. Fitur Inti & Antarmuka Pengguna (Bahasa Indonesia)**
  - [x] Modul Auth & RBAC:
    - Login dengan rate-limiting & proteksi brute force.
    - Sesi HttpOnly cookie terenkripsi.
    - Penolakan akun dengan status `DISABLED`.
    - Server-side guard untuk peran `SYSTEM_ADMIN` vs `STAFF`.
    - Pencatatan kesenjangan MFA (*gap analysis*).
  - [x] Halaman & Komponen UI:
    - `/login`: Form masuk dengan penanganan status error.
    - `/dashboard`: Metrik draf, data kosong nyata (*clean empty state*), tombol aksi cepat.
    - `/letters`: Daftar draf surat, filter status, indikator revisi.
    - `/letters/new`: Formulir pembuatan draf surat baru dengan validasi schema Zod & sanitasi.
    - `/letters/[id]`: Tinjauan detail draf, riwayat revisi (*immutable audit trail*), perbandingan versi.
    - `/letters/[id]/preview`: Pratinjau draf dengan watermark mencolok **"DRAF — BELUM RESMI"** dan kop berlabel belum diverifikasi.
    - `/templates`: Katalog jenis surat dan template rancangan (*status: USULAN*).
    - `/users`: Manajemen pengguna dan peran (khusus `SYSTEM_ADMIN`, staf diblokir 403).
    - `/settings`: Profil organisasi dan kebijakan penomoran (status: nonaktif / belum diverifikasi).

- [x] **E. Verifikasi Nyata & Laporan**
  - [x] Jalankan ESLint (`npm run lint`) — catat log dan exit code (0 errors, 0 warnings).
  - [x] Jalankan TypeScript compiler (`npm run typecheck`) — catat log dan exit code (0 errors).
  - [x] Jalankan Unit & Security Test (`npm run test`) — 13 passed, 4 test suites, exit code 0.
  - [x] Jalankan Build (`npm run build`) — 18/18 static & dynamic pages terkompilasi, exit code 0.
  - [x] Verifikasi Smoke Test UI & API guards:
    - Akun nonaktif gagal login (403 Forbidden).
    - Staf gagal akses endpoint / halaman admin (403 Forbidden).
    - Revisi draf tidak menimpa versi sebelumnya (hash SHA-256 terbukti).
    - Penomoran resmi tidak menghasilkan nomor atau seed (officialNumber === null).
    - 10/10 assertions PASS nyata via `tests/smoke-test.mjs`.
  - [x] Tangkap bukti visual UI (11 screenshot resolusi tinggi di `docs/evidence/screenshots/`).
  - [x] Susun `docs/implementation-report-sprint-1a.md` sesuai format wajib 10 poin.

---

### 2. Kriteria Penerimaan (Acceptance Criteria Gate)

| ID Gate | Persyaratan | Kriteria Lulus (PASS) |
|---|---|---|
| **AC-01** | Isolasi Repositori | Proyek berdiri sendiri, terpisah dari repo P4I lain, bebas secret. |
| **AC-02** | Keamanan Otentikasi & RBAC | Sesi HttpOnly, rate limit aktif, akun DISABLED ditolak, staf dilarang akses admin (403), role admin tidak bisa approve surat. |
| **AC-03** | Skema & Migrasi DB | Migrasi SQL terstruktur dengan UUID, UTC timestamptz, foreign key aman, constraint unik; deteksi DB akurat. |
| **AC-04** | Immutability Draf & Revisi | Penambahan/perubahan isi surat mencatat baris baru di `letter_revisions` dengan SHA-256 hash valid, revisi lama tetap utuh. |
| **AC-05** | Pencegahan Nomor Fiktif | Flag penomoran resmi 100% OFF, tidak ada seed nomor surat resmi, watermark DRAF terpasang pada pratinjau. |
| **AC-06** | Pengujian Berbasis Bukti | Lint, typecheck, unit test, build lulus nyata dengan rekaman log dan exit code 0. Status DB integrasi ditandai BLOCKED jika service offline. |
| **AC-07** | Pelaporan Lengkap | Dokumen `docs/implementation-report-sprint-1a.md` lengkap mencakup 10 butir evaluasi. |
