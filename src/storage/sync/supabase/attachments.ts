import { getSupabaseBrowserClient } from '@/storage/sync/supabase/client';
import {
  HOLDFAST_ATTACHMENTS_BUCKET,
  attachmentStoragePath,
} from '@/storage/sync/supabase/schema';

export async function uploadAttachmentBlob(
  userId: string,
  attachmentId: string,
  blob: Blob,
  contentType: string,
): Promise<void> {
  const client = getSupabaseBrowserClient();
  if (!client) {
    throw new Error("Account setup isn't ready yet.");
  }

  const { error } = await client.storage
    .from(HOLDFAST_ATTACHMENTS_BUCKET)
    .upload(attachmentStoragePath(userId, attachmentId), blob, {
      contentType,
      upsert: true,
    });

  if (error) {
    throw new Error("Couldn't upload the attachment yet.");
  }
}

export async function downloadAttachmentBlob(
  userId: string,
  attachmentId: string,
): Promise<Blob> {
  const client = getSupabaseBrowserClient();
  if (!client) {
    throw new Error("Account setup isn't ready yet.");
  }

  const { data, error } = await client.storage
    .from(HOLDFAST_ATTACHMENTS_BUCKET)
    .download(attachmentStoragePath(userId, attachmentId));

  if (error || !data) {
    throw new Error("Couldn't download the attachment.");
  }

  return data;
}

export async function deleteAttachmentBlob(
  userId: string,
  attachmentId: string,
): Promise<void> {
  const client = getSupabaseBrowserClient();
  if (!client) {
    return;
  }

  const { error } = await client.storage
    .from(HOLDFAST_ATTACHMENTS_BUCKET)
    .remove([attachmentStoragePath(userId, attachmentId)]);

  if (error) {
    throw new Error("Couldn't remove the attachment from sync.");
  }
}
