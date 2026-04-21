import {
  SCHEMA_VERSION,
  WORKSPACE_STATE_ROW_ID,
} from '@/domain/constants';
import { nowIso } from '@/domain/dates';
import {
  WorkspaceStateRecordSchema,
  type WorkspaceStateRecord,
} from '@/domain/schemas/records';

export function createDefaultWorkspaceState(): WorkspaceStateRecord {
  const timestamp = nowIso();

  return WorkspaceStateRecordSchema.parse({
    id: WORKSPACE_STATE_ROW_ID,
    schemaVersion: SCHEMA_VERSION,
    ownershipState: 'device-guest',
    boundUserId: null,
    authPromptState: 'none',
    attachState: 'attached',
    createdAt: timestamp,
    updatedAt: timestamp,
  });
}

export function normalizeWorkspaceStateRecord(
  record: unknown,
): WorkspaceStateRecord {
  return WorkspaceStateRecordSchema.parse(record);
}
