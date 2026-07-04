'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Loader2, Save, Mail, Phone, Shield, User as UserIcon, Settings } from 'lucide-react';
import { useAuth } from '@/components/providers/auth-provider';
import { updateDocById } from '@/lib/firebase/firestore';
import { uploadFile } from '@/lib/firebase/storage';
import { getRoleName } from '@/lib/rbac/permissions';
import { PageHeader } from '@/components/shared/page-header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from '@/components/ui/toast';

export default function ProfilePage() {
  const { profile, firebaseUser, refresh } = useAuth();
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [avatarUrl, setAvatarUrl] = useState<string | undefined>();
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (profile) {
      setFullName(profile.fullName ?? '');
      setPhone(profile.phone ?? '');
      setAvatarUrl(profile.avatarUrl);
    }
  }, [profile]);

  if (!profile || !firebaseUser) {
    return <div className="flex justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;
  }

  async function handleAvatar(file: File | null) {
    if (!file || !file.type.startsWith('image/')) return;
    setUploading(true);
    try {
      const url = await uploadFile(`avatars/${firebaseUser!.uid}`, file);
      setAvatarUrl(url);
      await updateDocById('users', firebaseUser!.uid, { avatarUrl: url });
      await refresh();
      toast.success('Profil şəkli yeniləndi');
    } catch (e) {
      toast.error('Şəkil yüklənmədi', e instanceof Error ? e.message : undefined);
    } finally {
      setUploading(false);
    }
  }

  async function save() {
    setSaving(true);
    try {
      await updateDocById('users', firebaseUser!.uid, { fullName, phone });
      await refresh();
      toast.success('Profil yadda saxlanıldı');
    } catch (e) {
      toast.error('Yadda saxlanmadı', e instanceof Error ? e.message : undefined);
    } finally {
      setSaving(false);
    }
  }

  const initials = (fullName || profile.username || 'U').slice(0, 2).toUpperCase();

  return (
    <div>
      <PageHeader title="Profilim" subtitle="Şəxsi məlumatlar və hesab tənzimləmələri" />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* Sol — avatar kartı */}
        <Card className="rounded-card lg:col-span-1">
          <CardContent className="flex flex-col items-center pt-8 text-center">
            <div className="relative h-32 w-32">
              <div className="h-full w-full overflow-hidden rounded-full border-4 border-primary/20">
                {avatarUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={avatarUrl} alt={fullName} className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-[#5B5BF5] to-[#8b3df0] text-4xl font-bold text-white">{initials}</div>
                )}
              </div>
              <label className="absolute -bottom-1 -right-1 flex h-10 w-10 cursor-pointer items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg transition-transform hover:scale-105">
                {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserIcon className="h-4 w-4" />}
                <input type="file" accept="image/*" className="hidden" onChange={(e) => handleAvatar(e.target.files?.[0] ?? null)} />
              </label>
            </div>
            <p className="mt-4 text-lg font-bold">{fullName || profile.username}</p>
            <span className="mt-1 inline-flex items-center gap-1 rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
              <Shield className="h-3 w-3" /> {getRoleName(profile.role)}
            </span>

            <div className="mt-6 w-full space-y-2 text-left text-sm">
              <div className="flex items-center gap-2 text-muted-foreground"><Mail className="h-4 w-4 shrink-0" /> <span className="truncate">{profile.email}</span></div>
              {phone && <div className="flex items-center gap-2 text-muted-foreground"><Phone className="h-4 w-4 shrink-0" /> {phone}</div>}
            </div>
          </CardContent>
        </Card>

        {/* Sağ — form */}
        <Card className="rounded-card lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">Hesab məlumatları</CardTitle>
            <Button onClick={save} disabled={saving} size="sm">{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Yadda saxla</Button>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5"><Label>Tam ad</Label><Input value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Ad Soyad" /></div>
            <div className="space-y-1.5"><Label>İstifadəçi adı</Label><Input value={profile.username} disabled /></div>
            <div className="space-y-1.5"><Label>Email</Label><Input value={profile.email} disabled /></div>
            <div className="space-y-1.5"><Label>Telefon</Label><Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+994 ..." /></div>
            <div className="space-y-1.5"><Label>Rol</Label><Input value={getRoleName(profile.role)} disabled /></div>

            <div className="border-t border-border pt-4">
              <Link href="/settings" className="inline-flex items-center gap-2 text-sm font-medium text-primary hover:underline">
                <Settings className="h-4 w-4" /> Sistem tənzimləmələrinə keç
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
