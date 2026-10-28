import bcrypt from "bcryptjs";
import { calculateContentHash } from "@/lib/security/hash";
import { logAuditEvent } from "@/lib/audit";

export interface UserRecord {
  id: string;
  organizationId: string;
  unitId?: string;
  email: string;
  displayName: string;
  passwordHash: string;
  status: "ACTIVE" | "DISABLED" | "INVITED";
  role: "SYSTEM_ADMIN" | "STAFF";
  createdAt: string;
}

export interface OrganizationRecord {
  id: string;
  legalName: string;
  acronym: string;
  addressPlaceholder: string;
  isVerified: boolean;
}

export interface LetterTypeRecord {
  id: string;
  organizationId: string;
  code: string;
  label: string;
  priority: "P0" | "P1";
  isActive: boolean;
  numberingPolicyActive: boolean;
}

export interface LetterRevisionRecord {
  id: string;
  letterId: string;
  version: number;
  subject: string;
  recipientName: string;
  classification: "PUBLIC" | "INTERNAL" | "CONFIDENTIAL";
  plannedDate: string;
  content: Record<string, unknown>;
  contentSha256: string;
  changeSummary?: string;
  createdBy: string;
  createdByName?: string;
  createdAt: string;
}

export interface LetterRecord {
  id: string;
  organizationId: string;
  unitId?: string;
  letterTypeId: string;
  letterTypeCode: string;
  letterTypeLabel: string;
  authorId: string;
  authorName: string;
  subject: string;
  recipientName: string;
  classification: "PUBLIC" | "INTERNAL" | "CONFIDENTIAL";
  plannedDate: string;
  status: "DRAFT" | "IN_REVIEW" | "RETURNED" | "REVIEWED" | "APPROVED" | "NUMBERED" | "VOIDED";
  currentRevisionNo: number;
  officialNumber: null; // Strictly null in Sprint 1A
  createdAt: string;
  updatedAt: string;
}

// In-Memory Database Store dengan isolasi organisasi dan seeded test fixtures
class LocalDatabaseStore {
  private organization: OrganizationRecord;
  private users: Map<string, UserRecord> = new Map();
  private letterTypes: Map<string, LetterTypeRecord> = new Map();
  private letters: Map<string, LetterRecord> = new Map();
  private revisions: Map<string, LetterRevisionRecord[]> = new Map();

  constructor() {
    this.organization = {
      id: "org-p4i-yayasan-001",
      legalName: "Yayasan Pusat Pendidikan dan Penelitian Pembangunan Indonesia",
      acronym: "Yayasan P4I",
      addressPlaceholder: "Kop dan identitas resmi belum diverifikasi pengurus",
      isVerified: false,
    };
    this.initSeeds();
  }

  private initSeeds() {
    const passwordHash = bcrypt.hashSync("Password123!", 10);

    const testUsers: UserRecord[] = [
      {
        id: "usr-admin-01",
        organizationId: this.organization.id,
        email: "admin.test@p4i.local",
        displayName: "Admin Sistem (Uji)",
        passwordHash,
        status: "ACTIVE",
        role: "SYSTEM_ADMIN",
        createdAt: new Date().toISOString(),
      },
      {
        id: "usr-staff-01",
        organizationId: this.organization.id,
        email: "staf.test@p4i.local",
        displayName: "Staf Administrasi (Uji)",
        passwordHash,
        status: "ACTIVE",
        role: "STAFF",
        createdAt: new Date().toISOString(),
      },
      {
        id: "usr-disabled-01",
        organizationId: this.organization.id,
        email: "disabled.test@p4i.local",
        displayName: "Staf Nonaktif (Uji)",
        passwordHash,
        status: "DISABLED",
        role: "STAFF",
        createdAt: new Date().toISOString(),
      },
    ];

    testUsers.forEach((u) => this.users.set(u.email.toLowerCase(), u));

    // Jenis surat dari SRS v1.0 dan P4I_Office_Paket_Sprint0.xlsx
    const types: LetterTypeRecord[] = [
      {
        id: "type-magang",
        organizationId: this.organization.id,
        code: "KET-MAGANG",
        label: "Surat Keterangan Selesai Magang",
        priority: "P0",
        isActive: true,
        numberingPolicyActive: false,
      },
      {
        id: "type-tugas",
        organizationId: this.organization.id,
        code: "TUGAS",
        label: "Surat Tugas",
        priority: "P0",
        isActive: true,
        numberingPolicyActive: false,
      },
      {
        id: "type-undangan",
        organizationId: this.organization.id,
        code: "UNDANGAN",
        label: "Surat Undangan",
        priority: "P0",
        isActive: true,
        numberingPolicyActive: false,
      },
      {
        id: "type-permohonan",
        organizationId: this.organization.id,
        code: "PERMOHONAN",
        label: "Surat Permohonan",
        priority: "P0",
        isActive: true,
        numberingPolicyActive: false,
      },
      {
        id: "type-pengantar",
        organizationId: this.organization.id,
        code: "PENGANTAR",
        label: "Surat Pengantar",
        priority: "P0",
        isActive: true,
        numberingPolicyActive: false,
      },
    ];

    types.forEach((t) => this.letterTypes.set(t.id, t));
  }

