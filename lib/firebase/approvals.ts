/** Təsdiq tələbləri və tapşırıqlar — workflow icra nəticələri */
import { orderBy, type Timestamp } from 'firebase/firestore';
import { listDocs, updateDocById } from './firestore';

export interface ApprovalRequest {
  id: string;
  workflowId: string;
  workflowName: string;
  stepId: string;
  entityType: string;
  entityId?: string | null;
  entityLabel: string;
  actionUrl?: string | null;
  assigneeType: 'role' | 'user';
  assigneeRole?: string | null;
  assigneeUserId?: string | null;
  assigneeUserName?: string | null;
  level: number;
  message?: string | null;
  status: 'pending' | 'approved' | 'rejected' | 'cancelled';
  requestedBy?: { uid: string; username: string };
  decidedBy?: { uid: string; username: string } | null;
  decisionNote?: string | null;
  createdAt?: Timestamp | null;
}

export interface WorkflowTask {
  id: string;
  workflowId: string;
  workflowName: string;
  title: string;
  entityType: string;
  entityId?: string | null;
  entityLabel: string;
  actionUrl?: string | null;
  assigneeType: 'role' | 'user';
  assigneeRole?: string | null;
  assigneeUserId?: string | null;
  assigneeUserName?: string | null;
  status: 'open' | 'done';
  createdAt?: Timestamp | null;
}

export function listApprovals(): Promise<ApprovalRequest[]> {
  return listDocs<ApprovalRequest>('approval_requests', [orderBy('createdAt', 'desc')]);
}
export function listTasks(): Promise<WorkflowTask[]> {
  return listDocs<WorkflowTask>('tasks', [orderBy('createdAt', 'desc')]);
}

export function decideApproval(id: string, status: 'approved' | 'rejected', by: { uid: string; username: string }, note?: string): Promise<void> {
  return updateDocById('approval_requests', id, { status, decidedBy: by, decisionNote: note ?? null });
}
/** Təsdiq tələbini geri çək / ləğv et */
export function cancelApproval(id: string, by: { uid: string; username: string }): Promise<void> {
  return updateDocById('approval_requests', id, { status: 'cancelled', decidedBy: by });
}
export function completeTask(id: string): Promise<void> {
  return updateDocById('tasks', id, { status: 'done' });
}

/** Cari istifadəçiyə aid (rol və ya şəxs) və açıq olanları süzür */
export function isMine(item: { assigneeType: 'role' | 'user'; assigneeRole?: string | null; assigneeUserId?: string | null }, uid?: string, role?: string): boolean {
  if (item.assigneeType === 'user') return !!uid && item.assigneeUserId === uid;
  return !!role && item.assigneeRole === role;
}
