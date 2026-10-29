# Sprint 1B Execution Plan & Acceptance Criteria
## P4I Office v1.0 — Integrasi Pangkalan Data PostgreSQL & Penguatan Otorisasi Draf
**Dokumen:** `docs/sprint-1b-plan.md`  
**Sasaran Evaluasi:** Tim Reviewer GPT & Pengurus Yayasan P4I  
**Pelaksana Teknis:** Gemini Flash 3.8 (Reasoning High) di Antigravity IDE  
**Branch Kerja:** `feat/sprint-1b-db-integration`  
**Target:** Integrasi PostgreSQL riil, pelacakan migrasi, penguatan otorisasi kepemilikan draf (ownership guard), penanganan konkurensi revisi, persistensi data, dan matriks pengujian T01–T16.

---

### 1. Konteks dan Batasan Sprint 1B

Sprint 1B bertujuan menutup blocker database dan mengubah fitur persuratan dari logika berbasis penyimpanan sementara (*in-memory fallback*) menjadi implementasi dengan persistensi PostgreSQL yang nyata, tanpa merusak capaian Sprint 1A dan tanpa mengaktifkan penerbitan surat resmi.

> **SAFETY GUARDS MUTLAK (Sprint 1B):**
> 1. **Penomoran Resmi Tetap Nonaktif:** `FEATURE_NUMBERING_ACTIVE = false`, `officialNumber = null`. Tidak ada endpoint, tombol, atau generator nomor fiktif.
> 2. **Tanpa Mandat Fiktif:** Tidak ada pejabat penandatangan atau nomor surat historis fiktif yang dimasukkan ke basis data.
> 3. **Pratinjau Draf Terproteksi:** Seluruh tampilan pratinjau surat tetap menyematkan watermark visual **"DRAF — BELUM RESMI"** dan kop **"DATA BELUM DIVERIFIKASI"**.
> 4. **Transparansi Status Lingkungan:** Jika PostgreSQL lokal offline/tidak tersedia di mesin host, status koneksi dan migrasi riil dilaporkan sebagai **BLOCKED** secara jujur (bukan mock yang menyamar sebagai koneksi riil).

---

### 2. Rincian Rencana Kerja (Checklist)

- [ ] **Tahap 1: Audit dan Baseline Repositori**
  - [x] Verifikasi commit awal Sprint 1A (`b801b72`).
  - [x] Eksekusi baseline `lint`, `typecheck`, `test`, `build`, dan `smoke-test`.
  - [x] Buat branch kerja `feat/sprint-1b-db-integration`.

- [ ] **Tahap 2: Deteksi dan Integrasi PostgreSQL**
  - [x] Deteksi ketersediaan service PostgreSQL lokal dan Docker pada mesin host.
  - [ ] Bangun lapisan koneksi PostgreSQL (`pg.Pool`) dengan parameterisasi query 100%, SSL config, dan deteksi koneksi adaptif.
  - [ ] Implementasikan `PostgresDatabaseStore` dengan query SQL terparameterisasi penuh (`$1, $2, ...`), transaksi ACID (`BEGIN`, `COMMIT`, `ROLLBACK`), dan penguncian baris (`FOR UPDATE`) untuk konkurensi revisi.
  - [ ] Siapkan fail-safe adaptif (`MemoryDatabaseStore`) dengan kontrak antarmuka identik agar verifikasi statis, linter, typecheck, dan pengetesan lokal tetap berjalan aman bila daemon offline.
  - [ ] Buat migrasi SQL lanjutan (`db/migrations/0002_sprint1b_persistence.sql`) untuk tabel pelacak migrasi `schema_migrations`, indeks performa, dan kolom pendukung.
  - [ ] Perbarui skrip migrasi (`scripts/migrate.mjs`) agar mencatat versi migrasi di `schema_migrations` secara idempotent.
  - [ ] Perbarui skrip seeding uji (`scripts/seed-test.mjs`) untuk 5 jenis surat P0 dengan identitas UUID terstandarisasi.

- [ ] **Tahap 3: Penguatan Autentikasi dan Otorisasi (Auth & RBAC)**
  - [ ] Hashing password aman (`bcryptjs`, salt rounds = 10).
  - [ ] Sesi tervalidasi di server (`verifySessionToken`, HttpOnly cookie).
  - [ ] Penolakan akun `DISABLED` secara real-time saat login dan pada setiap request sesi via pengecekan status pangkalan data.
  - [ ] Pemisahan peran tegas (`SYSTEM_ADMIN` vs `STAFF`); staf dilarang mengakses rute dan API administratif (`/api/users` -> HTTP 403).
  - [ ] Penguatan Otorisasi Kepemilikan Surat (*Letter Ownership Check*):
    - Staf hanya berhak menyunting dan mengajukan draf miliknya sendiri (HTTP 403 jika menyunting draf orang lain).
    - Surat berklasifikasi `CONFIDENTIAL` hanya dapat dibaca oleh pembuat draf atau administrator sistem.
  - [ ] Perlindungan terhadap mutasi audit log (append-only trigger & database level).

