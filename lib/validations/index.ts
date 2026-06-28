import { z } from 'zod';
import { MATERIAL_CATEGORIES } from '@/types';
import { ALL_ROLE_CODES } from '@/lib/rbac/permissions';

/** İstifadəçi yaratma sxemi — 01 §1.4.1 */
export const userSchema = z.object({
  fullName: z.string().min(2, 'Ən azı 2 simvol').max(100),
  email: z.string().email('Düzgün email daxil edin'),
  username: z
    .string()
    .min(5, 'Ən azı 5 simvol')
    .max(50)
    .regex(/^[a-z0-9_]+$/, 'Yalnız kiçik hərf, rəqəm və alt xətt'),
  phone: z
    .string()
    .regex(/^\+994\d{9}$/, 'Format: +994XXXXXXXXX')
    .optional()
    .or(z.literal('')),
  role: z.enum(ALL_ROLE_CODES as [string, ...string[]]),
  password: z
    .string()
    .min(8, 'Ən azı 8 simvol')
    .regex(/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])/, 'Böyük, kiçik hərf, rəqəm və simvol olmalıdır'),
  isActive: z.boolean().default(true),
});
export type UserFormValues = z.infer<typeof userSchema>;

/** İstifadəçi düzəliş sxemi — uid/username/email/createdAt dəyişməz (01 §1.4.4) */
export const userEditSchema = z.object({
  fullName: z.string().min(2, 'Ən azı 2 simvol').max(100),
  phone: z
    .string()
    .regex(/^\+994\d{9}$/, 'Format: +994XXXXXXXXX')
    .optional()
    .or(z.literal('')),
  role: z.enum(ALL_ROLE_CODES as [string, ...string[]]),
  isActive: z.boolean().default(true),
});
export type UserEditFormValues = z.infer<typeof userEditSchema>;

/** Xam material sxemi — 02_RAW_MATERIAL.md */
export const rawMaterialSchema = z.object({
  code: z.string().min(1, 'Kod tələb olunur').max(50),
  name: z.string().min(2, 'Ad tələb olunur').max(150),
  category: z.enum(MATERIAL_CATEGORIES as unknown as [string, ...string[]]),
  subCategory: z.string().max(100).optional().or(z.literal('')),
  unit: z.string().min(1, 'Ölçü vahidi tələb olunur').max(20),
  currentStock: z.coerce.number().min(0, 'Mənfi ola bilməz').default(0),
  minStock: z.coerce.number().min(0).default(0),
  maxStock: z.coerce.number().min(0).optional(),
  reorderPoint: z.coerce.number().min(0).optional(),
  moq: z.coerce.number().min(0).optional(),
  costingMethod: z.enum(['FIFO', 'AVCO']).default('FIFO'),
  avgCost: z.coerce.number().min(0).default(0),
  currency: z.string().default('AZN'),
  primarySupplierId: z.string().optional().or(z.literal('')),
  leadTimeDays: z.coerce.number().min(0).optional(),
  barcode: z.string().optional().or(z.literal('')),
  isActive: z.boolean().default(true),
});
export type RawMaterialFormValues = z.infer<typeof rawMaterialSchema>;

/** PO sətri — 05 §5.3 */
export const poItemSchema = z.object({
  materialId: z.string().min(1, 'Material seçin'),
  materialName: z.string(),
  materialCode: z.string().optional(),
  unit: z.string(),
  quantity: z.coerce.number().positive('Miqdar > 0 olmalıdır'),
  unitPrice: z.coerce.number().min(0, 'Qiymət mənfi ola bilməz'),
  discount: z.coerce.number().min(0).max(100).optional(),
});

/** Purchase Order sxemi — 05 §5.3 */
export const purchaseOrderSchema = z.object({
  supplierId: z.string().min(1, 'Təchizatçı seçin'),
  expectedDeliveryDate: z.string().optional().or(z.literal('')),
  items: z.array(poItemSchema).min(1, 'Ən azı bir material əlavə edin'),
  customsFee: z.coerce.number().min(0).default(0),
  shippingFee: z.coerce.number().min(0).default(0),
  insuranceFee: z.coerce.number().min(0).default(0),
  otherFees: z.coerce.number().min(0).default(0),
  currency: z.string().default('AZN'),
  exchangeRate: z.coerce.number().positive('Məzənnə > 0').default(1),
  landedCostAllocation: z.enum(['value', 'quantity']).default('value'),
  incoterms: z.string().optional().or(z.literal('')),
  notes: z.string().max(500).optional().or(z.literal('')),
});
export type PurchaseOrderFormValues = z.infer<typeof purchaseOrderSchema>;

/** Təchizatçı sxemi — 04_CONTACTS_CRM.md */
export const supplierSchema = z.object({
  code: z.string().min(1, 'Kod tələb olunur').max(50),
  name: z.string().min(2, 'Ad tələb olunur').max(150),
  type: z.enum(['company', 'individual']).default('company'),
  taxNumber: z.string().max(50).optional().or(z.literal('')),
  contactPerson: z.string().max(100).optional().or(z.literal('')),
  email: z.string().email('Düzgün email').optional().or(z.literal('')),
  phone: z.string().max(30).optional().or(z.literal('')),
  address: z.string().max(250).optional().or(z.literal('')),
  country: z.string().max(60).optional().or(z.literal('')),
  paymentTerms: z.string().max(100).optional().or(z.literal('')),
  currency: z.string().default('AZN'),
  rating: z.coerce.number().min(0).max(5).optional(),
  isActive: z.boolean().default(true),
  notes: z.string().max(500).optional().or(z.literal('')),
});
export type SupplierFormValues = z.infer<typeof supplierSchema>;
