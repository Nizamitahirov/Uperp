# 04. KONTRAGENTLƏR (SUPPLIERS + CUSTOMERS) + CRM

> Modullar: #9 Kontragentlər, #10 CRM, #26 Customer Management

---

## 4.1 KONTRAGENT ANLAYIŞI

İki əsas tip:
- **Supplier (Təchizatçı)** — material aldığımız (Çin, Türkiyə)
- **Customer (Müştəri)** — məhsul satdığımız (B2B topdan, B2C, distribyutor)

Bir kontragent həm supplier, həm customer ola bilər (flag-larla).

---

## 4.2 SUPPLIER (Təchizatçı)

### Data model
```typescript
interface Supplier {
  id: string;
  code: string;              // SUP-0015
  companyName: string;
  country: string;           // China, Türkiye, Azerbaijan
  city: string;
  taxNumber: string;         // TIN/VÖEN

  // Əlaqə
  contactPerson: string;
  position: string;
  phones: string[];
  emails: string[];
  whatsapp?: string;
  wechat?: string;           // Çin supplier-ləri

  // Ünvan
  address: string;
  postalCode?: string;

  // Maliyyə şərtləri
  paymentTerms: number;      // gün
  paymentMethod: 'TT' | 'LC' | 'cash' | 'other';
  currency: string;
  creditLimit: number;
  discountRate: number;

  // Logistika
  leadTimeDays: number;
  incoterms: 'FOB' | 'CIF' | 'EXW' | 'DDP';
  moq: number;
  port?: string;

  // Bank
  bankName?: string;
  iban?: string;
  swift?: string;

  // Performans (hesablanmış)
  rating: number;            // 0-10
  onTimeDeliveryRate: number;
  qualityAcceptRate: number;

  documents: string[];       // lisenziya, ISO, sertifikat
  isActive: boolean;
  createdAt: Timestamp;
}
```

### Supplier Performance (avtomatik hesablanır)
```
Çatdırılma: vaxtında çatdırılma %, orta gecikmə
Keyfiyyət: qəbul dərəcəsi %, qüsur dərəcəsi, geri qaytarma sayı
Maliyyə: ümumi sifariş, orta məbləğ, aktiv borc
Ümumi reytinq: 0-10 (çatdırılma + keyfiyyət + qiymət + əməkdaşlıq)
A/B/C sinif təsnifatı
```

---

## 4.3 CUSTOMER (Müştəri)

### Data model
```typescript
interface Customer {
  id: string;
  code: string;              // CUS-0042
  type: 'wholesale' | 'retail' | 'distributor';

  // Şəxs/Şirkət
  name: string;              // şəxs adı və ya şirkət
  companyName?: string;
  taxNumber?: string;        // VÖEN (B2B)

  // Gmail login (self-service B2B)
  authUid?: string;          // Firebase Auth uid (Gmail ilə)
  email: string;
  photoURL?: string;

  // Əlaqə
  contactPerson?: string;
  phones: string[];
  addresses: Address[];

  // Maliyyə
  creditLimit: number;
  paymentTermDays: number;
  discountRate: number;
  currentBalance: number;    // cari borc (AR)

  // Seqment
  segment: 'VIP' | 'new' | 'high_volume' | 'problem' | 'regular';
  tags: string[];

  status: 'active' | 'passive' | 'blacklist';
  createdAt: Timestamp;
}
```

### Müştəri seqmentləri
```
VIP — yüksək dövriyyə, prioritet
Yeni — son 30 gün
Yüksək həcmli — top alıcılar
Problemli — gecikən ödəniş
Adi — standart
```

---

## 4.4 CRM MODULU

> Müştəri münasibətlərinin idarəsi — sales pipeline, fəaliyyətlər, qeydlər

### 4.4.1 Sales Pipeline (Satış Huni)

```typescript
interface Deal {
  id: string;
  customerId: string;
  title: string;
  stage: 'lead' | 'contacted' | 'quotation' | 'negotiation' | 'won' | 'lost';
  estimatedValue: number;
  probability: number;       // %
  expectedCloseDate: Timestamp;
  assignedTo: string;        // sales user
  products?: string[];       // maraqlandığı məhsullar
  notes: string;
  createdAt: Timestamp;
}
```

Kanban görünüş: Lead → Contacted → Quotation → Negotiation → Won/Lost

### 4.4.2 Fəaliyyətlər (Activities)
```typescript
interface Activity {
  id: string;
  customerId: string;
  type: 'call' | 'email' | 'meeting' | 'note' | 'task';
  subject: string;
  description: string;
  dueDate?: Timestamp;
  completed: boolean;
  assignedTo: string;
  createdAt: Timestamp;
}
```

### 4.4.3 Müştəri 360° Görünüş
```
Tablar:
1. Profil (məlumatlar)
2. Sifarişlər (bütün order tarixçəsi)
3. Ödənişlər (AR vəziyyəti, aging)
4. Fəaliyyətlər (zənglər, görüşlər)
5. Pipeline (aktiv deal-lar)
6. Sənədlər (müqavilə, faktura)
7. AI Insights (Groq: müştəri davranış xülasəsi)
```

### 4.4.4 CRM Avtomatlaşdırma
```
- Ödəniş gecikəndə avtomatik task yaranır
- Yeni müştəri → welcome email (AI draft)
- VIP müştəri → prioritet bildiriş
- Uzun müddət sifariş verməyən → win-back kampaniya təklifi
```

### 4.4.5 AI (Groq) CRM-də
```
- Müştəri email draft (AZ/EN)
- Sifariş tarixçəsindən xülasə
- Müştəri seqmentasiya təklifi
- Növbəti ən yaxşı təklif (cross-sell)
```

---

**Növbəti fayl:** `05_PROCUREMENT.md` - Satınalma (PR → PO → GRN)
