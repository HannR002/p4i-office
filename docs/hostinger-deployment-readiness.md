# Kesiapan Deployment Hostinger (Hostinger Deployment Readiness)
## P4I Office v1.0: Panduan Konfigurasi, Keamanan Server & Operasional 24 Jam

**Dokumen:** `docs/hostinger-deployment-readiness.md`  
**Tanggal:** 30 Oktober 2026  
**Pelaksana Teknis:** Gemini Flash 3.8 (Reasoning High) — Lead Software Engineer  
**Tim Perancangan & Arsitek Sistem:** GPT-6 (Software Architect & Penulis Laporan Resmi)  
**Pemilik Keputusan Administratif:** Ketua / Pengurus Yayasan P4I  
**Lingkungan Target:** Hostinger (Business Web Hosting / Cloud / VPS)  

---

### 1. Evaluasi Paket Hosting Hostinger

Sistem persuratan P4I Office membutuhkan operasi stabil 24/7 dengan ketersediaan tinggi. Pemilihan konfigurasi disesuaikan dengan jenis paket Hostinger yang aktif:

| Parameter | Hostinger Business Web / Cloud Hosting | Hostinger VPS (KVM) | Rekomendasi P4I Office |
|---|---|---|---|
| **Control Panel** | hPanel (Managed) | cPanel / CloudPanel / Raw Linux | hPanel untuk kemudahan pengurus; VPS untuk kontrol penuh. |
| **Akses Root** | Tidak Ada (User Space Only) | Penuh (Root SSH) | User Space sudah sangat memadai untuk Laravel 10 + MariaDB. |
| **Basis Data** | MariaDB 10.4–10.11 via MySQL connector | PostgreSQL 14–18 atau MariaDB | **MariaDB InnoDB** (Web/Cloud) / **PostgreSQL** (VPS). |
| **Web Server** | LiteSpeed Enterprise (LSWS) | Nginx / Apache / OpenLiteSpeed | LiteSpeed native pada hPanel sangat cepat menangani PHP. |
| **Cron Job** | hPanel Scheduled Tasks | Crontab Linux murni | Tersedia (interval per 1 menit). |
| **SSL** | Let's Encrypt Lifetime Free SSL | Certbot Let's Encrypt | Aktif otomatis dengan auto-renewal. |

---

### 2. Persyaratan Runtime PHP & Ekstensi

1. **Versi PHP:**
   - Gunakan **PHP 8.2** atau **PHP 8.3** (Dukungan aktif di selector PHP hPanel).
2. **Ekstensi PHP Wajib Aktif:**
   - `pdo_mysql` (Driver koneksi MariaDB/MySQL)
   - `mbstring` (Manipulasi teks UTF-8 & unicode)
   - `openssl` (Enkripsi sesi & hashing token)
   - `tokenizer` (Parsing kode Blade & Livewire)
   - `xml` & `dom` & `libxml` (Manipulasi XML & parsing dokumen)
   - `curl` (Integrasi HTTP service)
   - `zip` (Ekstraksi dan kompresi berkas cadangan)
   - `fileinfo` (Deteksi MIME type dokumen unggahan secara aman)
   - `bcmath` (Kalkulasi presisi tinggi)
   - `ctype` & `json` (Validasi format)
3. **Konfigurasi `php.ini` yang Disarankan (hPanel > PHP Configuration):**
   ```ini
   memory_limit = 256M
   max_execution_time = 60
   upload_max_filesize = 16M
   post_max_size = 20M
   display_errors = Off
   log_errors = On
   error_reporting = E_ALL & ~E_DEPRECATED & ~E_STRICT
   ```

---

### 3. Arsitektur Isolasi Document Root (Pencegahan Kebocoran `.env`)

Kelemahan paling fatal pada instalasi Laravel di shared hosting adalah menempatkan seluruh berkas aplikasi di dalam `public_html`. Pada P4I Office, **hal tersebut mutlak dilarang**.

