'use client';

import { useEffect, useState } from 'react';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { Loader2, Save } from 'lucide-react';
import { getDb } from '@/lib/firebase/config';
import { useAuth } from '@/components/providers/auth-provider';
import { PageHeader } from '@/components/shared/page-header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from '@/components/ui/toast';

interface Settings {
  companyName: string;
  taxNumber: string;
  address: string;
  phone: string;
  email: string;
  baseCurrency: string;
  vatRate: number;
  defaultCostingMethod: 'FIFO' | 'AVCO';
  wholesaleMarkup: number;
  retailMarkup: number;
}

const DEFAULTS: Settings = {
  companyName: '', taxNumber: '', address: '', phone: '', email: '',
  baseCurrency: 'AZN', vatRate: 18, defaultCostingMethod: 'FIFO', wholesaleMarkup: 1.1, retailMarkup: 1.9,
};

export default function SettingsPage() {
  const { can } = useAuth();
  const [s, setS] = useState<Settings>(DEFAULTS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const canEdit = can('settings', 'update');

  useEffect(() => {
    (async () => {
      try {
        const snap = await getDoc(doc(getDb(), 'settings', 'global'));
        if (snap.exists()) setS({ ...DEFAULTS, ...(snap.data() as Partial<Settings>) });
      } catch { /* ignore */ } finally { setLoading(false); }
    })();
  }, []);

  async function save() {
    setSaving(true);
    try {
      await setDoc(doc(getDb(), 'settings', 'global'), { ...s, updatedAt: serverTimestamp() }, { merge: true });
      toast.success('Tənzimləmələr yadda saxlanıldı');
    } catch { toast.error('Yadda saxlanmadı'); } finally { setSaving(false); }
  }

  if (loading) return <Loader2 className="h-6 w-6 animate-spin text-primary" />;

  return (
    <div>
      <PageHeader title="Tənzimləmələr" subtitle="Şirkət, valyuta, ƏDV və maya parametrləri" action={canEdit && <Button onClick={save} disabled={saving}>{saving ? <Loader2 className="animate-spin" /> : <Save className="h-4 w-4" />} Yadda saxla</Button>} />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card className="rounded-card">
          <CardHeader><CardTitle className="text-base">Şirkət məlumatları</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <Field label="Ad"><Input disabled={!canEdit} value={s.companyName} onChange={(e) => setS({ ...s, companyName: e.target.value })} /></Field>
            <Field label="VÖEN"><Input disabled={!canEdit} value={s.taxNumber} onChange={(e) => setS({ ...s, taxNumber: e.target.value })} /></Field>
            <Field label="Ünvan"><Input disabled={!canEdit} value={s.address} onChange={(e) => setS({ ...s, address: e.target.value })} /></Field>
            <Field label="Telefon"><Input disabled={!canEdit} value={s.phone} onChange={(e) => setS({ ...s, phone: e.target.value })} /></Field>
            <Field label="Email"><Input disabled={!canEdit} value={s.email} onChange={(e) => setS({ ...s, email: e.target.value })} /></Field>
          </CardContent>
        </Card>

        <Card className="rounded-card">
          <CardHeader><CardTitle className="text-base">Maliyyə parametrləri</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <Field label="Əsas valyuta"><Input disabled={!canEdit} value={s.baseCurrency} onChange={(e) => setS({ ...s, baseCurrency: e.target.value })} /></Field>
            <Field label="ƏDV dərəcəsi (%)"><Input type="number" disabled={!canEdit} value={s.vatRate} onChange={(e) => setS({ ...s, vatRate: +e.target.value })} /></Field>
            <Field label="Default maya metodu">
              <Select value={s.defaultCostingMethod} onValueChange={(v) => setS({ ...s, defaultCostingMethod: v as 'FIFO' | 'AVCO' })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="FIFO">FIFO</SelectItem><SelectItem value="AVCO">AVCO</SelectItem></SelectContent>
              </Select>
            </Field>
            <Field label="Topdan markup (×)"><Input type="number" step="any" disabled={!canEdit} value={s.wholesaleMarkup} onChange={(e) => setS({ ...s, wholesaleMarkup: +e.target.value })} /></Field>
            <Field label="Pərakəndə markup (×)"><Input type="number" step="any" disabled={!canEdit} value={s.retailMarkup} onChange={(e) => setS({ ...s, retailMarkup: +e.target.value })} /></Field>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="space-y-1.5"><Label>{label}</Label>{children}</div>;
}
