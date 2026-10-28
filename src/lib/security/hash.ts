import crypto from "crypto";

/**
 * Menghasilkan hash SHA-256 deterministik dari objek konten revisi surat.
 * Digunakan untuk menjamin immutability (tidak dapat dimanipulasi diam-diam).
 */
export function calculateContentHash(content: unknown): string {
  // Sortir keys secara rekursif agar JSON serialization bersifat deterministik
  const canonicalJson = canonicalizeJson(content);
  return crypto.createHash("sha256").update(canonicalJson).digest("hex");
}

function canonicalizeJson(obj: unknown): string {
  if (obj === null || typeof obj !== "object") {
    return JSON.stringify(obj);
  }

  if (Array.isArray(obj)) {
    return "[" + obj.map(canonicalizeJson).join(",") + "]";
  }

  const sortedKeys = Object.keys(obj as Record<string, unknown>).sort();
  const pairs = sortedKeys.map((key) => {
    const val = (obj as Record<string, unknown>)[key];
    return `${JSON.stringify(key)}:${canonicalizeJson(val)}`;
  });

  return "{" + pairs.join(",") + "}";
}
