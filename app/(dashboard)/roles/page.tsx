'use client';

import { ShieldCheck } from 'lucide-react';
import {
  ROLES,
  ALL_ROLE_CODES,
  MODULE_KEYS,
  MODULE_LABELS,
  getPermissions,
  type PermissionAction,
} from '@/lib/rbac/permissions';
import { PageHeader } from '@/components/shared/page-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

const ACTION_SHORT: Record<PermissionAction, string> = {
  create: 'C',
  read: 'R',
  update: 'U',
  delete: 'D',
  approve: 'A',
};

export default function RolesPage() {
  return (
    <div>
      <PageHeader title="Rol İdarəetməsi" subtitle="Built-in rollar və CRUD səlahiyyət matrisi" />

      {/* Rol kartları */}
      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {ALL_ROLE_CODES.map((code) => {
          const r = ROLES[code];
          return (
            <Card key={code} className="rounded-card">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">{r.name}</CardTitle>
                  <Badge variant="secondary">Səviyyə {r.level}</Badge>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-xs text-muted-foreground">{r.description}</p>
                <p className="mt-2 font-mono text-[11px] text-muted-foreground">{r.code}</p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Səlahiyyət matrisi */}
      <Card className="rounded-card">
        <CardHeader>
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-primary" />
            <CardTitle className="text-base">Səlahiyyət Matrisi</CardTitle>
          </div>
          <p className="text-xs text-muted-foreground">
            C=Create · R=Read · U=Update · D=Delete · A=Approve · —=Yoxdur
          </p>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="sticky left-0 bg-card">Modul</TableHead>
                {ALL_ROLE_CODES.map((code) => (
                  <TableHead key={code} className="text-center whitespace-nowrap">
                    {ROLES[code].name}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {MODULE_KEYS.map((module) => (
                <TableRow key={module}>
                  <TableCell className="sticky left-0 bg-card font-medium whitespace-nowrap">
                    {MODULE_LABELS[module]}
                  </TableCell>
                  {ALL_ROLE_CODES.map((code) => {
                    const actions = getPermissions(code, module);
                    const text = actions.length === 0 ? '—' : actions.map((a) => ACTION_SHORT[a]).join('');
                    return (
                      <TableCell
                        key={code}
                        className={`text-center font-mono text-xs ${
                          actions.length === 0 ? 'text-muted-foreground' : 'font-semibold'
                        }`}
                      >
                        {text}
                      </TableCell>
                    );
                  })}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <div className="mt-4 rounded-card border border-dashed p-4 text-sm text-muted-foreground">
        Built-in rollar koda daxil edilib və Firestore Security Rules ilə qorunur. Dinamik (custom) rol
        yaratma — spec 01 §1.2.2 — sonrakı fazada `roles` kolleksiyası əsasında əlavə oluna bilər.
      </div>
    </div>
  );
}
