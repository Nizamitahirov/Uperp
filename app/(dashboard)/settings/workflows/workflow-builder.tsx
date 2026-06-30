'use client';

import { useEffect, useState } from 'react';
import { ArrowDown, ArrowUp, ChevronDown, Loader2, Plus, Trash2, Zap } from 'lucide-react';
import type { Workflow, WorkflowActionType, WorkflowStep, WorkflowStatus, WorkflowTriggerType } from '@/types';
import { createWorkflow, updateWorkflow, type WorkflowInput } from '@/lib/firebase/workflows';
import { TRIGGERS, ACTIONS, TRIGGER_MAP, ACTION_MAP, CONDITION_OPS } from '@/lib/workflow/catalog';
import { ROLES } from '@/lib/rbac/permissions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AiWriteButton } from '@/components/ai/ai-write-button';
import { toast } from '@/components/ui/toast';
import { cn } from '@/lib/utils/cn';

interface SimpleUser { id: string; name: string; role?: string }

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  initial: Workflow | null;
  users: SimpleUser[];
  onSaved: () => void;
}

const ROLE_OPTIONS = Object.values(ROLES).map((r) => ({ value: r.code, label: r.name }));
const uid = () => (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2));

export function WorkflowBuilder({ open, onOpenChange, initial, users, onSaved }: Props) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [trigger, setTrigger] = useState<WorkflowTriggerType>('manual');
  const [condField, setCondField] = useState('');
  const [condOp, setCondOp] = useState('eq');
  const [condValue, setCondValue] = useState('');
  const [steps, setSteps] = useState<WorkflowStep[]>([]);
  const [status, setStatus] = useState<WorkflowStatus>('draft');
  const [approvalMode, setApprovalMode] = useState<'parallel' | 'sequential'>('sequential');
  const [channels, setChannels] = useState<('app' | 'email')[]>(['app']);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [palette, setPalette] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setName(initial?.name ?? '');
    setDescription(initial?.description ?? '');
    setTrigger(initial?.trigger ?? 'manual');
    setCondField(initial?.triggerCondition?.field ?? '');
    setCondOp(initial?.triggerCondition?.op ?? 'eq');
    setCondValue(initial?.triggerCondition?.value ?? '');
    setSteps(initial?.steps ?? []);
    setStatus(initial?.status ?? 'draft');
    setApprovalMode(initial?.approvalMode ?? 'sequential');
    setChannels(initial?.channels ?? ['app']);
    setExpanded(null);
    setPalette(false);
  }, [open, initial]);

  const trig = TRIGGER_MAP.get(trigger);

  function addStep(type: WorkflowActionType) {
    const step: WorkflowStep = { id: uid(), type, condition: null };
    if (type === 'approval' || type === 'assign') step.assigneeType = 'role';
    if (type === 'notify') step.message = '';
    setSteps((s) => [...s, step]);
    setExpanded(step.id);
    setPalette(false);
  }
  function patchStep(id: string, patch: Partial<WorkflowStep>) {
    setSteps((s) => s.map((x) => (x.id === id ? { ...x, ...patch } : x)));
  }
  function move(idx: number, dir: -1 | 1) {
    setSteps((s) => {
      const next = [...s];
      const j = idx + dir;
      if (j < 0 || j >= next.length) return s;
      [next[idx], next[j]] = [next[j], next[idx]];
      return next;
    });
  }
  function removeStep(id: string) {
    setSteps((s) => s.filter((x) => x.id !== id));
  }

  async function save() {
    if (!name.trim()) { toast.error('Workflow adı daxil edin'); return; }
    if (steps.length === 0) { toast.error('Ən azı bir addım əlavə edin'); return; }
    setSaving(true);
    try {
      const payload: WorkflowInput = {
        name: name.trim(),
        description: description.trim() || undefined,
        trigger,
        triggerCondition: condField ? { field: condField, op: condOp as never, value: condValue } : null,
        steps,
        status,
        approvalMode,
        channels,
      };
      if (initial) await updateWorkflow(initial.id, payload);
      else await createWorkflow(payload);
      toast.success(initial ? 'Workflow yeniləndi' : 'Workflow yaradıldı');
      onSaved();
      onOpenChange(false);
    } catch (e) {
      toast.error('Yadda saxlanmadı', e instanceof Error ? e.message : undefined);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>{initial ? 'Workflow düzəlt' : 'Yeni workflow'}</DialogTitle>
        </DialogHeader>

        <div className="max-h-[72vh] space-y-5 overflow-y-auto pr-1">
          {/* Ad + status */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_auto]">
            <div className="space-y-1.5">
              <Label>Ad *</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Məs. Böyük PO təsdiqi" />
            </div>
            <div className="space-y-1.5">
              <Label>Status</Label>
              <Select value={status} onValueChange={(v) => setStatus(v as WorkflowStatus)}>
                <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Aktiv</SelectItem>
                  <SelectItem value="draft">Qaralama</SelectItem>
                  <SelectItem value="paused">Dayandırılıb</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Təsvir</Label>
            <Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Bu avtomatlaşdırma nə edir?" />
          </div>

          {/* TRIGGER */}
          <div>
            <p className="mb-2 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              <Zap className="h-3.5 w-3.5 text-warning" /> Trigger — nə vaxt başlasın
            </p>
            <Select value={trigger} onValueChange={(v) => { setTrigger(v as WorkflowTriggerType); setCondField(''); }}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {TRIGGERS.map((tr) => <SelectItem key={tr.type} value={tr.type}>{tr.label}</SelectItem>)}
              </SelectContent>
            </Select>
            {trig?.description && <p className="mt-1.5 text-xs text-muted-foreground">{trig.description}</p>}

            {/* Şərt (opsional) */}
            {trig && trig.fields.length > 0 && (
              <div className="mt-3 rounded-card border border-border bg-secondary/30 p-3">
                <p className="mb-2 text-xs font-medium">Şərt (opsional) — yalnız uyğun olduqda işə düşsün</p>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                  <Select value={condField || '__none'} onValueChange={(v) => setCondField(v === '__none' ? '' : v)}>
                    <SelectTrigger><SelectValue placeholder="Sahə" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none">— şərt yoxdur —</SelectItem>
                      {trig.fields.map((f) => <SelectItem key={f.key} value={f.key}>{f.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <Select value={condOp} onValueChange={setCondOp} >
                    <SelectTrigger disabled={!condField}><SelectValue /></SelectTrigger>
                    <SelectContent>{CONDITION_OPS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
                  </Select>
                  <Input disabled={!condField} value={condValue} onChange={(e) => setCondValue(e.target.value)} placeholder="Dəyər" />
                </div>
              </div>
            )}
          </div>

          {/* AXIN (steps) */}
          <div>
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Addımlar — ardıcıl icra</p>

            {/* Trigger node */}
            <FlowNode tint="bg-warning/10 text-warning" icon={<Zap className="h-4 w-4" />} title={trig?.label ?? 'Trigger'} subtitle="Başlanğıc" />

            {steps.map((step, idx) => {
              const def = ACTION_MAP.get(step.type)!;
              const isOpen = expanded === step.id;
              return (
                <div key={step.id}>
                  <Connector />
                  <div className="rounded-card border border-border bg-card">
                    <button type="button" onClick={() => setExpanded(isOpen ? null : step.id)} className="flex w-full items-center gap-3 p-3 text-left">
                      <span className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-button', def.tint)}><def.icon className="h-4 w-4" /></span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-semibold">{idx + 1}. {def.label}</span>
                        <span className="block truncate text-xs text-muted-foreground">{stepSummary(step, users)}</span>
                      </span>
                      <span className="flex shrink-0 items-center gap-0.5" onClick={(e) => e.stopPropagation()}>
                        <Button variant="ghost" size="icon" className="h-7 w-7" disabled={idx === 0} onClick={() => move(idx, -1)}><ArrowUp className="h-3.5 w-3.5" /></Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7" disabled={idx === steps.length - 1} onClick={() => move(idx, 1)}><ArrowDown className="h-3.5 w-3.5" /></Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-danger" onClick={() => removeStep(step.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
                        <ChevronDown className={cn('h-4 w-4 text-muted-foreground transition-transform', isOpen && 'rotate-180')} />
                      </span>
                    </button>
                    {isOpen && (
                      <div className="border-t border-border p-3">
                        <StepEditor step={step} users={users} onPatch={(p) => patchStep(step.id, p)} />
                      </div>
                    )}
                  </div>
                </div>
              );
            })}

            {/* Add step */}
            <Connector />
            {palette ? (
              <div className="rounded-card border border-dashed border-primary/40 bg-primary/5 p-3">
                <p className="mb-2 text-xs font-medium text-muted-foreground">Əməliyyat seçin</p>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {ACTIONS.map((a) => (
                    <button key={a.type} type="button" onClick={() => addStep(a.type)} className="flex items-start gap-2 rounded-button border border-border bg-card p-2 text-left transition-colors hover:border-primary/40 hover:bg-secondary">
                      <span className={cn('flex h-8 w-8 shrink-0 items-center justify-center rounded-button', a.tint)}><a.icon className="h-4 w-4" /></span>
                      <span className="min-w-0">
                        <span className="block text-xs font-semibold leading-tight">{a.label}</span>
                        <span className="block text-[11px] leading-tight text-muted-foreground">{a.description}</span>
                      </span>
                    </button>
                  ))}
                </div>
                <Button variant="ghost" size="sm" className="mt-2" onClick={() => setPalette(false)}>Bağla</Button>
              </div>
            ) : (
              <button type="button" onClick={() => setPalette(true)} className="flex w-full items-center justify-center gap-2 rounded-card border border-dashed border-border py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:border-primary/40 hover:bg-secondary hover:text-foreground">
                <Plus className="h-4 w-4" /> Addım əlavə et
              </button>
            )}
          </div>

          {/* Təsdiq rejimi */}
          {steps.some((s) => s.type === 'approval') && (
            <div>
              <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Təsdiq rejimi</p>
              <div className="flex gap-2">
                {(['sequential', 'parallel'] as const).map((mode) => (
                  <button key={mode} type="button" onClick={() => setApprovalMode(mode)}
                    className={cn('rounded-button border px-3 py-1.5 text-sm transition-colors', approvalMode === mode ? 'border-primary bg-primary text-primary-foreground' : 'border-border')}>
                    {mode === 'sequential' ? 'Ardıcıl (bir-bir)' : 'Paralel (eyni anda)'}
                  </button>
                ))}
              </div>
              <p className="mt-1 text-xs text-muted-foreground">{approvalMode === 'sequential' ? 'Hər təsdiq əvvəlkindən sonra istənilir.' : 'Bütün təsdiqlər eyni anda istənilir.'}</p>
            </div>
          )}

          {/* Kanallar */}
          <div>
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Bildiriş kanalları</p>
            <div className="flex gap-2">
              {(['app', 'email'] as const).map((c) => (
                <button key={c} type="button" onClick={() => setChannels((ch) => ch.includes(c) ? ch.filter((x) => x !== c) : [...ch, c])}
                  className={cn('rounded-button border px-3 py-1.5 text-sm transition-colors', channels.includes(c) ? 'border-primary bg-primary text-primary-foreground' : 'border-border')}>
                  {c === 'app' ? 'Tətbiqdaxili' : 'Email'}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-2 border-t border-border pt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Ləğv</Button>
          <Button onClick={save} disabled={saving}>{saving && <Loader2 className="animate-spin" />} Yadda saxla</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function StepEditor({ step, users, onPatch }: { step: WorkflowStep; users: SimpleUser[]; onPatch: (p: Partial<WorkflowStep>) => void }) {
  const needsAssignee = step.type === 'approval' || step.type === 'assign';
  const needsMessage = step.type === 'notify' || step.type === 'create_task' || step.type === 'ai_summary';
  return (
    <div className="space-y-3">
      {needsAssignee && (
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label className="text-xs">Təyinat tipi</Label>
            <Select value={step.assigneeType ?? 'role'} onValueChange={(v) => onPatch({ assigneeType: v as 'role' | 'user' })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="role">Rol üzrə</SelectItem><SelectItem value="user">Şəxs üzrə</SelectItem></SelectContent>
            </Select>
          </div>
          {step.assigneeType === 'user' ? (
            <div className="space-y-1.5">
              <Label className="text-xs">Şəxs</Label>
              <Select value={step.assigneeUserId ?? ''} onValueChange={(v) => { const u = users.find((x) => x.id === v); onPatch({ assigneeUserId: v, assigneeUserName: u?.name }); }}>
                <SelectTrigger><SelectValue placeholder="Şəxs seç" /></SelectTrigger>
                <SelectContent>{users.map((u) => <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          ) : (
            <div className="space-y-1.5">
              <Label className="text-xs">Rol</Label>
              <Select value={step.assigneeRole ?? ''} onValueChange={(v) => onPatch({ assigneeRole: v })}>
                <SelectTrigger><SelectValue placeholder="Rol seç" /></SelectTrigger>
                <SelectContent>{ROLE_OPTIONS.map((r) => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          )}
        </div>
      )}

      {step.type === 'approval' && (
        <div className="space-y-1.5">
          <Label className="text-xs">Təsdiq səviyyəsi</Label>
          <Input type="number" min={1} className="w-28" value={step.approvalLevel ?? 1} onChange={(e) => onPatch({ approvalLevel: +e.target.value })} />
        </div>
      )}

      {needsMessage && (
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <Label className="text-xs">Mesaj</Label>
            <AiWriteButton label="AI ilə yaz" buildPrompt={() => `ERP avtomatlaşdırma addımı üçün qısa bildiriş/tapşırıq mesajı yaz (Azərbaycan, 1 cümlə). Addım növü: ${step.type}.`} onResult={(t) => onPatch({ message: t })} />
          </div>
          <Input value={step.message ?? ''} onChange={(e) => onPatch({ message: e.target.value })} placeholder="Bildiriş mətni..." />
        </div>
      )}

      {step.type === 'email' && (
        <div className="space-y-2">
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label className="text-xs">Rola göndər</Label>
              <Select value={step.emailToRole ?? '__none'} onValueChange={(v) => onPatch({ emailToRole: v === '__none' ? undefined : v })}>
                <SelectTrigger><SelectValue placeholder="Rol seç" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none">— yox —</SelectItem>
                  {ROLE_OPTIONS.map((r) => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">və/və ya ünvan(lar)</Label>
              <Input value={step.emailTo ?? ''} onChange={(e) => onPatch({ emailTo: e.target.value })} placeholder="ad@nümunə.az, ..." />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Mövzu</Label>
            <Input value={step.emailSubject ?? ''} onChange={(e) => onPatch({ emailSubject: e.target.value })} placeholder="Email mövzusu" />
          </div>
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label className="text-xs">Mətn</Label>
              <AiWriteButton label="AI ilə yaz" buildPrompt={() => `ERP avtomatlaşdırması üçün qısa peşəkar email mətni yaz (Azərbaycan, 2 cümlə). Mövzu: ${step.emailSubject || 'sənəd'}.`} onResult={(t) => onPatch({ message: t })} />
            </div>
            <Input value={step.message ?? ''} onChange={(e) => onPatch({ message: e.target.value })} placeholder="Email mətni..." />
          </div>
        </div>
      )}

      {step.type === 'update_status' && (
        <div className="space-y-1.5">
          <Label className="text-xs">Yeni status</Label>
          <Input value={step.newStatus ?? ''} onChange={(e) => onPatch({ newStatus: e.target.value })} placeholder="məs. approved" />
        </div>
      )}
      {step.type === 'delay' && (
        <div className="space-y-1.5">
          <Label className="text-xs">Gözləmə (saat)</Label>
          <Input type="number" min={0} className="w-28" value={step.delayHours ?? 1} onChange={(e) => onPatch({ delayHours: +e.target.value })} />
        </div>
      )}
      {step.type === 'webhook' && (
        <div className="space-y-1.5">
          <Label className="text-xs">Webhook URL</Label>
          <Input value={step.webhookUrl ?? ''} onChange={(e) => onPatch({ webhookUrl: e.target.value })} placeholder="https://..." />
        </div>
      )}
    </div>
  );
}

function FlowNode({ tint, icon, title, subtitle }: { tint: string; icon: React.ReactNode; title: string; subtitle: string }) {
  return (
    <div className="flex items-center gap-3 rounded-card border border-border bg-card p-3">
      <span className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-button', tint)}>{icon}</span>
      <div><p className="text-sm font-semibold">{title}</p><p className="text-xs text-muted-foreground">{subtitle}</p></div>
    </div>
  );
}
function Connector() {
  return <div className="ml-[26px] h-4 w-px bg-border" />;
}

function stepSummary(step: WorkflowStep, users: SimpleUser[]): string {
  const parts: string[] = [];
  if (step.assigneeType === 'role' && step.assigneeRole) parts.push(`Rol: ${ROLES[step.assigneeRole as keyof typeof ROLES]?.name ?? step.assigneeRole}`);
  if (step.assigneeType === 'user' && step.assigneeUserId) parts.push(`Şəxs: ${step.assigneeUserName ?? users.find((u) => u.id === step.assigneeUserId)?.name ?? '—'}`);
  if (step.message) parts.push(`"${step.message.slice(0, 30)}"`);
  if (step.newStatus) parts.push(`→ ${step.newStatus}`);
  if (step.delayHours) parts.push(`${step.delayHours} saat`);
  return parts.join(' · ') || 'Konfiqurasiya üçün klikləyin';
}
