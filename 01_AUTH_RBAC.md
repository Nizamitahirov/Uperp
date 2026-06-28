# 01. İSTİFADƏÇİ, ROL VƏ ACCESS MANAGEMENT (RBAC)

> Modullar: #18 User Management, #19 Role Management, #20 Access Management, #23 Gmail login, #24-26 rollar

---

## 1.1 AUTENTİFİKASİYA (Firebase Auth)

### 1.1.1 Giriş üsulları

```yaml
1. Email/Password:
   - Daxili istifadəçilər (admin, anbardar, mühasib, satıcı və s.)
   - Admin tərəfindən yaradılır

2. Google OAuth (Gmail ilə giriş):
   - B2B alıcılar / müştərilər üçün
   - Self-registration (özü qeydiyyat)
   - Giriş etdikdə avtomatik MƏHSUL KATALOQUNA yönləndirilir
   - Default rol: "customer"
```

### 1.1.2 Gmail ilə Giriş Axını (Customer Self-Service)

```
Alıcı "Gmail ilə daxil ol" düyməsinə basır
        ↓
Google OAuth popup
        ↓
İlk dəfədirsə → Firestore-da customer profili yaradılır
   {
     uid, email, displayName, photoURL,
     role: "customer",
     status: "pending" və ya "active",
     createdAt
   }
        ↓
Avtomatik /catalog səhifəsinə yönləndirilir
        ↓
Alıcı məhsul kataloqunu görür (moda jurnalı dizaynı)
        ↓
Sifariş verə bilər (B2B order)
```

> **Qeyd:** Daxili işçilər Google OAuth ilə yox, Email/Password ilə girir. Customer-lər Gmail ilə. Rol bu fərqi müəyyən edir.

### 1.1.3 Session İdarəsi

```yaml
Token: Firebase ID Token (JWT, 1 saat, auto-refresh)
Persistence: local (browser-da qalır) / session (bağlananda silinir)
Auto-logout: 30 dəq aktivlik olmazsa (konfiqurasiya edilə bilən)
Multi-device: icazə verilir, hər cihaz ayrı session
```

---

## 1.2 ROL SİSTEMİ (Role Management)

### 1.2.1 Built-in Rollar

| Rol kodu | Ad (AZ) | Səviyyə | Təsvir |
|----------|---------|---------|--------|
| `director` | Direktor | 10 | Tam idarəetmə, bütün modullar |
| `accountant` | Mühasib | 8 | Maliyyə, mühasibatlıq, hesabatlar |
| `warehouse` | Anbardar | 7 | Material qəbulu, stok, inventarizasiya |
| `production` | İstehsalat Meneceri | 7 | İstehsal, BOM, yuyulma, QC |
| `sales` | Satış Meneceri | 7 | Müştəri, sifariş, qiymət |
| `cashier` | Satıcı/Kassir | 4 | POS, kassa, məhdud müştəri |
| `supply` | Təchizat Meneceri | 7 | Supplier, PO, GRN |
| `customer` | Müştəri (B2B) | 1 | Yalnız kataloq + öz sifarişləri |

### 1.2.2 Dinamik Rol Yaratma (Custom Roles)

Direktor yeni rol yarada bilər:
```javascript
{
  roleId: "production_supervisor",  // auto-slug
  name: "İstehsalat Nəzarətçisi",
  level: 5,
  permissions: {
    // modul: [əməliyyatlar]
    "production_orders": ["read", "update"],
    "quality_control": ["create", "read", "update"],
    "raw_materials": ["read"]
  },
  customLimits: {
    maxApprovalAmount: 1000,  // AZN-dən yuxarı təsdiq lazım
    canApproveDiscount: false
  }
}
```

---

## 1.3 ACCESS CONTROL (Permission Matrix)

### 1.3.1 CRUD Səlahiyyət Matrisi

> **C**=Create, **R**=Read, **U**=Update, **D**=Delete, **—**=Yoxdur, **A**=Approve

| Modul | director | accountant | warehouse | production | sales | cashier | supply | customer |
|-------|:--------:|:----------:|:---------:|:----------:|:-----:|:-------:|:------:|:--------:|
| Dashboard (Executive) | CRUD | R(fin) | R(whse) | R(prod) | R(sales) | — | R(supply) | — |
| User Management | CRUD | — | — | — | — | — | — | — |
| Role Management | CRUD | — | — | — | — | — | — | — |
| Raw Materials | CRUD | R | CRUD | R | — | — | CRUD | — |
| BOM | CRUD | R | R | CRUD | — | — | — | — |
| Suppliers | CRUD | R | R | — | — | — | CRUD | — |
| Customers/CRM | CRUD | R | — | — | CRUD | R | — | R(self) |
| Purchase Order | CRUD+A | R | R | — | — | — | CRUD | — |
| GRN | CRUD | R | CRUD | R | — | — | R | — |
| Production Order | CRUD | R | R | CRUD | — | — | — | — |
| Washing | CRUD | R | R | CRUD | — | — | — | — |
| Quality Control | CRUD | R | R | CRUD | — | — | — | — |
| Finished Goods | CRUD | R | CRUD | CR | R | R | — | R(catalog) |
| Product Catalog | CRUD | R | R | CRU | R | R | — | R |
| Sales Order | CRUD | R | — | — | CRUD | CR | — | CR(self) |
| POS | CRUD | R | — | — | R | CRUD | — | — |
| Kassa (Cash) | CRUD | CRUD | — | — | — | CR | — | — |
| Invoice | CRUD | CRUD | — | — | R | R | — | R(self) |
| AR (Debitor) | CRUD | CRUD | — | — | R | — | — | — |
| AP (Kreditor) | CRUD | CRUD | — | — | — | — | R | — |
| Finance/Accounting | CRUD | CRUD | — | — | — | — | — | — |
| Reports/Analytics | CRUD | CRUD | R(whse) | R(prod) | R(sales) | — | R(supply) | — |
| Notifications | CRUD | R | R | R | R | R | R | — |
| AI Assistant | CRUD | R | R | R | R | R | R | R(limited) |
| Settings | CRUD | — | — | — | — | — | — | — |

