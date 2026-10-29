import crypto from "crypto";
import bcrypt from "bcryptjs";
import { 
  IDatabaseStore, 
  UserRecord, 
  OrganizationRecord, 
  LetterTypeRecord, 
  LetterRevisionRecord, 
  LetterRecord, 
  UserContext, 
  CreateDraftInput, 
  AddRevisionInput, 
  DatabaseHealthStatus 
} from "./types";
import { calculateContentHash } from "@/lib/security/hash";
import { logAuditEvent } from "@/lib/audit";

export class MemoryDatabaseStore implements IDatabaseStore {
  private organization: OrganizationRecord;
  private users: Map<string, UserRecord> = new Map();
  private letterTypes: Map<string, LetterTypeRecord> = new Map();
  private letters: Map<string, LetterRecord> = new Map();
  private revisions: Map<string, LetterRevisionRecord[]> = new Map();
  private letterLocks: Map<string, Promise<void>> = new Map();

  constructor() {
    this.organization = {
      id: "a0000000-0000-4000-8000-000000000001",
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
        id: "e0000000-0000-4000-8000-000000000001",
        organizationId: this.organization.id,
        email: "admin.test@p4i.local",
        displayName: "Admin Sistem (Uji)",
        passwordHash,
        status: "ACTIVE",
        role: "SYSTEM_ADMIN",
        createdAt: new Date().toISOString(),
      },
      {
        id: "e0000000-0000-4000-8000-000000000002",
        organizationId: this.organization.id,
        email: "staf.test@p4i.local",
        displayName: "Staf Administrasi (Uji)",
        passwordHash,
        status: "ACTIVE",
        role: "STAFF",
        createdAt: new Date().toISOString(),
      },
      {
        id: "e0000000-0000-4000-8000-000000000003",
        organizationId: this.organization.id,
        email: "disabled.test@p4i.local",
        displayName: "Staf Nonaktif (Uji)",
        passwordHash,
        status: "DISABLED",
        role: "STAFF",
        createdAt: new Date().toISOString(),
      },
    ];

    testUsers.forEach((u) => {
      this.users.set(u.email.toLowerCase(), u);
      this.users.set(u.id, u);
    });

    // P0 Letter Types
    const types: LetterTypeRecord[] = [
      {
        id: "c0000000-0000-4000-8000-000000000001",
        organizationId: this.organization.id,
        code: "KET-MAGANG",
        label: "Surat Keterangan Selesai Magang",
        priority: "P0",
        isActive: true,
        numberingPolicyActive: false,
      },
      {
        id: "c0000000-0000-4000-8000-000000000002",
        organizationId: this.organization.id,
        code: "TUGAS",
        label: "Surat Tugas",
        priority: "P0",
        isActive: true,
        numberingPolicyActive: false,
      },
      {
        id: "c0000000-0000-4000-8000-000000000003",
        organizationId: this.organization.id,
        code: "UNDANGAN",
        label: "Surat Undangan",
        priority: "P0",
        isActive: true,
        numberingPolicyActive: false,
      },
      {
        id: "c0000000-0000-4000-8000-000000000004",
        organizationId: this.organization.id,
        code: "PERMOHONAN",
        label: "Surat Permohonan",
        priority: "P0",
        isActive: true,
        numberingPolicyActive: false,
      },
      {
        id: "c0000000-0000-4000-8000-000000000005",
        organizationId: this.organization.id,
        code: "PENGANTAR",
        label: "Surat Pengantar",
        priority: "P0",
        isActive: true,
        numberingPolicyActive: false,
      },
    ];

