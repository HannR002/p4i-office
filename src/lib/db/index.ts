import { PostgresDatabaseStore } from "./postgres-repository";
import { MemoryDatabaseStore } from "./memory-repository";
import { checkPostgresConnection } from "./pool";
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

export * from "./types";
export { getDatabaseUrl, getMaskedDatabaseUrl, checkPostgresConnection } from "./pool";

class AdaptiveDatabaseRouter implements IDatabaseStore {
  private pgStore: PostgresDatabaseStore;
  private memStore: MemoryDatabaseStore;
  private connectionChecked = false;
  private isPostgresAvailable = false;
  private lastCheckTime = 0;
  private checkIntervalMs = 15000; // Cek ulang setiap 15 detik

  constructor() {
    this.pgStore = new PostgresDatabaseStore();
    this.memStore = new MemoryDatabaseStore();
  }

  private async getActiveStore(): Promise<IDatabaseStore> {
    const now = Date.now();
    if (!this.connectionChecked || now - this.lastCheckTime > this.checkIntervalMs) {
      this.lastCheckTime = now;
      this.connectionChecked = true;
      const conn = await checkPostgresConnection();
      this.isPostgresAvailable = conn.connected;

      if (this.isPostgresAvailable) {
        console.log("[P4I-DB] Mode Aktif: REAL_POSTGRES (Terhubung ke PostgreSQL riil).");
      } else {
        console.warn(
          `[P4I-DB: NOTICE] Layanan PostgreSQL lokal offline (${conn.error || "ECONNREFUSED"}). ` +
          "Adapter in-memory fail-safe aktif untuk menjaga ketersediaan sistem lokal."
        );
      }
    }

    return this.isPostgresAvailable ? this.pgStore : this.memStore;
  }

  async getHealthStatus(): Promise<DatabaseHealthStatus> {
    const conn = await checkPostgresConnection();
    this.isPostgresAvailable = conn.connected;
    this.connectionChecked = true;
    this.lastCheckTime = Date.now();

    if (conn.connected) {
      return await this.pgStore.getHealthStatus();
    } else {
      const memHealth = await this.memStore.getHealthStatus();
      return {
        ...memHealth,
        errorDetail: conn.error,
        latencyMs: conn.latencyMs,
      };
    }
  }

  async getUserByEmail(email: string): Promise<UserRecord | null> {
    const store = await this.getActiveStore();
    return store.getUserByEmail(email);
  }

  async getUserById(id: string): Promise<UserRecord | null> {
    const store = await this.getActiveStore();
    return store.getUserById(id);
  }

  async getAllUsers(orgId: string): Promise<UserRecord[]> {
    const store = await this.getActiveStore();
    return store.getAllUsers(orgId);
  }

  async updateUserStatus(
    userId: string, 
    status: "ACTIVE" | "DISABLED", 
    actorId: string
  ): Promise<UserRecord | null> {
    const store = await this.getActiveStore();
    return store.updateUserStatus(userId, status, actorId);
  }

  async getOrganization(): Promise<OrganizationRecord> {
    const store = await this.getActiveStore();
    return store.getOrganization();
  }

  async getLetterTypes(orgId: string): Promise<LetterTypeRecord[]> {
    const store = await this.getActiveStore();
    return store.getLetterTypes(orgId);
  }

  async getLetterTypeById(typeIdOrCode: string): Promise<LetterTypeRecord | null> {
    const store = await this.getActiveStore();
    return store.getLetterTypeById(typeIdOrCode);
  }

  async getAllLetters(
    orgId: string, 
    statusFilter?: string, 
    userContext?: UserContext
  ): Promise<LetterRecord[]> {
    const store = await this.getActiveStore();
    return store.getAllLetters(orgId, statusFilter, userContext);
  }

  async getLetterById(
    letterId: string, 
    orgId: string, 
    userContext?: UserContext
  ): Promise<LetterRecord | null> {
    const store = await this.getActiveStore();
    return store.getLetterById(letterId, orgId, userContext);
  }

  async getLetterRevisions(letterId: string): Promise<LetterRevisionRecord[]> {
    const store = await this.getActiveStore();
    return store.getLetterRevisions(letterId);
  }

  async createDraft(
    data: CreateDraftInput,
    author: UserContext | { id: string; name: string; organizationId: string }
  ): Promise<{ letter: LetterRecord; revision: LetterRevisionRecord }> {
    const store = await this.getActiveStore();
    return store.createDraft(data, author);
  }

  async addRevision(
    letterId: string,
    data: AddRevisionInput,
    author: UserContext
  ): Promise<{ letter: LetterRecord; revision: LetterRevisionRecord }> {
    const store = await this.getActiveStore();
    return store.addRevision(letterId, data, author);
  }

  async submitForReview(
    letterId: string, 
    author: UserContext
  ): Promise<LetterRecord> {
    const store = await this.getActiveStore();
    return store.submitForReview(letterId, author);
  }

  allocateOfficialNumber(): never {
    throw new Error(
      "BLOCKED: Penomoran surat resmi terkunci pada Sprint 1B! " +
      "Syarat pembukaan: verifikasi register arsip lama (D-01), SOP reset nomor (D-02), dan mandat pejabat (D-04) disahkan oleh Pengurus Yayasan."
    );
  }
}

// Global Singleton Database Instance
export const db = new AdaptiveDatabaseRouter();
