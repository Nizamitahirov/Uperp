'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/components/providers/auth-provider';
import { PurchaseOrderForm } from '../po-form';

export default function NewPurchaseOrderPage() {
  const { can, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !can('purchase_orders', 'create')) router.replace('/procurement');
  }, [loading, can, router]);

  if (!can('purchase_orders', 'create')) return null;
  return <PurchaseOrderForm />;
}
