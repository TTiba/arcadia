'use client'
import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Textarea } from '@/components/ui/textarea'
import { Plus, Search, Star, Eye } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { ASSESSMENT_TYPE_LABELS, formatDate } from '@/lib/utils'

interface Assessment {
  id: string
  name: string
  period?: string
  weight: number
  type: string
  date?: string
  maxScore: number
  criteria?: string
  subject: { name: string }
  class: { name: string }
  gradeRecords: { score?: number; student: { name: string } }[]
}

export default function AvaliacoesPage() {
  const [assessments, setAssessments] = useState<Assessment[]>([])
  const [search, setSearch] = useState('')
  const [open, setOpen] = useState(false)
  const [viewOpen, setViewOpen] = useState(false)
  const [selected, setSelected] = useState<Assessment | null>(null)
  const [form, setForm] = useState({
    name: '', subjectId: '', classId: '', period: '', weight: '1',
    type: 'PROVA', date: '', criteria: '', maxScore: '10'
  })
  const [classes, setClasses] = useState<any[]>([])
  const [subjects, setSubjects] = useState<any[]>([])
  const { toast } = useToast()

  useEffect(() => {
    fetchAssessments()
    fetch('/api/turmas').then(r => r.json()).then(setClasses)
    fetch('/api/aulas').then(r => r.json()).then(d => {
      const subjectMap = new Map()
      d.forEach((l: any) => { if (l.subject) subjectMap.set(l.subject.id, l.subject) })
      setSubjects(Array.from(subjectMap.values()))
    })
  }, [])

  const fetchAssessments = async () => {
    const res = await fetch('/api/avaliacoes')
    if (res.ok) setAssessments(await res.json())
  }

  const handleSave = async () => {
    const res = await fetch('/api/avaliacoes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })
    if (res.ok) {
      toast({ title: 'Avaliação criada!' })
      setOpen(false)
      fetchAssessments()
    } else {
      toast({ title: 'Erro ao salvar', variant: 'destructive' })
    }
  }

  const getAverage = (a: Assessment) => {
    if (!a.gradeRecords.length) return null
    const scored = a.gradeRecords.filter(r => r.score !== null && r.score !== undefined)
    if (!scored.length) return null
    return (scored.reduce((s, r) => s + (r.score || 0), 0) / scored.length).toFixed(1)
  }

  const filtered = assessments.filter(a =>
    a.name.toLowerCase().includes(search.toLowerCase()) ||
    a.subject.name.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2"><Star className="h-6 w-6" /> Avaliações</h1>
          <p className="text-muted-foreground text-sm">{assessments.length} avaliações cadastradas</p>
        </div>
        <Button onClick={() => setOpen(true)}><Plus className="h-4 w-4 mr-2" /> Nova Avaliação</Button>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Buscar avaliação..." className="pl-9" value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Componente</TableHead>
                <TableHead>Turma</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Período</TableHead>
                <TableHead>Data</TableHead>
                <TableHead>Peso</TableHead>
                <TableHead>Média</TableHead>
                <TableHead>Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow><TableCell colSpan={9} className="text-center py-8 text-muted-foreground">Nenhuma avaliação encontrada.</TableCell></TableRow>
              ) : filtered.map(a => {
                const avg = getAverage(a)
                return (
                  <TableRow key={a.id}>
                    <TableCell className="font-medium">{a.name}</TableCell>
                    <TableCell className="text-sm">{a.subject.name}</TableCell>
                    <TableCell><Badge variant="outline">{a.class.name}</Badge></TableCell>
                    <TableCell><Badge variant="secondary">{ASSESSMENT_TYPE_LABELS[a.type]}</Badge></TableCell>
                    <TableCell className="text-sm">{a.period || '-'}</TableCell>
                    <TableCell className="text-sm">{formatDate(a.date)}</TableCell>
                    <TableCell className="text-sm">{a.weight}x</TableCell>
                    <TableCell>
                      {avg ? (
                        <Badge variant={parseFloat(avg) >= 6 ? 'success' : 'destructive'}>{avg}</Badge>
                      ) : (
                        <span className="text-xs text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Button variant="ghost" size="icon" onClick={() => { setSelected(a); setViewOpen(true) }}>
                        <Eye className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader><DialogTitle>Nova Avaliação</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Nome *</Label>
              <Input placeholder="Ex: Prova Bimestral" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Tipo</Label>
                <select className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={form.type} onChange={e => setForm({ ...form, type: e.target.value })}>
                  {Object.entries(ASSESSMENT_TYPE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </div>
              <div className="space-y-2">
                <Label>Período</Label>
                <Input placeholder="Ex: 1º Bimestre" value={form.period} onChange={e => setForm({ ...form, period: e.target.value })} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Peso</Label>
                <Input type="number" step="0.5" value={form.weight} onChange={e => setForm({ ...form, weight: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Nota máxima</Label>
                <Input type="number" value={form.maxScore} onChange={e => setForm({ ...form, maxScore: e.target.value })} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Data</Label>
              <Input type="date" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Critérios de avaliação</Label>
              <Textarea rows={2} placeholder="Descreva os critérios..." value={form.criteria} onChange={e => setForm({ ...form, criteria: e.target.value })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={!form.name}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* View grades dialog */}
      <Dialog open={viewOpen} onOpenChange={setViewOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          {selected && (
            <>
              <DialogHeader>
                <DialogTitle>{selected.name}</DialogTitle>
                <p className="text-sm text-muted-foreground">{selected.subject.name} · {selected.class.name}</p>
              </DialogHeader>
              {selected.criteria && (
                <div className="p-3 bg-muted rounded-lg text-sm">{selected.criteria}</div>
              )}
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Aluno</TableHead>
                    <TableHead>Nota</TableHead>
                    <TableHead>Situação</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {selected.gradeRecords.length === 0 ? (
                    <TableRow><TableCell colSpan={3} className="text-center text-muted-foreground">Nenhuma nota lançada.</TableCell></TableRow>
                  ) : selected.gradeRecords.map((r, i) => (
                    <TableRow key={i}>
                      <TableCell>{r.student.name}</TableCell>
                      <TableCell>
                        {r.score !== null && r.score !== undefined ? (
                          <span className="font-mono font-medium">{r.score}</span>
                        ) : '-'}
                      </TableCell>
                      <TableCell>
                        {r.score !== null && r.score !== undefined ? (
                          <Badge variant={r.score >= 6 ? 'success' : 'destructive'}>
                            {r.score >= 6 ? 'Aprovado' : 'Recuperação'}
                          </Badge>
                        ) : <Badge variant="secondary">Pendente</Badge>}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
