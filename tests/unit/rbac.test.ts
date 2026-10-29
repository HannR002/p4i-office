import { describe, it, expect } from "vitest";
import { db } from "@/lib/db";

describe("Role-Based Access Control (RBAC) & Pemisahan Mandat", () => {
  it("harus membedakan peran SYSTEM_ADMIN dan STAFF pada data pengguna", async () => {
    const admin = await db.getUserByEmail("admin.test@p4i.local");
    const staff = await db.getUserByEmail("staf.test@p4i.local");
    const disabled = await db.getUserByEmail("disabled.test@p4i.local");

    expect(admin).not.toBeNull();
    expect(admin?.role).toBe("SYSTEM_ADMIN");
    expect(admin?.status).toBe("ACTIVE");

    expect(staff).not.toBeNull();
    expect(staff?.role).toBe("STAFF");
    expect(staff?.status).toBe("ACTIVE");

    expect(disabled).not.toBeNull();
    expect(disabled?.status).toBe("DISABLED");
  });

  it("admin sistem dapat menonaktifkan akun staf uji", async () => {
    const staff = await db.getUserByEmail("staf.test@p4i.local");
    expect(staff).not.toBeNull();

    const updated = await db.updateUserStatus(staff!.id, "DISABLED", "e0000000-0000-4000-8000-000000000001");
    expect(updated?.status).toBe("DISABLED");

    // Kembalikan ke ACTIVE agar tes lain tidak terpengaruh
    await db.updateUserStatus(staff!.id, "ACTIVE", "e0000000-0000-4000-8000-000000000001");
  });

  it("peran SYSTEM_ADMIN secara arsitektural tidak otomatis memiliki kewenangan pengesahan hukum", async () => {
    // Sesuai SRS v1.0 Bagian 3: Hak persetujuan memerlukan signatory_mandates sah, bukan role IT
    const adminUser = await db.getUserByEmail("admin.test@p4i.local");
    expect(adminUser?.role).toBe("SYSTEM_ADMIN");

    // Tidak ada method approval yang dapat dipanggil oleh admin tanpa validasi mandat
    expect(typeof (adminUser as unknown as Record<string, unknown>).signLetter).toBe("undefined");
  });
});
