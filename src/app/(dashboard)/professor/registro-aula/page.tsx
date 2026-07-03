'use client'
import { useState, useEffect, useMemo } from 'react'
import { useSession } from 'next-auth/react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent } from '@/components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Plus, ClipboardList, Users2, Sparkles, ChevronDown, BookOpen } from 'lucide-react'
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

// Agrupa registros por dia, com rótulos amigáveis (Hoje / Ontem / data por extenso)
function dayLabel(dateStr: string): string {
  const d = new Date(dateStr)
  const today = new Date(); today.setHours(0, 0, 0, 0)
  const day = new Date(d); day.setHours(0, 0, 0, 0)
  const diff = Math.round((today.getTime() - day.getTime()) / 86400000)
  if (diff === 0) return 'Hoje'
  if (diff === 1) return 'Ontem'
  return d.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })
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
  const [filterClassId, setFilterClassId] = useState('')
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

  const openNewRecord = () => {
    setEditingRecordId(null)
    setForm({ classId: filterClassId || '', subjectId: '', lessonId: '', date: new Date().toISOString().split('T')[0], contentDeveloped: '', observations: '', pending: '', adaptations: '' })
    if (filterClassId) fetchLessons(filterClassId)
    setLessonRecords([])
    setModalSummary(null)
    setOpen(true)
  }

  // Turmas presentes nos registros (para os filtros)
  const filterOptions = useMemo(() => {
    const map = new Map<string, string>()
    for (const r of records) map.set(r.classId, r.class.name)
    return Array.from(map.entries()).sort((a, b) => a[1].localeCompare(b[1]))
  }, [records])

  // Registros filtrados e agrupados por dia
  const grouped = useMemo(() => {
    const filtered = filterClassId ? records.filter(r => r.classId === filterClassId) : records
    const sorted = [...filtered].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    const groups: { label: string; items: ClassRecord[] }[] = []
    for (const r of sorted) {
      const label = dayLabel(r.date)
      const last = groups[groups.length - 1]
      if (last && last.label === label) last.items.push(r)
      else groups.push({ label, items: [r] })
    }
    return groups
  }, [records, filterClassId])

  return (
    <div className="p-8">
      <div className="max-w-5xl mx-auto space-y-6">
        {/* Cabeçalho */}
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Registro de Aula</h1>
            <p className="text-muted-foreground mt-1 text-sm">
              Diário de classe — o que foi trabalhado em cada aula, compartilhado com colegas da mesma turma
            </p>
          </div>
          <Button onClick={openNewRecord} size="lg" className="shrink-0">
            <Plus className="h-4 w-4 mr-2" /> Registrar aula
          </Button>
        </div>

        {/* Filtro por turma */}
        {filterOptions.length > 1 && (
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={() => setFilterClassId('')}
              className={`text-sm px-3.5 py-1.5 rounded-full border transition-colors ${
                filterClassId === ''
                  ? 'bg-primary text-primary-foreground border-primary font-medium'
                  : 'border-border text-muted-foreground hover:text-foreground hover:border-ring'
              }`}
            >
              Todas as turmas
            </button>
            {filterOptions.map(([id, name]) => (
              <button
                key={id}
                onClick={() => setFilterClassId(id)}
                className={`text-sm px-3.5 py-1.5 rounded-full border transition-colors ${
                  filterClassId === id
                    ? 'bg-primary text-primary-foreground border-primary font-medium'
                    : 'border-border text-muted-foreground hover:text-foreground hover:border-ring'
                }`}
              >
                {name}
              </button>
            ))}
          </div>
        )}

        {/* Linha do tempo agrupada por dia */}
        {grouped.length === 0 ? (
          <Card className="rounded-2xl border-dashed">
            <CardContent className="py-14 text-center space-y-3">
              <div className="mx-auto w-12 h-12 rounded-full bg-muted flex items-center justify-center">
                <ClipboardList className="h-6 w-6 text-muted-foreground" />
              </div>
              <div>
                <p className="font-medium">Nenhum registro por aqui ainda</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Registre sua primeira aula — leva menos de um minuto e mantém o diário da turma em dia.
                </p>
              </div>
              <Button onClick={openNewRecord} variant="outline" className="mt-2">
                <Plus className="h-4 w-4 mr-2" /> Registrar primeira aula
              </Button>
            </CardContent>
          </Card>
        ) : (
          grouped.map(group => (
            <div key={group.label} className="space-y-2.5">
              <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground first-letter:uppercase pt-2">
                {group.label}
              </h2>
              {group.items.map(r => {
                const isOwn = teacher && r.teacherId === teacher.id
                const partners = records.filter(
                  rec => rec.lessonId === r.lessonId && rec.classId === r.classId && rec.id !== r.id
                )
                return (
                  <Card
                    key={r.id}
                    className="rounded-2xl border border-border shadow-none hover:border-ring transition-colors cursor-pointer"
                    onClick={() => handleOpenRecord(r)}
                  >
                    <CardContent className="p-5">
                      {/* Título: componente + turma; quem registrou à direita */}
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="font-medium leading-tight">
                            {r.subject?.name || 'Aula'} · {r.class.name}
                          </p>
                          {r.lesson && (
                            <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1">
                              <BookOpen className="h-3 w-3" /> {r.lesson.title}
                            </p>
                          )}
                        </div>
                        <div className="text-xs text-muted-foreground shrink-0 text-right">
                          <p>{isOwn ? 'Você' : r.teacher.user.name}</p>
                          <p className="mt-0.5">{formatDate(r.date)}</p>
                        </div>
                      </div>

                      {/* Conteúdo é o herói do card */}
                      <p className="text-sm mt-3 leading-relaxed">{r.contentDeveloped}</p>

                      {/* Metadados secundários */}
                      {(r.observations || r.pending || r.adaptations) && (
                        <div className="flex flex-wrap gap-2 mt-3">
                          {r.pending && (
                            <span className="text-xs px-2.5 py-1 rounded-full bg-warning/15 text-foreground">
                              Pendência: {r.pending}
                            </span>
                          )}
                          {r.adaptations && (
                            <span className="text-xs px-2.5 py-1 rounded-full bg-muted text-muted-foreground">
                              Adaptações: {r.adaptations}
                            </span>
                          )}
                          {r.observations && (
                            <span className="text-xs px-2.5 py-1 rounded-full bg-muted text-muted-foreground">
                              Obs: {r.observations}
                            </span>
                          )}
                        </div>
                      )}

                      {/* Aula interdisciplinar — colegas na mesma aula */}
                      {partners.length > 0 && (
                        <div className="mt-4 pt-3 border-t border-border space-y-2.5" onClick={e => e.stopPropagation()}>
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <span className="flex items-center gap-1.5 text-xs text-primary font-medium">
                              <Users2 className="h-3.5 w-3.5" />
                              Aula compartilhada com {partners.map(p => p.teacher.user.name).join(', ')}
                            </span>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={(e) => handleSummarizeCard(e, r.lessonId || '', r.id)}
                              disabled={cardSummaries[r.id]?.loading}
                              className="h-7 text-xs"
                            >
                              <Sparkles className="h-3 w-3 mr-1.5" />
                              {cardSummaries[r.id]?.loading ? 'Gerando...' : cardSummaries[r.id]?.text ? 'Regerar resumo' : 'Resumir com IA'}
                            </Button>
                          </div>

                          {cardSummaries[r.id] && (
                            <div className="p-3 bg-accent/60 border border-border rounded-xl">
                              <p className="text-[11px] font-semibold text-primary uppercase tracking-wider mb-1">
                                Resumo interdisciplinar (IA)
                              </p>
                              {cardSummaries[r.id].loading ? (
                                <p className="text-xs text-muted-foreground">Consolidando os diários dos colegas…</p>
                              ) : (
                                <p className="text-xs leading-relaxed">{cardSummaries[r.id].text}</p>
                              )}
                            </div>
                          )}

                          <div className="space-y-1.5">
                            {partners.map(p => (
                              <p key={p.id} className="text-xs text-muted-foreground">
                                <span className="font-medium text-foreground">{p.teacher.user.name}</span>
                                {p.subject?.name ? ` (${p.subject.name})` : ''}: {p.contentDeveloped.substring(0, 120)}
                                {p.contentDeveloped.length > 120 ? '…' : ''}
                              </p>
                            ))}
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                )
              })}
            </div>
          ))
        )}
      </div>

      {/* Modal de registro */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingRecordId ? 'Editar registro' : 'Registrar aula'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-5 py-2">
            {/* Contexto da aula em uma linha */}
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label>Turma *</Label>
                <select
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                  value={form.classId}
                  onChange={e => { setForm({ ...form, classId: e.target.value, lessonId: '' }); setLessonRecords([]); fetchLessons(e.target.value) }}
                >
                  <option value="">Selecione…</option>
                  {classes.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div className="space-y-1.5">
                <Label>Componente *</Label>
                <select
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                  value={form.subjectId}
                  onChange={e => setForm({ ...form, subjectId: e.target.value })}
                >
                  <option value="">Selecione…</option>
                  {subjects.map((s: any) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
              <div className="space-y-1.5">
                <Label>Data *</Label>
                <Input type="date" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Vincular a uma aula planejada <span className="text-muted-foreground font-normal">(opcional)</span></Label>
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
                <option value="">Nenhuma — registro avulso</option>
                {lessons.map((l: any) => <option key={l.id} value={l.id}>{l.title}</option>)}
              </select>
            </div>

            {/* Diários dos colegas nesta aula */}
            {lessonRecords.length > 0 && (
              <div className="p-3.5 bg-accent/50 border border-border rounded-xl space-y-2.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="flex items-center gap-1.5 text-xs font-medium text-primary">
                    <Users2 className="h-3.5 w-3.5" /> Diários dos colegas nesta aula
                  </span>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleSummarize}
                    disabled={summarizing}
                    className="h-7 text-xs"
                  >
                    <Sparkles className="h-3 w-3 mr-1.5" /> {summarizing ? 'Resumindo…' : 'Resumir com IA'}
                  </Button>
                </div>

                {(modalSummary || summarizing) && (
                  <div className="p-3 bg-background border border-border rounded-lg">
                    <p className="text-[11px] font-semibold text-primary uppercase tracking-wider mb-1">
                      Resumo interdisciplinar (IA)
                    </p>
                    {summarizing ? (
                      <p className="text-xs text-muted-foreground">Consolidando os diários dos colegas…</p>
                    ) : (
                      <p className="text-xs leading-relaxed">{modalSummary}</p>
                    )}
                  </div>
                )}

                <div className="space-y-3 max-h-52 overflow-y-auto pr-1">
                  {lessonRecords.map((lr: any) => (
                    <div key={lr.id} className="text-xs border-b border-border pb-2.5 last:border-0 last:pb-0 space-y-1">
                      <div className="flex items-center justify-between text-muted-foreground">
                        <span className="font-medium text-foreground">{lr.teacher.user.name}{lr.subject?.name ? ` (${lr.subject.name})` : ''}</span>
                        <span>{formatDate(lr.date)}</span>
                      </div>
                      <p>{lr.contentDeveloped}</p>
                      {lr.observations && <p className="text-muted-foreground">Obs: {lr.observations}</p>}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Campo principal — o que foi trabalhado */}
            <div className="space-y-1.5">
              <Label>O que foi trabalhado na aula? *</Label>
              <Textarea
                rows={5}
                autoFocus
                placeholder="Ex.: Frações equivalentes com material concreto. A turma resolveu a lista 8 em duplas; maioria avançou bem até o exercício 6."
                value={form.contentDeveloped}
                onChange={e => setForm({ ...form, contentDeveloped: e.target.value })}
              />
            </div>

            {/* Detalhes opcionais recolhidos por padrão */}
            <details className="group rounded-xl border border-border">
              <summary className="flex items-center justify-between cursor-pointer list-none px-4 py-3 text-sm font-medium text-muted-foreground hover:text-foreground">
                Mais detalhes — observações, pendências e adaptações
                <ChevronDown className="h-4 w-4 transition-transform group-open:rotate-180" />
              </summary>
              <div className="px-4 pb-4 space-y-4">
                <div className="space-y-1.5">
                  <Label>Observações</Label>
                  <Textarea rows={2} placeholder="Observações gerais sobre a aula…" value={form.observations} onChange={e => setForm({ ...form, observations: e.target.value })} />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label>Pendências</Label>
                    <Textarea rows={2} placeholder="Conteúdos para retomar na próxima aula…" value={form.pending} onChange={e => setForm({ ...form, pending: e.target.value })} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Adaptações realizadas</Label>
                    <Textarea rows={2} placeholder="Adaptações para alunos com necessidades específicas…" value={form.adaptations} onChange={e => setForm({ ...form, adaptations: e.target.value })} />
                  </div>
                </div>
              </div>
            </details>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={!form.classId || !form.subjectId || !form.contentDeveloped}>
              {editingRecordId ? 'Salvar alterações' : 'Salvar registro'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