  // --- Users ---
  getUserByEmail(email: string): UserRecord | null {
    return this.users.get(email.toLowerCase()) || null;
  }

  getUserById(id: string): UserRecord | null {
    for (const u of this.users.values()) {
      if (u.id === id) return u;
    }
    return null;
  }

  getAllUsers(orgId: string): UserRecord[] {
    return Array.from(this.users.values()).filter((u) => u.organizationId === orgId);
  }

  updateUserStatus(userId: string, status: "ACTIVE" | "DISABLED", actorId: string): UserRecord | null {
    const user = this.getUserById(userId);
    if (!user) return null;
    user.status = status;

    logAuditEvent({
      organizationId: user.organizationId,
      actorId,
      eventType: "USER_STATUS_UPDATED",
      entityType: "user",
      entityId: userId,
      metadata: { newStatus: status },
    });

    return user;
  }

  // --- Organization & Types ---
  getOrganization(): OrganizationRecord {
    return this.organization;
  }

  getLetterTypes(orgId: string): LetterTypeRecord[] {
    return Array.from(this.letterTypes.values()).filter((t) => t.organizationId === orgId);
  }

  getLetterTypeById(typeId: string): LetterTypeRecord | null {
    return this.letterTypes.get(typeId) || null;
  }

  // --- Letters & Revisions ---
  getAllLetters(orgId: string, statusFilter?: string): LetterRecord[] {
    let list = Array.from(this.letters.values()).filter((l) => l.organizationId === orgId);
    if (statusFilter && statusFilter !== "ALL") {
      list = list.filter((l) => l.status === statusFilter);
    }
    return list.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  }

  getLetterById(letterId: string, orgId: string): LetterRecord | null {
    const letter = this.letters.get(letterId);
    if (!letter || letter.organizationId !== orgId) return null;
    return letter;
  }

  getLetterRevisions(letterId: string): LetterRevisionRecord[] {
    return this.revisions.get(letterId) || [];
  }

