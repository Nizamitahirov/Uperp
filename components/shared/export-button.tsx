'use client';

import { Download, FileSpreadsheet, FileText } from 'lucide-react';
import { exportToExcel, exportToCsv, type ExportColumn } from '@/lib/utils/export';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface Props<T> {
  filename: string;
  columns: ExportColumn<T>[];
  rows: T[];
  label?: string;
  disabled?: boolean;
}

/** Cədvəl üçün Excel/CSV ixrac düyməsi (dropdown) */
export function ExportButton<T>({ filename, columns, rows, label = 'İxrac', disabled }: Props<T>) {
  const empty = rows.length === 0;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" disabled={disabled || empty}>
          <Download className="h-4 w-4" /> {label}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => exportToExcel(filename, columns, rows)}>
          <FileSpreadsheet className="h-4 w-4 text-success" /> Excel (.xlsx)
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => exportToCsv(filename, columns, rows)}>
          <FileText className="h-4 w-4 text-muted-foreground" /> CSV
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
