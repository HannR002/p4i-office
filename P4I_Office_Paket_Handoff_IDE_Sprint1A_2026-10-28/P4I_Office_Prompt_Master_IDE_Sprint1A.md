# P4I OFFICE — PROMPT MASTER UNTUK IDE
## Sprint 1A | Bootstrap, Security Foundation & Surat Draft
Tanggal arahan: 28 Oktober 2026 | Pelaksana kode: Gemini Flash 3.8 (reasoning high) di IDE | Reviewer/pelapor: GPT

**Tujuan:** membangun fondasi aplikasi P4I Office v1.0 sebagai aplikasi internal baru dan terpisah dari `p4i-corporate-hub` dan `p4i-webgis`. Fase ini BELUM menerbitkan surat resmi atau nomor surat resmi.

### 0. Aturan prioritas & source of truth
Sebelum mengoding, buka dan baca seluruh berkas berikut dalam workspace proyek:
1. `P4I_Office_SRS_v1.0_2026-10-28.docx` (spesifikasi persyaratan);
2. `P4I_Office_DB_schema_v1.sql` (referensi skema, BUKAN migrasi production-ready);
3. `P4I_Office_Paket_Sprint0.xlsx` (input register lama, mandat, policy, dan backlog);
4. `P4I_Office_Instruksi_Implementasi_Sprint1.md` (instruksi awal).
Jika berkas tidak ada/tidak dapat dibaca, laporkan dengan tepat dan jangan mengaku telah menganalisisnya. Jangan menebak keputusan organisasi yang belum disahkan. Dokumen ini mempersempit lingkup eksekusi menjadi Sprint 1A; jika ada pertentangan dengan detail implementasi sebelumnya, catat dalam `docs/decision-log.md` dan utamakan keselamatan data dan persetujuan yang valid.

### 1. Batas lingkup dan aturan keamanan
- Dilarang mengubah repositori Corporate Hub, WebGIS, aplikasi lain, atau DB eksternal P4I.
- Boleh membuat repo PRIVATE `p4i-office` di akun GitHub pemilik bila akses/otorisasinya tersedia; jika tidak, kerjakan folder lokal yang bersih dan laporkan bahwa remote belum disiapkan. Jangan meminta token melalui chat atau commit secret.
- Tidak boleh deploy, membuat akun nyata di production, mengirim email/surat sungguhan, mengimpor surat asli, menerbitkan nomor resmi, membuat tanda tangan pejabat atau memasukkan mandat fiktif.
- Dilarang menggunakan angka contoh `001/P4I/X/2026` sebagai nomor surat resmi; seluruh fixture harus jelas berlabel TEST dan dipisah dari production.
- Jangan mengeksekusi `P4I_Office_DB_schema_v1.sql` apa adanya di production: audit dan buat migrasi versi pertama yang aman di DB LOCAL/TEST.
- Jangan memaksa penyelesaian jika menemukan blocker yang memerlukan mandat/SOP; pasang pengaman dan laporkan.

### 2. Keputusan arsitektur Sprint 1A
- Aplikasi: Next.js App Router + TypeScript strict + Tailwind CSS.
- Database: PostgreSQL dengan migrasi terversi dan transaction-safe. Pilih ORM/query builder secara eksplisit berdasarkan kompatibilitas, dokumentasikan alasan dan lock versi dependensi.
- Validasi: skema input server-side; output encoding dan sanitasi untuk input yang akan dimasukkan ke dokumen.
- Authentication: library yang terpelihara, sesi aman, rate limit login, proteksi endpoint, akun DISABLED ditolak. Jika dukungan MFA belum diterapkan, tandai sebagai gap yang memblokir admin production (jangan klaim sudah tersedia).
- RBAC: paling sedikit `SYSTEM_ADMIN` dan `STAFF`. Peran teknis tidak otomatis memberi mandat review, approval, atau sign.
- UI: bahasa Indonesia, navigasi responsif, aksesibilitas dasar (label field, state error, keyboard).
- Surat pada fase ini: `DRAFT`, simpan revisi immutable, pratinjau NONRESMI; status `IN_REVIEW` hanya bila alurnya dapat diuji secara aman. Tampilkan watermark/cap "DRAF — BELUM RESMI" pada preview.
- Header konfigurasi organisasi boleh placeholder (jelas diberi label belum diverifikasi), jangan menampilkan alamat/kontak atau tanda tangan palsu sebagai informasi resmi.

### 3. Urutan kerja WAJIB (jangan melompat)
**A. Audit dan blueprint singkat**
- Inspeksi environment (node/package manager, git, port DB lokal), berkas spesifikasi, dan potensi konflik skema; catat risiko.
- Tulis `docs/architecture-decisions.md`: pilihan library, alasan, skema akses, batasan production.
- Tulis `docs/sprint-1a-plan.md` berisi checklist & acceptance criteria.

