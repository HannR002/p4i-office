# MASTER PROMPT — P4I OFFICE v1.0
## ONE-SHOT STAGING DEPLOYMENT + ZERO-FABRICATION VERIFICATION

**Untuk:** Argon — Reasoning High di Antigravity IDE  
**Tugas:** Selesaikan deployment P4I Office ke staging Hostinger dalam SATU sesi eksekusi terpadu, bukan sprint perencanaan baru.  
**Repo lokal:** `D:\p4i-office-laravel`  
**Website tujuan:** `staging-office.p4ijournal.org`  
**DB khusus:** `u239415845_p4i_staging`  
**SSH:** `u239415845@153.92.8.139`, port `65002`  
**Rancangan deployment:** core Laravel di `/home/u239415845/p4i-office-staging/`; front controller dan public assets di `/home/u239415845/domains/staging-office.p4ijournal.org/public_html/`.

## 0. Mandat dan batas keras
Pemilik meminta eksekusi menyeluruh **khusus staging**. Dengan pemilik menjalankan prompt ini di IDE, otorisasi kerja staging mencakup verifikasi SSH, unggah kode, pembuatan `.env` staging, instalasi dependency, migrasi dan trigger DB staging, seeder sintetis, pengaturan cron staging dan pengujian fungsional. **Jangan meminta persetujuan ulang per langkah** yang tercakup. Jika tool memerlukan tindakan manusia untuk autentikasi, minta **satu intervensi spesifik** dan lanjutkan setelah berhasil; jangan berputar membuat laporan persiapan.

**TIDAK DIIZINKAN:** perubahan DNS atau website utama `p4ijournal.org`, `journal.p4ijournal.org`, `publisher.p4ijournal.org`, website addon lain, DB `u239415845_ojs`, `u239415845_publisher`, `u239415845_publisher_new`, produksi resmi, real email/WhatsApp, nomor surat resmi, data real yayasan, biaya/upgrade, force-push, menghapus file di luar staging, atau menurunkan proteksi keamanan untuk mengejar PASS. Hak SSH shared-hosting adalah hak akun luas: audit setiap path absolut sebelum mutasi. Jika perlu pekerjaan di luar ruang lingkup, STOP.

Ini adalah **otorisasi staging**, bukan izin pengesahan surat atau go-live produksi. `official_numbering_active = false`; semua `letters.official_number` harus NULL; PDF/DOCX wajib `DRAF — BELUM RESMI`. UAT manual pengurus tidak boleh diklaim sudah dilakukan.

## 1. Selesaikan SSH TERLEBIH DAHULU
1. Dari screenshot hPanel: status SSH ACTIVE, IP `153.92.8.139`, port `65002`, user `u239415845`. Website terpilih pada screenshot adalah `slategray-cod-828424.hostingersite.com`, bukan staging; **verifikasi bahwa keduanya berada di hosting account yang sama** sebelum melakukan mutasi.
2. Audit `ssh -V`, `Test-NetConnection 153.92.8.139 -Port 65002` dan metode autentikasi. **Host fingerprint ED25519/ECDSA/RSA dari hPanel adalah identitas SERVER, bukan public key login milik pengguna**. Verifikasi fingerprint yang ditampilkan oleh SSH client dengan hPanel; jangan menonaktifkan `StrictHostKeyChecking`.
3. Jika password-based SSH tidak berhasil dari IDE non-interaktif, buat key ED25519 khusus P4I staging melalui `ssh-keygen` pada perangkat Windows. **Hanya public key `.pub` yang boleh dipasang ke hPanel** (gunakan fitur yang benar-benar tersedia atau minta pemilik menempelkannya satu kali). Private key jangan ditampilkan, diunggah ke AI, di-commit, atau dimasukkan laporan.
4. Uji koneksi: `ssh -i <PATH_PRIVATE_KEY_LOKAL> -o IdentitiesOnly=yes -p 65002 u239415845@153.92.8.139 'pwd; whoami; /opt/alt/php83/usr/bin/php -v'` (gunakan sintaks client Windows yang tepat). Catat exit code dan stdout sanitasi. Jika gagal, bedakan timeout/jaringan, host verification, publickey dan password. **Jangan mengaku telah SSH jika belum ada perintah remote exit 0.**
5. Jika akses SSH belum bisa diselesaikan tanpa private key/password yang hanya diketahui pemilik, **hentikan tepat di titik ini** dan minta satu tindakan pengguna yang spesifik. Jangan mengulang test suite lokal atau menulis status deployed.

