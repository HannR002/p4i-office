# Architecture Decisions Record (ADR) — P4I Office v1.0
## Sprint 1A & 1B: Bootstrap, Security Foundation, Persistensi PostgreSQL & Otorisasi Draf
**Tanggal Dokumen:** 28 Oktober 2026 (Sprint 1A) | 29 Oktober 2026 (Sprint 1B)  
**Status:** DRAFT Disetujui untuk Sprint 1B  
**Pelaksana:** Gemini Flash 3.8 (Reasoning High) di Antigravity IDE  
**Reviewer & Auditor Independen:** GPT  

---

### 1. Konteks dan Lingkup Proyek
P4I Office adalah sistem persuratan dan administrasi internal mandiri untuk Yayasan Pusat Pendidikan dan Penelitian Pembangunan Indonesia (P4I). Sistem ini dikembangkan sebagai repositori dan pangkalan data baru yang terisolasi penuh dari `p4i-corporate-hub` dan `p4i-webgis`.

Sprint 1A berfokus pada:
- Fondasi keamanan dan otentikasi server-side
- RBAC (`SYSTEM_ADMIN` vs `STAFF`)
- Manajemen Draf Surat (`DRAFT`, `IN_REVIEW`), penyimpanan revisi yang tidak menimpa (*append-only/immutable versioning*), serta pratinjau berlabel nonresmi (**DRAF — BELUM RESMI**)
- Skema database terverifikasi versi 1 untuk tabel inti
- Pencegahan mutlak penerbitan nomor surat resmi atau pejabat fiktif.

Sprint 1B memperluas arsitektur dengan fokus pada:
- **Integrasi PostgreSQL Riil:** Membangun `PostgresDatabaseStore` berbasis `pg.Pool` dengan parameterized query 100%, transaksi ACID, dan fail-safe in-memory adapter terisolasi.
- **Pelacakan Migrasi Idempotent:** Penambahan tabel `schema_migrations` dengan pencatatan hash SHA-256 pada setiap berkas DDL SQL.
- **Penanganan Konkurensi Revisi:** Penguncian baris eksplisit `FOR UPDATE` di tingkat database dan mutex per-letter di memori guna mencegah race condition pada perubahan simultan.
- **Otorisasi Kepemilikan Surat (*Letter Ownership Guard*):** Staf dilarang menyunting atau mengajukan draf milik staf lain, dan dilarang membaca surat rahasia (`CONFIDENTIAL`) milik pihak lain.
- **Revokasi Sesi Real-Time:** Pengecekan status akun ke basis data pada setiap request untuk membatalkan sesi akun `DISABLED` secara seketika.

---

### 2. Pilihan Teknologi dan Keputusan Arsitektur Inti (Sprint 1A Baseline)

#### 2.1 Framework & Runtime
- **Next.js 15 (App Router) + React 19 + TypeScript (Strict Mode)**
  - *Alasan:* Mendukung Server Components, Server Actions, Route Handlers dengan evaluasi keamanan *server-side* murni.

#### 2.2 Styling & Antarmuka Pengguna
- **Tailwind CSS + Lucide Icons**
  - *Alasan:* Ringan, standar industri, konsistensi token warna korporat, dukungan visual status jelas (watermark DRAF mencolok).

#### 2.3 Otentikasi & Keamanan Sesi
- **Kombinasi Cookie HttpOnly + Enkripsi Sesi (JOSE JWT) + bcryptjs**
  - *Alasan:* Mencegah token theft via XSS (`SameSite=Lax`, `HttpOnly=true`, `Secure` di HTTPS).
  - *Password Hashing:* `bcryptjs` (salt rounds = 10).
  - *Rate Limiting:* Token bucket per IP dan identitas login untuk mitigasi *brute-force attacks*.

#### 2.4 Pemisahan Peran Teknis vs Otorisasi Legal (RBAC vs Mandat)
- `SYSTEM_ADMIN`: Mengelola pengguna, unit, konfigurasi sistem. **Dilarang keras menyetujui (approve), mengesahkan, atau menandatangani surat dinas.**
- `STAFF`: Membuat draft surat, mengedit revisi baru, melihat template, mengajukan pemeriksaan.

