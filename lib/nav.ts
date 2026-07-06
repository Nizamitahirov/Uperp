import {
  LayoutDashboard,
  Package,
  ClipboardCheck,
  Warehouse,
  Layers,
  Truck,
  Users2,
  ShoppingCart,
  Factory,
  Droplets,
  Boxes,
  ShoppingBag,
  BookOpen,
  Store,
  Undo2,
  Wallet,
  BarChart3,
  CalendarRange,
  UserCog,
  Settings,
  type LucideIcon,
} from 'lucide-react';
import type { ModuleKey } from '@/lib/rbac/permissions';

export interface NavItem {
  href: string;
  labelKey: string; // messages nav.*
  icon: LucideIcon;
  module: ModuleKey;
}

export interface NavGroup {
  /** Bölmə başlığı (messages navGroup.*) — boşdursa başlıqsız */
  labelKey?: string;
  items: NavItem[];
}

/**
 * Sidebar naviqasiya — məntiqi bölmələrə qruplaşdırılıb (vizual sadəlik).
 * Bəzi modullar (CRM, Təkliflər, Kassa, Rollar, Audit) artıq ana səhifələrin
 * daxilindən keçidlərlə açılır — sidebar yığcam qalsın deyə buradan çıxarılıb.
 */
export const NAV_GROUPS: NavGroup[] = [
  {
    items: [
      { href: '/dashboard', labelKey: 'dashboard', icon: LayoutDashboard, module: 'dashboard' },
    ],
  },
  {
    labelKey: 'warehouse_supply',
    items: [
      { href: '/materials', labelKey: 'raw_materials', icon: Package, module: 'raw_materials' },
      { href: '/stocktake', labelKey: 'stocktake', icon: ClipboardCheck, module: 'raw_materials' },
      { href: '/warehouses', labelKey: 'warehouses', icon: Warehouse, module: 'raw_materials' },
      { href: '/suppliers', labelKey: 'suppliers', icon: Truck, module: 'suppliers' },
      { href: '/procurement', labelKey: 'procurement', icon: ShoppingCart, module: 'purchase_orders' },
      { href: '/planning', labelKey: 'planning', icon: CalendarRange, module: 'raw_materials' },
    ],
  },
  {
    labelKey: 'production',
    items: [
      { href: '/bom', labelKey: 'bom', icon: Layers, module: 'bom' },
      { href: '/production', labelKey: 'production', icon: Factory, module: 'production_orders' },
      { href: '/washing', labelKey: 'washing', icon: Droplets, module: 'washing' },
      { href: '/finished-goods', labelKey: 'finished_goods', icon: Boxes, module: 'finished_goods' },
    ],
  },
  {
    labelKey: 'sales_customer',
    items: [
      { href: '/products', labelKey: 'products', icon: ShoppingBag, module: 'products' },
      { href: '/catalogs', labelKey: 'catalogs', icon: BookOpen, module: 'products' },
      { href: '/customers', labelKey: 'customers', icon: Users2, module: 'customers' },
      { href: '/sales', labelKey: 'sales', icon: Store, module: 'sales_orders' },
      { href: '/returns', labelKey: 'returns', icon: Undo2, module: 'sales_orders' },
      { href: '/pos', labelKey: 'pos', icon: ShoppingCart, module: 'pos' },
    ],
  },
  {
    labelKey: 'finance_admin',
    items: [
      { href: '/finance', labelKey: 'finance', icon: Wallet, module: 'finance' },
      { href: '/reports', labelKey: 'reports', icon: BarChart3, module: 'reports' },
      { href: '/users', labelKey: 'users', icon: UserCog, module: 'users' },
      { href: '/settings', labelKey: 'settings', icon: Settings, module: 'settings' },
    ],
  },
];

/** Düz siyahı (geriyə uyğunluq üçün) */
export const NAV_ITEMS: NavItem[] = NAV_GROUPS.flatMap((g) => g.items);
