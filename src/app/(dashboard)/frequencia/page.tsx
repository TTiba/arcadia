'use client'
import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { ArrowLeft, Users, AlertTriangle, TrendingDown, CheckCircle2 } from 'lucide-react'

interface ClassOption {
  id: string
  name: string
  grade: { name: string }
}

interface StudentSummary {
  id: string
  name: string
  enrollment: string
  faltas: number
  faltasJustificadas: number
  total: number
  frequencia: number
}

interface AttendanceRecord {
  id: string
  studentId: string
  status: string
  justification: string | null
}

interface SummaryData {
  students: StudentSummary[]
  schoolDaysRecorded: number
  atRiskCount: number
  avgFaltas: string
  totalStudents: number
}

export default function FrequenciaPage() {
  const [classes, setClasses] = useState<ClassOption[]>([])
  const [classId, setClassId] = useState('')
  const [days, setDays] = useState('30')
  const [summary, setSummary] = useState<SummaryData | null>(null)
  const [loading, setLoading] = useState(false)
  const [justifyingId, setJustifyingId] = useState<string | null>(null)
  const [justifyText, setJustifyText] = useState('')
  const [drillDate, setDrillDate] = useState('')
  const [drillRecords, setDrillRecords] = useState<AttendanceRecord[]>([])
  const [view, setView] = useState<'summary' | 'student'>('summary')
  const [selectedStudent, setSelectedStudent] = useState<StudentSummary | null>(null)
  const [studentDates, setStudentDates] = useState<{ date: string; status: string; id: string; justification: string | null }[]>([])

  useEffect(() => {
    fetch('/api/turmas')
      .then(r => r.json())
      .then(data => {
        const list: ClassOption[] = data.classes ?? data ?? []
        setClasses(list)
        if (list.length > 0) setClassId(list[0].id)
      })
  }, [])

  useEffect(() => {
    if (!classId) return
    setLoading(true)
    setSummary(null)
    fetch(`/api/attendance/summary?classId=${classId}&days=${days}`)
      .then(r => r.json())
      .then(setSummary)
      .finally(() => setLoading(false))
  }, [classId, days])

  const openStudent = (s: StudentSummary) => {
    setSelectedStudent(s)
    setView('student')
    // Fetch all absences for this student from the class
    const since = new Date()
    since.setDate(since.getDate() - parseInt(days))
    fetch(`/api/attendance?classId=${classId}&date=${since.toISOString().slice(0, 10)}&studentId=${s.id}`)
    // Simpler: we'll query per-student from a different endpoint
    // For now show summary data and allow justification from a per-day view
    fetch(`/api/attendance/summary?classId=${classId}&days=${days}`)
      .then(r => r.json())
      .then((data: SummaryData) => {
        const found = data.students.find(x => x.id === s.id)
        if (found) setSelectedStudent(found)
      })
  }

  const justify = async (recordId: string) => {
    if (!justifyText.trim()) return
    const res = await fetch(`/api/attendance/${recordId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'FALTA_JUSTIFICADA', justification: justifyText }),
    })
    if (res.ok) {
      setJustifyingId(null)
      setJustifyText('')
      // Reload
      fetch(`/api/attendance/summary?classId=${classId}&days=${days}`)
        .then(r => r.json())
        .then(setSummary)
    }
  }

  const selectedClass = classes.find(c => c.id === classId)

  const frequencyColor = (f: number) => {
    if (f >= 90) return 'text-green-600'
    if (f >= 75) return 'text-amber-500'
    return 'text-red-500'
  }

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      {view === 'student' && selectedStudent ? (
        <>
          <button
            onClick={() => setView('summary')}
            className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="h-4 w-4" /> Voltar para {selectedClass?.name}
          </button>
          <div>
            <h1 className="text-xl font-bold">{selectedStudent.name}</h1>
            <p className="text-muted-foreground text-sm">{selectedStudent.enrollment} · {selectedClass?.name}</p>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <Card>
              <CardContent className="pt-4 pb-4 text-center">
                <p className={`text-3xl font-bold ${frequencyColor(selectedStudent.frequencia)}`}>
                  {selectedStudent.frequencia}%
                </p>
                <p className="text-xs text-muted-foreground">Frequência</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4 pb-4 text-center">
                <p className="text-3xl font-bold text-red-500">{selectedStudent.faltas}</p>
                <p className="text-xs text-muted-foreground">Faltas</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4 pb-4 text-center">
                <p className="text-3xl font-bold text-amber-500">{selectedStudent.faltasJustificadas}</p>
                <p className="text-xs text-muted-foreground">Justificadas</p>
              </CardContent>
            </Card>
          </div>
          {selectedStudent.total >= 5 && (
            <div className="flex items-center gap-3 p-3 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900 rounded-lg text-sm text-red-700 dark:text-red-400">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              Aluno com {selectedStudent.total} faltas nos últimos {days} dias. Risco de reprovação por frequência (mínimo 75%).
            </div>
          )}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Justificar falta</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-3">
                Para justificar uma falta específica, acesse a chamada do dia desejado e edite o registro individualmente via a API de justificativa.
              </p>
              <p className="text-xs text-muted-foreground">
                Total de faltas registradas: <strong>{selectedStudent.faltas}</strong> injustificadas + <strong>{selectedStudent.faltasJustificadas}</strong> justificadas nos últimos {days} dias.
              </p>
            </CardContent>
          </Card>
        </>
      ) : (
        <>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Frequência Escolar</h1>
            <p className="text-muted-foreground text-sm mt-1">Acompanhe a presença dos alunos por turma.</p>
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
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">Período</label>
                  <Select value={days} onValueChange={setDays}>
                    <SelectTrigger className="w-36">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="7">7 dias</SelectItem>
                      <SelectItem value="15">15 dias</SelectItem>
                      <SelectItem value="30">30 dias</SelectItem>
                      <SelectItem value="60">60 dias</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Summary cards */}
          {summary && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <Card>
                <CardContent className="pt-4 pb-4 text-center">
                  <p className="text-2xl font-bold">{summary.totalStudents}</p>
                  <p className="text-xs text-muted-foreground">Alunos</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-4 pb-4 text-center">
                  <p className="text-2xl font-bold">{summary.schoolDaysRecorded}</p>
                  <p className="text-xs text-muted-foreground">Dias registrados</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-4 pb-4 text-center">
                  <p className="text-2xl font-bold text-amber-500">{summary.avgFaltas}</p>
                  <p className="text-xs text-muted-foreground">Média de faltas</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-4 pb-4 text-center">
                  <p className={`text-2xl font-bold ${summary.atRiskCount > 0 ? 'text-red-500' : 'text-green-600'}`}>
                    {summary.atRiskCount}
                  </p>
                  <p className="text-xs text-muted-foreground">Em risco</p>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Student table */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Users className="h-4 w-4" />
                {selectedClass?.name ?? 'Alunos'} — últimos {days} dias
              </CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="text-center py-8 text-muted-foreground text-sm">Carregando...</div>
              ) : !summary || summary.students.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground text-sm">
                  Nenhum registro de frequência encontrado para esta turma no período.
                </div>
              ) : (
                <div className="space-y-1">
                  {/* Header */}
                  <div className="grid grid-cols-12 gap-2 px-3 py-1 text-xs font-medium text-muted-foreground">
                    <span className="col-span-5">Aluno</span>
                    <span className="col-span-2 text-center">Faltas</span>
                    <span className="col-span-2 text-center">Justif.</span>
                    <span className="col-span-2 text-center">Frequência</span>
                    <span className="col-span-1" />
                  </div>
                  {summary.students.map(s => (
                    <div
                      key={s.id}
                      className={`grid grid-cols-12 gap-2 px-3 py-2.5 rounded-lg items-center text-sm ${
                        s.total >= 8 ? 'bg-red-50 dark:bg-red-950/20' :
                        s.total >= 5 ? 'bg-amber-50 dark:bg-amber-950/20' :
                        'bg-muted/30'
                      }`}
                    >
                      <div className="col-span-5">
                        <p className="font-medium truncate">{s.name}</p>
                        <p className="text-xs text-muted-foreground">{s.enrollment}</p>
                      </div>
                      <div className="col-span-2 text-center">
                        <span className={`font-semibold ${s.faltas >= 5 ? 'text-red-500' : ''}`}>{s.faltas}</span>
                      </div>
                      <div className="col-span-2 text-center">
                        <span className="text-amber-600">{s.faltasJustificadas}</span>
                      </div>
                      <div className="col-span-2 text-center">
                        <span className={`font-semibold ${frequencyColor(s.frequencia)}`}>{s.frequencia}%</span>
                      </div>
                      <div className="col-span-1 flex justify-end">
                        {s.total >= 5 ? (
                          <AlertTriangle className="h-4 w-4 text-red-500" />
                        ) : (
                          <CheckCircle2 className="h-4 w-4 text-green-500" />
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {summary && summary.atRiskCount > 0 && (
            <div className="flex items-start gap-3 p-4 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900 rounded-lg text-sm">
              <TrendingDown className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-medium text-amber-800 dark:text-amber-300">
                  {summary.atRiskCount} aluno{summary.atRiskCount > 1 ? 's' : ''} com frequência preocupante
                </p>
                <p className="text-amber-700 dark:text-amber-400 text-xs mt-0.5">
                  Alunos com 5 ou mais faltas no período estão em risco de reprovação por frequência (mínimo legal: 75%).
                </p>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
