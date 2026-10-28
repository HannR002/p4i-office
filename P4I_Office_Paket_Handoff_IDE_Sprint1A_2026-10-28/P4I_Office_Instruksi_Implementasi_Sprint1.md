# P4I Office v1.0 — Instruksi Implementasi Sprint 1

**Status:** Mulai pengembangan fondasi setelah persetujuan prinsip Ketua.  
**Rujukan utama:** `P4I_Office_SRS_v1.0_2026-10-28.docx`, `P4I_Office_DB_schema_v1.sql`, `P4I_Office_Paket_Sprint0.xlsx`.  
**Batas:** Jangan menyalakan penerbitan nomor resmi atau memasukkan mandat penandatangan fiktif sebelum verifikasi administrasi selesai.

## A. Instruksi kerja untuk IDE / coding agent

Bertindak sebagai senior full-stack engineer dan security reviewer untuk P4I Office, aplikasi administrasi internal Yayasan P4I. Bangun aplikasi **baru dan terpisah** dari P4I Corporate Hub dan P4I WebGIS. Gunakan Next.js App Router + TypeScript + Tailwind CSS, PostgreSQL, autentikasi aman, validasi skema, dan automated testing. Pilih pustaka aktif dan stabil yang kompatibel dengan lingkungan proyek, lalu kunci versinya di lockfile. Kode dan antarmuka dalam bahasa Indonesia.

**Sebelum mengubah berkas**, baca semua lampiran spesifikasi dan analisis implementabilitasnya. Jangan mengklaim aplikasi selesai tanpa bukti lint, typecheck, test, build, dan pengujian keamanan yang berhasil. Jangan melakukan deployment eksternal, mengimpor arsip produksi, atau mengirim surat nyata tanpa persetujuan terpisah.

### 1. Fondasi repositori

- Gunakan repositori **privat** `p4i-office` (buat hanya setelah otorisasi pemilik GitHub jelas). Jangan menyisipkan modul ini ke repositori profil perusahaan atau WebGIS.
- Struktur disarankan: `src/app`, `src/components`, `src/features/auth`, `src/features/letters`, `src/features/templates`, `src/features/numbering`, `src/features/approvals`, `src/features/archive`, `src/lib/db`, `src/lib/security`, `src/lib/documents`, `src/lib/audit`, `db/migrations`, `tests/unit`, `tests/integration`, `tests/e2e`, `docs`.
- Siapkan `.env.example` tanpa kredensial asli, `.gitignore`, README pengembangan lokal, skrip lint/typecheck/test/build, dan pipeline CI.

### 2. Data dan migrasi

- Jadikan skema SQL lama sebagai **referensi**, bukan migrasi produksi final. Audit constraint foreign key lintas organisasi, hak akses database, batasan relasi, indeks dan transaksi.
- Buat migrasi yang dapat diulang di database lokal kosong. Role awal boleh di-seed, tetapi **tanpa** nomor surat resmi, mandat pejabat, surat yang mengaku sudah diterbitkan, atau tanda tangan palsu.
- Konsisten gunakan UUID, waktu tersimpan UTC (`timestamptz`), dan zona `Asia/Jakarta` untuk tanggal bisnis sesuai SOP. Jangan bergantung pada waktu lokal browser untuk nomor resmi.
- Kunci invariant: `normalized_number` unik per organisasi; `(policy_id, period_key, sequence_no)` unik; revisi surat tidak ditimpa.

### 3. Login, hak akses, dan akun

- Akun awal hanya admin/staf yang dibuat secara aman. Akun dinonaktifkan harus kehilangan akses.
- Uji kontrol akses **server-side** pada semua read/write/download. Role teknis admin tidak otomatis menjadi pejabat persetujuan.
- Gunakan autentikasi aman dengan cookie HttpOnly, Secure di produksi, SameSite, proteksi CSRF jika perlu, rate-limit login, rotasi sesi, dan MFA untuk peran sensitif. Pilih solusi autentikasi yang terpelihara dan cocok dengan stack.
- Bagi setiap data organisasi/unit, pastikan pemilik yang diizinkan saja dapat melihat dokumen dan lampirannya.

### 4. Editor surat awal

- Siapkan tampilan Dashboard, Surat Keluar, Buat Surat, Templat, Buku Agenda, Arsip, Persetujuan, Pengguna/Peran, Pengaturan.
- Mulai dengan template **draf nonresmi**. Semua berkas surat dan kop resmi harus dikonfirmasi.
- Formulir surat: jenis, perihal, penerima, tanggal rencana, klasifikasi, isi, lampiran, pemohon, pejabat penandatangan yang dituju; validasi wajib dan sanitasi konten.
- Buat fitur draft, simpan, ubah, daftar revisi, pratinjau, dan pengajuan pemeriksaan. **Draft tidak mendapat nomor resmi.**

