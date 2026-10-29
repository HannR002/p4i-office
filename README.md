# P4I Office v1.0 — Sistem Persuratan & Administrasi Internal
## Sprint 1C: Integrasi Pangkalan Data PostgreSQL Riil, Verifikasi Persistensi & Pengerasan Keamanan

Aplikasi web internal Yayasan Pusat Pendidikan dan Penelitian Pembangunan Indonesia (P4I) untuk pengelolaan draf, pemeriksaan, alokasi nomor resmi, dan pengarsipan surat.

> **PENTING (Safety Guard Sprint 1C):**  
> Pada tahap Sprint 1C, sistem **BELUM menerbitkan surat atau nomor resmi**.  
> Seluruh nomor resmi berstatus nonaktif (`FEATURE_NUMBERING_ACTIVE=false`) dan pratinjau surat diberi watermark mencolok **"DRAF — BELUM RESMI"** serta kop **"DATA BELUM DIVERIFIKASI"**. Penerbitan nomor resmi diblokir sampai audit register arsip lama dan pengesahan pengurus selesai.

---

## 1. Persyaratan Sistem
- **Node.js**: v20.x atau v22.x (diuji pada v22.14.0)
- **npm**: v10.x+
- **PostgreSQL**: v14+ (instans native portabel lokal disediakan via `embedded-postgres` v18.4)

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

### C. Menjalankan Database PostgreSQL Lokal
```bash
# Menjalankan PostgreSQL daemon lokal (port 5432, user: postgres)
npm run db:server
```

### D. Migrasi & Seeding Database
```bash
npm run db:migrate
npm run db:seed:test
```

### E. Backup & Restore Database
```bash
# Melakukan backup database p4i_office_test ke backups/*.json
npm run db:backup

# Merestorasi database ke p4i_office_restore_test dengan verifikasi hash SHA-256
npm run db:restore
```

### F. Menjalankan Server Pengembangan
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
| `disabled.test@p4i.local` | `Password123!` | `STAFF` | Akun Uji Nonaktif (Login & sesi ditolak sistem) |

*Perhatian: Jangan menggunakan akun atau kredensial ini di lingkungan produksi.*

---

## 4. Perintah Pengujian & Verifikasi

```bash
# Typecheck TypeScript (Strict Mode)
npm run typecheck

# Linter ESLint
npm run lint

# Menjalankan Seluruh Automated Tests (13 Test Suites, 42 Tests PASS)
npm run test

# Menjalankan Kompilasi Build Produksi (18 Route Handlers & Pages)
npm run build

# Menjalankan Smoke Test Integrasi
node tests/smoke-test.mjs

# Menjalankan Otomasi Perekam Bukti Visual UI Browser (12 Screenshots)
node scripts/capture-evidence.mjs
```

---

## 5. Dokumentasi Spesifikasi & Laporan
- [Architecture Decisions Record (ADR)](docs/architecture-decisions.md)
- [Sprint 1C Plan & Acceptance Criteria](docs/sprint-1c-plan.md)
- [Decision Log](docs/decision-log.md)
- [Laporan Implementasi & Bukti Teknis Sprint 1C](docs/implementation-evidence-sprint-1c.md)
- [Laporan Implementasi Sprint 1B (Arsip)](docs/implementation-evidence-sprint-1b.md)
- [Laporan Implementasi Sprint 1A (Arsip)](docs/implementation-report-sprint-1a.md)
