/** Email növbəsi — sənədlərin / bildirişlərin mailə qoyulması.
 *  Cloud Function `processMailQueue` provayder (Resend/SMTP) ilə göndərir. */
import { createDoc, listDocs } from './firestore';
import { orderBy } from 'firebase/firestore';

export interface MailMessage {
  id: string;
  to?: string | null;          // konkret ünvan(lar), vergüllə
  toRole?: string | null;      // rol üzrə — function user emaillərini həll edir
  subject: string;
  html: string;
  entityType?: string | null;
  entityId?: string | null;
  status: 'pending' | 'sent' | 'failed' | 'no_provider';
  error?: string | null;
  createdAt?: unknown;
  sentAt?: unknown;
}

export interface EnqueueMailInput {
  to?: string;
  toRole?: string;
  subject: string;
  html: string;
  entityType?: string;
  entityId?: string;
}

/** Maili növbəyə qoyur (status=pending). Cloud Function göndərir. */
export function enqueueMail(input: EnqueueMailInput): Promise<string> {
  return createDoc('mail_queue', {
    to: input.to ?? null,
    toRole: input.toRole ?? null,
    subject: input.subject,
    html: input.html,
    entityType: input.entityType ?? null,
    entityId: input.entityId ?? null,
    status: 'pending',
    error: null,
    sentAt: null,
  });
}

export function listMail(): Promise<MailMessage[]> {
  return listDocs<MailMessage>('mail_queue', [orderBy('createdAt', 'desc')]);
}
