# Sprint 2 Execution Plan & Acceptance Criteria
## P4I Office v1.0 — Letter Approval Workflow & Authority Management
**Dokumen:** `docs/sprint-2-plan.md`  
**Sasaran Evaluasi:** Tim Reviewer GPT-6 & Pengurus Yayasan P4I  
**Pelaksana Teknis:** Gemini Flash 3.8 (Reasoning High) di Antigravity IDE  
**Branch Kerja:** `feat/sprint-2-approval-workflow`  
**Baseline Commit (Sprint 1C):** `cae19a0890bf62d667c4be517179040fa7a1a457`  
**Target:** Membangun alur persetujuan surat dinas internal (*internal approval workflow*), manajemen mandat kewenangan (*signatory & reviewer mandates*), pencatatan riwayat keputusan terikat hash revisi (*hash-binding decision*), penegakan aturan anti self-approval, antrean pemeriksaan reviewer, audit trail transisi status, serta pemenuhan Acceptance Criteria AP-01 sampai AP-14 tanpa mengaktifkan penomoran resmi.

---

### 1. Tata Kelola dan Pembagian Peran
Sesuai arahan Master Prompt Sprint 2:
- **GPT-6:** Tim Perancangan Sistem, Software Architect, System Analyst, penyusun dokumen SRS, reviewer dan auditor independen, pengendali kualitas, serta penyusun seluruh laporan resmi proyek.
- **Gemini IDE:** Pelaksana implementasi kode, database migration, automated testing, perbaikan bug, dan pencatat bukti teknis faktual.
- **Pengurus/Ketua P4I:** Pemegang kewenangan administratif tunggal untuk SOP, mandat pejabat, format penomoran resmi, dan pengesahan surat resmi.

> **SAFETY GUARDS MUTLAK (Sprint 2):**
> 1. **Penomoran Resmi Tetap Nonaktif:** `FEATURE_NUMBERING_ACTIVE = false`, `officialNumber = null`. Tidak ada endpoint, tombol, atau generator nomor surat resmi.
> 2. **Tanpa Nomor dan Pejabat Fiktif:** Tidak ada penetapan nomor registrasi historis fiktif dan tidak ada penetapan pejabat resmi secara otomatis tanpa SK pengurus.
> 3. **Pratinjau Draf Terproteksi:** Seluruh tampilan pratinjau surat tetap menyematkan watermark visual **"DRAF — BELUM RESMI"** dan kop **"DATA BELUM DIVERIFIKASI"**. Status `APPROVED` berarti isi draf telah disetujui alur internal, **bukan** surat telah diterbitkan secara resmi.
> 4. **Batas Ruang Lingkup:** Berhenti di akhir Sprint 2, tidak memulai Sprint 3 atau melakukan deployment/push remote tanpa izin.

---

### 2. State Machine Alur Persetujuan Surat

Alur status surat (*Business Workflow State Machine*):
```
[DRAFT] ───(Ajukan Pemeriksaan)───► [SUBMITTED] ───(Diambil Reviewer)───► [IN_REVIEW]
                                                                              │
                                 ┌────────────────────────────────────────────┼──────────────────────────┐
                                 ▼                                            ▼                          ▼
                          [APPROVED]                                 [CHANGES_REQUESTED]             [REJECTED]
                                                                              │                          (Final Ditolak)
                                                                              ▼
                                                                  [DRAFT / Revisi Ulang]
                                                                              │
                                                                              └──► (Ajukan Ulang) ──► [SUBMITTED]
```

**Aturan Transisi & Validasi:**
1. **Pengikatan Keputusan (*Hash Binding*):** Setiap persetujuan atau penolakan mengikat `letter_id`, `revision_id`, `content_sha256`, `reviewer_id`, `mandate_id`, dan `decided_at`.
2. **Anti-Stale Approval:** Jika staf mengubah isi draf setelah diajukan (melahirkan revisi baru), approval request lama berstatus `SUPERSEDED` dan reviewer tidak dapat menyetujui versi lama.
3. **No Self-Approval:** Pembuat draf (`author_id` / `submitted_by`) dilarang menyetujui drafnya sendiri (`reviewer_id !== author_id`).
4. **Mandate Validity Check:** Reviewer wajib memiliki mandat aktif pada organisasi, jenis surat, dan tanggal keputusan (`valid_from <= CURRENT_DATE <= valid_to`, status `ACTIVE`).
5. **Alasan Wajib untuk Penolakan / Permintaan Revisi:** Aksi `REJECTED` dan `CHANGES_REQUESTED` wajib menyertakan catatan/komentar (minimal 5 karakter).

---

### 3. Rencana Kerja Detail (Checklist Eksekusi)

