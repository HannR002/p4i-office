import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/security/session";
import { db } from "@/lib/db";
import { Navbar } from "@/components/Navbar";
import { Sidebar } from "@/components/Sidebar";
import { Settings as SettingsIcon, ShieldAlert, Building2, Lock } from "lucide-react";

export default async function SettingsPage() {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }

  const org = db.getOrganization();

  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      <Navbar user={user} />

      <div className="flex flex-1">
        <Sidebar userRole={user.role} />

        <main className="flex-1 p-6 max-w-5xl">
          <div className="mb-6">
            <div className="flex items-center gap-2">
              <SettingsIcon className="w-5 h-5 text-brand-700" />
              <h1 className="text-xl font-bold text-slate-900 tracking-tight">
                Pengaturan Organisasi & Kebijakan Penomoran
              </h1>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Konfigurasi master organisasi. Seluruh field berstatus read-only sebelum verifikasi administrasi pengurus.
            </p>
          </div>

          <div className="space-y-6">
            {/* Organization Identity Card */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-6">
              <div className="flex items-center justify-between pb-3 border-b border-slate-200 mb-4">
                <div className="flex items-center gap-2">
                  <Building2 className="w-4 h-4 text-brand-700" />
                  <h2 className="text-sm font-bold text-slate-900">Profil Identitas Yayasan</h2>
                </div>
                <span className="text-[11px] bg-amber-100 text-amber-800 border border-amber-300 font-bold px-2 py-0.5 rounded">
                  DATA BELUM DIVERIFIKASI (PLACEHOLDER)
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                <div>
                  <label className="block text-slate-500 font-medium mb-1">Nama Hukum Organisasi</label>
                  <input
                    type="text"
                    disabled
                    value={org.legalName}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-700 font-semibold"
                  />
                </div>

                <div>
                  <label className="block text-slate-500 font-medium mb-1">Akronim Resmi</label>
                  <input
                    type="text"
                    disabled
                    value={org.acronym}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-700 font-semibold"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-slate-500 font-medium mb-1">Alamat & Kontak Resmi (Kop)</label>
                  <input
                    type="text"
                    disabled
                    value={org.addressPlaceholder}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-700 italic"
                  />
                  <p className="text-[11px] text-slate-400 mt-1">
                    * Alamat, logo resmi, dan informasi kontak tidak boleh dipalsukan dan harus disahkan sesuai Keputusan D-05.
                  </p>
                </div>
              </div>
            </div>

            {/* Numbering Policy Safety Card */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-6">
              <div className="flex items-center justify-between pb-3 border-b border-slate-200 mb-4">
                <div className="flex items-center gap-2">
                  <Lock className="w-4 h-4 text-rose-700" />
                  <h2 className="text-sm font-bold text-slate-900">Kebijakan Penomoran Surat Resmi</h2>
                </div>
                <span className="text-[11px] bg-rose-100 text-rose-800 border border-rose-300 font-bold px-2 py-0.5 rounded">
                  FLAG STATUS: NONAKTIF (OFF)
                </span>
              </div>

              <div className="mb-4 p-3 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-900 flex items-start gap-2">
                <ShieldAlert className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                <div className="leading-relaxed">
                  <strong>Peringatan Safety Gate Sprint 1A:</strong> Penomoran surat resmi ditutup secara permanen pada kode sumber (<code>FEATURE_NUMBERING_ACTIVE=false</code>). Nomor contoh <code>001/P4I/X/2026</code> dilarang diperlakukan sebagai nomor resmi. Aktivasi penomoran menunggu rekonsiliasi nomor historis (D-01) dan penetapan aturan reset nomor (D-02).
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
                <div>
                  <label className="block text-slate-500 font-medium mb-1">Format Pola Surat (Draf Usulan)</label>
                  <input
                    type="text"
                    disabled
                    value="{seq:03}/{code}/{month_roman}/{year}"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg font-mono text-slate-700"
                  />
                </div>

                <div>
                  <label className="block text-slate-500 font-medium mb-1">Periode Reset Urutan</label>
                  <input
                    type="text"
                    disabled
                    value="TAHUNAN (YEAR) — Belum Disahkan"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-700"
                  />
                </div>

                <div>
                  <label className="block text-slate-500 font-medium mb-1">Status Rekonsiliasi Arsip Lama</label>
                  <input
                    type="text"
                    disabled
                    value="BELUM DIREKONSILIASI"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-rose-700 font-semibold"
                  />
                </div>
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