#### 2.5 Penguncian Fitur Penomoran (Zero Fictional Numbering)
- `FEATURE_NUMBERING_ACTIVE = false` terkunci mati pada level konfigurasi, kode, dan database.
- `officialNumber` bertipe `null` pada seluruh draf. Fungsi `allocateOfficialNumber()` melempar eksepsi penolakan eksplisit.

---

### 3. Keputusan Arsitektur Lanjutan Sprint 1B

#### 3.1 Pola Akses Basis Data Adaptif (`AdaptiveDatabaseRouter`)
- **Implementasi:** Memisahkan abstraksi `IDatabaseStore` menjadi dua implementasi konkret:
  1. `PostgresDatabaseStore`: Menggunakan `pg.Pool`, mengeksekusi parameterized query murni (`$1, $2, ...`), transaksi ACID (`BEGIN`, `COMMIT`, `ROLLBACK`), dan penguncian baris (`FOR UPDATE`).
  2. `MemoryDatabaseStore`: Adapter fail-safe lokal in-memory yang mengimplementasikan kontrak interface yang sama persis, dengan mutex asinkron untuk simulasi konkurensi.
- **Rasional:** Memastikan aplikasi siap beroperasi dengan PostgreSQL riil saat service online, sekaligus menyediakan lingkungan yang dapat diuji dan diverifikasi statis secara konsisten jika daemon DB lokal sedang offline, tanpa mengarang hasil uji (pelaporan jujur: `BLOCKED`).

#### 3.2 Pelacakan Migrasi Idempotent (`schema_migrations`)
- **Implementasi:** Migrasi `0002_sprint1b_persistence.sql` menambahkan tabel `schema_migrations (version PRIMARY KEY, applied_at timestamptz, checksum text)`.
- **Rasional:** Skrip `scripts/migrate.mjs` memvalidasi checksum dan status setiap berkas SQL sebelum dieksekusi. Eksekusi ulang (*re-run*) migrasi dijamin aman (*idempotent*) dan tidak akan merusak skema atau data yang telah ada.

#### 3.3 Penanganan Konkurensi & Immutability Revisi
- **Implementasi:** Pada `PostgresDatabaseStore`, mutasi draf surat menggunakan `SELECT ... FOR UPDATE` pada transaksi tertutup. Penambahan revisi bersifat murni append-only ke `letter_revisions` dengan constraint `UNIQUE(letter_id, version)`. Setiap revisi diikat oleh hash SHA-256 (`content_sha256`) dari konten JSON terurut.
- **Rasional:** Menjamin nomor revisi bersifat sekuensial unik (v1, v2, v3...) dan permintaan simultan tidak akan menyebabkan pembaruan yang hilang (*lost updates*) atau duplikasi versi.

#### 3.4 Otorisasi Kepemilikan Surat & Isolasi Kerahasiaan
- **Implementasi:**
  - Operasi `addRevision` dan `submitForReview` memeriksa `author.id === letter.author_id || author.role === 'SYSTEM_ADMIN'`. Pelanggaran ditolak dengan HTTP 403 Forbidden.
  - Pembacaan surat dengan klasifikasi `CONFIDENTIAL` membatasi akses hanya kepada pembuat draf dan administrator.
- **Rasional:** Menutup celah di mana pengguna staf dapat menyunting atau melihat draf berstatus rahasia milik staf lain.

#### 3.5 Revokasi Sesi Real-Time untuk Akun Nonaktif
- **Implementasi:** Fungsi `getCurrentUser()` pada `src/lib/security/session.ts` memverifikasi token JWT sekaligus memeriksa status pengguna terkini di basis data. Jika pengguna telah diubah menjadi `DISABLED`, sesi langsung dibatalkan (*revoked*) pada request tersebut.
- **Rasional:** Mencegah pengguna yang baru saja dinonaktifkan oleh administrator tetap dapat bertransaksi hingga masa berlaku token JWT (8 jam) habis.

