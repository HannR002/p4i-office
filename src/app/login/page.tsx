"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { FileText, ShieldAlert, KeyRound, AlertCircle, ArrowRight } from "lucide-react";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg("");

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        setErrorMsg(data.message || "Gagal masuk.");
      } else {
        router.push("/dashboard");
        router.refresh();
      }
    } catch {
      setErrorMsg("Koneksi gagal atau server tidak merespons.");
    } finally {
      setLoading(false);
    }
  };

  const setTestAccount = (testEmail: string) => {
    setEmail(testEmail);
    setPassword("Password123!");
    setErrorMsg("");
  };

  return (
    <div className="min-h-screen flex flex-col justify-center items-center p-4 bg-gradient-to-b from-slate-100 to-slate-200">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden">
        {/* Header */}
        <div className="bg-slate-900 text-white p-6 text-center">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-brand-600 text-white shadow-lg mb-3">
            <FileText className="w-8 h-8" />
          </div>
          <h1 className="text-xl font-bold tracking-tight">P4I OFFICE v1.0</h1>
          <p className="text-xs text-slate-400 mt-1">
            Sistem Persuratan & Administrasi Internal Yayasan P4I
          </p>
        </div>

        {/* Safety Warning */}
        <div className="bg-amber-50 border-b border-amber-200 px-4 py-2.5 flex items-start gap-2 text-xs text-amber-900">
          <ShieldAlert className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
          <div>
            <strong>Lingkungan Pengujian Sprint 1A:</strong> Nomor resmi & penandatanganan dikunci OFF sampai verifikasi register lama dan persetujuan pengurus selesai.
          </div>
        </div>

        {/* Form */}
        <div className="p-6">
          {errorMsg && (
            <div className="mb-5 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <div>{errorMsg}</div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                Alamat Email Pengguna
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="nama@p4i.local"
                className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent transition-all"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                Kata Sandi
              </label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••••••"
                className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent transition-all"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-brand-700 hover:bg-brand-800 text-white font-semibold py-2.5 px-4 rounded-lg text-sm shadow-md transition-all flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {loading ? "Memverifikasi..." : "Masuk ke Sistem"}
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>

          {/* Test Credentials Helper */}
          <div className="mt-6 pt-5 border-t border-slate-200">
            <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2 flex items-center gap-1.5">
              <KeyRound className="w-3.5 h-3.5" />
              <span>Akun Pengujian Cepat (Test Fixtures)</span>
            </div>
            <div className="grid grid-cols-1 gap-1.5 text-xs">
              <button
                type="button"
                onClick={() => setTestAccount("admin.test@p4i.local")}
                className="text-left px-3 py-2 bg-slate-50 hover:bg-slate-100 rounded-lg border border-slate-200 transition-colors flex justify-between items-center"
              >
                <div>
                  <span className="font-semibold text-slate-800">admin.test@p4i.local</span>
                  <div className="text-[10px] text-slate-500">Peran: Administrator Sistem</div>
                </div>
                <span className="text-[10px] bg-purple-100 text-purple-800 px-1.5 py-0.5 rounded font-bold">ADMIN</span>
              </button>

              <button
                type="button"
                onClick={() => setTestAccount("staf.test@p4i.local")}
                className="text-left px-3 py-2 bg-slate-50 hover:bg-slate-100 rounded-lg border border-slate-200 transition-colors flex justify-between items-center"
              >
                <div>
                  <span className="font-semibold text-slate-800">staf.test@p4i.local</span>
                  <div className="text-[10px] text-slate-500">Peran: Staf Administrasi</div>
                </div>
                <span className="text-[10px] bg-blue-100 text-blue-800 px-1.5 py-0.5 rounded font-bold">STAFF</span>
              </button>

              <button
                type="button"
                onClick={() => setTestAccount("disabled.test@p4i.local")}
                className="text-left px-3 py-2 bg-rose-50 hover:bg-rose-100 rounded-lg border border-rose-200 transition-colors flex justify-between items-center"
              >
                <div>
                  <span className="font-semibold text-rose-900">disabled.test@p4i.local</span>
                  <div className="text-[10px] text-rose-600">Peran: Staf (Status: DISABLED)</div>
                </div>
                <span className="text-[10px] bg-rose-200 text-rose-900 px-1.5 py-0.5 rounded font-bold">NONAKTIF</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
