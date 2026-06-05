'use client'
import { useState, useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Plus, Search, Users, X } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'

interface Teacher {
  id: string
  registration?: string
  user: { name: string; email: string; active: boolean }
  teacherSubjects: { subject: { id: string; name: string } }[]
  teacherClasses: { class: { id: string; name: string }; subject: { name: string } }[]
  _count?: { classRecords: number }
}

export default function ProfessoresPage() {
  const [teachers, setTeachers] = useState<Teacher[]>([])
  const [search, setSearch] = useState('')
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState({ name: '', email: '', password: '', registration: '' })
  const { toast } = useToast()
  const searchParams = useSearchParams()
  const activeFilter = searchParams.get('filter')

  useEffect(() => { fetchTeachers() }, [])

  const fetchTeachers = async () => {
    const res = await fetch('/api/professores')
    if (res.ok) setTeachers(await res.json())
  }

  const handleSave = async () => {
    const res = await fetch('/api/professores', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })
    if (res.ok) {
      toast({ title: 'Professor cadastrado com sucesso!' })
      setOpen(false)
      setForm({ name: '', email: '', password: '', registration: '' })
      fetchTeachers()
    } else {
      const err = await res.json()
      toast({ title: 'Erro ao salvar', description: err.message || 'Verifique os dados', variant: 'destructive' })
    }
  }

  const filtered = teachers.filter(t => {
    const matchSearch = t.user.name.toLowerCase().includes(search.toLowerCase()) || t.user.email.toLowerCase().includes(search.toLowerCase())
    const matchFilter = activeFilter === 'sem-registro' ? (t._count?.classRecords ?? 0) === 0 : true
    return matchSearch && matchFilter
  })

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2"><Users className="h-6 w-6" /> Professores</h1>
          <p className="text-muted-foreground text-sm">Gerencie o corpo docente</p>
        </div>
        <Button onClick={() => setOpen(true)}>
          <Plus className="h-4 w-4 mr-2" /> Novo Professor
        </Button>
      </div>

      {activeFilter === 'sem-registro' && (
        <div className="flex items-center gap-2 px-3 py-2 bg-red-50 border border-red-200 rounded-lg text-sm text-red-800 w-fit">
          <span>Filtro ativo: <strong>sem nenhum registro de aula</strong></span>
          <a href="/admin/professores" className="ml-1 text-red-500 hover:text-red-800"><X className="h-3.5 w-3.5" /></a>
        </div>
      )}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Buscar professor..." className="pl-9" value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Matrícula</TableHead>
                <TableHead>Componentes</TableHead>
                <TableHead>Turmas</TableHead>
                <TableHead>Registros de Aula</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Nenhum professor encontrado.</TableCell></TableRow>
              ) : filtered.map(t => (
                <TableRow key={t.id}>
                  <TableCell className="font-medium">{t.user.name}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{t.user.email}</TableCell>
                  <TableCell>{t.registration || '-'}</TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {t.teacherSubjects.slice(0, 2).map(ts => (
                        <Badge key={ts.subject.id} variant="outline" className="text-xs">{ts.subject.name}</Badge>
                      ))}
                      {t.teacherSubjects.length > 2 && <Badge variant="outline" className="text-xs">+{t.teacherSubjects.length - 2}</Badge>}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {Array.from(new Set(t.teacherClasses.map(tc => tc.class.name))).slice(0, 2).map(name => (
                        <Badge key={name} variant="info" className="text-xs">{name}</Badge>
                      ))}
                    </div>
                  </TableCell>
                  <TableCell>
                    {(t._count?.classRecords ?? 0) === 0
                      ? <Badge variant="destructive" className="text-xs">Nenhum</Badge>
                      : <span className="text-sm font-medium">{t._count?.classRecords}</span>
                    }
                  </TableCell>
                  <TableCell>
                    <Badge variant={t.user.active ? 'success' : 'secondary'}>
                      {t.user.active ? 'Ativo' : 'Inativo'}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Novo Professor</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Nome completo *</Label>
              <Input placeholder="Nome do professor" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Email *</Label>
              <Input type="email" placeholder="email@escola.edu.br" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Senha *</Label>
                <Input type="password" placeholder="Senha inicial" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Matrícula</Label>
                <Input placeholder="PROF-001" value={form.registration} onChange={e => setForm({ ...form, registration: e.target.value })} />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={!form.name || !form.email}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