## 2. Preflight server dan baseline
1. Verifikasi branch HEAD, `git status --porcelain`, SHA commit, `php artisan test`, `vendor/bin/pint --test`, `npm run build` dan hasil exit code. Jangan mengulang seluruh suite jika bukti terbaru dari SHA yang sama sudah valid, kecuali kode berubah.
2. Setelah SSH berhasil, lakukan perintah **baca-saja** untuk `pwd`, `id`, `php -v`, `php -m`, `command -v composer`, `df -h`, `ls -ld` target staging dan web root, `crontab -l` bila tersedia. Pastikan target `public_html` hanya website staging; jangan sentuh document root lain.
3. Gunakan `composer check-platform-reqs` (setelah dependency tersedia) dan cocokkan dengan `composer.lock`. Jalankan Composer melalui executable yang valid; jangan mengasumsikan `php composer` merupakan path yang valid. PHP web dan CLI harus kompatibel dengan Laravel 13 (>=8.3).
4. Pastikan koneksi hanya ke DB `u239415845_p4i_staging`, database kosong/berisi data staging yang diketahui, dan tidak ada migrasi target lain. Inventaris sebelum perubahan, backup keadaan staging yang ada dan simpan manifest.
5. Rekam baseline URL staging dengan HTTP request nyata sebelum pemasangan.

## 3. Rilis aman ke split-directory
1. Bangun release tarball SOURCE bersih dari commit terverifikasi, **tanpa** `.env`, private key, dump data nyata, `.git`, token, node_modules, dan evidence rahasia. Catat SHA-256 lokal, ukuran, isi manifest dan commit. Gunakan SFTP/SCP/SSH setelah autentikasi valid; jangan jatuh ke upload seluruh Laravel ke `public_html`.
2. Extract core ke `/home/u239415845/p4i-office-staging/` dengan path validation; transfer hanya isi Laravel `public/` yang wajib ke `/home/u239415845/domains/staging-office.p4ijournal.org/public_html/`. Backup/arsipkan `default.php` staging sebelum perubahan. Jangan menghapus atau mengganti file pada website lain.
3. Modifikasi entrypoint `public_html/index.php` dari template asli `public/index.php` pada Laravel 13 dengan path yang benar ke `vendor/autoload.php` dan `bootstrap/app.php` di core privat. Atur public path aplikasi bila diperlukan, uji resolusi aset Vite dan upload/storage. Jangan menautkan private archive ke public storage. Periksa `realpath` dan tidak ada symlink ke direktori website lain.
4. Pasang dependency berdasarkan `composer.lock` (`composer install --no-dev --prefer-dist --optimize-autoloader --no-interaction`, mengikuti hasil inspeksi binary Composer/PHP). Jangan menjalankan `composer update` yang diam-diam mengubah versi.
5. Buat `.env` hanya di core privat dengan permission seketat yang didukung, `APP_ENV=staging`, `APP_DEBUG=false`, `APP_URL=https://staging-office.p4ijournal.org`, `OFFICIAL_NUMBERING_ACTIVE=false`, `MAIL_MAILER=log` atau sink yang mencegah email sungguhan, `QUEUE_CONNECTION=sync` jika cocok dengan arsitektur, session/cookie secure, kredensial hanya untuk DB staging. **Jangan cetak nilai secret**. Jangan mengklaim `MAIL_MAILER=log` mencegah semua outbound channel kecuali semua integrasi lain juga dimatikan.
6. Buat `APP_KEY` unik hanya jika belum ada. Jangan rotasi key setiap deployment. Validasi konfigurasi `config('features.official_numbering_active') === false` terutama setelah `config:cache`, bukan `env()` dari service pada runtime. Periksa trusted proxy/HTTPS serta session cookie domain agar tidak berbagi sesi dengan OJS/Publisher.
7. Jalankan `php artisan migrate:status`; lalu `php artisan migrate --force` **hanya jika koneksi DB staging telah dibuktikan**. Verifikasi jumlah tabel sesuai skema/migrations yang sebenarnya, bukan angka naratif. Verifikasi empat trigger melalui `information_schema.TRIGGERS` dan tes mutasi yang di-rollback pada tabel uji, bukan merusak data immutable yang sah. Jika CREATE TRIGGER ditolak, STOP, jangan menghilangkan trigger.
8. Jalankan **hanya** seeder UAT sintetis yang benar-benar tersedia. Jika kelas tidak ada, perbaiki di repo + tes + rilis ulang sebelum melanjutkan; jangan seeding data produksi. Password akun uji unik dan aman; jangan kirim melalui chat/commit.
9. Jalankan cache/optimization setelah konfigurasi valid, verifikasi routes dan health. Periksa file permission seperlunya saja; hindari `chmod -R 777`.
10. Daftarkan hanya satu cron scheduler staging menggunakan PHP CLI/path absolut yang telah diverifikasi. Pertama log eksekusinya ke lokasi privat, bukan `>/dev/null` sebelum proof. Uji `schedule:run` dan hasil `p4i:reconcile-exports` berdasarkan audit log/timestamp nyata. Pastikan tidak mengubah cron produksi.