    types.forEach((t) => {
      this.letterTypes.set(t.id, t);
      this.letterTypes.set(t.code, t);
    });
  }

  // Mutex per letter untuk proteksi race condition pada request simultan
  private async acquireLock(letterId: string): Promise<() => void> {
    while (this.letterLocks.has(letterId)) {
      await this.letterLocks.get(letterId);
    }
    let resolveLock!: () => void;
    const lockPromise = new Promise<void>((resolve) => {
      resolveLock = resolve;
    });
    this.letterLocks.set(letterId, lockPromise);

    return () => {
      this.letterLocks.delete(letterId);
      resolveLock();
    };
  }

  async getHealthStatus(): Promise<DatabaseHealthStatus> {
    return {
      connected: false,
      target: "In-Memory Simulation Store",
      mode: "SIMULATION",
      status: "SIMULATION",
      errorDetail: "Mode simulasi aktif secara eksplisit untuk testing terisolasi.",
      latencyMs: 0,
    };
  }

  async getUserByEmail(email: string): Promise<UserRecord | null> {
    return this.users.get(email.toLowerCase()) || null;
  }

  async getUserById(id: string): Promise<UserRecord | null> {
    // Dukung lookup via UUID maupun alias legacy seperti 'usr-staff-01'
    const legacyAliases: Record<string, string> = {
      "usr-admin-01": "e0000000-0000-4000-8000-000000000001",
      "usr-staff-01": "e0000000-0000-4000-8000-000000000002",
      "usr-disabled-01": "e0000000-0000-4000-8000-000000000003",
    };
    const targetId = legacyAliases[id] || id;

    for (const u of this.users.values()) {
      if (u.id === targetId || u.id === id) return u;
    }
    return null;
  }

  async getAllUsers(orgId: string): Promise<UserRecord[]> {
    const seen = new Set<string>();
    const list: UserRecord[] = [];
    for (const u of this.users.values()) {
      if (
        (u.organizationId === orgId || orgId === "org-p4i-yayasan-001" || u.organizationId === "a0000000-0000-4000-8000-000000000001") &&
        !seen.has(u.id)
      ) {
        seen.add(u.id);
        list.push(u);
      }
    }
    return list;
  }

  async updateUserStatus(
    userId: string,
    status: "ACTIVE" | "DISABLED",
    actorId: string
  ): Promise<UserRecord | null> {
    const user = await this.getUserById(userId);
    if (!user) return null;
    user.status = status;

    await logAuditEvent({
      organizationId: user.organizationId,
      actorId,
      eventType: "USER_STATUS_UPDATED",
      entityType: "user",
      entityId: user.id,
      metadata: { newStatus: status },
    });

    return user;
  }

  async getOrganization(): Promise<OrganizationRecord> {
    return this.organization;
  }

  async getLetterTypes(orgId: string): Promise<LetterTypeRecord[]> {
    const seen = new Set<string>();
    const list: LetterTypeRecord[] = [];
    for (const t of this.letterTypes.values()) {
      if (!seen.has(t.id)) {
        seen.add(t.id);
        list.push(t);
      }
    }
    return list;
  }

  async getLetterTypeById(typeIdOrCode: string): Promise<LetterTypeRecord | null> {
    const codeMap: Record<string, string> = {
      "type-magang": "KET-MAGANG",
      "type-tugas": "TUGAS",
      "type-undangan": "UNDANGAN",
      "type-permohonan": "PERMOHONAN",
      "type-pengantar": "PENGANTAR",
    };
    const mapped = codeMap[typeIdOrCode.toLowerCase()] || typeIdOrCode;
    return this.letterTypes.get(typeIdOrCode) || this.letterTypes.get(mapped) || null;
  }

  async getAllLetters(
    orgId: string,
    statusFilter?: string,
    userContext?: UserContext
  ): Promise<LetterRecord[]> {
    let list = Array.from(this.letters.values());
    if (statusFilter && statusFilter !== "ALL") {
      list = list.filter((l) => l.status === statusFilter);
    }

    // PENGUATAN OTORISASI: Surat CONFIDENTIAL hanya dapat dilihat oleh pembuat atau SYSTEM_ADMIN
    if (userContext && userContext.role !== "SYSTEM_ADMIN") {
      list = list.filter((l) => l.classification !== "CONFIDENTIAL" || l.authorId === userContext.id);
    }

    return list.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  }

  async getLetterById(
    letterId: string,
    orgId: string,
    userContext?: UserContext
  ): Promise<LetterRecord | null> {
    const letter = this.letters.get(letterId);
    if (!letter) return null;

    // OTORISASI: Surat CONFIDENTIAL
    if (
      letter.classification === "CONFIDENTIAL" &&
      userContext &&
      userContext.role !== "SYSTEM_ADMIN" &&
      userContext.id !== letter.authorId
    ) {
      throw new Error("Akses ditolak: Surat ini bersifat RAHASIA (CONFIDENTIAL) dan hanya dapat diakses oleh pembuat draf atau administrator.");
    }

    return letter;
  }

  async getLetterRevisions(letterId: string): Promise<LetterRevisionRecord[]> {
    return this.revisions.get(letterId) || [];
  }

  async createDraft(
    data: CreateDraftInput,
    author: UserContext | { id: string; name: string; organizationId: string }
  ): Promise<{ letter: LetterRecord; revision: LetterRevisionRecord }> {
    const letterType = await this.getLetterTypeById(data.letterTypeId);
    if (!letterType) {
      throw new Error("Jenis surat tidak ditemukan.");
    }

    const letterId = crypto.randomUUID();
    const revisionId = crypto.randomUUID();
    const now = new Date().toISOString();
    const revisionContent = data.content || {};
    const contentSha256 = calculateContentHash(revisionContent);
    const authorName = ("name" in author && author.name) ? author.name : (("displayName" in author && author.displayName) ? author.displayName : "Pengguna");

    const initialRevision: LetterRevisionRecord = {
      id: revisionId,
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
      createdByName: authorName,
      createdAt: now,
    };

    const newLetter: LetterRecord = {
      id: letterId,
      organizationId: author.organizationId,
      letterTypeId: letterType.id,
      letterTypeCode: letterType.code,
      letterTypeLabel: letterType.label,
      authorId: author.id,
      authorName: authorName,
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

    await logAuditEvent({
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

  async addRevision(
    letterId: string,
    data: AddRevisionInput,
    author: UserContext
  ): Promise<{ letter: LetterRecord; revision: LetterRevisionRecord }> {
    // Acquire mutex untuk letterId agar penambahan revisi simultan strictly sequential
    const releaseLock = await this.acquireLock(letterId);

    try {
      const letter = this.letters.get(letterId);
      if (!letter) {
        throw new Error("Surat tidak ditemukan.");
      }

      if (letter.status !== "DRAFT" && letter.status !== "RETURNED") {
        throw new Error(`Surat dalam status ${letter.status} tidak dapat disunting.`);
      }

      // OTORISASI KEPEMILIKAN: Hanya author atau admin
      if (author.role !== "SYSTEM_ADMIN" && author.id !== letter.authorId) {
        throw new Error("Akses ditolak: Hanya pembuat draf (author) atau administrator yang berhak menyunting draf ini.");
      }

      // OPTIMISTIC CONCURRENCY CHECK
      if (data.expectedVersion && data.expectedVersion !== letter.currentRevisionNo) {
        throw new Error(`Konflik revisi: Draf telah diperbarui oleh pengguna lain (versi saat ini: v${letter.currentRevisionNo}).`);
      }

      const currentRevisions = this.revisions.get(letterId) || [];
      const nextVersion = letter.currentRevisionNo + 1;
      const revisionId = crypto.randomUUID();
      const now = new Date().toISOString();
      const revisionContent = data.content || {};
      const contentSha256 = calculateContentHash(revisionContent);
      const summary = data.changeSummary || `Pembaruan revisi ke-${nextVersion}`;

      const newRevision: LetterRevisionRecord = {
        id: revisionId,
        letterId,
        version: nextVersion,
        subject: data.subject,
        recipientName: data.recipientName,
        classification: data.classification,
        plannedDate: data.plannedDate,
        content: revisionContent,
        contentSha256,
        changeSummary: summary,
        createdBy: author.id,
        createdByName: author.name || "Staf",
        createdAt: now,
      };

      // Tambahkan ke riwayat tanpa mengubah array revisi terdahulu (IMMUTABLE)
      this.revisions.set(letterId, [...currentRevisions, newRevision]);

      letter.currentRevisionNo = nextVersion;
      letter.subject = data.subject;
      letter.recipientName = data.recipientName;
      letter.classification = data.classification;
      letter.plannedDate = data.plannedDate;
      letter.updatedAt = now;

      await logAuditEvent({
        organizationId: author.organizationId,
        actorId: author.id,
        eventType: "LETTER_REVISION_CREATED",
        entityType: "letter",
        entityId: letterId,
        metadata: {
          version: nextVersion,
          sha256: contentSha256,
          changeSummary: summary,
        },
      });

      return { letter, revision: newRevision };
    } finally {
      releaseLock();
    }
  }

  async submitForReview(
    letterId: string, 
    author: UserContext
  ): Promise<LetterRecord> {
    const letter = this.letters.get(letterId);
    if (!letter) {
      throw new Error("Surat tidak ditemukan.");
    }

    // OTORISASI: Hanya author atau admin
    if (author.role !== "SYSTEM_ADMIN" && author.id !== letter.authorId) {
      throw new Error("Akses ditolak: Hanya pembuat draf yang berhak mengajukan draf untuk pemeriksaan.");
    }

    if (letter.status !== "DRAFT") {
      throw new Error(`Hanya draf berstatus DRAFT yang dapat diajukan (status saat ini: ${letter.status}).`);
    }

    letter.status = "IN_REVIEW";
    letter.updatedAt = new Date().toISOString();

    await logAuditEvent({
      organizationId: author.organizationId,
      actorId: author.id,
      eventType: "LETTER_SUBMITTED_FOR_REVIEW",
      entityType: "letter",
      entityId: letterId,
      metadata: { version: letter.currentRevisionNo },
    });

    return letter;
  }

  allocateOfficialNumber(): never {
    throw new Error(
      "BLOCKED: Penomoran surat resmi terkunci pada Sprint 1B! " +
      "Syarat pembukaan: verifikasi register arsip lama (D-01), SOP reset nomor (D-02), dan mandat pejabat (D-04) disahkan oleh Pengurus Yayasan."
    );
  }
}
