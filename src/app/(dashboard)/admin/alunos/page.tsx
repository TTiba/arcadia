'use client'
import { useState, useEffect, useCallback } from 'react'
import { useSearchParams } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Plus, Search, UserCheck, Eye, X, ChevronUp, ChevronDown, SlidersHorizontal, Trash2 } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { STATUS_LABELS, formatDate } from '@/lib/utils'

interface Student {
  id: string
  name: string
  enrollment: string
  birthDate?: string
  cpf?: string
  rg?: string
  phone?: string
  address?: string
  status: string
  observations?: string
  medicalInfo?: string
  photoUrl?: string
  classId?: string
  class?: { id: string; name: string; gradeId: string; grade?: { id: string; name: string }; _count?: { homework: number } }
  guardians: { id: string; name: string; relationship: string; phone?: string; email?: string; isPrimary: boolean }[]
  _count?: { homeworkSubmissions: number; gradeRecords: number }
}

interface Grade  { id: string; name: string }
interface Class  { id: string; name: string; gradeId: string; grade?: { name: string } }
interface Subject { id: string; name: string }

interface Filters {
  status: string; gradeId: string; subjectId: string
  dateFrom: string; dateTo: string; search: string
}

const FILTER_KEY = 'vela_alunos_filters'
const DEFAULT_FILTERS: Filters = { status: '', gradeId: '', subjectId: '', dateFrom: '', dateTo: '', search: '' }

function loadFilters(): Filters {
  if (typeof window === 'undefined') return DEFAULT_FILTERS
  try {
    const s = localStorage.getItem(FILTER_KEY)
    if (s) return { ...DEFAULT_FILTERS, ...JSON.parse(s) }
  } catch {}
  return DEFAULT_FILTERS
}

const statusVariants: Record<string, any> = {
  ATIVO: 'success', INATIVO: 'secondary', TRANSFERIDO: 'warning', FORMADO: 'info', SUSPENSO: 'destructive'
}

const defaultForm = {
  name: '', enrollment: '', birthDate: '', cpf: '', rg: '', phone: '',
  address: '', city: '', state: '', zipCode: '', status: 'ATIVO',
  observations: '', medicalInfo: '', photoUrl: '', classId: '',
}

type SortCol = 'name' | 'enrollment' | 'class' | 'status' | 'hw' | 'grades'
type SortDir = 'asc' | 'desc'

function sortStudents(list: Student[], col: SortCol, dir: SortDir): Student[] {
  return [...list].sort((a, b) => {
    let va: string | number = ''
    let vb: string | number = ''
    if (col === 'name')       { va = a.name; vb = b.name }
    else if (col === 'enrollment') { va = a.enrollment; vb = b.enrollment }
    else if (col === 'class') { va = a.class?.name ?? ''; vb = b.class?.name ?? '' }
    else if (col === 'status') { va = a.status; vb = b.status }
    else if (col === 'hw') {
      va = a._count?.homeworkSubmissions ?? 0
      vb = b._count?.homeworkSubmissions ?? 0
    }
    else if (col === 'grades') { va = a._count?.gradeRecords ?? 0; vb = b._count?.gradeRecords ?? 0 }
    if (typeof va === 'string') return dir === 'asc' ? va.localeCompare(vb as string) : (vb as string).localeCompare(va)
    return dir === 'asc' ? (va as number) - (vb as number) : (vb as number) - (va as number)
  })
}

