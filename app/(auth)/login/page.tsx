'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Loader2, LogIn } from 'lucide-react';
import { loginWithEmail, loginWithGoogle } from '@/lib/firebase/auth';
import { useAuth } from '@/components/providers/auth-provider';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Logo } from '@/components/layout/logo';
import { toast } from '@/components/ui/toast';

export default function LoginPage() {
  const t = useTranslations('auth');
  const router = useRouter();
  const { firebaseUser, profile, configured, loading: authLoading } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  // Artıq daxil olubsa yönləndir
  useEffect(() => {
    if (!authLoading && firebaseUser) {
      router.replace(profile?.role === 'customer' ? '/catalog' : '/dashboard');
    }
  }, [authLoading, firebaseUser, profile, router]);

  async function handleEmailLogin(e: React.FormEvent) {
    e.preventDefault();
    if (!configured) {
      toast.error('Firebase konfiqurasiya edilməyib', 'NEXT_PUBLIC_FIREBASE_* dəyişənlərini əlavə edin');
      return;
    }
    setLoading(true);
    try {
      await loginWithEmail(email, password);
      toast.success(t('welcome'));
      router.replace('/dashboard');
    } catch {
      toast.error(t('invalidCredentials'));
    } finally {
      setLoading(false);
    }
  }

  async function handleGoogleLogin() {
    if (!configured) {
      toast.error('Firebase konfiqurasiya edilməyib');
      return;
    }
    setLoading(true);
    try {
      const { isNew } = await loginWithGoogle();
      toast.success(t('welcome'));
      router.replace(isNew ? '/catalog' : '/catalog');
    } catch {
      toast.error('Google ilə giriş alınmadı');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/40 px-4">
      <div className="w-full max-w-md">
        <div className="mb-6 flex flex-col items-center gap-2 text-center">
          <Logo />
          <p className="mt-1 text-sm text-muted-foreground">İstehsal idarəetmə sistemi</p>
        </div>

        <Card className="rounded-card">
          <CardHeader>
            <CardTitle>{t('loginTitle')}</CardTitle>
            <CardDescription>{t('loginSubtitle')}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {!configured && (
              <div className="rounded-md bg-yellow-50 p-3 text-xs text-yellow-800">
                ⚠️ Firebase Web App config (.env.local) tam deyil. Email/Google giriş işləməyəcək.
              </div>
            )}

            <form onSubmit={handleEmailLogin} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">{t('email')}</Label>
                <Input
                  id="email"
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">{t('password')}</Label>
                <Input
                  id="password"
                  type="password"
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? <Loader2 className="animate-spin" /> : <LogIn />}
                {t('internalLogin')}
              </Button>
            </form>

            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-card px-2 text-muted-foreground">{t('or')}</span>
              </div>
            </div>

            <Button variant="outline" className="w-full" onClick={handleGoogleLogin} disabled={loading}>
              <GoogleIcon />
              {t('loginWithGoogle')}
            </Button>
            <p className="text-center text-xs text-muted-foreground">{t('customerHint')}</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden>
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.27-4.74 3.27-8.1Z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23Z"
      />
      <path fill="#FBBC05" d="M5.84 14.1a6.6 6.6 0 0 1 0-4.2V7.06H2.18a11 11 0 0 0 0 9.88l3.66-2.84Z" />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84C6.71 7.3 9.14 5.38 12 5.38Z"
      />
    </svg>
  );
}
