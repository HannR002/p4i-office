import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/security/session";
import { db } from "@/lib/db";
import { Navbar } from "@/components/Navbar";
import { Sidebar } from "@/components/Sidebar";
import { StatusBadge } from "@/components/StatusBadge";
import { Users as UsersIcon, ShieldAlert, AlertOctagon, UserCheck, UserX } from "lucide-react";

export default async function UsersPage() {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }

  // KEAMANAN KETAT SERVER-SIDE: Jika bukan SYSTEM_ADMIN, tolak akses dengan 403
  if (user.role !== "SYSTEM_ADMIN") {
    return (
      <div className="min-h-screen flex flex-col bg-slate-50">
        <Navbar user={user} />
        <div className="flex flex-1">
          <Sidebar userRole={user.role} />
          <main className="flex-1 p-8 flex items-center justify-center">
            <div className="max-w-md bg-white border border-rose-200 rounded-2xl p-6 shadow-md text-center">
              <div className="w-12 h-12 bg-rose-100 text-rose-600 rounded-full flex items-center justify-center mx-auto mb-3">
                <AlertOctagon className="w-6 h-6" />
              </div>
              <h2 className="text-base font-bold text-slate-900 mb-1">Akses Ditolak (403 Forbidden)</h2>
              <p className="text-xs text-slate-500 leading-relaxed mb-4">
                Halaman Manajemen Pengguna dan Peran hanya dapat diakses oleh akun dengan peran <strong>SYSTEM_ADMIN</strong>. Akun Anda terdaftar sebagai <strong>{user.role}</strong>.
              </p>
              <div className="text-[11px] text-slate-400 font-mono">
                Log penolakan otorisasi telah dicatat ke audit log.
              </div>
            </div>
          </main>
        </div>
      </div>
    );
  }

  const allUsers = db.getAllUsers(user.organizationId);

  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      <Navbar user={user} />

      <div className="flex flex-1">
        <Sidebar userRole={user.role} />

        <main className="flex-1 p-6 max-w-7xl">
          <div className="mb-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <UsersIcon className="w-5 h-5 text-brand-700" />
                <h1 className="text-xl font-bold text-slate-900 tracking-tight">
                  Manajemen Pengguna & Peran Sistem
                </h1>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Kelola akun operator, tetapkan peran teknis, dan kendalikan status akses.
              </p>
            </div>
          </div>

          <div className="mb-6 p-4 bg-purple-50 border border-purple-200 rounded-xl text-xs text-purple-950 flex items-start gap-3">
            <ShieldAlert className="w-5 h-5 text-purple-600 shrink-0 mt-0.5" />
            <div>
              <div className="font-bold">Pemisahan Peran Teknis vs Otorisasi Legal (SRS v1.0 Bagian 3):</div>
              <p className="mt-0.5 text-purple-900 leading-relaxed">
                Peran teknis <strong>SYSTEM_ADMIN</strong> hanya mengatur akses pengguna dan infrastruktur aplikasi. Administrator <strong>DILARANG KERAS</strong> menyetujui (approve) atau menandatangani (sign) surat dinas tanpa SK Mandat sah dari Pengurus Yayasan.
              </p>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 uppercase tracking-wider font-semibold border-b border-slate-200">
                <tr>
                  <th className="px-4 py-3">Nama Pengguna</th>
                  <th className="px-4 py-3">Email Akun</th>
                  <th className="px-4 py-3">Peran Sistem (RBAC)</th>
                  <th className="px-4 py-3">Status Akun</th>
                  <th className="px-4 py-3">Dibuat Pada</th>
                  <th className="px-4 py-3 text-right">Aksi Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {allUsers.map((u) => (
                  <tr key={u.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="px-4 py-3 font-semibold text-slate-900">
                      {u.displayName}
                      {u.id === user.id && (
                        <span className="ml-2 text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded font-bold">
                          Anda
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-slate-600 font-mono">{u.email}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        u.role === "SYSTEM_ADMIN" ? "bg-purple-100 text-purple-800 border border-purple-200" : "bg-blue-100 text-blue-800 border border-blue-200"
                      }`}>
                        {u.role}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={u.status} />
                    </td>
                    <td className="px-4 py-3 text-slate-500">
                      {new Date(u.createdAt).toLocaleDateString("id-ID")}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {u.id === user.id ? (
                        <span className="text-[11px] text-slate-400 italic">Akun aktif sendiri</span>
                      ) : (
                        <span className="text-[11px] text-slate-500 font-mono">
                          {u.status === "ACTIVE" ? "Dapat dinonaktifkan" : "Dapat diaktifkan"}
                        </span>
                      )}
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
