import crypto from "crypto";
import { getPgPool, checkPostgresConnection, getMaskedDatabaseUrl } from "./pool";
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

export class PostgresDatabaseStore implements IDatabaseStore {
  async getHealthStatus(): Promise<DatabaseHealthStatus> {
    const conn = await checkPostgresConnection();
    return {
      connected: conn.connected,
      target: getMaskedDatabaseUrl(),
      mode: "REAL_POSTGRES",
      status: conn.connected ? "CONNECTED" : "BLOCKED",
      errorDetail: conn.error,
      latencyMs: conn.latencyMs,
    };
  }

  async getUserByEmail(email: string): Promise<UserRecord | null> {
    const pool = getPgPool();
    const query = `
      SELECT 
        u.id::text,
        u.organization_id::text AS "organizationId",
        u.unit_id::text AS "unitId",
        u.email,
        u.display_name AS "displayName",
        u.password_hash AS "passwordHash",
        u.status,
        COALESCE(r.role_key, 'STAFF') AS "role",
        u.created_at::text AS "createdAt"
      FROM users u
      LEFT JOIN user_roles ur ON ur.user_id = u.id
      LEFT JOIN roles r ON r.id = ur.role_id
      WHERE LOWER(u.email) = LOWER($1)
      LIMIT 1;
    `;
    const res = await pool.query(query, [email.trim()]);
    if (res.rows.length === 0) return null;
    return res.rows[0] as UserRecord;
  }

  async getUserById(id: string): Promise<UserRecord | null> {
    const pool = getPgPool();
    const query = `
      SELECT 
        u.id::text,
        u.organization_id::text AS "organizationId",
        u.unit_id::text AS "unitId",
        u.email,
        u.display_name AS "displayName",
        u.password_hash AS "passwordHash",
        u.status,
        COALESCE(r.role_key, 'STAFF') AS "role",
        u.created_at::text AS "createdAt"
      FROM users u
      LEFT JOIN user_roles ur ON ur.user_id = u.id
      LEFT JOIN roles r ON r.id = ur.role_id
      WHERE u.id::text = $1
      LIMIT 1;
    `;
    const res = await pool.query(query, [id]);
    if (res.rows.length === 0) return null;
    return res.rows[0] as UserRecord;
  }

  async getAllUsers(orgId: string): Promise<UserRecord[]> {
    const pool = getPgPool();
    const query = `
      SELECT 
        u.id::text,
        u.organization_id::text AS "organizationId",
        u.unit_id::text AS "unitId",
        u.email,
        u.display_name AS "displayName",
        u.password_hash AS "passwordHash",
        u.status,
        COALESCE(r.role_key, 'STAFF') AS "role",
        u.created_at::text AS "createdAt"
      FROM users u
      LEFT JOIN user_roles ur ON ur.user_id = u.id
      LEFT JOIN roles r ON r.id = ur.role_id
      WHERE u.organization_id::text = $1
      ORDER BY u.created_at ASC;
    `;
    const res = await pool.query(query, [orgId]);
    return res.rows as UserRecord[];
  }

  async updateUserStatus(
    userId: string, 
    status: "ACTIVE" | "DISABLED", 
    actorId: string
  ): Promise<UserRecord | null> {
    const pool = getPgPool();
    const client = await pool.connect();

    try {
      await client.query("BEGIN;");

      const updateRes = await client.query(`
        UPDATE users
        SET status = $1, updated_at = now()
        WHERE id::text = $2
        RETURNING id::text, organization_id::text AS "organizationId", unit_id::text AS "unitId",
                  email, display_name AS "displayName", password_hash AS "passwordHash",
                  status, created_at::text AS "createdAt";
      `, [status, userId]);

      if (updateRes.rows.length === 0) {
        await client.query("ROLLBACK;");
        return null;
      }

      const user = updateRes.rows[0] as UserRecord;

      // Ambil role
      const roleRes = await client.query(`
        SELECT COALESCE(r.role_key, 'STAFF') AS role
        FROM user_roles ur
        JOIN roles r ON r.id = ur.role_id
        WHERE ur.user_id::text = $1
        LIMIT 1;
      `, [userId]);
      user.role = (roleRes.rows[0]?.role || "STAFF") as "SYSTEM_ADMIN" | "STAFF";

      // Catat audit log append-only ke database
      await client.query(`
        INSERT INTO audit_events (organization_id, actor_id, event_type, entity_type, entity_id, event_metadata)
        VALUES ($1::uuid, $2::uuid, 'USER_STATUS_UPDATED', 'user', $3::uuid, $4::jsonb);
      `, [user.organizationId, actorId, userId, JSON.stringify({ newStatus: status })]);

      await client.query("COMMIT;");
      return user;
    } catch (err) {
      await client.query("ROLLBACK;").catch(() => {});
      throw err;
    } finally {
      client.release();
    }
  }

