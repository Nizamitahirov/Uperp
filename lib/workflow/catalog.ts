/** Workflow trigger & action kataloqu (Power Automate üslubu) */
import {
  ShoppingCart, RefreshCw, FileText, Receipt, Truck, Factory, CheckCircle2,
  PackageMinus, PackageX, UserPlus, AlertTriangle, BookOpen, MousePointerClick,
  Stamp, Bell, Mail, UserCheck, ArrowRightLeft, ListTodo, Sparkles, Webhook, Timer, Banknote,
  type LucideIcon,
} from 'lucide-react';
import type { WorkflowActionType, WorkflowTriggerType } from '@/types';

export interface TriggerDef {
  type: WorkflowTriggerType;
  label: string;
  description: string;
  icon: LucideIcon;
  /** Şərt üçün mövcud sahələr */
  fields: { key: string; label: string }[];
}

export interface ActionDef {
  type: WorkflowActionType;
  label: string;
  description: string;
  icon: LucideIcon;
  /** Tailwind rəng sinifləri (badge/ikon fonu) */
  tint: string;
}

export const TRIGGERS: TriggerDef[] = [
  { type: 'manual', label: 'Əl ilə başlat', description: 'İstifadəçi düyməsi ilə başladılır', icon: MousePointerClick, fields: [] },
  { type: 'sales_order.created', label: 'Satış sifarişi yaradıldı', description: 'Yeni satış sifarişi əlavə olunduqda', icon: ShoppingCart, fields: [{ key: 'totalAmount', label: 'Yekun məbləğ' }, { key: 'channel', label: 'Kanal' }, { key: 'customerName', label: 'Müştəri' }] },
  { type: 'sales_order.status_changed', label: 'Satış sifarişi statusu dəyişdi', description: 'Sifariş statusu dəyişdikdə', icon: RefreshCw, fields: [{ key: 'status', label: 'Status' }] },
  { type: 'purchase_order.created', label: 'Satınalma sifarişi yaradıldı', description: 'Yeni PO əlavə olunduqda', icon: FileText, fields: [{ key: 'totalAmount', label: 'Məbləğ' }, { key: 'supplierName', label: 'Təchizatçı' }] },
  { type: 'purchase_order.pending_approval', label: 'PO təsdiq gözləyir', description: 'PO təsdiqə göndərildikdə', icon: Stamp, fields: [{ key: 'totalAmount', label: 'Məbləğ' }] },
  { type: 'expense.submitted', label: 'Xərc təqdim edildi', description: 'Yeni xərc qeydə alındıqda', icon: Receipt, fields: [{ key: 'amount', label: 'Məbləğ' }, { key: 'category', label: 'Kateqoriya' }] },
  { type: 'grn.received', label: 'Mal qəbulu (GRN)', description: 'Material qəbul edildikdə', icon: Truck, fields: [{ key: 'totalQuantity', label: 'Miqdar' }] },
  { type: 'production_order.created', label: 'İstehsal sifarişi yaradıldı', description: 'Yeni istehsal sifarişi', icon: Factory, fields: [{ key: 'totalQuantity', label: 'Miqdar' }, { key: 'priority', label: 'Prioritet' }] },
  { type: 'production_order.completed', label: 'İstehsal tamamlandı', description: 'İstehsal sifarişi bitdikdə', icon: CheckCircle2, fields: [{ key: 'producedQuantity', label: 'İstehsal sayı' }] },
  { type: 'stock.issued', label: 'Stokdan mal çıxışı', description: 'Material/məhsul stokdan çıxarıldıqda', icon: PackageX, fields: [{ key: 'quantity', label: 'Miqdar' }, { key: 'reason', label: 'Səbəb' }] },
  { type: 'stock.below_reorder', label: 'Stok kritik səviyyədə', description: 'Material reorder nöqtəsindən aşağı düşdükdə', icon: PackageMinus, fields: [{ key: 'currentStock', label: 'Cari stok' }] },
  { type: 'cash.payment_out', label: 'Kassadan ödəniş çıxışı', description: 'Nağd/bank ödənişi edildikdə', icon: Banknote, fields: [{ key: 'amount', label: 'Məbləğ' }] },
  { type: 'customer.created', label: 'Yeni müştəri', description: 'Müştəri əlavə olunduqda', icon: UserPlus, fields: [{ key: 'segment', label: 'Seqment' }, { key: 'type', label: 'Tip' }] },
  { type: 'invoice.overdue', label: 'Faktura vaxtı keçdi', description: 'Debitor ödənişi gecikdikdə', icon: AlertTriangle, fields: [{ key: 'balance', label: 'Qalıq' }] },
  { type: 'catalog.published', label: 'Kataloq dərc olundu', description: 'Jurnal dərc edildikdə', icon: BookOpen, fields: [] },
];

export const ACTIONS: ActionDef[] = [
  { type: 'approval', label: 'Təsdiq tələb et', description: 'Rola və ya şəxsə təsdiq göndər', icon: Stamp, tint: 'bg-primary/10 text-primary' },
  { type: 'notify', label: 'Bildiriş göndər', description: 'Tətbiqdaxili bildiriş', icon: Bell, tint: 'bg-info/10 text-info' },
  { type: 'email', label: 'Email göndər', description: 'Şəxsə/rola və ya ünvana email', icon: Mail, tint: 'bg-info/10 text-info' },
  { type: 'assign', label: 'Şəxsə təyin et', description: 'Tapşırığı rola və ya şəxsə yönəlt', icon: UserCheck, tint: 'bg-success/10 text-success' },
  { type: 'update_status', label: 'Status dəyiş', description: 'Qeydin statusunu yenilə', icon: ArrowRightLeft, tint: 'bg-warning/10 text-warning' },
  { type: 'create_task', label: 'Tapşırıq yarat', description: 'İcra üçün tapşırıq aç', icon: ListTodo, tint: 'bg-accent text-accent-foreground' },
  { type: 'ai_summary', label: 'AI xülasə / mesaj', description: 'AI ilə avtomatik mətn yarat', icon: Sparkles, tint: 'bg-primary/10 text-primary' },
  { type: 'delay', label: 'Gözlə (delay)', description: 'Növbəti addımı təxirə sal', icon: Timer, tint: 'bg-muted text-muted-foreground' },
  { type: 'webhook', label: 'Webhook (xarici)', description: 'Xarici sistemə HTTP çağırışı', icon: Webhook, tint: 'bg-muted text-muted-foreground' },
];

export const TRIGGER_MAP = new Map(TRIGGERS.map((t) => [t.type, t]));
export const ACTION_MAP = new Map(ACTIONS.map((a) => [a.type, a]));

export const CONDITION_OPS: { value: string; label: string }[] = [
  { value: 'eq', label: '= bərabər' },
  { value: 'neq', label: '≠ fərqli' },
  { value: 'gt', label: '> böyük' },
  { value: 'gte', label: '≥ böyük/bərabər' },
  { value: 'lt', label: '< kiçik' },
  { value: 'lte', label: '≤ kiçik/bərabər' },
  { value: 'contains', label: 'daxilindədir' },
];
