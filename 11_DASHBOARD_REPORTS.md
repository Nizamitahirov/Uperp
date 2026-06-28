# 11. EXECUTIVE DASHBOARD + HESABAT VƏ ANALİTİKA

> Modullar: #3 Executive Dashboard, #17 Hesabat və analitika

---

## 11.1 EXECUTIVE DASHBOARD (Direktor)

> Real-time, mobile-friendly, KPI-rich

### Layout
```
┌────────────────────────────────────────────────────────┐
│  KPI KARTLARI (real-time)                              │
│  ┌──────────┬──────────┬──────────┬──────────┐         │
│  │ Bu gün   │ Bu ay    │ Bu ay    │ Anbar    │         │
│  │ Satış    │ Satış    │ İstehsal │ Dəyəri   │         │
│  │ ₼2,450   │ ₼58,300  │ 1,240əd  │ ₼125,450 │         │
│  │ ↑12%     │ ↑8%      │ ↓3%      │ —        │         │
│  └──────────┴──────────┴──────────┴──────────┘         │
│  ┌──────────┬──────────┬──────────┬──────────┐         │
│  │ Debitor  │ Kreditor │ Net      │ Aktiv    │         │
│  │ (AR)     │ (AP)     │ Mənfəət  │ Sifariş  │         │
│  │ ₼12,500  │ ₼8,200   │ ₼15,300  │ 23       │         │
│  └──────────┴──────────┴──────────┴──────────┘         │
├────────────────────────────────────────────────────────┤
│  QRAFİKLƏR                                              │
│  ┌─────────────────────┬──────────────────────┐        │
│  │ Aylıq Satış Trendi  │ Top 10 Model         │        │
│  │ (12 ay, line chart) │ (bar chart)          │        │
│  └─────────────────────┴──────────────────────┘        │
│  ┌─────────────────────┬──────────────────────┐        │
│  │ İstehsal vs Satış   │ Mənfəətlilik (pie)   │        │
│  └─────────────────────┴──────────────────────┘        │
├────────────────────────────────────────────────────────┤
│  CANLI MƏLUMATLAR                                       │
│  🔴 Kritik stok: 3 material                             │
│  📦 Bu gün təhvil: 5 sifariş                           │
│  💰 Vaxtı çatan ödəniş: 2 (₼3,400)                     │
│  🔔 Son əməliyyatlar feed                              │
├────────────────────────────────────────────────────────┤
│  🤖 AI INSIGHTS (Groq)                                  │
│  "Bu ay satış keçən aya nisbətən 8% artıb. Black Slim  │
│   modeli ən sürətli satılır - istehsalı artırın..."    │
└────────────────────────────────────────────────────────┘
```

### KPI-lar (real-time, Firestore listeners)
```
- Bu gün/ay satış (məbləğ + ədəd)
- Bu ay istehsal
- Cari anbar dəyəri (xam + hazır)
- Debitor (AR) toplamı
- Kreditor (AP) toplamı
- Net mənfəət (ay)
- Aktiv sifarişlər
- Gross margin %
```

### Sürətli əməliyyat düymələri
```
[+ Yeni Satış] [+ Sifariş] [+ Xərc] [+ Ödəniş qeyd et]
```

---

## 11.2 ROL-SPESİFİK DASHBOARD-LAR

```
Mühasib: maliyyə kartları, AR/AP aging, cash flow, P&L
Anbardar: stok səviyyələri, kritik material, hərəkətlər, GRN
İstehsalat: aktiv production order, mərhələ statusu, yuyulma, QC
Satış: satış funnel (pipeline), top müştəri, hədəf vs faktiki
Təchizat: aktiv PO, supplier performans, gözləyən GRN
```

---

## 11.3 DASHBOARD KONFİQURASİYASI
```
- Widget əlavə/sil (drag-drop)
- Refresh interval (real-time / 5dəq / 15dəq)
- Tarix aralığı seçimi
- Export (PDF snapshot)
```

---

## 11.4 STANDART HESABATLAR

### Satış hesabatları
```
- Günlük/aylıq satış
- Məhsul/model üzrə
- Müştəri üzrə
- Satıcı üzrə
- Ölçü/rəng analizi
- Kanal (B2B/B2C/online)
- Geri qaytarma statistikası
```

### İstehsal hesabatları
```
- İstehsal həcmi
- Effektivlik (plan vs faktiki)
- Fire/zay statistikası
- Yuyulma itki analizi
- Mərhələ üzrə vaxt (SMV)
- İşçi produktivliyi
- Defect Pareto
```

### İnventar hesabatları
```
- Xam material stok vəziyyəti
- Hazır məhsul stok
- Stok dövriyyəsi (turnover)
- Ləng hərəkət (slow-moving)
- ABC analizi
- İnventarizasiya fərqləri
- Cost layer (FIFO) hesabatı
```

### Maliyyə hesabatları
```
- Gəlir/Gider (P&L)
- Mənfəət/Zərər (segment)
- AR/AP aging
- Cash flow
- Balans hesabatı
- COGS təhlili
- ƏDV hesabatı
```

### Müştəri hesabatları
```
- Yeni müştərilər
- Retention (saxlanma)
- Customer Lifetime Value (CLV)
- Top müştərilər
- Seqment analizi
```

---

## 11.5 DİNAMİK HESABAT YARADICI (Report Builder)

```
İstifadəçi seçir:
- Məlumat mənbəyi (satış, istehsal, maliyyə...)
- Tarix aralığı
- Filtrlər
- Qruplaşdırma (group by)
- Sıralama
- Vizual növü (cədvəl, line, bar, pie)
- Export (PDF, Excel, CSV)

Saxlanmış hesabatlar (saved reports) + cədvəlləşmiş (scheduled)
```

---

## 11.6 VİZUALİZASİYA (Recharts)

```
- KPI kartları
- Line chart (trend)
- Bar/Column (müqayisə)
- Pie/Donut (pay)
- Area (kümulativ)
- Heatmap (isti xəritə - məs. satış günləri)
- Gauge (hədəf vs faktiki)
- Funnel (sales pipeline)
```

---

## 11.7 AI ANALİTİKA (Groq)

```
- Hesabat avtomatik xülasəsi (insights)
  "Bu ayın əsas tendensiyaları: ..."
- Anomaliya aşkarlama
  "Black model satışı qəfil 40% düşüb - səbəb?"
- Proqnoz şərhi
  "Növbəti ay satış ~₼62,000 gözlənilir"
- Natural language query (opsional)
  "Bu il ən çox hansı model satıldı?" → AI cavab + qrafik
```

---

**Növbəti fayl:** `12_AI_INTEGRATION.md` - AI İnteqrasiyası (Groq) tam
