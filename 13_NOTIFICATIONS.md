# 13. BİLDİRİŞLƏR SİSTEMİ

> Modullar: #7 Overstock, #8 Out-of-stock + ümumi bildiriş sistemi

---

## 13.1 BİLDİRİŞ NÖVLƏRİ

| Hadisə | Severity | Alıcı | Kanal |
|--------|----------|-------|-------|
| Out of stock (xam/hazır) | 🔴 Critical | anbardar, supply, director | push, email, in-app |
| Low stock / reorder | 🟡 Warning | anbardar, supply | in-app, push |
| Overstock | 🟠 Info | director, sales | in-app |
| Yüksək yuyulma itkisi | 🟠 Warning | production | in-app |
| Yeni sifariş | 🔵 Info | sales | push, in-app |
| Ödəniş alındı | 🟢 Success | accountant | in-app |
| Gecikən borc (AR) | 🟡 Warning | accountant, sales | email, in-app |
| Vaxtı çatan ödəniş (AP) | 🟡 Warning | accountant | in-app |
| Təsdiq gözləyir | 🔵 Action | director, finance | push, in-app |
| GRN qəbul edildi | 🟢 Info | finance, production | in-app |
| Production tamamlandı | 🟢 Success | director, sales | in-app |
| PO təsdiqləndi | 🔵 Info | supply | in-app |
| Defect yüksək | 🟡 Warning | production, director | in-app |

---

## 13.2 BİLDİRİŞ DATA MODEL

```typescript
interface Notification {
  id: string;
  type: NotificationType;
  severity: 'critical' | 'warning' | 'info' | 'success' | 'action';
  title: { az: string; en: string };
  message: { az: string; en: string };
  recipientRoles: string[];     // hansı rollar
  recipientUserIds?: string[];  // spesifik istifadəçilər
  entityType?: string;
  entityId?: string;
  actionUrl?: string;           // klik → hara
  isRead: boolean;
  readBy: string[];
  createdAt: Timestamp;
}
```

---

## 13.3 STOK BİLDİRİŞLƏRİ (Trigger-based)

### Out-of-stock & Low-stock (real-time)
```javascript
exports.onStockChange = functions.firestore
  .document('raw_materials/{id}')
  .onUpdate(async (change) => {
    const m = change.after.data();
    const prev = change.before.data();

    // Stok azaldı
    if (m.currentStock < prev.currentStock) {
      if (m.currentStock === 0) {
        await notify({
          type: 'OUT_OF_STOCK', severity: 'critical',
          title: { az: `${m.name} bitdi!`, en: `${m.name} out of stock!` },
          recipientRoles: ['warehouse','supply','director'],
        });
      } else if (m.currentStock <= m.reorderPoint) {
        await notify({
          type: 'LOW_STOCK', severity: 'warning',
          title: { az: `${m.name} azalıb`, en: `${m.name} low stock` },
          recipientRoles: ['warehouse','supply'],
        });
        // Auto PR təklifi
        await suggestPurchaseRequest(m);
      }
    }
  });
```

### Overstock (scheduled, gündəlik)
```javascript
exports.checkOverstock = functions.pubsub
  .schedule('every day 08:00')
  .onRun(async () => {
    const variants = await getAllFinishedGoods();
    for (const v of variants) {
      const daysOfStock = v.currentStock / (v.avgDailySales || 1);
      if (v.currentStock > v.maxStock || daysOfStock > 90) {
        await notify({
          type: 'OVERSTOCK', severity: 'info',
          title: { az: `${v.variantSku} overstock`, en: `${v.variantSku} overstock` },
          message: { 
            az: `Cari: ${v.currentStock}, Max: ${v.maxStock}. Endirim tövsiyə olunur.`,
            en: `Current: ${v.currentStock}, Max: ${v.maxStock}. Markdown recommended.`
          },
          recipientRoles: ['director','sales'],
        });
      }
    }
  });
```

---

## 13.4 BİLDİRİŞ KANALLARI

```yaml
1. In-app (Firestore real-time):
   - Bell icon + badge (oxunmamış sayı)
   - Notification dropdown/panel
   - Real-time (Firestore listener)

2. Push (Firebase Cloud Messaging):
   - Browser push
   - Mobile (PWA)

3. Email:
   - Kritik bildirişlər
   - Gündəlik xülasə (opsional)
   - AI ilə formatlanmış (Groq)
```

---

## 13.5 BİLDİRİŞ MƏRKƏZİ (UI)

```
┌─────────────────────────────────┐
│ 🔔 Bildirişlər (3 yeni)         │
├─────────────────────────────────┤
│ 🔴 Metal Zamok bitdi!           │
│    5 dəq əvvəl    [Bax] [PO yarat]│
├─────────────────────────────────┤
│ 🟡 Denim 12oz azalıb            │
│    1 saat əvvəl  [Bax]          │
├─────────────────────────────────┤
│ 🔵 Yeni sifariş SO-0156         │
│    2 saat əvvəl  [Bax]          │
├─────────────────────────────────┤
│ [Hamısını oxunmuş et]           │
└─────────────────────────────────┘

Filtrlər: hamısı / oxunmamış / növ üzrə
```

---

## 13.6 BİLDİRİŞ TƏNZİMLƏMƏLƏRİ

```
Hər istifadəçi öz tənzimləməsi:
- Hansı növ bildirişlər
- Kanal seçimi (in-app/push/email)
- Səssiz saatlar
- Gündəlik xülasə (bəli/xeyr)
```

---

**Növbəti fayl:** `14_FIREBASE_SCHEMA.md` - Firebase Data Schema
