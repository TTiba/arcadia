'use client'
import { useState, useEffect, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { CheckSquare, Square, Save, Calendar, Users, AlertCircle, CheckCircle2 } from 'lucide-react'

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
    setAbsents(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
    setSaved(false)
  }

  const markAll = (present: boolean) => {
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
        setAlreadyRecorded(absents.size > 0)
      }
    } finally {
      setSaving(false)
    }
  }

  const selectedClass = classes.find(c => c.id === classId)
  const presentCount = students.length - absents.size
  const absenceRate = students.length > 0 ? Math.round((absents.size / students.length) * 100) : 0

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Chamada</h1>
        <p className="text-muted-foreground text-sm mt-1">Registre a presença dos alunos por turma e data.</p>
      </div>

      {/* Controls */}
      <Card>
        <CardContent className="pt-5">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="flex-1">
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Turma</label>
              <Select value={classId} onValueChange={setClassId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecionar turma" />
                </SelectTrigger>
                <SelectContent>
                  {classes.map(c => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Data</label>
              <div className="relative">
                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                <input
                  type="date"
                  value={date}
                  onChange={e => setDate(e.target.value)}
                  className="pl-9 pr-3 py-2 h-10 rounded-md border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Stats bar */}
      {students.length > 0 && (
        <div className="grid grid-cols-3 gap-3">
          <Card>
            <CardContent className="pt-4 pb-4 text-center">
              <p className="text-2xl font-bold text-green-600">{presentCount}</p>
              <p className="text-xs text-muted-foreground">Presentes</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-4 text-center">
              <p className="text-2xl font-bold text-red-500">{absents.size}</p>
              <p className="text-xs text-muted-foreground">Ausentes</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-4 text-center">
              <p className={`text-2xl font-bold ${absenceRate > 20 ? 'text-red-500' : absenceRate > 10 ? 'text-amber-500' : 'text-green-600'}`}>
                {absenceRate}%
              </p>
              <p className="text-xs text-muted-foreground">Taxa de falta</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Student list */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <Users className="h-4 w-4" />
              {selectedClass?.name ?? 'Alunos'} — {new Date(date + 'T12:00:00').toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' })}
            </CardTitle>
            {alreadyRecorded && !saved && (
              <Badge variant="secondary" className="text-xs">Chamada já registrada</Badge>
            )}
          </div>
          {students.length > 0 && (
            <div className="flex gap-2 mt-2">
              <Button size="sm" variant="outline" onClick={() => markAll(true)} className="text-xs h-7">
                <CheckSquare className="h-3 w-3 mr-1" /> Todos presentes
              </Button>
              <Button size="sm" variant="outline" onClick={() => markAll(false)} className="text-xs h-7">
                <Square className="h-3 w-3 mr-1" /> Todos ausentes
              </Button>
            </div>
          )}
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8 text-muted-foreground text-sm">Carregando alunos...</div>
          ) : students.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground text-sm">Nenhum aluno encontrado nessa turma.</div>
          ) : (
            <div className="space-y-1">
              {students.map((s, i) => {
                const absent = absents.has(s.id)
                return (
                  <button
                    key={s.id}
                    onClick={() => toggle(s.id)}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg border text-left transition-colors ${
                      absent
                        ? 'border-red-200 bg-red-50 dark:bg-red-950/20 dark:border-red-900'
                        : 'border-transparent bg-muted/40 hover:bg-muted/70'
                    }`}
                  >
                    <span className="text-xs text-muted-foreground w-6 text-right shrink-0">{i + 1}</span>
                    {absent
                      ? <Square className="h-4 w-4 text-red-500 shrink-0" />
                      : <CheckSquare className="h-4 w-4 text-green-600 shrink-0" />
                    }
                    <span className={`text-sm font-medium flex-1 ${absent ? 'text-red-600 dark:text-red-400' : ''}`}>
                      {s.name}
                    </span>
                    {absent && (
                      <Badge variant="destructive" className="text-[10px] h-5 shrink-0">Falta</Badge>
                    )}
                  </button>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Save button */}
      {students.length > 0 && (
        <div className="flex items-center justify-between">
          {saved && (
            <div className="flex items-center gap-2 text-green-600 text-sm font-medium">
              <CheckCircle2 className="h-4 w-4" />
              Chamada salva com sucesso!
            </div>
          )}
          {!saved && absents.size > 0 && (
            <div className="flex items-center gap-2 text-amber-600 text-sm">
              <AlertCircle className="h-4 w-4" />
              {absents.size} aluno{absents.size > 1 ? 's' : ''} marcado{absents.size > 1 ? 's' : ''} como ausente{absents.size > 1 ? 's' : ''}.
            </div>
          )}
          {!saved && absents.size === 0 && <div />}
          <Button onClick={save} disabled={saving} className="gap-2">
            <Save className="h-4 w-4" />
            {saving ? 'Salvando...' : 'Salvar chamada'}
          </Button>
        </div>
      )}
    </div>
  )
}