- [ ] **Tahap 1: Audit dan Baseline Repositori**
  - [x] Verifikasi branch `feat/sprint-1c-real-db-verification` dan commit `cae19a0`.
  - [x] Buat branch kerja `feat/sprint-2-approval-workflow`.
  - [x] Audit SRS, skema database eksisting (migrasi 0001 dan 0002).
  - [x] Susun dokumen `docs/sprint-2-plan.md`.

- [ ] **Tahap 2: Skema Basis Data & Migrasi 0003**
  - [ ] Rancang dan buat berkas migrasi `db/migrations/0003_sprint2_approval_workflow.sql`:
    - Tabel `signatory_mandates`: mandat kewenangan legal per jenis surat, rentang tanggal, status.
    - Tabel `approval_requests`: pencatatan pengajuan draf terikat `revision_id` dan hash.
    - Tabel `approval_steps`: pencatatan keputusan reviewer terikat `mandate_id` dan hash.
    - Tabel `letter_status_history`: jejak audit seluruh transisi status surat.
    - Pembaruan check constraint status pada tabel `letters` untuk mendukung `SUBMITTED`, `CHANGES_REQUESTED`, `REJECTED`.
  - [ ] Buat berkas rollback `db/migrations/0003_sprint2_approval_workflow.rollback.sql`.
  - [ ] Jalankan migrasi up dan verifikasi idempotency re-run pada PostgreSQL riil.

- [ ] **Tahap 3: Pembaruan Data Uji (Seeding) & Backup/Restore**
  - [ ] Perbarui `scripts/seed-test.mjs`:
    - Tambah akun reviewer: `reviewer.test@p4i.local` (Password: `Password123!`).
    - Tambah akun staf kedua: `staf2.test@p4i.local` (Password: `Password123!`).
    - Tambah akun tanpa mandat: `unauthorized.test@p4i.local` (Password: `Password123!`).
    - Seed mandat aktif simulasi untuk reviewer (`can_approve = true` untuk jenis surat P0).
    - Seed mandat kedaluwarsa (`valid_to` masa lalu) dan mandat dicabut (`status = 'REVOKED'`).
  - [ ] Perbarui `scripts/backup-db.mjs` dan `scripts/restore-db.mjs` untuk menyertakan 4 tabel baru.

- [ ] **Tahap 4: Domain Layer & Repository (PostgreSQL & Simulation)**
  - [ ] Perbarui `src/lib/db/types.ts` dengan antarmuka mandat, approval requests, steps, dan history.
  - [ ] Implementasikan fungsi domain di `src/lib/db/postgres-repository.ts`:
    - `submitForApproval(letterId, submitter, notes)`
    - `getPendingApprovals(reviewer, orgId)`
    - `getApprovalRequest(requestId, user)`
    - `decideApproval(requestId, reviewer, decision, comments, mandateId)`
    - `getLetterHistory(letterId, user)`
    - `getSignatoryMandates(orgId, userId)`
    - `createSignatoryMandate(data, actor)`
    - `updateSignatoryMandate(mandateId, data, actor)`
  - [ ] Implementasikan kontrak yang sama pada `src/lib/db/memory-repository.ts` untuk pengujian simulasi terisolasi.
  - [ ] Terapkan penguncian baris `SELECT FOR UPDATE` pada transaksi persetujuan guna mencegah dual approval konkuren.

- [ ] **Tahap 5: Backend API Routes & Security Guards**
  - [ ] `POST /api/letters/[id]/submit`: Pengajuan surat ke antrean reviewer.
  - [ ] `GET /api/approvals/pending`: Antrean surat masuk reviewer sesuai mandat aktif.
  - [ ] `GET /api/approvals/[id]`: Rincian pengajuan dan pembanding hash revisi.
  - [ ] `POST /api/approvals/[id]/decision`: Pemberian keputusan (APPROVE / CHANGES_REQUESTED / REJECT).
  - [ ] `GET /api/letters/[id]/history`: Riwayat lengkap alur status dan catatan review.
  - [ ] `GET /api/mandates` & `POST /api/mandates` & `PATCH /api/mandates/[id]`: Manajemen mandat administratif.

- [ ] **Tahap 6: Frontend & UX Alur Persetujuan**
  - [ ] Halaman Staf: Tampilan status surat terbaru, tombol pengajuan pemeriksaan, catatan permintaan revisi dari reviewer, dan tombol revisi ulang.
  - [ ] Halaman Reviewer: Navigasi antrean `/approvals`, modal/tampilan telaah draf, tombol Setujui, Kembalikan untuk Revisi, dan Tolak.
  - [ ] Halaman Admin: Navigasi manajemen mandat `/mandates`, status mandat aktif/kedaluwarsa/dicabut, dan banner peringatan administrasi resmi belum aktif.

