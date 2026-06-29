import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 px-4 text-center">
      <p className="font-display text-6xl font-bold text-primary">404</p>
      <p className="text-lg font-medium">Səhifə tapılmadı</p>
      <p className="text-sm text-muted-foreground">Axtardığınız səhifə mövcud deyil və ya köçürülüb.</p>
      <Link href="/dashboard" className="rounded-button bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90">
        İdarə panelinə qayıt
      </Link>
    </div>
  );
}
