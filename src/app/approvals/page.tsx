"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Navbar } from "@/components/Navbar";
import { Sidebar } from "@/components/Sidebar";
import { StatusBadge } from "@/components/StatusBadge";
import { 
  CheckCircle2, 
  XCircle, 
  AlertTriangle, 
  Clock, 
  Hash, 
  Eye, 
  ShieldAlert, 
  Award,
  AlertCircle,
  FileCheck
} from "lucide-react";

interface PendingApproval {
  id: string;
  organizationId: string;
  letterId: string;
  revisionId: string;
  revisionVersion: number;
  contentSha256: string;
  submittedBy: string;
  submitterName: string;
  submittedAt: string;
  status: string;
  submissionNotes?: string | null;
  letterSubject: string;
  letterTypeCode: string;
  letterTypeLabel: string;
  letterAuthorId?: string;
}

interface SignatoryMandate {
  id: string;
  userId: string;
  decreeNumber: string;
  status: string;
  canApprove: boolean;
  canReview: boolean;
  validFrom: string;
  validTo: string;
}

interface UserSession {
  id: string;
  displayName: string;
  email: string;
  role: string;
  organizationId: string;
}

export default function ApprovalsPage() {
  const router = useRouter();
  const [user, setUser] = useState<UserSession | null>(null);
  const [queue, setQueue] = useState<PendingApproval[]>([]);
  const [mandates, setMandates] = useState<SignatoryMandate[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedReq, setSelectedReq] = useState<PendingApproval | null>(null);
  const [decisionModal, setDecisionModal] = useState(false);
  const [decisionType, setDecisionType] = useState<"APPROVED" | "CHANGES_REQUESTED" | "REJECTED">("APPROVED");
  const [comments, setComments] = useState("");
  const [selectedMandateId, setSelectedMandateId] = useState("");
  const [actionLoading, setActionLoading] = useState(false);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);

  const fetchQueue = useCallback(async () => {
    try {
      const res = await fetch("/api/approvals/pending");
      if (res.ok) {
        const data = await res.json();
        setQueue(data.queue || []);
      }
    } catch {
      setFeedback({ type: "error", message: "Gagal memuat antrean pemeriksaan." });
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchMandates = useCallback(async () => {
    try {
      const res = await fetch("/api/mandates");
      if (res.ok) {
        const data = await res.json();
        setMandates(data.mandates || []);
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
        if (data.user) {
          setUser(data.user);
        }
      })
      .catch(() => router.push("/login"));

    fetchQueue();
    fetchMandates();
  }, [fetchQueue, fetchMandates, router]);

  const handleOpenDecision = (item: PendingApproval) => {
    setSelectedReq(item);
    setDecisionType("APPROVED");
    setComments("");
    // Find active mandate with canApprove if available
    const active = mandates.find((m) => m.status === "ACTIVE" && m.canApprove);
    if (active) setSelectedMandateId(active.id);
    else if (mandates.length > 0) setSelectedMandateId(mandates[0].id);
    setDecisionModal(true);
  };

  const handleProcessDecision = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedReq) return;

    if (
      (decisionType === "CHANGES_REQUESTED" || decisionType === "REJECTED") &&
      comments.trim().length < 5
    ) {
      alert("Alasan penolakan atau permintaan perubahan wajib diisi (minimal 5 karakter).");
      return;
    }

    setActionLoading(true);
    setFeedback(null);

    try {
      const res = await fetch(`/api/approvals/${selectedReq.id}/decision`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          decision: decisionType,
          comments: comments.trim() || undefined,
          mandateId: selectedMandateId || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        setFeedback({ type: "error", message: data.message || "Gagal memproses keputusan." });
      } else {
        setFeedback({ type: "success", message: `Keputusan ${decisionType} berhasil diproses.` });
        setDecisionModal(false);
        fetchQueue();
      }
    } catch {
      setFeedback({ type: "error", message: "Terjadi kesalahan koneksi server." });
    } finally {
      setActionLoading(false);
    }
  };

  if (loading || !user) {
    return <div className="p-8 text-center text-sm text-slate-500">Memuat antrean pemeriksaan...</div>;
  }

  const isSelfApproval = selectedReq && (selectedReq.submittedBy === user.id || selectedReq.letterAuthorId === user.id);

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
                <FileCheck className="w-5 h-5 text-brand-700" />
                <h1 className="text-xl font-bold text-slate-900 tracking-tight">
                  Antrean Pemeriksaan & Persetujuan (Approval Queue)
                </h1>
              </div>
              <p className="text-xs text-slate-500 mt-1">
                Daftar pengajuan draf surat internal yang menunggu verifikasi reviewer berwenang berdasarkan SK Mandat.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs bg-brand-50 text-brand-800 border border-brand-200 px-3 py-1.5 rounded-lg font-bold">
                {queue.length} Menunggu Keputusan
              </span>
            </div>
          </div>

          {/* Banner Guard */}
          <div className="mb-6 p-4 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs flex items-start gap-3">
            <ShieldAlert className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
            <div>
              <strong>TATA KELOLA PEMERIKSAAN SPRINT 2:</strong> Keputusan persetujuan mengikat hash SHA-256 versi isi surat dan nomor SK Mandat pejabat. Pelanggaran pemisahan tugas (Anti Self-Approval) dan persetujuan draf basi (stale) dilarang ketat oleh sistem.
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

          {/* Queue List Table */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="p-4 border-b border-slate-200 flex items-center justify-between">
              <h2 className="text-sm font-bold text-slate-900">Draf Menunggu Pemeriksaan</h2>
              <span className="text-[11px] text-slate-500">Urutan: Pengajuan Terlama (FIFO)</span>
            </div>

            {queue.length === 0 ? (
              <div className="p-12 text-center text-slate-500 text-xs">
                <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto mb-2 opacity-80" />
                <div className="font-semibold text-slate-700">Antrean Pemeriksaan Bersih</div>
                <p className="mt-1 text-slate-400">Tidak ada draf surat yang menunggu pemeriksaan saat ini.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-slate-600 border-b border-slate-200 uppercase font-semibold text-[10px] tracking-wider">
                    <tr>
                      <th className="py-3 px-4">Perihal & Jenis</th>
                      <th className="py-3 px-4">Versi & Hash</th>
                      <th className="py-3 px-4">Diajukan Oleh</th>
                      <th className="py-3 px-4">Waktu Pengajuan</th>
                      <th className="py-3 px-4">Status</th>
                      <th className="py-3 px-4 text-right">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {queue.map((item) => (
                      <tr key={item.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="py-3.5 px-4">
                          <Link href={`/letters/${item.letterId}`} className="font-bold text-slate-900 hover:text-brand-700">
                            {item.letterSubject}
                          </Link>
                          <div className="text-[11px] text-slate-500 mt-0.5 font-medium">
                            {item.letterTypeLabel}
                          </div>
                          {item.submissionNotes && (
                            <div className="text-[11px] text-amber-700 mt-1 italic">
                              Catatan: &quot;{item.submissionNotes}&quot;
                            </div>
                          )}
                        </td>
                        <td className="py-3.5 px-4 font-mono">
                          <span className="bg-slate-100 px-1.5 py-0.5 rounded border border-slate-300 font-bold text-slate-800">
                            v{item.revisionVersion}
                          </span>
                          <div className="text-[9px] text-slate-400 mt-1 truncate max-w-[120px]" title={item.contentSha256}>
                            {item.contentSha256.slice(0, 16)}...
                          </div>
                        </td>
                        <td className="py-3.5 px-4 text-slate-700 font-medium">
                          {item.submitterName}
                        </td>
                        <td className="py-3.5 px-4 text-slate-500">
                          {new Date(item.submittedAt).toLocaleString("id-ID")}
                        </td>
                        <td className="py-3.5 px-4">
                          <StatusBadge status={item.status} />
                        </td>
                        <td className="py-3.5 px-4 text-right space-x-2">
                          <Link
                            href={`/letters/${item.letterId}/preview`}
                            className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-700 bg-amber-50 hover:bg-amber-100 border border-amber-300 px-2.5 py-1.5 rounded-lg transition-colors"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            <span>Pratinjau</span>
                          </Link>
                          <button
                            onClick={() => handleOpenDecision(item)}
                            className="inline-flex items-center gap-1 text-[11px] font-semibold text-white bg-brand-700 hover:bg-brand-800 px-3 py-1.5 rounded-lg shadow-xs transition-colors"
                          >
                            <FileCheck className="w-3.5 h-3.5" />
                            <span>Periksa</span>
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Decision Modal */}
          {decisionModal && selectedReq && (
            <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
              <div className="bg-white rounded-xl shadow-2xl border border-slate-200 max-w-lg w-full p-6 space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-slate-200">
                  <div className="flex items-center gap-2">
                    <Award className="w-5 h-5 text-brand-700" />
                    <h3 className="font-bold text-base text-slate-900">Keputusan Pemeriksaan Draf</h3>
                  </div>
                  <button
                    onClick={() => setDecisionModal(false)}
                    className="text-slate-400 hover:text-slate-600 text-sm font-bold"
                  >
                    ✕
                  </button>
                </div>

                <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 text-xs space-y-1">
                  <div>Perihal: <strong>{selectedReq.letterSubject}</strong></div>
                  <div>Jenis: <strong>{selectedReq.letterTypeLabel}</strong></div>
                  <div>Versi Terkini: <strong className="font-mono">v{selectedReq.revisionVersion}</strong></div>
                  <div className="font-mono text-[10px] text-slate-500 truncate">
                    Hash Konten: {selectedReq.contentSha256}
                  </div>
                </div>

                {/* Anti Self-Approval Warning */}
                {isSelfApproval && (
                  <div className="p-3.5 bg-rose-50 border border-rose-300 rounded-lg text-xs text-rose-900 flex items-start gap-2.5">
                    <ShieldAlert className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                    <div>
                      <strong className="block font-bold">Pelanggaran Pemisahan Tugas (Anti Self-Approval)</strong>
                      Anda adalah pembuat draf surat ini. Reviewer tidak diperbolehkan memeriksa atau menyetujui suratnya sendiri. Pemeriksaan harus dilakukan oleh pejabat reviewer lain.
                    </div>
                  </div>
                )}

                <form onSubmit={handleProcessDecision} className="space-y-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                      Pilihan Keputusan
                    </label>
                    <div className="grid grid-cols-3 gap-2">
                      <button
                        type="button"
                        onClick={() => setDecisionType("APPROVED")}
                        className={`p-2.5 rounded-lg border text-xs font-bold flex flex-col items-center gap-1 transition-all ${
                          decisionType === "APPROVED"
                            ? "bg-emerald-50 border-emerald-500 text-emerald-800 ring-2 ring-emerald-500/20"
                            : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
                        }`}
                      >
                        <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                        <span>Setujui (Approve)</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setDecisionType("CHANGES_REQUESTED")}
                        className={`p-2.5 rounded-lg border text-xs font-bold flex flex-col items-center gap-1 transition-all ${
                          decisionType === "CHANGES_REQUESTED"
                            ? "bg-amber-50 border-amber-500 text-amber-800 ring-2 ring-amber-500/20"
                            : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
                        }`}
                      >
                        <AlertTriangle className="w-4 h-4 text-amber-600" />
                        <span>Perlu Revisi</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setDecisionType("REJECTED")}
                        className={`p-2.5 rounded-lg border text-xs font-bold flex flex-col items-center gap-1 transition-all ${
                          decisionType === "REJECTED"
                            ? "bg-rose-50 border-rose-500 text-rose-800 ring-2 ring-rose-500/20"
                            : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
                        }`}
                      >
                        <XCircle className="w-4 h-4 text-rose-600" />
                        <span>Tolak (Reject)</span>
                      </button>
                    </div>
                  </div>

                  {decisionType === "APPROVED" && (
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                        Pilih Mandat Pejabat Yang Digunakan
                      </label>
                      <select
                        value={selectedMandateId}
                        onChange={(e) => setSelectedMandateId(e.target.value)}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-brand-500 focus:outline-none"
                      >
                        {mandates.map((m) => (
                          <option key={m.id} value={m.id}>
                            {m.decreeNumber} ({m.status}) — Berlaku s.d. {m.validTo}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                      Catatan / Alasan Keputusan {decisionType !== "APPROVED" && <span className="text-rose-600 font-bold">* (Wajib &gt;= 5 Karakter)</span>}
                    </label>
                    <textarea
                      rows={4}
                      value={comments}
                      onChange={(e) => setComments(e.target.value)}
                      placeholder={
                        decisionType === "APPROVED"
                          ? "Catatan persetujuan (opsional)"
                          : "Jelaskan dengan jelas klausul yang perlu direvisi atau alasan penolakan..."
                      }
                      required={decisionType !== "APPROVED"}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-brand-500 focus:outline-none"
                    ></textarea>
                  </div>

                  <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-200">
                    <button
                      type="button"
                      onClick={() => setDecisionModal(false)}
                      className="px-3.5 py-2 rounded-lg text-xs font-semibold text-slate-600 hover:bg-slate-100"
                    >
                      Batal
                    </button>
                    <button
                      type="submit"
                      disabled={Boolean(isSelfApproval) || actionLoading}
                      className={`px-4 py-2 rounded-lg text-xs font-semibold text-white shadow-sm transition-all disabled:opacity-50 ${
                        decisionType === "APPROVED"
                          ? "bg-emerald-600 hover:bg-emerald-700"
                          : decisionType === "CHANGES_REQUESTED"
                          ? "bg-amber-600 hover:bg-amber-700"
                          : "bg-rose-600 hover:bg-rose-700"
                      }`}
                    >
                      {actionLoading ? "Memproses..." : `Konfirmasi ${decisionType}`}
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

