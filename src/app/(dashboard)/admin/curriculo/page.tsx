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
import { Plus, BookOpen, LayoutGrid, Pencil, X, Check, Search, Trash2 } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

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

interface SaebDescriptor {
  id: string
  code: string
  description: string
  area: string
  level: string
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

function CurriculosTab({ segments: initialSegments, curriculumId }: { segments: Segment[]; curriculumId: string }) {
  const [segments, setSegments] = useState<Segment[]>(initialSegments)
  const [allSubjects, setAllSubjects] = useState<Subject[]>([])
  const [activeGrade, setActiveGrade] = useState<Grade | null>(null)
  const [adding, setAdding] = useState(false)
  const [newSubjectId, setNewSubjectId] = useState('')
  const [newHours, setNewHours] = useState(0)
  const { toast } = useToast()

  const fetchSegments = useCallback(async () => {
    if (!curriculumId) return
    const res = await fetch(`/api/segments?curriculumId=${curriculumId}`)
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
  }, [activeGrade, curriculumId])

  useEffect(() => {
    fetchSegments()
    fetch('/api/subjects').then(r => r.ok ? r.json() : []).then((data: Subject[]) => setAllSubjects(data.filter(s => s.active)))
  }, [fetchSegments, curriculumId])

  useEffect(() => { setSegments(initialSegments) }, [initialSegments])

  const handleAddSubject = async () => {
    if (!curriculumId || !activeGrade || !newSubjectId) return
    const res = await fetch('/api/curriculo', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ curriculumId, gradeId: activeGrade.id, subjectId: newSubjectId, weeklyHours: newHours }),
    })
    if (res.ok) {
      setAdding(false); setNewSubjectId(''); setNewHours(0)
      fetchSegments()
    } else {
      toast({ title: 'Erro ao adicionar', variant: 'destructive' })
    }
  }

  const handleRemoveSubject = async (gradeId: string, subjectId: string) => {
    if (!curriculumId) return
    const res = await fetch(`/api/curriculo?curriculumId=${curriculumId}&gradeId=${gradeId}&subjectId=${subjectId}`, { method: 'DELETE' })
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
  const [curricula, setCurricula] = useState<{ id: string; name: string; description?: string | null }[]>([])
  const [activeCurriculumId, setActiveCurriculumId] = useState<string>('')
  const [openCurriculumDialog, setOpenCurriculumDialog] = useState(false)
  const [curriculumForm, setCurriculumForm] = useState({ name: '', description: '' })
  const [editingCurriculumId, setEditingCurriculumId] = useState<string | null>(null)
  const [allDescriptors, setAllDescriptors] = useState<SaebDescriptor[]>([])
  const [selectedDescriptorIds, setSelectedDescriptorIds] = useState<string[]>([])
  const [descriptorsSearch, setDescriptorsSearch] = useState('')
  const [descriptorFilterArea, setDescriptorFilterArea] = useState('')
  const [descriptorFilterLevel, setDescriptorFilterLevel] = useState('')
  const { toast } = useToast()

  useEffect(() => {
    fetch('/api/curricula')
      .then(r => r.ok ? r.json() : [])
      .then(data => {
        setCurricula(data)
        if (data.length > 0) {
          setActiveCurriculumId(data[0].id)
        }
      })

    fetch('/api/saeb/descriptors')
      .then(r => r.ok ? r.json() : [])
      .then(setAllDescriptors)
  }, [])

  useEffect(() => {
    if (!activeCurriculumId) return
    fetch(`/api/segments?curriculumId=${activeCurriculumId}`)
      .then(r => r.ok ? r.json() : [])
      .then(setSegments)
  }, [activeCurriculumId])

  const handleOpenNew = () => {
    setCurriculumForm({ name: '', description: '' })
    setSelectedDescriptorIds([])
    setEditingCurriculumId(null)
    setDescriptorsSearch('')
    setDescriptorFilterArea('')
    setDescriptorFilterLevel('')
    setOpenCurriculumDialog(true)
  }

  const handleOpenEdit = async () => {
    if (!activeCurriculumId) return
    const res = await fetch(`/api/curricula/${activeCurriculumId}`)
    if (res.ok) {
      const data = await res.json()
      setCurriculumForm({ name: data.name, description: data.description || '' })
      setSelectedDescriptorIds(data.saebDescriptorIds || [])
      setEditingCurriculumId(activeCurriculumId)
      setDescriptorsSearch('')
      setDescriptorFilterArea('')
      setDescriptorFilterLevel('')
      setOpenCurriculumDialog(true)
    } else {
      toast({ title: 'Erro ao carregar detalhes do currículo', variant: 'destructive' })
    }
  }

  const handleSaveCurriculum = async () => {
    if (!curriculumForm.name.trim()) return

    const payload = {
      name: curriculumForm.name.trim(),
      description: curriculumForm.description.trim(),
      saebDescriptorIds: selectedDescriptorIds,
    }

    const url = editingCurriculumId ? `/api/curricula/${editingCurriculumId}` : '/api/curricula'
    const method = editingCurriculumId ? 'PUT' : 'POST'

    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })

    if (res.ok) {
      const data = await res.json()
      toast({ title: editingCurriculumId ? 'Currículo atualizado com sucesso!' : 'Currículo criado com sucesso!' })
      setCurriculumForm({ name: '', description: '' })
      setSelectedDescriptorIds([])
      setOpenCurriculumDialog(false)
      setEditingCurriculumId(null)
      
      const updatedRes = await fetch('/api/curricula')
      if (updatedRes.ok) {
        const list = await updatedRes.json()
        setCurricula(list)
        if (editingCurriculumId) {
          setActiveCurriculumId(editingCurriculumId)
        } else {
          setActiveCurriculumId(data.id)
        }
      }
    } else {
      const err = await res.json().catch(() => ({}))
      toast({ title: err.error || 'Erro ao salvar currículo', variant: 'destructive' })
    }
  }

  const handleDeleteCurriculum = async () => {
    if (!activeCurriculumId) return
    const activeCurr = curricula.find(c => c.id === activeCurriculumId)
    if (!activeCurr) return
    
    if (!confirm(`Deseja realmente excluir o currículo "${activeCurr.name}"?`)) return

    const res = await fetch(`/api/curricula/${activeCurriculumId}`, {
      method: 'DELETE',
    })

    if (res.ok) {
      toast({ title: 'Currículo excluído com sucesso!' })
      const updatedRes = await fetch('/api/curricula')
      if (updatedRes.ok) {
        const data = await updatedRes.json()
        setCurricula(data)
        if (data.length > 0) {
          setActiveCurriculumId(data[0].id)
        } else {
          setActiveCurriculumId('')
        }
      }
    } else {
      const err = await res.json().catch(() => ({}))
      toast({ title: err.error || 'Erro ao excluir currículo', variant: 'destructive' })
    }
  }

  const areas = Array.from(new Set(allDescriptors.map(d => d.area).filter(Boolean)))
  const levels = Array.from(new Set(allDescriptors.map(d => d.level).filter(Boolean)))

  const filteredDescriptors = allDescriptors.filter(d => {
    const matchesSearch = !descriptorsSearch ||
      d.code.toLowerCase().includes(descriptorsSearch.toLowerCase()) ||
      d.description.toLowerCase().includes(descriptorsSearch.toLowerCase())
    const matchesArea = !descriptorFilterArea || d.area === descriptorFilterArea
    const matchesLevel = !descriptorFilterLevel || d.level === descriptorFilterLevel
    return matchesSearch && matchesArea && matchesLevel
  })

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <LayoutGrid className="h-6 w-6" /> Componentes e Currículos
          </h1>
          <p className="text-muted-foreground text-sm">Gerencie os componentes curriculares e monte o currículo por série</p>
        </div>

        <div className="flex items-center gap-2 min-w-[320px] flex-wrap md:flex-nowrap">
          {curricula.length > 0 && (
            <>
              <Label className="text-xs shrink-0 text-muted-foreground">Currículo Ativo:</Label>
              <Select value={activeCurriculumId} onValueChange={setActiveCurriculumId}>
                <SelectTrigger className="w-[180px] bg-background">
                  <SelectValue placeholder="Selecione..." />
                </SelectTrigger>
                <SelectContent>
                  {curricula.map(c => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </>
          )}
          <Button size="sm" variant="outline" onClick={handleOpenNew}>
            <Plus className="h-4 w-4 mr-1" /> Novo
          </Button>
          {activeCurriculumId && (
            <>
              <Button size="sm" variant="outline" onClick={handleOpenEdit} title="Editar Currículo">
                <Pencil className="h-4 w-4 mr-1" /> Editar
              </Button>
              <Button size="sm" variant="outline" className="text-red-500 hover:text-red-600 hover:bg-red-50" onClick={handleDeleteCurriculum} title="Excluir Currículo">
                <Trash2 className="h-4 w-4 mr-1" /> Excluir
              </Button>
            </>
          )}
        </div>
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
          <CurriculosTab segments={segments} curriculumId={activeCurriculumId} />
        </TabsContent>
      </Tabs>

      {/* Dialog para Criar/Editar Currículo */}
      <Dialog open={openCurriculumDialog} onOpenChange={setOpenCurriculumDialog}>
        <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>{editingCurriculumId ? 'Editar Currículo' : 'Novo Currículo'}</DialogTitle>
          </DialogHeader>
          <Tabs defaultValue="geral" className="flex-1 overflow-hidden flex flex-col mt-2">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="geral">Dados Gerais</TabsTrigger>
              <TabsTrigger value="habilidades">Habilidades / Descritores SAEB</TabsTrigger>
            </TabsList>
            
            <TabsContent value="geral" className="space-y-4 py-4 flex-1 overflow-y-auto">
              <div className="space-y-2">
                <Label>Nome do Currículo *</Label>
                <Input
                  placeholder="Ex: Novo Ensino Médio — Profissionalizante"
                  value={curriculumForm.name}
                  onChange={e => setCurriculumForm({ ...curriculumForm, name: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Descrição</Label>
                <Input
                  placeholder="Ex: Mapeamento de disciplinas técnicas e BNCC"
                  value={curriculumForm.description}
                  onChange={e => setCurriculumForm({ ...curriculumForm, description: e.target.value })}
                />
              </div>
            </TabsContent>

            <TabsContent value="habilidades" className="py-4 flex-1 flex flex-col overflow-hidden">
              <div className="flex gap-2 mb-3">
                <div className="relative flex-1">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Buscar descritor..."
                    className="pl-8 h-9"
                    value={descriptorsSearch}
                    onChange={e => setDescriptorsSearch(e.target.value)}
                  />
                </div>
                <select
                  className="flex h-9 rounded-md border border-input bg-background px-3 py-1 text-xs w-[140px]"
                  value={descriptorFilterArea}
                  onChange={e => setDescriptorFilterArea(e.target.value)}
                >
                  <option value="">Todas as Áreas</option>
                  {areas.map(a => <option key={a} value={a}>{a}</option>)}
                </select>
                <select
                  className="flex h-9 rounded-md border border-input bg-background px-3 py-1 text-xs w-[120px]"
                  value={descriptorFilterLevel}
                  onChange={e => setDescriptorFilterLevel(e.target.value)}
                >
                  <option value="">Todas as Séries</option>
                  {levels.map(l => <option key={l} value={l}>{l}</option>)}
                </select>
              </div>

              <div className="flex-1 overflow-y-auto border rounded-md p-2 space-y-2 max-h-[350px] bg-muted/15">
                {filteredDescriptors.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-8">
                    Nenhum descritor encontrado.
                  </p>
                ) : (
                  filteredDescriptors.map(d => {
                    const isChecked = selectedDescriptorIds.includes(d.id)
                    return (
                      <div
                        key={d.id}
                        className={`flex items-start gap-3 p-3 rounded-lg border transition-all duration-200 ${
                          isChecked
                            ? 'bg-primary/5 border-primary/30 shadow-sm'
                            : 'bg-background border-border hover:bg-muted/40'
                        }`}
                      >
                        <input
                          id={`desc-${d.id}`}
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => {
                            if (isChecked) {
                              setSelectedDescriptorIds(selectedDescriptorIds.filter(id => id !== d.id))
                            } else {
                              setSelectedDescriptorIds([...selectedDescriptorIds, d.id])
                            }
                          }}
                          className="mt-1 h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary cursor-pointer accent-primary"
                        />
                        <label
                          htmlFor={`desc-${d.id}`}
                          className="flex-1 space-y-1.5 cursor-pointer select-none"
                        >
                          <div className="flex items-center gap-2 flex-wrap">
                            <Badge variant="outline" className="font-mono text-[10px] uppercase bg-primary/5 border-primary/20 text-primary px-1.5 py-0 shrink-0">
                              {d.code}
                            </Badge>
                            <Badge variant="secondary" className="text-[10px] px-1.5 py-0 font-medium">
                              {d.area}
                            </Badge>
                            <Badge variant="outline" className="text-[10px] px-1.5 py-0 font-medium bg-muted/30">
                              {d.level}
                            </Badge>
                          </div>
                          <p className="text-xs text-foreground/80 leading-relaxed">{d.description}</p>
                        </label>
                      </div>
                    )
                  })
                )}
              </div>
            </TabsContent>
          </Tabs>

          <DialogFooter className="mt-4 pt-2 border-t flex items-center justify-between">
            <div className="text-xs text-muted-foreground">
              {selectedDescriptorIds.length} habilidades selecionadas
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setOpenCurriculumDialog(false)}>
                Cancelar
              </Button>
              <Button onClick={handleSaveCurriculum} disabled={!curriculumForm.name.trim()}>
                {editingCurriculumId ? 'Salvar Alterações' : 'Criar Currículo'}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
