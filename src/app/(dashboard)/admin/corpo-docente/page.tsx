'use client'
import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Plus, Search, Users, Pencil, BookOpen, GraduationCap, Users2 } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { ROLE_LABELS } from '@/lib/utils'

// ─── Types ────────────────────────────────────────────────────────────────────

interface Subject { id: string; name: string }
interface ClassOption { id: string; name: string; grade?: { name: string }; school?: { name: string } }

interface StaffMember {
  id: string
  name: string
  email: string
  role: string
  active: boolean
  teacher?: {
    id: string
    registration?: string
    teacherSubjects: { subject: Subject }[]
    teacherClasses: { class: ClassOption; subject: Subject }[]
    _count?: { classRecords: number }
  }
  userClasses?: { class: ClassOption }[]
}

interface ClassSubjectPair { classId: string; subjectId: string }

// ─── Constants ────────────────────────────────────────────────────────────────

const STAFF_ROLE_OPTS = [
  { value: 'PROFESSOR',  label: 'Professor',   icon: BookOpen },
  { value: 'PEDAGOGO',   label: 'Pedagogo',    icon: GraduationCap },
  { value: 'SECRETARIO', label: 'Secretário',  icon: Users2 },
]

const ROLE_COLORS: Record<string, string> = {
  PROFESSOR:  'text-blue-700 bg-blue-50 border-blue-200',
  PEDAGOGO:   'text-violet-700 bg-violet-50 border-violet-200',
  SECRETARIO: 'text-teal-700 bg-teal-50 border-teal-200',
}

