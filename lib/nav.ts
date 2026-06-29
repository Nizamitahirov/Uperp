import {
  LayoutDashboard,
  Package,
  Layers,
  Truck,
  Users2,
  Handshake,
  ShoppingCart,
  Factory,
  Droplets,
  Boxes,
  ShoppingBag,
  Store,
  FileText,
  Wallet,
  BarChart3,
  UserCog,
  ShieldCheck,
  ScrollText,
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

/** Sidebar naviqasiya — hər element bir modula bağlıdır (RBAC ilə filtrlənir) */
export const NAV_ITEMS: NavItem[] = [
  { href: '/dashboard', labelKey: 'dashboard', icon: LayoutDashboard, module: 'dashboard' },
  { href: '/materials', labelKey: 'raw_materials', icon: Package, module: 'raw_materials' },
  { href: '/bom', labelKey: 'bom', icon: Layers, module: 'bom' },
  { href: '/suppliers', labelKey: 'suppliers', icon: Truck, module: 'suppliers' },
  { href: '/customers', labelKey: 'customers', icon: Users2, module: 'customers' },
  { href: '/crm', labelKey: 'crm', icon: Handshake, module: 'customers' },
  { href: '/procurement', labelKey: 'procurement', icon: ShoppingCart, module: 'purchase_orders' },
  { href: '/production', labelKey: 'production', icon: Factory, module: 'production_orders' },
  { href: '/washing', labelKey: 'washing', icon: Droplets, module: 'washing' },
  { href: '/finished-goods', labelKey: 'finished_goods', icon: Boxes, module: 'finished_goods' },
  { href: '/products', labelKey: 'products', icon: ShoppingBag, module: 'products' },
  { href: '/sales', labelKey: 'sales', icon: Store, module: 'sales_orders' },
  { href: '/quotations', labelKey: 'quotations', icon: FileText, module: 'sales_orders' },
  { href: '/pos', labelKey: 'pos', icon: Store, module: 'pos' },
  { href: '/cash', labelKey: 'cash', icon: Wallet, module: 'cash' },
  { href: '/finance', labelKey: 'finance', icon: Wallet, module: 'finance' },
  { href: '/reports', labelKey: 'reports', icon: BarChart3, module: 'reports' },
  { href: '/audit', labelKey: 'audit', icon: ScrollText, module: 'reports' },
  { href: '/users', labelKey: 'users', icon: UserCog, module: 'users' },
  { href: '/roles', labelKey: 'roles', icon: ShieldCheck, module: 'roles' },
  { href: '/settings', labelKey: 'settings', icon: Settings, module: 'settings' },
];