  async getOrganization(): Promise<OrganizationRecord> {
    const pool = getPgPool();
    const query = `
      SELECT 
        id::text,
        legal_name AS "legalName",
        acronym,
        address_placeholder AS "addressPlaceholder",
        true AS "isVerified",
        created_at::text AS "createdAt"
      FROM organizations
      LIMIT 1;
    `;
    const res = await pool.query(query);
    if (res.rows.length > 0) {
      return res.rows[0] as OrganizationRecord;
    }

    return {
      id: "a0000000-0000-4000-8000-000000000001",
      legalName: "Yayasan Pusat Pendidikan dan Penelitian Pembangunan Indonesia",
      acronym: "Yayasan P4I",
      addressPlaceholder: "Kop dan identitas resmi belum diverifikasi pengurus",
      isVerified: false,
    };
  }

  async getLetterTypes(orgId: string): Promise<LetterTypeRecord[]> {
    const pool = getPgPool();
    const query = `
      SELECT 
        lt.id::text,
        lt.organization_id::text AS "organizationId",
        lt.code,
        lt.label,
        COALESCE(lt.priority, 'P0') AS "priority",
        lt.is_active AS "isActive",
        COALESCE(np.is_active, false) AS "numberingPolicyActive"
      FROM letter_types lt
      LEFT JOIN numbering_policies np ON np.id = lt.numbering_policy_id
      WHERE lt.organization_id::text = $1
      ORDER BY lt.code ASC;
    `;
    const res = await pool.query(query, [orgId]);
    return res.rows as LetterTypeRecord[];
  }

  async getLetterTypeById(typeIdOrCode: string): Promise<LetterTypeRecord | null> {
    const pool = getPgPool();
    // Normalisasi kode seperti 'type-magang' -> 'KET-MAGANG' jika ada
    const codeMap: Record<string, string> = {
      "type-magang": "KET-MAGANG",
      "type-tugas": "TUGAS",
      "type-undangan": "UNDANGAN",
      "type-permohonan": "PERMOHONAN",
      "type-pengantar": "PENGANTAR",
    };
    const lookupKey = codeMap[typeIdOrCode.toLowerCase()] || typeIdOrCode;

    const query = `
      SELECT 
        lt.id::text,
        lt.organization_id::text AS "organizationId",
        lt.code,
        lt.label,
        COALESCE(lt.priority, 'P0') AS "priority",
        lt.is_active AS "isActive",
        COALESCE(np.is_active, false) AS "numberingPolicyActive"
      FROM letter_types lt
      LEFT JOIN numbering_policies np ON np.id = lt.numbering_policy_id
      WHERE lt.id::text = $1 OR UPPER(lt.code) = UPPER($1) OR UPPER(lt.code) = UPPER($2)
      LIMIT 1;
    `;
    const res = await pool.query(query, [typeIdOrCode, lookupKey]);
    if (res.rows.length === 0) return null;
    return res.rows[0] as LetterTypeRecord;
  }