const DEFAULT_FORM = {
  name: '', email: '', password: '', staffRole: 'PROFESSOR', registration: '',
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function initials(name: string) {
  return name.split(' ').filter(Boolean).slice(0, 2).map(w => w[0].toUpperCase()).join('')
}

function Avatar({ name, role }: { name: string; role: string }) {
  const bg = role === 'PROFESSOR' ? 'bg-blue-500' : role === 'PEDAGOGO' ? 'bg-violet-500' : 'bg-teal-500'
  return (
    <div className={`flex items-center justify-center rounded-full text-white font-semibold text-sm ${bg}`}
      style={{ width: 36, height: 36 }}>
      {initials(name)}
    </div>
  )
}

function formatGradeLabel(gradeName: string) {
  const match = gradeName.match(/^(\d+)/)
  if (match) {
    return `Todos os ${match[1]} anos`
  }
  return `Todos do ${gradeName}`
}

function formatSchoolName(name: string) {
  if (!name) return ''
  return name
    .replace(/Escola\s+Estadual\s+(?:Prof\.\s+)?/gi, '')
    .replace(/Colégio\s+Estadual\s+(?:Prof\.\s+)?/gi, '')
    .replace(/Escola\s+Estadual\s+/gi, '')
    .replace(/Colégio\s+Estadual\s+/gi, '')
    .replace(/E\.\s*E\.\s*/gi, '')
    .replace(/C\.\s*E\.\s*/gi, '')
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function CorpoDocentePage() {
  const [staff, setStaff] = useState<StaffMember[]>([])
  const [subjects, setSubjects] = useState<Subject[]>([])
  const [classes, setClasses] = useState<ClassOption[]>([])
  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState('')
  const [open, setOpen] = useState(false)
  const [editOpen, setEditOpen] = useState(false)
  const [selected, setSelected] = useState<StaffMember | null>(null)
  const [form, setForm] = useState(DEFAULT_FORM)

  // For professors: list of {classId, subjectId} pairs
  const [classSubjects, setClassSubjects] = useState<ClassSubjectPair[]>([])
  // For pedagogo/secretario: list of classIds
  const [selectedClassIds, setSelectedClassIds] = useState<string[]>([])

  const { toast } = useToast()

  useEffect(() => {
    fetchStaff()
    fetch('/api/subjects').then(r => r.ok ? r.json() : []).then(setSubjects).catch(() => {})
    fetch('/api/turmas').then(r => r.ok ? r.json() : []).then(setClasses).catch(() => {})
  }, [])

  const fetchStaff = async () => {
    const res = await fetch('/api/corpo-docente')
    if (res.ok) setStaff(await res.json())
  }

  const resetForm = () => {
    setForm(DEFAULT_FORM)
    setClassSubjects([])
    setSelectedClassIds([])
  }

  const getExpandedClassSubjects = (list: ClassSubjectPair[]) => {
    const expanded: ClassSubjectPair[] = []
    for (const cs of list) {
      if (cs.classId.startsWith('all-grade-')) {
        const gradeName = cs.classId.replace('all-grade-', '')
        const gradeClasses = classes.filter(c => c.grade?.name === gradeName)
        for (const c of gradeClasses) {
          if (!expanded.some(item => item.classId === c.id && item.subjectId === cs.subjectId)) {
            expanded.push({ classId: c.id, subjectId: cs.subjectId })
          }
        }
      } else {
        if (cs.classId && cs.subjectId) {
          if (!expanded.some(item => item.classId === cs.classId && item.subjectId === cs.subjectId)) {
            expanded.push(cs)
          }
        }
      }
    }
    return expanded
  }

  const handleSave = async () => {
    const expanded = getExpandedClassSubjects(classSubjects)
    const payload = {
      ...form,
      subjectIds: form.staffRole === 'PROFESSOR'
        ? Array.from(new Set(expanded.map(cs => cs.subjectId)))
        : undefined,
      classSubjects: form.staffRole === 'PROFESSOR' ? expanded : undefined,
      classIds: form.staffRole !== 'PROFESSOR' ? selectedClassIds : undefined,
    }

    const res = await fetch('/api/corpo-docente', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })

    if (res.ok) {
      toast({ title: 'Membro do corpo docente cadastrado!' })
      setOpen(false)
      resetForm()
      fetchStaff()
    } else {
      const err = await res.json().catch(() => ({}))
      toast({ title: err.error || 'Erro ao salvar', variant: 'destructive' })
    }
  }

  const handleEdit = async () => {
    if (!selected) return

    const expanded = getExpandedClassSubjects(classSubjects)
    const payload = selected.role === 'PROFESSOR' ? {
      name: form.name, email: form.email, active: true,
      registration: form.registration,
      classSubjects: expanded,
      subjectIds: Array.from(new Set(expanded.map(cs => cs.subjectId))),
    } : {
      name: form.name, email: form.email, active: true,
      classIds: selectedClassIds,
    }

    const res = await fetch(`/api/corpo-docente/${selected.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })

    if (res.ok) {
      toast({ title: 'Dados atualizados!' })
      setEditOpen(false)
      fetchStaff()
    } else {
      const err = await res.json().catch(() => ({}))
      toast({ title: err.error || 'Erro ao atualizar', variant: 'destructive' })
    }
  }

  const openEdit = (member: StaffMember) => {
    setSelected(member)
    setForm({ ...DEFAULT_FORM, name: member.name, email: member.email, staffRole: member.role, registration: member.teacher?.registration || '' })
    if (member.role === 'PROFESSOR' && member.teacher) {
      setClassSubjects(member.teacher.teacherClasses.map(tc => ({ classId: tc.class.id, subjectId: tc.subject.id })))
    } else {
      setSelectedClassIds(member.userClasses?.map(uc => uc.class.id) ?? [])
    }
    setEditOpen(true)
  }

  const filtered = staff.filter(m => {
    const matchSearch = !search ||
      m.name.toLowerCase().includes(search.toLowerCase()) ||
      m.email.toLowerCase().includes(search.toLowerCase())
    const matchRole = !roleFilter || m.role === roleFilter
    return matchSearch && matchRole
  })

  // ─── Class-Subject pair helpers ───────────────────────────────────────────

  const addClassSubject = () => setClassSubjects(cs => [...cs, { classId: '', subjectId: '' }])
  const updateClassSubject = (i: number, field: keyof ClassSubjectPair, val: string) =>
    setClassSubjects(cs => cs.map((item, idx) => idx === i ? { ...item, [field]: val } : item))
  const removeClassSubject = (i: number) =>
    setClassSubjects(cs => cs.filter((_, idx) => idx !== i))

  const toggleClass = (classId: string) =>
    setSelectedClassIds(ids => ids.includes(classId) ? ids.filter(id => id !== classId) : [...ids, classId])

  // ─── Shared form sections ─────────────────────────────────────────────────

  function BasicFields() {
    return (
      <>
        <div className="space-y-2">
          <Label>Nome completo *</Label>
          <Input placeholder="Nome completo" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
        </div>
        <div className="space-y-2">
          <Label>E-mail *</Label>
          <Input type="email" placeholder="email@escola.edu.br" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} />
        </div>
      </>
    )
  }

  function TeacherFields() {
    const availableGrades = Array.from(
      new Set(classes.map(c => c.grade?.name).filter(Boolean))
    ).sort() as string[]

    return (
      <>
        <div className="space-y-2">
          <Label>Matrícula funcional</Label>
          <Input placeholder="PROF-001" value={form.registration} onChange={e => setForm({ ...form, registration: e.target.value })} />
        </div>
        <div className="space-y-2">
          <Label>Turmas e Componentes Curriculares</Label>
          <div className="space-y-2">
            {classSubjects.map((cs, i) => (
              <div key={i} className="flex gap-2 items-center">
                <select
                  className="flex h-9 flex-1 rounded-md border border-input bg-background px-2 text-sm"
                  value={cs.classId}
                  onChange={e => updateClassSubject(i, 'classId', e.target.value)}
                >
                  <option value="">Turma...</option>
                  
                  {availableGrades.map(grade => (
                    <option key={`all-grade-${grade}`} value={`all-grade-${grade}`}>
                      {formatGradeLabel(grade)}
                    </option>
                  ))}
                  
                  {availableGrades.length > 0 && <option disabled>──────────</option>}

                  {classes.map(c => (
                    <option key={c.id} value={c.id}>
                      {c.grade?.name ? `${c.grade.name} - ` : ''}{c.name} {c.school?.name ? `(${formatSchoolName(c.school.name)})` : ''}
                    </option>
                  ))}
                </select>
                <select
                  className="flex h-9 flex-1 rounded-md border border-input bg-background px-2 text-sm"
                  value={cs.subjectId}
                  onChange={e => updateClassSubject(i, 'subjectId', e.target.value)}
                >
                  <option value="">Componente...</option>
                  {subjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
                <Button type="button" variant="ghost" size="icon" className="h-9 w-9 shrink-0"
                  onClick={() => removeClassSubject(i)}>
                  ×
                </Button>
              </div>
            ))}
            <Button type="button" variant="outline" size="sm" onClick={addClassSubject} className="w-full">
              <Plus className="h-3.5 w-3.5 mr-1" /> Adicionar turma + componente
            </Button>
          </div>
        </div>
      </>
    )
  }

  function StaffClassFields() {
    // Group classes by grade
    const byGrade: Record<string, { gradeName: string; classes: ClassOption[] }> = {}
    for (const c of classes) {
      const key = c.grade?.name || 'Sem série'
      if (!byGrade[key]) byGrade[key] = { gradeName: key, classes: [] }
      byGrade[key].classes.push(c)
    }

    return (
      <div className="space-y-2">
        <Label>Turmas associadas</Label>
        <div className="border rounded-lg p-3 max-h-64 overflow-y-auto space-y-4">
          {Object.entries(byGrade).map(([key, { gradeName, classes: gradeClasses }]) => {
            const gradeClassIds = gradeClasses.map(c => c.id)
            const allChecked = gradeClassIds.every(id => selectedClassIds.includes(id))

            return (
              <div key={key} className="space-y-1.5">
                <div className="flex items-center justify-between border-b pb-1 mb-1">
                  <p className="text-xs font-semibold text-muted-foreground uppercase">{gradeName}</p>
                  <button
                    type="button"
                    onClick={() => {
                      if (allChecked) {
                        setSelectedClassIds(ids => ids.filter(id => !gradeClassIds.includes(id)))
                      } else {
                        setSelectedClassIds(ids => Array.from(new Set([...ids, ...gradeClassIds])))
                      }
                    }}
                    className="text-[10px] text-primary hover:underline font-medium focus:outline-none"
                  >
                    {allChecked ? 'Desmarcar todos' : 'Selecionar todos'}
                  </button>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {gradeClasses.map(c => {
                    const isSelected = selectedClassIds.includes(c.id)
                    return (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => toggleClass(c.id)}
                        className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${isSelected
                          ? 'bg-primary text-white border-primary font-medium'
                          : 'bg-background text-foreground border-border hover:border-primary'
                        }`}
                      >
                        {c.name} {c.school?.name ? `(${formatSchoolName(c.school.name)})` : ''}
                      </button>
                    )
                  })}
                </div>
              </div>
            )
          })}
          {classes.length === 0 && <p className="text-sm text-muted-foreground">Nenhuma turma cadastrada.</p>}
        </div>
        {selectedClassIds.length > 0 && (
          <p className="text-xs text-muted-foreground">{selectedClassIds.length} turma(s) selecionada(s)</p>
        )}
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2"><Users className="h-6 w-6" /> Corpo Docente</h1>
          <p className="text-muted-foreground text-sm">{staff.length} membros cadastrados</p>
        </div>
        <Button onClick={() => { resetForm(); setOpen(true) }}>
          <Plus className="h-4 w-4 mr-2" /> Novo membro
        </Button>
      </div>

      {/* Filters */}
      <div className="flex gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Buscar por nome ou e-mail..." className="pl-9" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <div className="flex gap-1.5">
          {[{ value: '', label: 'Todos' }, ...STAFF_ROLE_OPTS].map(opt => (
            <button
              key={opt.value}
              onClick={() => setRoleFilter(opt.value)}
              className={`px-3 py-1.5 rounded-lg text-sm border transition-colors ${roleFilter === opt.value
                ? 'bg-primary text-white border-primary'
                : 'bg-background border-border hover:border-primary text-foreground'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Membro</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Turmas</TableHead>
                <TableHead>Componentes</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-16">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                    Nenhum membro encontrado.
                  </TableCell>
                </TableRow>
              ) : filtered.map(m => {
                const classNames = m.role === 'PROFESSOR'
                  ? Array.from(new Set(m.teacher?.teacherClasses.map(tc => tc.class.name) ?? []))
                  : (m.userClasses?.map(uc => uc.class.name) ?? [])
                const subjectNames = Array.from(new Set(m.teacher?.teacherSubjects.map(ts => ts.subject.name) ?? []))

                return (
                  <TableRow key={m.id}>
                    <TableCell>
                      <div className="flex items-center gap-2.5">
                        <Avatar name={m.name} role={m.role} />
                        <div>
                          <p className="font-medium text-sm">{m.name}</p>
                          <p className="text-xs text-muted-foreground">{m.email}</p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className={`text-xs px-2 py-0.5 rounded border font-medium ${ROLE_COLORS[m.role] || ''}`}>
                        {ROLE_LABELS[m.role] || m.role}
                      </span>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {classNames.slice(0, 3).map(name => (
                          <Badge key={name} variant="info" className="text-xs">{name}</Badge>
                        ))}
                        {classNames.length > 3 && (
                          <Badge variant="outline" className="text-xs">+{classNames.length - 3}</Badge>
                        )}
                        {classNames.length === 0 && <span className="text-xs text-muted-foreground">—</span>}
                      </div>
                    </TableCell>
                    <TableCell>
                      {m.role === 'PROFESSOR' ? (
                        <div className="flex flex-wrap gap-1">
                          {subjectNames.slice(0, 2).map(name => (
                            <Badge key={name} variant="outline" className="text-xs">{name}</Badge>
                          ))}
                          {subjectNames.length > 2 && (
                            <Badge variant="outline" className="text-xs">+{subjectNames.length - 2}</Badge>
                          )}
                          {subjectNames.length === 0 && <span className="text-xs text-muted-foreground">—</span>}
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground">N/A</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant={m.active ? 'success' : 'secondary'}>
                        {m.active ? 'Ativo' : 'Inativo'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Button variant="ghost" size="icon" onClick={() => openEdit(m)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Create Dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Novo membro do corpo docente</DialogTitle>
          </DialogHeader>
          <Tabs defaultValue="dados">
            <TabsList className="w-full">
              <TabsTrigger value="dados" className="flex-1">Dados</TabsTrigger>
              <TabsTrigger value="associacoes" className="flex-1">Turmas e Componentes</TabsTrigger>
            </TabsList>

            <TabsContent value="dados" className="space-y-4 pt-4">
              <div className="space-y-2">
                <Label>Tipo *</Label>
                <div className="flex gap-2">
                  {STAFF_ROLE_OPTS.map(opt => {
                    const Icon = opt.icon
                    return (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => { setForm({ ...form, staffRole: opt.value }); setClassSubjects([]); setSelectedClassIds([]) }}
                        className={`flex-1 flex flex-col items-center gap-1 py-2.5 rounded-lg border text-xs font-medium transition-colors ${form.staffRole === opt.value ? 'bg-primary text-white border-primary' : 'bg-background border-border hover:border-primary'}`}
                      >
                        <Icon className="h-4 w-4" />
                        {opt.label}
                      </button>
                    )
                  })}
                </div>
              </div>
              {BasicFields()}
              <div className="space-y-2">
                <Label>Senha inicial *</Label>
                <Input type="password" placeholder="Mínimo 6 caracteres" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} />
              </div>
              {form.staffRole === 'PROFESSOR' && (
                <div className="space-y-2">
                  <Label>Matrícula funcional</Label>
                  <Input placeholder="PROF-001" value={form.registration} onChange={e => setForm({ ...form, registration: e.target.value })} />
                </div>
              )}
            </TabsContent>

            <TabsContent value="associacoes" className="space-y-4 pt-4">
              {form.staffRole === 'PROFESSOR' ? TeacherFields() : StaffClassFields()}
            </TabsContent>
          </Tabs>

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={!form.name || !form.email || !form.password}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      {selected && (
        <Dialog open={editOpen} onOpenChange={setEditOpen}>
          <DialogContent className="max-w-xl max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <div className="flex items-center gap-3">
                <Avatar name={selected.name} role={selected.role} />
                <div>
                  <DialogTitle>{selected.name}</DialogTitle>
                  <span className={`text-xs px-2 py-0.5 rounded border font-medium ${ROLE_COLORS[selected.role] || ''}`}>
                    {ROLE_LABELS[selected.role] || selected.role}
                  </span>
                </div>
              </div>
            </DialogHeader>
            <Tabs defaultValue="dados">
              <TabsList className="w-full">
                <TabsTrigger value="dados" className="flex-1">Dados</TabsTrigger>
                <TabsTrigger value="associacoes" className="flex-1">Turmas e Componentes</TabsTrigger>
              </TabsList>

              <TabsContent value="dados" className="space-y-4 pt-4">
                {BasicFields()}
                {selected.role === 'PROFESSOR' && (
                  <div className="space-y-2">
                    <Label>Matrícula funcional</Label>
                    <Input placeholder="PROF-001" value={form.registration} onChange={e => setForm({ ...form, registration: e.target.value })} />
                  </div>
                )}
              </TabsContent>

              <TabsContent value="associacoes" className="space-y-4 pt-4">
                {selected.role === 'PROFESSOR' ? TeacherFields() : StaffClassFields()}
              </TabsContent>
            </Tabs>

            <DialogFooter>
              <Button variant="outline" onClick={() => setEditOpen(false)}>Cancelar</Button>
              <Button onClick={handleEdit} disabled={!form.name || !form.email}>Salvar</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  )
}
