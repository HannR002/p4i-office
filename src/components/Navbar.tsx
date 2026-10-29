"use client";

import React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { LogOut, ShieldAlert, FileText, User } from "lucide-react";

interface NavbarProps {
  user?: {
    displayName: string;
    email: string;
    role: string;
  } | null;
}

export function Navbar({ user }: NavbarProps) {
  const router = useRouter();

  const handleLogout = async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
      router.push("/login");
      router.refresh();
    } catch {
      router.push("/login");
    }
  };

  return (
    <header className="sticky top-0 z-40 bg-white border-b border-slate-200 shadow-sm">
      {/* Top Banner Safety Guard Sprint 2 */}
      <div className="bg-amber-500 text-slate-950 px-4 py-1 text-xs font-medium flex items-center justify-between">
        <div className="flex items-center gap-1.5 container mx-auto">
          <ShieldAlert className="w-3.5 h-3.5 text-slate-950" />
          <span>
            <strong>MODE SPRINT 2:</strong> Alur Persetujuan & Mandat Pejabat • Penomoran resmi OFF • Tanda tangan final OFF • Pratinjau draf berlabel nonresmi
          </span>
        </div>
      </div>

      <div className="container mx-auto px-4 py-3 flex items-center justify-between">
        <Link href="/dashboard" className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-lg bg-brand-800 text-white flex items-center justify-center font-bold text-lg shadow-sm">
            <FileText className="w-5 h-5 text-white" />
          </div>
          <div>
            <div className="font-extrabold text-slate-900 leading-none text-base tracking-tight">
              P4I OFFICE <span className="text-xs font-semibold text-brand-600 bg-brand-50 px-1.5 py-0.5 rounded border border-brand-200 ml-1">v1.0</span>
            </div>
            <div className="text-xs text-slate-500 leading-tight mt-0.5">
              Yayasan Pusat Pendidikan & Penelitian Pembangunan Indonesia
            </div>
          </div>
        </Link>

        {user && (
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-lg text-xs">
              <User className="w-3.5 h-3.5 text-slate-500" />
              <div>
                <span className="font-semibold text-slate-800">{user.displayName}</span>
                <span className="ml-1.5 px-1.5 py-0.2 rounded text-[10px] font-bold uppercase tracking-wider bg-slate-200 text-slate-700">
                  {user.role === "SYSTEM_ADMIN" ? "Admin Sistem" : user.role === "REVIEWER" ? "Reviewer Pejabat" : "Staf"}
                </span>
              </div>
            </div>

            <button
              onClick={handleLogout}
              className="inline-flex items-center gap-1.5 text-xs text-rose-600 hover:text-rose-800 hover:bg-rose-50 px-2.5 py-1.5 rounded-md transition-colors border border-transparent hover:border-rose-200 font-medium"
              title="Keluar dari sistem"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Keluar</span>
            </button>
          </div>
        )}
      </div>
    </header>
  );
}