export default function AlunosPage() {
  const [students, setStudents]     = useState<Student[]>([])
  const [grades, setGrades]         = useState<Grade[]>([])
  const [classes, setClasses]       = useState<Class[]>([])
  const [subjects, setSubjects]     = useState<Subject[]>([])
  const [loading, setLoading]       = useState(false)
  const [filters, setFilters]       = useState<Filters>(loadFilters)
  const [showFilters, setShowFilters] = useState(false)
  const [sort, setSort]             = useState<{ col: SortCol; dir: SortDir }>({ col: 'name', dir: 'asc' })
  const [open, setOpen]             = useState(false)
  const [viewOpen, setViewOpen]     = useState(false)
  const [selected, setSelected]     = useState<Student | null>(null)
  const [form, setForm]             = useState(defaultForm)
  const [guardianForms, setGuardianForms] = useState<any[]>([])
  const { toast } = useToast()
  const searchParams = useSearchParams()
  const urlFilter = searchParams.get('filter')

  // Persist filters
  useEffect(() => {
    try { localStorage.setItem(FILTER_KEY, JSON.stringify(filters)) } catch {}
  }, [filters])

  // Load reference data once
  useEffect(() => {
    fetch('/api/turmas').then(r => r.json()).then(d => setClasses(d.classes ?? d ?? []))
    // Grades and subjects from inline constants (avoids extra API call)
    setGrades([
      { id: 'g5', name: '5º Ano' }, { id: 'g6', name: '6º Ano' },
      { id: 'g7', name: '7º Ano' }, { id: 'g8', name: '8º Ano' },
      { id: 'g9', name: '9º Ano' },
    ])
    setSubjects([
      { id: 'port', name: 'Língua Portuguesa' }, { id: 'mat', name: 'Matemática' },
      { id: 'cien', name: 'Ciências' }, { id: 'hist', name: 'História' }, { id: 'geo', name: 'Geografia' },
    ])
    // Real grades/subjects
    fetch('/api/turmas').then(r => r.json()).then(data => {
      const cls: Class[] = data.classes ?? data ?? []
      setClasses(cls)
      const gradeMap = new Map<string, Grade>()
      cls.forEach(c => { if (c.grade) gradeMap.set(c.gradeId, { id: c.gradeId, name: c.grade.name }) })
      setGrades(Array.from(gradeMap.values()))
    })
    fetch('/api/aulas').then(r => r.json()).then(data => {
      // Use lessons to extract subjects — fallback if no dedicated API
    })
  }, [])

  const fetchStudents = useCallback(() => {
    setLoading(true)
    const params = new URLSearchParams()
    if (filters.status)   params.set('status',    filters.status)
    if (filters.gradeId)  params.set('gradeId',   filters.gradeId)
    if (filters.subjectId) params.set('subjectId', filters.subjectId)
    if (filters.dateFrom) params.set('dateFrom',  filters.dateFrom)
    if (filters.dateTo)   params.set('dateTo',    filters.dateTo)
    if (filters.search)   params.set('search',    filters.search)
    // URL param filter (from dashboard card)
    if (urlFilter === 'sem-tarefas') params.set('status', filters.status || 'ATIVO')

    fetch('/api/alunos?' + params.toString())
      .then(r => r.json())
      .then(data => {
        let list: Student[] = data
        if (urlFilter === 'sem-tarefas') {
          list = list.filter(s => (s._count?.homeworkSubmissions ?? 0) === 0)
        }
        setStudents(list)
      })
      .finally(() => setLoading(false))
  }, [filters, urlFilter])

  useEffect(() => { fetchStudents() }, [fetchStudents])

  const setFilter = (key: keyof Filters, val: string) =>
    setFilters(prev => ({ ...prev, [key]: val }))

  const clearFilters = () => setFilters(DEFAULT_FILTERS)

  const activeFilterCount = Object.values(filters).filter(Boolean).length

  const handleSort = (col: SortCol) =>
    setSort(prev => prev.col === col ? { col, dir: prev.dir === 'asc' ? 'desc' : 'asc' } : { col, dir: 'asc' })

  const SortIcon = ({ col }: { col: SortCol }) => {
    if (sort.col !== col) return <ChevronUp className="h-3 w-3 text-muted-foreground/40" />
    return sort.dir === 'asc'
      ? <ChevronUp className="h-3 w-3 text-foreground" />
      : <ChevronDown className="h-3 w-3 text-foreground" />
  }

  const sorted = sortStudents(students, sort.col, sort.dir)

  const openView = async (s: Student) => {
    const res = await fetch(`/api/alunos/${s.id}`)
    if (res.ok) setSelected(await res.json())
    setViewOpen(true)
  }

  const handleSave = async () => {
    const res = await fetch('/api/alunos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...form, guardians: guardianForms }),
    })
    if (res.ok) {
      toast({ title: 'Aluno cadastrado!' })
      setOpen(false)
      setForm(defaultForm)
      setGuardianForms([])
      fetchStudents()
    } else {
      toast({ title: 'Erro ao salvar', variant: 'destructive' })
    }
  }

  const addGuardian = () => setGuardianForms(prev => [...prev, { name: '', relationship: 'Mãe', phone: '', email: '', isPrimary: prev.length === 0 }])
  const removeGuardian = (i: number) => setGuardianForms(prev => prev.filter((_, idx) => idx !== i))
  const setGuardianField = (i: number, key: string, val: string) =>
    setGuardianForms(prev => prev.map((g, idx) => idx === i ? { ...g, [key]: val } : g))

  // Grade-filtered class list for form selector
  const formClasses = form.classId
    ? classes
    : classes.filter(c => !filters.gradeId || c.gradeId === filters.gradeId)

  return (
    <div className="p-6 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2"><UserCheck className="h-6 w-6" /> Alunos</h1>
          <p className="text-muted-foreground text-sm">{students.length} aluno{students.length !== 1 ? 's' : ''} encontrado{students.length !== 1 ? 's' : ''}</p>
        </div>
        <Button onClick={() => { setForm(defaultForm); setGuardianForms([]); setOpen(true) }}>
          <Plus className="h-4 w-4 mr-2" /> Novo Aluno
        </Button>
      </div>

      {/* URL filter banner */}
      {urlFilter === 'sem-tarefas' && (
        <div className="flex items-center gap-2 px-3 py-2 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-800 w-fit">
          <span>Filtro: <strong>sem nenhuma entrega de tarefa</strong></span>
          <a href="/admin/alunos" className="ml-1 text-amber-600 hover:text-amber-900"><X className="h-3.5 w-3.5" /></a>
        </div>
      )}

      {/* Search + filter bar */}
      <div className="flex gap-2 flex-wrap">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por nome ou matrícula..."
            className="pl-9"
            value={filters.search}
            onChange={e => setFilter('search', e.target.value)}
          />
        </div>

        {/* Status quick filter */}
        <select
          className="h-10 rounded-md border border-input bg-background px-3 text-sm"
          value={filters.status}
          onChange={e => setFilter('status', e.target.value)}
        >
          <option value="">Todos os status</option>
          {Object.entries(STATUS_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>

        {/* Grade quick filter */}
        <select
          className="h-10 rounded-md border border-input bg-background px-3 text-sm"
          value={filters.gradeId}
          onChange={e => setFilter('gradeId', e.target.value)}
        >
          <option value="">Todas as séries</option>
          {grades.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
        </select>

        <Button
          variant={showFilters ? 'secondary' : 'outline'}
          size="sm"
          className="h-10 gap-1.5"
          onClick={() => setShowFilters(v => !v)}
        >
          <SlidersHorizontal className="h-4 w-4" />
          Filtros
          {activeFilterCount > 0 && (
            <span className="bg-primary text-primary-foreground text-[10px] rounded-full w-4 h-4 flex items-center justify-center">
              {activeFilterCount}
            </span>
          )}
        </Button>

        {activeFilterCount > 0 && (
          <Button variant="ghost" size="sm" className="h-10 text-muted-foreground" onClick={clearFilters}>
            <X className="h-4 w-4 mr-1" /> Limpar
          </Button>
        )}
      </div>

      {/* Advanced filter panel */}
      {showFilters && (
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div>
                <Label className="text-xs mb-1 block">Componente (tarefa)</Label>
                <select
                  className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                  value={filters.subjectId}
                  onChange={e => setFilter('subjectId', e.target.value)}
                >
                  <option value="">Todos</option>
                  {subjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
              <div>
                <Label className="text-xs mb-1 block">Tarefa — de</Label>
                <Input type="date" className="h-9 text-sm" value={filters.dateFrom} onChange={e => setFilter('dateFrom', e.target.value)} />
              </div>
              <div>
                <Label className="text-xs mb-1 block">Tarefa — até</Label>
                <Input type="date" className="h-9 text-sm" value={filters.dateTo} onChange={e => setFilter('dateTo', e.target.value)} />
              </div>
              <div className="flex items-end">
                <p className="text-xs text-muted-foreground">Filtros de componente e data afetam a coluna <strong>Tarefas</strong>.</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                {([
                  ['name',       'Nome'],
                  ['enrollment', 'Matrícula'],
                  ['class',      'Turma'],
                  ['status',     'Status'],
                  ['hw',         'Tarefas'],
                  ['grades',     'Notas'],
                ] as [SortCol, string][]).map(([col, label]) => (
                  <TableHead
                    key={col}
                    className="cursor-pointer select-none hover:text-foreground"
                    onClick={() => handleSort(col)}
                  >
                    <span className="flex items-center gap-1">
                      {label} <SortIcon col={col} />
                    </span>
                  </TableHead>
                ))}
                <TableHead className="w-20">Ver ficha</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Carregando...</TableCell></TableRow>
              ) : sorted.length === 0 ? (
                <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Nenhum aluno encontrado.</TableCell></TableRow>
              ) : sorted.map(s => {
                const hwDone  = s._count?.homeworkSubmissions ?? 0
                const hwTotal = s.class?._count?.homework ?? 0
                const hwRatio = hwTotal > 0 ? `${hwDone}/${hwTotal}` : hwDone > 0 ? String(hwDone) : '—'
                const hwPct   = hwTotal > 0 ? hwDone / hwTotal : null
                return (
                  <TableRow key={s.id}>
                    <TableCell className="font-medium">{s.name}</TableCell>
                    <TableCell className="text-sm font-mono">{s.enrollment}</TableCell>
                    <TableCell>{s.class?.name || '—'}</TableCell>
                    <TableCell>
                      <Badge variant={statusVariants[s.status] || 'secondary'}>{STATUS_LABELS[s.status] || s.status}</Badge>
                    </TableCell>
                    <TableCell>
                      <span className={`text-sm font-medium ${hwPct !== null ? (hwPct < 0.5 ? 'text-red-500' : hwPct < 0.8 ? 'text-amber-500' : 'text-green-600') : 'text-muted-foreground'}`}>
                        {hwRatio}
                      </span>
                    </TableCell>
                    <TableCell>{s._count?.gradeRecords || 0}</TableCell>
                    <TableCell>
                      <Button variant="ghost" size="icon" onClick={() => openView(s)} title="Ver ficha">
                        <Eye className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* ── New Student Dialog ── */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Cadastrar Aluno</DialogTitle></DialogHeader>
          <Tabs defaultValue="pessoal">
            <TabsList className="w-full">
              <TabsTrigger value="pessoal" className="flex-1">Dados Pessoais</TabsTrigger>
              <TabsTrigger value="academico" className="flex-1">Acadêmico</TabsTrigger>
              <TabsTrigger value="responsaveis" className="flex-1">Responsáveis</TabsTrigger>
            </TabsList>

            {/* Personal */}
            <TabsContent value="pessoal" className="space-y-4 pt-4">
              <div className="flex gap-4 items-start">
                <div className="flex-1 space-y-2">
                  <Label>Nome completo *</Label>
                  <Input placeholder="Nome do aluno" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
                </div>
                {form.photoUrl && (
                  <img src={form.photoUrl} alt="Foto" className="w-16 h-16 rounded-full object-cover border" />
                )}
              </div>
              <div className="space-y-2">
                <Label>URL da foto</Label>
                <Input placeholder="https://..." value={form.photoUrl} onChange={e => setForm({ ...form, photoUrl: e.target.value })} />
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
                  <Input placeholder="PR" value={form.state} onChange={e => setForm({ ...form, state: e.target.value })} />
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
                  <Label>Status</Label>
                  <select
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                    value={form.status}
                    onChange={e => setForm({ ...form, status: e.target.value })}
                  >
                    {Object.entries(STATUS_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                  </select>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Turma</Label>
                <select
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                  value={form.classId}
                  onChange={e => setForm({ ...form, classId: e.target.value })}
                >
                  <option value="">Sem turma</option>
                  {classes.map(c => (
                    <option key={c.id} value={c.id}>{c.name}{c.grade ? ` (${c.grade.name})` : ''}</option>
                  ))}
                </select>
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
              {guardianForms.length === 0 && (
                <p className="text-sm text-muted-foreground">Nenhum responsável adicionado.</p>
              )}
              {guardianForms.map((g, i) => (
                <Card key={i}>
                  <CardContent className="pt-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium">Responsável {i + 1}</p>
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => removeGuardian(i)}>
                        <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
                      </Button>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1 col-span-2">
                        <Label className="text-xs">Nome *</Label>
                        <Input className="h-8 text-sm" value={g.name} onChange={e => setGuardianField(i, 'name', e.target.value)} />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Parentesco</Label>
                        <select className="flex h-8 w-full rounded-md border border-input bg-background px-3 text-sm" value={g.relationship} onChange={e => setGuardianField(i, 'relationship', e.target.value)}>
                          {['Mãe','Pai','Avó','Avô','Tia','Tio','Responsável Legal'].map(r => <option key={r}>{r}</option>)}
                        </select>
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Telefone</Label>
                        <Input className="h-8 text-sm" placeholder="(11) 9..." value={g.phone} onChange={e => setGuardianField(i, 'phone', e.target.value)} />
                      </div>
                      <div className="space-y-1 col-span-2">
                        <Label className="text-xs">E-mail</Label>
                        <Input className="h-8 text-sm" type="email" value={g.email} onChange={e => setGuardianField(i, 'email', e.target.value)} />
                      </div>
                      <label className="flex items-center gap-2 text-sm col-span-2">
                        <input type="checkbox" checked={g.isPrimary} onChange={e => setGuardianField(i, 'isPrimary', String(e.target.checked))} />
                        Contato principal
                      </label>
                    </div>
                  </CardContent>
                </Card>
              ))}
              <Button variant="outline" size="sm" onClick={addGuardian} className="gap-1.5">
                <Plus className="h-3.5 w-3.5" /> Adicionar responsável
              </Button>
            </TabsContent>
          </Tabs>
          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={!form.name || !form.enrollment}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── View Student Dialog ── */}
      <Dialog open={viewOpen} onOpenChange={setViewOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          {selected && (
            <>
              <DialogHeader>
                <div className="flex items-center gap-4">
                  {(selected as any).photoUrl && (
                    <img src={(selected as any).photoUrl} alt="Foto" className="w-14 h-14 rounded-full object-cover border" />
                  )}
                  <div>
                    <DialogTitle>{selected.name}</DialogTitle>
                    <p className="text-sm text-muted-foreground">{selected.enrollment} · {selected.class?.name || 'sem turma'}</p>
                  </div>
                </div>
              </DialogHeader>
              <Tabs defaultValue="dados">
                <TabsList>
                  <TabsTrigger value="dados">Dados</TabsTrigger>
                  <TabsTrigger value="responsaveis">Responsáveis</TabsTrigger>
                  <TabsTrigger value="academico">Acadêmico</TabsTrigger>
                </TabsList>
                <TabsContent value="dados" className="space-y-3 pt-4">
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <Info label="Matrícula"    value={selected.enrollment} />
                    <Info label="Status"       value={STATUS_LABELS[selected.status]} />
                    <Info label="CPF"          value={selected.cpf || '—'} />
                    <Info label="Nascimento"   value={formatDate(selected.birthDate)} />
                    <Info label="Telefone"     value={selected.phone || '—'} />
                    <Info label="Turma"        value={selected.class?.name || '—'} />
                  </div>
                  {selected.address && <Info label="Endereço"   value={selected.address} />}
                  {selected.observations && <Info label="Observações" value={selected.observations} />}
                  {selected.medicalInfo  && <Info label="Saúde"       value={selected.medicalInfo} />}
                </TabsContent>
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
                <TabsContent value="academico" className="pt-4">
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <Info label="Tarefas entregues"    value={String((selected as any)._count?.homeworkSubmissions || 0)} />
                    <Info label="Avaliações lançadas"  value={String((selected as any)._count?.gradeRecords || 0)} />
                  </div>
                </TabsContent>
              </Tabs>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{label}</p>
      <p className="text-sm mt-0.5">{value}</p>
    </div>
  )
}
