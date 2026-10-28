import { describe, it, expect, beforeEach } from "vitest";
import bcrypt from "bcryptjs";
import { calculateContentHash } from "@/lib/security/hash";
import { sanitizeString, sanitizeObject } from "@/lib/security/sanitization";
import { checkLoginRateLimit, recordLoginAttempt, clearLoginRateLimit } from "@/lib/security/rate-limit";
import { signSessionToken, verifySessionToken } from "@/lib/security/session";

describe("Keamanan & Kriptografi Fondasi (Security Foundation)", () => {
  it("harus melakukan hashing kata sandi dan verifikasi secara benar", async () => {
    const password = "Password123!";
    const hash = await bcrypt.hash(password, 10);

    expect(hash).not.toBe(password);
    expect(await bcrypt.compare(password, hash)).toBe(true);
    expect(await bcrypt.compare("WrongPassword", hash)).toBe(false);
  });

  it("harus menghasilkan SHA-256 hash deterministik dari isi konten revisi", () => {
    const content1 = { subject: "Uji", date: "2026-10-28", body: "Teks isi surat" };
    const content2 = { date: "2026-10-28", body: "Teks isi surat", subject: "Uji" }; // Order berbeda

    const hash1 = calculateContentHash(content1);
    const hash2 = calculateContentHash(content2);

    expect(hash1).toBe(hash2);
    expect(hash1).toHaveLength(64); // SHA-256 hex string

    // Jika konten berubah, hash harus berubah
    const hashModified = calculateContentHash({ ...content1, body: "Teks diubah" });
    expect(hashModified).not.toBe(hash1);
  });

  it("harus melakukan sanitasi karakter berbahaya / XSS pada string dan objek", () => {
    const dangerousInput = "<script>alert('xss')</script>";
    const sanitized = sanitizeString(dangerousInput);
    expect(sanitized).not.toContain("<script>");
    expect(sanitized).toContain("&lt;script&gt;");

    const complexObj = {
      title: "Judul <b>tebal</b>",
      nested: {
        payload: "<img src=x onerror=alert(1)>",
      },
    };
    const sanitizedObj = sanitizeObject(complexObj);
    expect(sanitizedObj.title).toBe("Judul &lt;b&gt;tebal&lt;&#x2F;b&gt;");
    expect(sanitizedObj.nested.payload).toContain("&lt;img");
  });

  it("harus membatasi frekuensi login (rate limiting)", () => {
    const testKey = "test-ip-rate-limit-check";
    clearLoginRateLimit(testKey);

    // 5 percobaan pertama diizinkan
    for (let i = 0; i < 5; i++) {
      const check = checkLoginRateLimit(testKey, 5, 300);
      expect(check.success).toBe(true);
      recordLoginAttempt(testKey);
    }

    // Percobaan ke-6 harus ditolak
    const blockedCheck = checkLoginRateLimit(testKey, 5, 300);
    expect(blockedCheck.success).toBe(false);
    expect(blockedCheck.remaining).toBe(0);
    expect(blockedCheck.resetSeconds).toBeGreaterThan(0);

    // Setelah dibersihkan, harus berhasil kembali
    clearLoginRateLimit(testKey);
    expect(checkLoginRateLimit(testKey, 5, 300).success).toBe(true);
  });

  it("harus menolak sesi akun yang berstatus DISABLED", async () => {
    const activeUser = {
      id: "usr-active",
      organizationId: "org-p4i",
      email: "active@p4i.local",
      displayName: "Pengguna Aktif",
      role: "STAFF" as const,
      status: "ACTIVE" as const,
    };

    const disabledUser = {
      id: "usr-disabled",
      organizationId: "org-p4i",
      email: "disabled@p4i.local",
      displayName: "Pengguna Nonaktif",
      role: "STAFF" as const,
      status: "DISABLED" as const,
    };

    const activeToken = await signSessionToken(activeUser);
    const verifiedActive = await verifySessionToken(activeToken);
    expect(verifiedActive).not.toBeNull();
    expect(verifiedActive?.email).toBe(activeUser.email);

    const disabledToken = await signSessionToken(disabledUser);
    const verifiedDisabled = await verifySessionToken(disabledToken);
    // KEAMANAN KRITIS: Akun disabled harus bernilai null (ditolak)
    expect(verifiedDisabled).toBeNull();
  });
});