---

### 4. Keputusan Arsitektur Lanjutan Sprint 1C (Real PostgreSQL Integration & Hardening)

#### 4.1 Penyediaan Runtime PostgreSQL Native Portabel
- **Implementasi:** Mengintegrasikan runtime PostgreSQL 18.4 native x64 via `embedded-postgres` yang berjalan pada user-space lokal (`.data/postgres`) terikat hanya ke `127.0.0.1:5432`.
- **Rasional:** Menjawab tantangan ketiadaan Docker Desktop dan ketiadaan izin instalasi OS Windows invasif, sekaligus menghadirkan instans PostgreSQL riil yang sesungguhnya untuk development, migrasi, dan pengujian.

#### 4.2 Eliminasi Silent Memory Fallback & Penegakan Strict Database Routing
- **Implementasi:** `AdaptiveDatabaseRouter` diperketat. Jika PostgreSQL offline, sistem menolak operasi data dan melempar `DatabaseUnavailableError` (health: `UNAVAILABLE`). Tidak ada lagi peralihan diam-diam (*silent fallback*) ke memori. Mode in-memory hanya boleh aktif jika `DB_SIMULATION=true` dan `NODE_ENV=test` secara eksplisit, dan mutlak dilarang di production.
- **Rasional:** Menjamin kepatuhan persistensi data dan mencegah inkonsistensi transaksi yang hilang di memori tanpa disadari.

#### 4.3 Normalisasi Tipe Data DATE (OID 1082)
- **Implementasi:** Menambahkan parser tipe data PostgreSQL `pg.types.setTypeParser(1082, (val) => val)` pada koneksi pool dan skrip migrasi/backup/restore.
- **Rasional:** Mengembalikan tanggal `YYYY-MM-DD` sebagai string murni, menghilangkan pergeseran tanggal (*date shifting*) akibat konversi objek JavaScript Date di zona waktu lokal (GMT+7 vs UTC).

#### 4.4 Prosedur Backup & Restore Berbasis Transaksi ACID & SHA-256 Round-Trip
- **Implementasi:** Menyediakan skrip `scripts/backup-db.mjs` dan `scripts/restore-db.mjs` dengan urutan topologis relasi database, ekspor data terstruktur, dan validasi restorasi ke database kedua (`p4i_office_restore_test`) dengan verifikasi bit-for-bit hash SHA-256.
- **Rasional:** Memenuhi kriteria penerimaan DB-07 dengan jaminan matematis bahwa proses pemulihan data tidak merusak relasi foreign key atau integritas konten draf.

#### 4.5 Penegakan Exit Code Non-Zero pada Skrip Otomasi
- **Implementasi:** Mengubah penanganan error pada `scripts/migrate.mjs` dan `scripts/seed-test.mjs` agar memanggil `process.exit(1)` saat terjadi kegagalan.
- **Rasional:** Memastikan kegagalan koneksi atau eksekusi SQL tidak ditutupi dengan exit code 0 yang dapat mengecoh pipeline CI/CD.

---

### 5. Batasan Produksi yang Masih Terbuka (Production Blockers)
1. **Pola Penomoran Resmi Belum Disahkan:** Dokumen D-01 s.d. D-03 pada `P4I_Office_Paket_Sprint0.xlsx` masih memerlukan SK / tanda tangan Pengurus.
2. **Ketiadaan Rekonsiliasi Register Masa Lalu:** Arsip surat 2024–2026 belum diimpor atau diverifikasi.
3. **Ketiadaan Mandat Pejabat:** Pejabat penandatangan (Ketua / Sekretaris) belum memiliki SK mandat digital.
4. **MFA Administrator:** Dukungan MFA untuk peran `SYSTEM_ADMIN` belum diaktifkan (dijadwalkan Sprint 2).
5. **Ketersediaan Layanan PostgreSQL:** **TERSELESAIKAN (RESOLVED) di Sprint 1C** via local PostgreSQL 18.4 native runner. Status koneksi: `CONNECTED`, migrasi idempotent tervalidasi, persistensi terbukti.
