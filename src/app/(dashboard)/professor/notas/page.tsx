'use client'
import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Star, Save, ChevronDown } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { ASSESSMENT_TYPE_LABELS, formatDate } from '@/lib/utils'

interface Assessment {
  id: string
  name: string
  type: string
  period?: string
  date?: string
  maxScore: number
  weight: number
  subject: { name: string }
  class: { id: string; name: string }
  gradeRecords: { id: string; score?: number; student: { id: string; name: string } }[]
}

interface GradeEntry { studentId: string; studentName: string; score: string; original?: number }

export default function NotasPage() {
  const { data: session } = useSession()
  const [assessments, setAssessments] = useState<Assessment[]>([])
  const [selected, setSelected] = useState<Assessment | null>(null)
  const [grades, setGrades] = useState<GradeEntry[]>([])
  const [students, setStudents] = useState<any[]>([])
  const [saving, setSaving] = useState(false)
  const { toast } = useToast()

  useEffect(() => { fetchAssessments() }, [])

  const fetchAssessments = async () => {
    const res = await fetch('/api/avaliacoes')
    if (res.ok) setAssessments(await res.json())
  }

  const loadAssessment = async (assessment: Assessment) => {
    setSelected(assessment)
    const studentsRes = await fetch(`/api/alunos?classId=${assessment.class.id}`)
    const studentsData = studentsRes.ok ? await studentsRes.json() : []
    setStudents(studentsData)

    const gradeEntries = studentsData.map((s: any) => {
      const existing = assessment.gradeRecords.find(r => r.student.id === s.id)
      return {
        studentId: s.id,
        studentName: s.name,
        score: existing?.score !== undefined && existing?.score !== null ? String(existing.score) : '',
        original: existing?.score,
      }
    })
    setGrades(gradeEntries)
  }

  const handleSave = async () => {
    if (!selected) return
    setSaving(true)
    const payload = grades.map(g => ({
      assessmentId: selected.id,
      studentId: g.studentId,
      score: g.score !== '' ? parseFloat(g.score) : null,
    })).filter(g => g.score !== null)

    const res = await fetch('/api/notas', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ grades: payload }),
    })
    setSaving(false)
    if (res.ok) {
      toast({ title: 'Notas salvas com sucesso!' })
      fetchAssessments()
    } else {
      toast({ title: 'Erro ao salvar notas', variant: 'destructive' })
    }
  }

  const updateGrade = (studentId: string, score: string) => {
    setGrades(prev => prev.map(g => g.studentId === studentId ? { ...g, score } : g))
  }

  const getAvg = () => {
    const valid = grades.filter(g => g.score !== '').map(g => parseFloat(g.score)).filter(n => !isNaN(n))
    if (!valid.length) return null
    return (valid.reduce((a, b) => a + b, 0) / valid.length).toFixed(1)
  }

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2"><Star className="h-6 w-6" /> Lançamento de Notas</h1>
        <p className="text-muted-foreground text-sm">Selecione uma avaliação para lançar as notas</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: assessment list */}
        <div className="space-y-2">
          <p className="text-sm font-medium text-muted-foreground">Avaliações disponíveis</p>
          {assessments.map(a => (
            <Card
              key={a.id}
              className={`cursor-pointer hover:shadow-md transition-shadow ${selected?.id === a.id ? 'ring-2 ring-primary' : ''}`}
              onClick={() => loadAssessment(a)}
            >
              <CardContent className="p-4">
                <p className="font-medium text-sm">{a.name}</p>
                <div className="flex flex-wrap gap-1 mt-1">
                  <Badge variant="outline" className="text-xs">{a.subject.name}</Badge>
                  <Badge variant="info" className="text-xs">{a.class.name}</Badge>
                </div>
                <div className="flex items-center justify-between mt-2 text-xs text-muted-foreground">
                  <span>{ASSESSMENT_TYPE_LABELS[a.type]}</span>
                  <span>{a.gradeRecords.length} lançadas</span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Right: grade input */}
        <div className="lg:col-span-2">
          {!selected ? (
            <Card>
              <CardContent className="py-20 text-center text-muted-foreground">
                Selecione uma avaliação ao lado para lançar notas.
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-base">{selected.name}</CardTitle>
                    <p className="text-sm text-muted-foreground">{selected.subject.name} · {selected.class.name}</p>
                    {selected.date && <p className="text-xs text-muted-foreground">{formatDate(selected.date)}</p>}
                  </div>
                  <div className="text-right">
                    {getAvg() && (
                      <div>
                        <p className="text-xs text-muted-foreground">Média da turma</p>
                        <Badge variant={parseFloat(getAvg()!) >= 6 ? 'success' : 'destructive'} className="text-base px-3">
                          {getAvg()}
                        </Badge>
                      </div>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Aluno</TableHead>
                      <TableHead className="w-32">Nota (máx. {selected.maxScore})</TableHead>
                      <TableHead className="w-24">Situação</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {grades.map(g => {
                      const score = g.score !== '' ? parseFloat(g.score) : null
                      return (
                        <TableRow key={g.studentId}>
                          <TableCell className="font-medium">{g.studentName}</TableCell>
                          <TableCell>
                            <Input
                              type="number"
                              min="0"
                              max={selected.maxScore}
                              step="0.5"
                              className="h-8 w-24"
                              value={g.score}
                              onChange={e => updateGrade(g.studentId, e.target.value)}
                              placeholder="-"
                            />
                          </TableCell>
                          <TableCell>
                            {score !== null ? (
                              <Badge variant={score >= 6 ? 'success' : 'destructive'} className="text-xs">
                                {score >= 6 ? 'Aprovado' : 'Recuperação'}
                              </Badge>
                            ) : (
                              <Badge variant="secondary" className="text-xs">Pendente</Badge>
                            )}
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
                <div className="flex justify-end mt-4">
                  <Button onClick={handleSave} disabled={saving}>
                    <Save className="h-4 w-4 mr-2" />
                    {saving ? 'Salvando...' : 'Salvar Notas'}
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}
