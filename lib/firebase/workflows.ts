/** Workflow (avtomatlaşdırma) servisi — CRUD + status idarəsi */
import { orderBy } from 'firebase/firestore';
import { createDoc, deleteDocById, listDocs, updateDocById } from './firestore';
import type { Workflow, WorkflowStatus } from '@/types';

const COLLECTION = 'workflows';

/** undefined sahələri null-a çevirir (Firestore undefined qəbul etmir) */
function clean<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj, (_k, v) => (v === undefined ? null : v)));
}

export type WorkflowInput = Omit<Workflow, 'id' | 'createdAt' | 'updatedAt' | 'runCount' | 'lastRunAt'>;

export function listWorkflows(): Promise<Workflow[]> {
  return listDocs<Workflow>(COLLECTION, [orderBy('createdAt', 'desc')]);
}

export function createWorkflow(input: WorkflowInput): Promise<string> {
  return createDoc(COLLECTION, { ...clean(input), runCount: 0, lastRunAt: null });
}

export function updateWorkflow(id: string, input: Partial<WorkflowInput>): Promise<void> {
  return updateDocById(COLLECTION, id, clean(input) as Record<string, unknown>);
}

export function setWorkflowStatus(id: string, status: WorkflowStatus): Promise<void> {
  return updateDocById(COLLECTION, id, { status });
}

export function deleteWorkflow(id: string): Promise<void> {
  return deleteDocById(COLLECTION, id);
}
