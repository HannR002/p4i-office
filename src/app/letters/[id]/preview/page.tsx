"use client";

import React, { useState, useEffect, use } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, ShieldAlert, Printer, AlertTriangle } from "lucide-react";

interface LetterDetail {
  id: string;
  letterTypeLabel: string;
  subject: string;
  recipientName: string;
  classification: string;
  plannedDate: string;
  status: string;
  currentRevisionNo: number;
  officialNumber: string | null;
  authorName: string;
}

interface LetterRevision {
  id: string;
  version: number;
  subject: string;
  recipientName: string;
  plannedDate: string;
  content: {
    bodyText?: string;
    notes?: string;
  };
  contentSha256: string;
  createdAt: string;
}

interface Organization {
  legalName: string;
  acronym: string;
  addressPlaceholder: string;
}

export default function LetterPreviewPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const resolvedParams = use(params);
  const router = useRouter();

  const [letter, setLetter] = useState<LetterDetail | null>(null);
  const [currentRev, setCurrentRev] = useState<LetterRevision | null>(null);
  const [org, setOrg] = useState<Organization | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/letters/${resolvedParams.id}`)
      .then((res) => {
        if (!res.ok) router.push("/letters");
        return res.json();
      })
      .then((data) => {
        setLetter(data.letter);
        setOrg(data.organization);
        if (data.revisions && data.revisions.length > 0) {
          setCurrentRev(data.revisions[data.revisions.length - 1]);
        }
      })
      .catch(() => router.push("/letters"))
      .finally(() => setLoading(false));
  }, [resolvedParams.id, router]);

  if (loading || !letter || !currentRev) {
    return <div className="p-8 text-center text-sm text-slate-500">Menyiapkan pratinjau draf surat...</div>;
  }

  return (
    <div className="min-h-screen bg-slate-200 py-8 px-4 flex flex-col items-center">
      {/* Top Action Bar */}
      <div className="w-full max-w-4xl bg-slate-900 text-white rounded-xl p-4 shadow-lg mb-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link
            href={`/letters/${letter.id}`}
            className="inline-flex items-center gap-1.5 text-xs text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 px-3 py-1.5 rounded-lg transition-colors font-medium"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Kembali ke Detail Draf
          </Link>

          <span className="text-xs text-amber-400 font-semibold flex items-center gap-1">
            <ShieldAlert className="w-4 h-4 text-amber-400" />
            Pratinjau Nonresmi (Revisi v{letter.currentRevisionNo})
          </span>
        </div>

        <button
          onClick={() => window.print()}
          className="inline-flex items-center gap-1.5 bg-brand-600 hover:bg-brand-700 text-white px-3.5 py-1.5 rounded-lg text-xs font-semibold shadow-sm transition-colors"
        >
          <Printer className="w-3.5 h-3.5" />
          Cetak Dokumen
        </button>
      </div>

      {/* Sheet of Paper Container */}
      <div className="relative w-full max-w-4xl bg-white rounded-lg shadow-2xl p-12 md:p-16 text-slate-900 border border-slate-300 min-h-[1050px] overflow-hidden">
        {/* PROMINENT WATERMARK: DRAF — BELUM RESMI */}
        <div className="draft-watermark">
          DRAF — BELUM RESMI
        </div>

        {/* Top Unverified Header Warning Banner */}
        <div className="mb-6 p-2 bg-amber-50 border border-dashed border-amber-300 rounded text-center text-[11px] text-amber-900 font-semibold uppercase tracking-wider">
          PERINGATAN: KOP DAN IDENTITAS RESMI BELUM DIVERIFIKASI PENGURUS (D-05) • BUKAN SURAT RESMI
        </div>

        {/* Header / Kop Placeholder */}
        <div className="text-center pb-6 border-b-4 border-double border-slate-900 mb-8">
          <h2 className="text-xl font-black uppercase tracking-wider text-slate-950">
            {org?.legalName || "YAYASAN PUSAT PENDIDIKAN DAN PENELITIAN PEMBANGUNAN INDONESIA"}
          </h2>
          <div className="text-xs font-bold tracking-widest text-brand-900 mt-1">
            {org?.acronym || "YAYASAN P4I"} — SEKRETARIAT PUSAT
          </div>
          <div className="text-[11px] text-slate-500 italic mt-1">
            [Alamat resmi, nomor kontak, website dan logo resmi masih menunggu penetapan Pengurus]
          </div>
        </div>

        {/* Letter Metadata Header */}
        <div className="flex justify-between items-start text-xs mb-8">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-slate-600 w-20">Nomor</span>
              <span>:</span>
              <span className="font-mono font-bold text-rose-700 bg-rose-50 px-2 py-0.5 rounded border border-rose-200">
                [BELUM RESMI — NOMOR BELUM DITERBITKAN]
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="font-semibold text-slate-600 w-20">Lampiran</span>
              <span>:</span>
              <span>- (Nihil)</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="font-semibold text-slate-600 w-20">Perihal</span>
              <span>:</span>
              <span className="font-bold text-slate-900">{letter.subject}</span>
            </div>
          </div>

          <div className="text-right space-y-1">
            <div className="text-slate-700 font-medium">
              Jakarta, {currentRev.plannedDate}
            </div>
            <div className="text-[11px] text-slate-500">
              Klasifikasi: <strong className="uppercase">{letter.classification}</strong>
            </div>
          </div>
        </div>

        {/* Recipient */}
        <div className="text-xs mb-8">
          <div className="text-slate-600">Kepada Yth.</div>
          <div className="font-bold text-sm text-slate-950 mt-0.5">{letter.recipientName}</div>
          <div className="text-slate-600">di Tempat</div>
        </div>

        {/* Letter Body */}
        <div className="text-xs text-slate-800 leading-relaxed space-y-4 mb-12 whitespace-pre-wrap">
          {currentRev.content?.bodyText || (
            <span className="text-slate-400 italic">[Isi pokok surat belum diisi]</span>
          )}
        </div>

        {/* Closing */}
        <div className="text-xs text-slate-800 mb-16">
          Demikian draf surat ini dibuat untuk dapat diperiksa sesuai ketentuan administrasi internal Yayasan P4I.
        </div>

        {/* Signatory Area with Prominent Disabled Banner */}
        <div className="flex justify-end text-xs">
          <div className="w-72 text-center">
            <div className="text-slate-700 font-medium">Atas Nama Pengurus Yayasan P4I</div>
            <div className="text-slate-500 text-[11px] mb-4">Pejabat Berwenang</div>

            {/* Blocked Signature Box */}
            <div className="h-24 border-2 border-dashed border-rose-300 rounded-lg bg-rose-50/70 p-2 flex flex-col justify-center items-center text-[10px] text-rose-800">
              <AlertTriangle className="w-4 h-4 text-rose-600 mb-1" />
              <div className="font-bold">PENANDATANGANAN DIBLOKIR</div>
              <div className="text-[9px] text-center text-rose-600 mt-0.5">
                Menunggu Matriks Mandat & Bukti SK Sah (SRS v1.0 K-03)
              </div>
            </div>

            <div className="mt-4 pt-2 border-t border-slate-300 font-bold text-slate-700">
              ( Nama Pejabat Belum Diverifikasi )
            </div>
          </div>
        </div>

        {/* Document Footer Verification */}
        <div className="absolute bottom-6 left-12 right-12 pt-3 border-t border-slate-200 flex justify-between items-center text-[9px] text-slate-400 font-mono">
          <div>P4I-OFFICE-SPRINT-1A • DRAF REVISI v{currentRev.version}</div>
          <div>SHA256: {currentRev.contentSha256.substring(0, 24)}...</div>
        </div>
      </div>
    </div>
  );
}