  async getAllLetters(
    orgId: string, 
    statusFilter?: string, 
    userContext?: UserContext
  ): Promise<LetterRecord[]> {
    const pool = getPgPool();
    const filter = statusFilter && statusFilter !== "ALL" ? statusFilter : null;

    let query = `
      SELECT 
        l.id::text,
        l.organization_id::text AS "organizationId",
        l.unit_id::text AS "unitId",
        l.letter_type_id::text AS "letterTypeId",
        lt.code AS "letterTypeCode",
        lt.label AS "letterTypeLabel",
        l.author_id::text AS "authorId",
        u.display_name AS "authorName",
        l.subject,
        l.recipient_name AS "recipientName",
        l.classification,
        l.planned_date::text AS "plannedDate",
        l.status,
        l.current_revision_no AS "currentRevisionNo",
        null AS "officialNumber",
        l.created_at::text AS "createdAt",
        l.updated_at::text AS "updatedAt"
      FROM letters l
      JOIN letter_types lt ON lt.id = l.letter_type_id
      JOIN users u ON u.id = l.author_id
      WHERE l.organization_id::text = $1
    `;

    const params: (string | null)[] = [orgId];

    if (filter) {
      params.push(filter);
      query += ` AND l.status = $${params.length}`;
    }

    // PENGUATAN OTORISASI: Surat CONFIDENTIAL hanya dapat dilihat oleh pembuat atau SYSTEM_ADMIN
    if (userContext && userContext.role !== "SYSTEM_ADMIN") {
      params.push(userContext.id);
      query += ` AND (l.classification != 'CONFIDENTIAL' OR l.author_id::text = $${params.length})`;
    }

    query += ` ORDER BY l.updated_at DESC;`;

    const res = await pool.query(query, params);
    return res.rows as LetterRecord[];
  }

  async getLetterById(
    letterId: string, 
    orgId: string, 
    userContext?: UserContext
  ): Promise<LetterRecord | null> {
    const pool = getPgPool();
    const query = `
      SELECT 
        l.id::text,
        l.organization_id::text AS "organizationId",
        l.unit_id::text AS "unitId",
        l.letter_type_id::text AS "letterTypeId",
        lt.code AS "letterTypeCode",
        lt.label AS "letterTypeLabel",
        l.author_id::text AS "authorId",
        u.display_name AS "authorName",
        l.subject,
        l.recipient_name AS "recipientName",
        l.classification,
        l.planned_date::text AS "plannedDate",
        l.status,
        l.current_revision_no AS "currentRevisionNo",
        null AS "officialNumber",
        l.created_at::text AS "createdAt",
        l.updated_at::text AS "updatedAt"
      FROM letters l
      JOIN letter_types lt ON lt.id = l.letter_type_id
      JOIN users u ON u.id = l.author_id
      WHERE l.id::text = $1 AND l.organization_id::text = $2
      LIMIT 1;
    `;
    const res = await pool.query(query, [letterId, orgId]);
    if (res.rows.length === 0) return null;

    const letter = res.rows[0] as LetterRecord;

    // OTORISASI KEPEMILIKAN & KLASIFIKASI:
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
    const pool = getPgPool();
    const query = `
      SELECT 
        lr.id::text,
        lr.letter_id::text AS "letterId",
        lr.version,
        lr.subject,
        lr.recipient_name AS "recipientName",
        lr.classification,
        lr.planned_date::text AS "plannedDate",
        lr.content,
        lr.content_sha256 AS "contentSha256",
        lr.change_summary AS "changeSummary",
        lr.created_by::text AS "createdBy",
        u.display_name AS "createdByName",
        lr.created_at::text AS "createdAt"
      FROM letter_revisions lr
      LEFT JOIN users u ON u.id = lr.created_by
      WHERE lr.letter_id::text = $1
      ORDER BY lr.version ASC;
    `;
    const res = await pool.query(query, [letterId]);
    return res.rows as LetterRevisionRecord[];
  }

