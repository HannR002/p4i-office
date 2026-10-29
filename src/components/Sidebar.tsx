"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { 
  LayoutDashboard, 
  Mail, 
  FilePlus2, 
  FileSpreadsheet, 
  Users, 
  Settings,
  ShieldAlert,
  CheckCircle2,
  Award
} from "lucide-react";

interface SidebarProps {
  userRole?: string;
}

export function Sidebar({ userRole }: SidebarProps) {
  const pathname = usePathname();

  const navItems = [
    { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
    { href: "/letters", label: "Surat Keluar (Draf)", icon: Mail },
    { href: "/letters/new", label: "Buat Draf Baru", icon: FilePlus2 },
    { href: "/approvals", label: "Antrean Pemeriksaan", icon: CheckCircle2 },
    { href: "/mandates", label: "Mandat Pejabat", icon: Award },
    { href: "/templates", label: "Katalog Templat", icon: FileSpreadsheet },
    { href: "/users", label: "Pengguna & Peran", icon: Users, adminOnly: true },
    { href: "/settings", label: "Pengaturan & Kebijakan", icon: Settings },
  ];

  return (
    <aside className="w-64 bg-white border-r border-slate-200 min-h-[calc(100vh-80px)] p-4 flex flex-col justify-between shrink-0">
      <nav className="space-y-1.5">
        <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400 px-3 py-1">
          Menu Utama Persuratan
        </div>

        {navItems.map((item) => {
          const isActive = pathname === item.href || (item.href !== "/dashboard" && pathname.startsWith(item.href));
          const isAdminRestricted = item.adminOnly && userRole !== "SYSTEM_ADMIN";

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center justify-between px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                isActive
                  ? "bg-brand-50 text-brand-800 border border-brand-200 shadow-xs"
                  : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
              }`}
            >
              <div className="flex items-center gap-2.5">
                <item.icon className={`w-4 h-4 ${isActive ? "text-brand-700" : "text-slate-500"}`} />
                <span>{item.label}</span>
              </div>
              {item.adminOnly && (
                <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold uppercase ${
                  isAdminRestricted ? "bg-slate-100 text-slate-400" : "bg-purple-100 text-purple-700 border border-purple-200"
                }`}>
                  Admin
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 text-xs text-amber-900 space-y-1.5">
        <div className="flex items-center gap-1.5 font-bold text-amber-950">
          <ShieldAlert className="w-3.5 h-3.5 text-amber-700" />
          <span>Sprint 2: Alur Persetujuan</span>
        </div>
        <p className="text-[11px] leading-relaxed text-amber-800">
          Persetujuan draf aktif mengikat hash & mandat. Penomoran resmi dan penandatanganan final tetap OFF demi integritas tata kelola.
        </p>
      </div>
    </aside>
  );
}
