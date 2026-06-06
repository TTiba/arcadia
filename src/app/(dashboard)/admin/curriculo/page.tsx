'use client'
import { useState, useEffect, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Plus, BookOpen, LayoutGrid, Pencil, X, Check, Search } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'

// ─── Types ────────────────────────────────────────────────────────────────────

interface Segment {
  id: string
  name: string
  grades: Grade[]
}

interface Grade {
  id: string
  name: string
  segmentId: string
  order: number
  gradeSubjects: GradeSubject[]
}

interface GradeSubject {
  gradeId: string
  subjectId: string
  weeklyHours: number
  order: number
  subject: Subject
}

interface Subject {
  id: string
  name: string
  code?: string
  weeklyHours: number
  active: boolean
  segmentId?: string
  segment?: { id: string; name: string }
}

// ─── Default form ─────────────────────────────────────────────────────────────

const DEFAULT_SUBJECT = { name: '', code: '', segmentId: '', weeklyHours: 0 }

// ─── Componentes tab ──────────────────────────────────────────────────────────

function ComponentesTab({ segments }: { segments: Segment[] }) {
  const [subjects, setSubjects] = useState<Subject[]>([])
  const [search, setSearch] = useState('')
  const [showInactive, setShowInactive] = useState(false)
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<Subject | null>(null)
  const [form, setForm] = useState(DEFAULT_SUBJECT)
  const { toast } = useToast()

  const fetchSubjects = useCallback(async () => {
    const res = await fetch('/api/subjects')
    if (res.ok) setSubjects(await res.json())
  }, [])

  useEffect(() => { fetchSubjects() }, [fetchSubjects])

  const openCreate = () => { setEditing(null); setForm(DEFAULT_SUBJECT); setOpen(true) }
  const openEdit = (s: Subject) => {
    setEditing(s)
    setForm({ name: s.name, code: s.code || '', segmentId: s.segmentId || '', weeklyHours: s.weeklyHours })
    setOpen(true)
  }

  const handleSave = async () => {
    const payload = { ...form, weeklyHours: Number(form.weeklyHours) }
    const url = editing ? `/api/subjects/${editing.id}` : '/api/subjects'
    const method = editing ? 'PUT' : 'POST'

    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })

    if (res.ok) {
      toast({ title: editing ? 'Componente atualizado!' : 'Componente criado!' })
      setOpen(false)
      fetchSubjects()
    } else {
      const err = await res.json().catch(() => ({}))
      toast({ title: err.error || 'Erro ao salvar', variant: 'destructive' })
    }
  }

  const toggleActive = async (s: Subject) => {
    await fetch(`/api/subjects/${s.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...s, active: !s.active }),
    })
    fetchSubjects()
  }

  const filtered = subjects.filter(s => {
    const matchSearch = !search || s.name.toLowerCase().includes(search.toLowerCase()) || (s.code || '').toLowerCase().includes(search.toLowerCase())
    const matchActive = showInactive || s.active
    return matchSearch && matchActive
  })

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex gap-3 flex-1 flex-wrap">
          <div className="relative min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Buscar componente..." className="pl-9" value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <label className="flex items-center gap-2 text-sm cursor-pointer select-none">
            <input type="checkbox" checked={showInactive} onChange={e => setShowInactive(e.target.checked)} />
            Mostrar inativos
          </label>
        </div>
        <Button size="sm" onClick={openCreate}>
          <Plus className="h-4 w-4 mr-1" /> Novo componente
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Componente curricular</TableHead>
                <TableHead>Código</TableHead>
                <TableHead>Segmento</TableHead>
                <TableHead>H/sem</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-20">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                    Nenhum componente encontrado.
                  </TableCell>
                </TableRow>
              ) : filtered.map(s => (
                <TableRow key={s.id} className={!s.active ? 'opacity-50' : ''}>
                  <TableCell className="font-medium">{s.name}</TableCell>
                  <TableCell className="text-sm font-mono text-muted-foreground">{s.code || '—'}</TableCell>
                  <TableCell>
                    {s.segment
                      ? <Badge variant="outline" className="text-xs">{s.segment.name}</Badge>
                      : <span className="text-xs text-muted-foreground">—</span>
                    }
                  </TableCell>
                  <TableCell className="text-sm">{s.weeklyHours > 0 ? `${s.weeklyHours}h` : '—'}</TableCell>
                  <TableCell>
                    <Badge variant={s.active ? 'success' : 'secondary'}>{s.active ? 'Ativo' : 'Inativo'}</Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(s)}>
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className={`h-8 w-8 ${s.active ? 'text-muted-foreground hover:text-red-500' : 'text-muted-foreground hover:text-green-600'}`}
                        onClick={() => toggleActive(s)}
                        title={s.active ? 'Desativar' : 'Reativar'}
                      >
                        {s.active ? <X className="h-3.5 w-3.5" /> : <Check className="h-3.5 w-3.5" />}
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Create / Edit dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editing ? 'Editar componente' : 'Novo componente curricular'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Nome *</Label>
              <Input placeholder="ex: Língua Portuguesa" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Código</Label>
                <Input placeholder="ex: LP, MAT" value={form.code} onChange={e => setForm({ ...form, code: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>H/semana</Label>
                <Input type="number" min={0} max={40} placeholder="0" value={form.weeklyHours || ''} onChange={e => setForm({ ...form, weeklyHours: Number(e.target.value) })} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Segmento</Label>
              <select
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={form.segmentId}
                onChange={e => setForm({ ...form, segmentId: e.target.value })}
              >
                <option value="">Todos os segmentos</option>
                {segments.map(seg => <option key={seg.id} value={seg.id}>{seg.name}</option>)}
              </select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={!form.name.trim()}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// ─── Curriculos tab ───────────────────────────────────────────────────────────

function CurriculosTab({ segments: initialSegments }: { segments: Segment[] }) {
  const [segments, setSegments] = useState<Segment[]>(initialSegments)
  const [allSubjects, setAllSubjects] = useState<Subject[]>([])
  const [activeGrade, setActiveGrade] = useState<Grade | null>(null)
  const [adding, setAdding] = useState(false)
  const [newSubjectId, setNewSubjectId] = useState('')
  const [newHours, setNewHours] = useState(0)
  const { toast } = useToast()

  const fetchSegments = useCallback(async () => {
    const res = await fetch('/api/segments')
    if (res.ok) {
      const data: Segment[] = await res.json()
      setSegments(data)
      if (activeGrade) {
        for (const seg of data) {
          const g = seg.grades.find(gr => gr.id === activeGrade.id)
          if (g) { setActiveGrade(g); break }
        }
      }
    }
  }, [activeGrade])

  useEffect(() => {
    fetchSegments()
    fetch('/api/subjects').then(r => r.ok ? r.json() : []).then((data: Subject[]) => setAllSubjects(data.filter(s => s.active)))
  }, [fetchSegments])

  useEffect(() => { setSegments(initialSegments) }, [initialSegments])

  const handleAddSubject = async () => {
    if (!activeGrade || !newSubjectId) return
    const res = await fetch('/api/curriculo', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ gradeId: activeGrade.id, subjectId: newSubjectId, weeklyHours: newHours }),
    })
    if (res.ok) {
      setAdding(false); setNewSubjectId(''); setNewHours(0)
      fetchSegments()
    } else {
      toast({ title: 'Erro ao adicionar', variant: 'destructive' })
    }
  }

  const handleRemoveSubject = async (gradeId: string, subjectId: string) => {
    const res = await fetch(`/api/curriculo?gradeId=${gradeId}&subjectId=${subjectId}`, { method: 'DELETE' })
    if (res.ok) fetchSegments()
    else toast({ title: 'Erro ao remover', variant: 'destructive' })
  }

  const usedSubjectIds = new Set(activeGrade?.gradeSubjects.map(gs => gs.subjectId) ?? [])
  const availableSubjects = allSubjects.filter(s => !usedSubjectIds.has(s.id))

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      {/* Left: segment / grade picker */}
      <div className="space-y-4">
        {segments.map(seg => (
          <div key={seg.id}>
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5 px-1">{seg.name}</p>
            <div className="space-y-1">
              {seg.grades.length === 0 ? (
                <p className="text-xs text-muted-foreground px-2">Nenhuma série cadastrada</p>
              ) : seg.grades.map(g => (
                <button
                  key={g.id}
                  onClick={() => setActiveGrade(g)}
                  className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm text-left transition-colors ${activeGrade?.id === g.id ? 'bg-primary text-white' : 'hover:bg-muted'}`}
                >
                  <span>{g.name}</span>
                  <Badge
                    variant={activeGrade?.id === g.id ? 'outline' : 'secondary'}
                    className={`text-[10px] ${activeGrade?.id === g.id ? 'border-white/40 text-white' : ''}`}
                  >
                    {g.gradeSubjects.length}
                  </Badge>
                </button>
              ))}
            </div>
          </div>
        ))}
        {segments.length === 0 && (
          <p className="text-sm text-muted-foreground">Nenhum segmento cadastrado.</p>
        )}
      </div>

      {/* Right: subject matrix for active grade */}
      <div className="md:col-span-2">
        {!activeGrade ? (
          <div className="flex items-center justify-center h-48 rounded-xl border border-dashed text-muted-foreground text-sm">
            Selecione uma série à esquerda
          </div>
        ) : (
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">{activeGrade.name}</CardTitle>
                <Button size="sm" onClick={() => { setAdding(true); setNewSubjectId(''); setNewHours(0) }}>
                  <Plus className="h-3.5 w-3.5 mr-1" /> Adicionar
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-2">
              {adding && (
                <div className="flex gap-2 items-center p-2 bg-muted/40 rounded-lg">
                  <select
                    className="flex h-9 flex-1 rounded-md border border-input bg-background px-2 text-sm"
                    value={newSubjectId}
                    onChange={e => setNewSubjectId(e.target.value)}
                  >
                    <option value="">Selecione o componente...</option>
                    {availableSubjects.map(s => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                  <Input
                    type="number"
                    min={0}
                    max={40}
                    placeholder="H/sem"
                    className="w-20 h-9"
                    value={newHours || ''}
                    onChange={e => setNewHours(Number(e.target.value))}
                  />
                  <Button size="icon" className="h-9 w-9 shrink-0" onClick={handleAddSubject} disabled={!newSubjectId}>
                    <Check className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-9 w-9 shrink-0" onClick={() => setAdding(false)}>
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              )}

              {activeGrade.gradeSubjects.length === 0 && !adding ? (
                <p className="text-sm text-muted-foreground py-4 text-center">
                  Nenhum componente no currículo desta série.
                </p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Componente</TableHead>
                      <TableHead className="w-24 text-center">H/semana</TableHead>
                      <TableHead className="w-12" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {activeGrade.gradeSubjects.map(gs => (
                      <TableRow key={gs.subjectId}>
                        <TableCell className="font-medium text-sm">{gs.subject.name}</TableCell>
                        <TableCell className="text-center text-sm text-muted-foreground">
                          {gs.weeklyHours > 0 ? `${gs.weeklyHours}h` : '—'}
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-muted-foreground hover:text-red-500"
                            onClick={() => handleRemoveSubject(activeGrade.id, gs.subjectId)}
                          >
                            <X className="h-3.5 w-3.5" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function CurriculoPage() {
  const [segments, setSegments] = useState<Segment[]>([])

  useEffect(() => {
    fetch('/api/segments')
      .then(r => r.ok ? r.json() : [])
      .then(setSegments)
  }, [])

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <LayoutGrid className="h-6 w-6" /> Componentes e Currículos
        </h1>
        <p className="text-muted-foreground text-sm">Gerencie os componentes curriculares e monte o currículo por série</p>
      </div>

      <Tabs defaultValue="componentes">
        <TabsList>
          <TabsTrigger value="componentes" className="gap-2">
            <BookOpen className="h-4 w-4" /> Componentes Curriculares
          </TabsTrigger>
          <TabsTrigger value="curriculos" className="gap-2">
            <LayoutGrid className="h-4 w-4" /> Currículos por Série
          </TabsTrigger>
        </TabsList>

        <TabsContent value="componentes" className="mt-4">
          <ComponentesTab segments={segments} />
        </TabsContent>

        <TabsContent value="curriculos" className="mt-4">
          <CurriculosTab segments={segments} />
        </TabsContent>
      </Tabs>
    </div>
  )
}