  async createDraft(
    data: CreateDraftInput,
    author: UserContext | { id: string; name: string; organizationId: string }
  ): Promise<{ letter: LetterRecord; revision: LetterRevisionRecord }> {
    const letterType = await this.getLetterTypeById(data.letterTypeId);
    if (!letterType) {
      throw new Error("Jenis surat tidak ditemukan.");
    }

    const pool = getPgPool();
    const client = await pool.connect();

    try {
      await client.query("BEGIN;");

      const letterId = crypto.randomUUID();
      const revisionId = crypto.randomUUID();
      const now = new Date().toISOString();
      const contentSha256 = calculateContentHash(data.content || {});
      const authorName = ("name" in author && author.name) ? author.name : (("displayName" in author && author.displayName) ? author.displayName : "Pengguna");

      // 1. Insert letter
      const letterInsertRes = await client.query(`
        INSERT INTO letters (
          id, organization_id, letter_type_id, author_id, subject,
          recipient_name, classification, planned_date, status, current_revision_no,
          created_at, updated_at
        ) VALUES (
          $1::uuid, $2::uuid, $3::uuid, $4::uuid, $5,
          $6, $7, $8::date, 'DRAFT', 1,
          $9::timestamptz, $9::timestamptz
        )
        RETURNING id::text, organization_id::text AS "organizationId", unit_id::text AS "unitId",
                  letter_type_id::text AS "letterTypeId", author_id::text AS "authorId",
                  subject, recipient_name AS "recipientName", classification,
                  planned_date::text AS "plannedDate", status, current_revision_no AS "currentRevisionNo",
                  created_at::text AS "createdAt", updated_at::text AS "updatedAt";
      `, [
        letterId,
        author.organizationId,
        letterType.id,
        author.id,
        data.subject,
        data.recipientName,
        data.classification,
        data.plannedDate,
        now,
      ]);

      // 2. Insert revision v1
      await client.query(`
        INSERT INTO letter_revisions (
          id, letter_id, version, subject, recipient_name,
          classification, planned_date, content, content_sha256, change_summary,
          created_by, created_at
        ) VALUES (
          $1::uuid, $2::uuid, 1, $3, $4,
          $5, $6::date, $7::jsonb, $8, 'Pembuatan draf awal (v1)',
          $9::uuid, $10::timestamptz
        );
      `, [
        revisionId,
        letterId,
        data.subject,
        data.recipientName,
        data.classification,
        data.plannedDate,
        JSON.stringify(data.content || {}),
        contentSha256,
        author.id,
        now,
      ]);

      // 3. Insert audit log
      await client.query(`
        INSERT INTO audit_events (
          organization_id, actor_id, event_type, entity_type, entity_id, event_metadata
        ) VALUES (
          $1::uuid, $2::uuid, 'LETTER_DRAFT_CREATED', 'letter', $3::uuid, $4::jsonb
        );
      `, [
        author.organizationId,
        author.id,
        letterId,
        JSON.stringify({ version: 1, subject: data.subject, sha256: contentSha256 }),
      ]);

      await client.query("COMMIT;");

      const rawLetter = letterInsertRes.rows[0];
      const letter: LetterRecord = {
        ...rawLetter,
        letterTypeCode: letterType.code,
        letterTypeLabel: letterType.label,
        authorName: authorName,
        officialNumber: null,
      };

      const revision: LetterRevisionRecord = {
        id: revisionId,
        letterId,
        version: 1,
        subject: data.subject,
        recipientName: data.recipientName,
        classification: data.classification,
        plannedDate: data.plannedDate,
        content: data.content || {},
        contentSha256,
        changeSummary: "Pembuatan draf awal (v1)",
        createdBy: author.id,
        createdByName: authorName,
        createdAt: now,
      };

      return { letter, revision };
    } catch (err) {
      await client.query("ROLLBACK;").catch(() => {});
      throw err;
    } finally {
      client.release();
    }
  }

