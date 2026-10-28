import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";

export const SESSION_COOKIE_NAME = "p4i_office_session";

export interface SessionUser {
  id: string;
  organizationId: string;
  email: string;
  displayName: string;
  role: "SYSTEM_ADMIN" | "STAFF";
  status: "ACTIVE" | "DISABLED" | "INVITED";
}

function getJwtSecret(): Uint8Array {
  const secret = process.env.SESSION_SECRET || "default_local_dev_secret_key_32_characters_minimum!";
  return new TextEncoder().encode(secret);
}

/**
 * Membuat token JWT sesi aman berjangka waktu (default 8 jam).
 */
export async function signSessionToken(user: SessionUser): Promise<string> {
  const secret = getJwtSecret();
  return await new SignJWT({
    sub: user.id,
    org: user.organizationId,
    email: user.email,
    name: user.displayName,
    role: user.role,
    status: user.status,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("8h")
    .sign(secret);
}

/**
 * Memverifikasi integritas token sesi JWT.
 * MENOLAK jika akun berstatus bukan ACTIVE.
 */
export async function verifySessionToken(token: string): Promise<SessionUser | null> {
  try {
    const secret = getJwtSecret();
    const { payload } = await jwtVerify(token, secret);

    const status = payload.status as SessionUser["status"];
    // KEAMANAN KETAT: Akun berstatus selain ACTIVE (misal: DISABLED) langsung ditolak
    if (status !== "ACTIVE") {
      return null;
    }

    return {
      id: payload.sub as string,
      organizationId: payload.org as string,
      email: payload.email as string,
      displayName: payload.name as string,
      role: payload.role as SessionUser["role"],
      status,
    };
  } catch {
    return null;
  }
}

/**
 * Membaca pengguna sesi dari cookie request Next.js saat ini.
 */
export async function getCurrentUser(): Promise<SessionUser | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  if (!token) {
    return null;
  }
  return await verifySessionToken(token);
}