- [ ] **Tahap 7: Matriks Pengujian Penerimaan AP-01 s/d AP-14**
  - [ ] AP-01: Pengaju sah mengajukan revisi terbaru.
  - [ ] AP-02: Pengguna tidak berwenang ditolak mengajukan atau memeriksa.
  - [ ] AP-03: Reviewer tanpa mandat aktif ditolak menyetujui.
  - [ ] AP-04: Approval atas revisi lama/stale ditolak.
  - [ ] AP-05: Request changes menghasilkan alur revisi ulang.
  - [ ] AP-06: Penolakan surat wajib menyertakan alasan.
  - [ ] AP-07: Keputusan konkuren tidak menghasilkan keputusan ganda (*dual approval guard*).
  - [ ] AP-08: Self-approval ditolak sesuai kebijakan default.
  - [ ] AP-09: Kotak masuk reviewer terfilter sesuai mandat dan organisasi.
  - [ ] AP-10: Audit log dan status history konsisten.
  - [ ] AP-11: Database offline menyebabkan fail-closed.
  - [ ] AP-12: Penomoran resmi tetap nonaktif (`officialNumber = null`).
  - [ ] AP-13: Seluruh regression test (Sprint 1A, 1B, 1C) tetap lulus.
  - [ ] AP-14: Browser workflow teruji dengan tangkapan layar otomatis.

- [ ] **Tahap 8: Dokumentasi Teknis & Pelaporan Bukti**
  - [ ] Susun `docs/implementation-evidence-sprint-2.md`.
  - [ ] Catat keputusan teknis baru di `docs/decision-log.md` (DEC-015+).
  - [ ] Perbarui `docs/architecture-decisions.md`.
  - [ ] Simpan tangkapan layar bukti ke `docs/evidence/sprint-2/screenshots/`.
  - [ ] Commit seluruh artefak ke branch `feat/sprint-2-approval-workflow`.

---

### 4. Matriks Kriteria Penerimaan (Acceptance Gates AP-01 s/d AP-14)

| Gate ID | Kriteria Penerimaan | Syarat Kelulusan (PASS) |
|---|---|---|
| **AP-01** | Pengajuan Revisi Terbaru | Draf surat dapat diajukan oleh pembuat draf, status berubah menjadi `SUBMITTED`, permintaan persetujuan terbuat mengikat `revision_id` dan hash SHA-256. |
| **AP-02** | Penolakan Pengguna Tidak Berwenang | Pengguna yang bukan pemilik draf dilarang mengajukan draf; staf tanpa mandat dilarang memeriksa surat (HTTP 403). |
| **AP-03** | Penolakan Reviewer Tanpa Mandat Aktif | Reviewer yang tidak memiliki mandat sah, atau mandatnya kedaluwarsa/dicabut, ditolak saat memberikan keputusan. |
| **AP-04** | Anti-Stale Approval | Jika isi draf diperbarui setelah pengajuan (revisi baru terbit), keputusan persetujuan atas revisi lama ditolak. |
| **AP-05** | Alur Request Changes | Permintaan perubahan mengubah status surat menjadi `CHANGES_REQUESTED`, mengembalikan draf ke staf dengan catatan revisi, dan memungkinkan pembuatan revisi berikutnya. |
| **AP-06** | Alasan Wajib Penolakan | Penolakan (`REJECTED`) atau permintaan perbaikan (`CHANGES_REQUESTED`) tanpa catatan ditolak oleh validasi backend. |
| **AP-07** | Concurrency Decision Guard | Dua keputusan simultan dari reviewer pada permintaan yang sama tidak menghasilkan keputusan ganda atau status berkonflik. |
| **AP-08** | Anti Self-Approval | Pembuat draf ditolak secara otomatis jika mencoba menyetujui surat buatannya sendiri. |
| **AP-09** | Filter Antrean Reviewer | Reviewer hanya melihat antrean surat sesuai cakupan jenis surat dan organisasi pada mandatnya. |
| **AP-10** | Konsistensi Status History & Audit Log | Setiap transisi status tercatat di `letter_status_history` dan `audit_events` secara berurutan dan append-only. |
| **AP-11** | Fail-Closed Database Offline | Saat koneksi database terputus, seluruh aksi alur persetujuan ditolak (melempar error), tidak beralih ke memori. |
| **AP-12** | Penomoran Tetap Nonaktif | Surat berstatus `APPROVED` tetap memiliki `officialNumber = null` dan `FEATURE_NUMBERING_ACTIVE = false`. |
| **AP-13** | Regresi Lengkap Lulus | Seluruh linting, typecheck, build 18/18+ routes, serta unit & integration tests Sprint 1 lulus 100%. |
| **AP-14** | Verifikasi Visual Browser | Seluruh tahapan alur persetujuan staf dan reviewer terdokumentasi melalui tangkapan layar browser otomatis. |