  async addRevision(
    letterId: string,
    data: AddRevisionInput,
    author: UserContext
  ): Promise<{ letter: LetterRecord; revision: LetterRevisionRecord }> {
    const pool = getPgPool();
    const client = await pool.connect();

    try {
      await client.query("BEGIN;");

      // Penguncian baris eksplisit FOR UPDATE untuk menjamin konsistensi konkuren
      const selectRes = await client.query(`
        SELECT 
          l.id::text,
          l.organization_id::text AS "organizationId",
          l.unit_id::text AS "unitId",
          l.letter_type_id::text AS "letterTypeId",
          lt.code AS "letterTypeCode",
          lt.label AS "letterTypeLabel",
          l.author_id::text AS "authorId",
          u.display_name AS "authorName",
          l.status,
          l.current_revision_no AS "currentRevisionNo"
        FROM letters l
        JOIN letter_types lt ON lt.id = l.letter_type_id
        JOIN users u ON u.id = l.author_id
        WHERE l.id::text = $1 AND l.organization_id::text = $2
        FOR UPDATE OF l;
      `, [letterId, author.organizationId]);

      if (selectRes.rows.length === 0) {
        await client.query("ROLLBACK;");
        throw new Error("Surat tidak ditemukan.");
      }

      const letterRow = selectRes.rows[0];

      // Verifikasi status draf
      if (letterRow.status !== "DRAFT" && letterRow.status !== "RETURNED") {
        await client.query("ROLLBACK;");
        throw new Error(`Surat dalam status ${letterRow.status} tidak dapat disunting.`);
      }

      // OTORISASI KEPEMILIKAN: Hanya author atau SYSTEM_ADMIN yang berhak menyunting
      if (author.role !== "SYSTEM_ADMIN" && author.id !== letterRow.authorId) {
        await client.query("ROLLBACK;");
        throw new Error("Akses ditolak: Hanya pembuat draf (author) atau administrator yang berhak menyunting draf ini.");
      }

      // CEK KONKURENSI OPTIMISTIK (Jika dikirim oleh client)
      if (data.expectedVersion && data.expectedVersion !== letterRow.currentRevisionNo) {
        await client.query("ROLLBACK;");
        throw new Error(`Konflik revisi: Draf telah diperbarui oleh pengguna lain (versi saat ini: v${letterRow.currentRevisionNo}).`);
      }

      const nextVersion = letterRow.currentRevisionNo + 1;
      const revisionId = crypto.randomUUID();
      const now = new Date().toISOString();
      const contentSha256 = calculateContentHash(data.content || {});
      const summary = data.changeSummary || `Pembaruan revisi ke-${nextVersion}`;

      // Insert revision baru (IMMUTABLE: tidak pernah menimpa)
      await client.query(`
        INSERT INTO letter_revisions (
          id, letter_id, version, subject, recipient_name,
          classification, planned_date, content, content_sha256, change_summary,
          created_by, created_at
        ) VALUES (
          $1::uuid, $2::uuid, $3, $4, $5,
          $6, $7::date, $8::jsonb, $9, $10,
          $11::uuid, $12::timestamptz
        );
      `, [
        revisionId,
        letterId,
        nextVersion,
        data.subject,
        data.recipientName,
        data.classification,
        data.plannedDate,
        JSON.stringify(data.content || {}),
        contentSha256,
        summary,
        author.id,
        now,
      ]);

      // Update metadata surat saat ini
      const updateRes = await client.query(`
        UPDATE letters
        SET current_revision_no = $1,
            subject = $2,
            recipient_name = $3,
            classification = $4,
            planned_date = $5::date,
            updated_at = $6::timestamptz
        WHERE id::text = $7
        RETURNING id::text, organization_id::text AS "organizationId", unit_id::text AS "unitId",
                  letter_type_id::text AS "letterTypeId", author_id::text AS "authorId",
                  subject, recipient_name AS "recipientName", classification,
                  planned_date::text AS "plannedDate", status, current_revision_no AS "currentRevisionNo",
                  created_at::text AS "createdAt", updated_at::text AS "updatedAt";
      `, [
        nextVersion,
        data.subject,
        data.recipientName,
        data.classification,
        data.plannedDate,
        now,
        letterId,
      ]);

      // Catat audit log
      await client.query(`
        INSERT INTO audit_events (
          organization_id, actor_id, event_type, entity_type, entity_id, event_metadata
        ) VALUES (
          $1::uuid, $2::uuid, 'LETTER_REVISION_CREATED', 'letter', $3::uuid, $4::jsonb
        );
      `, [
        author.organizationId,
        author.id,
        letterId,
        JSON.stringify({ version: nextVersion, sha256: contentSha256, changeSummary: summary }),
      ]);

      await client.query("COMMIT;");

      const updated = updateRes.rows[0];
      const letter: LetterRecord = {
        ...updated,
        letterTypeCode: letterRow.letterTypeCode,
        letterTypeLabel: letterRow.letterTypeLabel,
        authorName: letterRow.authorName,
        officialNumber: null,
      };

      const revision: LetterRevisionRecord = {
        id: revisionId,
        letterId,
        version: nextVersion,
        subject: data.subject,
        recipientName: data.recipientName,
        classification: data.classification,
        plannedDate: data.plannedDate,
        content: data.content || {},
        contentSha256,
        changeSummary: summary,
        createdBy: author.id,
        createdByName: author.name,
        createdAt: now,
      };

      return { letter, revision };
    } catch (err) {
      await client.query("ROLLBACK;").catch(() => {});
      throw err;
    } finally {
      client.release();
    }
  }

