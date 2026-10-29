import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentUser } from "@/lib/security/session";
import { db } from "@/lib/db";
import { Navbar } from "@/components/Navbar";
import { Sidebar } from "@/components/Sidebar";
import { StatusBadge } from "@/components/StatusBadge";
import { FilePlus2, Mail, Eye, Edit3 } from "lucide-react";

export default async function LettersPage(props: {
  searchParams: Promise<{ status?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }

  const searchParams = await props.searchParams;
  const statusFilter = searchParams.status || "ALL";
  const letters = await db.getAllLetters(user.organizationId, statusFilter, user);

  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      <Navbar user={user} />

      <div className="flex flex-1">
        <Sidebar userRole={user.role} />

        <main className="flex-1 p-6 max-w-7xl">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
            <div>
              <div className="flex items-center gap-2">
                <Mail className="w-5 h-5 text-brand-700" />
                <h1 className="text-xl font-bold text-slate-900 tracking-tight">
                  Draf Surat Keluar
                </h1>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Kelola draf, catat revisi yang tidak menimpa riwayat, dan ajukan pemeriksaan.
              </p>
            </div>

            <Link
              href="/letters/new"
              className="inline-flex items-center gap-2 bg-brand-700 hover:bg-brand-800 text-white font-medium px-4 py-2 rounded-lg text-sm shadow-sm transition-all"
            >
              <FilePlus2 className="w-4 h-4" />
              <span>Buat Draf Baru</span>
            </Link>
          </div>

          {/* Filter Bar */}
          <div className="flex items-center gap-2 mb-4 bg-white p-2 rounded-lg border border-slate-200 text-xs">
            <span className="font-semibold text-slate-500 px-2">Filter Status:</span>
            <Link
              href="/letters"
              className={`px-3 py-1 rounded-md font-medium transition-colors ${
                statusFilter === "ALL"
                  ? "bg-slate-900 text-white"
                  : "text-slate-600 hover:bg-slate-100"
              }`}
            >
              Semua
            </Link>
            <Link
              href="/letters?status=DRAFT"
              className={`px-3 py-1 rounded-md font-medium transition-colors ${
                statusFilter === "DRAFT"
                  ? "bg-amber-600 text-white"
                  : "text-slate-600 hover:bg-slate-100"
              }`}
            >
              Draf
            </Link>
            <Link
              href="/letters?status=IN_REVIEW"
              className={`px-3 py-1 rounded-md font-medium transition-colors ${
                statusFilter === "IN_REVIEW"
                  ? "bg-blue-600 text-white"
                  : "text-slate-600 hover:bg-slate-100"
              }`}
            >
              Dalam Pemeriksaan
            </Link>
          </div>

          {/* Letters Table */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
            {letters.length === 0 ? (
              <div className="py-12 text-center text-xs text-slate-500">
                Tidak ada draf surat dengan filter ini.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-slate-500 uppercase tracking-wider font-semibold border-b border-slate-200">
                    <tr>
                      <th className="px-4 py-3">Jenis Surat</th>
                      <th className="px-4 py-3">Perihal & Penerima</th>
                      <th className="px-4 py-3">Pembuat</th>
                      <th className="px-4 py-3">Tanggal Rencana</th>
                      <th className="px-4 py-3">Klasifikasi</th>
                      <th className="px-4 py-3">Revisi</th>
                      <th className="px-4 py-3">Status</th>
                      <th className="px-4 py-3 text-right">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {letters.map((letter) => (
                      <tr key={letter.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="px-4 py-3 font-semibold text-slate-900">
                          {letter.letterTypeLabel}
                        </td>
                        <td className="px-4 py-3">
                          <div className="font-bold text-slate-900">{letter.subject}</div>
                          <div className="text-[11px] text-slate-500">Kepada: {letter.recipientName}</div>
                        </td>
                        <td className="px-4 py-3 text-slate-600">
                          {letter.authorName}
                        </td>
                        <td className="px-4 py-3 text-slate-600">{letter.plannedDate}</td>
                        <td className="px-4 py-3">
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-slate-100 text-slate-700">
                            {letter.classification}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span className="font-mono bg-brand-50 text-brand-800 border border-brand-200 px-1.5 py-0.5 rounded text-[11px] font-bold">
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
                              className="inline-flex items-center gap-1 text-brand-700 hover:text-brand-900 font-semibold px-2 py-1 bg-brand-50 hover:bg-brand-100 rounded border border-brand-200"
                            >
                              <Edit3 className="w-3 h-3" />
                              Detail & Revisi
                            </Link>
                            <Link
                              href={`/letters/${letter.id}/preview`}
                              className="inline-flex items-center gap-1 text-amber-800 hover:text-amber-950 font-semibold px-2 py-1 bg-amber-50 hover:bg-amber-100 rounded border border-amber-200"
                            >
                              <Eye className="w-3 h-3" />
                              Pratinjau Draf
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
