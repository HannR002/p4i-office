import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentUser } from "@/lib/security/session";
import { db } from "@/lib/db";
import { Navbar } from "@/components/Navbar";
import { Sidebar } from "@/components/Sidebar";
import { StatusBadge } from "@/components/StatusBadge";
import { 
  FileText, 
  FilePlus2, 
  Clock, 
  ShieldCheck, 
  ArrowRight,
  ShieldAlert,
  Inbox
} from "lucide-react";

export default async function DashboardPage() {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }

  const letters = await db.getAllLetters(user.organizationId, "ALL", user);
  const letterTypes = await db.getLetterTypes(user.organizationId);
  const users = await db.getAllUsers(user.organizationId);

  const draftCount = letters.filter((l) => l.status === "DRAFT").length;
  const inReviewCount = letters.filter((l) => l.status === "IN_REVIEW").length;
  const recentLetters = letters.slice(0, 5);

  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      <Navbar user={user} />

      <div className="flex flex-1">
        <Sidebar userRole={user.role} />

        <main className="flex-1 p-6 max-w-7xl">
          {/* Welcome Header */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
            <div>
              <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
                Dashboard Persuratan
              </h1>
              <p className="text-xs text-slate-500 mt-0.5">
                Selamat datang, <span className="font-semibold text-slate-800">{user.displayName}</span>. Kelola draf dan pemeriksaan surat internal Yayasan P4I.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <Link
                href="/letters/new"
                className="inline-flex items-center gap-2 bg-brand-700 hover:bg-brand-800 text-white font-medium px-4 py-2 rounded-lg text-sm shadow-sm transition-all"
              >
                <FilePlus2 className="w-4 h-4" />
                <span>Buat Draf Surat Baru</span>
              </Link>
            </div>
          </div>

          {/* Metric Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-amber-100 text-amber-700 flex items-center justify-center shrink-0">
                <FileText className="w-5 h-5" />
              </div>
              <div>
                <div className="text-2xl font-black text-slate-900">{draftCount}</div>
                <div className="text-xs text-slate-500 font-medium">Draf Surat Aktif</div>
              </div>
            </div>

            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center shrink-0">
                <Clock className="w-5 h-5" />
              </div>
              <div>
                <div className="text-2xl font-black text-slate-900">{inReviewCount}</div>
                <div className="text-xs text-slate-500 font-medium">Dalam Pemeriksaan</div>
              </div>
            </div>

            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-purple-100 text-purple-700 flex items-center justify-center shrink-0">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <div>
                <div className="text-2xl font-black text-slate-900">{letterTypes.length}</div>
                <div className="text-xs text-slate-500 font-medium">Kategori Jenis Surat</div>
              </div>
            </div>

            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-slate-100 text-slate-700 flex items-center justify-center shrink-0">
                <ShieldAlert className="w-5 h-5 text-amber-600" />
              </div>
              <div>
                <div className="text-2xl font-black text-slate-900">OFF</div>
                <div className="text-xs text-amber-700 font-semibold">Penomoran Resmi</div>
              </div>
            </div>
          </div>

          {/* Recent Drafts Section */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="p-4 border-b border-slate-200 flex items-center justify-between">
              <div>
                <h2 className="text-sm font-bold text-slate-900">Draf Surat Terbaru</h2>
                <p className="text-xs text-slate-500">Daftar draf kerja yang belum diterbitkan nomor resmi</p>
              </div>

              <Link
                href="/letters"
                className="text-xs font-semibold text-brand-700 hover:text-brand-900 flex items-center gap-1"
              >
                Lihat Semua ({letters.length})
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>

            {recentLetters.length === 0 ? (
              <div className="py-12 px-4 text-center">
                <div className="w-12 h-12 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center mx-auto mb-3">
                  <Inbox className="w-6 h-6" />
                </div>
                <h3 className="text-sm font-bold text-slate-800">Belum Ada Draf Surat</h3>
                <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1 mb-4">
                  Sistem persuratan siap digunakan. Buat draf surat pertama Anda menggunakan formulir standar yayasan.
                </p>
                <Link
                  href="/letters/new"
                  className="inline-flex items-center gap-1.5 bg-brand-700 hover:bg-brand-800 text-white font-medium px-3.5 py-1.5 rounded-lg text-xs transition-colors shadow-xs"
                >
                  <FilePlus2 className="w-4 h-4" />
                  <span>Buat Draf Pertama</span>
                </Link>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-slate-500 uppercase tracking-wider font-semibold border-b border-slate-200">
                    <tr>
                      <th className="px-4 py-3">Jenis Surat</th>
                      <th className="px-4 py-3">Perihal & Penerima</th>
                      <th className="px-4 py-3">Tanggal Rencana</th>
                      <th className="px-4 py-3">Klasifikasi</th>
                      <th className="px-4 py-3">Revisi</th>
                      <th className="px-4 py-3">Status</th>
                      <th className="px-4 py-3 text-right">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {recentLetters.map((letter) => (
                      <tr key={letter.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="px-4 py-3 font-medium text-slate-900">
                          {letter.letterTypeLabel}
                        </td>
                        <td className="px-4 py-3">
                          <div className="font-semibold text-slate-900">{letter.subject}</div>
                          <div className="text-[11px] text-slate-500">Tujuan: {letter.recipientName}</div>
                        </td>
                        <td className="px-4 py-3 text-slate-600">{letter.plannedDate}</td>
                        <td className="px-4 py-3 text-slate-600">{letter.classification}</td>
                        <td className="px-4 py-3">
                          <span className="font-mono bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded text-[11px] font-semibold">
                            v{letter.currentRevisionNo}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <StatusBadge status={letter.status} />
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <Link
                              href={`/letters/${letter.id}`}
                              className="text-brand-700 hover:text-brand-900 font-semibold"
                            >
                              Detail & Revisi
                            </Link>
                            <span className="text-slate-300">|</span>
                            <Link
                              href={`/letters/${letter.id}/preview`}
                              className="text-amber-700 hover:text-amber-900 font-semibold"
                            >
                              Pratinjau
                            </Link>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
