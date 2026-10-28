"use client";

import React, { useState, useEffect, useCallback, use } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Navbar } from "@/components/Navbar";
import { Sidebar } from "@/components/Sidebar";
import { StatusBadge } from "@/components/StatusBadge";
import { 
  ArrowLeft, 
  Eye, 
  Send, 
  History, 
  Save, 
  AlertCircle, 
  CheckCircle2, 
  Hash, 
  FileCheck,
  ShieldAlert
} from "lucide-react";

interface LetterDetail {
  id: string;
  letterTypeLabel: string;
  subject: string;
  recipientName: string;
  classification: "PUBLIC" | "INTERNAL" | "CONFIDENTIAL";
  plannedDate: string;
  status: string;
  currentRevisionNo: number;
  officialNumber: string | null;
  authorName: string;
  createdAt: string;
  updatedAt: string;
}

interface LetterRevision {
  id: string;
  version: number;
  subject: string;
  recipientName: string;
  classification: "PUBLIC" | "INTERNAL" | "CONFIDENTIAL";
  plannedDate: string;
  content: {
    bodyText?: string;
    notes?: string;
    [key: string]: unknown;
  };
  contentSha256: string;
  changeSummary?: string;
  createdByName?: string;
  createdAt: string;
}

interface UserSession {
  id: string;
  displayName: string;
  email: string;
  role: string;
}

