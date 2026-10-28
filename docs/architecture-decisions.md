# Architecture Decisions Record (ADR) — P4I Office v1.0
## Sprint 1A: Bootstrap, Security Foundation & Surat Draft
**Tanggal:** 28 Oktober 2026  
**Status:** DRAFT Disetujui untuk Sprint 1A  
**Pelaksana:** Gemini Flash 3.8 (reasoning high) di IDE  
**Reviewer:** GPT  

---

### 1. Konteks dan Lingkup Proyek
P4I Office adalah sistem persuratan dan administrasi internal mandiri untuk Yayasan Pusat Pendidikan dan Penelitian Pembangunan Indonesia (P4I). Sistem ini dikembangkan sebagai repositori dan pangkalan data baru yang terisolasi penuh dari:
1. `p4i-corporate-hub` (Company Profile & Portal Publik)
2. `p4i-webgis` (Geographic Information System)

Sprint 1A berfokus secara ketat pada:
- Fondasi keamanan dan otentikasi server-side
- RBAC (`SYSTEM_ADMIN` vs `STAFF`)
- Manajemen Draf Surat (`DRAFT`, `IN_REVIEW`), penyimpanan revisi yang tidak menimpa (*append-only/immutable versioning*), serta pratinjau berlabel nonresmi (**DRAF — BELUM RESMI**)
- Skema database terverifikasi versi 1 untuk tabel inti
- Pencegahan mutlak penerbitan nomor surat resmi, tanda tangan, atau data produksi sebelum rekonsiliasi arsip masa lalu dan persetujuan pengurus yang sah.

---

### 2. Pilihan Teknologi dan Keputusan Arsitektur

#### 2.1 Framework & Runtime
- **Next.js 15 (App Router) + React 19 + TypeScript (Strict Mode)**
  - *Alasan:* Mendukung Server Components, Server Actions, Route Handlers dengan evaluasi keamanan *server-side* murni (tidak ada otorisasi yang diserahkan ke client-side state).
  - *Lockfile:* Mengunci seluruh dependensi pada `package-lock.json` untuk determinisme build.

#### 2.2 Styling & Antarmuka Pengguna
- **Tailwind CSS + Lucide Icons**
  - *Alasan:* Ringan, standar industri, kemudahan kustomisasi token warna corporate profesional, mendukung status visual (badge status, watermark draft, banner belum terverifikasi).
  - *Bahasa UI:* Bahasa Indonesia resmi (baku) sesuai standar persuratan P4I.

#### 2.3 Basis Data & ORM
- **PostgreSQL + Drizzle ORM / Node-Postgres (`pg`) + Migrasi SQL Terversi**
  - *Alasan:* PostgreSQL mendukung UUID native, `timestamptz`, JSONB, dan transaksi ACID kuat. Drizzle ORM memberikan skema bertipe data TypeScript penuh, query builder transparan tanpa runtime overhead besar, dan migrasi SQL terversi (`db/migrations/`).
  - *Manajemen Waktu:* Seluruh timestamp disimpan dalam format UTC (`timestamptz`), dan diformat dalam zona waktu `Asia/Jakarta` (WIB) pada antarmuka bisnis.
  - *Penanganan Port DB Lokal:* Pada lingkungan pengembangan di mana PostgreSQL service lokal belum aktif, skrip migrasi dan uji integrasi DB disiapkan dengan fail-safe: menandai status uji integrasi DB sebagai **BLOCKED** secara eksplisit (tidak mengarang status PASS).

#### 2.4 Otentikasi & Keamanan Sesi
- **Kombinasi Cookie HttpOnly + Enkripsi Sesi (Iron-Session/JOSE JWT) + bcryptjs**
  - *Alasan:* Mencegah pencurian token via XSS (token tidak disimpan di `localStorage`). Menggunakan flag `SameSite=Lax`, `HttpOnly=true`, dan `Secure` pada produksi.
  - *Password Hashing:* `bcryptjs` (salt rounds = 10) untuk portabilitas lintas OS tanpa dependensi kompilasi biner C++.
  - *Rate Limiting:* Middleware rate limiter berbasis memory/token bucket per IP dan identitas login untuk mitigasi *brute-force attacks*.
  - *Penolakan Akun Nonaktif:* Akun dengan status `status !== 'ACTIVE'` (misal `DISABLED` atau `INVITED`) langsung ditolak pada level server saat login maupun verifikasi sesi.
  - *Status MFA:* **GAP TERDOKUMENTASI**. Dukungan MFA belum diaktifkan pada Sprint 1A, dan dicatat sebagai blocker untuk akses admin production sebelum Sprint 2.

#### 2.5 Pemisahan Peran Teknis vs Otorisasi Legal (RBAC vs Mandat)
- **Prinsip Least Privilege:**
  - `SYSTEM_ADMIN`: Mengelola pengguna, unit, konfigurasi sistem. **Dilarang keras menyetujui (approve), mengesahkan, atau menandatangani surat.**
  - `STAFF`: Membuat draft surat, mengedit revisi baru, melihat template, mengajukan pemeriksaan.
  - Hak persetujuan dan penandatanganan nantinya mewajibkan `signatory_mandates` yang sah dan masih berlaku, bukan peran teknis IT.

#### 2.6 Penguncian Fitur Penomoran (Zero Fictional Numbering)
- **Flag Penomoran:** `FEATURE_NUMBERING_ACTIVE = false`
- **Tabel `numbering_policies`:** Default `is_active = false`, `legacy_reconciled = false`.
- **Aturan:** Dilarang menghasilkan nomor surat resmi, dilarang men-seed nomor palsu atau contoh `001/P4I/X/2026` sebagai arsip resmi. Seluruh fixture uji wajib berlabel awalan `TEST-`.

#### 2.7 Integritas Draf & Immutability Revisi
- Draf surat disimpan pada tabel `letters` dengan status `DRAFT`.
- Setiap perubahan data surat menghasilkan baris baru di `letter_revisions` dengan nomor versi menaik (`version = current_version + 1`).
- Konten disimpan dalam bentuk JSON terstruktur dan dihitung `content_sha256` untuk membuktikan bahwa versi historis tidak pernah diubah secara diam-diam.
- Pratinjau draf wajib menyematkan label/watermark visual **"DRAF — BELUM RESMI"**.

---

### 3. Batasan Produksi (Production Blockers)
1. **Keputusan Pengurus Terbuka:** D-01 s.d. D-07 pada `P4I_Office_Paket_Sprint0.xlsx` belum disahkan.
2. **Ketiadaan Mandat Pejabat:** Tidak ada pejabat penandatangan yang boleh di-seed dalam data produksi.
3. **Ketiadaan Register Lama:** Register surat historis belum direkonsiliasi.
4. **MFA:** Wajib diselesaikan sebelum deployment produksi.
