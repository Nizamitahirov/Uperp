/**
 * Real test üçün bağlı demo data (idempotent — sabit ID-lər).
 *   node scripts/demo-data.mjs
 * Admin SDK security rules-u bypass edir.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import admin from 'firebase-admin';

const __dirname = dirname(fileURLToPath(import.meta.url));
function loadEnv() {
  try {
    const raw = readFileSync(join(__dirname, '..', '.env.local'), 'utf8');
    for (const line of raw.split('\n')) {
      const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
      if (!m) continue;
      let v = m[2];
      if (v.startsWith('"') && v.endsWith('"')) v = v.slice(1, -1);
      if (!process.env[m[1]]) process.env[m[1]] = v;
    }
  } catch {}
}
loadEnv();

admin.initializeApp({
  credential: admin.credential.cert({
    projectId: process.env.FIREBASE_ADMIN_PROJECT_ID,
    clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL,
    privateKey: (process.env.FIREBASE_ADMIN_PRIVATE_KEY || '').replace(/\\n/g, '\n'),
  }),
});
const db = admin.firestore();
const TS = (d) => admin.firestore.Timestamp.fromDate(d);
const now = new Date();
const daysAgo = (n) => new Date(now.getTime() - n * 24 * 3600 * 1000);
const serverNow = admin.firestore.FieldValue.serverTimestamp();

async function set(path, id, data) {
  await db.collection(path).doc(id).set({ ...data, createdAt: data.createdAt ?? serverNow, updatedAt: serverNow }, { merge: true });
}

async function run() {
  console.log('🌱 Demo data yüklənir...\n');

  // ── Təchizatçılar ──────────────────────────────────────
  await set('suppliers', 'sup-001', { code: 'SUP-001', name: 'Türkiyə Denim Tekstil', type: 'company', country: 'Türkiyə', taxNumber: 'TR1234567', contactPerson: 'Mehmet Yılmaz', email: 'info@trdenim.com', phone: '+90 212 555 1010', address: 'İstanbul', paymentTerms: '30 gün', currency: 'USD', rating: 4.5, currentBalance: 0, isActive: true });
  await set('suppliers', 'sup-002', { code: 'SUP-002', name: 'Çin Aksesuar Co.', type: 'company', country: 'Çin', taxNumber: 'CN9988', contactPerson: 'Li Wei', email: 'sales@cnacc.com', phone: '+86 21 8888 2020', address: 'Guangzhou', paymentTerms: 'LC', currency: 'USD', rating: 4.0, currentBalance: 0, isActive: true });
  console.log('✅ 2 təchizatçı');

  // ── Xam materiallar (+ cost layers) ────────────────────
  const materials = [
    { id: 'mat-den-001', code: 'MAT-DEN-001', name: '14oz İndigo Denim', category: 'denim_fabric', unit: 'metr', currentStock: 850, minStock: 1000, reorderPoint: 1200, maxStock: 5000, avgCost: 8.5, costingMethod: 'FIFO', primarySupplierId: 'sup-001' },
    { id: 'mat-thr-001', code: 'MAT-THR-001', name: 'Polyester Sap (qızılı)', category: 'thread', unit: 'metr', currentStock: 8000, minStock: 500, reorderPoint: 1000, maxStock: 20000, avgCost: 0.05, costingMethod: 'AVCO', primarySupplierId: 'sup-001' },
    { id: 'mat-lin-001', code: 'MAT-LIN-001', name: 'Cib Astarı', category: 'lining', unit: 'metr', currentStock: 280, minStock: 300, reorderPoint: 400, maxStock: 2000, avgCost: 1.2, costingMethod: 'FIFO', primarySupplierId: 'sup-001' },
    { id: 'mat-zip-001', code: 'MAT-ZIP-001', name: '15cm Metal Zamok', category: 'zipper', unit: 'ədəd', currentStock: 399, minStock: 500, reorderPoint: 800, maxStock: 5000, avgCost: 0.4, costingMethod: 'FIFO', primarySupplierId: 'sup-002' },
    { id: 'mat-btn-001', code: 'MAT-BTN-001', name: 'Metal Düymə 15mm', category: 'button', unit: 'ədəd', currentStock: 12000, minStock: 10000, reorderPoint: 12000, maxStock: 50000, avgCost: 0.08, costingMethod: 'AVCO', primarySupplierId: 'sup-002' },
    { id: 'mat-riv-001', code: 'MAT-RIV-001', name: 'Mis Rivet', category: 'rivet', unit: 'ədəd', currentStock: 0, minStock: 15000, reorderPoint: 18000, maxStock: 80000, avgCost: 0.02, costingMethod: 'FIFO', primarySupplierId: 'sup-002' },
  ];
  for (const m of materials) {
    await set('raw_materials', m.id, {
      code: m.code, name: m.name, category: m.category, unit: m.unit,
      currentStock: m.currentStock, minStock: m.minStock, reorderPoint: m.reorderPoint, maxStock: m.maxStock,
      avgCost: m.avgCost, lastPurchasePrice: m.avgCost, costingMethod: m.costingMethod, currency: 'AZN',
      stockValue: +(m.currentStock * m.avgCost).toFixed(2), primarySupplierId: m.primarySupplierId, isActive: true,
    });
    if (m.currentStock > 0) {
      await db.collection(`raw_materials/${m.id}/cost_layers`).doc('layer-001').set({
        materialId: m.id, grnId: 'grn-001', originalQty: m.currentStock, remainingQty: m.currentStock,
        unitCost: m.avgCost, isExhausted: false, receivedDate: TS(daysAgo(20)), createdAt: TS(daysAgo(20)),
      }, { merge: true });
    }
  }
  console.log('✅ 6 xam material (+ cost layers)');

  // ── Stok hərəkətləri (nümunə) ──────────────────────────
  await set('stock_movements', 'mv-001', { materialId: 'mat-den-001', materialName: '14oz İndigo Denim', type: 'IN_GRN', quantity: 1000, unitCost: 8.5, totalCost: 8500, balanceAfter: 1000, referenceType: 'GRN', referenceId: 'grn-001', warehouseId: 'main', username: 'director', createdAt: TS(daysAgo(20)) });
  await set('stock_movements', 'mv-002', { materialId: 'mat-den-001', materialName: '14oz İndigo Denim', type: 'OUT_PRODUCTION', quantity: -150, unitCost: 8.5, totalCost: 1275, balanceAfter: 850, referenceType: 'ProductionOrder', referenceId: 'po-prod-001', warehouseId: 'main', username: 'director', createdAt: TS(daysAgo(10)) });
  console.log('✅ stok hərəkətləri');

  // ── Müştərilər ─────────────────────────────────────────
  await set('customers', 'cus-001', { code: 'CUS-001', name: 'Bakı Trade MMC', companyName: 'Bakı Trade MMC', type: 'wholesale', taxNumber: '1700123456', email: 'order@bakitrade.az', contactPerson: 'Elnur Məmmədov', phone: '+994501234567', address: 'Bakı, Nizami küç. 12', creditLimit: 50000, paymentTermDays: 30, discountRate: 10, currentBalance: 0, segment: 'VIP', status: 'active' });
  await set('customers', 'cus-002', { code: 'CUS-002', name: 'Gənclik Mall Butik', type: 'retail', email: 'info@genclikmall.az', phone: '+994557654321', address: 'Bakı, Gənclik', creditLimit: 5000, paymentTermDays: 0, discountRate: 0, currentBalance: 0, segment: 'regular', status: 'active' });
  await set('customers', 'cus-003', { code: 'CUS-003', name: 'Region Distribyutor', companyName: 'Cənub Distribusiya', type: 'distributor', taxNumber: '2900987654', email: 'b2b@cenubdist.az', phone: '+994702223344', address: 'Gəncə', creditLimit: 100000, paymentTermDays: 45, discountRate: 15, currentBalance: 0, segment: 'high_volume', status: 'active' });
  console.log('✅ 3 müştəri');

  // ── Məhsullar ──────────────────────────────────────────
  await set('products', 'prd-001', { sku: 'PRD-001', modelCode: 'JCF-IND-001', name: { az: 'İndigo Classic Fit', en: 'Indigo Classic Fit' }, category: 'men', fit: 'regular', washEffect: 'stone', colorName: 'İndigo', weight: '14oz', collection: '2026 Yaz-Yay', sizes: ['28-30', '32-34', '36-38'], wholesalePrice: 45, retailPrice: 89, cost: 28.5, status: 'active', description: { az: 'Klassik kəsim, stone wash effekti ilə premium indigo denim.', en: 'Classic fit premium indigo denim with stone wash.' }, bomId: 'bom-001' });
  await set('products', 'prd-002', { sku: 'PRD-002', modelCode: 'JSL-BLK-002', name: { az: 'Black Slim Fit', en: 'Black Slim Fit' }, category: 'men', fit: 'slim', washEffect: 'enzyme', colorName: 'Qara', weight: '12oz', collection: '2026 Yaz-Yay', sizes: ['30-32', '32-34'], wholesalePrice: 42, retailPrice: 79, cost: 26, status: 'active', description: { az: 'Slim kəsim, enzyme yumşaq fade.', en: 'Slim fit with soft enzyme fade.' } });
  await set('products', 'prd-003', { sku: 'PRD-003', modelCode: 'JVN-VTG-003', name: { az: 'Vintage Wash', en: 'Vintage Wash' }, category: 'men', fit: 'regular', washEffect: 'heavy_stone', colorName: 'Açıq mavi', weight: '14oz', collection: '2025 Payız', sizes: ['32-34', '36-38'], wholesalePrice: 50, retailPrice: 95, cost: 31, status: 'active', description: { az: 'Vintage heavy stone wash görünüş.', en: 'Vintage heavy stone wash look.' } });
  console.log('✅ 3 məhsul');

  // ── BOM (PRD-001, ölçüyə görə) ─────────────────────────
  const bomItem = (id, code, name, unit, qty, cost, waste) => ({ materialId: id, materialCode: code, materialName: name, unit, quantity: qty, wastagePercentage: waste, totalQuantity: +(qty * (1 + waste / 100)).toFixed(3), unitCost: cost, lineCost: +(qty * (1 + waste / 100) * cost).toFixed(3) });
  const sizeItems = (denim) => [
    bomItem('mat-den-001', 'MAT-DEN-001', '14oz İndigo Denim', 'metr', denim, 8.5, 3),
    bomItem('mat-thr-001', 'MAT-THR-001', 'Polyester Sap', 'metr', 0.5, 0.05, 2),
    bomItem('mat-lin-001', 'MAT-LIN-001', 'Cib Astarı', 'metr', 0.3, 1.2, 2),
    bomItem('mat-zip-001', 'MAT-ZIP-001', '15cm Metal Zamok', 'ədəd', 1, 0.4, 1),
    bomItem('mat-btn-001', 'MAT-BTN-001', 'Metal Düymə', 'ədəd', 5, 0.08, 2),
    bomItem('mat-riv-001', 'MAT-RIV-001', 'Mis Rivet', 'ədəd', 8, 0.02, 1),
  ];
  const sizeBasedItems = { '28-30': sizeItems(1.2), '32-34': sizeItems(1.34), '36-38': sizeItems(1.45) };
  const matCostAvg = (Object.values(sizeBasedItems).reduce((s, items) => s + items.reduce((a, i) => a + i.lineCost, 0), 0)) / 3;
  await set('boms', 'bom-001', { bomNumber: 'BOM-2026-0001', productId: 'prd-001', productName: 'İndigo Classic Fit', version: '1.0', status: 'active', sizeBasedItems, laborCost: 6, laborMinutes: 24, overheadPercentage: 10, packagingCost: 1.5, materialCost: +matCostAvg.toFixed(2), totalCost: +(matCostAvg + 6 + (matCostAvg + 6) * 0.1 + 1.5).toFixed(2) });
  console.log('✅ BOM (size-based)');

  // ── Purchase Order (tamamlanmış) + GRN ─────────────────
  await set('purchase_orders', 'po-001', {
    poNumber: 'PO-2026-0001', supplierId: 'sup-001', supplierName: 'Türkiyə Denim Tekstil', orderDate: TS(daysAgo(25)), expectedDeliveryDate: TS(daysAgo(20)),
    items: [
      { materialId: 'mat-den-001', materialName: '14oz İndigo Denim', materialCode: 'MAT-DEN-001', unit: 'metr', quantity: 1000, unitPrice: 8, discount: 0, lineTotal: 8000, receivedQuantity: 1000 },
      { materialId: 'mat-zip-001', materialName: '15cm Metal Zamok', materialCode: 'MAT-ZIP-001', unit: 'ədəd', quantity: 500, unitPrice: 0.38, discount: 0, lineTotal: 190, receivedQuantity: 500 },
    ],
    subtotal: 8190, customsFee: 200, shippingFee: 300, insuranceFee: 50, otherFees: 0, currency: 'USD', exchangeRate: 1.7, totalAmount: 8740, totalAZN: 14858, landedCostAllocation: 'value', status: 'completed', createdBy: 'director', createdAt: TS(daysAgo(25)),
  });
  await set('grns', 'grn-001', { grnNumber: 'GRN-2026-0001', purchaseOrderId: 'po-001', poNumber: 'PO-2026-0001', supplierId: 'sup-001', supplierName: 'Türkiyə Denim Tekstil', receiptDate: TS(daysAgo(20)), items: [{ materialId: 'mat-den-001', materialName: '14oz İndigo Denim', unit: 'metr', orderedQuantity: 1000, receivedQuantity: 1000, acceptedQuantity: 1000, rejectedQuantity: 0, unitPrice: 8, landedUnitCost: 8.5 }, { materialId: 'mat-zip-001', materialName: '15cm Metal Zamok', unit: 'ədəd', orderedQuantity: 500, receivedQuantity: 500, acceptedQuantity: 500, rejectedQuantity: 0, unitPrice: 0.38, landedUnitCost: 0.4 }], qualityStatus: 'approved', posted: true, receivedBy: 'director', createdAt: TS(daysAgo(20)) });
  console.log('✅ PO + GRN');

  // ── Payable (GRN-dən) ──────────────────────────────────
  await set('payables', 'pay-001', { supplierId: 'sup-001', supplierName: 'Türkiyə Denim Tekstil', purchaseOrderId: 'po-001', grnId: 'grn-001', amount: 14858, paidAmount: 5000, balance: 9858, dueDate: TS(daysAgo(-10)), status: 'partial', createdAt: TS(daysAgo(20)) });
  console.log('✅ kreditor (AP)');

  // ── İstehsal sifarişi (tamamlanmış) ────────────────────
  await set('production_orders', 'po-prod-001', { orderNumber: 'PRD-ORD-2026-0001', productId: 'prd-001', productName: 'İndigo Classic Fit', productSku: 'PRD-001', bomId: 'bom-001', sizeDistribution: { '28-30': 40, '32-34': 60 }, totalQuantity: 100, priority: 'normal', status: 'completed', standardCost: 2850, actualMaterialCost: 1850, actualLaborCost: 600, washingCost: 180, totalActualCost: 2630, producedQuantity: 97, defectQuantity: 3, createdBy: 'director', createdAt: TS(daysAgo(12)) });
  console.log('✅ istehsal sifarişi');

  // ── Hazır məhsul (variantlar) ──────────────────────────
  const fg = [
    { id: 'fg-001', productId: 'prd-001', productName: 'İndigo Classic Fit', sku: 'PRD-001-28-30-A', size: '28-30', stock: 45, max: 150, reorder: 20 },
    { id: 'fg-002', productId: 'prd-001', productName: 'İndigo Classic Fit', sku: 'PRD-001-32-34-A', size: '32-34', stock: 80, max: 150, reorder: 20 },
    { id: 'fg-003', productId: 'prd-001', productName: 'İndigo Classic Fit', sku: 'PRD-001-36-38-A', size: '36-38', stock: 12, max: 100, reorder: 20 },
    { id: 'fg-004', productId: 'prd-002', productName: 'Black Slim Fit', sku: 'PRD-002-30-32-A', size: '30-32', stock: 60, max: 120, reorder: 15 },
    { id: 'fg-005', productId: 'prd-002', productName: 'Black Slim Fit', sku: 'PRD-002-32-34-A', size: '32-34', stock: 5, max: 120, reorder: 15 },
    { id: 'fg-006', productId: 'prd-003', productName: 'Vintage Wash', sku: 'PRD-003-32-34-A', size: '32-34', stock: 350, max: 200, reorder: 30 },
  ];
  for (const v of fg) {
    const reserved = v.id === 'fg-002' ? 20 : 0;
    await set('finished_goods', v.id, { productId: v.productId, productName: v.productName, variantSku: v.sku, size: v.size, grade: 'A', currentStock: v.stock, reservedStock: reserved, availableStock: v.stock - reserved, minStock: v.reorder, maxStock: v.max, reorderPoint: v.reorder, unitCost: 28.5, wholesalePrice: 45, retailPrice: 89, warehouseId: 'finished' });
  }
  console.log('✅ 6 hazır məhsul variantı');

  // ── Satış sifarişləri + faktura + AR ──────────────────
  // SO-001 çatdırılıb (keçən ay), ödənilməyib → AR
  await set('sales_orders', 'so-001', { soNumber: 'SO-2026-0001', customerId: 'cus-001', customerName: 'Bakı Trade MMC', channel: 'wholesale', date: TS(daysAgo(40)), items: [{ variantSku: 'PRD-001-32-34-A', finishedGoodId: 'fg-002', productName: 'İndigo Classic Fit', size: '32-34', grade: 'A', quantity: 50, unitPrice: 45, discount: 10, lineTotal: 2025 }], subtotal: 2250, discountAmount: 225, vatAmount: 364.5, totalAmount: 2389.5, paymentMethod: 'credit', paymentStatus: 'unpaid', paidAmount: 0, status: 'delivered', reserved: true, invoiceId: 'inv-001', createdBy: 'director', createdAt: TS(daysAgo(40)) });
  // SO-002 bu ay çatdırılıb, ödənilib
  await set('sales_orders', 'so-002', { soNumber: 'SO-2026-0002', customerId: 'cus-003', customerName: 'Region Distribyutor', channel: 'wholesale', date: TS(daysAgo(8)), items: [{ variantSku: 'PRD-002-30-32-A', finishedGoodId: 'fg-004', productName: 'Black Slim Fit', size: '30-32', grade: 'A', quantity: 30, unitPrice: 42, discount: 15, lineTotal: 1071 }], subtotal: 1260, discountAmount: 189, vatAmount: 192.78, totalAmount: 1263.78, paymentMethod: 'transfer', paymentStatus: 'paid', paidAmount: 1263.78, status: 'delivered', reserved: true, invoiceId: 'inv-002', createdBy: 'director', createdAt: TS(daysAgo(8)) });
  // SO-003 yeni (rezerv gözləyir)
  await set('sales_orders', 'so-003', { soNumber: 'SO-2026-0003', customerId: 'cus-002', customerName: 'Gənclik Mall Butik', channel: 'retail', date: TS(daysAgo(2)), items: [{ variantSku: 'PRD-001-28-30-A', finishedGoodId: 'fg-001', productName: 'İndigo Classic Fit', size: '28-30', grade: 'A', quantity: 10, unitPrice: 89, discount: 0, lineTotal: 890 }], subtotal: 890, discountAmount: 0, vatAmount: 160.2, totalAmount: 1050.2, paymentMethod: 'cash', paymentStatus: 'unpaid', paidAmount: 0, status: 'new', reserved: false, createdBy: 'director', createdAt: TS(daysAgo(2)) });
  console.log('✅ 3 satış sifarişi');

  // Fakturalar + debitor (AR)
  await set('invoices', 'inv-001', { invoiceNumber: 'INV-2026-0001', type: 'sales', customerId: 'cus-001', customerName: 'Bakı Trade MMC', salesOrderId: 'so-001', subtotal: 2250, vatAmount: 364.5, totalAmount: 2389.5, paidAmount: 0, status: 'unpaid', dueDate: TS(daysAgo(10)), createdAt: TS(daysAgo(40)) });
  await set('invoices', 'inv-002', { invoiceNumber: 'INV-2026-0002', type: 'sales', customerId: 'cus-003', customerName: 'Region Distribyutor', salesOrderId: 'so-002', subtotal: 1260, vatAmount: 192.78, totalAmount: 1263.78, paidAmount: 1263.78, status: 'paid', dueDate: TS(daysAgo(-37)), createdAt: TS(daysAgo(8)) });
  await set('receivables', 'rec-001', { customerId: 'cus-001', customerName: 'Bakı Trade MMC', invoiceId: 'inv-001', invoiceNumber: 'INV-2026-0001', amount: 2389.5, paidAmount: 0, balance: 2389.5, dueDate: TS(daysAgo(10)), status: 'overdue', createdAt: TS(daysAgo(40)) });
  // Müştəri balansı (denormalized)
  await db.collection('customers').doc('cus-001').set({ currentBalance: 2389.5 }, { merge: true });
  console.log('✅ fakturalar + debitor (AR)');

  // ── Kassa əməliyyatları (mövcud kassaya) ───────────────
  const regSnap = await db.collection('cash_registers').limit(1).get();
  if (!regSnap.empty) {
    const reg = regSnap.docs[0];
    await set('cash_transactions', 'ctx-001', { registerId: reg.id, registerName: reg.data().name, type: 'in', category: 'Müştəri ödənişi', amount: 1263.78, currency: 'AZN', description: 'SO-2026-0002 ödənişi', username: 'director', createdAt: TS(daysAgo(8)) });
    await set('cash_transactions', 'ctx-002', { registerId: reg.id, registerName: reg.data().name, type: 'out', category: 'Supplier ödənişi', amount: 5000, currency: 'AZN', description: 'AP qismən ödəniş', username: 'director', createdAt: TS(daysAgo(15)) });
    await reg.ref.set({ currentBalance: 1263.78 - 5000 }, { merge: true });
    console.log('✅ kassa əməliyyatları');
  }

  // ── Xərclər ────────────────────────────────────────────
  await set('expenses', 'exp-001', { expenseNumber: 'EXP-2026-0001', category: 'salary', amount: 4500, currency: 'AZN', paymentMethod: 'transfer', description: 'İstehsal işçiləri əmək haqqı', approvalStatus: 'paid', createdAt: TS(daysAgo(5)) });
  await set('expenses', 'exp-002', { expenseNumber: 'EXP-2026-0002', category: 'rent', amount: 1200, currency: 'AZN', paymentMethod: 'cash', description: 'Anbar icarəsi', approvalStatus: 'approved', createdAt: TS(daysAgo(3)) });
  await set('expenses', 'exp-003', { expenseNumber: 'EXP-2026-0003', category: 'washing', amount: 180, currency: 'AZN', paymentMethod: 'cash', description: 'Kənar laundry (stone wash)', approvalStatus: 'submitted', createdAt: TS(daysAgo(11)) });
  console.log('✅ 3 xərc');

  // ── CRM deals ──────────────────────────────────────────
  await set('deals', 'deal-001', { customerId: 'cus-003', customerName: 'Region Distribyutor', title: 'Payız kolleksiyası topdan', stage: 'negotiation', estimatedValue: 25000, probability: 70 });
  await set('deals', 'deal-002', { customerId: 'cus-001', customerName: 'Bakı Trade MMC', title: 'Yeni model sınaq sifarişi', stage: 'quotation', estimatedValue: 8000, probability: 50 });
  console.log('✅ CRM deals');

  // ── Bildirişlər ────────────────────────────────────────
  await set('notifications', 'ntf-001', { type: 'OUT_OF_STOCK', severity: 'critical', title: { az: 'Mis Rivet bitdi!', en: 'Copper rivet out of stock!' }, message: { az: 'Mis Rivet stoku sıfıra düşdü. Təcili sifariş lazımdır.', en: 'Copper rivet stock is zero.' }, recipientRoles: ['warehouse', 'supply', 'director'], entityType: 'RawMaterial', entityId: 'mat-riv-001', actionUrl: '/materials/mat-riv-001', isRead: false, readBy: [], createdAt: TS(daysAgo(1)) });
  await set('notifications', 'ntf-002', { type: 'LOW_STOCK', severity: 'warning', title: { az: '14oz İndigo Denim azalıb', en: 'Denim low stock' }, message: { az: 'Cari stok: 850 metr. Yenidən sifariş nöqtəsinə çatıb.', en: 'Current stock 850m.' }, recipientRoles: ['warehouse', 'supply'], entityType: 'RawMaterial', entityId: 'mat-den-001', actionUrl: '/materials/mat-den-001', isRead: false, readBy: [], createdAt: TS(daysAgo(1)) });
  await set('notifications', 'ntf-003', { type: 'OVERSTOCK', severity: 'info', title: { az: 'PRD-003-32-34-A overstock', en: 'Overstock' }, message: { az: 'Cari: 350, Maksimum: 200. Endirim tövsiyə olunur.', en: 'Current 350, max 200.' }, recipientRoles: ['director', 'sales'], entityType: 'FinishedGood', entityId: 'fg-006', isRead: false, readBy: [], createdAt: TS(daysAgo(1)) });
  await set('notifications', 'ntf-004', { type: 'NEW_ORDER', severity: 'info', title: { az: 'Yeni sifariş SO-2026-0003', en: 'New order' }, message: { az: 'Gənclik Mall Butik yeni sifariş verdi.', en: 'New order placed.' }, recipientRoles: ['sales', 'director'], entityType: 'SalesOrder', entityId: 'so-003', actionUrl: '/sales/so-003', isRead: false, readBy: [], createdAt: TS(daysAgo(2)) });
  console.log('✅ 4 bildiriş');

  // ── Sayğacları yenilə (gələcək nömrələr toqquşmasın) ───
  const year = now.getFullYear();
  const counters = { [`PO-${year}`]: 1, [`GRN-${year}`]: 1, [`SO-${year}`]: 3, [`INV-${year}`]: 2, [`BOM-${year}`]: 1, [`PRODORD-${year}`]: 1, [`CUS-${year}`]: 3, [`EXP-${year}`]: 3 };
  for (const [key, value] of Object.entries(counters)) {
    await db.collection('counters').doc(key).set({ value, year, updatedAt: Date.now() }, { merge: true });
  }
  console.log('✅ sayğaclar');

  console.log('\n🎉 Demo data hazırdır! Dashboard, materiallar, satış, maliyyə, bildirişlər dolu olmalıdır.');
  process.exit(0);
}

run().catch((e) => { console.error('❌ Xəta:', e.message); process.exit(1); });
