/**
 * Pièces justificatives — stockage SÉCURISÉ (mode Supabase). Le binaire va dans
 * le bucket PRIVÉ `justificatifs` (jamais public) ; les métadonnées dans la table
 * `attachments` (protégée par RLS). La lecture passe par une URL SIGNÉE à durée
 * limitée. En mode local, les pièces restent en data URL (cf. EntrySheet).
 *
 * Exercé end-to-end uniquement avec un projet Supabase configuré.
 */
import type { Attachment } from '../shared/types/domain.ts';
import { getSupabase } from '../lib/supabase.ts';
import { createUuid } from '../shared/lib/id.ts';
import { attachmentPath } from './supabaseMappers.ts';

const BUCKET = 'justificatifs';

/** Téléverse un fichier + insère ses métadonnées. Rollback si l'insert échoue. */
export async function uploadAttachment(
  entryId: string,
  file: File
): Promise<Attachment> {
  const sb = getSupabase();
  const id = createUuid();
  const path = attachmentPath(entryId, id, file.name);

  const up = await sb.storage
    .from(BUCKET)
    .upload(path, file, { upsert: false, contentType: file.type || undefined });
  if (up.error) throw new Error(up.error.message);

  const { error } = await sb.from('attachments').insert({
    id,
    entry_id: entryId,
    name: file.name,
    mime: file.type || null,
    size: file.size,
    storage_path: path,
  });
  if (error) {
    await sb.storage.from(BUCKET).remove([path]); // rollback du binaire
    throw new Error(error.message);
  }

  return {
    id,
    name: file.name,
    mime: file.type,
    size: file.size,
    storagePath: path,
    uploadedAt: Date.now(),
  };
}

/** URL signée (temporaire) pour consulter un justificatif du bucket privé. */
export async function signedUrl(
  path: string,
  expiresIn = 600
): Promise<string> {
  const { data, error } = await getSupabase()
    .storage.from(BUCKET)
    .createSignedUrl(path, expiresIn);
  if (error || !data) throw new Error(error?.message ?? 'URL indisponible');
  return data.signedUrl;
}

/** Supprime le binaire + la ligne de métadonnées. */
export async function removeAttachmentRemote(att: Attachment): Promise<void> {
  const sb = getSupabase();
  if (att.storagePath) await sb.storage.from(BUCKET).remove([att.storagePath]);
  await sb.from('attachments').delete().eq('id', att.id);
}
