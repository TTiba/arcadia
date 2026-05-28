'use client'
import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'
import { Plus, CheckSquare, Calendar, Users, RefreshCw } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { formatDate, HOMEWORK_STATUS_LABELS } from '@/lib/utils'

interface Homework {
  id: string
  title: string
  instructions?: string
  dueDate?: string
  externalId?: string
  class: { name: string }
  subject: { name: string }
  lesson?: { title: string }
  _count?: { submissions: number }
}

export default function TarefasPage() {
  const [homework, setHomework] = useState<Homework[]>([])
  const [open, setOpen] = useState(false)
  const [syncingId, setSyncingId] = useState<string | null>(null)
  const [classes, setClasses] = useState<any[]>([])
  const [subjects, setSubjects] = useState<any[]>([])
  const [form, setForm] = useState({
    title: '', instructions: '', classId: '', subjectId: '', dueDate: '', externalId: ''
  })
  const { toast } = useToast()

  useEffect(() => {
    fetchHomework()
    fetch('/api/turmas').then(r => r.json()).then(setClasses)
    fetch('/api/aulas').then(r => r.json()).then((d: any[]) => {
      const subjectMap = new Map()
      d.forEach(l => { if (l.subject) subjectMap.set(l.subject.id, l.subject) })
      setSubjects(Array.from(subjectMap.values()))
    })
  }, [])

  const fetchHomework = async () => {
    const res = await fetch('/api/tarefas')
    if (res.ok) setHomework(await res.json())
  }

  const handleSave = async () => {
    const res = await fetch('/api/tarefas', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })
    if (res.ok) {
      toast({ title: 'Tarefa criada!' })
      setOpen(false)
      setForm({ title: '', instructions: '', classId: '', subjectId: '', dueDate: '', externalId: '' })
      fetchHomework()
    } else {
      toast({ title: 'Erro ao criar tarefa', variant: 'destructive' })
    }
  }

  const handleSync = async (hw: Homework) => {
    setSyncingId(hw.id)
    const students = await fetch(`/api/alunos?classId=${hw.class}`).then(r => r.json()).catch(() => [])
    const res = await fetch('/api/wayground/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ homeworkId: hw.id, studentIds: students.map((s: any) => s.id) }),
    })
    setSyncingId(null)
    if (res.ok) {
      toast({ title: 'Sincronização concluída!' })
    } else {
      toast({ title: 'Erro na sincronização', variant: 'destructive' })
    }
  }

  const isOverdue = (dueDate?: string) => dueDate && new Date(dueDate) < new Date()

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2"><CheckSquare className="h-6 w-6" /> Tarefas de Casa</h1>
          <p className="text-muted-foreground text-sm">{homework.length} tarefas cadastradas</p>
        </div>
        <Button onClick={() => setOpen(true)}><Plus className="h-4 w-4 mr-2" /> Nova Tarefa</Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {homework.length === 0 ? (
          <p className="text-muted-foreground col-span-2 text-center py-8">Nenhuma tarefa encontrada.</p>
        ) : homework.map(hw => (
          <Card key={hw.id} className={isOverdue(hw.dueDate) ? 'border-red-200' : ''}>
            <CardHeader className="pb-2">
              <div className="flex items-start justify-between">
                <CardTitle className="text-base">{hw.title}</CardTitle>
                {hw.externalId && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 text-xs"
                    onClick={() => handleSync(hw)}
                    disabled={syncingId === hw.id}
                  >
                    <RefreshCw className={`h-3 w-3 mr-1 ${syncingId === hw.id ? 'animate-spin' : ''}`} />
                    Wayground
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex flex-wrap gap-1">
                <Badge variant="outline" className="text-xs">{hw.subject.name}</Badge>
                <Badge variant="info" className="text-xs">{hw.class.name}</Badge>
                {hw.lesson && <Badge variant="secondary" className="text-xs">{hw.lesson.title}</Badge>}
              </div>
              {hw.instructions && <p className="text-sm text-muted-foreground line-clamp-2">{hw.instructions}</p>}
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                {hw.dueDate ? (
                  <span className={`flex items-center gap-1 ${isOverdue(hw.dueDate) ? 'text-red-600 font-medium' : ''}`}>
                    <Calendar className="h-3 w-3" />
                    Prazo: {formatDate(hw.dueDate)}
                    {isOverdue(hw.dueDate) && ' (vencida)'}
                  </span>
                ) : <span />}
                <span className="flex items-center gap-1">
                  <Users className="h-3 w-3" /> {hw._count?.submissions || 0} entregas
                </span>
              </div>
              {hw.externalId && (
                <p className="text-xs text-muted-foreground">ID Wayground: <code className="bg-muted px-1 rounded">{hw.externalId}</code></p>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader><DialogTitle>Nova Tarefa de Casa</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Título *</Label>
              <Input placeholder="Título da tarefa" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Turma *</Label>
                <select className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={form.classId} onChange={e => setForm({ ...form, classId: e.target.value })}>
                  <option value="">Selecione...</option>
                  {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div className="space-y-2">
                <Label>Componente *</Label>
                <select className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={form.subjectId} onChange={e => setForm({ ...form, subjectId: e.target.value })}>
                  <option value="">Selecione...</option>
                  {subjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Prazo</Label>
                <Input type="date" value={form.dueDate} onChange={e => setForm({ ...form, dueDate: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>ID Externo (Wayground)</Label>
                <Input placeholder="WAY-001" value={form.externalId} onChange={e => setForm({ ...form, externalId: e.target.value })} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Instruções</Label>
              <Textarea rows={3} placeholder="Descreva as instruções da tarefa..." value={form.instructions} onChange={e => setForm({ ...form, instructions: e.target.value })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={!form.title || !form.classId || !form.subjectId}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