Struktur penempatan berkas wajib dipisahkan sebagai berikut:

```
/home/u123456789/
├── p4i-office-laravel/               <-- KODE APLIKASI DI LUAR WEB ROOT
│   ├── app/
│   ├── bootstrap/
│   ├── config/
│   ├── database/
│   ├── storage/
│   │   ├── app/
│   │   │   └── private/              <-- DOKUMEN PERSURATAN PRIVAT
│   │   ├── framework/
│   │   └── logs/
│   ├── vendor/
│   ├── .env                          <-- TERLINDUNGI PENUH (Izin chmod 600)
│   ├── artisan
│   └── composer.json
└── public_html/                      <-- HANYA FOLDER EXPOSURE PUBLIK
    ├── index.php                     <-- Diubah agar mengarah ke p4i-office-laravel
    ├── .htaccess                     <-- Aturan rewrite & security headers
    ├── build/                        <-- Aset CSS / JS terkompilasi
    └── favicon.ico
```

#### Modifikasi `public_html/index.php`:
```php
<?php

use Illuminate\Contracts\Http\Kernel;
use Illuminate\Http\Request;

define('LARAVEL_START', microtime(true));

// Mengarah ke folder aplikasi di luar public_html
if (file_exists($maintenance = __DIR__.'/../p4i-office-laravel/storage/framework/maintenance.php')) {
    require $maintenance;
}

require __DIR__.'/../p4i-office-laravel/vendor/autoload.php';

$app = require_once __DIR__.'/../p4i-office-laravel/bootstrap/app.php';

$kernel = $app->make(Kernel::class);

$response = $kernel->handle(
    $request = Request::capture()
)->send();

$kernel->terminate($request, $response);
```

Dengan konfigurasi ini, berkas `.env`, berkas log, migrasi SQL, dan kode sumber PHP **secara fisik tidak berada di document root**, sehingga tidak dapat diakses atau diunduh dari internet melalui celah miskonfigurasi web server.

---

### 4. Penegakan SSL / HTTPS & Header Keamanan (`.htaccess`)

Berkas `public_html/.htaccess` dikonfigurasi dengan standar pertahanan berlapis:

```apache
<IfModule mod_rewrite.c>
    <IfModule mod_negotiation.c>
        Options -MultiViews -Indexes
    </IfModule>

    RewriteEngine On

    # 1. Paksa Penggunaan HTTPS
    RewriteCond %{HTTPS} off
    RewriteRule ^(.*)$ https://%{HTTP_HOST}%{REQUEST_URI} [L,R=301]

    # 2. Blokir Akses ke Berkas Sensitif
    RewriteRule ^(\.env|\.git|composer\.(json|lock)|package\.(json|lock)|artisan) - [F,L,NC]

    # 3. Handle Authorization Header
    RewriteCond %{HTTP:Authorization} .
    RewriteRule .* - [E=HTTP_AUTHORIZATION:%{HTTP:Authorization}]

    # 4. Redirect Trailing Slashes
    RewriteCond %{REQUEST_FILENAME} !-d
    RewriteCond %{REQUEST_URI} (.+)/$
    RewriteRule ^ %1 [L,R=301]

    # 5. Route ke Front Controller (index.php)
    RewriteCond %{REQUEST_FILENAME} !-d
    RewriteCond %{REQUEST_FILENAME} !-f
    RewriteRule ^ index.php [L]
</IfModule>

# Header Keamanan Tingkat Lanjut
<IfModule mod_headers.c>
    Header always set X-Frame-Options "SAMEORIGIN"
    Header always set X-Content-Type-Options "nosniff"
    Header always set X-XSS-Protection "1; mode=block"
    Header always set Referrer-Policy "strict-origin-when-cross-origin"
    Header always set Permissions-Policy "camera=(), microphone=(), geolocation=()"
</IfModule>
```

