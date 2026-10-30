export type UserRole = "SYSTEM_ADMIN" | "STAFF" | "REVIEWER" | "PENGURUS_YAYASAN";

export interface UserRecord {
  id: string;
  organizationId: string;
  unitId?: string;
  email: string;
  displayName: string;
  passwordHash: string;
  status: "ACTIVE" | "DISABLED" | "INVITED";
  role: UserRole;
  createdAt: string;
}

export interface OrganizationRecord {
  id: string;
  legalName: string;
  acronym: string;
  addressPlaceholder: string;
  isVerified: boolean;
  createdAt?: string;
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

export type LetterStatus = 
  | "DRAFT" 
  | "SUBMITTED" 
  | "IN_REVIEW" 
  | "CHANGES_REQUESTED" 
  | "RETURNED" 
  | "REJECTED" 
  | "REVIEWED" 
  | "APPROVED" 
  | "NUMBERED" 
  | "AWAITING_SIGNATURE" 
  | "SIGNED" 
  | "ISSUED" 
  | "ARCHIVED" 
  | "VOIDED";

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
  status: LetterStatus;
  currentRevisionNo: number;
  officialNumber: null; // Strictly null in Sprint 1B, 1C & Sprint 2
  createdAt: string;
  updatedAt: string;
}

export interface UserContext {
  id: string;
  name?: string;
  displayName?: string;
  email?: string;
  role: UserRole;
  organizationId: string;
}

export interface CreateDraftInput {
  letterTypeId: string;
  subject: string;
  recipientName: string;
  classification: "PUBLIC" | "INTERNAL" | "CONFIDENTIAL";
  plannedDate: string;
  content: Record<string, unknown>;
}

export interface AddRevisionInput {
  subject: string;
  recipientName: string;
  classification: "PUBLIC" | "INTERNAL" | "CONFIDENTIAL";
  plannedDate: string;
  content: Record<string, unknown>;
  changeSummary?: string;
  expectedVersion?: number;
}

export interface SignatoryMandateRecord {
  id: string;
  organizationId: string;
  userId: string;
  userName?: string;
  userEmail?: string;
  letterTypeId: string | null;
  letterTypeCode?: string | null;
  letterTypeLabel?: string | null;
  unitId: string | null;
  unitName?: string | null;
  canReview: boolean;
  canApprove: boolean;
  canSign: boolean;
  validFrom: string; // YYYY-MM-DD
  validTo: string;   // YYYY-MM-DD
  status: "ACTIVE" | "REVOKED" | "EXPIRED";
  decreeNumber: string;
  notes?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ApprovalRequestRecord {
  id: string;
  organizationId: string;
  letterId: string;
  letterSubject?: string;
  letterTypeCode?: string;
  letterTypeLabel?: string;
  letterAuthorId?: string;
  revisionId: string;
  revisionVersion: number;
  contentSha256: string;
  submittedBy: string;
  submittedByName?: string;
  submitterName?: string;
  submittedAt: string;
  status: "PENDING" | "IN_REVIEW" | "APPROVED" | "CHANGES_REQUESTED" | "REJECTED" | "SUPERSEDED";
  submissionNotes?: string | null;
  workflowVersion: number;
  createdAt: string;
  updatedAt: string;
}

export interface ApprovalStepRecord {
  id: string;
  approvalRequestId: string;
  letterId: string;
  revisionId: string;
  stepNo: number;
  reviewerId: string;
  reviewerName?: string;
  mandateId: string;
  mandateDecreeNumber?: string;
  decreeNumber?: string;
  decision: "APPROVED" | "CHANGES_REQUESTED" | "REJECTED";
  decisionContentSha256: string;
  comments?: string | null;
  decidedAt: string;
}

export interface LetterStatusHistoryRecord {
  id: string;
  letterId: string;
  revisionId?: string | null;
  fromStatus: string;
  toStatus: string;
  actorId: string;
  actorName?: string;
  reason?: string | null;
  metadata?: Record<string, unknown>;
  createdAt: string;
}

export interface ApprovalDecisionInput {
  decision: "APPROVED" | "CHANGES_REQUESTED" | "REJECTED";
  comments?: string;
  mandateId?: string;
}

export interface CreateMandateInput {
  userId: string;
  letterTypeId?: string | null;
  unitId?: string | null;
  canReview?: boolean;
  canApprove: boolean;
  canSign?: boolean;
  validFrom: string;
  validTo: string;
  decreeNumber: string;
  notes?: string;
}

export interface UpdateMandateInput {
  canReview?: boolean;
  canApprove?: boolean;
  canSign?: boolean;
  validFrom?: string;
  validTo?: string;
  status?: "ACTIVE" | "REVOKED" | "EXPIRED";
  decreeNumber?: string;
  notes?: string;
}

export interface DatabaseHealthStatus {
  connected: boolean;
  target: string;
  mode: "REAL_POSTGRES" | "SIMULATION";
  status: "CONNECTED" | "UNAVAILABLE" | "SIMULATION";
  errorDetail?: string;
  latencyMs?: number;
}

export class DatabaseUnavailableError extends Error {
  constructor(message = "Layanan pangkalan data PostgreSQL tidak tersedia (UNAVAILABLE). Operasi dibatalkan demi integritas dan persistensi data.") {
    super(message);
    this.name = "DatabaseUnavailableError";
  }
}

export interface IDatabaseStore {
  getHealthStatus(): Promise<DatabaseHealthStatus>;
  getUserByEmail(email: string): Promise<UserRecord | null>;
  getUserById(id: string): Promise<UserRecord | null>;
  getAllUsers(orgId: string): Promise<UserRecord[]>;
  updateUserStatus(userId: string, status: "ACTIVE" | "DISABLED", actorId: string): Promise<UserRecord | null>;

