"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Navbar } from "@/components/Navbar";
import { Sidebar } from "@/components/Sidebar";
import { StatusBadge } from "@/components/StatusBadge";
import { 
  Award, 
  Plus, 
  ShieldAlert, 
  CheckCircle2, 
  AlertCircle, 
  Calendar, 
  UserCheck, 
  FileText 
} from "lucide-react";

interface MandateItem {
  id: string;
  userId: string;
  userName?: string;
  userEmail?: string;
  letterTypeId?: string | null;
  letterTypeLabel?: string | null;
  unitName?: string | null;
  canReview: boolean;
  canApprove: boolean;
  canSign: boolean;
  validFrom: string;
  validTo: string;
  status: "ACTIVE" | "REVOKED" | "EXPIRED";
  decreeNumber: string;
  notes?: string | null;
  createdAt: string;
}

interface UserOption {
  id: string;
  displayName: string;
  email: string;
  role: string;
}

interface UserSession {
  id: string;
  displayName: string;
  email: string;
  role: string;
}

export default function MandatesPage() {
  const router = useRouter();
  const [user, setUser] = useState<UserSession | null>(null);
  const [mandates, setMandates] = useState<MandateItem[]>([]);
  const [users, setUsers] = useState<UserOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);

  // New Mandate Form State
  const [newUserId, setNewUserId] = useState("");
  const [newDecreeNumber, setNewDecreeNumber] = useState("");
  const [newValidFrom, setNewValidFrom] = useState(new Date().toISOString().slice(0, 10));
  const [newValidTo, setNewValidTo] = useState("2026-12-31");
  const [newCanReview, setNewCanReview] = useState(true);
  const [newCanApprove, setNewCanApprove] = useState(true);
  const [newCanSign, setNewCanSign] = useState(false);
  const [newNotes, setNewNotes] = useState("");

  const fetchMandates = useCallback(async () => {
    try {
      const res = await fetch("/api/mandates");
      if (res.ok) {
        const data = await res.json();
        setMandates(data.mandates || []);
      }
    } catch {
      setFeedback({ type: "error", message: "Gagal memuat daftar mandat." });
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchUsers = useCallback(async () => {
    try {
      const res = await fetch("/api/users");
      if (res.ok) {
        const data = await res.json();
        setUsers(data.users || []);
        if (data.users?.length > 0) {
          setNewUserId(data.users[0].id);
        }
      }
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    fetch("/api/auth/me")
      .then((res) => {
        if (!res.ok) router.push("/login");
        return res.json();
      })
      .then((data) => {
        if (data.user) setUser(data.user);
      })
      .catch(() => router.push("/login"));

    fetchMandates();
    fetchUsers();
  }, [fetchMandates, fetchUsers, router]);

  const handleCreateMandate = async (e: React.FormEvent) => {
    e.preventDefault();
    setActionLoading(true);
    setFeedback(null);

    try {
      const res = await fetch("/api/mandates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: newUserId,
          decreeNumber: newDecreeNumber,
          validFrom: newValidFrom,
          validTo: newValidTo,
          canReview: newCanReview,
          canApprove: newCanApprove,
          canSign: newCanSign,
          notes: newNotes || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        setFeedback({ type: "error", message: data.message || "Gagal membuat mandat." });
      } else {
        setFeedback({ type: "success", message: "Mandat baru berhasil ditetapkan." });
        setShowAddModal(false);
        setNewDecreeNumber("");
        setNewNotes("");
        fetchMandates();
      }
    } catch {
      setFeedback({ type: "error", message: "Terjadi kesalahan koneksi server." });
    } finally {
      setActionLoading(false);
    }
  };

  if (loading || !user) {
    return <div className="p-8 text-center text-sm text-slate-500">Memuat data mandat...</div>;
  }

  const isAdmin = user.role === "SYSTEM_ADMIN" || user.role === "PENGURUS_YAYASAN";

  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      <Navbar user={user} />

      <div className="flex flex-1">
        <Sidebar userRole={user.role} />

        <main className="flex-1 p-6 max-w-7xl">
          {/* Header */}
          <div className="mb-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <Award className="w-5 h-5 text-brand-700" />
                <h1 className="text-xl font-bold text-slate-900 tracking-tight">
                  Manajemen Mandat Pejabat (Signatory & Reviewer Mandates)
                </h1>
              </div>
              <p className="text-xs text-slate-500 mt-1">
                Ketetapan Surat Keputusan (SK) Mandat yang menjadi dasar otorisasi pemeriksaan dan persetujuan surat.
              </p>
            </div>

            {isAdmin && (
              <button
                onClick={() => setShowAddModal(true)}
                className="inline-flex items-center gap-1.5 bg-brand-700 hover:bg-brand-800 text-white font-semibold px-3.5 py-2 rounded-lg text-xs shadow-sm transition-all"
              >
                <Plus className="w-4 h-4" />
                <span>Tetapkan Mandat Baru</span>
              </button>
            )}
          </div>

          {/* Safety Guard Sprint 2 */}
          <div className="mb-6 p-4 rounded-xl bg-amber-50 border border-amber-300 text-amber-950 text-xs flex items-start gap-3 shadow-xs">
            <ShieldAlert className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
            <div>
              <strong>BATASAN RESMI SPRINT 2:</strong> Mandat pada tahap ini hanya digunakan untuk validasi hak review & persetujuan internal. Fitur <em>penomoran resmi</em> dan <em>tanda tangan basah/elektronik</em> tetap dikunci sampai disahkan oleh Pengurus Yayasan P4I secara formal pada sprint selanjutnya.
            </div>
          </div>

          {feedback && (
            <div className={`mb-6 p-4 rounded-xl text-xs flex items-start gap-2.5 ${
              feedback.type === "success"
                ? "bg-emerald-50 border border-emerald-200 text-emerald-900"
                : "bg-rose-50 border border-rose-200 text-rose-900"
            }`}>
              {feedback.type === "success" ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              ) : (
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              )}
              <div className="font-medium">{feedback.message}</div>
            </div>
          )}

          {/* Table List */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="p-4 border-b border-slate-200 flex items-center justify-between">
              <h2 className="text-sm font-bold text-slate-900">Daftar SK Mandat Terdaftar</h2>
              <span className="text-[11px] text-slate-500">{mandates.length} Mandat</span>
            </div>

            {mandates.length === 0 ? (
              <div className="p-12 text-center text-slate-500 text-xs">
                Belum ada data mandat pejabat yang terdaftar.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-slate-600 border-b border-slate-200 uppercase font-semibold text-[10px] tracking-wider">
                    <tr>
                      <th className="py-3 px-4">Nomor SK Mandat</th>
                      <th className="py-3 px-4">Pejabat / Reviewer</th>
                      <th className="py-3 px-4">Kewenangan</th>
                      <th className="py-3 px-4">Masa Berlaku</th>
                      <th className="py-3 px-4">Status</th>
                      <th className="py-3 px-4">Catatan</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {mandates.map((m) => (
                      <tr key={m.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="py-3.5 px-4 font-mono font-bold text-slate-900">
                          {m.decreeNumber}
                        </td>
                        <td className="py-3.5 px-4">
                          <div className="font-bold text-slate-800">{m.userName || "Pejabat"}</div>
                          <div className="text-[11px] text-slate-500">{m.userEmail}</div>
                        </td>
                        <td className="py-3.5 px-4">
                          <div className="flex flex-wrap gap-1">
                            {m.canReview && (
                              <span className="bg-blue-50 text-blue-700 border border-blue-200 px-1.5 py-0.5 rounded text-[10px] font-bold">
                                REVIEW
                              </span>
                            )}
                            {m.canApprove && (
                              <span className="bg-emerald-50 text-emerald-700 border border-emerald-200 px-1.5 py-0.5 rounded text-[10px] font-bold">
                                APPROVE
                              </span>
                            )}
                            {m.canSign && (
                              <span className="bg-amber-50 text-amber-700 border border-amber-200 px-1.5 py-0.5 rounded text-[10px] font-bold">
                                SIGN (OFF)
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="py-3.5 px-4 text-slate-600 font-mono text-[11px]">
                          {m.validFrom} s.d. {m.validTo}
                        </td>
                        <td className="py-3.5 px-4">
                          <StatusBadge status={m.status} />
                        </td>
                        <td className="py-3.5 px-4 text-slate-500 italic max-w-xs truncate">
                          {m.notes || "-"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Create Modal */}
          {showAddModal && (
            <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
              <div className="bg-white rounded-xl shadow-2xl border border-slate-200 max-w-lg w-full p-6 space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-slate-200">
                  <div className="flex items-center gap-2">
                    <Award className="w-5 h-5 text-brand-700" />
                    <h3 className="font-bold text-base text-slate-900">Tetapkan SK Mandat Baru</h3>
                  </div>
                  <button
                    onClick={() => setShowAddModal(false)}
                    className="text-slate-400 hover:text-slate-600 text-sm font-bold"
                  >
                    ✕
                  </button>
                </div>

                <form onSubmit={handleCreateMandate} className="space-y-4 text-xs">
                  <div>
                    <label className="block font-semibold text-slate-700 uppercase tracking-wider mb-1">
                      Pilih Pejabat / Pengguna
                    </label>
                    <select
                      value={newUserId}
                      onChange={(e) => setNewUserId(e.target.value)}
                      required
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:outline-none"
                    >
                      {users.map((u) => (
                        <option key={u.id} value={u.id}>
                          {u.displayName} ({u.role}) — {u.email}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-700 uppercase tracking-wider mb-1">
                      Nomor SK Mandat Penetapan
                    </label>
                    <input
                      type="text"
                      required
                      value={newDecreeNumber}
                      onChange={(e) => setNewDecreeNumber(e.target.value)}
                      placeholder="Contoh: SK-P4I/2026/005-DIR"
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:outline-none font-mono"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block font-semibold text-slate-700 uppercase tracking-wider mb-1">
                        Berlaku Dari
                      </label>
                      <input
                        type="date"
                        required
                        value={newValidFrom}
                        onChange={(e) => setNewValidFrom(e.target.value)}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block font-semibold text-slate-700 uppercase tracking-wider mb-1">
                        Berlaku Hingga
                      </label>
                      <input
                        type="date"
                        required
                        value={newValidTo}
                        onChange={(e) => setNewValidTo(e.target.value)}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:outline-none"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-700 uppercase tracking-wider mb-2">
                      Kewenangan Mandat
                    </label>
                    <div className="space-y-2">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={newCanReview}
                          onChange={(e) => setNewCanReview(e.target.checked)}
                          className="rounded text-brand-600 focus:ring-brand-500"
                        />
                        <span>Pemeriksaan Surat (canReview)</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={newCanApprove}
                          onChange={(e) => setNewCanApprove(e.target.checked)}
                          className="rounded text-brand-600 focus:ring-brand-500"
                        />
                        <span>Persetujuan Surat (canApprove)</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer opacity-60">
                        <input
                          type="checkbox"
                          checked={newCanSign}
                          onChange={(e) => setNewCanSign(e.target.checked)}
                          className="rounded text-brand-600 focus:ring-brand-500"
                        />
                        <span>Penandatanganan Final (canSign - Terkunci OFF pada Sprint 2)</span>
                      </label>
                    </div>
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-700 uppercase tracking-wider mb-1">
                      Catatan SK
                    </label>
                    <input
                      type="text"
                      value={newNotes}
                      onChange={(e) => setNewNotes(e.target.value)}
                      placeholder="Contoh: Penetapan reviewer bidang administrasi & magang"
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:outline-none"
                    />
                  </div>

                  <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-200">
                    <button
                      type="button"
                      onClick={() => setShowAddModal(false)}
                      className="px-3.5 py-2 rounded-lg text-xs font-semibold text-slate-600 hover:bg-slate-100"
                    >
                      Batal
                    </button>
                    <button
                      type="submit"
                      disabled={actionLoading}
                      className="px-4 py-2 rounded-lg text-xs font-semibold bg-brand-700 hover:bg-brand-800 text-white shadow-sm disabled:opacity-50"
                    >
                      {actionLoading ? "Menyimpan..." : "Simpan Mandat"}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