---

### 5. Penjadwalan Tugas (Cron Jobs) di Hostinger

Shared hosting tidak mendukung proses background daemon jangka panjang (*long-running workers*) seperti Supervisor. Oleh karena itu, seluruh pemeliharaan otomatis dikendalikan oleh **Hostinger Scheduled Tasks (Cron Jobs)**:

1. Buka menu **Advanced > Cron Jobs** di hPanel.
2. Tambahkan satu baris cron yang berjalan setiap menit (`* * * * *`):
   ```bash
   /usr/bin/php /home/u123456789/p4i-office-laravel/artisan schedule:run >> /dev/null 2>&1
   ```
3. Di dalam `app/Console/Kernel.php`, jadwalkan:
   - Pencadangan harian basis data: `$schedule->command('backup:run --only-db')->dailyAt('02:00');`
   - Pembersihan sesi kadaluwarsa: `$schedule->command('auth:clear-resets')->daily();`
   - Pemrosesan antrean batch (jika menggunakan queue database): `$schedule->command('queue:work --stop-when-empty --max-time=50')->everyMinute();`

---

### 6. Prosedur Pencadangan (Backup) & Pemulihan (Restore)

#### 6.1 Prosedur Backup Otomatis
1. **Hostinger Daily Snapshots:** Hostinger menyediakan automatic daily backup melalui menu *Files > Backups* di hPanel.
2. **Skrip Ekspor MariaDB Mandiri (CLI / Cron):**
   ```bash
   mysqldump -u u123456789_p4i -p'PASSWORD_DB' u123456789_p4ioffice --single-transaction --quick --routines --triggers > /home/u123456789/backups/p4i_office_$(date +\%F_\%H\%M).sql
   ```
   Flag `--single-transaction` menjamin konsistensi ACID tabel InnoDB tanpa mengunci pembacaan data.

#### 6.2 Prosedur Pemulihan (Disaster Recovery)
```bash
mysql -u u123456789_p4i -p'PASSWORD_DB' u123456789_p4ioffice < /home/u123456789/backups/backup_restore.sql
php artisan optimize:clear
php artisan config:cache
```

---

### 7. Pengelolaan Environment Secret & Izin Berkas

1. Berkas `.env` diisi konfigurasi kredensial produksi Hostinger (DB_HOST = `localhost`, DB_DATABASE, DB_USERNAME, DB_PASSWORD).
2. Terapkan izin berkas ketat via terminal SSH:
   ```bash
   chmod 600 /home/u123456789/p4i-office-laravel/.env
   chmod -R 775 /home/u123456789/p4i-office-laravel/storage
   chmod -R 775 /home/u123456789/p4i-office-laravel/bootstrap/cache
   ```
3. Pastikan `APP_DEBUG=false` pada berkas `.env` produksi agar pesan kesalahan teknis (stack trace) tidak bocor ke publik saat terjadi kegagalan server.

---

### 8. Prosedur Deployment Bebas Gangguan (Zero-Downtime Deployment)

Saat memperbarui kode ke Hostinger via Git/SSH:

```bash
# 1. Masuk ke direktori aplikasi
cd /home/u123456789/p4i-office-laravel

# 2. Tarik commit terbaru
git pull origin main

# 3. Instal dependensi produksi (tanpa dev tools)
composer install --no-dev --prefer-dist --optimize-autoloader --no-interaction

# 4. Jalankan migrasi skema (jika ada)
php artisan migrate --force

# 5. Bersihkan dan optimalkan cache
php artisan optimize:clear
php artisan config:cache
php artisan route:cache
php artisan view:cache
```

**Larangan Operasional:**  
Pelaksana teknis dilarang mengakses kredensial produksi, mengunggah kode, ataupun menjalankan migrasi pada server hosting publik tanpa persetujuan dan mandat resmi tertulis dari Pengurus Yayasan P4I.

