export interface AuditEventData {
  id?: string;
  organizationId: string;
  actorId: string;
  eventType: string;
  entityType: string;
  entityId?: string;
  metadata?: Record<string, unknown>;
  occurredAt?: string;
}

// Memory storage cadangan untuk pengetesan & audit log lokal jika PostgreSQL belum aktif
const memoryAuditLogs: AuditEventData[] = [];

/**
 * Mencatat peristiwa penting ke audit log append-only.
 * Tidak ada fungsi untuk UPDATE atau DELETE.
 */
export async function logAuditEvent(event: AuditEventData): Promise<void> {
  const timestamp = new Date().toISOString();
  const fullEvent = {
    ...event,
    id: event.id || `audit-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`,
    occurredAt: timestamp,
    metadata: event.metadata || {},
  };

  memoryAuditLogs.push(fullEvent);
  console.log(`[AUDIT-LOG] [${timestamp}] Actor=${event.actorId} Event=${event.eventType} Entity=${event.entityType}:${event.entityId || "-"}`);
}

export function getMemoryAuditLogs(): ReadonlyArray<AuditEventData> {
  return [...memoryAuditLogs];
}
