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
  officialNumber: null; // Strictly null in Sprint 1B
  createdAt: string;
  updatedAt: string;
}

export interface UserContext {
  id: string;
  name?: string;
  displayName?: string;
  email?: string;
  role: "SYSTEM_ADMIN" | "STAFF";
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

export interface DatabaseHealthStatus {
  connected: boolean;
  target: string;
  mode: "REAL_POSTGRES" | "IN_MEMORY_FAILSAFE";
  status: "CONNECTED" | "BLOCKED" | "ERROR";
  errorDetail?: string;
  latencyMs?: number;
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

  allocateOfficialNumber(): never;
}
