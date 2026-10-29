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
  DatabaseHealthStatus,
  SignatoryMandateRecord,
  ApprovalRequestRecord,
  ApprovalStepRecord,
  LetterStatusHistoryRecord,
  ApprovalDecisionInput,
  CreateMandateInput,
  UpdateMandateInput
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
  private approvalRequests: Map<string, ApprovalRequestRecord> = new Map();
  private approvalSteps: Map<string, ApprovalStepRecord[]> = new Map();
  private letterHistory: Map<string, LetterStatusHistoryRecord[]> = new Map();
  private mandates: Map<string, SignatoryMandateRecord> = new Map();

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
      {
        id: "e0000000-0000-4000-8000-000000000004",
        organizationId: this.organization.id,
        email: "reviewer.test@p4i.local",
        displayName: "Reviewer Pejabat (Uji)",
        passwordHash,
        status: "ACTIVE",
        role: "REVIEWER",
        createdAt: new Date().toISOString(),
      },
      {
        id: "e0000000-0000-4000-8000-000000000005",
        organizationId: this.organization.id,
        email: "staf2.test@p4i.local",
        displayName: "Staf Kedua (Uji)",
        passwordHash,
        status: "ACTIVE",
        role: "STAFF",
        createdAt: new Date().toISOString(),
      },
      {
        id: "e0000000-0000-4000-8000-000000000006",
        organizationId: this.organization.id,
        email: "unauthorized.test@p4i.local",
        displayName: "Pengguna Tanpa Mandat (Uji)",
        passwordHash,
        status: "ACTIVE",
        role: "STAFF",
        createdAt: new Date().toISOString(),
      },
    ];

    testUsers.forEach((u) => {
      this.users.set(u.email.toLowerCase(), u);
      this.users.set(u.id, u);
    });

    const testMandates: SignatoryMandateRecord[] = [
      {
        id: "m0000000-0000-4000-8000-000000000001",
        organizationId: this.organization.id,
        userId: "e0000000-0000-4000-8000-000000000004",
        userName: "Reviewer Pejabat (Uji)",
        userEmail: "reviewer.test@p4i.local",
        letterTypeId: null,
        letterTypeCode: null,
        letterTypeLabel: "Semua Jenis Surat",
        unitId: null,
        unitName: null,
        canReview: true,
        canApprove: true,
        canSign: true,
        validFrom: "2026-01-01",
        validTo: "2026-12-31",
        status: "ACTIVE",
        decreeNumber: "SK-P4I/2026/001-TEST",
        notes: "Mandat aktif umum untuk pengujian reviewer",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      {
        id: "m0000000-0000-4000-8000-000000000002",
        organizationId: this.organization.id,
        userId: "e0000000-0000-4000-8000-000000000004",
        userName: "Reviewer Pejabat (Uji)",
        userEmail: "reviewer.test@p4i.local",
        letterTypeId: null,
        letterTypeCode: null,
        letterTypeLabel: "Semua Jenis Surat",
        unitId: null,
        unitName: null,
        canReview: true,
        canApprove: true,
        canSign: false,
        validFrom: "2025-01-01",
        validTo: "2025-12-31",
        status: "EXPIRED",
        decreeNumber: "SK-P4I/2025/EXPIRED-TEST",
        notes: "Mandat kadaluarsa untuk skenario negatif pengujian",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      {
        id: "m0000000-0000-4000-8000-000000000003",
        organizationId: this.organization.id,
        userId: "e0000000-0000-4000-8000-000000000004",
        userName: "Reviewer Pejabat (Uji)",
        userEmail: "reviewer.test@p4i.local",
        letterTypeId: null,
        letterTypeCode: null,
        letterTypeLabel: "Semua Jenis Surat",
        unitId: null,
        unitName: null,
        canReview: false,
        canApprove: false,
        canSign: false,
        validFrom: "2026-01-01",
        validTo: "2026-12-31",
        status: "REVOKED",
        decreeNumber: "SK-P4I/2026/REVOKED-TEST",
        notes: "Mandat dicabut untuk skenario negatif pengujian",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ];

    testMandates.forEach(m => this.mandates.set(m.id, m));

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

      if (
        letter.status !== "DRAFT" && 
        letter.status !== "RETURNED" && 
        letter.status !== "CHANGES_REQUESTED"
      ) {
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

      const prevStatus = letter.status;
      const nextStatus = (prevStatus === "CHANGES_REQUESTED" || prevStatus === "RETURNED") 
        ? "DRAFT" 
        : prevStatus;

      letter.currentRevisionNo = nextVersion;
      letter.subject = data.subject;
      letter.recipientName = data.recipientName;
      letter.classification = data.classification;
      letter.plannedDate = data.plannedDate;
      letter.status = nextStatus;
      letter.updatedAt = now;

      if (nextStatus !== prevStatus) {
        const hist = this.letterHistory.get(letterId) || [];
        hist.push({
          id: crypto.randomUUID(),
          letterId,
          revisionId,
          fromStatus: prevStatus,
          toStatus: nextStatus,
          actorId: author.id,
          actorName: author.name,
          reason: `Revisi v${nextVersion} disimpan setelah ${prevStatus}`,
          createdAt: now,
        });
        this.letterHistory.set(letterId, hist);
      }

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

  async submitForApproval(
    letterId: string,
    submitter: UserContext,
    notes?: string
  ): Promise<{ letter: LetterRecord; request: ApprovalRequestRecord }> {
    const letter = this.letters.get(letterId);
    if (!letter) {
      throw new Error("Surat tidak ditemukan.");
    }

    // OTORISASI: Hanya author atau admin
    if (submitter.role !== "SYSTEM_ADMIN" && submitter.id !== letter.authorId) {
      throw new Error("Akses ditolak: Hanya pembuat draf yang berhak mengajukan draf untuk pemeriksaan.");
    }

    if (
      letter.status !== "DRAFT" && 
      letter.status !== "CHANGES_REQUESTED" && 
      letter.status !== "RETURNED"
    ) {
      throw new Error(`Hanya draf berstatus DRAFT atau CHANGES_REQUESTED yang dapat diajukan (status saat ini: ${letter.status}).`);
    }

    const revisions = this.revisions.get(letterId) || [];
    if (revisions.length === 0) {
      throw new Error("Draf surat tidak memiliki catatan revisi.");
    }

    const latestRev = revisions[revisions.length - 1];
    const now = new Date().toISOString();

    // Mark previous pending as SUPERSEDED
    for (const [_, req] of this.approvalRequests.entries()) {
      if (req.letterId === letterId && (req.status === "PENDING" || req.status === "IN_REVIEW")) {
        req.status = "SUPERSEDED";
        req.updatedAt = now;
      }
    }

    const reqId = crypto.randomUUID();
    const request: ApprovalRequestRecord = {
      id: reqId,
      organizationId: submitter.organizationId,
      letterId,
      revisionId: latestRev.id,
      revisionVersion: latestRev.version,
      contentSha256: latestRev.contentSha256,
      submittedBy: submitter.id,
      submitterName: submitter.name,
      submittedAt: now,
      status: "PENDING",
      submissionNotes: notes || null,
      workflowVersion: 1,
      letterSubject: letter.subject,
      letterTypeCode: letter.letterTypeCode,
      letterTypeLabel: letter.letterTypeLabel,
      createdAt: now,
      updatedAt: now,
    };
    this.approvalRequests.set(reqId, request);

    const prevStatus = letter.status;
    letter.status = "SUBMITTED";
    letter.updatedAt = now;

    // Catat ke history
    const hist = this.letterHistory.get(letterId) || [];
    hist.push({
      id: crypto.randomUUID(),
      letterId,
      revisionId: latestRev.id,
      fromStatus: prevStatus,
      toStatus: "SUBMITTED",
      actorId: submitter.id,
      actorName: submitter.name,
      reason: notes || "Pengajuan draf surat untuk pemeriksaan",
      metadata: { revisionVersion: latestRev.version, contentSha256: latestRev.contentSha256 },
      createdAt: now,
    });
    this.letterHistory.set(letterId, hist);

    await logAuditEvent({
      organizationId: submitter.organizationId,
      actorId: submitter.id,
      eventType: "LETTER_SUBMITTED_FOR_APPROVAL",
      entityType: "letter",
      entityId: letterId,
      metadata: { requestId: reqId, version: latestRev.version, contentSha256: latestRev.contentSha256 },
    });

    return { letter, request };
  }

  async submitForReview(
    letterId: string, 
    author: UserContext
  ): Promise<LetterRecord> {
    const res = await this.submitForApproval(letterId, author);
    return res.letter;
  }

  async getPendingApprovals(
    _reviewer: UserContext,
    orgId: string
  ): Promise<ApprovalRequestRecord[]> {
    const list: ApprovalRequestRecord[] = [];
    for (const req of this.approvalRequests.values()) {
      if (req.organizationId === orgId && (req.status === "PENDING" || req.status === "IN_REVIEW")) {
        list.push(req);
      }
    }
    return list.sort((a, b) => a.submittedAt.localeCompare(b.submittedAt));
  }

  async getApprovalRequestById(
    requestId: string,
    userContext?: UserContext
  ): Promise<{
    request: ApprovalRequestRecord;
    letter: LetterRecord;
    revision: LetterRevisionRecord;
    steps: ApprovalStepRecord[];
  } | null> {
    const request = this.approvalRequests.get(requestId);
    if (!request) return null;

    if (userContext && userContext.organizationId !== request.organizationId) {
      return null;
    }

    const letter = this.letters.get(request.letterId);
    if (!letter) return null;

    const revs = this.revisions.get(request.letterId) || [];
    const revision = revs.find(r => r.id === request.revisionId);
    if (!revision) return null;

    const steps = this.approvalSteps.get(requestId) || [];

    return { request, letter, revision, steps };
  }

  async getApprovalRequestByLetterId(
    letterId: string,
    userContext?: UserContext
  ): Promise<ApprovalRequestRecord | null> {
    let latest: ApprovalRequestRecord | null = null;
    for (const req of this.approvalRequests.values()) {
      if (req.letterId === letterId) {
        if (!latest || req.createdAt.localeCompare(latest.createdAt) > 0) {
          latest = req;
        }
      }
    }
    if (!latest) return null;
    if (userContext && userContext.organizationId !== latest.organizationId) {
      return null;
    }
    return latest;
  }

  async decideApproval(
    requestId: string,
    reviewer: UserContext,
    input: ApprovalDecisionInput
  ): Promise<{
    letter: LetterRecord;
    request: ApprovalRequestRecord;
    step: ApprovalStepRecord;
  }> {
    const request = this.approvalRequests.get(requestId);
    if (!request) {
      throw new Error("Permintaan persetujuan tidak ditemukan.");
    }

    if (request.organizationId !== reviewer.organizationId) {
      throw new Error("Akses ditolak: Organisasi berbeda.");
    }

    if (request.status !== "PENDING" && request.status !== "IN_REVIEW") {
      throw new Error(`Permintaan persetujuan sudah selesai diproses sebelumnya (status: ${request.status}).`);
    }

    const letter = this.letters.get(request.letterId);
    if (!letter) {
      throw new Error("Surat tidak ditemukan.");
    }

    // Anti self-approval
    if (letter.authorId === reviewer.id) {
      throw new Error("Pelanggaran Pemisahan Tugas (Anti Self-Approval): Pembuat draf surat tidak berhak memeriksa atau menyetujui suratnya sendiri.");
    }

    // Comment mandatory
    if (input.decision === "REJECTED" || input.decision === "CHANGES_REQUESTED") {
      if (!input.comments || input.comments.trim().length < 5) {
        throw new Error("Alasan penolakan atau permintaan perubahan wajib diisi (minimal 5 karakter).");
      }
    }

    // Anti stale
    const revs = this.revisions.get(letter.id) || [];
    const latestRev = revs[revs.length - 1];
    if (
      !latestRev || 
      latestRev.version !== request.revisionVersion || 
      latestRev.contentSha256 !== request.contentSha256
    ) {
      throw new Error(
        `Draf surat telah diperbarui sejak pengajuan pemeriksaan (stale approval). Revisi draf saat ini (v${latestRev?.version}) tidak cocok dengan versi yang diajukan (v${request.revisionVersion}). Pemeriksaan harus diulang.`
      );
    }

    // Mandate check
    let mandate: SignatoryMandateRecord | undefined;
    if (input.mandateId) {
      mandate = this.mandates.get(input.mandateId);
    } else {
      for (const m of this.mandates.values()) {
        if (
          m.userId === reviewer.id && 
          m.organizationId === reviewer.organizationId && 
          m.status === "ACTIVE" &&
          (!m.letterTypeId || m.letterTypeId === letter.letterTypeId)
        ) {
          mandate = m;
          break;
        }
      }
    }

    if (!mandate) {
      throw new Error("Reviewer tidak memiliki mandat aktif yang sah untuk jenis surat ini (mandat tidak ditemukan, kadaluarsa, dicabut, atau di luar kewenangan jenis surat).");
    }

    const today = new Date().toISOString().slice(0, 10);
    if (mandate.status !== "ACTIVE" || mandate.validFrom > today || mandate.validTo < today) {
      throw new Error("Mandat pejabat reviewer tidak aktif atau telah kadaluarsa.");
    }

    if (input.decision === "APPROVED" && !mandate.canApprove) {
      throw new Error("Mandat reviewer tidak memiliki kewenangan untuk menyetujui (canApprove = false).");
    }

    const now = new Date().toISOString();
    const existingSteps = this.approvalSteps.get(requestId) || [];
    const nextStepNo = existingSteps.length + 1;
    const stepId = crypto.randomUUID();

    const step: ApprovalStepRecord = {
      id: stepId,
      approvalRequestId: requestId,
      letterId: letter.id,
      revisionId: request.revisionId,
      stepNo: nextStepNo,
      reviewerId: reviewer.id,
      reviewerName: reviewer.name,
      mandateId: mandate.id,
      decreeNumber: mandate.decreeNumber,
      decision: input.decision,
      decisionContentSha256: request.contentSha256,
      comments: input.comments,
      decidedAt: now,
    };

    existingSteps.push(step);
    this.approvalSteps.set(requestId, existingSteps);

    request.status = input.decision;
    request.updatedAt = now;

    const prevLetterStatus = letter.status;
    letter.status = input.decision;
    letter.updatedAt = now;

    const hist = this.letterHistory.get(letter.id) || [];
    hist.push({
      id: crypto.randomUUID(),
      letterId: letter.id,
      revisionId: request.revisionId,
      fromStatus: prevLetterStatus,
      toStatus: input.decision,
      actorId: reviewer.id,
      actorName: reviewer.name,
      reason: input.comments || `Keputusan ${input.decision} oleh reviewer`,
      metadata: {
        mandateId: mandate.id,
        decreeNumber: mandate.decreeNumber,
        contentSha256: request.contentSha256,
        stepNo: nextStepNo,
      },
      createdAt: now,
    });
    this.letterHistory.set(letter.id, hist);

    await logAuditEvent({
      organizationId: reviewer.organizationId,
      actorId: reviewer.id,
      eventType: `LETTER_DECIDED_${input.decision}`,
      entityType: "letter",
      entityId: letter.id,
      metadata: {
        requestId,
        decision: input.decision,
        mandateId: mandate.id,
        decreeNumber: mandate.decreeNumber,
        stepNo: nextStepNo,
      },
    });

    return { letter, request, step };
  }

  async getLetterHistory(
    letterId: string,
    _orgId: string,
    _userContext?: UserContext
  ): Promise<LetterStatusHistoryRecord[]> {
    return this.letterHistory.get(letterId) || [];
  }

  async getSignatoryMandates(
    orgId: string,
    userId?: string
  ): Promise<SignatoryMandateRecord[]> {
    const list: SignatoryMandateRecord[] = [];
    for (const m of this.mandates.values()) {
      if (m.organizationId === orgId && (!userId || m.userId === userId)) {
        list.push(m);
      }
    }
    return list;
  }

  async getMandateById(
    mandateId: string,
    orgId: string
  ): Promise<SignatoryMandateRecord | null> {
    const m = this.mandates.get(mandateId);
    if (!m || m.organizationId !== orgId) return null;
    return m;
  }

  async createSignatoryMandate(
    data: CreateMandateInput,
    actor: UserContext
  ): Promise<SignatoryMandateRecord> {
    if (actor.role !== "SYSTEM_ADMIN" && actor.role !== "PENGURUS_YAYASAN") {
      throw new Error("Akses ditolak: Hanya administrator sistem atau pengurus yayasan yang berhak membuat mandat.");
    }
    if (!data.decreeNumber || data.decreeNumber.trim().length === 0) {
      throw new Error("Nomor SK penetapan mandat wajib diisi.");
    }
    if (data.validFrom > data.validTo) {
      throw new Error("Tanggal awal berlaku tidak boleh melewati tanggal akhir berlaku.");
    }

    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    const user = this.users.get(data.userId);

    const mandate: SignatoryMandateRecord = {
      id,
      organizationId: actor.organizationId,
      userId: data.userId,
      userName: user?.displayName || "Pengguna",
      userEmail: user?.email || "",
      letterTypeId: data.letterTypeId || null,
      letterTypeCode: null,
      letterTypeLabel: null,
      unitId: data.unitId || null,
      unitName: null,
      canReview: data.canReview ?? true,
      canApprove: data.canApprove,
      canSign: data.canSign ?? false,
      validFrom: data.validFrom,
      validTo: data.validTo,
      status: "ACTIVE",
      decreeNumber: data.decreeNumber.trim(),
      notes: data.notes || null,
      createdAt: now,
      updatedAt: now,
    };

    this.mandates.set(id, mandate);
    return mandate;
  }

  async updateSignatoryMandate(
    mandateId: string,
    data: UpdateMandateInput,
    actor: UserContext
  ): Promise<SignatoryMandateRecord | null> {
    if (actor.role !== "SYSTEM_ADMIN" && actor.role !== "PENGURUS_YAYASAN") {
      throw new Error("Akses ditolak: Hanya administrator sistem atau pengurus yayasan yang berhak memperbarui mandat.");
    }
    const current = this.mandates.get(mandateId);
    if (!current || current.organizationId !== actor.organizationId) return null;

    const now = new Date().toISOString();
    current.canReview = data.canReview ?? current.canReview;
    current.canApprove = data.canApprove ?? current.canApprove;
    current.canSign = data.canSign ?? current.canSign;
    current.validFrom = data.validFrom ?? current.validFrom;
    current.validTo = data.validTo ?? current.validTo;
    current.status = data.status ?? current.status;
    if (data.decreeNumber) current.decreeNumber = data.decreeNumber.trim();
    if (data.notes !== undefined) current.notes = data.notes;
    current.updatedAt = now;

    return current;
  }

  allocateOfficialNumber(): never {
    throw new Error(
      "BLOCKED: Penomoran surat resmi terkunci pada Sprint 1B, 1C & Sprint 2 (dinonaktifkan)! " +
      "Syarat pembukaan: verifikasi register arsip lama (D-01), SOP reset nomor (D-02), dan mandat pejabat (D-04) disahkan oleh Pengurus Yayasan."
    );
  }
}
