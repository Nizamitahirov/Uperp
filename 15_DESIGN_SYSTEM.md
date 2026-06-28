# 15. UI/UX DİZAYN SİSTEMİ

> Mobile-friendly, Birtask/Gradex referansı, moda jurnalı estetikası

---

## 15.1 DİZAYN PRİNSİPLƏRİ

```
1. Mobile-first responsive (telefon → planşet → desktop)
2. Təmiz, modern, minimalist (Birtask estetikası)
3. Data-rich komponentlər (Gradex - cədvəllər, dashboard)
4. Moda jurnalı estetikası (məhsul kataloqu - Vogue-style)
5. Azərbaycan dili UI (qrammatik düzgün)
6. Tutarlı (consistent) - design tokens
7. Əlçatan (accessible) - kontrast, klaviatura
```

---

## 15.2 TEXNOLOGİYA

```yaml
CSS: Tailwind CSS
Komponentlər: shadcn/ui (Radix əsaslı)
İkonlar: Lucide React
Şriftlər: Inter (UI) + display şrift (kataloq başlıqları)
Tema: Light + Dark mode
Animasiya: Framer Motion (incə keçidlər)
```

---

## 15.3 RESPONSIVE BREAKPOINTS

```css
mobile:  < 640px   (1 sütun, bottom nav, hamburger)
tablet:  640-1024px (2 sütun, collapsible sidebar)
desktop: > 1024px  (full sidebar, multi-column)

Bütün cədvəllər mobile-da:
- Horizontal scroll VƏ YA
- Card görünüşünə çevrilir (responsive table → cards)
```

---

## 15.4 LAYOUT STRUKTURU

### Desktop
```
┌────────┬──────────────────────────────┐
│        │  Top bar (search, bell, user) │
│ Side   ├──────────────────────────────┤
│ bar    │                              │
│ (nav)  │   Main content               │
│        │                              │
│        │                              │
└────────┴──────────────────────────────┘
```

### Mobile
```
┌──────────────────────────┐
│ ☰  Logo      🔔  👤      │  top bar
├──────────────────────────┤
│                          │
│   Main content           │
│   (1 column, cards)      │
│                          │
├──────────────────────────┤
│ 🏠   📦   ➕   📊   ⚙️  │  bottom nav
└──────────────────────────┘
```

---

## 15.5 DESIGN TOKENS

```javascript
// tailwind.config.js extend
colors: {
  primary: { DEFAULT: '#...', ... },    // brend rəngi
  // status rəngləri
  success: '#16a34a',   // 🟢
  warning: '#eab308',   // 🟡
  danger: '#dc2626',    // 🔴
  info: '#2563eb',      // 🔵
},
borderRadius: { card: '12px', button: '8px' },
spacing: { /* 4px scale */ },
```

> **Qeyd Claude Code üçün:** Birtask və Gradex layihələrindəki mövcud design token-ləri, rəng palitrasını və komponent stilini istinad kimi istifadə et.

---

## 15.6 ƏSAS KOMPONENTLƏR

```
- Button (primary, secondary, ghost, danger)
- Input, Select, DatePicker, Combobox (autocomplete)
- DataTable (TanStack — sort, filter, pagination, bulk)
- Card (KPI, məhsul, info)
- Modal/Dialog, Drawer (mobile)
- Tabs, Accordion
- Badge (status), Tag
- Toast (bildiriş)
- Chart wrapper (Recharts)
- FileUpload (drag-drop, Firebase Storage)
- Avatar, EmptyState, Skeleton (loading)
- StatusIndicator (🟢🟡🔴)
```

---

## 15.7 STOK STATUS GÖSTƏRİCİLƏRİ

```
🟢 OK        bg-green-100 text-green-700
🟡 Low       bg-yellow-100 text-yellow-700
🔴 Critical  bg-red-100 text-red-700
⚫ Out       bg-gray-200 text-gray-700
```

---

## 15.8 MƏHSUL KATALOQU (Moda Jurnalı)

```
- Editorial layout (böyük şəkillər)
- Display şrift (zərif başlıqlar)
- Masonry/grid
- Hover: şəkil dəyişimi, zoom
- Lookbook full-screen rejimi
- Kolleksiya storytelling bölmələri
- Whitespace (boş sahə) — premium hiss
```

---

## 15.9 FORMS (Validasiya)

```
- React Hook Form + Zod
- Inline error mesajları (AZ)
- Required işarələri (*)
- Auto-save (draft)
- Multi-step (sehrbaz) — uzun formlar üçün
- Optimistic UI
```

---

## 15.10 ƏLÇATANLIQ (Accessibility)

```
- Semantic HTML
- ARIA labels
- Klaviatura naviqasiyası
- Fokus göstəriciləri
- Rəng kontrastı (WCAG AA)
- Screen reader dəstəyi
```

---

## 15.11 PWA (Progressive Web App)

```
- Manifest (telefona quraşdırıla bilər)
- Service worker (offline)
- App icon
- Splash screen
- Push notification dəstəyi
```

---

**Növbəti fayl:** `16_DEPLOYMENT.md` - Deployment + DevOps
