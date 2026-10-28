"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Navbar } from "@/components/Navbar";
import { Sidebar } from "@/components/Sidebar";
import { FilePlus2, ArrowLeft, AlertCircle, Save, ShieldAlert } from "lucide-react";

interface LetterType {
  id: string;
  code: string;
  label: string;
}

interface UserSession {
  id: string;
  displayName: string;
  email: string;
  role: string;
}

export default function NewLetterPage() {
  const router = useRouter();
  const [user, setUser] = useState<UserSession | null>(null);
  const [letterTypes, setLetterTypes] = useState<LetterType[]>([]);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const [letterTypeId, setLetterTypeId] = useState("");
  const [subject, setSubject] = useState("");
  const [recipientName, setRecipientName] = useState("");
  const [classification, setClassification] = useState<"PUBLIC" | "INTERNAL" | "CONFIDENTIAL">("INTERNAL");
  const [plannedDate, setPlannedDate] = useState(new Date().toISOString().split("T")[0]);
  const [bodyText, setBodyText] = useState("");
  const [notes, setNotes] = useState("");

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

    fetch("/api/letter-types")
      .then((res) => res.json())
      .then((data) => {
        if (data.types) {
          setLetterTypes(data.types);
          if (data.types.length > 0) setLetterTypeId(data.types[0].id);
        }
      });
  }, [router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg("");

    try {
      const res = await fetch("/api/letters", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          letterTypeId,
          subject,
          recipientName,
          classification,
          plannedDate,
          content: {
            bodyText,
            notes,
          },
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        setErrorMsg(data.message || "Gagal membuat draf surat.");
      } else {
        router.push(`/letters/${data.letter.id}`);
      }
    } catch {
      setErrorMsg("Koneksi gagal saat menghubungi server.");
    } finally {
      setLoading(false);
    }
  };

  if (!user) {
    return <div className="p-8 text-center text-sm text-slate-500">Memuat sesi pengguna...</div>;
  }

  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      <Navbar user={user} />

      <div className="flex flex-1">
        <Sidebar userRole={user.role} />

        <main className="flex-1 p-6 max-w-4xl">
          <div className="mb-6 flex items-center justify-between">
            <div>
              <Link
                href="/letters"
                className="inline-flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-800 font-semibold mb-2"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                Kembali ke Daftar Draf
              </Link>
              <h1 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
                <FilePlus2 className="w-5 h-5 text-brand-700" />
                Buat Draf Surat Baru
              </h1>
              <p className="text-xs text-slate-500 mt-0.5">
                Surat yang dibuat berstatus DRAF dan TIDAK menerima nomor resmi.
              </p>
            </div>
          </div>

          <div className="mb-5 bg-amber-50 border border-amber-200 rounded-xl p-3.5 flex items-start gap-2 text-xs text-amber-900">
            <ShieldAlert className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <strong>Ketentuan Sprint 1A:</strong> Formulir ini membuat draf revisi ke-1 (v1). Konten draf akan dihitung hash SHA-256 untuk menjamin integritas revisi secara permanen.
            </div>
          </div>

          {errorMsg && (
            <div className="mb-5 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <div>{errorMsg}</div>
            </div>
          )}

          <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-6">
            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                    Jenis Surat Wajib <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={letterTypeId}
                    onChange={(e) => setLetterTypeId(e.target.value)}
                    required
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-brand-500 focus:outline-none"
                  >
                    {letterTypes.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.label} ({t.code})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                    Klasifikasi Dokumen <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={classification}
                    onChange={(e) => setClassification(e.target.value as "PUBLIC" | "INTERNAL" | "CONFIDENTIAL")}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-brand-500 focus:outline-none"
                  >
                    <option value="INTERNAL">INTERNAL (Hanya Lingkup Yayasan P4I)</option>
                    <option value="PUBLIC">PUBLIC (Surat Keluar Terbuka)</option>
                    <option value="CONFIDENTIAL">CONFIDENTIAL (Rahasia Pengurus)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                  Perihal Surat <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder="Contoh: Keterangan Selesai Magang Riset Kebijakan Publik"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-brand-500 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                    Nama Penerima / Instansi Tujuan <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={recipientName}
                    onChange={(e) => setRecipientName(e.target.value)}
                    placeholder="Contoh: Sdr. Budi Santoso / Universitas Indonesia"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-brand-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                    Tanggal Rencana Surat <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="date"
                    required
                    value={plannedDate}
                    onChange={(e) => setPlannedDate(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-brand-500 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                  Isi Pokok Surat (Parameter Templat) <span className="text-rose-500">*</span>
                </label>
                <textarea
                  rows={6}
                  required
                  value={bodyText}
                  onChange={(e) => setBodyText(e.target.value)}
                  placeholder="Tuliskan isi pokok surat, dasar penugasan, atau rincian keterangan..."
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-brand-500 focus:outline-none"
                ></textarea>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                  Catatan Internal Pembuat (Opsional)
                </label>
                <input
                  type="text"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Catatan tambahan untuk reviewer atau lampiran pendukung"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-brand-500 focus:outline-none"
                />
              </div>

              <div className="pt-4 border-t border-slate-200 flex justify-end gap-3">
                <Link
                  href="/letters"
                  className="px-4 py-2 border border-slate-300 text-slate-700 hover:bg-slate-50 rounded-lg text-xs font-medium"
                >
                  Batal
                </Link>
                <button
                  type="submit"
                  disabled={loading}
                  className="inline-flex items-center gap-1.5 bg-brand-700 hover:bg-brand-800 text-white font-semibold px-4 py-2 rounded-lg text-xs shadow-sm disabled:opacity-50"
                >
                  <Save className="w-4 h-4" />
                  <span>{loading ? "Menyimpan Draf..." : "Simpan Draf (v1)"}</span>
                </button>
              </div>
            </form>
          </div>
        </main>
      </div>
    </div>
  );
}
