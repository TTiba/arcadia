'use client'
import { useState, useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'
import { Plus, Search, Heart, User, Calendar, Lock, X } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { PEDAGOGICAL_RECORD_TYPE_LABELS, formatDate } from '@/lib/utils'

interface PedagogicalRecord {
  id: string
  type: string
  title: string
  content: string
  date: string
  confidentiality: string
  actionPlan?: string
  resolved: boolean
  student: { name: string; enrollment: string; class?: { name: string } }
  pedagogue: { name: string }
}

const CONFIDENTIALITY_LABELS: Record<string, string> = {
  PUBLICO: 'Público',
  RESTRITO: 'Restrito',
  CONFIDENCIAL: 'Confidencial',
}

const typeColors: Record<string, any> = {
  REUNIAO: 'info',
  ADVERTENCIA: 'destructive',
  ATENDIMENTO: 'success',
  ENCAMINHAMENTO: 'warning',
  OBSERVACAO: 'secondary',
  ACOMPANHAMENTO_FAMILIAR: 'info',
  OCORRENCIA: 'destructive',
  PLANO_DE_ACAO: 'outline',
}

const confidentialityColors: Record<string, any> = {
  PUBLICO: 'success',
  RESTRITO: 'warning',
  CONFIDENCIAL: 'destructive',
}

export default function RegistrosPedagogicosPage() {
  const [records, setRecords] = useState<PedagogicalRecord[]>([])
  const [students, setStudents] = useState<any[]>([])
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState('')
  const [open, setOpen] = useState(false)
  const searchParams = useSearchParams()
  const activeFilter = searchParams.get('filter')
  const [form, setForm] = useState({
    studentId: '', type: 'OBSERVACAO', title: '', content: '',
    date: new Date().toISOString().split('T')[0], confidentiality: 'RESTRITO', actionPlan: ''
  })
  const { toast } = useToast()

  useEffect(() => {
    fetchRecords()
    fetch('/api/alunos').then(r => r.json()).then(setStudents)
  }, [])

  const fetchRecords = async () => {
    const res = await fetch('/api/pedagogo/registros')
    if (res.ok) setRecords(await res.json())
  }

  const handleSave = async () => {
    const res = await fetch('/api/pedagogo/registros', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })
    if (res.ok) {
      toast({ title: 'Registro pedagógico salvo!' })
      setOpen(false)
      setForm({ studentId: '', type: 'OBSERVACAO', title: '', content: '', date: new Date().toISOString().split('T')[0], confidentiality: 'RESTRITO', actionPlan: '' })
      fetchRecords()
    } else {
      toast({ title: 'Erro ao salvar', variant: 'destructive' })
    }
  }

  const filtered = records.filter(r => {
    const matchSearch = !search ||
      r.student.name.toLowerCase().includes(search.toLowerCase()) ||
      r.title.toLowerCase().includes(search.toLowerCase())
    const matchType = !typeFilter || r.type === typeFilter
    const matchFilter = activeFilter === 'abertos' ? !r.resolved : true
    return matchSearch && matchType && matchFilter
  })

  // Group by student for summary
  const studentGroups = filtered.reduce((acc, r) => {
    const key = r.student.name
    if (!acc[key]) acc[key] = []
    acc[key].push(r)
    return acc
  }, {} as Record<string, PedagogicalRecord[]>)

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2"><Heart className="h-6 w-6" /> Registros Pedagógicos</h1>
          <p className="text-muted-foreground text-sm">{records.length} registros · {Object.keys(studentGroups).length} alunos com registros</p>
        </div>
        <Button onClick={() => setOpen(true)}><Plus className="h-4 w-4 mr-2" /> Novo Registro</Button>
      </div>

      {activeFilter === 'abertos' && (
        <div className="flex items-center gap-2 px-3 py-2 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-800 w-fit">
          <span>Filtro ativo: <strong>alertas não resolvidos</strong></span>
          <a href="/pedagogo/registros" className="ml-1 text-amber-600 hover:text-amber-900"><X className="h-3.5 w-3.5" /></a>
        </div>
      )}
      <div className="flex gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Buscar por aluno ou título..." className="pl-9" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <select
          className="flex h-10 rounded-md border border-input bg-background px-3 text-sm"
          value={typeFilter}
          onChange={e => setTypeFilter(e.target.value)}
        >
          <option value="">Todos os tipos</option>
          {Object.entries(PEDAGOGICAL_RECORD_TYPE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
      </div>

      {/* Student-grouped view */}
      <div className="space-y-6">
        {Object.keys(studentGroups).length === 0 ? (
          <Card><CardContent className="py-10 text-center text-muted-foreground">Nenhum registro encontrado.</CardContent></Card>
        ) : Object.entries(studentGroups).map(([studentName, studentRecords]) => (
          <div key={studentName}>
            <div className="flex items-center gap-2 mb-2">
              <User className="h-4 w-4 text-muted-foreground" />
              <h3 className="font-semibold">{studentName}</h3>
              <span className="text-sm text-muted-foreground">
                · {studentRecords[0].student.class?.name}
              </span>
              <Badge variant="secondary" className="text-xs">{studentRecords.length} registro(s)</Badge>
            </div>
            <div className="space-y-3 ml-6">
              {studentRecords.map(r => (
                <Card key={r.id} className={r.confidentiality === 'CONFIDENCIAL' ? 'border-red-200' : ''}>
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 space-y-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge variant={typeColors[r.type] || 'secondary'} className="text-xs">
                            {PEDAGOGICAL_RECORD_TYPE_LABELS[r.type]}
                          </Badge>
                          <Badge variant={confidentialityColors[r.confidentiality] || 'secondary'} className="text-xs">
                            {r.confidentiality === 'CONFIDENCIAL' && <Lock className="h-2.5 w-2.5 mr-1" />}
                            {CONFIDENTIALITY_LABELS[r.confidentiality]}
                          </Badge>
                          {r.resolved && <Badge variant="success" className="text-xs">Resolvido</Badge>}
                        </div>
                        <p className="font-medium text-sm">{r.title}</p>
                        <p className="text-sm text-muted-foreground">{r.content}</p>
                        {r.actionPlan && (
                          <div className="p-2 bg-blue-50 border border-blue-100 rounded text-xs text-blue-800">
                            <strong>Plano de ação:</strong> {r.actionPlan}
                          </div>
                        )}
                      </div>
                      <div className="text-xs text-muted-foreground text-right shrink-0">
                        <div className="flex items-center gap-1 justify-end">
                          <Calendar className="h-3 w-3" /> {formatDate(r.date)}
                        </div>
                        <div className="flex items-center gap-1 justify-end mt-1">
                          <User className="h-3 w-3" /> {r.pedagogue.name}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        ))}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-xl max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Novo Registro Pedagógico</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Aluno *</Label>
              <select className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={form.studentId} onChange={e => setForm({ ...form, studentId: e.target.value })}>
                <option value="">Selecione o aluno...</option>
                {students.map(s => <option key={s.id} value={s.id}>{s.name} — {s.class?.name || 'sem turma'}</option>)}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Tipo *</Label>
                <select className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={form.type} onChange={e => setForm({ ...form, type: e.target.value })}>
                  {Object.entries(PEDAGOGICAL_RECORD_TYPE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </div>
              <div className="space-y-2">
                <Label>Confidencialidade</Label>
                <select className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={form.confidentiality} onChange={e => setForm({ ...form, confidentiality: e.target.value })}>
                  {Object.entries(CONFIDENTIALITY_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Título *</Label>
                <Input placeholder="Título do registro" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Data</Label>
                <Input type="date" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Conteúdo *</Label>
              <Textarea rows={4} placeholder="Descreva detalhadamente o registro..." value={form.content} onChange={e => setForm({ ...form, content: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Plano de ação</Label>
              <Textarea rows={2} placeholder="Ações previstas para acompanhamento..." value={form.actionPlan} onChange={e => setForm({ ...form, actionPlan: e.target.value })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={!form.studentId || !form.title || !form.content}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