export default function LetterDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const resolvedParams = use(params);
  const router = useRouter();

  const [user, setUser] = useState<UserSession | null>(null);
  const [letter, setLetter] = useState<LetterDetail | null>(null);
  const [revisions, setRevisions] = useState<LetterRevision[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);

  // Form states for creating a new revision
  const [editSubject, setEditSubject] = useState("");
  const [editRecipient, setEditRecipient] = useState("");
  const [editClassification, setEditClassification] = useState<"PUBLIC" | "INTERNAL" | "CONFIDENTIAL">("INTERNAL");
  const [editPlannedDate, setEditPlannedDate] = useState("");
  const [editBodyText, setEditBodyText] = useState("");
  const [editChangeSummary, setEditChangeSummary] = useState("");

  const fetchDetail = useCallback(async () => {
    try {
      const res = await fetch(`/api/letters/${resolvedParams.id}`);
      if (!res.ok) {
        setFeedback({ type: "error", message: "Surat tidak ditemukan." });
        return;
      }
      const data = await res.json();
      setLetter(data.letter);
      setRevisions(data.revisions);

      // Populate edit fields from latest revision
      if (data.revisions.length > 0) {
        const latest = data.revisions[data.revisions.length - 1];
        setEditSubject(latest.subject);
        setEditRecipient(latest.recipientName);
        setEditClassification(latest.classification);
        setEditPlannedDate(latest.plannedDate);
        setEditBodyText(latest.content?.bodyText || "");
      }
    } catch {
      setFeedback({ type: "error", message: "Gagal memuat rincian draf." });
    } finally {
      setLoading(false);
    }
  }, [resolvedParams.id]);

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

    fetchDetail();
  }, [fetchDetail, router]);

  const handleAddRevision = async (e: React.FormEvent) => {
    e.preventDefault();
    setActionLoading(true);
    setFeedback(null);

    try {
      const res = await fetch(`/api/letters/${resolvedParams.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subject: editSubject,
          recipientName: editRecipient,
          classification: editClassification,
          plannedDate: editPlannedDate,
          content: { bodyText: editBodyText },
          changeSummary: editChangeSummary || `Pembaruan revisi ke-${(letter?.currentRevisionNo || 1) + 1}`,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        setFeedback({ type: "error", message: data.message || "Gagal menyimpan revisi." });
      } else {
        setFeedback({ type: "success", message: data.message });
        setEditChangeSummary("");
        fetchDetail();
      }
    } catch {
      setFeedback({ type: "error", message: "Terjadi kesalahan koneksi server." });
    } finally {
      setActionLoading(false);
    }
  };

  const handleSubmitForReview = async () => {
    if (!confirm("Ajukan draf surat ini untuk pemeriksaan? Draf akan dikunci selama proses review.")) {
      return;
    }

    setActionLoading(true);
    setFeedback(null);

    try {
      const res = await fetch(`/api/letters/${resolvedParams.id}/submit`, {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setFeedback({ type: "error", message: data.message || "Gagal mengajukan draf." });
      } else {
        setFeedback({ type: "success", message: data.message });
        fetchDetail();
      }
    } catch {
      setFeedback({ type: "error", message: "Terjadi kesalahan saat mengajukan draf." });
    } finally {
      setActionLoading(false);
    }
  };

  if (loading || !user || !letter) {
    return <div className="p-8 text-center text-sm text-slate-500">Memuat rincian draf surat...</div>;
  }

  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      <Navbar user={user} />

      <div className="flex flex-1">
        <Sidebar userRole={user.role} />

        <main className="flex-1 p-6 max-w-7xl">
          {/* Header */}
          <div className="mb-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <Link
                href="/letters"
                className="inline-flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-800 font-semibold mb-2"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                Kembali ke Daftar Draf
              </Link>
              <div className="flex items-center gap-2.5">
                <h1 className="text-xl font-bold text-slate-900 tracking-tight">
                  {letter.subject}
                </h1>
                <StatusBadge status={letter.status} />
              </div>
              <div className="text-xs text-slate-500 mt-1 flex items-center gap-3">
                <span>Jenis: <strong>{letter.letterTypeLabel}</strong></span>
                <span>•</span>
                <span>Tujuan: <strong>{letter.recipientName}</strong></span>
                <span>•</span>
                <span>Versi Terkini: <strong>v{letter.currentRevisionNo}</strong></span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Link
                href={`/letters/${letter.id}/preview`}
                className="inline-flex items-center gap-1.5 bg-amber-50 hover:bg-amber-100 text-amber-900 font-semibold px-3.5 py-2 rounded-lg text-xs border border-amber-300 shadow-xs transition-colors"
              >
                <Eye className="w-4 h-4 text-amber-700" />
                <span>Pratinjau Draf (Watermark)</span>
              </Link>

              {letter.status === "DRAFT" && (
                <button
                  onClick={handleSubmitForReview}
                  disabled={actionLoading}
                  className="inline-flex items-center gap-1.5 bg-brand-700 hover:bg-brand-800 text-white font-semibold px-3.5 py-2 rounded-lg text-xs shadow-sm transition-all disabled:opacity-50"
                >
                  <Send className="w-4 h-4" />
                  <span>Ajukan Pemeriksaan</span>
                </button>
              )}
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

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left 2 Cols: Edit as New Revision Form */}
            <div className="lg:col-span-2 space-y-6">
              <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-6">
                <div className="flex items-center justify-between pb-4 border-b border-slate-200 mb-5">
                  <div>
                    <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                      <FileCheck className="w-4 h-4 text-brand-700" />
                      Sunting Draf sebagai Revisi Baru
                    </h2>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Prinsip Immutability: Revisi lama tidak ditimpa, perubahan menghasilkan versi ke-{letter.currentRevisionNo + 1}.
                    </p>
                  </div>
                  <span className="font-mono text-xs px-2 py-0.5 bg-slate-100 rounded text-slate-700 font-bold">
                    Target: v{letter.currentRevisionNo + 1}
                  </span>
                </div>

                {letter.status !== "DRAFT" && letter.status !== "RETURNED" ? (
                  <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-600 flex items-start gap-2">
                    <ShieldAlert className="w-4 h-4 text-slate-500 shrink-0 mt-0.5" />
                    <div>
                      Draf surat sedang berada dalam status <strong>{letter.status}</strong>. Penyuntingan dikunci sampai reviewer mengembalikan draf.
                    </div>
                  </div>
                ) : (
                  <form onSubmit={handleAddRevision} className="space-y-4">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                        Perihal Surat
                      </label>
                      <input
                        type="text"
                        required
                        value={editSubject}
                        onChange={(e) => setEditSubject(e.target.value)}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-brand-500 focus:outline-none"
                      />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                          Nama Penerima
                        </label>
                        <input
                          type="text"
                          required
                          value={editRecipient}
                          onChange={(e) => setEditRecipient(e.target.value)}
                          className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-brand-500 focus:outline-none"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                          Klasifikasi
                        </label>
                        <select
                          value={editClassification}
                          onChange={(e) => setEditClassification(e.target.value as "PUBLIC" | "INTERNAL" | "CONFIDENTIAL")}
                          className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-brand-500 focus:outline-none"
                        >
                          <option value="INTERNAL">INTERNAL</option>
                          <option value="PUBLIC">PUBLIC</option>
                          <option value="CONFIDENTIAL">CONFIDENTIAL</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                          Tanggal Rencana
                        </label>
                        <input
                          type="date"
                          required
                          value={editPlannedDate}
                          onChange={(e) => setEditPlannedDate(e.target.value)}
                          className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-brand-500 focus:outline-none"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                        Isi Pokok Surat
                      </label>
                      <textarea
                        rows={7}
                        required
                        value={editBodyText}
                        onChange={(e) => setEditBodyText(e.target.value)}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-brand-500 focus:outline-none"
                      ></textarea>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                        Ringkasan Perubahan Versi Ini
                      </label>
                      <input
                        type="text"
                        value={editChangeSummary}
                        onChange={(e) => setEditChangeSummary(e.target.value)}
                        placeholder="Contoh: Menambahkan klausul waktu pelaksanaan dan daftar lampiran"
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-brand-500 focus:outline-none"
                      />
                    </div>

                    <div className="pt-3 border-t border-slate-200 flex justify-end">
                      <button
                        type="submit"
                        disabled={actionLoading}
                        className="inline-flex items-center gap-1.5 bg-brand-700 hover:bg-brand-800 text-white font-semibold px-4 py-2 rounded-lg text-xs shadow-sm transition-all disabled:opacity-50"
                      >
                        <Save className="w-4 h-4" />
                        <span>{actionLoading ? "Menyimpan..." : `Simpan sebagai Revisi v${letter.currentRevisionNo + 1}`}</span>
                      </button>
                    </div>
                  </form>
                )}
              </div>
            </div>

            {/* Right 1 Col: Immutable Revision History */}
            <div className="space-y-4">
              <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-5">
                <div className="flex items-center justify-between pb-3 border-b border-slate-200 mb-4">
                  <div className="flex items-center gap-2">
                    <History className="w-4 h-4 text-brand-700" />
                    <h2 className="text-sm font-bold text-slate-900">Riwayat Revisi (Immutable)</h2>
                  </div>
                  <span className="text-[11px] text-slate-500 font-semibold">{revisions.length} Versi</span>
                </div>

                <div className="space-y-3">
                  {revisions.map((rev) => (
                    <div
                      key={rev.id}
                      className={`p-3.5 rounded-lg border text-xs transition-all ${
                        rev.version === letter.currentRevisionNo
                          ? "bg-brand-50/60 border-brand-300"
                          : "bg-slate-50 border-slate-200"
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="font-bold text-slate-900 flex items-center gap-1.5">
                          <span className="font-mono bg-white px-1.5 py-0.5 rounded border border-slate-300 text-[10px]">
                            v{rev.version}
                          </span>
                          {rev.version === letter.currentRevisionNo && (
                            <span className="text-[9px] bg-brand-600 text-white px-1 rounded uppercase tracking-wider font-extrabold">
                              Terkini
                            </span>
                          )}
                        </span>
                        <span className="text-[10px] text-slate-500">
                          {new Date(rev.createdAt).toLocaleString("id-ID")}
                        </span>
                      </div>

                      <div className="text-slate-800 font-medium mb-1">
                        {rev.changeSummary || "Pembaruan isi surat"}
                      </div>

                      <div className="text-[11px] text-slate-500 mb-2">
                        Oleh: <strong>{rev.createdByName || "Staf"}</strong>
                      </div>

                      {/* Content SHA-256 Hash Display */}
                      <div className="bg-white p-1.5 rounded border border-slate-200 font-mono text-[9px] text-slate-600 break-all flex items-start gap-1">
                        <Hash className="w-3 h-3 text-slate-400 shrink-0 mt-0.5" />
                        <div>
                          <span className="text-slate-400">SHA256: </span>
                          {rev.contentSha256}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
