'use client'
import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Plus, Search, School, Users, Pencil } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useSession } from 'next-auth/react'

interface ClassData {
  id: string
  name: string
  curriculumId?: string
  curriculum?: { id: string; name: string }
  period?: string
  shift?: string
  year: number
  active: boolean
  grade?: { name: string; segment: { name: string } }
  school?: { id: string; name: string }
  _count?: { students: number }
}

export default function TurmasPage() {
  const [classes, setClasses] = useState<ClassData[]>([])
  const [curricula, setCurricula] = useState<{ id: string; name: string }[]>([])
  const [search, setSearch] = useState('')
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<ClassData | null>(null)
  const [form, setForm] = useState({ name: '', curriculumId: '', period: '', shift: '', year: new Date().getFullYear() })
  const [selectedSchoolId, setSelectedSchoolId] = useState('all')
  const { toast } = useToast()
  const { data: session } = useSession()
  const role = (session?.user as any)?.role || ''

  useEffect(() => {
    fetchClasses()
    fetchCurricula()
  }, [])

  const fetchClasses = async () => {
    const res = await fetch('/api/turmas')
    if (res.ok) setClasses(await res.json())
  }

  const fetchCurricula = async () => {
    const res = await fetch('/api/curricula')
    if (res.ok) setCurricula(await res.json())
  }

  const handleSave = async () => {
    const method = editing ? 'PUT' : 'POST'
    const url = editing ? `/api/turmas/${editing.id}` : '/api/turmas'
    const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) })
    if (res.ok) {
      toast({ title: editing ? 'Turma atualizada!' : 'Turma criada!', variant: 'default' })
      setOpen(false)
      setEditing(null)
      setForm({ name: '', curriculumId: '', period: '', shift: '', year: new Date().getFullYear() })
      fetchClasses()
    } else {
      toast({ title: 'Erro ao salvar', variant: 'destructive' })
    }
  }

  const openEdit = (cls: ClassData) => {
    setEditing(cls)
    setForm({ name: cls.name, curriculumId: cls.curriculumId || '', period: cls.period || '', shift: cls.shift || '', year: cls.year })
    setOpen(true)
  }

  const filtered = classes.filter(c => {
    const matchesSearch = c.name.toLowerCase().includes(search.toLowerCase())
    const matchesSchool = selectedSchoolId === 'all' || c.school?.id === selectedSchoolId
    return matchesSearch && matchesSchool
  })

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2"><School className="h-6 w-6" /> Turmas</h1>
          <p className="text-muted-foreground text-sm">Gerencie as turmas da escola</p>
        </div>
        <Button onClick={() => { setEditing(null); setForm({ name: '', curriculumId: '', period: '', shift: '', year: new Date().getFullYear() }); setOpen(true) }}>
          <Plus className="h-4 w-4 mr-2" /> Nova Turma
        </Button>
      </div>

      <div className="flex gap-3 flex-wrap items-center">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Buscar turma..." className="pl-9" value={search} onChange={e => setSearch(e.target.value)} />
        </div>

        {(role === 'ADMIN' || role === 'DIRETOR') && (
          <div className="w-64">
            <Select value={selectedSchoolId} onValueChange={setSelectedSchoolId}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Todas as Escolas" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as Escolas</SelectItem>
                {Array.from(
                  new Map(
                    classes
                      .filter((c): c is typeof c & { school: { id: string; name: string } } => !!c.school)
                      .map(c => [c.school.id, c.school] as [string, { id: string; name: string }])
                  ).values()
                ).map((school) => (
                  <SelectItem key={school.id} value={school.id}>
                    {formatSchoolName(school.name)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Escola</TableHead>
                <TableHead>Segmento / Série</TableHead>
                <TableHead>Currículo</TableHead>
                <TableHead>Turno</TableHead>
                <TableHead>Período</TableHead>
                <TableHead>Alunos</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-20">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow><TableCell colSpan={9} className="text-center py-8 text-muted-foreground">Nenhuma turma encontrada.</TableCell></TableRow>
              ) : filtered.map(cls => (
                <TableRow key={cls.id}>
                  <TableCell className="font-medium">{cls.name}</TableCell>
                  <TableCell>{cls.school?.name || '-'}</TableCell>
                  <TableCell>
                    <div>
                      <p className="text-sm">{cls.grade?.segment?.name || '-'}</p>
                      <p className="text-xs text-muted-foreground">{cls.grade?.name || '-'}</p>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="text-xs font-normal max-w-[200px] truncate">
                      {cls.curriculum?.name || 'Nenhum'}
                    </Badge>
                  </TableCell>
                  <TableCell>{cls.shift || '-'}</TableCell>
                  <TableCell>{cls.period || cls.year}</TableCell>
                  <TableCell>
                    <span className="flex items-center gap-1 text-sm">
                      <Users className="h-3.5 w-3.5" /> {cls._count?.students || 0}
                    </span>
                  </TableCell>
                  <TableCell>
                    <Badge variant={cls.active ? 'success' : 'secondary'}>
                      {cls.active ? 'Ativa' : 'Inativa'}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Button variant="ghost" size="icon" onClick={() => openEdit(cls)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? 'Editar Turma' : 'Nova Turma'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Nome *</Label>
              <Input placeholder="Ex: 5º Ano A" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Currículo</Label>
                <Select
                  value={form.curriculumId || undefined}
                  onValueChange={value => setForm({ ...form, curriculumId: value })}
                >
                  <SelectTrigger className="w-full">
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
              </div>
              <div className="space-y-2">
                <Label>Turno</Label>
                <Input placeholder="Ex: Manhã" value={form.shift} onChange={e => setForm({ ...form, shift: e.target.value })} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Período</Label>
                <Input placeholder="Ex: 2024" value={form.period} onChange={e => setForm({ ...form, period: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Ano letivo</Label>
                <Input type="number" value={form.year} onChange={e => setForm({ ...form, year: parseInt(e.target.value) })} />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={!form.name}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
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
