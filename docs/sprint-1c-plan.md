# Sprint 1C Execution Plan & Acceptance Criteria
## P4I Office v1.0 — Integrasi Pangkalan Data PostgreSQL Riil, Verifikasi Persistensi, dan Penguatan Keamanan
**Dokumen:** `docs/sprint-1c-plan.md`  
**Sasaran Evaluasi:** Tim Reviewer GPT-6 & Pengurus Yayasan P4I  
**Pelaksana Teknis:** Gemini Flash 3.8 (Reasoning High) di Antigravity IDE  
**Branch Kerja:** `feat/sprint-1c-real-db-verification`  
**Target:** Menutup seluruh blocker PostgreSQL Sprint 1B; membuktikan koneksi, migrasi idempotent, persistensi data riil pasca restart aplikasi & restart pangkalan data, konkurensi revisi aman (row-locking `SELECT FOR UPDATE`), penanganan kegagalan offline tegas (*no silent memory fallback*), verifikasi RBAC & keamanan berbasis data riil, prosedur backup-restore round-trip teruji, dan pembuktian kriteria penerimaan DB-01 hingga DB-08.

---

### 1. Tata Kelola dan Pembagian Peran
Sesuai arahan Master Prompt Sprint 1C:
- **GPT-6:** Tim Perancangan Sistem, Software Architect, System Analyst, penulis dokumen SRS, reviewer independen, auditor kendali mutu, dan penyusun laporan resmi.
- **Gemini IDE:** Pelaksana implementasi kode, penyedia runtime database lokal portabel tanpa instalasi OS invasif, eksekusi automated testing, perbaikan bug, dan pencatat bukti teknis faktual.
- **Pengurus/Ketua P4I:** Pemegang otoritas tunggal untuk keputusan administratif, format penomoran resmi, dan mandat pejabat penandatangan.

> **SAFETY GUARDS MUTLAK (Sprint 1C):**
> 1. **Penomoran Resmi Tetap Nonaktif:** `FEATURE_NUMBERING_ACTIVE = false`, `officialNumber = null`. Tidak ada endpoint, tombol, atau generator nomor fiktif.
> 2. **Tanpa Mandat Fiktif:** Tidak ada pejabat penandatangan atau nomor surat historis fiktif yang dimasukkan ke basis data.
> 3. **Pratinjau Draf Terproteksi:** Seluruh tampilan pratinjau surat tetap menyematkan watermark visual **"DRAF — BELUM RESMI"** dan kop **"DATA BELUM DIVERIFIKASI"**.
> 4. **Integritas Bukti:** Seluruh temuan dicatat faktual tanpa melebih-lebihkan klaim ("100% aman" atau "kebal mutlak" dilarang). Menggunakan PostgreSQL riil (bukan SQLite atau mock yang menyamar sebagai database riil).
> 5. **Batas Ruang Lingkup:** Berhenti di akhir Sprint 1C, tidak melompat ke Sprint 2.

---

### 2. Rincian Rencana Kerja (Checklist Eksekusi)

- [ ] **Tahap 1: Audit Repositori dan Rencana Aksi**
  - [x] Verifikasi commit awal Sprint 1B (`2bb0128f519f881e3cda4d37bfc30d299b4aed3d`).
  - [x] Audit branch kerja `feat/sprint-1c-real-db-verification`.
  - [x] Susun dokumen `docs/sprint-1c-plan.md`.

- [ ] **Tahap 2: Penyediaan PostgreSQL Riil Tanpa Modifikasi OS Invasif**
  - [x] Evaluasi runtime PostgreSQL: Menggunakan native PostgreSQL binaries x64 via `embedded-postgres` (PostgreSQL 18.4) yang berjalan di user-space lokal tanpa memerlukan hak administrator Windows atau daemon Docker.
  - [ ] Sediakan skrip pengelolaan database lokal:
    - `scripts/local-db.mjs` (start, stop, status, createdb) mengikat port 5432 / localhost.
  - [ ] Tambahkan perintah npm: `npm run db:start`, `npm run db:stop`, `npm run db:status`.
  - [ ] Pastikan direktori data `.data/` dan artefak dump diabaikan oleh `.gitignore`.

- [ ] **Tahap 3: Perbaikan Database Router & Mode Operasi**
  - [ ] Perbaiki `AdaptiveDatabaseRouter` pada `src/lib/db/index.ts`:
    - Mode Persistence: Jika PostgreSQL gagal diakses, operasi pangkalan data **wajib menolak/melempar error** (`DatabaseUnavailableError`) dan **dilarang beralih secara diam-diam (*silent fallback*) ke memori**.
    - Mode Simulasi: `MemoryDatabaseStore` hanya boleh aktif jika `DB_SIMULATION="true"` dan `NODE_ENV="test"`.
    - Cegah mode simulasi aktif di lingkungan production.
  - [ ] Status/Health Indicator: Menyediakan status eksplisit `CONNECTED`, `UNAVAILABLE`, dan `SIMULATION`.
  - [ ] Masking rahasia: Memastikan `DATABASE_URL` dan password tidak bocor ke log atau response HTTP `/api/health`.