## 4. GO/NO-GO pengujian live
Pengujian WAJIB berasal dari server staging yang sebenarnya, bukan PHPUnit lokal saja:

- **HTTP/TLS:** `https://staging-office.p4ijournal.org` valid; redirect dan sertifikat benar; login/dashboard berjalan; request tidak melempar 500; response assets build valid (bukan 404).
- **Eksposur:** `.env`, `.git/config`, `composer.json`, `vendor/`, `storage/app/private/archives`, backup SQL dan logs tidak bisa diunduh via HTTP (403/404). Endpoint privat hanya lewat controller yang memeriksa RBAC/tenant dan checksum.
- **DB:** nama database staging terkonfirmasi dari koneksi runtime (tanpa mencetak password); seluruh migrations dan 4 trigger bekerja; foreign key/rollback berfungsi.
- **Alur:** login/logout, staf membuat draf v1, revisi v2, submit, reviewer simulasi claim, return revision, re-submit, approved-substance, export PDF & DOCX, archive search, agenda masuk/keluar.
- **Keamanan:** user tanpa mandat tidak bisa lihat/edit/download `RAHASIA` (403); anonymous diarahkan ke login; cross-tenant ditolak; CSRF/throttle; file traversal ditolak.
- **Invarian:** `official_numbering_active=false`, semua `official_number IS NULL`, tidak ada surat ISSUED, alokasi nomor resmi melempar blocked exception; watermark DRAF di PDF semua halaman dan label DOCX.
- **Binary:** benar-benar UNDUH PDF dan DOCX melalui HTTP terautentikasi, periksa MIME, signature, ukuran, SHA-256 terhadap metadata serta PDF multipage dan OOXML; jangan hanya screenshot link.
- **Cron:** bukti run waktu sebenarnya dari server dan log event; mutex tanpa overlap; bukti jika cron tidak tersedia status BLOCKED.
- **Backup:** ambil salinan DB staging + private archive beserta checksum. **Jangan restore dengan menimpa staging yang sedang berjalan**. Restore drill pada lingkungan uji yang terisolasi jika diizinkan; bila tidak tersedia tandai NOT RUN/BLOCKED, jangan klaim RPO 0 atau RTO terukur tanpa tes.
- **UAT manusia:** status tetap `NOT RUN` hingga staf/pengurus benar-benar melakukan dan menandatangani UAT; jangan menggantikannya dengan automated tests.

