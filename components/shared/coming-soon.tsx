import { Construction } from 'lucide-react';
import { PageHeader } from './page-header';
import { Card, CardContent } from '@/components/ui/card';

export function ComingSoon({ title, phase }: { title: string; phase?: string }) {
  return (
    <div>
      <PageHeader title={title} />
      <Card className="rounded-card">
        <CardContent className="flex flex-col items-center gap-3 p-12 text-center">
          <div className="rounded-full bg-muted p-4">
            <Construction className="h-7 w-7 text-warning" />
          </div>
          <p className="font-medium">Bu modul tezliklə əlavə olunacaq</p>
          <p className="max-w-md text-sm text-muted-foreground">
            {phase ? `Yol xəritəsi: ${phase}.` : ''} Faza 1 təməl modulları (auth, RBAC, xam material, təchizatçı)
            artıq hazırdır.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
