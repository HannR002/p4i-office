import { PostgresDatabaseStore } from "./postgres-repository";
import { MemoryDatabaseStore } from "./memory-repository";
import { checkPostgresConnection, getMaskedDatabaseUrl } from "./pool";
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
  DatabaseUnavailableError 
} from "./types";

export * from "./types";
export { getDatabaseUrl, getMaskedDatabaseUrl, checkPostgresConnection, getPgPool } from "./pool";

class AdaptiveDatabaseRouter implements IDatabaseStore {
  private pgStore: PostgresDatabaseStore;
  private memStore: MemoryDatabaseStore;
  private connectionChecked = false;
  private isPostgresAvailable = false;
  private lastCheckTime = 0;
  private checkIntervalMs = 5000; // Cek ulang setiap 5 detik

  constructor() {
    this.pgStore = new PostgresDatabaseStore();
    this.memStore = new MemoryDatabaseStore();
  }

  private isSimulationMode(): boolean {
    // Mode simulasi in-memory HANYA boleh aktif pada mode testing eksplisit
    // Mutlak DILARANG pada production
    if (process.env.NODE_ENV === "production") {
      return false;
    }
    return process.env.DB_SIMULATION === "true" && process.env.NODE_ENV === "test";
  }

  private async getActiveStore(): Promise<IDatabaseStore> {
    if (this.isSimulationMode()) {
      return this.memStore;
    }

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
          `[P4I-DB: ERROR] Layanan PostgreSQL offline (${conn.error || "ECONNREFUSED"}). ` +
          "Operasi pangkalan data ditolak (UNAVAILABLE). Silent memory fallback dinonaktifkan demi integritas data."
        );
      }
    }

    if (!this.isPostgresAvailable) {
      throw new DatabaseUnavailableError(
        "Layanan pangkalan data PostgreSQL tidak tersedia (UNAVAILABLE). " +
        "Operasi data ditolak untuk mencegah inkonsistensi. Pastikan service PostgreSQL aktif."
      );
    }

    return this.pgStore;
  }

  async getHealthStatus(): Promise<DatabaseHealthStatus> {
    if (this.isSimulationMode()) {
      return await this.memStore.getHealthStatus();
    }

    const conn = await checkPostgresConnection();
    this.isPostgresAvailable = conn.connected;
    this.connectionChecked = true;
    this.lastCheckTime = Date.now();

    if (conn.connected) {
      return await this.pgStore.getHealthStatus();
    } else {
      return {
        connected: false,
        target: getMaskedDatabaseUrl(),
        mode: "REAL_POSTGRES",
        status: "UNAVAILABLE",
        errorDetail: conn.error || "Connection refused",
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
      "BLOCKED: Penomoran surat resmi terkunci pada Sprint 1C! " +
      "Syarat pembukaan: verifikasi register arsip lama (D-01), SOP reset nomor (D-02), dan mandat pejabat (D-04) disahkan oleh Pengurus Yayasan."
    );
  }
}

// Global Singleton Database Instance
export const db = new AdaptiveDatabaseRouter();
