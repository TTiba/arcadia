'use client'
import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Plus, ClipboardList, Calendar, User } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { formatDate } from '@/lib/utils'

interface ClassRecord {
  id: string
  date: string
  contentDeveloped: string
  observations?: string
  pending?: string
  adaptations?: string
  class: { name: string }
  subject?: { name: string }
  teacher: { user: { name: string } }
  lesson?: { title: string }
}

export default function RegistroAulaPage() {
  const { data: session } = useSession()
  const [records, setRecords] = useState<ClassRecord[]>([])
  const [open, setOpen] = useState(false)
  const [teacher, setTeacher] = useState<any>(null)
  const [classes, setClasses] = useState<any[]>([])
  const [lessons, setLessons] = useState<any[]>([])
  const [subjects, setSubjects] = useState<any[]>([])
  const [form, setForm] = useState({
    classId: '', subjectId: '', lessonId: '', date: new Date().toISOString().split('T')[0],
    contentDeveloped: '', observations: '', pending: '', adaptations: '',
  })
  const { toast } = useToast()

  useEffect(() => {
    fetchTeacher()
    fetchRecords()
  }, [])

  const fetchTeacher = async () => {
    const res = await fetch('/api/professores')
    if (res.ok) {
      const teachers = await res.json()
      const userId = (session?.user as any)?.id
      const t = teachers.find((t: any) => t.user && t.userId === userId) ||
        teachers.find((t: any) => t.user?.email === session?.user?.email)
      if (t) {
        setTeacher(t)
        const uniqueClasses = Array.from(new Map(t.teacherClasses.map((tc: any) => [tc.class.id, tc.class])).values())
        setClasses(uniqueClasses)
        const uniqueSubjects = Array.from(new Map(t.teacherSubjects.map((ts: any) => [ts.subject.id, ts.subject])).values())
        setSubjects(uniqueSubjects)
      }
    }
  }

  const fetchRecords = async () => {
    const res = await fetch('/api/registros-aula')
    if (res.ok) setRecords(await res.json())
  }

  const fetchLessons = async (classId: string) => {
    if (!classId) return
    const res = await fetch(`/api/aulas?classId=${classId}`)
    if (res.ok) setLessons(await res.json())
  }

  const handleSave = async () => {
    if (!teacher) { toast({ title: 'Perfil de professor não encontrado', variant: 'destructive' }); return }
    const res = await fetch('/api/registros-aula', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...form, teacherId: teacher.id }),
    })
    if (res.ok) {
      toast({ title: 'Registro salvo com sucesso!' })
      setOpen(false)
      setForm({ classId: '', subjectId: '', lessonId: '', date: new Date().toISOString().split('T')[0], contentDeveloped: '', observations: '', pending: '', adaptations: '' })
      fetchRecords()
    } else {
      toast({ title: 'Erro ao salvar registro', variant: 'destructive' })
    }
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2"><ClipboardList className="h-6 w-6" /> Registro de Aula</h1>
          <p className="text-muted-foreground text-sm">Diário de classe — registros compartilhados por turma/componente</p>
        </div>
        <Button onClick={() => setOpen(true)}><Plus className="h-4 w-4 mr-2" /> Novo Registro</Button>
      </div>

      <div className="space-y-3">
        {records.length === 0 ? (
          <Card><CardContent className="py-10 text-center text-muted-foreground">Nenhum registro de aula encontrado.</CardContent></Card>
        ) : records.map(r => (
          <Card key={r.id}>
            <CardContent className="p-4">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="flex items-center gap-1 text-sm font-medium">
                      <Calendar className="h-3.5 w-3.5" /> {formatDate(r.date)}
                    </span>
                    <Badge variant="outline">{r.class.name}</Badge>
                    {r.subject && <Badge variant="info">{r.subject.name}</Badge>}
                    {r.lesson && <Badge variant="secondary">{r.lesson.title}</Badge>}
                  </div>
                  <p className="text-sm">{r.contentDeveloped}</p>
                  {r.observations && <p className="text-xs text-muted-foreground"><strong>Obs:</strong> {r.observations}</p>}
                  {r.pending && <p className="text-xs text-amber-700 bg-amber-50 px-2 py-1 rounded"><strong>Pendências:</strong> {r.pending}</p>}
                  {r.adaptations && <p className="text-xs text-blue-700 bg-blue-50 px-2 py-1 rounded"><strong>Adaptações:</strong> {r.adaptations}</p>}
                </div>
                <div className="text-xs text-muted-foreground flex items-center gap-1 shrink-0">
                  <User className="h-3 w-3" /> {r.teacher.user.name}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Novo Registro de Aula</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Turma *</Label>
                <select
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                  value={form.classId}
                  onChange={e => { setForm({ ...form, classId: e.target.value, lessonId: '' }); fetchLessons(e.target.value) }}
                >
                  <option value="">Selecione...</option>
                  {classes.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div className="space-y-2">
                <Label>Componente *</Label>
                <select
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                  value={form.subjectId}
                  onChange={e => setForm({ ...form, subjectId: e.target.value })}
                >
                  <option value="">Selecione...</option>
                  {subjects.map((s: any) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Aula/Material (opcional)</Label>
                <select
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                  value={form.lessonId}
                  onChange={e => setForm({ ...form, lessonId: e.target.value })}
                >
                  <option value="">Selecione...</option>
                  {lessons.map((l: any) => <option key={l.id} value={l.id}>{l.title}</option>)}
                </select>
              </div>
              <div className="space-y-2">
                <Label>Data *</Label>
                <Input type="date" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Conteúdo desenvolvido *</Label>
              <Textarea rows={4} placeholder="Descreva o que foi trabalhado na aula..." value={form.contentDeveloped} onChange={e => setForm({ ...form, contentDeveloped: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Observações</Label>
              <Textarea rows={2} placeholder="Observações gerais sobre a aula..." value={form.observations} onChange={e => setForm({ ...form, observations: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Pendências</Label>
                <Textarea rows={2} placeholder="Conteúdos pendentes para próxima aula..." value={form.pending} onChange={e => setForm({ ...form, pending: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Adaptações realizadas</Label>
                <Textarea rows={2} placeholder="Adaptações para alunos com necessidades especiais..." value={form.adaptations} onChange={e => setForm({ ...form, adaptations: e.target.value })} />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={!form.classId || !form.subjectId || !form.contentDeveloped}>Salvar Registro</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