- [ ] **Tahap 4: Migrasi, Persistensi, dan Exit Codes**
  - [ ] Perbaiki `scripts/migrate.mjs` dan `scripts/seed-test.mjs` agar mengembalikan **exit code 1** (nonzero) jika koneksi atau eksekusi SQL gagal.
  - [ ] Eksekusi migrasi `0001_sprint1a_core.sql` dan `0002_sprint1b_persistence.sql` pada PostgreSQL riil.
  - [ ] Buktikan idempotensi migrasi: eksekusi ulang tidak merusak data dan checksum tercatat di `schema_migrations`.
  - [ ] Jalankan seed data uji (`scripts/seed-test.mjs`) untuk 5 jenis surat P0, 5 pengguna uji, dan unit kerja.
  - [ ] Uji persistensi riil:
    - Simpan draf dan revisi baru.
    - Hentikan proses aplikasi -> nyalakan kembali -> data tetap utuh.
    - Hentikan proses PostgreSQL -> nyalakan kembali -> data tetap utuh.
  - [ ] Uji konkurensi revisi riil: penambahan revisi simultan menggunakan `SELECT FOR UPDATE` menjamin versi berurutan (v1 -> v2, v3, v4) tanpa lost update.

- [ ] **Tahap 5: Verifikasi Keamanan & RBAC pada PostgreSQL Riil**
  - [ ] Login pengguna aktif berhasil dan menghasilkan token sesi tervalidasi.
  - [ ] Penolakan pengguna berstatus `DISABLED` secara langsung saat login dan pemutusan sesi aktif saat akses rute terproteksi.
  - [ ] Pemisahan peran tegas: Staf dilarang mengakses API/halaman administratif (`/api/users` -> HTTP 403).
  - [ ] Validasi kepemilikan surat: Staf dilarang mengubah/menghapus draf milik staf lain (HTTP 403).
  - [ ] Isolasi surat `CONFIDENTIAL`: Hanya dapat dibaca oleh pemilik draf dan administrator.
  - [ ] Validasi payload backend: penolakan data korup/manipulasi field terlarang (HTTP 400).
  - [ ] Keamanan password: hash bcrypt cost factor 10, tanpa kebocoran plaintext.

- [ ] **Tahap 6: Backup dan Restore Otomatis**
  - [ ] Buat skrip `scripts/backup-db.mjs` dan `scripts/restore-db.mjs`.
  - [ ] Uji round-trip otomatis: backup database sumber `p4i_office_test` -> restore ke database target `p4i_office_restore_test`.
  - [ ] Verifikasi kesamaan jumlah baris, relasi foreign key, dan integritas hash SHA-256 konten draf dan revisi.

- [ ] **Tahap 7: Matriks Pengujian Regresi Lengkap (DB-01 s/d DB-08)**
  - [ ] Linter: `npm run lint` (0 error, 0 warning).
  - [ ] Typecheck: `npm run typecheck` (0 error).
  - [ ] Test Suite: `npm run test` (Vitest integration & unit tests PASS).
  - [ ] Build Produksi: `npm run build` (18/18 routes Next.js PASS).
  - [ ] Smoke Test: `node tests/smoke-test.mjs` (100% assertions PASS).
  - [ ] Bukti UI Aktual: Jalankan `scripts/capture-evidence.mjs` untuk tangkapan layar browser otomatis.

- [ ] **Tahap 8: Dokumentasi Teknis dan Rekonsiliasi Keputusan**
  - [ ] Susun `docs/implementation-evidence-sprint-1c.md` dengan 15 bab lengkap.
  - [ ] Catat keputusan arsitektur baru di `docs/decision-log.md` (DEC-010+).
  - [ ] Perbarui `docs/architecture-decisions.md` dan `README.md`.
  - [ ] Commit seluruh artefak ke branch `feat/sprint-1c-real-db-verification`.

---

### 3. Matriks Kriteria Penerimaan (Acceptance Gates DB-01 s/d DB-08)

| Gate ID | Kriteria Penerimaan | Syarat Kelulusan (PASS) |
|---|---|---|
| **DB-01** | Real PostgreSQL Connected | Terhubung ke PostgreSQL native x64 lokal, mengembalikan identitas versi server PostgreSQL riil, healthcheck berstatus `CONNECTED`. |
| **DB-02** | Migrations Up-to-date & Idempotent | Migrasi `0001` dan `0002` tereksekusi sukses, tabel `schema_migrations` memuat checksum SHA-256, eksekusi ulang aman tanpa merusak data. |
| **DB-03** | Real Data Persistence Verified | Draf & revisi tersimpan di database riil; data terbukti tetap utuh setelah proses aplikasi di-restart dan proses PostgreSQL di-restart. |
| **DB-04** | Concurrency & Immutability Proven | Revisi bersifat append-only, request revisi simultan dilindungi transaksi dengan `FOR UPDATE`, nomor revisi unik dan strictly sequential tanpa lost update. |
| **DB-05** | Strict DB Routing & Offline Failure Handling | Tidak ada silent fallback ke memory saat koneksi DB putus. Mode simulasi hanya aktif di test dengan env eksplisit. Health status `UNAVAILABLE` dilaporkan dengan benar. |
| **DB-06** | Security & RBAC Enforcement on Real DB | Autentikasi bcrypt riil, penolakan instan akun `DISABLED`, proteksi rute admin (403), kepemilikan draf (403), dan isolasi surat rahasia. |
| **DB-07** | Backup & Restore Verified Round-trip | Skrip backup dan restore bekerja otomatis, verifikasi restorasi ke database kedua menghasilkan struktur, jumlah baris, dan hash konten identik. |
| **DB-08** | Full Regression & Zero Blocker | Linting (0 error/0 warning), typecheck bersih, build Next.js sukses (18/18 routes), seluruh automated test lulus, smoke test 100%, dan tangkapan layar UI aktual tersimpan. |