Bila gagal pada gate kritis, lakukan rollback STAGING saja dari snapshot/backup yang sudah divalidasi; jika rollback berisiko atau tidak dapat dibuktikan, STOP dan jelaskan. **Jangan pernah mengubah produksi.**

## 5. AUDIT ANTI-HALUSINASI (WAJIB DAN PALING PENTING)
Buat `docs/p1c-one-shot-evidence.md` dan `docs/p1c-final-verification.json` dari bukti otomasi nyata. **Tidak boleh menyebut PASS tanpa perintah yang benar-benar dijalankan dan hasil yang tersimpan.**

Untuk setiap klaim penting wajib ada:
1. Nomor gate, target sumber daya, timestamp, perintah/API operation yang benar-benar dijalankan (perintah dengan secret disensor), exit code atau HTTP status, bukti output asli yang sudah disanitasi, hash/ID artefak, dan status PASS/FAIL/BLOCKED/NOT RUN.
2. Minimal dua lapis verifikasi: (a) SSH/DB pada server Hostinger, (b) HTTP melalui client terpisah. Untuk DNS dan SSL, verifikasi respons aktual, bukan hanya hPanel metadata.
3. Audit file manifest: SHA-256 tarball lokal vs server, hash file entrypoint, asset manifest, PHP version, Laravel version, git commit yang dideploy, DB name, migration list, 4 triggers, cron list khusus staging, disk path dan file private. Jangan cetak `.env`, password, APP_KEY, tokens, SSH private key atau file surat asli.
4. Jalankan ulang pemeriksaan pada sesi SSH BARU setelah deployment, bukan mengandalkan hasil dari proses yang sama. Bandingkan inventory dengan keadaan sebelum deployment untuk memastikan tidak ada file/dns/database/cron produksi yang berubah.
5. Verifikasi HTTP pada URL staging yang benar dan sertakan screenshot autentik dari halaman login dan dashboard jika tersedia. Screenshot saja tidak membuktikan backend; harus dilengkapi respons HTTP dan pemeriksaan DB.
6. Jangan membuat log `PASS` sintetis, test dummy hanya untuk menaikkan angka, screenshot rekayasa, commit/release SHA fiktif atau URL palsu. Jika alat tidak tersedia, nyatakan status `NOT VERIFIED`/`BLOCKED`.
7. Tidak boleh menyatakan `STAGING DEPLOYED` hanya karena domain hidup; harus ada Laravel merespons, login berhasil, DB/migration/trigger terbukti, security tidak bocor, PDF/DOCX berfungsi, dan cron diverifikasi atau blocker dijelaskan.
8. Validasi jumlah tes dari stdout terbaru dan exit code. Hindari skor kesiapan 100% bila UAT manusia belum berjalan.

**Laporan akhir ringkas wajib memuat** URL staging, commit deployed, waktu, status SSH, daftar perubahan pada staging, matriks PASS/FAIL, blocker, bukti server & HTTP, serta pernyataan eksplisit bahwa OJS/Publisher tidak disentuh. Status final hanya salah satu:
- `STAGING DEPLOYED — TECHNICAL VERIFICATION PASSED — MANUAL UAT PENDING`
- `STAGING PARTIALLY DEPLOYED — BLOCKERS REMAIN`
- `STAGING DEPLOYMENT BLOCKED — NO SERVER CHANGES`

**Kerjakan langsung end-to-end. Jangan berhenti pada pembuatan dokumen rencana, jangan membuat sprint baru, jangan minta otorisasi berulang untuk operasi staging yang dicakup prompt ini.** Hanya minta pengguna bertindak jika autentikasi SSH membutuhkan pendaftaran public key atau rahasia lokal yang tidak boleh diakses agen, atau jika ada operasi di luar batas izin. Setelah itu lanjutkan dari checkpoint yang sama dan lakukan audit akhir.
