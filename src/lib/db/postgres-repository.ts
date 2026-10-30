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

export class PostgresDatabaseStore implements IDatabaseStore {
  async getHealthStatus(): Promise<DatabaseHealthStatus> {
    const conn = await checkPostgresConnection();
    return {
      connected: conn.connected,
      target: getMaskedDatabaseUrl(),
      mode: "REAL_POSTGRES",
      status: conn.connected ? "CONNECTED" : "UNAVAILABLE",
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
    // Normalisasi kode legacy atau alias jenis surat jika ada
    const codeMap: Record<string, string> = {
      "type-magang": "KETERANGAN",
      "ket-magang": "KETERANGAN",
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

  async submitForApproval(
    letterId: string,
    submitter: UserContext,
    notes?: string
  ): Promise<{ letter: LetterRecord; request: ApprovalRequestRecord }> {
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
      `, [letterId, submitter.organizationId]);

      if (selectRes.rows.length === 0) {
        await client.query("ROLLBACK;");
        throw new Error("Surat tidak ditemukan.");
      }

      const letterRow = selectRes.rows[0];

      // OTORISASI: Hanya pembuat draf atau admin
      if (submitter.role !== "SYSTEM_ADMIN" && submitter.id !== letterRow.authorId) {
        await client.query("ROLLBACK;");
        throw new Error("Akses ditolak: Hanya pembuat draf yang berhak mengajukan draf untuk pemeriksaan.");
      }

      if (
        letterRow.status !== "DRAFT" && 
        letterRow.status !== "CHANGES_REQUESTED" && 
        letterRow.status !== "RETURNED"
      ) {
        await client.query("ROLLBACK;");
        throw new Error(`Hanya draf berstatus DRAFT atau CHANGES_REQUESTED yang dapat diajukan (status saat ini: ${letterRow.status}).`);
      }

      // Ambil revisi terbaru
      const revRes = await client.query(`
        SELECT 
          id::text,
          letter_id::text AS "letterId",
          version,
          content_sha256 AS "contentSha256"
        FROM letter_revisions
        WHERE letter_id::text = $1
        ORDER BY version DESC
        LIMIT 1;
      `, [letterId]);

      if (revRes.rows.length === 0) {
        await client.query("ROLLBACK;");
        throw new Error("Draf surat tidak memiliki catatan revisi.");
      }

      const latestRev = revRes.rows[0];
      const now = new Date().toISOString();

      // Tandai approval request sebelumnya sebagai SUPERSEDED
      await client.query(`
        UPDATE approval_requests
        SET status = 'SUPERSEDED', updated_at = $1::timestamptz
        WHERE letter_id::text = $2 AND status IN ('PENDING', 'IN_REVIEW');
      `, [now, letterId]);

      const reqId = crypto.randomUUID();

      // Buat approval request baru
      const insertReq = await client.query(`
        INSERT INTO approval_requests (
          id, organization_id, letter_id, revision_id, revision_version, content_sha256,
          submitted_by, submitted_at, status, submission_notes, workflow_version, created_at, updated_at
        ) VALUES (
          $1::uuid, $2::uuid, $3::uuid, $4::uuid, $5, $6,
          $7::uuid, $8::timestamptz, 'PENDING', $9, 1, $8::timestamptz, $8::timestamptz
        ) RETURNING 
          id::text,
          organization_id::text AS "organizationId",
          letter_id::text AS "letterId",
          revision_id::text AS "revisionId",
          revision_version AS "revisionVersion",
          content_sha256 AS "contentSha256",
          submitted_by::text AS "submittedBy",
          submitted_at::text AS "submittedAt",
          status,
          submission_notes AS "submissionNotes",
          workflow_version AS "workflowVersion",
          created_at::text AS "createdAt",
          updated_at::text AS "updatedAt";
      `, [
        reqId,
        submitter.organizationId,
        letterId,
        latestRev.id,
        latestRev.version,
        latestRev.contentSha256,
        submitter.id,
        now,
        notes || null
      ]);

      const prevStatus = letterRow.status;

      // Update status draf ke SUBMITTED
      await client.query(`
        UPDATE letters
        SET status = 'SUBMITTED', updated_at = $1::timestamptz
        WHERE id::text = $2;
      `, [now, letterId]);

      // Catat ke letter_status_history
      await client.query(`
        INSERT INTO letter_status_history (
          id, letter_id, revision_id, from_status, to_status, actor_id, reason, metadata, created_at
        ) VALUES (
          gen_random_uuid(), $1::uuid, $2::uuid, $3, 'SUBMITTED', $4::uuid, $5, $6::jsonb, $7::timestamptz
        );
      `, [
        letterId,
        latestRev.id,
        prevStatus,
        submitter.id,
        notes || "Pengajuan draf surat untuk pemeriksaan",
        JSON.stringify({ revisionVersion: latestRev.version, contentSha256: latestRev.contentSha256 }),
        now
      ]);

      // Catat audit event
      await client.query(`
        INSERT INTO audit_events (
          organization_id, actor_id, event_type, entity_type, entity_id, event_metadata
        ) VALUES (
          $1::uuid, $2::uuid, 'LETTER_SUBMITTED_FOR_APPROVAL', 'letter', $3::uuid, $4::jsonb
        );
      `, [
        submitter.organizationId,
        submitter.id,
        letterId,
        JSON.stringify({ requestId: reqId, version: latestRev.version, contentSha256: latestRev.contentSha256 }),
      ]);

      await client.query("COMMIT;");

      const letter: LetterRecord = {
        ...letterRow,
        status: "SUBMITTED",
        officialNumber: null,
        updatedAt: now,
      };

      const request: ApprovalRequestRecord = {
        ...insertReq.rows[0],
        letterSubject: letterRow.subject,
        letterTypeCode: letterRow.letterTypeCode,
        letterTypeLabel: letterRow.letterTypeLabel,
        submittedByName: submitter.name || submitter.displayName,
        submitterName: submitter.name || submitter.displayName,
      };

      return { letter, request };
    } catch (err) {
      await client.query("ROLLBACK;").catch(() => {});
      throw err;
    } finally {
      client.release();
    }
  }

  async getPendingApprovals(
    _reviewer: UserContext,
    orgId: string
  ): Promise<ApprovalRequestRecord[]> {
    const pool = getPgPool();
    const query = `
      SELECT 
        ar.id::text,
        ar.organization_id::text AS "organizationId",
        ar.letter_id::text AS "letterId",
        l.subject AS "letterSubject",
        lt.code AS "letterTypeCode",
        lt.label AS "letterTypeLabel",
        l.author_id::text AS "letterAuthorId",
        ar.revision_id::text AS "revisionId",
        ar.revision_version AS "revisionVersion",
        ar.content_sha256 AS "contentSha256",
        ar.submitted_by::text AS "submittedBy",
        u.display_name AS "submittedByName",
        u.display_name AS "submitterName",
        ar.submitted_at::text AS "submittedAt",
        ar.status,
        ar.submission_notes AS "submissionNotes",
        ar.workflow_version AS "workflowVersion",
        ar.created_at::text AS "createdAt",
        ar.updated_at::text AS "updatedAt"
      FROM approval_requests ar
      JOIN letters l ON l.id = ar.letter_id
      JOIN letter_types lt ON lt.id = l.letter_type_id
      JOIN users u ON u.id = ar.submitted_by
      WHERE ar.organization_id::text = $1 AND ar.status IN ('PENDING', 'IN_REVIEW')
      ORDER BY ar.submitted_at ASC;
    `;
    const res = await pool.query(query, [orgId]);
    return res.rows as ApprovalRequestRecord[];
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
    const pool = getPgPool();
    const reqRes = await pool.query(`
      SELECT 
        ar.id::text,
        ar.organization_id::text AS "organizationId",
        ar.letter_id::text AS "letterId",
        l.subject AS "letterSubject",
        lt.code AS "letterTypeCode",
        lt.label AS "letterTypeLabel",
        l.author_id::text AS "letterAuthorId",
        ar.revision_id::text AS "revisionId",
        ar.revision_version AS "revisionVersion",
        ar.content_sha256 AS "contentSha256",
        ar.submitted_by::text AS "submittedBy",
        u.display_name AS "submittedByName",
        u.display_name AS "submitterName",
        ar.submitted_at::text AS "submittedAt",
        ar.status,
        ar.submission_notes AS "submissionNotes",
        ar.workflow_version AS "workflowVersion",
        ar.created_at::text AS "createdAt",
        ar.updated_at::text AS "updatedAt"
      FROM approval_requests ar
      JOIN letters l ON l.id = ar.letter_id
      JOIN letter_types lt ON lt.id = l.letter_type_id
      JOIN users u ON u.id = ar.submitted_by
      WHERE ar.id::text = $1;
    `, [requestId]);

    if (reqRes.rows.length === 0) return null;
    const request = reqRes.rows[0] as ApprovalRequestRecord;

    if (userContext && userContext.organizationId !== request.organizationId) {
      return null;
    }

    const letter = await this.getLetterById(request.letterId, request.organizationId, userContext);
    if (!letter) return null;

    const revRes = await pool.query(`
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
      JOIN users u ON u.id = lr.created_by
      WHERE lr.id::text = $1;
    `, [request.revisionId]);

    if (revRes.rows.length === 0) return null;
    const revision = revRes.rows[0] as LetterRevisionRecord;

    const stepsRes = await pool.query(`
      SELECT 
        ast.id::text,
        ast.approval_request_id::text AS "approvalRequestId",
        ast.letter_id::text AS "letterId",
        ast.revision_id::text AS "revisionId",
        ast.step_no AS "stepNo",
        ast.reviewer_id::text AS "reviewerId",
        u.display_name AS "reviewerName",
        ast.mandate_id::text AS "mandateId",
        sm.decree_number AS "decreeNumber",
        sm.decree_number AS "mandateDecreeNumber",
        ast.decision,
        ast.decision_content_sha256 AS "decisionContentSha256",
        ast.comments,
        ast.decided_at::text AS "decidedAt"
      FROM approval_steps ast
      JOIN users u ON u.id = ast.reviewer_id
      JOIN signatory_mandates sm ON sm.id = ast.mandate_id
      WHERE ast.approval_request_id::text = $1
      ORDER BY ast.step_no ASC;
    `, [requestId]);

    return {
      request,
      letter,
      revision,
      steps: stepsRes.rows as ApprovalStepRecord[],
    };
  }

  async getApprovalRequestByLetterId(
    letterId: string,
    userContext?: UserContext
  ): Promise<ApprovalRequestRecord | null> {
    const pool = getPgPool();
    const res = await pool.query(`
      SELECT 
        ar.id::text,
        ar.organization_id::text AS "organizationId",
        ar.letter_id::text AS "letterId",
        l.subject AS "letterSubject",
        lt.code AS "letterTypeCode",
        lt.label AS "letterTypeLabel",
        l.author_id::text AS "letterAuthorId",
        ar.revision_id::text AS "revisionId",
        ar.revision_version AS "revisionVersion",
        ar.content_sha256 AS "contentSha256",
        ar.submitted_by::text AS "submittedBy",
        u.display_name AS "submittedByName",
        u.display_name AS "submitterName",
        ar.submitted_at::text AS "submittedAt",
        ar.status,
        ar.submission_notes AS "submissionNotes",
        ar.workflow_version AS "workflowVersion",
        ar.created_at::text AS "createdAt",
        ar.updated_at::text AS "updatedAt"
      FROM approval_requests ar
      JOIN letters l ON l.id = ar.letter_id
      JOIN letter_types lt ON lt.id = l.letter_type_id
      JOIN users u ON u.id = ar.submitted_by
      WHERE ar.letter_id::text = $1
      ORDER BY ar.created_at DESC
      LIMIT 1;
    `, [letterId]);

    if (res.rows.length === 0) return null;
    const req = res.rows[0] as ApprovalRequestRecord;
    if (userContext && userContext.organizationId !== req.organizationId) {
      return null;
    }
    return req;
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
    const pool = getPgPool();
    const client = await pool.connect();

    try {
      await client.query("BEGIN;");

      const selectRes = await client.query(`
        SELECT 
          ar.id::text,
          ar.organization_id::text AS "organizationId",
          ar.letter_id::text AS "letterId",
          ar.revision_id::text AS "revisionId",
          ar.revision_version AS "revisionVersion",
          ar.content_sha256 AS "contentSha256",
          ar.submitted_by::text AS "submittedBy",
          ar.status AS "requestStatus",
          l.author_id::text AS "authorId",
          l.letter_type_id::text AS "letterTypeId",
          lt.code AS "letterTypeCode",
          lt.label AS "letterTypeLabel",
          u.display_name AS "authorName",
          l.subject,
          l.recipient_name AS "recipientName",
          l.classification,
          l.planned_date::text AS "plannedDate",
          l.status AS "letterStatus",
          l.current_revision_no AS "currentRevisionNo",
          l.created_at::text AS "createdAt"
        FROM approval_requests ar
        JOIN letters l ON l.id = ar.letter_id
        JOIN letter_types lt ON lt.id = l.letter_type_id
        JOIN users u ON u.id = l.author_id
        WHERE ar.id::text = $1
        FOR UPDATE OF ar, l;
      `, [requestId]);

      if (selectRes.rows.length === 0) {
        await client.query("ROLLBACK;");
        throw new Error("Permintaan persetujuan tidak ditemukan.");
      }

      const row = selectRes.rows[0];

      if (row.organizationId !== reviewer.organizationId) {
        await client.query("ROLLBACK;");
        throw new Error("Akses ditolak: Organisasi berbeda.");
      }

      if (row.requestStatus !== "PENDING" && row.requestStatus !== "IN_REVIEW") {
        await client.query("ROLLBACK;");
        throw new Error(`Permintaan persetujuan sudah selesai diproses sebelumnya (status: ${row.requestStatus}).`);
      }

      // Anti self-approval
      if (row.authorId === reviewer.id) {
        await client.query("ROLLBACK;");
        throw new Error("Pelanggaran Pemisahan Tugas (Anti Self-Approval): Pembuat draf surat tidak berhak memeriksa atau menyetujui suratnya sendiri.");
      }

      // Comment mandatory
      if (input.decision === "REJECTED" || input.decision === "CHANGES_REQUESTED") {
        if (!input.comments || input.comments.trim().length < 5) {
          await client.query("ROLLBACK;");
          throw new Error("Alasan penolakan atau permintaan perubahan wajib diisi (minimal 5 karakter).");
        }
      }

      // Anti stale
      const revRes = await client.query(`
        SELECT 
          id::text,
          version,
          content_sha256 AS "contentSha256"
        FROM letter_revisions
        WHERE letter_id::text = $1
        ORDER BY version DESC
        LIMIT 1;
      `, [row.letterId]);

      const latestRev = revRes.rows[0];
      if (
        !latestRev || 
        latestRev.version !== row.revisionVersion || 
        latestRev.contentSha256 !== row.contentSha256
      ) {
        await client.query("ROLLBACK;");
        throw new Error(
          `Draf surat telah diperbarui sejak pengajuan pemeriksaan (stale approval). Revisi draf saat ini (v${latestRev?.version}) tidak cocok dengan versi yang diajukan (v${row.revisionVersion}). Pemeriksaan harus diulang.`
        );
      }

      // Mandate check
      let mandateQuery = "";
      let mandateParams: unknown[] = [];
      if (input.mandateId) {
        mandateQuery = `
          SELECT * FROM signatory_mandates 
          WHERE id::text = $1 AND organization_id::text = $2;
        `;
        mandateParams = [input.mandateId, reviewer.organizationId];
      } else {
        mandateQuery = `
          SELECT * FROM signatory_mandates 
          WHERE user_id::text = $1 AND organization_id::text = $2 AND status = 'ACTIVE'
            AND (letter_type_id IS NULL OR letter_type_id::text = $3)
          ORDER BY created_at DESC
          LIMIT 1;
        `;
        mandateParams = [reviewer.id, reviewer.organizationId, row.letterTypeId];
      }

      const mandateRes = await client.query(mandateQuery, mandateParams);
      if (mandateRes.rows.length === 0) {
        await client.query("ROLLBACK;");
        throw new Error("Reviewer tidak memiliki mandat aktif yang sah untuk jenis surat ini (mandat tidak ditemukan, kadaluarsa, dicabut, atau di luar kewenangan jenis surat).");
      }

      const mandate = mandateRes.rows[0];
      if (mandate.letter_type_id && mandate.letter_type_id !== row.letterTypeId) {
        await client.query("ROLLBACK;");
        throw new Error("Mandat tidak mencakup jenis surat ini.");
      }

      const today = new Date().toISOString().slice(0, 10);
      const validFromStr = typeof mandate.valid_from === "string" ? mandate.valid_from : mandate.valid_from.toISOString().slice(0, 10);
      const validToStr = typeof mandate.valid_to === "string" ? mandate.valid_to : mandate.valid_to.toISOString().slice(0, 10);

      if (mandate.status !== "ACTIVE" || validFromStr > today || validToStr < today) {
        await client.query("ROLLBACK;");
        throw new Error("Mandat pejabat reviewer tidak aktif atau telah kadaluarsa.");
      }

      if (input.decision === "APPROVED" && !mandate.can_approve) {
        await client.query("ROLLBACK;");
        throw new Error("Mandat reviewer tidak memiliki kewenangan untuk menyetujui (canApprove = false).");
      }

      const now = new Date().toISOString();

      // Hitung next step no
      const stepCountRes = await client.query(`
        SELECT count(*)::int AS count FROM approval_steps WHERE approval_request_id::text = $1;
      `, [requestId]);
      const nextStepNo = (stepCountRes.rows[0]?.count || 0) + 1;
      const stepId = crypto.randomUUID();

      // Insert step
      await client.query(`
        INSERT INTO approval_steps (
          id, approval_request_id, letter_id, revision_id, step_no, reviewer_id,
          mandate_id, decision, decision_content_sha256, comments, decided_at
        ) VALUES (
          $1::uuid, $2::uuid, $3::uuid, $4::uuid, $5, $6::uuid,
          $7::uuid, $8, $9, $10, $11::timestamptz
        );
      `, [
        stepId,
        requestId,
        row.letterId,
        row.revisionId,
        nextStepNo,
        reviewer.id,
        mandate.id,
        input.decision,
        row.contentSha256,
        input.comments || null,
        now
      ]);

      // Update approval request status
      await client.query(`
        UPDATE approval_requests
        SET status = $1, updated_at = $2::timestamptz
        WHERE id::text = $3;
      `, [input.decision, now, requestId]);

      // Update letter status
      await client.query(`
        UPDATE letters
        SET status = $1, updated_at = $2::timestamptz
        WHERE id::text = $3;
      `, [input.decision, now, row.letterId]);

      // Catat ke letter_status_history
      await client.query(`
        INSERT INTO letter_status_history (
          id, letter_id, revision_id, from_status, to_status, actor_id, reason, metadata, created_at
        ) VALUES (
          gen_random_uuid(), $1::uuid, $2::uuid, $3, $4, $5::uuid, $6, $7::jsonb, $8::timestamptz
        );
      `, [
        row.letterId,
        row.revisionId,
        row.letterStatus,
        input.decision,
        reviewer.id,
        input.comments || `Keputusan ${input.decision} oleh reviewer`,
        JSON.stringify({
          mandateId: mandate.id,
          decreeNumber: mandate.decree_number,
          contentSha256: row.contentSha256,
          stepNo: nextStepNo,
        }),
        now
      ]);

      // Catat audit event
      await client.query(`
        INSERT INTO audit_events (
          organization_id, actor_id, event_type, entity_type, entity_id, event_metadata
        ) VALUES (
          $1::uuid, $2::uuid, $3, 'letter', $4::uuid, $5::jsonb
        );
      `, [
        reviewer.organizationId,
        reviewer.id,
        `LETTER_DECIDED_${input.decision}`,
        row.letterId,
        JSON.stringify({
          requestId,
          decision: input.decision,
          mandateId: mandate.id,
          decreeNumber: mandate.decree_number,
          stepNo: nextStepNo,
        }),
      ]);

      await client.query("COMMIT;");

      const letter: LetterRecord = {
        id: row.letterId,
        organizationId: row.organizationId,
        letterTypeId: row.letterTypeId,
        letterTypeCode: row.letterTypeCode,
        letterTypeLabel: row.letterTypeLabel,
        authorId: row.authorId,
        authorName: row.authorName,
        subject: row.subject,
        recipientName: row.recipientName,
        classification: row.classification,
        plannedDate: row.plannedDate,
        status: input.decision,
        currentRevisionNo: row.currentRevisionNo,
        officialNumber: null,
        createdAt: row.createdAt,
        updatedAt: now,
      };

      const request: ApprovalRequestRecord = {
        id: requestId,
        organizationId: row.organizationId,
        letterId: row.letterId,
        revisionId: row.revisionId,
        revisionVersion: row.revisionVersion,
        contentSha256: row.contentSha256,
        submittedBy: row.submittedBy,
        submittedAt: now,
        status: input.decision,
        workflowVersion: 1,
        createdAt: row.createdAt,
        updatedAt: now,
      };

      const step: ApprovalStepRecord = {
        id: stepId,
        approvalRequestId: requestId,
        letterId: row.letterId,
        revisionId: row.revisionId,
        stepNo: nextStepNo,
        reviewerId: reviewer.id,
        reviewerName: reviewer.name || reviewer.displayName,
        mandateId: mandate.id,
        mandateDecreeNumber: mandate.decree_number,
        decreeNumber: mandate.decree_number,
        decision: input.decision,
        decisionContentSha256: row.contentSha256,
        comments: input.comments,
        decidedAt: now,
      };

      return { letter, request, step };
    } catch (err) {
      await client.query("ROLLBACK;").catch(() => {});
      throw err;
    } finally {
      client.release();
    }
  }

  async getLetterHistory(
    letterId: string,
    _orgId: string,
    _userContext?: UserContext
  ): Promise<LetterStatusHistoryRecord[]> {
    const pool = getPgPool();
    const query = `
      SELECT 
        lsh.id::text,
        lsh.letter_id::text AS "letterId",
        lsh.revision_id::text AS "revisionId",
        lsh.from_status AS "fromStatus",
        lsh.to_status AS "toStatus",
        lsh.actor_id::text AS "actorId",
        u.display_name AS "actorName",
        lsh.reason,
        lsh.metadata,
        lsh.created_at::text AS "createdAt"
      FROM letter_status_history lsh
      JOIN users u ON u.id = lsh.actor_id
      WHERE lsh.letter_id::text = $1
      ORDER BY lsh.created_at ASC;
    `;
    const res = await pool.query(query, [letterId]);
    return res.rows as LetterStatusHistoryRecord[];
  }

  async getSignatoryMandates(
    orgId: string,
    userId?: string
  ): Promise<SignatoryMandateRecord[]> {
    const pool = getPgPool();
    let query = `
      SELECT 
        sm.id::text,
        sm.organization_id::text AS "organizationId",
        sm.user_id::text AS "userId",
        u.display_name AS "userName",
        u.email AS "userEmail",
        sm.letter_type_id::text AS "letterTypeId",
        lt.code AS "letterTypeCode",
        lt.label AS "letterTypeLabel",
        sm.unit_id::text AS "unitId",
        ou.name AS "unitName",
        sm.can_review AS "canReview",
        sm.can_approve AS "canApprove",
        sm.can_sign AS "canSign",
        sm.valid_from::text AS "validFrom",
        sm.valid_to::text AS "validTo",
        sm.status,
        sm.decree_number AS "decreeNumber",
        sm.notes,
        sm.created_at::text AS "createdAt",
        sm.updated_at::text AS "updatedAt"
      FROM signatory_mandates sm
      JOIN users u ON u.id = sm.user_id
      LEFT JOIN letter_types lt ON lt.id = sm.letter_type_id
      LEFT JOIN org_units ou ON ou.id = sm.unit_id
      WHERE sm.organization_id::text = $1
    `;
    const params: unknown[] = [orgId];

    if (userId) {
      params.push(userId);
      query += ` AND sm.user_id::text = $2`;
    }

    query += ` ORDER BY sm.created_at DESC;`;

    const res = await pool.query(query, params);
    return res.rows as SignatoryMandateRecord[];
  }

  async getMandateById(
    mandateId: string,
    orgId: string
  ): Promise<SignatoryMandateRecord | null> {
    const pool = getPgPool();
    const query = `
      SELECT 
        sm.id::text,
        sm.organization_id::text AS "organizationId",
        sm.user_id::text AS "userId",
        u.display_name AS "userName",
        u.email AS "userEmail",
        sm.letter_type_id::text AS "letterTypeId",
        lt.code AS "letterTypeCode",
        lt.label AS "letterTypeLabel",
        sm.unit_id::text AS "unitId",
        ou.name AS "unitName",
        sm.can_review AS "canReview",
        sm.can_approve AS "canApprove",
        sm.can_sign AS "canSign",
        sm.valid_from::text AS "validFrom",
        sm.valid_to::text AS "validTo",
        sm.status,
        sm.decree_number AS "decreeNumber",
        sm.notes,
        sm.created_at::text AS "createdAt",
        sm.updated_at::text AS "updatedAt"
      FROM signatory_mandates sm
      JOIN users u ON u.id = sm.user_id
      LEFT JOIN letter_types lt ON lt.id = sm.letter_type_id
      LEFT JOIN org_units ou ON ou.id = sm.unit_id
      WHERE sm.id::text = $1 AND sm.organization_id::text = $2
      LIMIT 1;
    `;
    const res = await pool.query(query, [mandateId, orgId]);
    if (res.rows.length === 0) return null;
    return res.rows[0] as SignatoryMandateRecord;
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

    const pool = getPgPool();
    const id = crypto.randomUUID();
    const now = new Date().toISOString();

    const insertRes = await pool.query(`
      INSERT INTO signatory_mandates (
        id, organization_id, user_id, letter_type_id, unit_id,
        can_review, can_approve, can_sign, valid_from, valid_to,
        status, decree_number, notes, created_at, updated_at
      ) VALUES (
        $1::uuid, $2::uuid, $3::uuid, $4, $5,
        $6, $7, $8, $9::date, $10::date,
        'ACTIVE', $11, $12, $13::timestamptz, $13::timestamptz
      ) RETURNING 
        id::text,
        organization_id::text AS "organizationId",
        user_id::text AS "userId",
        letter_type_id::text AS "letterTypeId",
        unit_id::text AS "unitId",
        can_review AS "canReview",
        can_approve AS "canApprove",
        can_sign AS "canSign",
        valid_from::text AS "validFrom",
        valid_to::text AS "validTo",
        status,
        decree_number AS "decreeNumber",
        notes,
        created_at::text AS "createdAt",
        updated_at::text AS "updatedAt";
    `, [
      id,
      actor.organizationId,
      data.userId,
      data.letterTypeId || null,
      data.unitId || null,
      data.canReview ?? true,
      data.canApprove,
      data.canSign ?? false,
      data.validFrom,
      data.validTo,
      data.decreeNumber.trim(),
      data.notes || null,
      now
    ]);

    const userRes = await pool.query("SELECT display_name, email FROM users WHERE id::text = $1", [data.userId]);
    const userRow = userRes.rows[0];

    return {
      ...insertRes.rows[0],
      userName: userRow?.display_name || "Pengguna",
      userEmail: userRow?.email || "",
      letterTypeCode: null,
      letterTypeLabel: null,
      unitName: null,
    };
  }

  async updateSignatoryMandate(
    mandateId: string,
    data: UpdateMandateInput,
    actor: UserContext
  ): Promise<SignatoryMandateRecord | null> {
    if (actor.role !== "SYSTEM_ADMIN" && actor.role !== "PENGURUS_YAYASAN") {
      throw new Error("Akses ditolak: Hanya administrator sistem atau pengurus yayasan yang berhak memperbarui mandat.");
    }

    const current = await this.getMandateById(mandateId, actor.organizationId);
    if (!current) return null;

    const pool = getPgPool();
    const now = new Date().toISOString();

    const canReview = data.canReview !== undefined ? data.canReview : current.canReview;
    const canApprove = data.canApprove !== undefined ? data.canApprove : current.canApprove;
    const canSign = data.canSign !== undefined ? data.canSign : current.canSign;
    const validFrom = data.validFrom || current.validFrom;
    const validTo = data.validTo || current.validTo;
    const status = data.status || current.status;
    const decreeNumber = data.decreeNumber ? data.decreeNumber.trim() : current.decreeNumber;
    const notes = data.notes !== undefined ? data.notes : current.notes;

    const updateRes = await pool.query(`
      UPDATE signatory_mandates
      SET 
        can_review = $1,
        can_approve = $2,
        can_sign = $3,
        valid_from = $4::date,
        valid_to = $5::date,
        status = $6,
        decree_number = $7,
        notes = $8,
        updated_at = $9::timestamptz
      WHERE id::text = $10 AND organization_id::text = $11
      RETURNING 
        id::text,
        organization_id::text AS "organizationId",
        user_id::text AS "userId",
        letter_type_id::text AS "letterTypeId",
        unit_id::text AS "unitId",
        can_review AS "canReview",
        can_approve AS "canApprove",
        can_sign AS "canSign",
        valid_from::text AS "validFrom",
        valid_to::text AS "validTo",
        status,
        decree_number AS "decreeNumber",
        notes,
        created_at::text AS "createdAt",
        updated_at::text AS "updatedAt";
    `, [
      canReview,
      canApprove,
      canSign,
      validFrom,
      validTo,
      status,
      decreeNumber,
      notes,
      now,
      mandateId,
      actor.organizationId
    ]);

    if (updateRes.rows.length === 0) return null;

    return {
      ...updateRes.rows[0],
      userName: current.userName,
      userEmail: current.userEmail,
      letterTypeCode: current.letterTypeCode,
      letterTypeLabel: current.letterTypeLabel,
      unitName: current.unitName,
    };
  }

  allocateOfficialNumber(): never {
    throw new Error(
      "BLOCKED: Penomoran surat resmi terkunci pada Sprint 1B! " +
      "Syarat pembukaan: verifikasi register arsip lama (D-01), SOP reset nomor (D-02), dan mandat pejabat (D-04) disahkan oleh Pengurus Yayasan."
    );
  }
}