  createDraft(
    data: {
      letterTypeId: string;
      subject: string;
      recipientName: string;
      classification: "PUBLIC" | "INTERNAL" | "CONFIDENTIAL";
      plannedDate: string;
      content: Record<string, unknown>;
    },
    author: { id: string; name: string; organizationId: string }
  ): { letter: LetterRecord; revision: LetterRevisionRecord } {
    const letterType = this.getLetterTypeById(data.letterTypeId);
    if (!letterType) {
      throw new Error("Jenis surat tidak ditemukan.");
    }

    const letterId = `let-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    const now = new Date().toISOString();

    const revisionContent = data.content || {};
    const contentSha256 = calculateContentHash(revisionContent);

    const initialRevision: LetterRevisionRecord = {
      id: `rev-${Date.now()}-v1`,
      letterId,
      version: 1,
      subject: data.subject,
      recipientName: data.recipientName,
      classification: data.classification,
      plannedDate: data.plannedDate,
      content: revisionContent,
      contentSha256,
      changeSummary: "Pembuatan draf awal (v1)",
      createdBy: author.id,
      createdByName: author.name,
      createdAt: now,
    };

    const newLetter: LetterRecord = {
      id: letterId,
      organizationId: author.organizationId,
      letterTypeId: letterType.id,
      letterTypeCode: letterType.code,
      letterTypeLabel: letterType.label,
      authorId: author.id,
      authorName: author.name,
      subject: data.subject,
      recipientName: data.recipientName,
      classification: data.classification,
      plannedDate: data.plannedDate,
      status: "DRAFT",
      currentRevisionNo: 1,
      officialNumber: null, // STRICTLY NULL
      createdAt: now,
      updatedAt: now,
    };

    this.letters.set(letterId, newLetter);
    this.revisions.set(letterId, [initialRevision]);

    logAuditEvent({
      organizationId: author.organizationId,
      actorId: author.id,
      eventType: "LETTER_DRAFT_CREATED",
      entityType: "letter",
      entityId: letterId,
      metadata: {
        version: 1,
        subject: data.subject,
        sha256: contentSha256,
      },
    });

    return { letter: newLetter, revision: initialRevision };
  }

  /**
   * Menambahkan revisi baru (IMMUTABLE: Revisi sebelumnya tidak diubah).
   */
  addRevision(
    letterId: string,
    data: {
      subject: string;
      recipientName: string;
      classification: "PUBLIC" | "INTERNAL" | "CONFIDENTIAL";
      plannedDate: string;
      content: Record<string, unknown>;
      changeSummary?: string;
    },
    author: { id: string; name: string; organizationId: string }
  ): { letter: LetterRecord; revision: LetterRevisionRecord } {
    const letter = this.getLetterById(letterId, author.organizationId);
    if (!letter) {
      throw new Error("Surat tidak ditemukan.");
    }

    if (letter.status !== "DRAFT" && letter.status !== "RETURNED") {
      throw new Error(`Surat dalam status ${letter.status} tidak dapat disunting.`);
    }

    const currentRevisions = this.revisions.get(letterId) || [];
    const nextVersion = letter.currentRevisionNo + 1;
    const now = new Date().toISOString();

    const revisionContent = data.content || {};
    const contentSha256 = calculateContentHash(revisionContent);

    const newRevision: LetterRevisionRecord = {
      id: `rev-${Date.now()}-v${nextVersion}`,
      letterId,
      version: nextVersion,
      subject: data.subject,
      recipientName: data.recipientName,
      classification: data.classification,
      plannedDate: data.plannedDate,
      content: revisionContent,
      contentSha256,
      changeSummary: data.changeSummary || `Pembaruan revisi ke-${nextVersion}`,
      createdBy: author.id,
      createdByName: author.name,
      createdAt: now,
    };

    // Tambahkan ke riwayat tanpa mengubah array revisi terdahulu
    this.revisions.set(letterId, [...currentRevisions, newRevision]);

    // Update metadata surat saat ini
    letter.currentRevisionNo = nextVersion;
    letter.subject = data.subject;
    letter.recipientName = data.recipientName;
    letter.classification = data.classification;
    letter.plannedDate = data.plannedDate;
    letter.updatedAt = now;

    logAuditEvent({
      organizationId: author.organizationId,
      actorId: author.id,
      eventType: "LETTER_REVISION_CREATED",
      entityType: "letter",
      entityId: letterId,
      metadata: {
        version: nextVersion,
        sha256: contentSha256,
        changeSummary: data.changeSummary,
      },
    });

    return { letter, revision: newRevision };
  }

  submitForReview(letterId: string, author: { id: string; organizationId: string }): LetterRecord {
    const letter = this.getLetterById(letterId, author.organizationId);
    if (!letter) {
      throw new Error("Surat tidak ditemukan.");
    }
    if (letter.status !== "DRAFT") {
      throw new Error(`Hanya draf berstatus DRAFT yang dapat diajukan (status saat ini: ${letter.status}).`);
    }

    letter.status = "IN_REVIEW";
    letter.updatedAt = new Date().toISOString();

    logAuditEvent({
      organizationId: author.organizationId,
      actorId: author.id,
      eventType: "LETTER_SUBMITTED_FOR_REVIEW",
      entityType: "letter",
      entityId: letterId,
      metadata: { version: letter.currentRevisionNo },
    });

    return letter;
  }

  /**
   * PENCEGAHAN PENOMORAN RESMI PADA SPRINT 1A.
   * Fungsi ini secara sengaja melempar eksepsi untuk memastikan tidak ada alokasi nomor fiktif.
   */
  allocateOfficialNumber(): never {
    throw new Error(
      "BLOCKED: Penomoran surat resmi terkunci pada Sprint 1A! " +
      "Syarat pembukaan: verifikasi register arsip lama (D-01), SOP reset nomor (D-02), dan mandat pejabat (D-04) disahkan oleh Pengurus Yayasan."
    );
  }
}

// Global Singleton Database Instance
export const db = new LocalDatabaseStore();
