'use client'
import { useState, useEffect, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
import { Plus, Search, UserCheck, Eye, ChevronDown, Trash2, Sparkles, Loader2, ChevronUp } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { STATUS_LABELS, formatDate } from '@/lib/utils'

// ─── Types ────────────────────────────────────────────────────────────────────

interface Student {
  id: string
  name: string
  enrollment: string
  cgm?: string
  birthDate?: string
  cpf?: string
  rg?: string
  email?: string
  phone?: string
  address?: string
  city?: string
  state?: string
  status: string
  observations?: string
  medicalInfo?: string
  classId?: string
  class?: { id: string; name: string; grade?: { name: string; segment?: { name: string } } }
  guardians: Guardian[]
  gradeRecords?: GradeRecord[]
  homeworkSubmissions?: { id: string; homework: { subject: { id: string; name: string } } }[]
  _count?: { homeworkSubmissions: number; gradeRecords: number }
  subjectAbsences?: Record<string, { faltas: number; faltasJustificadas: number }>
}

interface Guardian {
  id: string; name: string; relationship: string; phone?: string; email?: string; isPrimary: boolean
}

interface GradeRecord {
  id: string
  score?: number
  assessment: { name: string; period?: string; subject: { id: string; name: string } }
}

interface StudentLog {
  id: string
  category: string
  content: string
  createdAt: string
  user: { id: string; name: string; role: string }
}

interface ClassOption {
  id: string; name: string; grade?: { name: string }
}

// ─── Constants ────────────────────────────────────────────────────────────────

const STATUS_OPTS = ['ATIVO', 'INATIVO', 'TRANSFERIDO', 'FORMADO', 'SUSPENSO']
const STATUS_BADGE: Record<string, any> = {
  ATIVO: 'success', INATIVO: 'secondary', TRANSFERIDO: 'warning', FORMADO: 'info', SUSPENSO: 'destructive'
}

const LOG_CATEGORIES: Record<string, { label: string; color: string }> = {
  OBSERVACAO:    { label: 'Observação',    color: 'bg-blue-100 text-blue-800' },
  REUNIAO:       { label: 'Reunião',       color: 'bg-purple-100 text-purple-800' },
  ADVERTENCIA:   { label: 'Advertência',   color: 'bg-yellow-100 text-yellow-800' },
  SUSPENSAO:     { label: 'Suspensão',     color: 'bg-red-100 text-red-800' },
  ELOGIO:        { label: 'Elogio',        color: 'bg-green-100 text-green-800' },
  ENCAMINHAMENTO:{ label: 'Encaminhamento',color: 'bg-orange-100 text-orange-800' },
  CONTATO_RESP:  { label: 'Contato c/ Resp.', color: 'bg-teal-100 text-teal-800' },
  OCORRENCIA:    { label: 'Ocorrência',    color: 'bg-pink-100 text-pink-800' },
  OUTRO:         { label: 'Outro',         color: 'bg-gray-100 text-gray-800' },
}

const DEFAULT_FORM = {
  name: '', enrollment: '', cgm: '', birthDate: '', cpf: '', rg: '', email: '',
  phone: '', address: '', city: '', state: '', zipCode: '',
  status: 'ATIVO', observations: '', medicalInfo: '', classId: '',
}

const DEFAULT_GUARDIAN = { name: '', relationship: '', phone: '', email: '', isPrimary: false }

// ─── Helpers ──────────────────────────────────────────────────────────────────

function initials(name: string) {
  return name.split(' ').filter(Boolean).slice(0, 2).map(w => w[0].toUpperCase()).join('')
}

function Avatar({ name, size = 8 }: { name: string; size?: number }) {
  const colors = ['bg-teal-500', 'bg-violet-500', 'bg-amber-500', 'bg-rose-500', 'bg-sky-500', 'bg-emerald-500']
  const color = colors[name.charCodeAt(0) % colors.length]
  return (
    <div className={`flex items-center justify-center rounded-full text-white font-semibold ${color}`}
      style={{ width: size * 4, height: size * 4, fontSize: size * 1.6 }}>
      {initials(name)}
    </div>
  )
}

function InfoField({ label, value }: { label: string; value?: string | null }) {
  return (
    <div>
      <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">{label}</p>
      <p className="text-sm mt-0.5">{value || '-'}</p>
    </div>
  )
}

// ─── NotasTab ─────────────────────────────────────────────────────────────────

function NotasTab({ student }: { student: Student }) {
  const [open, setOpen] = useState<string | null>(null)

  if (!student.gradeRecords?.length) {
    return <p className="text-sm text-muted-foreground pt-4">Nenhuma nota lançada.</p>
  }

  // Group by subject
  const bySubject: Record<string, { subjectName: string; records: GradeRecord[] }> = {}
  for (const r of student.gradeRecords) {
    const sid = r.assessment.subject.id
    if (!bySubject[sid]) bySubject[sid] = { subjectName: r.assessment.subject.name, records: [] }
    bySubject[sid].records.push(r)
  }

  return (
    <div className="pt-4 space-y-2">
      {Object.entries(bySubject).map(([sid, { subjectName, records }]) => {
        const scores = records.filter(r => r.score != null).map(r => r.score as number)
        const avg = scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : null
        const abs = student.subjectAbsences?.[sid]
        const isOpen = open === sid

        return (
          <div key={sid}>
            <button
              type="button"
              onClick={() => setOpen(isOpen ? null : sid)}
              className="w-full flex items-center justify-between p-3 rounded-lg border bg-muted/30 hover:bg-muted/50 transition-colors"
            >
              <div className="flex items-center gap-3">
                <span className="font-medium text-sm">{subjectName}</span>
                {abs && (abs.faltas > 0 || abs.faltasJustificadas > 0) && (
                  <span className="text-xs">
                    {abs.faltas > 0 && <span className="text-red-600">{abs.faltas}F</span>}
                    {abs.faltas > 0 && abs.faltasJustificadas > 0 && ' · '}
                    {abs.faltasJustificadas > 0 && <span className="text-amber-600">{abs.faltasJustificadas}FJ</span>}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                {avg != null && (
                  <Badge variant={avg >= 6 ? 'success' : avg >= 5 ? 'warning' : 'destructive'}>
                    Média: {avg.toFixed(1)}
                  </Badge>
                )}
                {isOpen ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
              </div>
            </button>
            {isOpen && (
              <div className="border border-t-0 rounded-b-lg p-3 space-y-1.5">
                {records.map(r => (
                  <div key={r.id} className="flex justify-between items-center text-sm py-1">
                    <span className="text-muted-foreground">{r.assessment.name}</span>
                    <span className={`font-medium ${r.score == null ? 'text-muted-foreground' : r.score >= 6 ? 'text-green-700' : 'text-red-600'}`}>
                      {r.score != null ? r.score.toFixed(1) : '—'}
                    </span>
                  </div>
                ))}
                {abs && (
                  <div className="flex gap-4 pt-2 border-t text-xs text-muted-foreground">
                    {abs.faltas > 0 && <span className="text-red-600">Faltas: {abs.faltas}</span>}
                    {abs.faltasJustificadas > 0 && <span className="text-amber-600">Faltas justificadas: {abs.faltasJustificadas}</span>}
                    {abs.faltas === 0 && abs.faltasJustificadas === 0 && <span>Sem faltas registradas</span>}
                  </div>
                )}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

// ─── FichaDisciplinarTab ──────────────────────────────────────────────────────

function FichaDisciplinarTab({ studentId }: { studentId: string }) {
  const { data: session } = useSession()
  const [logs, setLogs] = useState<StudentLog[]>([])
  const [category, setCategory] = useState('OBSERVACAO')
  const [content, setContent] = useState('')
  const [saving, setSaving] = useState(false)
  const [summarizing, setSummarizing] = useState(false)
  const [summary, setSummary] = useState<string | null>(null)
  const { toast } = useToast()

  const fetchLogs = useCallback(async () => {
    const res = await fetch(`/api/alunos/${studentId}/logs`)
    if (res.ok) setLogs(await res.json())
  }, [studentId])

  useEffect(() => { fetchLogs() }, [fetchLogs])

  const handleAdd = async () => {
    if (!content.trim()) return
    setSaving(true)
    const res = await fetch(`/api/alunos/${studentId}/logs`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ category, content }),
    })
    if (res.ok) {
      setContent('')
      fetchLogs()
    } else {
      toast({ title: 'Erro ao salvar', variant: 'destructive' })
    }
    setSaving(false)
  }

  const handleDelete = async (logId: string) => {
    const res = await fetch(`/api/alunos/${studentId}/logs?logId=${logId}`, { method: 'DELETE' })
    if (res.ok) fetchLogs()
    else toast({ title: 'Erro ao excluir', variant: 'destructive' })
  }

  const handleSummary = async () => {
    setSummarizing(true)
    setSummary(null)
    const res = await fetch(`/api/alunos/${studentId}/ai-summary`, { method: 'POST' })
    const data = await res.json()
    setSummarizing(false)
    if (res.ok) setSummary(data.summary)
    else toast({ title: data.error || 'Erro ao gerar resumo', variant: 'destructive' })
  }

  const currentUserId = (session?.user as any)?.id
  const currentRole = (session?.user as any)?.role

  return (
    <div className="pt-4 space-y-4">
      {/* Add log */}
      <div className="space-y-2 border rounded-lg p-3 bg-muted/20">
        <div className="flex gap-2">
          <select
            className="flex h-9 rounded-md border border-input bg-background px-2 py-1 text-sm"
            value={category}
            onChange={e => setCategory(e.target.value)}
          >
            {Object.entries(LOG_CATEGORIES).map(([k, v]) => (
              <option key={k} value={k}>{v.label}</option>
            ))}
          </select>
        </div>
        <Textarea
          placeholder="Descreva a ocorrência, reunião, elogio ou observação..."
          rows={3}
          value={content}
          onChange={e => setContent(e.target.value)}
        />
        <div className="flex justify-between items-center">
          <Button
            variant="outline"
            size="sm"
            onClick={handleSummary}
            disabled={summarizing || logs.length === 0}
            className="gap-1.5 text-violet-700 border-violet-300 hover:bg-violet-50"
          >
            {summarizing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
            Resumo IA
          </Button>
          <Button size="sm" onClick={handleAdd} disabled={saving || !content.trim()}>
            {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : null}
            Salvar registro
          </Button>
        </div>
      </div>

      {/* AI Summary */}
      {summary && (
        <Card className="border-violet-200 bg-violet-50">
          <CardContent className="p-3 space-y-1">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-violet-700">
              <Sparkles className="h-3.5 w-3.5" /> Resumo da IA
            </div>
            <p className="text-sm whitespace-pre-wrap">{summary}</p>
          </CardContent>
        </Card>
      )}

      {/* Log list */}
      {logs.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nenhum registro ainda.</p>
      ) : (
        <div className="space-y-2">
          {logs.map(log => {
            const cat = LOG_CATEGORIES[log.category] || LOG_CATEGORIES.OUTRO
            const canDelete = log.user.id === currentUserId || ['ADMIN', 'COORDENACAO'].includes(currentRole || '')
            return (
              <div key={log.id} className="border rounded-lg p-3 space-y-1.5">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${cat.color}`}>{cat.label}</span>
                    <span className="text-xs text-muted-foreground">{log.user.name}</span>
                    <span className="text-xs text-muted-foreground">
                      {new Date(log.createdAt).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                  {canDelete && (
                    <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground hover:text-red-500 shrink-0"
                      onClick={() => handleDelete(log.id)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>
                <p className="text-sm">{log.content}</p>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function AlunosPage() {
  const [students, setStudents] = useState<Student[]>([])
  const [classes, setClasses] = useState<ClassOption[]>([])
  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  const [open, setOpen] = useState(false)
  const [viewOpen, setViewOpen] = useState(false)
  const [selected, setSelected] = useState<Student | null>(null)
  const [form, setForm] = useState(DEFAULT_FORM)
  const [guardians, setGuardians] = useState([{ ...DEFAULT_GUARDIAN }])
  const { toast } = useToast()

  useEffect(() => { fetchStudents(); fetchClasses() }, [])

  const fetchStudents = async () => {
    const res = await fetch('/api/alunos')
    if (res.ok) setStudents(await res.json())
  }

  const fetchClasses = async () => {
    const res = await fetch('/api/turmas')
    if (res.ok) setClasses(await res.json())
  }

  const fetchStudent = async (id: string) => {
    const res = await fetch(`/api/alunos/${id}`)
    if (res.ok) setSelected(await res.json())
  }

  const handleSave = async () => {
    const payload = {
      ...form,
      cgm: form.cgm || undefined,
      cpf: form.cpf || undefined,
      classId: form.classId || undefined,
      birthDate: form.birthDate || undefined,
      guardians: guardians.filter(g => g.name.trim()),
    }
    const res = await fetch('/api/alunos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    if (res.ok) {
      toast({ title: 'Aluno cadastrado!' })
      setOpen(false)
      setForm(DEFAULT_FORM)
      setGuardians([{ ...DEFAULT_GUARDIAN }])
      fetchStudents()
    } else {
      const data = await res.json().catch(() => ({}))
      toast({ title: data.error || 'Erro ao salvar', variant: 'destructive' })
    }
  }

  const openView = async (s: Student) => {
    setSelected(s)
    setViewOpen(true)
    const res = await fetch(`/api/alunos/${s.id}`)
    if (res.ok) setSelected(await res.json())
  }

  const filtered = students.filter(s => {
    const matchSearch = !search ||
      s.name.toLowerCase().includes(search.toLowerCase()) ||
      s.enrollment.includes(search) ||
      (s.cgm || '').includes(search)
    const matchStatus = !filterStatus || s.status === filterStatus
    return matchSearch && matchStatus
  })

  const addGuardian = () => setGuardians(g => [...g, { ...DEFAULT_GUARDIAN }])
  const updateGuardian = (i: number, field: string, value: string | boolean) =>
    setGuardians(g => g.map((item, idx) => idx === i ? { ...item, [field]: value } : item))
  const removeGuardian = (i: number) => setGuardians(g => g.filter((_, idx) => idx !== i))

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2"><UserCheck className="h-6 w-6" /> Alunos</h1>
          <p className="text-muted-foreground text-sm">{students.length} alunos cadastrados</p>
        </div>
        <Button onClick={() => { setForm(DEFAULT_FORM); setGuardians([{ ...DEFAULT_GUARDIAN }]); setOpen(true) }}>
          <Plus className="h-4 w-4 mr-2" /> Novo Aluno
        </Button>
      </div>

      {/* Filters */}
      <div className="flex gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Buscar por nome, matrícula ou CGM..." className="pl-9" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <select
          className="flex h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
          value={filterStatus}
          onChange={e => setFilterStatus(e.target.value)}
        >
          <option value="">Todos os status</option>
          {STATUS_OPTS.map(s => <option key={s} value={s}>{STATUS_LABELS[s] || s}</option>)}
        </select>
        {(search || filterStatus) && (
          <Button variant="ghost" size="sm" onClick={() => { setSearch(''); setFilterStatus('') }}>
            Limpar
          </Button>
        )}
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Aluno</TableHead>
                <TableHead>Matrícula</TableHead>
                <TableHead>CGM</TableHead>
                <TableHead>Turma</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-16">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Nenhum aluno encontrado.</TableCell></TableRow>
              ) : filtered.map(s => (
                <TableRow key={s.id}>
                  <TableCell>
                    <div className="flex items-center gap-2.5">
                      <Avatar name={s.name} size={8} />
                      <span className="font-medium">{s.name}</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-sm font-mono">{s.enrollment}</TableCell>
                  <TableCell className="text-sm font-mono text-muted-foreground">{s.cgm || '-'}</TableCell>
                  <TableCell>{s.class ? `${s.class.grade?.name || ''} ${s.class.name}`.trim() : '-'}</TableCell>
                  <TableCell>
                    <Badge variant={STATUS_BADGE[s.status] || 'secondary'}>{STATUS_LABELS[s.status] || s.status}</Badge>
                  </TableCell>
                  <TableCell>
                    <Button variant="ghost" size="icon" onClick={() => openView(s)}>
                      <Eye className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* New Student Dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Cadastrar Aluno</DialogTitle></DialogHeader>
          <Tabs defaultValue="pessoal">
            <TabsList className="w-full">
              <TabsTrigger value="pessoal" className="flex-1">Dados Pessoais</TabsTrigger>
              <TabsTrigger value="academico" className="flex-1">Acadêmico</TabsTrigger>
              <TabsTrigger value="responsaveis" className="flex-1">Responsáveis</TabsTrigger>
            </TabsList>

            {/* Personal */}
            <TabsContent value="pessoal" className="space-y-4 pt-4">
              <div className="space-y-2">
                <Label>Nome completo *</Label>
                <Input placeholder="Nome do aluno" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>CPF</Label>
                  <Input placeholder="000.000.000-00" value={form.cpf} onChange={e => setForm({ ...form, cpf: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>RG</Label>
                  <Input placeholder="RG" value={form.rg} onChange={e => setForm({ ...form, rg: e.target.value })} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Data de nascimento</Label>
                  <Input type="date" value={form.birthDate} onChange={e => setForm({ ...form, birthDate: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>Telefone</Label>
                  <Input placeholder="(11) 99999-9999" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} />
                </div>
              </div>
              <div className="space-y-2">
                <Label>E-mail</Label>
                <Input placeholder="aluno@email.com" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Endereço</Label>
                <Input placeholder="Rua, número, bairro" value={form.address} onChange={e => setForm({ ...form, address: e.target.value })} />
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2 col-span-2">
                  <Label>Cidade</Label>
                  <Input value={form.city} onChange={e => setForm({ ...form, city: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>Estado</Label>
                  <Input placeholder="SP" maxLength={2} value={form.state} onChange={e => setForm({ ...form, state: e.target.value })} />
                </div>
              </div>
            </TabsContent>

            {/* Academic */}
            <TabsContent value="academico" className="space-y-4 pt-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Matrícula *</Label>
                  <Input placeholder="2024-001" value={form.enrollment} onChange={e => setForm({ ...form, enrollment: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>CGM</Label>
                  <Input placeholder="CGM do aluno" value={form.cgm} onChange={e => setForm({ ...form, cgm: e.target.value })} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Status</Label>
                  <select
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    value={form.status}
                    onChange={e => setForm({ ...form, status: e.target.value })}
                  >
                    {STATUS_OPTS.map(s => <option key={s} value={s}>{STATUS_LABELS[s] || s}</option>)}
                  </select>
                </div>
                <div className="space-y-2">
                  <Label>Turma</Label>
                  <select
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    value={form.classId}
                    onChange={e => setForm({ ...form, classId: e.target.value })}
                  >
                    <option value="">Sem turma</option>
                    {classes.map(c => (
                      <option key={c.id} value={c.id}>
                        {c.grade?.name ? `${c.grade.name} — ` : ''}{c.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Observações pedagógicas</Label>
                <Textarea rows={3} value={form.observations} onChange={e => setForm({ ...form, observations: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Informações de saúde</Label>
                <Textarea rows={2} placeholder="Alergias, condições, medicamentos..." value={form.medicalInfo} onChange={e => setForm({ ...form, medicalInfo: e.target.value })} />
              </div>
            </TabsContent>

            {/* Guardians */}
            <TabsContent value="responsaveis" className="space-y-4 pt-4">
              {guardians.map((g, i) => (
                <div key={i} className="border rounded-lg p-3 space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium">Responsável {i + 1}</span>
                    {i > 0 && (
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => removeGuardian(i)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label className="text-xs">Nome</Label>
                      <Input placeholder="Nome completo" value={g.name} onChange={e => updateGuardian(i, 'name', e.target.value)} />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Parentesco</Label>
                      <Input placeholder="Pai, Mãe, Avó..." value={g.relationship} onChange={e => updateGuardian(i, 'relationship', e.target.value)} />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Telefone</Label>
                      <Input placeholder="(11) 99999-9999" value={g.phone} onChange={e => updateGuardian(i, 'phone', e.target.value)} />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">E-mail</Label>
                      <Input placeholder="email@exemplo.com" value={g.email} onChange={e => updateGuardian(i, 'email', e.target.value)} />
                    </div>
                  </div>
                  <label className="flex items-center gap-2 text-sm cursor-pointer">
                    <input type="checkbox" checked={g.isPrimary} onChange={e => updateGuardian(i, 'isPrimary', e.target.checked)} />
                    Responsável principal
                  </label>
                </div>
              ))}
              <Button variant="outline" size="sm" onClick={addGuardian} className="w-full">
                <Plus className="h-3.5 w-3.5 mr-1" /> Adicionar responsável
              </Button>
            </TabsContent>
          </Tabs>

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={!form.name || !form.enrollment}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* View Student Dialog */}
      <Dialog open={viewOpen} onOpenChange={setViewOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          {selected && (
            <>
              <DialogHeader>
                <div className="flex items-center gap-4">
                  <Avatar name={selected.name} size={14} />
                  <div>
                    <DialogTitle className="text-lg">{selected.name}</DialogTitle>
                    <p className="text-sm text-muted-foreground">
                      {selected.class?.grade?.name ? `${selected.class.grade.name} · ` : ''}{selected.class?.name || 'Sem turma'}
                    </p>
                    <Badge variant={STATUS_BADGE[selected.status] || 'secondary'} className="mt-0.5">
                      {STATUS_LABELS[selected.status] || selected.status}
                    </Badge>
                  </div>
                </div>
              </DialogHeader>

              <Tabs defaultValue="dados">
                <TabsList>
                  <TabsTrigger value="dados">Dados</TabsTrigger>
                  <TabsTrigger value="responsaveis">Responsáveis</TabsTrigger>
                  <TabsTrigger value="notas">Notas</TabsTrigger>
                  <TabsTrigger value="ficha">Ficha Disciplinar</TabsTrigger>
                </TabsList>

                {/* Dados */}
                <TabsContent value="dados" className="pt-4">
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <InfoField label="Matrícula" value={selected.enrollment} />
                    <InfoField label="CGM" value={selected.cgm} />
                    <InfoField label="CPF" value={selected.cpf} />
                    <InfoField label="RG" value={(selected as any).rg} />
                    <InfoField label="Nascimento" value={formatDate(selected.birthDate)} />
                    <InfoField label="Telefone" value={selected.phone} />
                    <InfoField label="E-mail" value={selected.email} />
                    <InfoField label="Turma" value={selected.class ? `${selected.class.grade?.name || ''} ${selected.class.name}`.trim() : undefined} />
                  </div>
                  {selected.address && (
                    <div className="mt-3">
                      <InfoField label="Endereço" value={`${selected.address}${selected.city ? `, ${selected.city}` : ''}${(selected as any).state ? ` - ${(selected as any).state}` : ''}`} />
                    </div>
                  )}
                  {selected.observations && <div className="mt-3"><InfoField label="Observações pedagógicas" value={selected.observations} /></div>}
                  {selected.medicalInfo && <div className="mt-3"><InfoField label="Informações de saúde" value={selected.medicalInfo} /></div>}
                </TabsContent>

                {/* Responsáveis */}
                <TabsContent value="responsaveis" className="pt-4">
                  {selected.guardians.length === 0 ? (
                    <p className="text-sm text-muted-foreground">Nenhum responsável cadastrado.</p>
                  ) : (
                    <div className="space-y-3">
                      {selected.guardians.map(g => (
                        <Card key={g.id}>
                          <CardContent className="p-4 space-y-1">
                            <div className="flex items-center justify-between">
                              <p className="font-medium">{g.name}</p>
                              {g.isPrimary && <Badge variant="info">Principal</Badge>}
                            </div>
                            <p className="text-sm text-muted-foreground">{g.relationship}</p>
                            {g.phone && <p className="text-sm">{g.phone}</p>}
                            {g.email && <p className="text-sm text-muted-foreground">{g.email}</p>}
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  )}
                </TabsContent>

                {/* Notas */}
                <TabsContent value="notas">
                  <NotasTab student={selected} />
                </TabsContent>

                {/* Ficha Disciplinar */}
                <TabsContent value="ficha">
                  <FichaDisciplinarTab studentId={selected.id} />
                </TabsContent>
              </Tabs>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
