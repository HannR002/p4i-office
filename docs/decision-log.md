# Decision Log — P4I Office v1.0
## Pencatatan Keputusan Teknis, Mitigasi Risiko, dan Rekonsiliasi Dokumen

| ID | Tanggal | Topik | Keputusan | Rasional & Mitigasi |
|---|---|---|---|---|
| **DEC-001** | 2026-10-28 | Isolasi Proyek | Membangun proyek mandiri di direktori `d:\p4i-office` tanpa menyentuh repositori `p4i-corporate-hub` atau `p4i-webgis`. | Menjamin tidak terjadi polusi kode atau kebocoran konfigurasi antar sistem yayasan. |
| **DEC-002** | 2026-10-28 | Ketiadaan PostgreSQL Lokal | Menyiapkan layer koneksi DB adaptif: migrasi SQL murni PostgreSQL (`db/migrations/0001_sprint1a_core.sql`), abstraksi repository, dan pelaporan status pengujian integrasi database riil sebagai `BLOCKED (PostgreSQL Service Offline)` daripada mengarang status `PASS`. | Mematuhi aturan ketat transparansi pengujian pada prompt master; integritas logika bisnis tetap diuji via unit test menyeluruh. |
| **DEC-003** | 2026-10-28 | Kebijakan Penomoran Resmi | Mengunci mati fitur penomoran otomatis (`FEATURE_NUMBERING_ACTIVE = false`) dan menetapkan `is_active = false` pada seluruh tabel kebijakan penomoran. | Dokumen D-01 s.d. D-03 pada paket Sprint 0 belum disahkan oleh Pengurus. Mencegah terbitnya nomor surat ilegal atau inkonsisten. |
| **DEC-004** | 2026-10-28 | Pemisahan RBAC & Mandat Legal | Peran teknis `SYSTEM_ADMIN` tidak diberi izin untuk menyetujui (`approve`) atau menandatangani (`sign`) surat. | Sesuai klausul SRS 3.0: administrator teknis tidak boleh memiliki kuasa administratif legal tanpa mandat tertulis terverifikasi. |
| **DEC-005** | 2026-10-28 | Ketiadaan Dukungan MFA | Menandai MFA sebagai GAP keamanan kritis yang memblokir rilis admin produksi, bukan mengklaim telah selesai. | Sprint 1A berfokus pada fondasi sesi dan RBAC. MFA akan dijadwalkan pada sprint keamanan lanjutan sebelum go-live. |
| **DEC-006** | 2026-10-28 | Watermark Pratinjau | Setiap pratinjau draf surat wajib menampilkan watermark teks dan badge jelas: **"DRAF — BELUM RESMI"** serta header placeholder berlabel **"DATA BELUM DIVERIFIKASI"**. | Menghindari penggunaan pratinjau digital sebagai surat edaran resmi palsu oleh staf internal. |