### 1.3.2 Firestore Security Rules (nümunə)

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    // Helper: istifadəçinin rolunu al
    function getRole() {
      return get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role;
    }
    function hasRole(roles) {
      return request.auth != null && getRole() in roles;
    }

    // Raw Materials: director, warehouse, supply yaza bilər
    match /raw_materials/{docId} {
      allow read: if hasRole(['director','accountant','warehouse','production','supply']);
      allow create, update: if hasRole(['director','warehouse','supply']);
      allow delete: if hasRole(['director']);
    }

    // Customers: customer yalnız öz datasını oxuyur
    match /customers/{customerId} {
      allow read: if hasRole(['director','accountant','sales','cashier'])
                  || (hasRole(['customer']) && customerId == request.auth.uid);
      allow create, update: if hasRole(['director','sales']);
      allow delete: if hasRole(['director']);
    }

    // Finance: yalnız director və accountant
    match /finance/{docId} {
      allow read, write: if hasRole(['director','accountant']);
    }

    // Catalog: hamı oxuya bilər (customer daxil)
    match /products/{productId} {
      allow read: if request.auth != null;
      allow write: if hasRole(['director','production']);
    }
  }
}
```

---

## 1.4 USER MANAGEMENT (CRUD)

### 1.4.1 İstifadəçi Yaratmaq

**Səlahiyyət:** yalnız `director`

**Forma sahələri:**
```
- Tam ad (full_name) *
- Email * (unikal)
- İstifadəçi adı (username) * (unikal, 5-50, [a-z0-9_])
- Telefon
- Rol * (dropdown)
- Avatar (Firebase Storage upload)
- Status: aktiv/deaktiv
- İlk girişdə parol dəyişmə: bəli/xeyr
```

**Validasiya (Zod schema):**
```typescript
const userSchema = z.object({
  full_name: z.string().min(2).max(100),
  email: z.string().email(),
  username: z.string().min(5).max(50).regex(/^[a-z0-9_]+$/),
  phone: z.string().regex(/^\+994\d{9}$/).optional(),
  role: z.enum(['director','accountant','warehouse','production','sales','cashier','supply']),
  password: z.string().min(8)
    .regex(/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])/),
  is_active: z.boolean().default(true),
});
```

**Avtomatik proseslər:**
1. Firebase Auth-da user yaradılır (`createUserWithEmailAndPassword`)
2. Firestore `users/{uid}` profili yazılır
3. Audit log
4. (Opsional) Email dəvəti göndərilir

### 1.4.2 İstifadəçi Siyahısı

```
Cədvəl: Avatar | Username | Tam ad | Rol(badge) | Status | Son giriş | Əməliyyat
Filtrlər: Rol, Status, Son giriş
Axtarış: username, ad, email
Statistika: Ümumi / Aktiv / Deaktiv / Online
Toplu: deaktiv, export, email
```

### 1.4.3 İstifadəçi Detalları (tablar)
```
1. Ümumi (məlumatlar)
2. Səlahiyyətlər (rol permissions)
3. Aktivlik (son əməliyyatlar - audit log)
4. Login tarixçəsi (cihaz, IP, vaxt)
5. Statistika
```

### 1.4.4 Update / Delete
```
Dəyişə bilər: ad, email, telefon, rol, status, avatar
Dəyişə bilməz: uid, username, createdAt
Parol: ayrı modal (Firebase Auth update)
Silmə: SOFT (is_active=false, tövsiyə) / HARD (Firebase Auth + Firestore)
```

---

## 1.5 AUDIT LOG

Hər kritik əməliyyat loglanır (Firestore `audit_logs` collection):

```typescript
interface AuditLog {
  id: string;
  timestamp: Timestamp;
  userId: string;
  username: string;
  action: 'CREATE' | 'UPDATE' | 'DELETE' | 'LOGIN' | 'LOGOUT' | 'APPROVE' | 'STOCK_MOVE';
  entityType: string;   // 'Material', 'PO', 'Invoice', ...
  entityId: string;
  changes?: { before: any, after: any };  // update üçün
  ipAddress?: string;
  userAgent?: string;
}
```

**Loglanacaq əməliyyatlar:**
- Login/Logout
- Bütün CRUD (material, PO, satış, ödəniş və s.)
- Stok hərəkətləri
- Maliyyə əməliyyatları
- Təsdiqlər (approval)
- Parametr dəyişiklikləri

**Audit hesabat ekranı:** filtr (user, modul, action, tarix aralığı), export.

---

## 1.6 TƏHLÜKƏSİZLİK

```yaml
Parol: bcrypt (Firebase Auth daxili)
Token: Firebase ID Token (JWT, auto-refresh)
HTTPS: Vercel + Firebase (məcburi)
Rate limiting: Firebase App Check
Brute-force: 5 uğursuz cəhd → müvəqqəti blok
2FA (opsional): Firebase Phone Auth / TOTP
Security Rules: rol əsaslı Firestore qaydaları
Secrets: env variables (Vercel), heç vaxt client-də Groq API key
```

---

**Növbəti fayl:** `02_RAW_MATERIAL.md` - Xam Material Anbarı + FIFO/AVCO Costing
