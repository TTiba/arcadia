'use client'
import { useState, useEffect, useRef } from 'react'
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
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import {
  Plus, Search, UserCheck, Eye, ChevronUp, ChevronDown, ChevronsUpDown,
  Camera, X, SlidersHorizontal, Trash2,
} from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { STATUS_LABELS, formatDate } from '@/lib/utils'

interface Student {
  id: string
  name: string
  enrollment: string
  birthDate?: string
  cpf?: string
  rg?: string
  email?: string
  phone?: string
  address?: string
  city?: string
  state?: string
  zipCode?: string
  status: string
  observations?: string
  medicalInfo?: string
  photoUrl?: string
  classId?: string
  class?: { id: string; name: string; gradeId?: string; grade?: { id: string; name: string } }
  guardians: Guardian[]
  _count?: { homeworkSubmissions: number; gradeRecords: number }
  _hwTotal?: number
}

interface Guardian {
  id?: string
  name: string
  relationship: string
  phone?: string
  email?: string
  isPrimary: boolean
}

interface ClassItem {
  id: string
  name: string
  gradeId?: string
  grade?: { id: string; name: string }
}

type SortCol = 'name' | 'enrollment' | 'class' | 'grade' | 'status' | 'hw' | 'grades'
type SortDir = 'asc' | 'desc'

const FILTER_KEY = 'vela_alunos_filters_v2'

interface Filters {
  status: string
  gradeId: string
  classId: string
  search: string
}

const DEFAULT_FILTERS: Filters = { status: '', gradeId: '', classId: '', search: '' }

function loadFilters(): Filters {
  if (typeof window === 'undefined') return DEFAULT_FILTERS
  try {
    const s = localStorage.getItem(FILTER_KEY)
    if (s) return { ...DEFAULT_FILTERS, ...JSON.parse(s) }
  } catch {}
  return DEFAULT_FILTERS
}

const defaultForm = {
  name: '', enrollment: '', birthDate: '', cpf: '', rg: '', email: '', phone: '',
  address: '', city: '', state: '', zipCode: '', status: 'ATIVO', observations: '',
  medicalInfo: '', photoUrl: '', classId: '',
}

const statusVariants: Record<string, any> = {
  ATIVO: 'success', INATIVO: 'secondary', TRANSFERIDO: 'warning',
  FORMADO: 'info', SUSPENSO: 'destructive',
}

function getInitials(name: string) {
  return name.trim().split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0].toUpperCase()).join('')
}

function hwColor(done: number, total: number) {
  if (total === 0) return 'text-muted-foreground'
  const pct = done / total
  if (pct >= 0.8) return 'text-emerald-600 dark:text-emerald-400'
  if (pct >= 0.5) return 'text-amber-600 dark:text-amber-400'
  return 'text-red-600 dark:text-red-400'
}

function SortIcon({ col, active, dir }: { col: SortCol; active: SortCol; dir: SortDir }) {
  if (col !== active) return <ChevronsUpDown className="h-3 w-3 ml-1 text-muted-foreground/50" />
  return dir === 'asc'
    ? <ChevronUp className="h-3 w-3 ml-1 text-foreground" />
    : <ChevronDown className="h-3 w-3 ml-1 text-foreground" />
}

