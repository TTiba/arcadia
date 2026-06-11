'use client'
import { useState, useEffect, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { CheckSquare, Square, Save, Calendar, Users, AlertCircle, CheckCircle2, ChevronLeft, ChevronRight, Unlock } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { cn } from '@/lib/utils'

interface ClassOption {
  id: string
  name: string
  grade: { name: string }
}

interface StudentRow {
  id: string
  name: string
  enrollment: string
  attendanceId: string | null
  status: 'PRESENTE' | 'FALTA' | 'FALTA_JUSTIFICADA'
}

export default function ChamadaPage() {
  const { data: session } = useSession()
  const [classes, setClasses] = useState<ClassOption[]>([])
  const [classId, setClassId] = useState('')
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [students, setStudents] = useState<StudentRow[]>([])
  const [absents, setAbsents] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [alreadyRecorded, setAlreadyRecorded] = useState(false)
  
  // Agenda / Calendário States
  const [currentMonth, setCurrentMonth] = useState(() => new Date())
  const [isLocked, setIsLocked] = useState(false)
  const [isModalOpen, setIsModalOpen] = useState(false)

  useEffect(() => {
    fetch('/api/turmas')
      .then(r => r.json())
      .then(data => {
        const list: ClassOption[] = data.classes ?? data ?? []
        setClasses(list)
        if (list.length > 0) setClassId(list[0].id)
      })
  }, [])

  const loadAttendance = useCallback(() => {
    if (!classId || !date) return
    setLoading(true)
    setSaved(false)
    fetch(`/api/attendance?classId=${classId}&date=${date}`)
      .then(r => r.json())
      .then(data => {
        setStudents(data.students ?? [])
        setAlreadyRecorded(data.recorded)
        setIsLocked(data.recorded) // Trava automaticamente se houver chamada gravada
        const initialAbsents = new Set<string>(
          (data.students ?? [])
            .filter((s: StudentRow) => s.status !== 'PRESENTE')
            .map((s: StudentRow) => s.id)
        )
        setAbsents(initialAbsents)
      })
      .finally(() => setLoading(false))
  }, [classId, date])

  useEffect(() => {
    loadAttendance()
  }, [loadAttendance])

  const toggle = (id: string) => {
    if (isLocked) return
    setAbsents(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
    setSaved(false)
  }

  const markAll = (present: boolean) => {
    if (isLocked) return
    setAbsents(present ? new Set() : new Set(students.map(s => s.id)))
    setSaved(false)
  }

  const save = async () => {
    setSaving(true)
    try {
      const res = await fetch('/api/attendance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ classId, date, absences: Array.from(absents) }),
      })
      if (res.ok) {
        setSaved(true)
        setAlreadyRecorded(true)
        setIsLocked(true) // Trava a chamada imediatamente após salvar
      }
    } finally {
      setSaving(false)
    }
  }

  // Helpers do Calendário
  const getDaysInMonth = (date: Date) => {
    const year = date.getFullYear()
    const month = date.getMonth()
    const firstDay = new Date(year, month, 1)
    const lastDay = new Date(year, month + 1, 0)
    
    const days = []
    
    const startDay = firstDay.getDay()
    for (let i = 0; i < startDay; i++) {
      days.push(null)
    }
    
    const totalDays = lastDay.getDate()
    for (let d = 1; d <= totalDays; d++) {
      days.push(new Date(year, month, d))
    }
    
    return days
  }

  const handlePrevMonth = () => {
    setCurrentMonth(prev => new Date(prev.getFullYear(), prev.getMonth() - 1, 1))
  }

  const handleNextMonth = () => {
    setCurrentMonth(prev => new Date(prev.getFullYear(), prev.getMonth() + 1, 1))
  }

  const getMonthName = (date: Date) => {
    const months = [
      'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
      'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
    ]
    return `${months[date.getMonth()]} de ${date.getFullYear()}`
  }

  const selectDay = (day: Date) => {
    const y = day.getFullYear()
    const m = String(day.getMonth() + 1).padStart(2, '0')
    const d = String(day.getDate()).padStart(2, '0')
    setDate(`${y}-${m}-${d}`)
    setIsModalOpen(true)
  }

  const selectedClass = classes.find(c => c.id === classId)
  const presentCount = students.length - absents.size
  const absenceRate = students.length > 0 ? Math.round((absents.size / students.length) * 100) : 0

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground font-serif">Diário de Presença</h1>
          <p className="text-muted-foreground text-sm mt-0.5">Gerencie a frequência dos alunos e agenda mensal.</p>
        </div>
      </div>

      {/* Selector de Turma */}
      <Card className="border border-border shadow-sm">
        <CardContent className="py-4">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="space-y-0.5">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Turma Selecionada</label>
              <p className="text-xs text-muted-foreground">Escolha a turma para carregar a pauta.</p>
            </div>
            <div className="w-full sm:w-64">
              <Select value={classId} onValueChange={setClassId}>
                <SelectTrigger className="h-10 bg-background border-border">
                  <SelectValue placeholder="Selecionar turma" />
                </SelectTrigger>
                <SelectContent>
                  {classes.map(c => (
                    <SelectItem key={c.id} value={c.id} className="cursor-pointer">{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Agenda / Calendário */}
      <Card className="border border-border shadow-sm overflow-hidden">
        <CardHeader className="bg-muted/30 pb-3 flex flex-row items-center justify-between border-b border-border/40">
          <CardTitle className="text-xs font-semibold uppercase tracking-wider flex items-center gap-2 text-foreground">
            <Calendar className="h-4 w-4 text-primary" />
            Agenda de Chamadas
          </CardTitle>
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={handlePrevMonth} title="Mês anterior">
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-sm font-semibold min-w-[120px] text-center text-foreground font-serif">
              {getMonthName(currentMonth)}
            </span>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={handleNextMonth} title="Próximo mês">
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent className="pt-4">
          <div className="grid grid-cols-7 gap-1 text-center text-[10px] font-bold text-muted-foreground uppercase mb-2 tracking-wider">
            <div>Dom</div>
            <div>Seg</div>
            <div>Ter</div>
            <div>Qua</div>
            <div>Qui</div>
            <div>Sex</div>
            <div>Sáb</div>
          </div>
          <div className="grid grid-cols-7 gap-1.5">
            {getDaysInMonth(currentMonth).map((day, idx) => {
              if (!day) return <div key={`empty-${idx}`} className="aspect-square" />
              
              const dayStr = day.toISOString().slice(0, 10)
              const isSelected = date === dayStr
              const isToday = new Date().toISOString().slice(0, 10) === dayStr
              const isWeekend = day.getDay() === 0 || day.getDay() === 6
              
              return (
                <button
                  key={dayStr}
                  onClick={() => selectDay(day)}
                  className={cn(
                    "aspect-square rounded-xl flex flex-col items-center justify-center relative transition-all text-sm font-medium border",
                    isSelected 
                      ? "bg-primary text-primary-foreground border-primary shadow-md scale-105 font-bold z-10" 
                      : isToday 
                        ? "border-primary/60 text-primary bg-primary/5 hover:bg-primary/10" 
                        : isWeekend
                          ? "bg-muted/10 border-transparent text-muted-foreground/60 hover:bg-muted/30 hover:text-foreground"
                          : "bg-background border-border/40 text-foreground hover:bg-muted/50"
                  )}
                >
                  <span>{day.getDate()}</span>
                  {isToday && !isSelected && (
                    <span className="absolute bottom-1 w-1 h-1 rounded-full bg-primary" />
                  )}
                </button>
              )
            })}
          </div>
        </CardContent>
      </Card>

      {/* Modal / Dialog de Chamada */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto rounded-2xl border border-border p-0">
          <div className="bg-muted/30 px-6 py-4 border-b border-border/40 flex flex-col md:flex-row md:items-center justify-between gap-3 sticky top-0 bg-background/95 backdrop-blur z-20">
            <div className="space-y-1">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-lg font-bold flex items-center gap-2 text-foreground font-serif">
                  <Users className="h-5 w-5 text-primary" />
                  Chamada: {selectedClass?.name ?? 'Pauta'}
                </h2>
                
                {/* Status de Presença ao lado de Chamada X Ano */}
                {students.length > 0 && !loading && (
                  absents.size === 0 ? (
                    <Badge className="bg-green-100 hover:bg-green-100 dark:bg-green-950/30 text-green-700 dark:text-green-400 border border-green-200 dark:border-green-900/60 py-0.5 px-2 text-[10px] font-bold shrink-0">
                      Todos Presentes
                    </Badge>
                  ) : (
                    <Badge className="bg-amber-100 hover:bg-amber-100 dark:bg-amber-950/30 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-900/60 py-0.5 px-2 text-[10px] font-bold shrink-0">
                      {absents.size} Ausente{absents.size > 1 ? 's' : ''}
                    </Badge>
                  )
                )}
              </div>
              <p className="text-xs text-muted-foreground font-medium">
                {new Date(date + 'T12:00:00').toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })}
              </p>
            </div>
            
            <div className="flex items-center gap-2 shrink-0">
              {isLocked ? (
                <Badge variant="secondary" className="bg-emerald-55 dark:bg-emerald-950/20 text-emerald-700 dark:text-emerald-400 border-emerald-250 dark:border-emerald-900 py-1 px-2.5 text-xs font-semibold flex items-center gap-1.5">
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" /> Registrada e Travada
                </Badge>
              ) : (
                students.length > 0 && (
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" onClick={() => markAll(true)} className="text-xs h-8 bg-background border-border">
                      <CheckSquare className="h-3.5 w-3.5 mr-1.5 text-green-600" /> Todos presentes
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => markAll(false)} className="text-xs h-8 bg-background border-border">
                      <Square className="h-3.5 w-3.5 mr-1.5 text-red-500" /> Todos ausentes
                    </Button>
                  </div>
                )
              )}
            </div>
          </div>

          <div className="px-6 py-4 space-y-6">
            {/* Stats bar no modal */}
            {students.length > 0 && !loading && (
              <div className="grid grid-cols-3 gap-3">
                <div className="border border-border/50 bg-muted/10 rounded-xl p-3 text-center">
                  <p className="text-xl font-bold text-green-600 font-serif">{presentCount}</p>
                  <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mt-0.5">Presentes</p>
                </div>
                <div className="border border-border/50 bg-muted/10 rounded-xl p-3 text-center">
                  <p className="text-xl font-bold text-red-500 font-serif">{absents.size}</p>
                  <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mt-0.5">Ausentes</p>
                </div>
                <div className="border border-border/50 bg-muted/10 rounded-xl p-3 text-center">
                  <p className={cn(
                    "text-xl font-bold font-serif",
                    absenceRate > 20 ? "text-red-500" : absenceRate > 10 ? "text-amber-500" : "text-green-600"
                  )}>
                    {absenceRate}%
                  </p>
                  <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mt-0.5">Taxa de falta</p>
                </div>
              </div>
            )}

            {/* Lista de alunos */}
            <div className="min-h-[200px]">
              {loading ? (
                <div className="text-center py-12 text-muted-foreground text-sm flex flex-col items-center justify-center gap-2">
                  <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                  Carregando alunos...
                </div>
              ) : students.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground text-sm">
                  Nenhum aluno ativo encontrado nesta turma.
                </div>
              ) : (
                <div className="space-y-1.5">
                  {students.map((s, i) => {
                    const absent = absents.has(s.id)
                    return (
                      <button
                        key={s.id}
                        disabled={isLocked}
                        onClick={() => toggle(s.id)}
                        className={cn(
                          "w-full flex items-center gap-4 px-4 py-3 rounded-xl border text-left transition-all",
                          isLocked 
                            ? absent
                              ? "border-red-100 bg-red-50/20 dark:bg-red-955/5 dark:border-red-955/10 opacity-80 cursor-not-allowed text-red-800 dark:text-red-400"
                              : "border-transparent bg-muted/20 opacity-80 cursor-not-allowed text-foreground"
                            : absent
                              ? "border-red-200 bg-red-50/70 hover:bg-red-50 dark:bg-red-955/20 dark:border-red-900 text-red-700 dark:text-red-400 font-semibold"
                              : "border-border/30 bg-muted/40 hover:bg-muted/70 text-foreground"
                        )}
                      >
                        <span className="text-xs font-semibold text-muted-foreground w-6 text-right shrink-0">{i + 1}</span>
                        {absent
                          ? <Square className="h-4 w-4 text-red-500 shrink-0 transition-transform active:scale-90" />
                          : <CheckSquare className="h-4 w-4 text-green-600 shrink-0 transition-transform active:scale-90" />
                        }
                        <span className="text-sm font-medium flex-1">
                          {s.name}
                        </span>
                        {absent && (
                          <Badge variant="destructive" className="text-[10px] py-0.5 px-2 font-bold shrink-0">Ausente</Badge>
                        )}
                      </button>
                    )
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Footer do Modal */}
          {students.length > 0 && !loading && (
            <div className="px-6 py-4 border-t border-border/40 bg-muted/10 sticky bottom-0 z-20">
              {isLocked ? (
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex items-center gap-2 text-emerald-800 dark:text-emerald-400 text-sm font-medium">
                    <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0" />
                    <span>Chamada registrada e travada.</span>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      onClick={() => setIsLocked(false)}
                      className="border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-400 hover:bg-emerald-100/60 dark:hover:bg-emerald-900/20 gap-2 font-medium"
                    >
                      <Unlock className="h-4 w-4" />
                      Editar chamada
                    </Button>
                    <Button variant="secondary" onClick={() => setIsModalOpen(false)}>
                      Fechar
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                  {/* Lado esquerdo agora limpo */}
                  <div />
                  
                  <div className="flex gap-2 w-full sm:w-auto shrink-0 justify-end">
                    <Button variant="ghost" onClick={() => setIsModalOpen(false)} className="text-muted-foreground hover:bg-muted">
                      Cancelar
                    </Button>
                    {saved && (
                      <Button variant="ghost" disabled className="text-green-600 bg-green-50 dark:bg-green-950/10 hover:bg-green-50 gap-2 border border-green-100">
                        <CheckCircle2 className="h-4 w-4" /> Salvo
                      </Button>
                    )}
                    <Button onClick={save} disabled={saving} className="gap-2 font-semibold min-w-[120px]">
                      <Save className="h-4 w-4" />
                      {saving ? 'Salvando...' : 'Salvar chamada'}
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