### 5. Persetujuan dan penomoran — hanya sandbox

- Implementasikan state machine surat sesuai SRS: `DRAFT → IN_REVIEW → APPROVED → NUMBERED → AWAITING_SIGNATURE → SIGNED → ISSUED → ARCHIVED` dengan cabang `RETURNED`, `REJECTED`/`VOIDED` yang tidak menghapus riwayat. Sesuaikan status `REJECTED` dengan skema sebelum digunakan.
- Audit: fungsi `p4i_allocate_number` dalam referensi **baru memastikan minimal satu approval yang valid**, belum membuktikan seluruh langkah review/approval yang diwajibkan SOP telah terpenuhi. Tambahkan pemeriksaan seluruh langkah, anti-self-approval apabila dipersyaratkan, keabsahan mandat pada waktu keputusan, dan *immutability* hasil final.
- Simulasi dengan **data uji jelas berlabel `TEST`** dan database lokal terpisah; jangan menggunakan prefix nomor surat resmi P4I dalam data demo yang dapat tertukar dengan arsip sesungguhnya.
- Aktivasi nomor nyata **diblokir** sampai register lama direkonsiliasi, counter ditetapkan berdasarkan bukti, dan kebijakan nomor disetujui.

### 6. Unit test dan acceptance gate

Minimal tes:

1. Pengguna nonaktif tidak dapat login; pengguna non-admin tidak bisa mengubah peran.
2. Staf dapat membuat draf tanpa nomor resmi, mengubah isinya sebagai revisi baru.
3. Pengguna tanpa mandat yang valid mendapat `403` saat menyetujui/menandatangani.
4. Draf, revisi yang berubah, dan policy belum aktif tidak dapat menerima nomor.
5. Alokasi nomor dilakukan atomik untuk 100 permintaan paralel dan idempoten untuk retry surat yang sama; zero duplikat.
6. Nomor lama berkonflik tidak bisa dipaksakan ke register terverifikasi.
7. Tautan object storage privat tidak bisa diunduh tanpa autentikasi serta otorisasi yang benar.
8. Audit event tidak bisa diubah oleh role aplikasi biasa.
9. Backup database dan file dapat dipulihkan lewat uji restore; integritas berkas dicek checksum.
10. Semua test, lint, typecheck, build, dan smoke test UI harus lulus sebelum laporan 'selesai'.

## B. Urutan pekerjaan mulai sekarang

| Kode | Hasil kerja | Definisi selesai |
|---|---|---|
| S0-01 | Kumpulkan arsip lama | Register + lokasi berkas pendukung tersedia |
| S0-02 | Validasi format nomor dan seri | SOP/keputusan tertulis disetujui |
| S0-03 | Tetapkan matriks mandat | Pejabat, surat, masa berlaku dan bukti jelas |
| S1-01 | Repo, README, lint, test, CI | Proyek bisa dijalankan lokal |
| S1-02 | Skema/migrasi DB awal | Migrasi lokal bersih dan aman |
| S1-03 | Login, peran, UI dashboard | Tes akses lulus |
| S1-04 | Draft surat & template | CRUD draft dan revisi berjalan |
| S2-01 | Approval dan numbering sandbox | Uji status, mandat, konkurensi lulus |
| S3-01 | Ekspor PDF/DOCX, arsip & audit | UAT dokumen dan kontrol akses lulus |

## C. Laporan akhir setiap fase

Tulis `docs/implementation-report.md` dengan tanggal, perubahan file, keputusan teknis, tes aktual (perintah dan hasil), risiko terbuka, langkah menjalankan proyek, serta item terblokir oleh keputusan administrasi. Jangan menuliskan hasil tes sebagai lulus apabila tes belum dijalankan.

## D. Keputusan yang harus datang dari Pengurus

1. Daftar nomor asli surat 2026 dan tahun-tahun sebelumnya, termasuk surat batal.
2. Pola reset urut: per tahun, per bulan, atau berkelanjutan; serta seri SK terpisah atau tidak.
3. Daftar resmi penandatangan dan kewenangannya berdasarkan AD/ART/SK.
4. Kop, logo, alamat dan identitas resmi yang benar.
5. Metode pengesahan/tanda tangan dan prosedur arsip final.
6. Lokasi penyimpanan privat dan penanggung jawab restore backup.

**Catatan tata kelola:** Persetujuan umum Ketua untuk membuat sistem tidak otomatis berarti persetujuan atas semua aturan nomor dan kewenangan. Dua jenis keputusan tersebut perlu direkam secara khusus.