export default function AlunosPage() {
  const searchParams = useSearchParams()
  const [students, setStudents] = useState<Student[]>([])
  const [classes, setClasses] = useState<ClassItem[]>([])
  const [filters, setFilters] = useState<Filters>(loadFilters)
  const [sortCol, setSortCol] = useState<SortCol>('name')
  const [sortDir, setSortDir] = useState<SortDir>('asc')
  const [open, setOpen] = useState(false)
  const [viewOpen, setViewOpen] = useState(false)
  const [selected, setSelected] = useState<Student | null>(null)
  const [form, setForm] = useState(defaultForm)
  const [guardians, setGuardians] = useState<Guardian[]>([])
  const [photoFileName, setPhotoFileName] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)
  const { toast } = useToast()

  useEffect(() => {
    const urlFilter = searchParams.get('filter')
    if (urlFilter === 'sem-tarefas') setFilters(f => ({ ...f, status: 'ATIVO' }))
  }, [searchParams])

  useEffect(() => {
    try { localStorage.setItem(FILTER_KEY, JSON.stringify(filters)) } catch {}
  }, [filters])

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
    const payload = { ...form, guardians }
    const res = await fetch('/api/alunos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    if (res.ok) {
      toast({ title: 'Aluno cadastrado!' })
      setOpen(false)
      setForm(defaultForm)
      setGuardians([])
      setPhotoFileName('')
      fetchStudents()
    } else {
      toast({ title: 'Erro ao salvar', variant: 'destructive' })
    }
  }

  const openView = async (s: Student) => {
    await fetchStudent(s.id)
    setViewOpen(true)
  }

  const setFilter = (key: keyof Filters, value: string) => {
    setFilters(f => {
      const next = { ...f, [key]: value }
      if (key === 'gradeId') next.classId = ''
      return next
    })
  }

  const clearFilters = () => setFilters(DEFAULT_FILTERS)
  const hasActiveFilters = Object.values(filters).some(v => v !== '')

  const grades = Array.from(new Map(
    classes.filter(c => c.grade).map(c => [c.grade!.id, c.grade!])
  ).values())

  const filteredClasses = filters.gradeId
    ? classes.filter(c => c.gradeId === filters.gradeId)
    : classes

  const toggleSort = (col: SortCol) => {
    if (sortCol === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortCol(col); setSortDir('asc') }
  }

  const filtered = students.filter(s => {
    if (filters.search && !s.name.toLowerCase().includes(filters.search.toLowerCase()) && !s.enrollment.includes(filters.search)) return false
    if (filters.status && s.status !== filters.status) return false
    if (filters.gradeId && s.class?.grade?.id !== filters.gradeId) return false
    if (filters.classId && s.classId !== filters.classId) return false
    return true
  })

  const sorted = [...filtered].sort((a, b) => {
    let av: string | number = ''
    let bv: string | number = ''
    if (sortCol === 'name') { av = a.name; bv = b.name }
    else if (sortCol === 'enrollment') { av = a.enrollment; bv = b.enrollment }
    else if (sortCol === 'class') { av = a.class?.name || ''; bv = b.class?.name || '' }
    else if (sortCol === 'grade') { av = a.class?.grade?.name || ''; bv = b.class?.grade?.name || '' }
    else if (sortCol === 'status') { av = a.status; bv = b.status }
    else if (sortCol === 'hw') {
      av = a._count?.homeworkSubmissions || 0
      bv = b._count?.homeworkSubmissions || 0
    }
    else if (sortCol === 'grades') {
      av = a._count?.gradeRecords || 0
      bv = b._count?.gradeRecords || 0
    }
    const cmp = typeof av === 'number' ? av - (bv as number) : String(av).localeCompare(String(bv), 'pt-BR')
    return sortDir === 'asc' ? cmp : -cmp
  })

  const addGuardian = () => setGuardians(g => [...g, { name: '', relationship: '', phone: '', email: '', isPrimary: g.length === 0 }])
  const removeGuardian = (i: number) => setGuardians(g => g.filter((_, idx) => idx !== i))
  const updateGuardian = (i: number, field: keyof Guardian, value: any) =>
    setGuardians(g => g.map((item, idx) => idx === i ? { ...item, [field]: value } : item))

  const SortTH = ({ col, children }: { col: SortCol; children: React.ReactNode }) => (
    <TableHead className="cursor-pointer select-none" onClick={() => toggleSort(col)}>
      <span className="flex items-center">
        {children}
        <SortIcon col={col} active={sortCol} dir={sortDir} />
      </span>
    </TableHead>
  )

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <UserCheck className="h-6 w-6" /> Alunos
          </h1>
          <p className="text-muted-foreground text-sm">{students.length} alunos cadastrados</p>
        </div>
        <Button onClick={() => { setForm(defaultForm); setGuardians([]); setPhotoFileName(''); setOpen(true) }}>
          <Plus className="h-4 w-4 mr-2" /> Novo Aluno
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-48 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por nome ou matrícula..."
            className="pl-9"
            value={filters.search}
            onChange={e => setFilter('search', e.target.value)}
          />
        </div>

        <select
          className="h-10 rounded-md border border-input bg-background px-3 py-2 text-sm min-w-32"
          value={filters.status}
          onChange={e => setFilter('status', e.target.value)}
        >
          <option value="">Todos os status</option>
          {Object.entries(STATUS_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>

        <select
          className="h-10 rounded-md border border-input bg-background px-3 py-2 text-sm min-w-32"
          value={filters.gradeId}
          onChange={e => setFilter('gradeId', e.target.value)}
        >
          <option value="">Todas as séries</option>
          {grades.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
        </select>

        <select
          className="h-10 rounded-md border border-input bg-background px-3 py-2 text-sm min-w-32"
          value={filters.classId}
          onChange={e => setFilter('classId', e.target.value)}
        >
          <option value="">Todas as turmas</option>
          {filteredClasses.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>

        {hasActiveFilters && (
          <Button variant="ghost" size="sm" onClick={clearFilters} className="gap-1 text-muted-foreground">
            <X className="h-3.5 w-3.5" /> Limpar
          </Button>
        )}

        <span className="text-sm text-muted-foreground ml-auto">
          {sorted.length} {sorted.length === 1 ? 'aluno' : 'alunos'}
        </span>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-8" />
                <SortTH col="name">Nome</SortTH>
                <SortTH col="enrollment">Matrícula</SortTH>
                <SortTH col="grade">Série</SortTH>
                <SortTH col="class">Turma</SortTH>
                <SortTH col="status">Status</SortTH>
                <SortTH col="hw">Tarefas</SortTH>
                <SortTH col="grades">Notas</SortTH>
                <TableHead className="w-16">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sorted.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                    Nenhum aluno encontrado.
                  </TableCell>
                </TableRow>
              ) : sorted.map(s => {
                const hwDone = s._count?.homeworkSubmissions || 0
                const hwTotal = (s as any)._hwTotal ?? 0
                return (
                  <TableRow key={s.id}>
                    <TableCell>
                      <Avatar className="h-8 w-8">
                        {s.photoUrl && <AvatarImage src={s.photoUrl} alt={s.name} />}
                        <AvatarFallback className="text-xs bg-teal/20 text-teal-700 dark:text-teal-300">
                          {getInitials(s.name)}
                        </AvatarFallback>
                      </Avatar>
                    </TableCell>
                    <TableCell className="font-medium">{s.name}</TableCell>
                    <TableCell className="text-sm font-mono">{s.enrollment}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{s.class?.grade?.name || '-'}</TableCell>
                    <TableCell>{s.class?.name || '-'}</TableCell>
                    <TableCell>
                      <Badge variant={statusVariants[s.status] || 'secondary'}>
                        {STATUS_LABELS[s.status] || s.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <span className={`text-sm font-medium ${hwColor(hwDone, hwTotal)}`}>
                        {hwDone}/{hwTotal}
                      </span>
                    </TableCell>
                    <TableCell className="text-sm">{s._count?.gradeRecords || 0}</TableCell>
                    <TableCell>
                      <Button variant="ghost" size="icon" onClick={() => openView(s)} title="Visualizar ficha">
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

            <TabsContent value="pessoal" className="space-y-4 pt-4">
              {/* Photo upload mock */}
              <div className="flex items-center gap-4">
                <Avatar className="h-20 w-20">
                  <AvatarFallback className="text-2xl bg-muted">
                    {form.name ? getInitials(form.name) : <Camera className="h-8 w-8 text-muted-foreground" />}
                  </AvatarFallback>
                </Avatar>
                <div className="space-y-1">
                  <input
                    ref={fileRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={e => {
                      const f = e.target.files?.[0]
                      if (f) setPhotoFileName(f.name)
                    }}
                  />
                  <Button type="button" variant="outline" size="sm" onClick={() => fileRef.current?.click()} className="gap-2">
                    <Camera className="h-4 w-4" />
                    {photoFileName ? 'Trocar foto' : 'Adicionar foto'}
                  </Button>
                  {photoFileName && (
                    <p className="text-xs text-muted-foreground flex items-center gap-1">
                      {photoFileName}
                      <button onClick={() => { setPhotoFileName(''); if (fileRef.current) fileRef.current.value = '' }} className="ml-1 hover:text-destructive">
                        <X className="h-3 w-3" />
                      </button>
                    </p>
                  )}
                  <p className="text-xs text-muted-foreground">JPG, PNG até 5 MB</p>
                </div>
              </div>

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
                <Input type="email" placeholder="aluno@escola.edu.br" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} />
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

            <TabsContent value="academico" className="space-y-4 pt-4">
              <div className="space-y-2">
                <Label>Matrícula *</Label>
                <Input placeholder="2024-001" value={form.enrollment} onChange={e => setForm({ ...form, enrollment: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Turma</Label>
                <select
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={form.classId}
                  onChange={e => setForm({ ...form, classId: e.target.value })}
                >
                  <option value="">Selecionar turma...</option>
                  {classes.map(c => (
                    <option key={c.id} value={c.id}>
                      {c.name}{c.grade ? ` — ${c.grade.name}` : ''}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <Label>Status</Label>
                <select
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={form.status}
                  onChange={e => setForm({ ...form, status: e.target.value })}
                >
                  {Object.entries(STATUS_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
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

            <TabsContent value="responsaveis" className="pt-4 space-y-4">
              {guardians.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nenhum responsável adicionado.</p>
              ) : guardians.map((g, i) => (
                <Card key={i}>
                  <CardContent className="p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">Responsável {i + 1}</span>
                      <div className="flex items-center gap-2">
                        <label className="flex items-center gap-1.5 text-xs cursor-pointer">
                          <input type="checkbox" checked={g.isPrimary} onChange={e => updateGuardian(i, 'isPrimary', e.target.checked)} />
                          Principal
                        </label>
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => removeGuardian(i)}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <Label className="text-xs">Nome *</Label>
                        <Input className="h-8" value={g.name} onChange={e => updateGuardian(i, 'name', e.target.value)} />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Parentesco</Label>
                        <Input className="h-8" placeholder="Mãe, Pai, Avó..." value={g.relationship} onChange={e => updateGuardian(i, 'relationship', e.target.value)} />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Telefone</Label>
                        <Input className="h-8" placeholder="(11) 99999-9999" value={g.phone || ''} onChange={e => updateGuardian(i, 'phone', e.target.value)} />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">E-mail</Label>
                        <Input className="h-8" type="email" value={g.email || ''} onChange={e => updateGuardian(i, 'email', e.target.value)} />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
              <Button variant="outline" size="sm" onClick={addGuardian} className="gap-2">
                <Plus className="h-4 w-4" /> Adicionar responsável
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
                  <Avatar className="h-16 w-16">
                    {selected.photoUrl && <AvatarImage src={selected.photoUrl} alt={selected.name} />}
                    <AvatarFallback className="text-xl bg-teal/20 text-teal-700 dark:text-teal-300 font-semibold">
                      {getInitials(selected.name)}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <DialogTitle className="text-xl">{selected.name}</DialogTitle>
                    <p className="text-sm text-muted-foreground mt-0.5">
                      {selected.class?.grade?.name}{selected.class ? ` · ${selected.class.name}` : ''}
                    </p>
                    <Badge variant={statusVariants[selected.status] || 'secondary'} className="mt-1">
                      {STATUS_LABELS[selected.status] || selected.status}
                    </Badge>
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
                    <Info label="Matrícula" value={selected.enrollment} />
                    <Info label="CPF" value={selected.cpf || '-'} />
                    <Info label="Nascimento" value={formatDate(selected.birthDate)} />
                    <Info label="Telefone" value={selected.phone || '-'} />
                    {selected.email && <Info label="E-mail" value={selected.email} />}
                  </div>
                  {selected.address && (
                    <Info label="Endereço" value={[selected.address, selected.city, selected.state].filter(Boolean).join(', ')} />
                  )}
                  {selected.observations && <Info label="Observações" value={selected.observations} />}
                  {selected.medicalInfo && <Info label="Informações de saúde" value={selected.medicalInfo} />}
                </TabsContent>
                <TabsContent value="responsaveis" className="pt-4">
                  {selected.guardians.length === 0 ? (
                    <p className="text-sm text-muted-foreground">Nenhum responsável cadastrado.</p>
                  ) : (
                    <div className="space-y-3">
                      {selected.guardians.map((g, i) => (
                        <Card key={g.id || i}>
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
                    <Info label="Tarefas entregues" value={String((selected as any)._count?.homeworkSubmissions || 0)} />
                    <Info label="Avaliações lançadas" value={String((selected as any)._count?.gradeRecords || 0)} />
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