  async submitForReview(
    letterId: string, 
    author: UserContext
  ): Promise<LetterRecord> {
    const pool = getPgPool();
    const client = await pool.connect();

    try {
      await client.query("BEGIN;");

      const selectRes = await client.query(`
        SELECT 
          l.id::text,
          l.organization_id::text AS "organizationId",
          l.unit_id::text AS "unitId",
          l.letter_type_id::text AS "letterTypeId",
          lt.code AS "letterTypeCode",
          lt.label AS "letterTypeLabel",
          l.author_id::text AS "authorId",
          u.display_name AS "authorName",
          l.subject,
          l.recipient_name AS "recipientName",
          l.classification,
          l.planned_date::text AS "plannedDate",
          l.status,
          l.current_revision_no AS "currentRevisionNo",
          l.created_at::text AS "createdAt"
        FROM letters l
        JOIN letter_types lt ON lt.id = l.letter_type_id
        JOIN users u ON u.id = l.author_id
        WHERE l.id::text = $1 AND l.organization_id::text = $2
        FOR UPDATE OF l;
      `, [letterId, author.organizationId]);

      if (selectRes.rows.length === 0) {
        await client.query("ROLLBACK;");
        throw new Error("Surat tidak ditemukan.");
      }

      const letterRow = selectRes.rows[0];

      // OTORISASI: Hanya pembuat draf atau admin
      if (author.role !== "SYSTEM_ADMIN" && author.id !== letterRow.authorId) {
        await client.query("ROLLBACK;");
        throw new Error("Akses ditolak: Hanya pembuat draf yang berhak mengajukan draf untuk pemeriksaan.");
      }

      if (letterRow.status !== "DRAFT") {
        await client.query("ROLLBACK;");
        throw new Error(`Hanya draf berstatus DRAFT yang dapat diajukan (status saat ini: ${letterRow.status}).`);
      }

      const now = new Date().toISOString();
      await client.query(`
        UPDATE letters
        SET status = 'IN_REVIEW', updated_at = $1::timestamptz
        WHERE id::text = $2;
      `, [now, letterId]);

      await client.query(`
        INSERT INTO audit_events (
          organization_id, actor_id, event_type, entity_type, entity_id, event_metadata
        ) VALUES (
          $1::uuid, $2::uuid, 'LETTER_SUBMITTED_FOR_REVIEW', 'letter', $3::uuid, $4::jsonb
        );
      `, [
        author.organizationId,
        author.id,
        letterId,
        JSON.stringify({ version: letterRow.currentRevisionNo }),
      ]);

      await client.query("COMMIT;");

      return {
        ...letterRow,
        status: "IN_REVIEW",
        officialNumber: null,
        updatedAt: now,
      };
    } catch (err) {
      await client.query("ROLLBACK;").catch(() => {});
      throw err;
    } finally {
      client.release();
    }
  }

  allocateOfficialNumber(): never {
    throw new Error(
      "BLOCKED: Penomoran surat resmi terkunci pada Sprint 1B! " +
      "Syarat pembukaan: verifikasi register arsip lama (D-01), SOP reset nomor (D-02), dan mandat pejabat (D-04) disahkan oleh Pengurus Yayasan."
    );
  }
}