- [ ] **Tahap 4: Persistensi Draf, Immutability, dan Pencegahan Race Condition**
  - [ ] Draf tersimpan dan terbaca dari database.
  - [ ] Setiap pembaruan draf menghasilkan baris revisi baru (`version = n + 1`) tanpa menimpa baris lama.
  - [ ] Nomor revisi berurutan dan unik per surat (`UNIQUE(letter_id, version)`).
  - [ ] Penanganan perubahan simultan (*concurrency guard*) menggunakan `FOR UPDATE` di PostgreSQL dan proteksi antrian asinkron pada lapisan repository.
  - [ ] Validasi isi surat di tingkat backend menggunakan skema Zod.
  - [ ] Integritas konten dijamin melalui hash SHA-256 (64 karakter hex).

- [ ] **Tahap 5: Penguncian Penomoran Resmi**
  - [ ] `officialNumber` tetap bernilai `null` pada seluruh draf.
  - [ ] Fungsi `allocateOfficialNumber()` melempar eksepsi penolakan eksplisit.
  - [ ] Endpoint `/api/health` mengembalikan `featureNumberingActive = false`.

- [ ] **Tahap 6: Eksekusi Matriks Pengujian Wajib (T01–T16)**
  - [ ] T01: Koneksi nyata database development/test.
  - [ ] T02: Migration up berhasil.
  - [ ] T03: Migration / re-run tidak merusak data (idempotent).
  - [ ] T04: Create draft tersimpan di basis data.
  - [ ] T05: Data tetap tersedia setelah restart proses aplikasi.
  - [ ] T06: Revisi v1/v2 immutable (hash SHA-256 terjaga).
  - [ ] T07: Akses staf ke endpoint/halaman admin ditolak (403).
  - [ ] T08: Pengguna berstatus DISABLED ditolak masuk dan sesinya dibatalkan (403).
  - [ ] T09: Pengguna tanpa hak tidak dapat membaca/mengubah draf orang lain (403).
  - [ ] T10: Input tidak valid ditolak oleh validasi backend (400).
  - [ ] T11: Request simultan tidak merusak nomor revisi atau menghilangkan data.
  - [ ] T12: Nomor resmi tetap tidak dialokasikan (`officialNumber === null`).
  - [ ] T13: Audit log tercatat untuk seluruh aksi penting.
  - [ ] T14: Tidak ada kebocoran secrets di repositori / git diff.
  - [ ] T15: Seluruh perintah linter, typecheck, build produksi, unit test, dan smoke test lulus.
  - [ ] T16: Antarmuka pengguna diverifikasi nyata di browser via tangkapan layar otomatis.

- [ ] **Tahap 7: Dokumentasi Teknis dan Rekonsiliasi Keputusan**
  - [ ] Susun `docs/implementation-evidence-sprint-1b.md` lengkap 14 poin.
  - [ ] Catat keputusan teknis baru di `docs/decision-log.md`.
  - [ ] Perbarui `docs/architecture-decisions.md` jika ada perubahan arsitektur yang disetujui.
  - [ ] Simpan tangkapan layar bukti ke `docs/evidence/sprint-1b/screenshots/`.
  - [ ] Perbarui `README.md` dengan petunjuk verifikasi database.

---

### 3. Matriks Kriteria Penerimaan (Acceptance Criteria Gate Sprint 1B)

| ID Gate | Persyaratan | Kriteria Kelulusan (PASS) |
|---|---|---|
| **AC-01** | Integrasi PostgreSQL Riil | Kode interaksi PostgreSQL terimplementasi dengan parameterized SQL, transaksi, pooling, dan penanganan error adaptif. |
| **AC-02** | Pelacakan Migrasi Idempotent | Skrip migrasi mencatat riwayat eksekusi pada `schema_migrations`; re-run tidak merusak skema atau data. |
| **AC-03** | Immutability & Concurrency | Penambahan revisi bersifat append-only, nomor revisi strictly sequential, dan request simultan tidak menyebabkan race condition. |
| **AC-04** | Otorisasi Kepemilikan Surat | Staf dilarang membaca surat rahasia orang lain dan dilarang menyunting draf milik staf lain (HTTP 403). |
| **AC-05** | Revokasi Akun DISABLED Seketika | Akun yang diubah menjadi DISABLED langsung ditolak pada request berikutnya meskipun token JWT belum kadaluwarsa. |
| **AC-06** | Penguncian Nomor Resmi | Fitur penomoran 100% OFF, `officialNumber === null`, generator nomor menolak alokasi. |
| **AC-07** | Transparansi Bukti Pengujian | Seluruh pengujian T01–T16 dilaporkan apa adanya; jika layanan DB lokal offline, dilaporkan sebagai BLOCKED tanpa mock palsu. |
