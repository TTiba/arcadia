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
import { Plus, ClipboardList, Calendar, User, Sparkles } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { formatDate } from '@/lib/utils'

interface ClassRecord {
  id: string
  date: string
  contentDeveloped: string
  observations?: string
  pending?: string
  adaptations?: string
  classId: string
  subjectId?: string | null
  lessonId?: string | null
  class: { name: string }
  subject?: { name: string }
  teacherId: string
  teacher: { user: { name: string } }
  lesson?: { id: string; title: string; subjectId?: string | null; subjects?: { id: string; name: string }[] }
}

export default function RegistroAulaPage() {
  const { data: session } = useSession()
  const [records, setRecords] = useState<ClassRecord[]>([])
  const [open, setOpen] = useState(false)
  const [teacher, setTeacher] = useState<any>(null)
  const [classes, setClasses] = useState<any[]>([])
  const [lessons, setLessons] = useState<any[]>([])
  const [subjects, setSubjects] = useState<any[]>([])
  const [editingRecordId, setEditingRecordId] = useState<string | null>(null)
  const [form, setForm] = useState({
    classId: '', subjectId: '', lessonId: '', date: new Date().toISOString().split('T')[0],
    contentDeveloped: '', observations: '', pending: '', adaptations: '',
  })
  const [lessonRecords, setLessonRecords] = useState<ClassRecord[]>([])
  const [summarizing, setSummarizing] = useState(false)
  const [modalSummary, setModalSummary] = useState<string | null>(null)
  const [cardSummaries, setCardSummaries] = useState<Record<string, { text: string; loading: boolean }>>({})
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

  const fetchLessons = async (classId: string, currentTeacher = teacher) => {
    if (!classId) return
    const teacherQuery = currentTeacher ? `&teacherId=${currentTeacher.id}` : ''
    const res = await fetch(`/api/aulas?classId=${classId}${teacherQuery}`)
    if (res.ok) setLessons(await res.json())
  }

  const fetchOtherTeachersRecords = async (lessonId: string, currentTeacher = teacher) => {
    if (!lessonId) {
      setLessonRecords([])
      return
    }
    const res = await fetch(`/api/registros-aula?lessonId=${lessonId}`)
    if (res.ok) {
      const allRecords = await res.json()
      const others = allRecords.filter((r: any) => !currentTeacher || r.teacherId !== currentTeacher.id)
      setLessonRecords(others)
    }
  }

  const handleOpenRecord = async (record: any) => {
    const isOwnRecord = teacher && record.teacherId === teacher.id
    await fetchLessons(record.classId)

    if (isOwnRecord) {
      setEditingRecordId(record.id)
      setForm({
        classId: record.classId,
        subjectId: record.subjectId || '',
        lessonId: record.lessonId || '',
        date: record.date.split('T')[0],
        contentDeveloped: record.contentDeveloped || '',
        observations: record.observations || '',
        pending: record.pending || '',
        adaptations: record.adaptations || '',
      })
    } else {
      setEditingRecordId(null)
      let matchingSubjectId = ''
      if (teacher) {
        const teacherSubjectIds = teacher.teacherSubjects.map((ts: any) => ts.subject.id)
        if (record.lesson && record.lesson.subjects) {
          const lessonSubjectIds = record.lesson.subjects.map((s: any) => s.id)
          matchingSubjectId = teacherSubjectIds.find((id: string) => lessonSubjectIds.includes(id)) || teacherSubjectIds[0] || ''
        } else {
          matchingSubjectId = teacherSubjectIds[0] || ''
        }
      }
      setForm({
        classId: record.classId,
        subjectId: matchingSubjectId || record.subjectId || '',
        lessonId: record.lessonId || '',
        date: new Date().toISOString().split('T')[0],
        contentDeveloped: '',
        observations: '',
        pending: '',
        adaptations: '',
      })
    }

    setModalSummary(null)
    if (record.lessonId) {
      await fetchOtherTeachersRecords(record.lessonId)
    } else {
      setLessonRecords([])
    }
    setOpen(true)
  }

  const handleSummarize = async () => {
    if (!form.lessonId) return
    setSummarizing(true)
    setModalSummary(null)
    try {
      const res = await fetch('/api/ai/summarize-lessons', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lessonId: form.lessonId, currentTeacherId: teacher?.id })
      })
      if (res.ok) {
        const data = await res.json()
        if (data.summary) {
          setModalSummary(data.summary)
          toast({ title: 'Resumo gerado com sucesso!' })
        }
      } else {
        toast({ title: 'Erro ao gerar resumo pedagógico', variant: 'destructive' })
      }
    } catch {
      toast({ title: 'Erro na chamada de IA', variant: 'destructive' })
    } finally {
      setSummarizing(false)
    }
  }

  const handleSummarizeCard = async (e: React.MouseEvent, lessonId: string, recordId: string) => {
    e.stopPropagation()
    setCardSummaries(prev => ({
      ...prev,
      [recordId]: { text: '', loading: true }
    }))
    try {
      const res = await fetch('/api/ai/summarize-lessons', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lessonId, currentTeacherId: teacher?.id })
      })
      if (res.ok) {
        const data = await res.json()
        setCardSummaries(prev => ({
          ...prev,
          [recordId]: { text: data.summary || 'Não foi possível gerar a síntese.', loading: false }
        }))
      } else {
        toast({ title: 'Erro ao gerar resumo da IA', variant: 'destructive' })
        setCardSummaries(prev => ({ ...prev, [recordId]: { text: '', loading: false } }))
      }
    } catch {
      toast({ title: 'Erro de conexão com a IA', variant: 'destructive' })
      setCardSummaries(prev => ({ ...prev, [recordId]: { text: '', loading: false } }))
    }
  }

  const handleSave = async () => {
    if (!teacher) { toast({ title: 'Perfil de professor não encontrado', variant: 'destructive' }); return }
    const res = await fetch('/api/registros-aula', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...form, id: editingRecordId, teacherId: teacher.id }),
    })
    if (res.ok) {
      toast({ title: editingRecordId ? 'Registro atualizado com sucesso!' : 'Registro salvo com sucesso!' })
      setOpen(false)
      setForm({ classId: '', subjectId: '', lessonId: '', date: new Date().toISOString().split('T')[0], contentDeveloped: '', observations: '', pending: '', adaptations: '' })
      setLessonRecords([])
      setEditingRecordId(null)
      setModalSummary(null)
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
        <Button onClick={() => {
          setEditingRecordId(null)
          setForm({ classId: '', subjectId: '', lessonId: '', date: new Date().toISOString().split('T')[0], contentDeveloped: '', observations: '', pending: '', adaptations: '' })
          setLessonRecords([])
          setModalSummary(null)
          setOpen(true)
        }}><Plus className="h-4 w-4 mr-2" /> Novo Registro</Button>
      </div>

      <div className="space-y-3">
        {records.length === 0 ? (
          <Card><CardContent className="py-10 text-center text-muted-foreground">Nenhum registro de aula encontrado.</CardContent></Card>
        ) : records.map(r => {
          const partners = records.filter(
            rec => rec.lessonId === r.lessonId && rec.classId === r.classId && rec.id !== r.id
          )

          return (
            <Card key={r.id} className="hover:shadow-md transition-shadow cursor-pointer border-l-4 border-l-teal" onClick={() => handleOpenRecord(r)}>
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
                      {teacher && r.teacherId !== teacher.id && (
                        <Badge variant="outline" className="bg-purple-50 text-purple-700 border-purple-200">
                          Interdisciplinar — {r.teacher.user.name}
                        </Badge>
                      )}
                    </div>
                    <p className="text-sm">{r.contentDeveloped}</p>
                    {r.observations && <p className="text-xs text-muted-foreground"><strong>Obs:</strong> {r.observations}</p>}
                    {r.pending && <p className="text-xs text-amber-700 bg-amber-50 px-2 py-1 rounded"><strong>Pendências:</strong> {r.pending}</p>}
                    {r.adaptations && <p className="text-xs text-blue-700 bg-blue-50 px-2 py-1 rounded"><strong>Adaptações:</strong> {r.adaptations}</p>}

                    {/* Informações integradas dos parceiros interdisciplinares */}
                    {partners.length > 0 && (
                      <div className="mt-3 pt-3 border-t border-dashed space-y-3" onClick={e => e.stopPropagation()}>
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="flex items-center gap-1 text-[11px] text-purple-800 font-semibold bg-purple-50 px-2.5 py-0.5 rounded-full w-fit">
                            <Sparkles className="h-3 w-3 animate-pulse" /> Parceiros nesta aula: {partners.map(p => p.teacher.user.name).join(', ')}
                          </div>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={(e) => handleSummarizeCard(e, r.lessonId || '', r.id)}
                            disabled={cardSummaries[r.id]?.loading}
                            className="h-6 text-[10px] text-purple-700 hover:text-purple-800 hover:bg-purple-100/50 bg-purple-50/50 flex items-center gap-1 border border-purple-100"
                          >
                            <Sparkles className="h-2.5 w-2.5" />
                            {cardSummaries[r.id]?.loading ? 'Gerando...' : cardSummaries[r.id]?.text ? 'Regerar Resumo' : 'Resumir Aula com IA'}
                          </Button>
                        </div>

                        {/* Card do Resumo da IA */}
                        {cardSummaries[r.id] && (
                          <div className="p-2.5 bg-purple-50/70 border border-purple-100 rounded-lg space-y-1">
                            <div className="flex items-center gap-1 text-[10px] font-bold text-purple-800 uppercase tracking-wider">
                              <Sparkles className="h-3 w-3 text-purple-600 animate-pulse" /> Resumo Interdisciplinar da Aula (IA)
                            </div>
                            {cardSummaries[r.id].loading ? (
                              <p className="text-xs text-muted-foreground animate-pulse">Consolidando dados dos professores parceiros...</p>
                            ) : (
                              <p className="text-xs text-purple-950 font-medium leading-relaxed">{cardSummaries[r.id].text}</p>
                            )}
                          </div>
                        )}

                        <div className="pl-3 border-l border-purple-200 space-y-1.5">
                          <span className="text-[10px] text-purple-600 font-semibold uppercase tracking-wider block">Observações e Diários dos Colegas:</span>
                          {partners.map(p => (
                            <div key={p.id} className="text-xs text-muted-foreground">
                              <span className="font-semibold text-purple-700">{p.teacher.user.name} ({p.subject?.name || 'N/A'}):</span>{' '}
                              <span>{p.contentDeveloped.substring(0, 120)}...</span>
                              {p.observations && (
                                <span className="block italic text-[11px] pl-2 text-muted-foreground/80">— Obs: {p.observations}</span>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                  <div className="text-xs text-muted-foreground flex items-center gap-1 shrink-0">
                    <User className="h-3 w-3" /> {r.teacher.user.name}
                  </div>
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editingRecordId ? 'Visualizar / Editar Registro' : 'Novo Registro de Aula'}</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Turma *</Label>
                <select
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                  value={form.classId}
                  onChange={e => { setForm({ ...form, classId: e.target.value, lessonId: '' }); setLessonRecords([]); fetchLessons(e.target.value) }}
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
                  onChange={e => {
                    const selectedLessonId = e.target.value
                    const selectedLesson = lessons.find(l => l.id === selectedLessonId)
                    let updatedSubjectId = form.subjectId
                    if (selectedLesson) {
                      if (selectedLesson.subjectId) {
                        updatedSubjectId = selectedLesson.subjectId
                      } else if (selectedLesson.subjects && selectedLesson.subjects.length === 1) {
                        updatedSubjectId = selectedLesson.subjects[0].id
                      }
                    }
                    setForm({ ...form, lessonId: selectedLessonId, subjectId: updatedSubjectId })
                    fetchOtherTeachersRecords(selectedLessonId)
                  }}
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

            {/* Registros de outros professores */}
            {lessonRecords.length > 0 && (
              <div className="p-3 bg-muted/40 border rounded-lg space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Registros de outros professores para esta aula
                  </span>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleSummarize}
                    disabled={summarizing}
                    className="h-7 text-xs border-purple-200 hover:border-purple-300 text-purple-700 bg-purple-50 hover:bg-purple-100 flex items-center gap-1"
                  >
                    <Sparkles className="h-3 w-3 animate-pulse" /> {summarizing ? 'Resumindo...' : 'Resumir com IA'}
                  </Button>
                </div>

                {/* Card do Resumo da IA dentro do modal */}
                {(modalSummary || summarizing) && (
                  <div className="p-2.5 bg-purple-50/70 border border-purple-100 rounded-lg space-y-1 my-2">
                    <div className="flex items-center gap-1 text-[10px] font-bold text-purple-800 uppercase tracking-wider">
                      <Sparkles className="h-3 w-3 text-purple-600 animate-pulse" /> Resumo Interdisciplinar da Aula (IA)
                    </div>
                    {summarizing ? (
                      <p className="text-xs text-muted-foreground animate-pulse">Consolidando dados dos professores parceiros...</p>
                    ) : (
                      <p className="text-xs text-purple-950 font-medium leading-relaxed">{modalSummary}</p>
                    )}
                  </div>
                )}

                <div className="space-y-3 max-h-60 overflow-y-auto pr-1">
                  {lessonRecords.map((lr: any) => (
                    <div key={lr.id} className="text-xs border-b pb-3 last:border-0 last:pb-0 space-y-1">
                      <div className="flex items-center justify-between text-muted-foreground font-semibold">
                        <span>{lr.teacher.user.name} ({lr.subject?.name})</span>
                        <span>{formatDate(lr.date)}</span>
                      </div>
                      <p className="text-foreground"><strong>Conteúdo:</strong> {lr.contentDeveloped}</p>
                      {lr.observations && (
                        <p className="text-muted-foreground"><strong>Obs:</strong> {lr.observations}</p>
                      )}
                      {lr.pending && (
                        <p className="text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded inline-block mr-2">
                          <strong>Pendências:</strong> {lr.pending}
                        </p>
                      )}
                      {lr.adaptations && (
                        <p className="text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded inline-block">
                          <strong>Adaptações:</strong> {lr.adaptations}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

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
