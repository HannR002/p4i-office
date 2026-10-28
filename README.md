# P4I Office v1.0 — Sistem Persuratan & Administrasi Internal

Aplikasi web internal Yayasan Pusat Pendidikan dan Penelitian Pembangunan Indonesia (P4I) untuk pengelolaan draf, pemeriksaan, alokasi nomor resmi, dan pengarsipan surat.

> **PENTING (Safety Guard Sprint 1A):**  
> Pada tahap Sprint 1A, sistem **BELUM menerbitkan surat atau nomor resmi**.  
> Seluruh nomor resmi berstatus nonaktif (`FEATURE_NUMBERING_ACTIVE=false`) dan pratinjau surat diberi watermark mencolok **"DRAF — BELUM RESMI"**. Penerbitan nomor resmi diblokir sampai audit register lama dan pengesahan pengurus selesai.

---

## 1. Persyaratan Sistem
- **Node.js**: v20.x atau v22.x (diuji pada v22.14.0)
- **npm**: v10.x+
- **PostgreSQL**: v14+ (untuk integrasi database lokal)

---

## 2. Cara Menjalankan Proyek Secara Lokal

### A. Pasang Dependensi
```bash
npm install
```

### B. Konfigurasi Lingkungan
Salin file template `.env.example` ke `.env`:
```bash
cp .env.example .env
```
*(Pastikan flag `FEATURE_NUMBERING_ACTIVE="false"` tetap terkunci)*

### C. Migrasi Database (Jika PostgreSQL Aktif)
```bash
npm run db:migrate
npm run db:seed:test
```
*Catatan: Jika service PostgreSQL lokal belum aktif, sistem adaptif tetap mengizinkan pengoperasian dan pengetesan lokal melalui repository layer yang aman.*

### D. Menjalankan Server Pengembangan
```bash
npm run dev
```
Akses aplikasi melalui peramban: `http://localhost:3000`

---

## 3. Akun Pengujian Lokal (Test Fixtures)

| Email | Kata Sandi | Peran | Deskripsi |
|---|---|---|---|
| `admin.test@p4i.local` | `Password123!` | `SYSTEM_ADMIN` | Administrator Sistem (Kelola user & config) |
| `staf.test@p4i.local` | `Password123!` | `STAFF` | Staf Administrasi (Buat draf, simpan revisi) |
| `disabled.test@p4i.local` | `Password123!` | `STAFF` | Akun Uji Nonaktif (Login ditolak sistem) |

*Perhatian: Jangan menggunakan akun atau kredensial ini di lingkungan produksi.*

---

## 4. Perintah Pengujian & Verifikasi

```bash
# Typecheck TypeScript (Strict Mode)
npm run typecheck

# Linter ESLint
npm run lint

# Menjalankan Seluruh Unit & Security Tests
npm run test

# Menjalankan Kompilasi Build Produksi
npm run build
```

---

## 5. Dokumentasi Spesifikasi & Laporan
- [Architecture Decisions Record (ADR)](docs/architecture-decisions.md)
- [Sprint 1A Plan & Acceptance Criteria](docs/sprint-1a-plan.md)
- [Decision Log](docs/decision-log.md)
- [Laporan Implementasi Sprint 1A](docs/implementation-report-sprint-1a.md)
