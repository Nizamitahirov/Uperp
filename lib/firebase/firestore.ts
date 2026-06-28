import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  type QueryConstraint,
} from 'firebase/firestore';
import { getDb } from './config';

/** Bütün sənədləri (id ilə) gətirir */
export async function listDocs<T>(
  path: string,
  constraints: QueryConstraint[] = [orderBy('createdAt', 'desc')],
): Promise<T[]> {
  const q = query(collection(getDb(), path), ...constraints);
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as object) })) as T[];
}

export async function getDocById<T>(path: string, id: string): Promise<T | null> {
  const snap = await getDoc(doc(getDb(), path, id));
  if (!snap.exists()) return null;
  return { id: snap.id, ...(snap.data() as object) } as T;
}

export async function createDoc(path: string, data: Record<string, unknown>): Promise<string> {
  const ref = await addDoc(collection(getDb(), path), {
    ...data,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return ref.id;
}

export async function updateDocById(path: string, id: string, data: Record<string, unknown>): Promise<void> {
  await updateDoc(doc(getDb(), path, id), { ...data, updatedAt: serverTimestamp() });
}

export async function deleteDocById(path: string, id: string): Promise<void> {
  await deleteDoc(doc(getDb(), path, id));
}
