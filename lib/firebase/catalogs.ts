/** Katalog (moda jurnalı) servisi — kolleksiya/sezon jurnalları, publish axını */
import { orderBy, serverTimestamp, where } from 'firebase/firestore';
import { createDoc, deleteDocById, listDocs, updateDocById } from './firestore';
import type { Catalog, CatalogStatus } from '@/types';

const COLLECTION = 'catalogs';

export interface CatalogInput {
  title: { az: string; en: string };
  subtitle?: string;
  season?: string;
  collectionName?: string;
  issueNumber?: string;
  coverProductId?: string;
  productIds: string[];
  status: CatalogStatus;
}

/** Bütün jurnallar (admin) */
export function listCatalogs(): Promise<Catalog[]> {
  return listDocs<Catalog>(COLLECTION, [orderBy('createdAt', 'desc')]);
}

/** Yalnız dərc olunmuş jurnallar (müştəri görünüşü) */
export function listPublishedCatalogs(): Promise<Catalog[]> {
  return listDocs<Catalog>(COLLECTION, [where('status', '==', 'published')]);
}

export function createCatalog(input: CatalogInput): Promise<string> {
  return createDoc(COLLECTION, {
    ...input,
    publishedAt: input.status === 'published' ? serverTimestamp() : null,
  });
}

export function updateCatalog(id: string, input: Partial<CatalogInput>): Promise<void> {
  return updateDocById(COLLECTION, id, input as Record<string, unknown>);
}

/** Jurnalı dərc et / geri çək */
export function setCatalogStatus(id: string, status: CatalogStatus): Promise<void> {
  return updateDocById(COLLECTION, id, {
    status,
    publishedAt: status === 'published' ? serverTimestamp() : null,
  });
}

export function deleteCatalog(id: string): Promise<void> {
  return deleteDocById(COLLECTION, id);
}
