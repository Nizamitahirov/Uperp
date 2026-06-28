import { addDoc, collection, doc, serverTimestamp, Timestamp, updateDoc } from 'firebase/firestore';
import { getDb } from './config';
import { nextNumber } from './counters';
import { logAudit } from './audit';
import { allocateLandedCost } from '@/lib/costing';
import { postGRN } from './stock';
import { createNotification } from './notifications';
import type { GRN, POItem, PoStatus, PurchaseOrder } from '@/types';
import type { PurchaseOrderFormValues } from '@/lib/validations';

interface Actor {
  uid: string;
  username: string;
}

/** PO sətir cəmini hesablayır (endirimlə) */
export function lineTotal(quantity: number, unitPrice: number, discount = 0): number {
  return quantity * unitPrice * (1 - (discount || 0) / 100);
}

/** PO maliyyə yekunlarını hesablayır */
export function computePOTotals(values: PurchaseOrderFormValues) {
  const subtotal = values.items.reduce((s, i) => s + lineTotal(i.quantity, i.unitPrice, i.discount), 0);
  const extras =
    (values.customsFee || 0) + (values.shippingFee || 0) + (values.insuranceFee || 0) + (values.otherFees || 0);
  const totalAmount = subtotal + extras;
  const totalAZN = totalAmount * (values.exchangeRate || 1);
  return { subtotal, extras, totalAmount, totalAZN };
}

