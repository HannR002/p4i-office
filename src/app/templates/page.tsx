import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/security/session";
import { Navbar } from "@/components/Navbar";
import { Sidebar } from "@/components/Sidebar";
import { StatusBadge } from "@/components/StatusBadge";
import { FileSpreadsheet, ShieldAlert, Info } from "lucide-react";

export default async function TemplatesPage() {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }

  // Daftar templat resmi sesuai P4I_Office_Paket_Sprint0.xlsx
  const templateCatalog = [
    { code: "KET-MAGANG", title: "Surat Keterangan Selesai Magang", priority: "P0", status: "USULAN", schema: "Nama peserta, asal instansi, periode magang, capaian riset" },
    { code: "TUGAS", title: "Surat Tugas", priority: "P0", status: "USULAN", schema: "Nama penugasan, daftar personil, lokasi kegiatan, waktu pelaksanaan" },
    { code: "UNDANGAN", title: "Surat Undangan", priority: "P0", status: "USULAN", schema: "Nama acara, waktu & tempat, agenda rapat, tautan daring" },
    { code: "PERMOHONAN", title: "Surat Permohonan", priority: "P0", status: "USULAN", schema: "Instansi tujuan, maksud permohonan, dokumen pendukung" },
    { code: "PENGANTAR", title: "Surat Pengantar", priority: "P0", status: "USULAN", schema: "Daftar berkas yang dikirimkan, jumlah eksemplar, catatan penerimaan" },
    { code: "BALASAN", title: "Surat Balasan Kerja Sama", priority: "P1", status: "USULAN", schema: "Nomor surat masuk rujukan, kesediaan kerja sama, ruang lingkup" },
    { code: "SK", title: "Surat Keputusan (SK)", priority: "P1", status: "USULAN", schema: "Menimbang, Mengingat, Menetapkan, Diktum keputusan (Seri Terpisah)" },
    { code: "REKOMENDASI", title: "Surat Rekomendasi", priority: "P1", status: "USULAN", schema: "Identitas pemohon, latar belakang, poin rekomendasi resmi" },
  ];

  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      <Navbar user={user} />

      <div className="flex flex-1">
        <Sidebar userRole={user.role} />

        <main className="flex-1 p-6 max-w-7xl">
          <div className="mb-6">
            <div className="flex items-center gap-2">
              <FileSpreadsheet className="w-5 h-5 text-brand-700" />
              <h1 className="text-xl font-bold text-slate-900 tracking-tight">
                Katalog Templat Surat
              </h1>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Rujukan templat persuratan berdasarkan paket spesifikasi Sprint 0 Yayasan P4I.
            </p>
          </div>

          <div className="mb-6 p-4 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-900 flex items-start gap-3">
            <ShieldAlert className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <div className="font-bold text-amber-950">Status Penetapan Templat & Kop Resmi:</div>
              <p className="mt-0.5 text-amber-800 leading-relaxed">
                Seluruh jenis surat di bawah berstatus <strong>USULAN</strong>. Berkas kop resmi, logo, stempel digital, dan matriks penandatangan (D-04 & D-05) masih menunggu pengesahan tertulis dari Pengurus Yayasan. Sistem mengunci penerbitan surat final sebelum pengesahan tersebut diselesaikan.
              </p>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 uppercase tracking-wider font-semibold border-b border-slate-200">
                <tr>
                  <th className="px-4 py-3">Kode Seri</th>
                  <th className="px-4 py-3">Nama Jenis Surat</th>
                  <th className="px-4 py-3">Prioritas</th>
                  <th className="px-4 py-3">Struktur Form Schema</th>
                  <th className="px-4 py-3">Status Administrasi</th>
                  <th className="px-4 py-3">Penomoran Otomatis</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {templateCatalog.map((t) => (
                  <tr key={t.code} className="hover:bg-slate-50/80 transition-colors">
                    <td className="px-4 py-3 font-mono font-bold text-slate-800">{t.code}</td>
                    <td className="px-4 py-3 font-semibold text-slate-900">{t.title}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        t.priority === "P0" ? "bg-red-100 text-red-800" : "bg-blue-100 text-blue-800"
                      }`}>
                        {t.priority}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-600">{t.schema}</td>
                    <td className="px-4 py-3">
                      <StatusBadge status={t.status} />
                    </td>
                    <td className="px-4 py-3">
                      <span className="font-mono text-[10px] text-rose-700 bg-rose-50 px-2 py-0.5 rounded border border-rose-200 font-bold">
                        TERKUNCI (OFF)
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </main>
      </div>
    </div>
  );
}