**B. Scaffold dan operasional lokal**
- Buat proyek baru `p4i-office` dengan struktur modular (auth, letters, templates, security, audit, db).
- Siapkan `.gitignore`, `.env.example` tanpa secret, README, perintah `dev`, `lint`, `typecheck`, `test`, `build`, migrasi up/down atau rollback plan, dan CI GitHub Actions bila repo tersedia.
- Hindari dependencies usang; pasang lockfile.

**C. Database & keamanan**
- Implementasikan hanya tabel minimum untuk organisasi, pengguna, peran, draft surat, jenis/templat, revisi, dan audit; migrasi dapat dijalankan di DB test kosong.
- Terapkan foreign key, constraint, ID UUID, timestamps UTC, scope organisasi server-side, dan soft-disable akun.
- Persiapkan desain kebijakan nomor tetapi **pastikan flag numbering production selalu OFF**. Jangan seed nomor historis atau pejabat berwenang.
- Akun uji lokal (bila perlu) dibuat melalui script seed TEST yang tidak berjalan di production.

**D. Antarmuka Sprint 1A**
- Halaman Login, Dashboard (data kosong nyata), Surat Keluar, Buat Draf, Detail Draf/Riwayat Revisi, Templat (listing), Pengguna/Peran (admin only), Pengaturan (read-only jika belum valid).
- Form draf minimal: jenis surat, perihal, penerima, klasifikasi, tanggal rencana, isi/parameter templat. Sanitasi, error states, optimistic concurrency/versioning.
- Aksi: buat draf, ubah sebagai revisi baru, lihat riwayat, tampilkan preview berlabel DRAF; jangan beri nomor resmi.
- Gunakan UI bersih dan profesional; jangan mengorbankan business logic demi animasi.

**E. Verifikasi**
Jalankan dan CATAT keluaran riil setiap perintah (jangan karang keberhasilan):
- lint, typecheck, unit test, integration test DB (jika koneksi tersedia), build;
- smoke test UI minimal; uji akses tidak sah pada API dan unduhan;
- pastikan akun staf gagal ke menu admin; akun nonaktif gagal login;
- pastikan revisi draf tidak menimpa revisi sebelumnya;
- pastikan tidak ada nomor surat resmi di-seed atau dihasilkan;
- audit dependency dan secret scanner bila tersedia.
Jika DB tak tersedia, tandai tes integration BLOCKED, bukan PASS.

### 4. Acceptance Gate untuk Sprint 1A
`PASS` hanya bila: (1) proyek baru terisolasi; (2) aplikasi berjalan lokal; (3) autentikasi & RBAC dicek server-side; (4) migrasi test DB aman; (5) CRUD draft & revisi dapat ditunjukkan; (6) semua perintah yang tersedia lulus dengan log; (7) tidak ada official numbering/mandate/deploy yang aktif; (8) dokumen laporan lengkap.
Jika ada item gagal/block, laporkan secara eksplisit dan beri rencana perbaikan. Dilarang memberi status "selesai" hanya berdasarkan tampilan UI.

### 5. Format hasil balik ke GPT (WAJIB)
Buat `docs/implementation-report-sprint-1a.md` dengan struktur:
1. Tanggal, branch, commit SHA, link PR (jika ada), lingkungan kerja;
2. Tujuan sprint dan ringkasan pekerjaan aktual;
3. File dibuat/diubah, migrations, dependencies utama;
4. Tabel `Requirement | Status (PASS/PARTIAL/FAIL/BLOCKED) | Bukti (path, test name, commit)`;
5. Daftar perintah test, exit code, ringkasan hasil, jumlah test lulus/gagal/skip (tanpa mengarang);
6. Bukti keamanan auth/RBAC, pembatasan data organisasi, flag numbering OFF;
7. Screenshot UI atau lokasi file preview (jika tersedia);
8. Risiko, keputusan teknis dan perubahan terhadap SRS;
9. Hal yang membutuhkan persetujuan Ketua/Sekretaris;
10. Cara menjalankan proyek dan langkah yang direkomendasikan untuk Sprint 1B.

**Output percakapan akhir IDE:** ringkasan maksimum 15 baris berisi status, link repo/PR, commit SHA, hasil test, blocker, dan lokasi laporan. Bila belum PUSH, nyatakan jelas dan jangan buat tautan palsu.

### 6. Stop conditions
BERHENTI dan laporkan sebelum tindakan eksternal destruktif (drop DB, overwrite data), deployment, impor surat nyata, penerbitan nomor resmi, dan penandatanganan. Persetujuan umum Ketua atas pembangunan aplikasi bukan persetujuan otomatis atas isi SOP/mandat/nomor.

Mulai kerjakan secara berurutan. Jangan menjawab dengan rencana saja: implementasikan seluruh item yang dapat diselesaikan aman di lingkungan yang tersedia, jalankan tes, lalu keluarkan laporan berbasis bukti.
