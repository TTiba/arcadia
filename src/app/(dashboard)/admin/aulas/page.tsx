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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Plus, Search, BookOpen, Eye, Link as LinkIcon, Video, FileText, ClipboardList } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { formatDate, getEmbedUrl } from '@/lib/utils'

interface Material {
  id?: string
  type: string
  title: string
  url?: string
  description?: string
}

interface Lesson {
  id: string
  title: string
  description?: string
  startDate?: string
  endDate?: string
  subject?: { name: string }
  lessonClasses: { class: { name: string } }[]
  materials: Material[]
  _count?: { classRecords: number; homework: number }
}

const MATERIAL_TYPES = [
  { value: 'LINK', label: 'Link', icon: LinkIcon },
  { value: 'VIDEO', label: 'Vídeo', icon: Video },
  { value: 'DOCUMENTO', label: 'Documento', icon: FileText },
]

const materialIcon = (type: string) => {
  if (type === 'VIDEO') return <Video className="h-3.5 w-3.5 text-red-500" />
  if (type === 'DOCUMENTO') return <FileText className="h-3.5 w-3.5 text-blue-500" />
  return <LinkIcon className="h-3.5 w-3.5 text-green-500" />
}

export default function AulasPage() {
  const [lessons, setLessons] = useState<Lesson[]>([])
  const [search, setSearch] = useState('')
  const [open, setOpen] = useState(false)
  const [viewLesson, setViewLesson] = useState<Lesson | null>(null)
  const [form, setForm] = useState({ title: '', description: '', startDate: '', endDate: '' })
  const [materials, setMaterials] = useState<Material[]>([])
  const [newMaterial, setNewMaterial] = useState<Material>({ type: 'LINK', title: '', url: '' })
  const { toast } = useToast()

  useEffect(() => { fetchLessons() }, [])

  const fetchLessons = async () => {
    const res = await fetch('/api/aulas')
    if (res.ok) setLessons(await res.json())
  }

  const addMaterial = () => {
    if (!newMaterial.title) return
    setMaterials([...materials, { ...newMaterial }])
    setNewMaterial({ type: 'LINK', title: '', url: '' })
  }

  const handleSave = async () => {
    const res = await fetch('/api/aulas', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...form, materials }),
    })
    if (res.ok) {
      toast({ title: 'Aula cadastrada!' })
      setOpen(false)
      setForm({ title: '', description: '', startDate: '', endDate: '' })
      setMaterials([])
      fetchLessons()
    } else {
      toast({ title: 'Erro ao salvar', variant: 'destructive' })
    }
  }

  const filtered = lessons.filter(l => l.title.toLowerCase().includes(search.toLowerCase()))

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2"><BookOpen className="h-6 w-6" /> Aulas</h1>
          <p className="text-muted-foreground text-sm">{lessons.length} aulas cadastradas</p>
        </div>
        <Button onClick={() => { setForm({ title: '', description: '', startDate: '', endDate: '' }); setMaterials([]); setOpen(true) }}>
          <Plus className="h-4 w-4 mr-2" /> Nova Aula
        </Button>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Buscar aula..." className="pl-9" value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.length === 0 ? (
          <p className="text-muted-foreground col-span-3 text-center py-8">Nenhuma aula encontrada.</p>
        ) : filtered.map(lesson => (
          <Card key={lesson.id} className="hover:shadow-md transition-shadow cursor-pointer" onClick={() => setViewLesson(lesson)}>
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between">
                <CardTitle className="text-base line-clamp-2">{lesson.title}</CardTitle>
                <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={e => { e.stopPropagation(); setViewLesson(lesson) }}>
                  <Eye className="h-3.5 w-3.5" />
                </Button>
              </div>
              {lesson.subject && <Badge variant="outline" className="w-fit text-xs">{lesson.subject.name}</Badge>}
            </CardHeader>
            <CardContent className="space-y-2">
              {lesson.description && <p className="text-xs text-muted-foreground line-clamp-2">{lesson.description}</p>}
              <div className="flex flex-wrap gap-1">
                {lesson.lessonClasses.map(lc => (
                  <Badge key={lc.class.name} variant="info" className="text-xs">{lc.class.name}</Badge>
                ))}
              </div>
              <div className="flex items-center gap-3 text-xs text-muted-foreground">
                <span className="flex items-center gap-1">
                  {materialIcon('VIDEO')} {lesson.materials.filter(m => m.type === 'VIDEO').length} vídeos
                </span>
                <span className="flex items-center gap-1">
                  <LinkIcon className="h-3 w-3" /> {lesson.materials.filter(m => m.type === 'LINK').length} links
                </span>
                <span className="flex items-center gap-1">
                  <ClipboardList className="h-3 w-3" /> {lesson._count?.classRecords || 0} registros
                </span>
              </div>
              {lesson.startDate && (
                <p className="text-xs text-muted-foreground">
                  {formatDate(lesson.startDate)} {lesson.endDate ? `→ ${formatDate(lesson.endDate)}` : ''}
                </p>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* New Lesson Dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Nova Aula</DialogTitle></DialogHeader>
          <Tabs defaultValue="info">
            <TabsList>
              <TabsTrigger value="info">Informações</TabsTrigger>
              <TabsTrigger value="materiais">Materiais</TabsTrigger>
            </TabsList>
            <TabsContent value="info" className="space-y-4 pt-4">
              <div className="space-y-2">
                <Label>Título *</Label>
                <Input placeholder="Título da aula" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Descrição</Label>
                <Textarea rows={3} placeholder="Descreva os objetivos e conteúdos..." value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Data inicial</Label>
                  <Input type="date" value={form.startDate} onChange={e => setForm({ ...form, startDate: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>Data final</Label>
                  <Input type="date" value={form.endDate} onChange={e => setForm({ ...form, endDate: e.target.value })} />
                </div>
              </div>
            </TabsContent>
            <TabsContent value="materiais" className="pt-4 space-y-4">
              <div className="p-4 border rounded-lg space-y-3 bg-muted/30">
                <p className="text-sm font-medium">Adicionar material</p>
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <Label className="text-xs">Tipo</Label>
                    <select
                      className="flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                      value={newMaterial.type}
                      onChange={e => setNewMaterial({ ...newMaterial, type: e.target.value })}
                    >
                      {MATERIAL_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                    </select>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Título</Label>
                    <Input className="h-9" placeholder="Nome do material" value={newMaterial.title} onChange={e => setNewMaterial({ ...newMaterial, title: e.target.value })} />
                  </div>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">URL</Label>
                  <Input className="h-9" placeholder="https://..." value={newMaterial.url || ''} onChange={e => setNewMaterial({ ...newMaterial, url: e.target.value })} />
                </div>
                <Button size="sm" onClick={addMaterial} disabled={!newMaterial.title}>
                  <Plus className="h-3.5 w-3.5 mr-1" /> Adicionar
                </Button>
              </div>
              {materials.length > 0 && (
                <div className="space-y-2">
                  {materials.map((m, i) => (
                    <div key={i} className="flex items-center justify-between p-2 border rounded-lg text-sm">
                      <span className="flex items-center gap-2">{materialIcon(m.type)} {m.title}</span>
                      <Button variant="ghost" size="sm" className="h-7 text-destructive" onClick={() => setMaterials(materials.filter((_, idx) => idx !== i))}>Remover</Button>
                    </div>
                  ))}
                </div>
              )}
            </TabsContent>
          </Tabs>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={!form.title}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* View Lesson Dialog */}
      {viewLesson && (
        <Dialog open={!!viewLesson} onOpenChange={() => setViewLesson(null)}>
          <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{viewLesson.title}</DialogTitle>
              {viewLesson.subject && <p className="text-sm text-muted-foreground">{viewLesson.subject.name}</p>}
            </DialogHeader>
            {viewLesson.description && <p className="text-sm text-muted-foreground">{viewLesson.description}</p>}
            <div className="space-y-4">
              {viewLesson.materials.filter(m => m.type === 'VIDEO').map((m, i) => {
                const embedUrl = m.url ? getEmbedUrl(m.url) : null
                return embedUrl ? (
                  <div key={i}>
                    <p className="text-sm font-medium mb-2">{m.title}</p>
                    <div className="aspect-video rounded-lg overflow-hidden border">
                      <iframe src={embedUrl} className="w-full h-full" allowFullScreen allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" />
                    </div>
                  </div>
                ) : (
                  <a key={i} href={m.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-sm text-primary hover:underline">
                    <Video className="h-4 w-4" /> {m.title}
                  </a>
                )
              })}
              {viewLesson.materials.filter(m => m.type !== 'VIDEO').length > 0 && (
                <div>
                  <p className="text-sm font-medium mb-2">Links e documentos</p>
                  <div className="space-y-2">
                    {viewLesson.materials.filter(m => m.type !== 'VIDEO').map((m, i) => (
                      <a key={i} href={m.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 p-2 border rounded-lg hover:bg-muted transition-colors">
                        {materialIcon(m.type)}
                        <span className="text-sm">{m.title}</span>
                      </a>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  )
}
