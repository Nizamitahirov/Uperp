import { addDoc, collection, doc, serverTimestamp, updateDoc, arrayUnion } from 'firebase/firestore';
import { getDb } from './config';
import type { AppNotification, NotificationSeverity, RawMaterial } from '@/types';
import { getStockStatus } from '@/lib/utils/stock';

interface NotifyInput {
  type: string;
  severity: NotificationSeverity;
  title: { az: string; en: string };
  message: { az: string; en: string };
  recipientRoles: string[];
  entityType?: string;
  entityId?: string;
  actionUrl?: string;
}

/** Yeni bildiriş yaradır (13 §13.2) */
export async function createNotification(input: NotifyInput): Promise<void> {
  try {
    await addDoc(collection(getDb(), 'notifications'), {
      ...input,
      isRead: false,
      readBy: [],
      createdAt: serverTimestamp(),
    });
  } catch (err) {
    console.error('Bildiriş yaradıla bilmədi:', err);
  }
}

/** Bildirişi cari istifadəçi üçün oxunmuş işarələ */
export async function markNotificationRead(id: string, uid: string): Promise<void> {
  await updateDoc(doc(getDb(), 'notifications', id), { isRead: true, readBy: arrayUnion(uid) });
}

/**
 * Material stok səviyyəsini yoxlayır və lazım gəldikdə bildiriş yaradır
 * (out-of-stock / low-stock — 13 §13.3). Stok azalandan sonra çağırılır.
 */
export async function checkStockLevel(material: Pick<RawMaterial, 'id' | 'name' | 'currentStock' | 'minStock' | 'reorderPoint'>): Promise<void> {
  const status = getStockStatus(material);
  if (status === 'out') {
    await createNotification({
      type: 'OUT_OF_STOCK',
      severity: 'critical',
      title: { az: `${material.name} bitdi!`, en: `${material.name} out of stock!` },
      message: {
        az: `${material.name} materialının stoku sıfıra düşdü. Təcili sifariş lazımdır.`,
        en: `${material.name} stock dropped to zero. Urgent reorder required.`,
      },
      recipientRoles: ['warehouse', 'supply', 'director'],
      entityType: 'RawMaterial',
      entityId: material.id,
      actionUrl: `/materials/${material.id}`,
    });
  } else if (status === 'critical' || status === 'low') {
    await createNotification({
      type: 'LOW_STOCK',
      severity: 'warning',
      title: { az: `${material.name} azalıb`, en: `${material.name} low stock` },
      message: {
        az: `Cari stok: ${material.currentStock}. Yenidən sifariş nöqtəsinə çatıb.`,
        en: `Current stock: ${material.currentStock}. Reorder point reached.`,
      },
      recipientRoles: ['warehouse', 'supply'],
      entityType: 'RawMaterial',
      entityId: material.id,
      actionUrl: `/materials/${material.id}`,
    });
  }
}

export type { AppNotification };