/** Yeni Purchase Order yaradır (05 §5.3) */
export async function createPurchaseOrder(
  values: PurchaseOrderFormValues,
  supplierName: string,
  actor: Actor,
): Promise<string> {
  const poNumber = await nextNumber('PO');
  const { subtotal, totalAmount, totalAZN } = computePOTotals(values);

  const items: POItem[] = values.items.map((i) => ({
    materialId: i.materialId,
    materialName: i.materialName,
    materialCode: i.materialCode,
    unit: i.unit,
    quantity: i.quantity,
    unitPrice: i.unitPrice,
    discount: i.discount ?? 0,
    lineTotal: lineTotal(i.quantity, i.unitPrice, i.discount),
    receivedQuantity: 0,
  }));

  const data = {
    poNumber,
    supplierId: values.supplierId,
    supplierName,
    orderDate: serverTimestamp(),
    expectedDeliveryDate: values.expectedDeliveryDate ? Timestamp.fromDate(new Date(values.expectedDeliveryDate)) : null,
    items,
    subtotal,
    customsFee: values.customsFee,
    shippingFee: values.shippingFee,
    insuranceFee: values.insuranceFee,
    otherFees: values.otherFees,
    currency: values.currency,
    exchangeRate: values.exchangeRate,
    totalAmount,
    totalAZN,
    landedCostAllocation: values.landedCostAllocation,
    incoterms: values.incoterms || null,
    notes: values.notes || null,
    status: 'draft' as PoStatus,
    createdBy: actor.uid,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  const ref = await addDoc(collection(getDb(), 'purchase_orders'), data);
  await logAudit({ userId: actor.uid, username: actor.username, action: 'CREATE', entityType: 'PO', entityId: ref.id });
  return ref.id;
}

/** PO statusunu dəyişir */
export async function updatePOStatus(poId: string, status: PoStatus, actor: Actor): Promise<void> {
  await updateDoc(doc(getDb(), 'purchase_orders', poId), { status, updatedAt: serverTimestamp() });
  await logAudit({
    userId: actor.uid,
    username: actor.username,
    action: status === 'approved' ? 'APPROVE' : 'UPDATE',
    entityType: 'PO',
    entityId: poId,
  });
  if (status === 'approved') {
    await createNotification({
      type: 'PO_APPROVED',
      severity: 'info',
      title: { az: 'PO təsdiqləndi', en: 'PO approved' },
      message: { az: 'Satınalma sifarişi təsdiqləndi.', en: 'Purchase order approved.' },
      recipientRoles: ['supply'],
      entityType: 'PO',
      entityId: poId,
    });
  }
}

/**
 * GRN yaradır, landed cost paylayır, stoka daxil edir (postGRN) və PO statusunu yeniləyir.
 * GRNItem.acceptedQuantity və receivedQuantity çağıran tərəfdən gəlir.
 */
export async function createAndPostGRN(
  po: PurchaseOrder,
  receivedItems: { materialId: string; receivedQuantity: number; acceptedQuantity: number; rejectedQuantity: number; batchNumber?: string; warehouseLocation?: string }[],
  meta: { trackingNumber?: string; carrier?: string; containerNumber?: string; notes?: string },
  actor: Actor,
): Promise<string> {
  const db = getDb();
  const grnNumber = await nextNumber('GRN');

  // Landed cost paylanması — PO əlavə xərclərini qəbul edilən dəyərə görə payla
  const extras = (po.customsFee || 0) + (po.shippingFee || 0) + (po.insuranceFee || 0) + (po.otherFees || 0);
  const itemsForAlloc = receivedItems
    .map((ri) => {
      const poItem = po.items.find((p) => p.materialId === ri.materialId);
      return { ri, poItem };
    })
    .filter((x) => x.poItem);

  const landed = allocateLandedCost(
    itemsForAlloc.map((x) => ({ quantity: x.ri.acceptedQuantity, unitPrice: x.poItem!.unitPrice })),
    extras,
    po.landedCostAllocation ?? 'value',
  );

  const grnItems = itemsForAlloc.map((x, idx) => ({
    materialId: x.poItem!.materialId,
    materialName: x.poItem!.materialName,
    unit: x.poItem!.unit,
    orderedQuantity: x.poItem!.quantity,
    receivedQuantity: x.ri.receivedQuantity,
    acceptedQuantity: x.ri.acceptedQuantity,
    rejectedQuantity: x.ri.rejectedQuantity,
    unitPrice: x.poItem!.unitPrice,
    landedUnitCost: landed[idx],
    batchNumber: x.ri.batchNumber ?? null,
    warehouseLocation: x.ri.warehouseLocation ?? null,
  }));

  const anyRejected = grnItems.some((i) => (i.rejectedQuantity ?? 0) > 0);
  const grnData = {
    grnNumber,
    purchaseOrderId: po.id,
    poNumber: po.poNumber,
    supplierId: po.supplierId,
    supplierName: po.supplierName ?? null,
    receiptDate: serverTimestamp(),
    trackingNumber: meta.trackingNumber || null,
    containerNumber: meta.containerNumber || null,
    carrier: meta.carrier || null,
    items: grnItems,
    qualityStatus: anyRejected ? 'partial' : 'approved',
    notes: meta.notes || null,
    receivedBy: actor.uid,
    posted: false,
    createdAt: serverTimestamp(),
  };

  const grnRef = await addDoc(collection(db, 'grns'), grnData);
  const grn = { id: grnRef.id, ...grnData } as unknown as GRN;

  // Stoka daxil et (cost layers + movements + bildiriş)
  await postGRN(grn, actor);
  await updateDoc(grnRef, { posted: true });

  // PO sətirlərində receivedQuantity yenilə və status hesabla
  const updatedItems = po.items.map((p) => {
    const ri = receivedItems.find((r) => r.materialId === p.materialId);
    return ri ? { ...p, receivedQuantity: (p.receivedQuantity ?? 0) + ri.acceptedQuantity } : p;
  });
  const fullyReceived = updatedItems.every((p) => (p.receivedQuantity ?? 0) >= p.quantity);
  const newStatus: PoStatus = fullyReceived ? 'completed' : 'partially_received';

  await updateDoc(doc(db, 'purchase_orders', po.id), {
    items: updatedItems,
    status: newStatus,
    updatedAt: serverTimestamp(),
  });

  await logAudit({ userId: actor.uid, username: actor.username, action: 'CREATE', entityType: 'GRN', entityId: grnRef.id });
  return grnRef.id;
}
