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
import { Textarea } from '@/components/ui/textarea'
import { Plus, Search, UserCheck, Pencil, Eye } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { STATUS_LABELS, formatDate } from '@/lib/utils'

interface Student {
  id: string
  name: string
  enrollment: string
  birthDate?: string
  cpf?: string
  phone?: string
  address?: string
  status: string
  observations?: string
  medicalInfo?: string
  class?: { name: string; grade?: { name: string } }
  guardians: { id: string; name: string; relationship: string; phone?: string; email?: string; isPrimary: boolean }[]
  _count?: { homeworkSubmissions: number; gradeRecords: number }
}

const defaultForm = {
  name: '', enrollment: '', birthDate: '', cpf: '', rg: '', email: '', phone: '',
  address: '', city: '', state: '', zipCode: '', status: 'ATIVO', observations: '', medicalInfo: '',
}

const statusVariants: Record<string, any> = {
  ATIVO: 'success', INATIVO: 'secondary', TRANSFERIDO: 'warning', FORMADO: 'info', SUSPENSO: 'destructive'
}

export default function AlunosPage() {
  const [students, setStudents] = useState<Student[]>([])
  const [search, setSearch] = useState('')
  const [open, setOpen] = useState(false)
  const [viewOpen, setViewOpen] = useState(false)
  const [selected, setSelected] = useState<Student | null>(null)
  const [form, setForm] = useState(defaultForm)
  const { toast } = useToast()

  useEffect(() => { fetchStudents() }, [])

  const fetchStudents = async () => {
    const res = await fetch('/api/alunos')
    if (res.ok) setStudents(await res.json())
  }

  const fetchStudent = async (id: string) => {
    const res = await fetch(`/api/alunos/${id}`)
    if (res.ok) setSelected(await res.json())
  }

  const handleSave = async () => {
    const res = await fetch('/api/alunos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })
    if (res.ok) {
      toast({ title: 'Aluno cadastrado!' })
      setOpen(false)
      setForm(defaultForm)
      fetchStudents()
    } else {
      toast({ title: 'Erro ao salvar', variant: 'destructive' })
    }
  }

  const openView = async (s: Student) => {
    await fetchStudent(s.id)
    setViewOpen(true)
  }

  const filtered = students.filter(s =>
    s.name.toLowerCase().includes(search.toLowerCase()) ||
    s.enrollment.includes(search)
  )

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2"><UserCheck className="h-6 w-6" /> Alunos</h1>
          <p className="text-muted-foreground text-sm">{students.length} alunos cadastrados</p>
        </div>
        <Button onClick={() => { setForm(defaultForm); setOpen(true) }}>
          <Plus className="h-4 w-4 mr-2" /> Novo Aluno
        </Button>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Buscar por nome ou matrícula..." className="pl-9" value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Matrícula</TableHead>
                <TableHead>Turma</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Tarefas</TableHead>
                <TableHead>Notas</TableHead>
                <TableHead className="w-20">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Nenhum aluno encontrado.</TableCell></TableRow>
              ) : filtered.map(s => (
                <TableRow key={s.id}>
                  <TableCell className="font-medium">{s.name}</TableCell>
                  <TableCell className="text-sm font-mono">{s.enrollment}</TableCell>
                  <TableCell>{s.class?.name || '-'}</TableCell>
                  <TableCell>
                    <Badge variant={statusVariants[s.status] || 'secondary'}>{STATUS_LABELS[s.status] || s.status}</Badge>
                  </TableCell>
                  <TableCell>{s._count?.homeworkSubmissions || 0}</TableCell>
                  <TableCell>{s._count?.gradeRecords || 0}</TableCell>
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
            </TabsList>
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
                  <Input placeholder="SP" value={form.state} onChange={e => setForm({ ...form, state: e.target.value })} />
                </div>
              </div>
            </TabsContent>
            <TabsContent value="academico" className="space-y-4 pt-4">
              <div className="space-y-2">
                <Label>Matrícula *</Label>
                <Input placeholder="2024-001" value={form.enrollment} onChange={e => setForm({ ...form, enrollment: e.target.value })} />
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
                <DialogTitle>{selected.name}</DialogTitle>
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
                    <Info label="Status" value={STATUS_LABELS[selected.status]} />
                    <Info label="CPF" value={selected.cpf || '-'} />
                    <Info label="Nascimento" value={formatDate(selected.birthDate)} />
                    <Info label="Telefone" value={selected.phone || '-'} />
                    <Info label="Turma" value={selected.class?.name || '-'} />
                  </div>
                  {selected.address && <Info label="Endereço" value={selected.address} />}
                  {selected.observations && <Info label="Observações" value={selected.observations} />}
                  {selected.medicalInfo && <Info label="Informações de saúde" value={selected.medicalInfo} />}
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