  getOrganization(): Promise<OrganizationRecord>;
  getLetterTypes(orgId: string): Promise<LetterTypeRecord[]>;
  getLetterTypeById(typeIdOrCode: string): Promise<LetterTypeRecord | null>;

  getAllLetters(orgId: string, statusFilter?: string, userContext?: UserContext): Promise<LetterRecord[]>;
  getLetterById(letterId: string, orgId: string, userContext?: UserContext): Promise<LetterRecord | null>;
  getLetterRevisions(letterId: string): Promise<LetterRevisionRecord[]>;

  createDraft(
    data: CreateDraftInput,
    author: UserContext | { id: string; name: string; organizationId: string }
  ): Promise<{ letter: LetterRecord; revision: LetterRevisionRecord }>;

  addRevision(
    letterId: string,
    data: AddRevisionInput,
    author: UserContext
  ): Promise<{ letter: LetterRecord; revision: LetterRevisionRecord }>;

  submitForReview(
    letterId: string,
    author: UserContext
  ): Promise<LetterRecord>;

  // Sprint 2 Alur Persetujuan & Mandat
  submitForApproval(
    letterId: string,
    submitter: UserContext,
    notes?: string
  ): Promise<{ letter: LetterRecord; request: ApprovalRequestRecord }>;

  getPendingApprovals(
    reviewer: UserContext,
    orgId: string
  ): Promise<ApprovalRequestRecord[]>;

  getApprovalRequestById(
    requestId: string,
    userContext?: UserContext
  ): Promise<{
    request: ApprovalRequestRecord;
    letter: LetterRecord;
    revision: LetterRevisionRecord;
    steps: ApprovalStepRecord[];
  } | null>;

  getApprovalRequestByLetterId(
    letterId: string,
    userContext?: UserContext
  ): Promise<ApprovalRequestRecord | null>;

  decideApproval(
    requestId: string,
    reviewer: UserContext,
    input: ApprovalDecisionInput
  ): Promise<{
    letter: LetterRecord;
    request: ApprovalRequestRecord;
    step: ApprovalStepRecord;
  }>;

  getLetterHistory(
    letterId: string,
    orgId: string,
    userContext?: UserContext
  ): Promise<LetterStatusHistoryRecord[]>;

  getSignatoryMandates(
    orgId: string,
    userId?: string
  ): Promise<SignatoryMandateRecord[]>;

  getMandateById(
    mandateId: string,
    orgId: string
  ): Promise<SignatoryMandateRecord | null>;

  createSignatoryMandate(
    data: CreateMandateInput,
    actor: UserContext
  ): Promise<SignatoryMandateRecord>;

  updateSignatoryMandate(
    mandateId: string,
    data: UpdateMandateInput,
    actor: UserContext
  ): Promise<SignatoryMandateRecord | null>;

  allocateOfficialNumber(): never;
}
