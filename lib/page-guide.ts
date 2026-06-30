/** Səhifə bələdçisi metadatası — hər route üçün məqsəd, istifadə, iş axını.
 *  AI Page Guide bu məlumatı + canlı datanı istifadə edib hekayə yaradır. */

export interface PageGuideMeta {
  title: string;
  purpose: string;
  how: string[];
  prev?: string;
  next?: string;
  affects?: string;
  /** Canlı say üçün Firestore kolleksiyası */
  collection?: string;
}

/** Route prefiksi → bələdçi. Ən uzun uyğunluq seçilir. */
export const PAGE_GUIDE: Record<string, PageGuideMeta> = {
  '/dashboard': {
    title: 'İdarə paneli', collection: 'sales_orders',
    purpose: 'Biznesin ümumi vəziyyətini real-time KPI və qrafiklərlə göstərir.',
    how: ['KPI kartlarına bax (satış, anbar, debitor)', 'Qrafikləri AI ilə izah etdir', 'Kritik bildirişlərə kliklə keç'],
    prev: 'Sistemə giriş', next: 'Konkret modula keçid (Satış, İstehsal və s.)',
    affects: 'Yalnız oxunur — qərar qəbulu üçün xülasə verir.',
  },
  '/materials': {
    title: 'Xam material anbarı', collection: 'raw_materials',
    purpose: 'Xam material kataloqu, stok səviyyələri və maya dəyərinin idarəsi.',
    how: ['Yeni material əlavə et', 'Stok və reorder nöqtəsini izlə', 'Kritik stoku Satınalma ilə doldur'],
    prev: 'Təchizatçı qeydiyyatı', next: 'Satınalma sifarişi (PO) yaratmaq',
    affects: 'Stok BOM maya dəyərinə və istehsal planına təsir edir.',
  },
  '/suppliers': {
    title: 'Təchizatçılar', collection: 'suppliers',
    purpose: 'Material təchizatçılarının reyestri və performans tarixçəsi.',
    how: ['Təchizatçı əlavə et', 'Ödəniş şərtlərini qeyd et', 'PO yaradarkən seç'],
    prev: 'Material kataloqu', next: 'Satınalma sifarişi',
    affects: 'PO və kreditor (AP) hesablamalarına bağlıdır.',
  },
  '/procurement': {
    title: 'Satınalma (PO)', collection: 'purchase_orders',
    purpose: 'Təchizatçıdan material almaq üçün satınalma sifarişlərinin idarəsi.',
    how: ['Yeni PO yarat', 'Təsdiqdən keçir', 'Mal gələndə GRN ilə qəbul et'],
    prev: 'Material/Planlaşdırma tələbi', next: 'GRN (mal qəbulu)',
    affects: 'GRN, stok artımı və kreditor (AP) yaradır.',
  },
  '/production': {
    title: 'İstehsal sifarişləri', collection: 'production_orders',
    purpose: 'Cins məhsulların istehsal proseslərinin idarəsi (kəsim→tikiş→QC).',
    how: ['BOM əsasında istehsal sifarişi yarat', 'Mərhələləri izlə', 'Tamamla → yuyulmaya göndər'],
    prev: 'BOM və material hazırlığı', next: 'Yuyulma və keyfiyyət nəzarəti',
    affects: 'Xam material stokunu azaldır, hazır məhsul yaradır.',
  },
  '/washing': {
    title: 'Yuyulma', collection: 'washing_orders',
    purpose: 'İstehsaldan çıxan partiyaların yuyulma/emal proseslərinin idarəsi.',
    how: ['Yuyulma partiyası yarat', 'Daxili/kənar emalçı seç', 'Qayıdışda itkini qeyd et'],
    prev: 'İstehsal sifarişi', next: 'Keyfiyyət nəzarəti və hazır məhsul',
    affects: 'Hazır məhsul sayına və mayaya təsir edir (yuyulma itkisi).',
  },
  '/finished-goods': {
    title: 'Hazır məhsul', collection: 'finished_goods',
    purpose: 'Satışa hazır məhsul variantlarının stok idarəsi.',
    how: ['Variant stoklarını izlə', 'Reorder/overstock siqnallarına bax', 'Satış üçün hazır saxla'],
    prev: 'İstehsal və QC', next: 'Satış sifarişi və ya POS',
    affects: 'Satış mövcudluğuna və kataloqa birbaşa təsir edir.',
  },
  '/planning': {
    title: 'Planlaşdırma (MRP)', collection: 'raw_materials',
    purpose: 'Tələbə əsasən material və istehsal tövsiyələri (MRP-lite).',
    how: ['Material kasadlığına bax', 'Sifariş tövsiyələrini gör', 'PR/istehsal sifarişi yarat'],
    prev: 'Satış proqnozu / sifarişlər', next: 'Satınalma (PR/PO) və ya istehsal',
    affects: 'Satınalma və istehsal qərarlarını istiqamətləndirir.',
  },
  '/products': {
    title: 'Məhsul kataloqu', collection: 'products',
    purpose: 'Modellərin, qiymətlərin və atributların idarəsi.',
    how: ['Məhsul yarat, şəkil yüklə', 'AI ilə təsvir yaz', 'BOM bağla, qiymət təyin et'],
    prev: 'BOM/dizayn', next: 'Kataloq jurnalı və satış',
    affects: 'Kataloq, satış və istehsal BOM-una bağlıdır.',
  },
  '/catalogs': {
    title: 'Kataloq jurnalları', collection: 'catalogs',
    purpose: 'Müştərilərə göstərilən moda jurnalı kataloqlarının qurulması.',
    how: ['Jurnal yarat, modelləri seç/sırala', 'Üz qabığını təyin et', 'Dərc et (publish)'],
    prev: 'Məhsul kataloqu', next: 'Müştərinin /catalog-da sifarişi',
    affects: 'Müştəri kataloq görünüşünü müəyyən edir.',
  },
  '/sales': {
    title: 'Satış sifarişləri', collection: 'sales_orders',
    purpose: 'B2B/B2C satış sifarişlərinin, rezervasiya və fakturanın idarəsi.',
    how: ['Sifariş yarat', 'Təsdiqlə → stok rezerv et', 'Çatdır → faktura/debitor yarat'],
    prev: 'Müştəri və hazır məhsul', next: 'Çatdırılma və maliyyə (AR)',
    affects: 'Hazır məhsul stokunu və debitoru (AR) dəyişir.',
  },
  '/pos': {
    title: 'POS — pərakəndə satış', collection: 'finished_goods',
    purpose: 'Sürətli pərakəndə satış interfeysi (kassa).',
    how: ['Məhsulları səbətə əlavə et', 'Ödəniş növünü seç', 'Tamamla → qəbz çap et'],
    prev: 'Hazır məhsul mövcudluğu', next: 'Kassa və maliyyə',
    affects: 'Stoku azaldır, kassaya nağd daxilolma yazır.',
  },
  '/finance': {
    title: 'Maliyyə (AR/AP)', collection: 'receivables',
    purpose: 'Debitor (alınacaq) və kreditor (ödəniləcək) borclarının idarəsi.',
    how: ['AR/AP aging-ə bax', 'Müştəri ödənişi qeyd et', 'Təchizatçıya ödəniş et'],
    prev: 'Satış (AR) və GRN (AP)', next: 'Hesabatlar və kassa',
    affects: 'Kassa balansına və mənfəət hesabatına təsir edir.',
  },
  '/cash': {
    title: 'Kassa', collection: 'cash_registers',
    purpose: 'Nağd kassa registrlərinin və hərəkətlərinin idarəsi.',
    how: ['Kassa aç/bağla', 'Daxilolma/çıxış qeyd et', 'Gün sonu hesabla'],
    prev: 'POS və maliyyə ödənişləri', next: 'Maliyyə hesabatı',
    affects: 'Nağd mövqeyi və cash-flow hesabatı.',
  },
  '/reports': {
    title: 'Hesabatlar', collection: 'sales_orders',
    purpose: 'P&L, AR/AP aging, satış, müştəri və inventar analitikası.',
    how: ['Tab seç (Maliyyə, Satış...)', 'Qrafikləri AI ilə izah etdir', 'Excel-ə ixrac et'],
    prev: 'Bütün əməliyyat modulları', next: 'Strateji qərar / planlaşdırma',
    affects: 'Yalnız oxunur — idarəetmə qərarları üçün.',
  },
  '/customers': {
    title: 'Müştərilər', collection: 'customers',
    purpose: 'B2B/B2C müştərilərin, seqment və kredit limitinin idarəsi.',
    how: ['Müştəri əlavə et', 'Seqment/kredit təyin et', 'CRM pipeline-da izlə'],
    prev: '—', next: 'Satış sifarişi və CRM',
    affects: 'Satış, kredit və debitor (AR) hesablarına bağlıdır.',
  },
  '/crm': {
    title: 'CRM / Pipeline', collection: 'deals',
    purpose: 'Satış imkanlarının (deal) mərhələ üzrə idarəsi.',
    how: ['Deal yarat', 'Mərhələ üzrə sürüklə', 'Qazanılan deal-i sifarişə çevir'],
    prev: 'Müştəri qeydiyyatı', next: 'Satış sifarişi',
    affects: 'Satış proqnozuna təsir edir.',
  },
  '/quotations': {
    title: 'Təkliflər', collection: 'quotations',
    purpose: 'Müştəriyə qiymət təkliflərinin hazırlanması.',
    how: ['Təklif yarat', 'Müştəriyə göndər', 'Qəbul olunsa sifarişə çevir'],
    prev: 'Müştəri sorğusu', next: 'Satış sifarişi',
    affects: 'Satış pipeline-ının ilk mərhələsi.',
  },
  '/deliveries': {
    title: 'Çatdırılmalar', collection: 'deliveries',
    purpose: 'Satış sifarişlərinin çatdırılması və packing list.',
    how: ['Sifarişi çatdırılmaya götür', 'Packing list çap et', 'Çatdırıldı işarələ'],
    prev: 'Təsdiqlənmiş satış sifarişi', next: 'Faktura və debitor',
    affects: 'Stoku çıxarır, faktura/AR yaradır.',
  },
  '/users': {
    title: 'İstifadəçilər', collection: 'users',
    purpose: 'Sistem istifadəçilərinin və rollarının idarəsi.',
    how: ['İstifadəçi yarat', 'Rol təyin et', 'Aktiv/deaktiv et'],
    prev: 'Rol konfiqurasiyası', next: 'Gündəlik əməliyyatlar',
    affects: 'Hər modula giriş səlahiyyətinə təsir edir.',
  },
  '/roles': {
    title: 'Rollar', collection: 'roles',
    purpose: 'Rol və səlahiyyət matrisinin (RBAC) idarəsi.',
    how: ['Rol seç/yarat', 'Modul icazələrini dəyiş', 'Yadda saxla'],
    prev: '—', next: 'İstifadəçiyə rol təyini',
    affects: 'Bütün istifadəçilərin giriş hüquqlarını müəyyən edir.',
  },
  '/audit': {
    title: 'Audit Log', collection: 'audit_logs',
    purpose: 'Sistemdə baş verən bütün əməliyyatların tarixçəsi.',
    how: ['Əməliyyatları filtrlə', 'Kim/nə/nə vaxt gör', 'Anomaliyaları yoxla'],
    prev: 'Əməliyyatlar', next: 'Təhlükəsizlik nəzarəti',
    affects: 'Yalnız oxunur — audit və təhlükəsizlik üçün.',
  },
  '/approvals': {
    title: 'Təsdiqlər və tapşırıqlar', collection: 'approval_requests',
    purpose: 'Workflow avtomatlaşdırmasından gələn təsdiq və tapşırıqların icrası.',
    how: ['Gözləyən təsdiqlərə bax', 'Təsdiqlə/Rədd et', 'Tapşırığı tamamla'],
    prev: 'Workflow trigger (PO, xərc və s.)', next: 'Əməliyyatın davamı',
    affects: 'Təsdiq biznes əməliyyatının gedişatını müəyyən edir.',
  },
  '/settings': {
    title: 'Tənzimləmələr', collection: 'settings',
    purpose: 'Şirkət, valyuta, ƏDV, maya parametrləri və avtomatlaşdırma.',
    how: ['Şirkət məlumatını doldur', 'Maya/ƏDV təyin et', 'Workflow-ları qur'],
    prev: '—', next: 'Bütün modulların düzgün işləməsi',
    affects: 'Hesablamalar, sənədlər və avtomatlaşdırmaya təsir edir.',
  },
};

/** Pathname-ə görə ən uyğun bələdçini tapır (ən uzun prefiks). */
export function findGuide(pathname: string): { route: string; meta: PageGuideMeta } | null {
  let best: { route: string; meta: PageGuideMeta } | null = null;
  for (const [route, meta] of Object.entries(PAGE_GUIDE)) {
    if (pathname === route || pathname.startsWith(route + '/')) {
      if (!best || route.length > best.route.length) best = { route, meta };
    }
  }
  return best;
}
